import { z } from "zod";
import { imageUrlSchema } from "@/lib/zodHelpers";

export const createTaskSchema = z
  .object({
    type: z.enum(["daily", "extra_normal", "extra_quota"]),
    assignScope: z.enum(["self", "partner", "both"]),
    title: z.string().min(1).max(60),
    description: z.string().max(500).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    requiresProof: z.boolean().default(false),
    quotaTotal: z.number().int().min(1).max(999).optional(),
    stampIconAssetId: z.number().int().optional(),
    approvalDeadline: z.string().datetime().optional(),
    triggerProbability: z.number().min(0).max(1).optional(),
    triggerTargetType: z.enum(["specific_task", "random_from_existing"]).optional(),
    triggerTargetTaskId: z.number().int().optional(),
  })
  .refine((v) => v.type !== "extra_quota" || typeof v.quotaTotal === "number", {
    message: "額度任務需設定 quotaTotal",
    path: ["quotaTotal"],
  })
  .refine(
    (v) => v.triggerTargetType !== "specific_task" || typeof v.triggerTargetTaskId === "number",
    { message: "指定觸發任務需提供 triggerTargetTaskId", path: ["triggerTargetTaskId"] }
  );

export const editTaskSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional(),
  points: z.number().int().min(0).max(1000).optional(),
  requiresProof: z.boolean().optional(),
  stampIconAssetId: z.number().int().optional(),
  approvalDeadline: z.string().datetime().optional(),
});

export const completeTaskSchema = z.object({
  proofText: z.string().max(2000).optional(),
  proofImageUrls: z.array(imageUrlSchema).max(9).optional(),
  // The member's own local calendar date (YYYY-MM-DD). Preferred over a
  // server-computed date since only the client reliably knows the member's
  // timezone (section 10.12) — falls back to Room.settlementTimezone if omitted.
  completedLocalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isMakeup: z.boolean().default(false),
  makeupForDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
