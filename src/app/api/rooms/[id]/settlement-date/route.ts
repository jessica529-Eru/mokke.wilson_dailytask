import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { computeResponseDeadline } from "@/lib/taskLifecycle";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ settlementDate: z.string().datetime() });

// The settlement date is first set as part of the room-creation scroll
// contract (draftContentSnapshotSchema). Any change after the room is
// active needs the partner's consent too, so this creates a
// room_settings_change TaskApprovalRequest rather than writing directly.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/settlement-date">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status !== "active") {
      throw new ApiError(409, "房間尚未成立");
    }

    if (new Date(body.settlementDate) <= new Date()) {
      throw new ApiError(400, "結算日期需在未來");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) throw new ApiError(409, "尚未有搭檔");

    const request = await db.taskApprovalRequest.create({
      data: {
        roomId,
        requestType: "room_settings_change",
        requestedById: member.id,
        payload: JSON.stringify({ settlementDate: body.settlementDate }),
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
