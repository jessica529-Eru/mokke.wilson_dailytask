import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/rooms/[id]/notifications/[notificationId]/read">
) {
  try {
    const { id, notificationId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const notification = await db.notification.findUnique({ where: { id: Number(notificationId) } });
    if (!notification || notification.roomId !== roomId || notification.roomMemberId !== member.id) {
      throw new ApiError(404, "找不到此通知");
    }

    await db.notification.update({ where: { id: notification.id }, data: { isRead: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
