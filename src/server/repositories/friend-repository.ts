import { prisma } from "@/server/lib/prisma";
export function findUserByFriendToken(token: string) { return prisma.profile.findUnique({ where: { friendToken: token }, select: { userId: true } }); }
export async function sendFriendInvite(senderId: string, receiverId: string) {
  if (await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: senderId, blockedId: receiverId }, { blockerId: receiverId, blockedId: senderId }] } })) return;
  if (await prisma.friendship.findFirst({ where: { OR: [{ userId: senderId, friendId: receiverId }, { userId: receiverId, friendId: senderId }] } })) return;
  if (await prisma.friendInvite.findFirst({ where: { status: "PENDING", OR: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] } })) return;
  await prisma.friendInvite.create({ data: { senderId, receiverId } });
}
export function invitesFor(userId: string) { return prisma.friendInvite.findMany({ where: { status: "PENDING", OR: [{ receiverId: userId }, { senderId: userId }] }, include: { sender: { select: { id: true, displayName: true, profile: { select: { friendToken: true } } } }, receiver: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "desc" } }); }
export async function respondInvite(userId: string, id: string, response: "ACCEPTED" | "DECLINED" | "CANCELED") {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.friendInvite.findFirst({ where: { id, status: "PENDING", ...(response === "CANCELED" ? { senderId: userId } : { receiverId: userId }) } });
    if (!invite) return null;
    await tx.friendInvite.update({ where: { id }, data: { status: response, respondedAt: new Date() } });
    if (response === "ACCEPTED") await tx.friendship.createMany({ data: [{ userId: invite.senderId, friendId: invite.receiverId }, { userId: invite.receiverId, friendId: invite.senderId }], skipDuplicates: true });
    return invite;
  });
}
export function friendIsMember(userId: string, friendId: string) { return prisma.friendship.findFirst({ where: { userId, friendId } }); }
export function blockUser(blockerId: string, blockedId: string) { return prisma.$transaction(async (tx) => { await tx.userBlock.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} }); await tx.friendInvite.deleteMany({ where: { status: "PENDING", OR: [{ senderId: blockerId, receiverId: blockedId }, { senderId: blockedId, receiverId: blockerId }] } }); await tx.friendship.deleteMany({ where: { OR: [{ userId: blockerId, friendId: blockedId }, { userId: blockedId, friendId: blockerId }] } }); }); }
export function unblockUser(blockerId: string, blockedId: string) { return prisma.userBlock.deleteMany({ where: { blockerId, blockedId } }); }
export function listFriendIds(userId: string) { return prisma.friendship.findMany({ where: { userId }, select: { friendId: true } }).then((rows) => rows.map((row) => row.friendId)); }
