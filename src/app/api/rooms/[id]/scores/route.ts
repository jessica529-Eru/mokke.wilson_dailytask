import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { getCurrentMoneyPool } from "@/lib/money";
import { runSettlementIfDue, getCurrentPeriodStart } from "@/lib/settlement";

// Powers the always-on home tug-of-war (section 4): live score ratio, money
// pool, and a "if we settled right now" preview — explicitly not a real
// settlement. Scores are scoped to the current (unsettled) period only —
// once a SettlementRecord closes a period, its points stop counting here.
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/scores">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    await runSettlementIfDue(roomId);
    const periodStart = await getCurrentPeriodStart(roomId);

    const room = await db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { members: { orderBy: { joinedAt: "asc" } } },
    });

    const grouped = await db.taskCompletion.groupBy({
      by: ["roomMemberId"],
      where: { roomMember: { roomId }, completedAt: { gte: periodStart } },
      _sum: { pointsAwarded: true },
    });
    const scoreByMember = new Map(grouped.map((g) => [g.roomMemberId, g._sum.pointsAwarded ?? 0]));

    const currentMoneyPool = await getCurrentMoneyPool(roomId, room.initialMoneyPool);
    const totalScore = room.members.reduce((sum, m) => sum + (scoreByMember.get(m.id) ?? 0), 0);

    const members = room.members.map((m) => {
      const score = scoreByMember.get(m.id) ?? 0;
      const ratio = totalScore > 0 ? score / totalScore : 0.5;
      return {
        id: m.id,
        displayNickname: m.displayNickname,
        color: m.color,
        avatarUrl: m.avatarUrl,
        score,
        ratio,
        projectedPayout: Math.round(currentMoneyPool * ratio * 100) / 100,
      };
    });

    return NextResponse.json({
      currentMoneyPool,
      totalScore,
      members,
      isTie: totalScore === 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
