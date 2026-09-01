import webpush from "web-push";
import { db } from "@/lib/db";
import { NOTIFICATION_LABEL } from "@/lib/notificationLabels";
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
    title: NOTIFICATION_LABEL[params.type] ?? "有新通知",
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
