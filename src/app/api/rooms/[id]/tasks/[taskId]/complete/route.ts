import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { completeTaskSchema } from "@/lib/taskInput";
import { localDateInTimezone, bumpStreak, createProducedStamp, maybeTriggerSurpriseTask } from "@/lib/taskLifecycle";
import { checkRewardUnlocks, notifyRewardUnlocks, notifyRewardStockExhausted } from "@/lib/rewards";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/tasks/[taskId]/complete">) {
  try {
    const { id, taskId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = completeTaskSchema.parse(await req.json());

    const task = await db.taskTemplate.findUnique({ where: { id: Number(taskId) } });
    if (!task || task.roomId !== roomId) {
      throw new ApiError(404, "找不到任務");
    }
    if (task.status !== "active") {
      throw new ApiError(409, "此任務目前無法完成");
    }

    const isAuthorized =
      task.assignScope === "both" ? true : task.assignedToId === member.id;
    if (!isAuthorized) {
      throw new ApiError(403, "這不是指派給你的任務");
    }

    if (task.type === "extra_quota" && task.quotaTotal !== null && task.quotaUsed >= task.quotaTotal) {
      throw new ApiError(409, "此任務額度已用完");
    }

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    const completedLocalDate = body.completedLocalDate ?? localDateInTimezone(room.settlementTimezone);

    if (task.type === "daily") {
      const existing = await db.taskCompletion.findFirst({
        where: { taskTemplateId: task.id, roomMemberId: member.id, completedLocalDate },
      });
      if (existing) {
        throw new ApiError(409, "今天已經完成過這項任務了");
      }
    }

    let pointsAwarded = task.points ?? 0;
    let overrideRewardId: number | null = null;
    if (task.type === "extra_quota") {
      const override = await db.taskApprovalRequest.findFirst({
        where: {
          taskTemplateId: task.id,
          requestType: "change_quota_reward",
          status: "approved",
          appliesToCompletionIndex: task.quotaUsed,
        },
        orderBy: { resolvedAt: "desc" },
      });
      if (override) {
        const payload = JSON.parse(override.payload) as { points?: number; rewardId?: number };
        if (typeof payload.points === "number") pointsAwarded = payload.points;
        if (typeof payload.rewardId === "number") overrideRewardId = payload.rewardId;
      }
    }

    const partner = await getPartner(roomId, member.id);

    const { completion, stampReward, surpriseTask, unlockedRewardIds, exhaustedRewardIds } = await db.$transaction(async (tx) => {
      const completion = await tx.taskCompletion.create({
        data: {
          taskTemplateId: task.id,
          roomMemberId: member.id,
          completedLocalDate,
          proofText: body.proofText,
          proofImageUrls: body.proofImageUrls ? JSON.stringify(body.proofImageUrls) : undefined,
          pointsAwarded,
          // Re-enforces the pre-check above at the DB level: two
          // near-simultaneous requests could otherwise both pass that
          // findFirst before either had committed a row.
          dailyDedupeKey: task.type === "daily" ? `${task.id}:${member.id}:${completedLocalDate}` : undefined,
        },
      });

      if (task.type === "extra_quota" && task.quotaTotal !== null) {
        // Guarded (not a blind increment) so two concurrent completions
        // right at the quota edge can't both succeed and push quotaUsed
        // past quotaTotal.
        const updated = await tx.taskTemplate.updateMany({
          where: { id: task.id, quotaUsed: { lt: task.quotaTotal } },
          data: { quotaUsed: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new ApiError(409, "此任務額度已用完");
        }
      }

      let stampReward = null;
      if (task.requiresProof && (body.proofText || (body.proofImageUrls && body.proofImageUrls.length > 0))) {
        stampReward = await createProducedStamp(tx, {
          roomId,
          roomMemberId: member.id,
          taskTitle: task.title,
          proofText: body.proofText,
          proofImageUrls: body.proofImageUrls,
        });
        await tx.taskCompletion.update({
          where: { id: completion.id },
          data: { rewardId: stampReward.id },
        });
        if (body.unlockCondition) {
          await tx.rewardAssignment.create({
            data: {
              rewardId: stampReward.id,
              unlockConditionType: body.unlockCondition.unlockConditionType,
              unlockConditionValue: JSON.stringify(body.unlockCondition.unlockConditionValue),
            },
          });
        }
      }

      if (task.type === "daily" && task.streakCountsTowardDaily) {
        await bumpStreak(tx, {
          roomId,
          roomMemberId: member.id,
          streakType: "any_daily_task",
          localDate: completedLocalDate,
        });
      }

      let surpriseTask = null;
      if (partner) {
        surpriseTask = await maybeTriggerSurpriseTask(tx, {
          roomId,
          sourceTask: task,
          partnerId: partner.id,
        });
      }

      const { unlockedRewardIds, exhaustedRewardIds } = await checkRewardUnlocks(tx, {
        roomId,
        roomMemberId: member.id,
      });

      // A quota-reward-change override can grant a specific reward-library
      // item directly for this one completion, separate from any
      // condition-based unlock checkRewardUnlocks just ran.
      if (overrideRewardId !== null) {
        const existingUnlock = await tx.rewardUnlock.findUnique({
          where: { rewardId_roomMemberId: { rewardId: overrideRewardId, roomMemberId: member.id } },
        });
        if (!existingUnlock) {
          const reward = await tx.reward.findUnique({ where: { id: overrideRewardId } });
          if (reward && (reward.stockTotal === null || (reward.stockRemaining ?? 0) > 0)) {
            // Guarded decrement (not blind), same as checkRewardUnlocks —
            // stops two concurrent grants from taking stock below zero.
            let stockGranted = true;
            if (reward.stockTotal !== null) {
              const updated = await tx.reward.updateMany({
                where: { id: overrideRewardId, stockRemaining: { gt: 0 } },
                data: { stockRemaining: { decrement: 1 } },
              });
              stockGranted = updated.count > 0;
              if (stockGranted) {
                const fresh = await tx.reward.findUniqueOrThrow({ where: { id: overrideRewardId } });
                if ((fresh.stockRemaining ?? 0) <= 0) exhaustedRewardIds.push(overrideRewardId);
              }
            }
            if (stockGranted) {
              await tx.rewardUnlock.create({
                data: { rewardId: overrideRewardId, roomMemberId: member.id },
              });
              unlockedRewardIds.push(overrideRewardId);
            }
          }
        }
      }

      return { completion, stampReward, surpriseTask, unlockedRewardIds, exhaustedRewardIds };
    });

    if (unlockedRewardIds.length > 0) {
      await notifyRewardUnlocks(roomId, member.id, unlockedRewardIds);
    }
    await notifyRewardStockExhausted(roomId, exhaustedRewardIds);

    if (partner && surpriseTask) {
      await Promise.all([
        notify({
          roomId,
          roomMemberId: member.id,
          type: "surprise_task_triggered",
          relatedEntityType: "TaskTemplate",
          relatedEntityId: surpriseTask.id,
        }),
        notify({
          roomId,
          roomMemberId: partner.id,
          type: "surprise_task_triggered",
          relatedEntityType: "TaskTemplate",
          relatedEntityId: surpriseTask.id,
        }),
      ]);
    }

    return NextResponse.json(
      {
        completion: {
          id: completion.id,
          pointsAwarded: completion.pointsAwarded,
          completedLocalDate: completion.completedLocalDate,
          rewardId: stampReward?.id ?? null,
        },
        surpriseTaskTriggered: surpriseTask ? { id: surpriseTask.id, title: surpriseTask.title } : null,
      },
      { status: 201 }
    );
  } catch (err) {
    // The dailyDedupeKey unique constraint is the safety net for the
    // findFirst check above — two near-simultaneous requests can both
    // pass that check, but only one can win the DB insert.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return handleApiError(new ApiError(409, "今天已經完成過這項任務了"));
    }
    return handleApiError(err);
  }
}
