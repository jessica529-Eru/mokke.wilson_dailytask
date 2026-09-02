import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { imageUrlSchema } from "@/lib/zodHelpers";

const assignmentSchema = z.object({
  taskTemplateId: z.number().int().optional(),
  unlockConditionType: z.enum(["single_task", "multi_task_threshold", "streak_days"]),
  unlockConditionValue: z.record(z.string(), z.unknown()),
});

const createRewardSchema = z.object({
  type: z.enum(["fixed_item", "rescue_voucher", "other"]),
  title: z.string().min(1).max(60),
  contentText: z.string().max(2000).optional(),
  contentImageUrls: z.array(imageUrlSchema).max(9).optional(),
  stockTotal: z.number().int().min(1).optional(),
  assignment: assignmentSchema.optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/rewards">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);

    // The auto-generated calendar "stamp" rewards (produced_content) live
    // in the calendar view (section 6) — this is the shop/library of
    // rewards someone deliberately stocked (section 8/10.9).
    const rewards = await db.reward.findMany({
      where: { roomId, type: { not: "produced_content" } },
      orderBy: { createdAt: "desc" },
      // Every unlock is fetched (not just the viewer's own) so a
      // creator can see when someone else has a pending redemption
      // request against a reward they created.
      include: { unlocks: { include: { roomMember: true } }, createdBy: true },
    });

    return NextResponse.json({
      rewards: rewards.map((r) => {
        const myUnlock = r.unlocks.find((u) => u.roomMemberId === member.id);
        const pendingRequest =
          r.createdById === member.id
            ? r.unlocks.find((u) => u.roomMemberId !== member.id && u.redemptionRequestedAt && !u.redeemedAt)
            : undefined;
        return {
          id: r.id,
          type: r.type,
          title: r.title,
          stockTotal: r.stockTotal,
          stockRemaining: r.stockRemaining,
          createdById: r.createdById,
          createdByNickname: r.createdBy.displayNickname,
          unlocked: !!myUnlock,
          redemptionRequestedAt: myUnlock?.redemptionRequestedAt ?? null,
          redeemedAt: myUnlock?.redeemedAt ?? null,
          pendingRedemptionFrom: pendingRequest
            ? { roomMemberId: pendingRequest.roomMemberId, nickname: pendingRequest.roomMember.displayNickname }
            : null,
          contentText: myUnlock ? r.contentText : null,
          contentImageUrls: myUnlock && r.contentImageUrls ? JSON.parse(r.contentImageUrls) : null,
          createdAt: r.createdAt,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/rewards">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = createRewardSchema.parse(await req.json());

    const reward = await db.$transaction(async (tx) => {
      const reward = await tx.reward.create({
        data: {
          roomId,
          type: body.type,
          title: body.title,
          contentText: body.contentText,
          contentImageUrls: body.contentImageUrls ? JSON.stringify(body.contentImageUrls) : undefined,
          stockTotal: body.stockTotal,
          stockRemaining: body.stockTotal,
          createdById: member.id,
        },
      });

      if (body.assignment) {
        await tx.rewardAssignment.create({
          data: {
            rewardId: reward.id,
            taskTemplateId: body.assignment.taskTemplateId,
            unlockConditionType: body.assignment.unlockConditionType,
            unlockConditionValue: JSON.stringify(body.assignment.unlockConditionValue),
          },
        });
      }

      return reward;
    });

    return NextResponse.json({ reward: { id: reward.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
