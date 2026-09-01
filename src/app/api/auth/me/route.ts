import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ member: null });
  }
  const member = await db.roomMember.findUnique({
    where: { id: session.roomMemberId },
    include: { room: true },
  });
  if (!member || member.roomId !== session.roomId) {
    return NextResponse.json({ member: null });
  }
  return NextResponse.json({
    member: {
      id: member.id,
      displayNickname: member.displayNickname,
      color: member.color,
      role: member.role,
      avatarUrl: member.avatarUrl,
    },
    room: {
      id: member.room.id,
      roomName: member.room.roomName,
      status: member.room.status,
      inviteCode: member.room.inviteCode,
    },
  });
}
