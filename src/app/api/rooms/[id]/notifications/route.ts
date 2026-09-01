import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/notifications">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const notifications = await db.notification.findMany({
      where: { roomId, roomMemberId: member.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
