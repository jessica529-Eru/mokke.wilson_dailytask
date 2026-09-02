import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";
import { imageUrlSchema } from "@/lib/zodHelpers";

const patchSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  contentText: z.string().max(2000).optional(),
  contentImageUrls: z.array(imageUrlSchema).max(9).optional(),
  // Explicit null clears the stock cap (unlimited); omitted = no change.
  stockTotal: z.number().int().min(1).nullable().optional(),
  archived: z.boolean().optional(),
});

// Unlike a task edit, a reward is one person's own offering rather than a
// shared scoring rule — creating one never needed the partner's approval,
// so editing/archiving it doesn't either (section 8/10.9's approval
// requirement is specific to TaskTemplate).
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards/[rewardId]">) {
  try {
    const { id, rewardId } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = patchSchema.parse(await req.json());

    const reward = await db.reward.findUnique({ where: { id: Number(rewardId) } });
    if (!reward || reward.roomId !== roomId) {
      throw new ApiError(404, "找不到此獎勵");
    }
    if (reward.createdById !== member.id) {
      throw new ApiError(403, "只有建立者可以編輯這個獎勵");
    }

    let stockTotal: number | null | undefined = undefined;
    let stockRemaining: number | null | undefined = undefined;
    if ("stockTotal" in body) {
      const nextTotal = body.stockTotal ?? null;
      if (nextTotal === null) {
        stockTotal = null;
        stockRemaining = null;
      } else if (reward.stockTotal === null) {
        // Was unlimited — there's no prior consumption to carry over, so
        // the new cap starts fully available.
        stockTotal = nextTotal;
        stockRemaining = nextTotal;
      } else {
        const delta = nextTotal - reward.stockTotal;
        stockTotal = nextTotal;
        stockRemaining = Math.max(0, (reward.stockRemaining ?? 0) + delta);
      }
    }

    const updated = await db.reward.update({
      where: { id: reward.id },
      data: {
        title: body.title,
        contentText: body.contentText,
        contentImageUrls: body.contentImageUrls ? JSON.stringify(body.contentImageUrls) : undefined,
        stockTotal,
        stockRemaining,
        archived: body.archived,
      },
    });

    return NextResponse.json({ reward: { id: updated.id } });
  } catch (err) {
    return handleApiError(err);
  }
}
