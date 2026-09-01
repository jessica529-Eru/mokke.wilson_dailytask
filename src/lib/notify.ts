import { db } from "@/lib/db";
import type { $Enums } from "@/generated/prisma/client";

export function notify(params: {
  roomId: number;
  roomMemberId: number;
  type: $Enums.NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: number;
}) {
  return db.notification.create({
    data: {
      roomId: params.roomId,
      roomMemberId: params.roomMemberId,
      type: params.type,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
}
