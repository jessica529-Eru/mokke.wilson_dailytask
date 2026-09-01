import { z } from "zod";

// A task item as it lives inside a RoomCreationDraft.content_snapshot JSON blob.
// `tempId` is a client-generated string used to let items reference each other
// (e.g. a surprise-trigger pointing at a sibling task) before real TaskTemplate
// rows exist.
export const taskDraftItemSchema = z
  .object({
    tempId: z.string().min(1),
    type: z.enum(["daily", "extra_normal", "extra_quota"]),
    assignScope: z.enum(["self", "partner", "both"]),
    title: z.string().min(1).max(60),
    description: z.string().max(500).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    requiresProof: z.boolean().default(false),
    quotaTotal: z.number().int().min(1).max(999).optional(),
    stampIconAssetId: z.number().int().optional(),
    triggerProbability: z.number().min(0).max(1).optional(),
    triggerTargetType: z.enum(["specific_task", "random_from_existing"]).optional(),
    triggerTargetTempId: z.string().optional(),
  })
  .refine(
    (item) => item.type !== "extra_quota" || typeof item.quotaTotal === "number",
    { message: "額度任務需設定 quotaTotal", path: ["quotaTotal"] }
  );

export type TaskDraftItem = z.infer<typeof taskDraftItemSchema>;

export const draftContentSnapshotSchema = z.object({
  roomName: z.string().min(1).max(40),
  initialMoneyPool: z.number().min(0),
  // Set once here as part of the scroll contract (both sides implicitly
  // agree to it by approving the draft); changing it afterwards requires a
  // room_settings_change TaskApprovalRequest instead (see settlement-date
  // route and applyApprovalOutcome).
  settlementDate: z.string().datetime(),
  // IANA zone name (e.g. "Asia/Taipei"). Drives what counts as "today" for
  // daily-task resets, streaks, and settlement — set once at room creation
  // like settlementDate; Room.settlementTimezone otherwise silently
  // defaulted to Asia/Taipei with no way to change it.
  settlementTimezone: z.string().min(1).max(64).default("Asia/Taipei"),
  dailyTasks: z.array(taskDraftItemSchema).max(50),
  extraTasks: z.array(taskDraftItemSchema).max(50),
});

export type DraftContentSnapshot = z.infer<typeof draftContentSnapshotSchema>;

export const itemCommentSchema = z.object({
  targetKey: z.string().min(1),
  comment: z.string().min(1).max(500),
});

export type ItemComment = z.infer<typeof itemCommentSchema>;

/**
 * "self" / "partner" inside a room-creation draft are anchored to the room
 * creator for the entire negotiation, regardless of which of the two
 * members most recently edited an item. This keeps the ping-pong revision
 * flow (section 2.1) unambiguous: whoever the eventual creator turns out to
 * be, "self" always means them and "partner" always means the person who
 * joins via invite code.
 */
export function resolveAssignedToId(
  assignScope: TaskDraftItem["assignScope"],
  creatorId: number,
  partnerId: number
): number | null {
  if (assignScope === "self") return creatorId;
  if (assignScope === "partner") return partnerId;
  return null;
}

import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Turns an approved room-creation draft's task list into real, already-active
 * TaskTemplate rows. Agreement was already reached through the scroll
 * contract (section 2), so these skip TaskApprovalRequest entirely — that
 * flow is only for tasks added after the room goes active (section 10.6).
 */
export async function materializeDraftTasks(
  tx: TxClient,
  roomId: number,
  creatorId: number,
  partnerId: number,
  content: DraftContentSnapshot
) {
  const items = [
    ...content.dailyTasks.map((t) => ({ ...t, kind: "daily" as const })),
    ...content.extraTasks,
  ];

  const tempIdToRealId = new Map<string, number>();
  const pendingTriggerLinks: { realId: number; triggerTargetTempId: string }[] = [];

  for (const item of items) {
    const created = await tx.taskTemplate.create({
      data: {
        roomId,
        type: item.type,
        assignScope: item.assignScope,
        title: item.title,
        description: item.description,
        createdById: creatorId,
        assignedToId: resolveAssignedToId(item.assignScope, creatorId, partnerId),
        points: item.points,
        requiresProof: item.requiresProof,
        stampIconAssetId: item.stampIconAssetId,
        status: "active",
        quotaTotal: item.quotaTotal,
        triggerProbability: item.triggerProbability,
        triggerTargetType: item.triggerTargetType,
      },
    });
    tempIdToRealId.set(item.tempId, created.id);
    if (item.triggerTargetType === "specific_task" && item.triggerTargetTempId) {
      pendingTriggerLinks.push({ realId: created.id, triggerTargetTempId: item.triggerTargetTempId });
    }
  }

  for (const link of pendingTriggerLinks) {
    const targetId = tempIdToRealId.get(link.triggerTargetTempId);
    if (targetId) {
      await tx.taskTemplate.update({
        where: { id: link.realId },
        data: { triggerTargetTaskId: targetId },
      });
    }
  }
}
