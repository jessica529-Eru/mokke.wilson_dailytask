import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember, getPartner } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";

const bodySchema = z.object({ rewardId: z.number().int() });

// A produced_content "stamp" reward (see taskLifecycle.ts's
// createProducedStamp) is only visible to its producer by default — the
// calendar route gates content on a per-viewer RewardUnlock row, and only
// the producer gets one automatically. This lets the producer deliberately
// grant their partner an unlock too, i.e. "set this as something my
// partner can see," which nothing in the app could do before.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/share">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = bodySchema.parse(await req.json());

    const reward = await db.reward.findUnique({ where: { id: body.rewardId } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.type !== "produced_content") {
      throw new ApiError(400, "只有拍照/文字證明產生的郵票可以分享");
    }
    if (reward.createdById !== member.id) {
      throw new ApiError(403, "只有本人可以分享自己的成果");
    }

    const partner = await getPartner(roomId, member.id);
    if (!partner) {
      throw new ApiError(409, "房間裡還沒有另一位成員");
    }

    const existing = await db.rewardUnlock.findUnique({
      where: { rewardId_roomMemberId: { rewardId: reward.id, roomMemberId: partner.id } },
    });
    if (!existing) {
      await db.rewardUnlock.create({
        data: { rewardId: reward.id, roomMemberId: partner.id },
      });
      await notify({
        roomId,
        roomMemberId: partner.id,
        type: "reward_unlocked",
        relatedEntityType: "Calendar",
        relatedEntityId: reward.id,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
