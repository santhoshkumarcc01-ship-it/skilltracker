-- Keep legacy orphan rows intact while enforcing these relationships for all new writes.
ALTER TABLE "MaterialFolder"
  ADD CONSTRAINT "MaterialFolder_parentId_userId_fkey"
  FOREIGN KEY ("parentId", "userId")
  REFERENCES "MaterialFolder"("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Material"
  ADD CONSTRAINT "Material_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Material"
  ADD CONSTRAINT "Material_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "MaterialFolder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Material"
  ADD CONSTRAINT "Material_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Memory"
  ADD CONSTRAINT "Memory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Memory"
  ADD CONSTRAINT "Memory_mediaFileId_fkey"
  FOREIGN KEY ("mediaFileId") REFERENCES "StoredFile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Memory"
  ADD CONSTRAINT "Memory_posterFileId_fkey"
  FOREIGN KEY ("posterFileId") REFERENCES "StoredFile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- This helper is only intended to run as an event trigger, never through the Data API.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END
$$;
