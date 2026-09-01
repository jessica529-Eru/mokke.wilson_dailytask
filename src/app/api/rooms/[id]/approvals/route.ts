import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { resolveOverdueApprovals } from "@/lib/taskLifecycle";

// Section 10.14: every pending approval request across types is surfaced
// here in one place rather than scattered on individual task detail pages.
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/approvals">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    await resolveOverdueApprovals(roomId);

    const requests = await db.taskApprovalRequest.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      include: { requestedBy: true, taskTemplate: true },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        requestedById: r.requestedById,
        requestedByNickname: r.requestedBy.displayNickname,
        taskTemplateId: r.taskTemplateId,
        taskTitle: r.taskTemplate?.title ?? null,
        payload: JSON.parse(r.payload),
        status: r.status,
        responseDeadline: r.responseDeadline,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
