import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { checkRewardUnlocks, notifyRewardUnlocks, notifyRewardStockExhausted } from "@/lib/rewards";

const bodySchema = z.object({
  rewardId: z.number().int(),
  unlockConditionType: z.enum(["single_task", "multi_task_threshold", "streak_days"]),
  unlockConditionValue: z.record(z.string(), z.unknown()),
});

// Retroactively attaches an unlock condition to a reward that doesn't
// have one yet — mainly for a produced_content stamp: the completion
// form's condition picker is a one-shot, one-time chance, and forgetting
// it there used to mean the partner could never see that photo. This
// lets the producer go back (from the calendar, where they view their
// own stamp) and set it up after the fact instead of losing the chance
// entirely. Also immediately checks whether the partner already
// qualifies (e.g. they already hit the streak this condition asks for)
// so they don't have to do something new just to trip a check that
// wasn't there when they earned it.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/assignment">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const reward = await db.reward.findUnique({ where: { id: body.rewardId } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.createdById !== member.id) {
      throw new ApiError(403, "只有建立者可以設定這個獎勵的解鎖條件");
    }

    await db.rewardAssignment.create({
      data: {
        rewardId: reward.id,
        unlockConditionType: body.unlockConditionType,
        unlockConditionValue: JSON.stringify(body.unlockConditionValue),
      },
    });

    const partner = await getPartner(roomId, member.id);
    if (partner) {
      const { unlockedRewardIds, exhaustedRewardIds } = await db.$transaction((tx) =>
        checkRewardUnlocks(tx, { roomId, roomMemberId: partner.id })
      );
      if (unlockedRewardIds.length > 0) {
        await notifyRewardUnlocks(roomId, partner.id, unlockedRewardIds);
      }
      await notifyRewardStockExhausted(roomId, exhaustedRewardIds);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
