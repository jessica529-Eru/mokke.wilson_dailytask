import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/streaks">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const streaks = await db.streakRecord.findMany({
      where: { roomId },
      include: { roomMember: true },
    });

    return NextResponse.json({
      streaks: streaks.map((s) => ({
        roomMemberId: s.roomMemberId,
        displayNickname: s.roomMember.displayNickname,
        streakType: s.streakType,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        lastActiveLocalDate: s.lastActiveLocalDate,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
