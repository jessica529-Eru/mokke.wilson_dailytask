import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ApiError } from "@/lib/api";

export async function requireMember() {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "尚未登入");
  }
  const member = await db.roomMember.findUnique({
    where: { id: session.roomMemberId },
    include: { room: true },
  });
  if (!member || member.roomId !== session.roomId) {
    throw new ApiError(401, "登入狀態無效");
  }
  return member;
}

export async function requireRoomMember(roomId: number) {
  const member = await requireMember();
  if (member.roomId !== roomId) {
    throw new ApiError(403, "無權限存取此房間");
  }
  return member;
}

export async function getPartner(roomId: number, selfId: number) {
  return db.roomMember.findFirst({
    where: { roomId, id: { not: selfId } },
  });
}
