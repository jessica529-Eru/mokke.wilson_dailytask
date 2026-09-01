import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { draftContentSnapshotSchema, materializeDraftTasks } from "@/lib/roomDraft";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

export async function POST(_req: Request, ctx: RouteContext<"/api/rooms/[id]/draft/approve">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const room = await db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { members: true },
    });
    if (room.status !== "draft") {
      throw new ApiError(409, "房間已建立完成");
    }
    if (room.members.length < 2) {
      throw new ApiError(409, "尚未有第二位成員加入，無法完成契約");
    }

    const latest = await db.roomCreationDraft.findFirst({
      where: { roomId },
      orderBy: { version: "desc" },
    });
    if (!latest || latest.status !== "pending_review") {
      throw new ApiError(409, "目前沒有待審核的版本");
    }
    if (latest.proposedById === member.id) {
      throw new ApiError(403, "不能核准自己提出的版本，請等待對方回覆");
    }

    const content = draftContentSnapshotSchema.parse(JSON.parse(latest.contentSnapshot));

    const creator = room.members.find((m) => m.role === "creator");
    const partner = room.members.find((m) => m.role === "member");
    if (!creator || !partner) {
      throw new ApiError(500, "房間成員資料異常");
    }

    await db.$transaction(async (tx) => {
      await tx.roomCreationDraft.update({
        where: { id: latest.id },
        data: { status: "approved" },
      });
      await tx.room.update({
        where: { id: roomId },
        data: { status: "active" },
      });
      await materializeDraftTasks(tx, roomId, creator.id, partner.id, content);
    });

    await notify({
      roomId,
      roomMemberId: latest.proposedById,
      type: "room_draft_approved",
      relatedEntityType: "RoomCreationDraft",
      relatedEntityId: latest.id,
    });
    await logAudit({
      roomId,
      actorRoomMemberId: member.id,
      actionType: "room_draft_approved",
      targetEntityType: "RoomCreationDraft",
      targetEntityId: latest.id,
    });

    return NextResponse.json({ ok: true, roomStatus: "active" });
  } catch (err) {
    return handleApiError(err);
  }
}
