import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { runSettlementIfDue } from "@/lib/settlement";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/settlements">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    await runSettlementIfDue(roomId);

    const settlements = await db.settlementRecord.findMany({
      where: { roomId },
      orderBy: { periodEnd: "desc" },
    });

    return NextResponse.json({
      settlements: settlements.map((s) => ({
        id: s.id,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        memberScores: JSON.parse(s.memberScores),
        finalMoneyPool: Number(s.finalMoneyPool),
        moneyDistribution: JSON.parse(s.moneyDistribution),
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
