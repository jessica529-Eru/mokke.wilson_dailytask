import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ rewardId: z.number().int() });

// Step 2: only the reward's creator (who has to actually hand the item
// over) can confirm a pending redemption request — see redeem/route.ts
// for step 1. This is what actually sets redeemedAt.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/redeem/confirm">) {
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
      throw new ApiError(403, "只有建立這個獎勵的人可以確認兌換");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) {
      throw new ApiError(409, "房間裡還沒有另一位成員");
    }

    const unlock = await db.rewardUnlock.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: partner.id } },
    });
    if (!unlock || !unlock.redemptionRequestedAt) {
      throw new ApiError(409, "對方還沒有提出兌換請求");
    }
    if (unlock.redeemedAt) {
      throw new ApiError(409, "這個獎勵已經確認兌換過了");
    }

    const updated = await db.rewardUnlock.update({
      where: { id: unlock.id },
      data: { redeemedAt: new Date() },
    });

    await notify({
      roomId,
      roomMemberId: partner.id,
      type: "reward_redeemed",
      relatedEntityType: "Reward",
      relatedEntityId: reward.id,
    });

    return NextResponse.json({ redeemedAt: updated.redeemedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
