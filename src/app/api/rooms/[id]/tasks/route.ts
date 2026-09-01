import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { createTaskSchema } from "@/lib/taskInput";
import { computeResponseDeadline } from "@/lib/taskLifecycle";
import { notify } from "@/lib/notify";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/tasks">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    // Section 10.6: every task, including pending_approval ones, is fully
    // visible to both members — no hidden fields.
    const tasks = await db.taskTemplate.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      include: { stampIconAsset: true },
    });

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        type: t.type,
        assignScope: t.assignScope,
        title: t.title,
        description: t.description,
        createdById: t.createdById,
        assignedToId: t.assignedToId,
        points: t.points,
        requiresProof: t.requiresProof,
        status: t.status,
        quotaTotal: t.quotaTotal,
        quotaUsed: t.quotaUsed,
        triggerProbability: t.triggerProbability ? Number(t.triggerProbability) : null,
        triggerTargetType: t.triggerTargetType,
        triggerTargetTaskId: t.triggerTargetTaskId,
        isSystemGenerated: t.isSystemGenerated,
        stampIcon: t.stampIconAsset
          ? { id: t.stampIconAsset.id, name: t.stampIconAsset.name, frames: JSON.parse(t.stampIconAsset.frameImageUrls) }
          : null,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/tasks">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = createTaskSchema.parse(await req.json());

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status !== "active") {
      throw new ApiError(409, "房間尚未成立，無法新增任務");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) {
      throw new ApiError(409, "尚未有搭檔，無法新增任務");
    }

    const assignedToId = body.assignScope === "self" ? member.id : body.assignScope === "partner" ? partner.id : null;
    const needsApproval = body.assignScope !== "self";

    const result = await db.$transaction(async (tx) => {
      const task = await tx.taskTemplate.create({
        data: {
          roomId,
          type: body.type,
          assignScope: body.assignScope,
          title: body.title,
          description: body.description,
          createdById: member.id,
          assignedToId,
          points: body.points,
          requiresProof: body.requiresProof,
          quotaTotal: body.quotaTotal,
          stampIconAssetId: body.stampIconAssetId,
          approvalDeadline: body.approvalDeadline ? new Date(body.approvalDeadline) : undefined,
          triggerProbability: body.triggerProbability,
          triggerTargetType: body.triggerTargetType,
          triggerTargetTaskId: body.triggerTargetTaskId,
          status: needsApproval ? "pending_approval" : "active",
        },
      });

      if (needsApproval) {
        await tx.taskApprovalRequest.create({
          data: {
            roomId,
            taskTemplateId: task.id,
            requestType: "create_task",
            requestedById: member.id,
            payload: JSON.stringify(body),
            status: "pending",
            responseDeadline: computeResponseDeadline(room.defaultReviewDays, body.approvalDeadline),
          },
        });
      }

      return task;
    });

    if (needsApproval) {
      await notify({
        roomId,
        roomMemberId: partner.id,
        type: "approval_pending",
        relatedEntityType: "TaskTemplate",
        relatedEntityId: result.id,
      });
    }

    return NextResponse.json({ task: { id: result.id, status: result.status } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
