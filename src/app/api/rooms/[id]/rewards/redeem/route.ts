import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ rewardId: z.number().int() });

// Marks a reward as physically/privately claimed — separate from
// "unlocked" (RewardUnlock.unlockedAt, which only means earned/visible).
// Scoped to fixed_item/other: rescue_voucher already has its own use flow
// (rescue-vouchers/use), and produced_content isn't a library item at all.
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
      throw new ApiError(409, "這個獎勵已經標記為兌換過了");
    }

    const updated = await db.rewardUnlock.update({
      where: { id: unlock.id },
      data: { redeemedAt: new Date() },
    });

    // Redemption is inherently between the two of you — let the partner
    // know it happened instead of them having to notice on their own.
    const partner = await getPartner(roomId, member.id);
    if (partner) {
      await notify({
        roomId,
        roomMemberId: partner.id,
        type: "reward_redeemed",
        relatedEntityType: "Reward",
        relatedEntityId: reward.id,
      });
    }

    return NextResponse.json({ redeemedAt: updated.redeemedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
