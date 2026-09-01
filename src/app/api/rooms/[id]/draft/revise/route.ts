import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { draftContentSnapshotSchema, itemCommentSchema } from "@/lib/roomDraft";
import { notify } from "@/lib/notify";

const reviseSchema = z.object({
  content: draftContentSnapshotSchema,
  itemComments: z.array(itemCommentSchema).min(1),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/draft/revise">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = reviseSchema.parse(await req.json());

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status !== "draft") {
      throw new ApiError(409, "房間已建立完成，無法再提出修改");
    }

    const latest = await db.roomCreationDraft.findFirst({
      where: { roomId },
      orderBy: { version: "desc" },
    });
    if (!latest || latest.status !== "pending_review") {
      throw new ApiError(409, "目前沒有待審核的版本");
    }
    if (latest.proposedById === member.id) {
      throw new ApiError(403, "不能修改自己剛提出的版本，請等待對方回覆");
    }

    if (body.content.roomName !== room.roomName) {
      const conflict = await db.room.findUnique({
        where: { roomName: body.content.roomName },
      });
      if (conflict && conflict.id !== room.id) {
        throw new ApiError(409, "房間名稱已被使用，請更換名稱");
      }
    }

    if (new Date(body.content.settlementDate) <= new Date()) {
      throw new ApiError(400, "結算日期需在未來");
    }

    const newDraft = await db.$transaction(async (tx) => {
      await tx.roomCreationDraft.update({
        where: { id: latest.id },
        data: { status: "revision_requested" },
      });
      await tx.room.update({
        where: { id: roomId },
        data: {
          roomName: body.content.roomName,
          initialMoneyPool: body.content.initialMoneyPool,
          settlementDate: new Date(body.content.settlementDate),
        },
      });
      return tx.roomCreationDraft.create({
        data: {
          roomId,
          version: latest.version + 1,
          proposedById: member.id,
          contentSnapshot: JSON.stringify(body.content),
          itemComments: JSON.stringify(body.itemComments),
          status: "pending_review",
        },
      });
    });

    await notify({
      roomId,
      roomMemberId: latest.proposedById,
      type: "room_draft_revision_requested",
      relatedEntityType: "RoomCreationDraft",
      relatedEntityId: newDraft.id,
    });

    return NextResponse.json({ ok: true, version: newDraft.version });
  } catch (err) {
    return handleApiError(err);
  }
}
