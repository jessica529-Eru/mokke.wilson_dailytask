import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { completeTaskSchema } from "@/lib/taskInput";
import { localDateInTimezone, bumpStreak, createProducedStamp, maybeTriggerSurpriseTask } from "@/lib/taskLifecycle";
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
        const payload = JSON.parse(override.payload) as { points?: number };
        if (typeof payload.points === "number") pointsAwarded = payload.points;
      }
    }

    const partner = await getPartner(roomId, member.id);

    const { completion, stampReward, surpriseTask } = await db.$transaction(async (tx) => {
      const completion = await tx.taskCompletion.create({
        data: {
          taskTemplateId: task.id,
          roomMemberId: member.id,
          completedLocalDate,
          proofText: body.proofText,
          proofImageUrls: body.proofImageUrls ? JSON.stringify(body.proofImageUrls) : undefined,
          pointsAwarded,
          isMakeup: body.isMakeup,
        },
      });

      if (task.type === "extra_quota") {
        await tx.taskTemplate.update({
          where: { id: task.id },
          data: { quotaUsed: { increment: 1 } },
        });
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

      return { completion, stampReward, surpriseTask };
    });

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
    return handleApiError(err);
  }
}
