import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { getCurrentMoneyPool, getCurrentPeriodStart } from "@/lib/money";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

const topUpSchema = z.object({ amount: z.number().positive().max(1_000_000) });
const deleteTopUpSchema = z.object({ topUpId: z.number().int() });

// Lets a top-up be undone — e.g. a mistyped amount — but only by whoever
// added it, and only while it's still part of the current (unsettled)
// period. Once a settlement has closed it out, it's baked into that
// SettlementRecord's finalMoneyPool and can't be quietly rewritten.
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/topup">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const periodStart = await getCurrentPeriodStart(roomId);
    const topUps = await db.moneyPoolTopUp.findMany({
      where: { roomId, createdAt: { gte: periodStart } },
      include: { addedBy: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      topUps: topUps.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        addedById: t.addedById,
        addedByNickname: t.addedBy.displayNickname,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

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

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/topup">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = deleteTopUpSchema.parse(await req.json());

    const topUp = await db.moneyPoolTopUp.findUnique({ where: { id: body.topUpId } });
    if (!topUp || topUp.roomId !== roomId) {
      throw new ApiError(404, "找不到這筆加碼紀錄");
    }
    if (topUp.addedById !== member.id) {
      throw new ApiError(403, "只能刪除自己新增的加碼紀錄");
    }

    const periodStart = await getCurrentPeriodStart(roomId);
    if (topUp.createdAt < periodStart) {
      throw new ApiError(409, "這筆加碼已經結算過，無法刪除");
    }

    await db.moneyPoolTopUp.delete({ where: { id: topUp.id } });
    await logAudit({
      roomId,
      actorRoomMemberId: member.id,
      actionType: "money_topped_up",
      targetEntityType: "MoneyPoolTopUp",
      targetEntityId: topUp.id,
      changeSummary: { deleted: true, amount: Number(topUp.amount) },
    });

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId }, include: { members: true } });
    const currentMoneyPool = await getCurrentMoneyPool(roomId, room.initialMoneyPool);

    await Promise.all(
      room.members
        .filter((m) => m.id !== member.id)
        .map((m) => notify({ roomId, roomMemberId: m.id, type: "money_topped_up" }))
    );

    return NextResponse.json({ currentMoneyPool });
  } catch (err) {
    return handleApiError(err);
  }
}
