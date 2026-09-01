import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentMoneyPool, getCurrentPeriodStart } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export { getCurrentPeriodStart };

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

/**
 * Section 10.11. Lazily triggered (no cron in this deployment) from any
 * request that reads room/score data — if Room.settlement_date has passed
 * and this period hasn't been settled yet, close it out:
 *   1. Sum each member's points for the period into SettlementRecord.
 *   2. Reset every active extra_quota template's quota_used back to 0, so
 *      the same quota_total is simply available again next period — no
 *      per-template 沿用/封存 decision needed (confirmed with product owner:
 *      a template good for 10 uses this period is good for 10 more next
 *      period, automatically).
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

  // This whole function is lazily triggered from ordinary page-load
  // requests, so it's normal for two requests (e.g. the room summary and
  // scores endpoints, fetched in the same Promise.all on a page) to both
  // reach here concurrently, both see "not settled yet" above, and both
  // try to create a SettlementRecord for the same period — the exact
  // "two settlement rows for one period" symptom reported. The
  // @@unique([roomId, periodEnd]) constraint on SettlementRecord makes
  // that impossible at the database level; whichever request loses the
  // race gets a unique-constraint error here, which just means the other
  // one already did the job, so it's swallowed as a no-op.
  let record;
  try {
    record = await db.$transaction(async (tx) => {
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

      await resetQuotaTasksForNextPeriod(tx, roomId);

      return record;
    });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === UNIQUE_CONSTRAINT_ERROR_CODE) {
      return;
    }
    throw err;
  }

  await logAudit({
    roomId,
    actorRoomMemberId: null,
    actionType: "settlement_completed",
    targetEntityType: "SettlementRecord",
    targetEntityId: record.id,
  });
}

async function resetQuotaTasksForNextPeriod(tx: Prisma.TransactionClient, roomId: number) {
  await tx.taskTemplate.updateMany({
    where: { roomId, type: "extra_quota", status: "active" },
    data: { quotaUsed: 0 },
  });
}
