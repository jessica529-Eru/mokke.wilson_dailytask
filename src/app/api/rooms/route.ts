import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { isValidMemberColor } from "@/lib/colors";
import { createSession } from "@/lib/session";
import { ApiError, handleApiError } from "@/lib/api";
import { draftContentSnapshotSchema } from "@/lib/roomDraft";
import { imageUrlSchema } from "@/lib/zodHelpers";

const createRoomSchema = z.object({
  password: z.string().min(1).max(60),
  displayNickname: z.string().min(1).max(30),
  color: z.string().min(1),
  avatarUrl: imageUrlSchema.optional(),
  content: draftContentSnapshotSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = createRoomSchema.parse(await req.json());

    if (!isValidMemberColor(body.color)) {
      throw new ApiError(400, "顏色不在可選色盤內");
    }

    const existingRoomName = await db.room.findUnique({
      where: { roomName: body.content.roomName },
    });
    if (existingRoomName) {
      throw new ApiError(409, "房間名稱已被使用，請更換名稱");
    }

    if (new Date(body.content.settlementDate) <= new Date()) {
      throw new ApiError(400, "結算日期需在未來");
    }

    const passwordHash = await hashPassword(body.password);

    const result = await db.$transaction(async (tx) => {
      let inviteCode = generateInviteCode();
      // Practically unique on first try, but guard against the rare collision.
      while (await tx.room.findUnique({ where: { inviteCode } })) {
        inviteCode = generateInviteCode();
      }

      const room = await tx.room.create({
        data: {
          inviteCode,
          roomName: body.content.roomName,
          status: "draft",
          initialMoneyPool: body.content.initialMoneyPool,
          settlementDate: new Date(body.content.settlementDate),
        },
      });

      const creator = await tx.roomMember.create({
        data: {
          roomId: room.id,
          password: passwordHash,
          displayNickname: body.displayNickname,
          avatarUrl: body.avatarUrl,
          color: body.color,
          role: "creator",
        },
      });

      const draft = await tx.roomCreationDraft.create({
        data: {
          roomId: room.id,
          version: 1,
          proposedById: creator.id,
          contentSnapshot: JSON.stringify(body.content),
          status: "pending_review",
        },
      });

      return { room, creator, draft };
    });

    await createSession({ roomMemberId: result.creator.id, roomId: result.room.id });

    return NextResponse.json(
      {
        room: {
          id: result.room.id,
          roomName: result.room.roomName,
          inviteCode: result.room.inviteCode,
          status: result.room.status,
        },
        member: {
          id: result.creator.id,
          displayNickname: result.creator.displayNickname,
          color: result.creator.color,
          role: result.creator.role,
        },
        draft: {
          id: result.draft.id,
          version: result.draft.version,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
