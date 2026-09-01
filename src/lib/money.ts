import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

async function getPeriodContext(roomId: number) {
  const [room, latest] = await Promise.all([
    db.room.findUniqueOrThrow({ where: { id: roomId } }),
    db.settlementRecord.findFirst({ where: { roomId }, orderBy: { periodEnd: "desc" } }),
  ]);
  return { periodStart: latest?.periodEnd ?? room.createdAt, hasSettled: !!latest };
}

/** The start of the room's current (unsettled) scoring/money period. */
export async function getCurrentPeriodStart(roomId: number): Promise<Date> {
  return (await getPeriodContext(roomId)).periodStart;
}

/**
 * The money pool for the CURRENT (unsettled) period only: top-ups made
 * since the last settlement, plus the room's initial pool but only while
 * no settlement has happened yet. A settlement already pays the pool out
 * once (SettlementRecord.finalMoneyPool) — carrying initialMoneyPool
 * forward into every later period on top of that would double-count it,
 * which is why the pool never used to look like it "reset" after a
 * settlement.
 */
export async function getCurrentMoneyPool(roomId: number, initialMoneyPool: Prisma.Decimal | number) {
  const { periodStart, hasSettled } = await getPeriodContext(roomId);
  const topUps = await db.moneyPoolTopUp.aggregate({
    where: { roomId, createdAt: { gte: periodStart } },
    _sum: { amount: true },
  });
  const base = hasSettled ? 0 : Number(initialMoneyPool);
  const added = Number(topUps._sum.amount ?? 0);
  return base + added;
}
