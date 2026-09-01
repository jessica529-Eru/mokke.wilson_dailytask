import { db } from "@/lib/db";

/** Section 9.16: kept for traceability, deliberately without a UI entry point. */
export function logAudit(params: {
  roomId: number;
  actorRoomMemberId?: number | null;
  actionType: string;
  targetEntityType: string;
  targetEntityId: number;
  changeSummary?: Record<string, unknown>;
}) {
  return db.auditLog.create({
    data: {
      roomId: params.roomId,
      actorRoomMemberId: params.actorRoomMemberId ?? null,
      actionType: params.actionType,
      targetEntityType: params.targetEntityType,
      targetEntityId: params.targetEntityId,
      changeSummary: JSON.stringify(params.changeSummary ?? {}),
    },
  });
}
