import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { editTaskSchema } from "@/lib/taskInput";
import { computeResponseDeadline } from "@/lib/taskLifecycle";
import { notify } from "@/lib/notify";

async function loadTask(roomId: number, taskId: number) {
  const task = await db.taskTemplate.findUnique({ where: { id: taskId } });
  if (!task || task.roomId !== roomId) {
    throw new ApiError(404, "找不到任務");
  }
  return task;
}

// Editing an already-active task changes the shared scoring contract, so it
// always goes through TaskApprovalRequest (section 10.6) — the old content
// stays in effect until the partner approves, regardless of assign_scope.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/tasks/[taskId]">) {
  try {
    const { id, taskId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = editTaskSchema.parse(await req.json());

    const task = await loadTask(roomId, Number(taskId));
    if (task.status !== "active") {
      throw new ApiError(409, "只有進行中的任務可以提出修改");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) throw new ApiError(409, "尚未有搭檔");

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });

    const request = await db.taskApprovalRequest.create({
      data: {
        roomId,
        taskTemplateId: task.id,
        requestType: "edit_task",
        requestedById: member.id,
        payload: JSON.stringify(body),
        status: "pending",
        responseDeadline: computeResponseDeadline(room.defaultReviewDays, body.approvalDeadline),
      },
    });

    await notify({
      roomId,
      roomMemberId: partner.id,
      type: "approval_pending",
      relatedEntityType: "TaskApprovalRequest",
      relatedEntityId: request.id,
    });

    return NextResponse.json({ approvalRequestId: request.id });
  } catch (err) {
    return handleApiError(err);
  }
}

// Deleting flips the task to deleted_pending_approval immediately (visible
// state) and only becomes archived once the partner approves (section 10.6).
// Past TaskCompletions and their points are never touched.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/rooms/[id]/tasks/[taskId]">) {
  try {
    const { id, taskId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const task = await loadTask(roomId, Number(taskId));
    if (task.status !== "active") {
      throw new ApiError(409, "只有進行中的任務可以提出刪除");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) throw new ApiError(409, "尚未有搭檔");

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });

    const request = await db.$transaction(async (tx) => {
      await tx.taskTemplate.update({
        where: { id: task.id },
        data: { status: "deleted_pending_approval" },
      });
      return tx.taskApprovalRequest.create({
        data: {
          roomId,
          taskTemplateId: task.id,
          requestType: "delete_task",
          requestedById: member.id,
          payload: JSON.stringify({}),
          status: "pending",
          responseDeadline: computeResponseDeadline(room.defaultReviewDays),
        },
      });
    });

    await notify({
      roomId,
      roomMemberId: partner.id,
      type: "approval_pending",
      relatedEntityType: "TaskApprovalRequest",
      relatedEntityId: request.id,
    });

    return NextResponse.json({ approvalRequestId: request.id });
  } catch (err) {
    return handleApiError(err);
  }
}
