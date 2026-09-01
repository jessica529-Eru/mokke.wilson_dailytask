import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { applyApprovalOutcome } from "@/lib/taskLifecycle";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

const respondSchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/rooms/[id]/approvals/[requestId]/respond">
) {
  try {
    const { id, requestId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = respondSchema.parse(await req.json());

    const request = await db.taskApprovalRequest.findUnique({ where: { id: Number(requestId) } });
    if (!request || request.roomId !== roomId) {
      throw new ApiError(404, "找不到此審核請求");
    }
    if (request.status !== "pending") {
      throw new ApiError(409, "此請求已被處理");
    }
    if (request.requestedById === member.id) {
      throw new ApiError(403, "不能審核自己提出的請求");
    }

    const approve = body.action === "approve";

    await db.$transaction(async (tx) => {
      await tx.taskApprovalRequest.update({
        where: { id: request.id },
        data: { status: approve ? "approved" : "rejected", resolvedAt: new Date() },
      });
      await applyApprovalOutcome(tx, request, approve);
    });

    await notify({
      roomId,
      roomMemberId: request.requestedById,
      type: approve ? "task_approved" : "task_rejected",
      relatedEntityType: "TaskApprovalRequest",
      relatedEntityId: request.id,
    });
    await logAudit({
      roomId,
      actorRoomMemberId: member.id,
      actionType: approve ? "approval_approved" : "approval_rejected",
      targetEntityType: "TaskApprovalRequest",
      targetEntityId: request.id,
      changeSummary: { requestType: request.requestType },
    });

    return NextResponse.json({ ok: true, status: approve ? "approved" : "rejected" });
  } catch (err) {
    return handleApiError(err);
  }
}
