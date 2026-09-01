import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import { getPartner } from "@/lib/currentMember";

const bodySchema = z.object({ settlementDate: z.string().datetime() });

// Scheduling the next settlement date is collaborative bookkeeping like a
// top-up, not a scoring-affecting change, so (for this MVP) either member
// can set it directly rather than going through room_settings_change.
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

    const settlementDate = new Date(body.settlementDate);
    if (settlementDate <= new Date()) {
      throw new ApiError(400, "結算日期需在未來");
    }

    await db.room.update({ where: { id: roomId }, data: { settlementDate } });

    const partner = await getPartner(roomId, member.id);
    if (partner) {
      await notify({ roomId, roomMemberId: partner.id, type: "settlement_upcoming" });
    }

    return NextResponse.json({ ok: true, settlementDate });
  } catch (err) {
    return handleApiError(err);
  }
}
