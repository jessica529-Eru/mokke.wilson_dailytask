import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { canViewRewardContent } from "@/lib/rewards";
import { notify } from "@/lib/notify";

// Toggle: at most one heart per member per reward (backed by
// RewardReaction's unique index). Only notifies on heart-on, not
// heart-off, so idly toggling doesn't spam the creator.
export async function POST(_req: Request, ctx: RouteContext<"/api/rooms/[id]/rewards/[rewardId]/heart">) {
  try {
    const { id, rewardId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const reward = await db.reward.findUnique({ where: { id: Number(rewardId) } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.type !== "produced_content") {
      throw new ApiError(400, "只有照片印章可以按愛心");
    }
    if (!(await canViewRewardContent(reward.id, member.id))) {
      throw new ApiError(403, "尚未解鎖，無法按愛心");
    }

    const existing = await db.rewardReaction.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: member.id } },
    });

    let hearted: boolean;
    if (existing) {
      await db.rewardReaction.delete({ where: { id: existing.id } });
      hearted = false;
    } else {
      await db.rewardReaction.create({ data: { rewardId: reward.id, roomMemberId: member.id } });
      hearted = true;
      if (reward.createdById !== member.id) {
        await notify({
          roomId,
          roomMemberId: reward.createdById,
          type: "reward_stamp_reacted",
          relatedEntityType: "Reward",
          relatedEntityId: reward.id,
        });
      }
    }

    const heartCount = await db.rewardReaction.count({ where: { rewardId: reward.id } });
    return NextResponse.json({ hearted, heartCount });
  } catch (err) {
    return handleApiError(err);
  }
}
