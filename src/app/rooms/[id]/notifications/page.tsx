"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { NotificationDTO } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
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

const ENTITY_LINK: Record<string, (roomId: number) => string> = {
  TaskTemplate: (roomId) => `/rooms/${roomId}/tasks`,
  TaskApprovalRequest: (roomId) => `/rooms/${roomId}/approvals`,
  RoomCreationDraft: (roomId) => `/rooms/${roomId}/draft`,
  Reward: (roomId) => `/rooms/${roomId}/rewards`,
  Calendar: (roomId) => `/rooms/${roomId}/calendar`,
};

export default function NotificationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ notifications: NotificationDTO[] }>(`/api/rooms/${roomId}/notifications`);
      setNotifications(data.notifications);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function markRead(notificationId: number) {
    try {
      await apiFetch(`/api/rooms/${roomId}/notifications/${notificationId}/read`, { method: "POST" });
      load();
    } catch {
      // best-effort; leave state as-is on failure
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">通知</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {notifications.map((n) => {
          const href = n.relatedEntityType ? ENTITY_LINK[n.relatedEntityType]?.(roomId) : undefined;
          const content = (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                n.isRead ? "border-slate-200 bg-white text-slate-500" : "border-amber-200 bg-amber-50 font-medium"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{TYPE_LABEL[n.type] ?? n.type}</span>
                <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            </div>
          );
          return (
            <li key={n.id} onClick={() => !n.isRead && markRead(n.id)}>
              {href ? <Link href={href}>{content}</Link> : content}
            </li>
          );
        })}
        {notifications.length === 0 && <p className="text-sm text-slate-400">目前沒有通知</p>}
      </ul>
    </div>
  );
}
