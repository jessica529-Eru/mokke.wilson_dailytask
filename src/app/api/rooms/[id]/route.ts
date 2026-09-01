import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { getCurrentMoneyPool } from "@/lib/money";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const room = await db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { members: { orderBy: { joinedAt: "asc" } } },
    });

    const currentMoneyPool = await getCurrentMoneyPool(roomId, room.initialMoneyPool);

    return NextResponse.json({
      room: {
        id: room.id,
        roomName: room.roomName,
        status: room.status,
        inviteCode: room.status === "draft" ? room.inviteCode : undefined,
        settlementDate: room.settlementDate,
        settlementTimezone: room.settlementTimezone,
        initialMoneyPool: Number(room.initialMoneyPool),
        currentMoneyPool,
      },
      members: room.members.map((m) => ({
        id: m.id,
        displayNickname: m.displayNickname,
        avatarUrl: m.avatarUrl,
        color: m.color,
        role: m.role,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
