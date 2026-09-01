import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { localDateInTimezone, recomputeAnyDailyStreak } from "@/lib/taskLifecycle";

const bodySchema = z.object({
  rewardId: z.number().int(),
  makeupForDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Section 10.10: a rescue voucher patches a missed daily-streak day. It
// must only be usable by whoever personally met its unlock condition (a
// RewardUnlock row scoped to this member) — not a shared pool anyone in
// the room can spend from — then usage is capped by the voucher's stock
// and the makeup date must fall within the last 14 days.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rescue-vouchers/use">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    const reward = await db.reward.findUnique({ where: { id: body.rewardId } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.type !== "rescue_voucher") {
      throw new ApiError(400, "這不是補救券");
    }
    const unlock = await db.rewardUnlock.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: member.id } },
    });
    if (!unlock) {
      throw new ApiError(403, "尚未解鎖這張補救券，只有達成條件的本人才能使用");
    }
    if (reward.stockTotal !== null && (reward.stockRemaining ?? 0) <= 0) {
      throw new ApiError(409, "補救券庫存不足");
    }

    const today = localDateInTimezone(room.settlementTimezone);
    const daysAgo = Math.round(
      (new Date(today + "T00:00:00Z").getTime() - new Date(body.makeupForDate + "T00:00:00Z").getTime()) /
        86_400_000
    );
    if (daysAgo < 0 || daysAgo > 14) {
      throw new ApiError(400, "回補日期需在最近 14 天內");
    }

    await db.$transaction(async (tx) => {
      await tx.rescueVoucherUsage.create({
        data: { roomMemberId: member.id, rewardId: reward.id, makeupForDate: body.makeupForDate },
      });
      if (reward.stockTotal !== null) {
        await tx.reward.update({ where: { id: reward.id }, data: { stockRemaining: { decrement: 1 } } });
      }
      await recomputeAnyDailyStreak(tx, { roomId, roomMemberId: member.id });
    });

    const streak = await db.streakRecord.findUnique({
      where: {
        roomId_roomMemberId_streakType: { roomId, roomMemberId: member.id, streakType: "any_daily_task" },
      },
    });

    return NextResponse.json({ ok: true, streak }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
