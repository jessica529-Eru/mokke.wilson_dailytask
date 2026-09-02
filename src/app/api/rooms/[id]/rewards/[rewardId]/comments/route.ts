import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { canViewRewardContent } from "@/lib/rewards";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ text: z.string().min(1).max(500) });

// Comments + the heart toggle (heart/route.ts) are only meaningful for a
// produced_content photo stamp, and only once the caller can actually see
// it — same rule as the content itself (canViewRewardContent).
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/rewards/[rewardId]/comments">) {
  try {
    const { id, rewardId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    const reward = await db.reward.findUnique({ where: { id: Number(rewardId) } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (!(await canViewRewardContent(reward.id, member.id))) {
      throw new ApiError(403, "尚未解鎖，無法查看留言");
    }

    const [comments, reactions] = await Promise.all([
      db.rewardComment.findMany({
        where: { rewardId: reward.id },
        include: { roomMember: true },
        orderBy: { createdAt: "asc" },
      }),
      db.rewardReaction.findMany({ where: { rewardId: reward.id } }),
    ]);

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        text: c.text,
        roomMemberId: c.roomMemberId,
        nickname: c.roomMember.displayNickname,
        createdAt: c.createdAt,
      })),
      heartCount: reactions.length,
      myHearted: reactions.some((r) => r.roomMemberId === member.id),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/[rewardId]/comments">) {
  try {
    const { id, rewardId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const reward = await db.reward.findUnique({ where: { id: Number(rewardId) } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.type !== "produced_content") {
      throw new ApiError(400, "只有照片印章可以留言");
    }
    if (!(await canViewRewardContent(reward.id, member.id))) {
      throw new ApiError(403, "尚未解鎖，無法留言");
    }

    const comment = await db.rewardComment.create({
      data: { rewardId: reward.id, roomMemberId: member.id, text: body.text },
    });

    if (reward.createdById !== member.id) {
      await notify({
        roomId,
        roomMemberId: reward.createdById,
        type: "reward_stamp_reacted",
        relatedEntityType: "Reward",
        relatedEntityId: reward.id,
      });
    }

    return NextResponse.json({ comment: { id: comment.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
