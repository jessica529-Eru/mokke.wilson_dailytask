import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isValidMemberColor } from "@/lib/colors";
import { createSession } from "@/lib/session";
import { ApiError, handleApiError } from "@/lib/api";
import { imageUrlSchema } from "@/lib/zodHelpers";

const joinSchema = z.object({
  inviteCode: z.string().min(1),
  password: z.string().min(1).max(60),
  displayNickname: z.string().min(1).max(30),
  color: z.string().min(1),
  avatarUrl: imageUrlSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = joinSchema.parse(await req.json());

    const room = await db.room.findUnique({
      where: { inviteCode: body.inviteCode.trim().toUpperCase() },
      include: { members: true },
    });
    if (!room) {
      throw new ApiError(404, "邀請碼無效");
    }
    if (room.status !== "draft") {
      throw new ApiError(409, "此房間已完成建立，無法再加入");
    }
    if (room.members.length >= 2) {
      throw new ApiError(409, "此房間已有兩位成員");
    }

    if (!isValidMemberColor(body.color)) {
      throw new ApiError(400, "顏色不在可選色盤內");
    }
    if (room.members.some((m) => m.color === body.color)) {
      throw new ApiError(409, "此顏色已被對方選用，請選擇其他顏色");
    }

    const passwordHash = await hashPassword(body.password);
    const member = await db.roomMember.create({
      data: {
        roomId: room.id,
        password: passwordHash,
        displayNickname: body.displayNickname,
        avatarUrl: body.avatarUrl,
        color: body.color,
        role: "member",
      },
    });

    await createSession({ roomMemberId: member.id, roomId: room.id });

    return NextResponse.json(
      {
        room: { id: room.id, roomName: room.roomName, status: room.status },
        member: {
          id: member.id,
          displayNickname: member.displayNickname,
          color: member.color,
          role: member.role,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
