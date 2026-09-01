import type { Prisma } from "@/generated/prisma/client";
import { notify } from "@/lib/notify";

/**
 * Section 10.9: RewardAssignment conditions are checked after every
 * completion. A reward with limited stock is only granted while
 * stock_remaining > 0, and each grant consumes one unit.
 */
export async function checkRewardUnlocks(
  tx: Prisma.TransactionClient,
  params: { roomId: number; roomMemberId: number }
) {
  const assignments = await tx.rewardAssignment.findMany({
    where: { reward: { roomId: params.roomId } },
    include: { reward: true },
  });

  const unlockedRewardIds: number[] = [];

  for (const assignment of assignments) {
    const reward = assignment.reward;
    if (reward.stockTotal !== null && (reward.stockRemaining ?? 0) <= 0) continue;

    const already = await tx.rewardUnlock.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: params.roomMemberId } },
    });
    if (already) continue;

    const met = await isConditionMet(tx, assignment, params.roomMemberId);
    if (!met) continue;

    await tx.rewardUnlock.create({
      data: { rewardId: reward.id, roomMemberId: params.roomMemberId },
    });
    if (reward.stockTotal !== null) {
      await tx.reward.update({
        where: { id: reward.id },
        data: { stockRemaining: { decrement: 1 } },
      });
    }
    unlockedRewardIds.push(reward.id);
  }

  return unlockedRewardIds;
}

async function isConditionMet(
  tx: Prisma.TransactionClient,
  assignment: {
    unlockConditionType: "single_task" | "multi_task_threshold" | "streak_days";
    unlockConditionValue: string;
  },
  roomMemberId: number
): Promise<boolean> {
  const value = JSON.parse(assignment.unlockConditionValue) as {
    taskId?: number;
    taskIds?: number[];
    threshold?: number;
    streakType?: string;
    days?: number;
  };

  if (assignment.unlockConditionType === "single_task") {
    if (!value.taskId) return false;
    const count = await tx.taskCompletion.count({
      where: { roomMemberId, taskTemplateId: value.taskId },
    });
    return count >= 1;
  }

  if (assignment.unlockConditionType === "multi_task_threshold") {
    if (!value.taskIds || !value.threshold) return false;
    const count = await tx.taskCompletion.count({
      where: { roomMemberId, taskTemplateId: { in: value.taskIds } },
    });
    return count >= value.threshold;
  }

  if (assignment.unlockConditionType === "streak_days") {
    if (!value.days) return false;
    const streak = await tx.streakRecord.findUnique({
      where: {
        roomId_roomMemberId_streakType: {
          roomId: (await tx.roomMember.findUniqueOrThrow({ where: { id: roomMemberId } })).roomId,
          roomMemberId,
          streakType: value.streakType ?? "any_daily_task",
        },
      },
    });
    return (streak?.currentStreak ?? 0) >= value.days;
  }

  return false;
}

export async function notifyRewardUnlocks(roomId: number, roomMemberId: number, rewardIds: number[]) {
  await Promise.all(
    rewardIds.map((rewardId) =>
      notify({ roomId, roomMemberId, type: "reward_unlocked", relatedEntityType: "Reward", relatedEntityId: rewardId })
    )
  );
}
