import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { computeResponseDeadline } from "@/lib/taskLifecycle";
import { notify } from "@/lib/notify";

const bodySchema = z
  .object({
    points: z.number().int().min(0).max(1000).optional(),
    // Lets the next completion grant an existing reward-library item
    // instead of (or alongside) a points override — previously this only
    // supported changing the point value.
    rewardId: z.number().int().optional(),
  })
  .refine((v) => v.points !== undefined || v.rewardId !== undefined, {
    message: "請至少變更點數或選擇一個獎勵",
  });

// Section 10.8: only applies to the next completion of an in-progress
// extra_quota task — past completions and the template's default stay
// untouched. applyApprovalOutcome() stamps the current quota_used index onto
// the request once approved, so completion picks it up (taskLifecycle.ts).
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/rooms/[id]/tasks/[taskId]/quota-reward-change">
) {
  try {
    const { id, taskId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const task = await db.taskTemplate.findUnique({ where: { id: Number(taskId) } });
    if (!task || task.roomId !== roomId) {
      throw new ApiError(404, "找不到任務");
    }
    if (task.type !== "extra_quota" || task.status !== "active") {
      throw new ApiError(409, "只有進行中的額度任務可以變更獎勵");
    }
    if (task.quotaTotal !== null && task.quotaUsed >= task.quotaTotal) {
      throw new ApiError(409, "此任務額度已用完");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) throw new ApiError(409, "尚未有搭檔");

    if (body.rewardId !== undefined) {
      const reward = await db.reward.findUnique({ where: { id: body.rewardId } });
      if (!reward || reward.roomId !== roomId || reward.type === "produced_content") {
        throw new ApiError(404, "找不到要指定的獎勵");
      }
    }

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });

    const request = await db.taskApprovalRequest.create({
      data: {
        roomId,
        taskTemplateId: task.id,
        requestType: "change_quota_reward",
        requestedById: member.id,
        payload: JSON.stringify({ points: body.points, rewardId: body.rewardId }),
        status: "pending",
        responseDeadline: computeResponseDeadline(room.defaultReviewDays),
      },
    });

    await notify({
      roomId,
      roomMemberId: partner.id,
      type: "approval_pending",
      relatedEntityType: "TaskApprovalRequest",
      relatedEntityId: request.id,
    });

    return NextResponse.json({ approvalRequestId: request.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
