import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentMoneyPool } from "@/lib/money";
import { logAudit } from "@/lib/audit";

/**
 * Section 10.11. Lazily triggered (no cron in this deployment) from any
 * request that reads room/score data — if Room.settlement_date has passed
 * and this period hasn't been settled yet, close it out:
 *   1. Sum each member's points for the period into SettlementRecord.
 *   2. Void remaining (uncompleted) quota on active extra_quota templates.
 *   3. Leave TaskCompletion/StreakRecord/Reward stock untouched — history
 *      is never deleted, scores just get re-scoped to "since last
 *      settlement" going forward (see getPeriodStart / scores route).
 * Idempotent: a second call after settlement is a no-op until
 * settlementDate is moved forward again.
 */
export async function runSettlementIfDue(roomId: number) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room || room.status !== "active" || !room.settlementDate) return;
  if (new Date() < room.settlementDate) return;

  const latest = await db.settlementRecord.findFirst({
    where: { roomId },
    orderBy: { periodEnd: "desc" },
  });
  if (latest && latest.periodEnd >= room.settlementDate) return; // already settled this period

  const periodStart = latest?.periodEnd ?? room.createdAt;
  const periodEnd = room.settlementDate;

  const members = await db.roomMember.findMany({ where: { roomId } });

  const record = await db.$transaction(async (tx) => {
    const grouped = await tx.taskCompletion.groupBy({
      by: ["roomMemberId"],
      where: {
        roomMember: { roomId },
        completedAt: { gte: periodStart, lt: periodEnd },
      },
      _sum: { pointsAwarded: true },
    });
    const scoreByMember = new Map(grouped.map((g) => [g.roomMemberId, g._sum.pointsAwarded ?? 0]));
    const memberScores: Record<string, number> = {};
    for (const m of members) memberScores[m.id] = scoreByMember.get(m.id) ?? 0;

    const totalScore = Object.values(memberScores).reduce((a, b) => a + b, 0);
    const finalMoneyPool = await getCurrentMoneyPool(roomId, room.initialMoneyPool);

    const moneyDistribution: Record<string, number> = {};
    for (const m of members) {
      const ratio = totalScore > 0 ? memberScores[m.id] / totalScore : 1 / members.length;
      moneyDistribution[m.id] = Math.round(finalMoneyPool * ratio * 100) / 100;
    }

    const record = await tx.settlementRecord.create({
      data: {
        roomId,
        periodStart,
        periodEnd,
        memberScores: JSON.stringify(memberScores),
        finalMoneyPool,
        moneyDistribution: JSON.stringify(moneyDistribution),
      },
    });

    await voidExhaustedQuotaTasks(tx, roomId);

    return record;
  });

  await logAudit({
    roomId,
    actorRoomMemberId: null,
    actionType: "settlement_completed",
    targetEntityType: "SettlementRecord",
    targetEntityId: record.id,
  });
}

async function voidExhaustedQuotaTasks(tx: Prisma.TransactionClient, roomId: number) {
  // Each row needs its own quotaTotal echoed back into quotaUsed, so this
  // can't be a single updateMany — walk them one at a time.
  const templates = await tx.taskTemplate.findMany({
    where: { roomId, type: "extra_quota", status: "active", quotaTotal: { not: null } },
  });
  for (const t of templates) {
    if (t.quotaTotal !== null && t.quotaUsed < t.quotaTotal) {
      await tx.taskTemplate.update({ where: { id: t.id }, data: { quotaUsed: t.quotaTotal } });
    }
  }
}

/** The start of the room's current (unsettled) scoring period. */
export async function getCurrentPeriodStart(roomId: number): Promise<Date> {
  const [room, latest] = await Promise.all([
    db.room.findUniqueOrThrow({ where: { id: roomId } }),
    db.settlementRecord.findFirst({ where: { roomId }, orderBy: { periodEnd: "desc" } }),
  ]);
  return latest?.periodEnd ?? room.createdAt;
}
