import webpush from "web-push";
import { db } from "@/lib/db";
import type { $Enums } from "@/generated/prisma/client";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

const NOTIFICATION_TITLE: Record<$Enums.NotificationType, string> = {
  approval_pending: "有待審核項目",
  approval_deadline_soon: "審核期限將至",
  daily_task_reminder: "日常任務提醒",
  task_rejected: "任務被拒絕",
  task_approved: "任務已核准",
  reward_unlocked: "獎勵已解鎖",
  settlement_upcoming: "即將結算",
  streak_breaking_soon: "連續天數即將中斷",
  money_topped_up: "獎金池已加碼",
  surprise_task_triggered: "觸發了驚喜任務",
  room_draft_revision_requested: "契約有新的修改",
  room_draft_approved: "契約已成立",
};

/**
 * Best-effort push delivery for a Notification row that was already
 * written to the database (the in-app notification center is the source
 * of truth — section 12's "站內未讀提示備援"). Silently no-ops if VAPID
 * isn't configured, and drops subscriptions the push service reports as
 * gone (404/410) rather than retrying them forever.
 */
export async function sendPushForNotification(params: {
  roomId: number;
  roomMemberId: number;
  type: $Enums.NotificationType;
}) {
  if (!ensureConfigured()) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { roomMemberId: params.roomMemberId },
  });
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: NOTIFICATION_TITLE[params.type] ?? "有新通知",
    url: `/rooms/${params.roomId}/notifications`,
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
