import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { ApiError, handleApiError } from "@/lib/api";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  memberId: z.coerce.number().int().optional(),
});

// Section 6: per-room, per-member calendar. Stamps (produced_content
// rewards) are the day's primary visual when present; otherwise ordinary
// task stamp icons stack on the cell. Visibility of a stamp's actual
// content is enforced here (10.9) — never left to the frontend to hide.
export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[id]/calendar">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const viewer = await requireRoomMember(roomId);

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      month: searchParams.get("month"),
      memberId: searchParams.get("memberId") ?? undefined,
    });

    const targetMemberId = query.memberId ?? viewer.id;
    const targetMember = await db.roomMember.findUnique({ where: { id: targetMemberId } });
    if (!targetMember || targetMember.roomId !== roomId) {
      throw new ApiError(404, "找不到這個房間成員");
    }

    const [yearStr, monthStr] = query.month.split("-");
    const monthPrefix = `${yearStr}-${monthStr}`;

    const completions = await db.taskCompletion.findMany({
      where: {
        roomMemberId: targetMemberId,
        taskTemplate: { roomId },
        completedLocalDate: { startsWith: monthPrefix },
      },
      include: { taskTemplate: { include: { stampIconAsset: true } }, reward: true },
      orderBy: { completedAt: "asc" },
    });

    const unlockedRewardIds = new Set(
      (
        await db.rewardUnlock.findMany({
          where: { roomMemberId: viewer.id, reward: { roomId } },
          select: { rewardId: true },
        })
      ).map((u) => u.rewardId)
    );

    const isOwner = viewer.id === targetMemberId;

    const byDate = new Map<
      string,
      {
        date: string;
        stamps: { taskTemplateId: number; title: string; icon: string[] | null; points: number; isSystemGenerated: boolean }[];
        producedStamp: {
          rewardId: number;
          title: string;
          unlocked: boolean;
          contentText: string | null;
          contentImageUrls: string[] | null;
        } | null;
      }
    >();

    for (const c of completions) {
      const day = byDate.get(c.completedLocalDate) ?? {
        date: c.completedLocalDate,
        stamps: [],
        producedStamp: null,
      };

      if (c.reward) {
        const unlocked = isOwner || unlockedRewardIds.has(c.reward.id);
        day.producedStamp = {
          rewardId: c.reward.id,
          title: c.reward.title,
          unlocked,
          contentText: unlocked ? c.reward.contentText : null,
          contentImageUrls: unlocked && c.reward.contentImageUrls ? JSON.parse(c.reward.contentImageUrls) : null,
        };
      } else {
        day.stamps.push({
          taskTemplateId: c.taskTemplateId,
          title: c.taskTemplate.title,
          icon: c.taskTemplate.stampIconAsset ? JSON.parse(c.taskTemplate.stampIconAsset.frameImageUrls) : null,
          points: c.pointsAwarded,
          isSystemGenerated: c.taskTemplate.isSystemGenerated,
        });
      }

      byDate.set(c.completedLocalDate, day);
    }

    return NextResponse.json({
      memberId: targetMemberId,
      isOwner,
      days: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
