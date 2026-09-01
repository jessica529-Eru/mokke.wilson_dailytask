import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { ApiError, handleApiError } from "@/lib/api";

const loginSchema = z.object({
  roomName: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());

    const room = await db.room.findUnique({
      where: { roomName: body.roomName },
      include: { members: true },
    });
    if (!room) {
      throw new ApiError(401, "房間名稱或密碼錯誤");
    }

    let matched = null;
    for (const member of room.members) {
      if (await verifyPassword(body.password, member.password)) {
        matched = member;
        break;
      }
    }
    if (!matched) {
      throw new ApiError(401, "房間名稱或密碼錯誤");
    }

    await createSession({ roomMemberId: matched.id, roomId: room.id });

    return NextResponse.json({
      room: { id: room.id, roomName: room.roomName, status: room.status },
      member: {
        id: matched.id,
        displayNickname: matched.displayNickname,
        color: matched.color,
        role: matched.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
