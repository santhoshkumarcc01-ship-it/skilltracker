import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ApiError } from "@/backend/lib/api";
import { env } from "@/backend/lib/env";
import { s3 } from "@/backend/lib/s3";
import { assertUploadSize, MIME_EXTENSIONS, sniffMime, type AllowedUploadMime, type UploadPurpose } from "@/backend/lib/storage-rules";
import { assertOwnership } from "@/backend/middleware/ownership";
import { claimPendingUpload, claimStoredFilesUnusedByMemories, confirmStoredFile, createPendingUpload, deletePendingUpload, ownedStoredFile, pendingUpload, releasePendingUploadClaim } from "@/backend/repositories/storage-repository";
import { userPendingStorageObjects, userStorageObjects } from "@/backend/repositories/auth-repository";
import { uploadRateLimit } from "@/backend/services/storage/upload-rate-limit";

const bucket = env.S3_BUCKET;
const PRESIGN_SECONDS = 5 * 60;
const READ_SECONDS = 10 * 60;

export async function presignUpload(userId: string, input: { mimeType: AllowedUploadMime; size: number; purpose?: UploadPurpose }) {
  assertOwnership(userId, userId);
  const purpose = input.purpose ?? "story";
  assertUploadSize(input.mimeType, input.size, purpose);
  const limit = uploadRateLimit.check(userId);
  if (!limit.allowed) throw new ApiError(429, "UPLOAD_RATE_LIMITED", "You’ve requested too many uploads. Please try again soon.", { "Retry-After": String(limit.retryAfterSeconds) });
  const key = `${userId}/${randomUUID()}.${MIME_EXTENSIONS[input.mimeType]}`;
  const expiresAt = new Date(Date.now() + PRESIGN_SECONDS * 1000);
  await createPendingUpload(userId, key, input.mimeType, input.size, purpose, expiresAt);
  try {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.mimeType });
    const url = await getSignedUrl(s3, command, { expiresIn: PRESIGN_SECONDS });
    return { key, url, method: "PUT" as const, requiredHeaders: { "Content-Type": input.mimeType }, expiresAt: expiresAt.toISOString() };
  } catch {
    await deletePendingUpload(userId, key);
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Uploads are temporarily unavailable.");
  }
}

export async function confirmUpload(userId: string, key: string) {
  assertOwnership(userId, userId);
  if (!key.startsWith(`${userId}/`) || key.length > 300) throw new ApiError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
  const pending = await pendingUpload(userId, key);
  if (!pending) throw new ApiError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
  if (pending.expiresAt <= new Date()) {
    await discardPendingObject(userId, key);
    throw new ApiError(410, "UPLOAD_EXPIRED", "That upload expired. Please choose the file again.");
  }
  if (!(await claimPendingUpload(userId, key))) throw new ApiError(409, "UPLOAD_CONFIRMING", "This upload is already being checked. Please wait a moment.");

  let head;
  try { head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); }
  catch { await releasePendingUploadClaim(userId, key); throw new ApiError(409, "UPLOAD_NOT_READY", "The file has not finished uploading yet."); }
  if (!head.ContentLength || head.ContentLength !== pending.declaredSize || head.ContentType !== pending.declaredMime) {
    await discardPendingObject(userId, key);
    throw new ApiError(415, "UPLOAD_MISMATCH", "The uploaded file did not match its declared type or size and was removed.");
  }

  let thumbnailKey: string | null = null;
  try {
    const sample = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-4095" }));
    const prefix = await sample.Body?.transformToByteArray();
    const office = pending.declaredMime.startsWith("application/vnd.openxmlformats-officedocument/");
    const textFile = pending.declaredMime === "text/plain";
    const inspected = (office || textFile) ? await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })) : null;
    const bytesForSniff = inspected ? await inspected.Body!.transformToByteArray() : prefix;
    const detected = bytesForSniff ? sniffMime(bytesForSniff, pending.declaredMime as AllowedUploadMime) : null;
    if (detected !== pending.declaredMime) {
      await discardPendingObject(userId, key);
      throw new ApiError(415, "UPLOAD_MISMATCH", "The uploaded file content did not match its declared type and was removed.");
    }

    let size = head.ContentLength;
    if (detected.startsWith("image/")) {
      const source = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const sourceBytes = Buffer.from(await source.Body!.transformToByteArray());
      const sanitized = await sanitizeImage(sourceBytes, detected);
      assertUploadSize(detected, sanitized.byteLength, pending.purpose === "material" ? "material" : "story");
      thumbnailKey = key.replace(/\.[^.]+$/, ".thumb.webp");
      const thumbnail = await sharp(sanitized, { limitInputPixels: 50_000_000 })
        .rotate().resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: sanitized, ContentType: detected, ContentLength: sanitized.byteLength, CacheControl: "private, max-age=0, no-store" }));
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbnailKey, Body: thumbnail, ContentType: "image/webp", ContentLength: thumbnail.byteLength, CacheControl: "private, max-age=0, no-store" }));
      size = sanitized.byteLength;
    }

    const url = await signedReadUrl(key);
    const thumbnailUrl = thumbnailKey ? await signedReadUrl(thumbnailKey) : null;
    const file = await confirmStoredFile(userId, key, detected, size, thumbnailKey);
    if (!file) {
      await deleteObject(key);
      if (thumbnailKey) await deleteObject(thumbnailKey);
      await deletePendingUpload(userId, key);
      throw new ApiError(410, "UPLOAD_EXPIRED", "That upload expired. Please choose the file again.");
    }
    return { file, url, thumbnailUrl };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    await discardPendingObject(userId, key);
    if (thumbnailKey) { try { await deleteObject(thumbnailKey); } catch { /* Best-effort cleanup. */ } }
    throw new ApiError(415, "INVALID_MEDIA", "This file could not be safely processed and was removed.");
  }
}

export async function signedOwnedFile(userId: string, fileId: string) {
  assertOwnership(userId, userId);
  const file = await ownedStoredFile(userId, fileId);
  if (!file) throw new ApiError(404, "FILE_NOT_FOUND", "File not found.");
  return signOwnedStoredFile(userId, file);
}

export async function signOwnedStoredFile(userId: string, file: { userId: string; id: string; objectKey: string; thumbnailKey: string | null; mimeType: string; size: number }) {
  assertOwnership(userId, file.userId);
  return { file, url: await signedReadUrl(file.objectKey), thumbnailUrl: file.thumbnailKey ? await signedReadUrl(file.thumbnailKey) : null };
}

export async function removeStoredFiles(userId: string, files: { id: string; objectKey: string; thumbnailKey: string | null }[]) {
  assertOwnership(userId, userId);
  if (!files.length) return;
  for (const file of files) {
    try {
      await deleteObject(file.objectKey);
      if (file.thumbnailKey) await deleteObject(file.thumbnailKey);
    } catch {
      // The database record is removed by the caller; private orphaned objects are not exposed.
      console.error(JSON.stringify({ event: "storage_delete_failed", userId, fileId: file.id }));
    }
  }
}

export async function cleanupUnusedStoredFiles(userId: string, ids: string[]) {
  const unused = await claimStoredFilesUnusedByMemories(userId, ids);
  await removeStoredFiles(userId, unused);
}

export async function removeAllUserStorage(userId: string) {
  assertOwnership(userId, userId);
  const [stored, pending] = await Promise.all([userStorageObjects(userId), userPendingStorageObjects(userId)]);
  await removeStoredFiles(userId, stored);
  for (const upload of pending) {
    try { await deleteObject(upload.objectKey); } catch { /* Best-effort cleanup before account deletion. */ }
  }
}

async function sanitizeImage(source: Buffer, mimeType: AllowedUploadMime) {
  const image = sharp(source, { animated: mimeType === "image/gif", limitInputPixels: 50_000_000 }).rotate();
  switch (mimeType) {
    case "image/jpeg": return image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case "image/png": return image.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp": return image.webp({ quality: 90 }).toBuffer();
    case "image/gif": return image.gif({ effort: 5 }).toBuffer();
    default: throw new ApiError(415, "UNSUPPORTED_MEDIA", "That image type is not supported.");
  }
}

async function signedReadUrl(key: string) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: READ_SECONDS });
}
async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
async function discardPendingObject(userId: string, key: string) {
  try { await deleteObject(key); } catch { /* Already missing or temporarily unavailable. */ }
  await deletePendingUpload(userId, key);
}
