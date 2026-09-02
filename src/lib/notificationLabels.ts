import type { $Enums } from "@/generated/prisma/client";

// The human-readable label per NotificationType — was defined twice
// (notifications/page.tsx for the in-app list, push.ts for the push
// title), and TypeScript only caught the drift because push.ts's copy is
// typed as Record<NotificationType, string> (exhaustive); the in-app copy
// wasn't, so it could silently fall out of sync with the enum instead.
export const NOTIFICATION_LABEL: Record<$Enums.NotificationType, string> = {
  approval_pending: "有待審核項目",
  approval_deadline_soon: "審核期限將至",
  daily_task_reminder: "日常任務提醒",
  task_rejected: "任務被拒絕",
  task_approved: "任務已核准",
  reward_unlocked: "獎勵已解鎖",
  reward_stock_exhausted: "獎勵已兌換完畢",
  reward_redeem_requested: "對方想要兌換一個獎勵",
  reward_redeemed: "你的獎勵兌換已確認完成",
  reward_stamp_reacted: "對方在你的照片印章上有新留言/反應",
  settlement_upcoming: "即將結算",
  streak_breaking_soon: "連續天數即將中斷",
  money_topped_up: "獎金池已加碼",
  surprise_task_triggered: "觸發了驚喜任務",
  room_draft_revision_requested: "契約有新的修改",
  room_draft_approved: "契約已成立",
};
