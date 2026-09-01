import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export async function getCurrentMoneyPool(roomId: number, initialMoneyPool: Prisma.Decimal | number) {
  const topUps = await db.moneyPoolTopUp.aggregate({
    where: { roomId },
    _sum: { amount: true },
  });
  const base = Number(initialMoneyPool);
  const added = Number(topUps._sum.amount ?? 0);
  return base + added;
}
