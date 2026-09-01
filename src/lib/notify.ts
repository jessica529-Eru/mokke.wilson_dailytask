import { db } from "@/lib/db";
import type { $Enums } from "@/generated/prisma/client";
import { sendPushForNotification } from "@/lib/push";

export async function notify(params: {
  roomId: number;
  roomMemberId: number;
  type: $Enums.NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: number;
}) {
  const notification = await db.notification.create({
    data: {
      roomId: params.roomId,
      roomMemberId: params.roomMemberId,
      type: params.type,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });

  // Fire-and-forget: the in-app notification (already saved) is the
  // source of truth, push is a best-effort nudge on top of it.
  sendPushForNotification(params).catch(() => {});

  return notification;
}
