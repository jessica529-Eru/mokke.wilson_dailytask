import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ rewardId: z.number().int() });

// Step 1 of a two-step handoff for fixed_item/other rewards: the person
// who unlocked it says "我要兌換" here, which just notifies the reward's
// creator — the person who actually has to hand it over. They're the one
// who confirms completion (see redeem/confirm), not the redeemer
// themselves; self-marking "done" for something someone else has to give
// you doesn't actually confirm anything happened.
// rescue_voucher has its own use flow (rescue-vouchers/use); produced_content
// isn't a library item at all.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/redeem">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const reward = await db.reward.findUnique({ where: { id: body.rewardId } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.type !== "fixed_item" && reward.type !== "other") {
      throw new ApiError(400, "這個獎勵類型不需要標記兌換");
    }

    const unlock = await db.rewardUnlock.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: member.id } },
    });
    if (!unlock) {
      throw new ApiError(403, "尚未解鎖這個獎勵");
    }
    if (unlock.redeemedAt) {
      throw new ApiError(409, "這個獎勵已經兌換過了");
    }
    if (unlock.redemptionRequestedAt) {
      throw new ApiError(409, "已經提出兌換請求，等待對方確認");
    }

    const updated = await db.rewardUnlock.update({
      where: { id: unlock.id },
      data: { redemptionRequestedAt: new Date() },
    });

    await notify({
      roomId,
      roomMemberId: reward.createdById,
      type: "reward_redeem_requested",
      relatedEntityType: "Reward",
      relatedEntityId: reward.id,
    });

    return NextResponse.json({ redemptionRequestedAt: updated.redemptionRequestedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
