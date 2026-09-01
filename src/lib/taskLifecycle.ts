import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function localDateInTimezone(timezone: string, date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is what completed_local_date expects.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

/** Advances a streak counter, resetting it when a day was skipped. */
export async function bumpStreak(
  tx: Prisma.TransactionClient,
  params: { roomId: number; roomMemberId: number; streakType: string; localDate: string }
) {
  const existing = await tx.streakRecord.findUnique({
    where: {
      roomId_roomMemberId_streakType: {
        roomId: params.roomId,
        roomMemberId: params.roomMemberId,
        streakType: params.streakType,
      },
    },
  });

  if (!existing) {
    return tx.streakRecord.create({
      data: {
        roomId: params.roomId,
        roomMemberId: params.roomMemberId,
        streakType: params.streakType,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveLocalDate: params.localDate,
      },
    });
  }

  if (existing.lastActiveLocalDate === params.localDate) {
    return existing; // already counted today
  }

  const prevDate = existing.lastActiveLocalDate
    ? new Date(existing.lastActiveLocalDate + "T00:00:00Z")
    : null;
  const thisDate = new Date(params.localDate + "T00:00:00Z");
  const isConsecutive =
    prevDate !== null &&
    Math.round((thisDate.getTime() - prevDate.getTime()) / 86_400_000) === 1;

  const nextCurrent = isConsecutive ? existing.currentStreak + 1 : 1;

  return tx.streakRecord.update({
    where: { id: existing.id },
    data: {
      currentStreak: nextCurrent,
      longestStreak: Math.max(existing.longestStreak, nextCurrent),
      lastActiveLocalDate: params.localDate,
    },
  });
}

/**
 * Rebuilds the "any_daily_task" streak from scratch off the full history of
 * daily-task completion dates plus rescue-voucher makeup dates (section
 * 10.10). Used after a rescue voucher is redeemed, since a makeup date can
 * land in the middle of existing history and change both the current and
 * longest streak, which the incremental bumpStreak() can't handle.
 */
export async function recomputeAnyDailyStreak(
  tx: Prisma.TransactionClient,
  params: { roomId: number; roomMemberId: number }
) {
  const [completions, usages] = await Promise.all([
    tx.taskCompletion.findMany({
      where: {
        roomMemberId: params.roomMemberId,
        taskTemplate: { roomId: params.roomId, type: "daily", streakCountsTowardDaily: true },
      },
      select: { completedLocalDate: true },
    }),
    tx.rescueVoucherUsage.findMany({
      where: { roomMemberId: params.roomMemberId, reward: { roomId: params.roomId } },
      select: { makeupForDate: true },
    }),
  ]);

  const dates = Array.from(
    new Set([...completions.map((c) => c.completedLocalDate), ...usages.map((u) => u.makeupForDate)])
  ).sort();

  if (dates.length === 0) return;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z");
    const cur = new Date(dates[i] + "T00:00:00Z");
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }

  await tx.streakRecord.upsert({
    where: {
      roomId_roomMemberId_streakType: {
        roomId: params.roomId,
        roomMemberId: params.roomMemberId,
        streakType: "any_daily_task",
      },
    },
    update: { currentStreak: current, longestStreak: longest, lastActiveLocalDate: dates[dates.length - 1] },
    create: {
      roomId: params.roomId,
      roomMemberId: params.roomMemberId,
      streakType: "any_daily_task",
      currentStreak: current,
      longestStreak: longest,
      lastActiveLocalDate: dates[dates.length - 1],
    },
  });
}

/**
 * Section 6.1: when a proof-requiring task is completed with photo/text
 * content, it auto-produces a "stamp" Reward. The producer can always see
 * their own stamp on their calendar; visibility for the partner is gated by
 * RewardUnlock elsewhere (section 10.9).
 */
export async function createProducedStamp(
  tx: Prisma.TransactionClient,
  params: {
    roomId: number;
    roomMemberId: number;
    taskTitle: string;
    proofText?: string;
    proofImageUrls?: string[];
  }
) {
  const reward = await tx.reward.create({
    data: {
      roomId: params.roomId,
      type: "produced_content",
      title: `${params.taskTitle} 的郵票`,
      contentText: params.proofText,
      contentImageUrls: params.proofImageUrls ? JSON.stringify(params.proofImageUrls) : undefined,
      createdById: params.roomMemberId,
    },
  });
  await tx.rewardUnlock.create({
    data: { rewardId: reward.id, roomMemberId: params.roomMemberId },
  });
  return reward;
}

/**
 * Section 7 / 10.5: at the moment a task is completed, roll the dice for a
 * surprise task targeting the completer's partner. The generated template is
 * system-owned (createdBy null) and skips TaskApprovalRequest entirely.
 */
export async function maybeTriggerSurpriseTask(
  tx: Prisma.TransactionClient,
  params: { roomId: number; sourceTask: {
    id: number;
    triggerProbability: Prisma.Decimal | null;
    triggerTargetType: "specific_task" | "random_from_existing" | null;
    triggerTargetTaskId: number | null;
  }; partnerId: number }
) {
  const { sourceTask } = params;
  if (!sourceTask.triggerProbability || !sourceTask.triggerTargetType) return null;
  if (Math.random() >= Number(sourceTask.triggerProbability)) return null;

  let template: {
    type: "daily" | "extra_normal" | "extra_quota";
    title: string;
    description: string | null;
    points: number | null;
    requiresProof: boolean;
    stampIconAssetId: number | null;
    quotaTotal: number | null;
  } | null = null;

  if (sourceTask.triggerTargetType === "specific_task" && sourceTask.triggerTargetTaskId) {
    template = await tx.taskTemplate.findUnique({ where: { id: sourceTask.triggerTargetTaskId } });
  } else if (sourceTask.triggerTargetType === "random_from_existing") {
    const candidates = await tx.taskTemplate.findMany({
      where: { roomId: params.roomId, status: "active", isSystemGenerated: false },
    });
    if (candidates.length > 0) {
      template = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  if (!template) return null;

  return tx.taskTemplate.create({
    data: {
      roomId: params.roomId,
      type: template.type,
      assignScope: "partner",
      title: template.title,
      description: template.description ?? undefined,
      createdById: null,
      assignedToId: params.partnerId,
      points: template.points ?? undefined,
      requiresProof: template.requiresProof,
      stampIconAssetId: template.stampIconAssetId ?? undefined,
      status: "active",
      quotaTotal: template.quotaTotal ?? undefined,
      isSystemGenerated: true,
      // Deliberately no triggerProbability copied — prevents infinite chains (10.5).
    },
  });
}

export function computeResponseDeadline(defaultReviewDays: number, explicitDeadline?: string) {
  if (explicitDeadline) return new Date(explicitDeadline);
  const d = new Date();
  d.setDate(d.getDate() + defaultReviewDays);
  return d;
}

/** Resolves overdue TaskApprovalRequests per Room.overdue_default_result (section 10.6). */
export async function resolveOverdueApprovals(roomId: number) {
  const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
  const overdue = await db.taskApprovalRequest.findMany({
    where: {
      roomId,
      status: "pending",
      responseDeadline: { lt: new Date() },
    },
  });

  for (const req of overdue) {
    const approve = room.overdueDefaultResult === "approve";
    await db.$transaction(async (tx) => {
      await tx.taskApprovalRequest.update({
        where: { id: req.id },
        data: {
          status: approve ? "auto_approved" : "auto_rejected",
          resolvedAt: new Date(),
        },
      });
      if (req.taskTemplateId || req.requestType === "room_settings_change") {
        await applyApprovalOutcome(tx, req, approve);
      }
    });
  }
}

export async function applyApprovalOutcome(
  tx: Prisma.TransactionClient,
  req: {
    id: number;
    roomId: number;
    requestType: string;
    taskTemplateId: number | null;
    payload: string;
    requestedById: number;
  },
  approve: boolean
) {
  const payload = JSON.parse(req.payload) as Record<string, unknown>;

  if (req.requestType === "room_settings_change") {
    if (approve && typeof payload.settlementDate === "string") {
      await tx.room.update({
        where: { id: req.roomId },
        data: { settlementDate: new Date(payload.settlementDate) },
      });
    }
    return;
  }

  if (!req.taskTemplateId) return;

  if (req.requestType === "create_task") {
    await tx.taskTemplate.update({
      where: { id: req.taskTemplateId },
      data: { status: approve ? "active" : "rejected" },
    });
  } else if (req.requestType === "edit_task") {
    if (approve) {
      await tx.taskTemplate.update({
        where: { id: req.taskTemplateId },
        data: {
          title: payload.title as string | undefined,
          description: payload.description as string | undefined,
          points: payload.points as number | undefined,
          requiresProof: payload.requiresProof as boolean | undefined,
          stampIconAssetId: payload.stampIconAssetId as number | undefined,
          approvalDeadline: payload.approvalDeadline
            ? new Date(payload.approvalDeadline as string)
            : undefined,
        },
      });
    }
  } else if (req.requestType === "delete_task") {
    await tx.taskTemplate.update({
      where: { id: req.taskTemplateId },
      data: { status: approve ? "archived" : "active" },
    });
  } else if (req.requestType === "change_quota_reward") {
    if (approve) {
      const template = await tx.taskTemplate.findUniqueOrThrow({ where: { id: req.taskTemplateId } });
      await tx.taskApprovalRequest.update({
        where: { id: req.id },
        // Marks which completion-in-sequence (by current quota_used) the
        // override applies to, per section 10.8.
        data: { appliesToCompletionIndex: template.quotaUsed },
      });
    }
  }
}
