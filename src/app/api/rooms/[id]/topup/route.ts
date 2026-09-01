import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { getCurrentMoneyPool } from "@/lib/money";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

const topUpSchema = z.object({ amount: z.number().positive().max(1_000_000) });

// Section 3: either side can unilaterally top up the pool — no consent
// needed, but both members get notified.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/topup">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = topUpSchema.parse(await req.json());

    const room = await db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { members: true },
    });
    if (room.status !== "active") {
      throw new ApiError(409, "房間尚未成立");
    }

    const topUp = await db.moneyPoolTopUp.create({
      data: { roomId, addedById: member.id, amount: body.amount },
    });
    await logAudit({
      roomId,
      actorRoomMemberId: member.id,
      actionType: "money_topped_up",
      targetEntityType: "MoneyPoolTopUp",
      targetEntityId: topUp.id,
      changeSummary: { amount: body.amount },
    });

    const currentMoneyPool = await getCurrentMoneyPool(roomId, room.initialMoneyPool);

    await Promise.all(
      room.members.map((m) =>
        notify({ roomId, roomMemberId: m.id, type: "money_topped_up" })
      )
    );

    return NextResponse.json({ currentMoneyPool }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
