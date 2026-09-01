"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { useMyId } from "@/lib/useMyId";
import type { ApprovalRequestDTO, RewardDTO } from "@/lib/types";

const REQUEST_TYPE_LABEL: Record<string, string> = {
  create_task: "新增任務",
  edit_task: "修改任務",
  delete_task: "刪除任務",
  change_quota_reward: "變更額度獎勵",
  room_settings_change: "房間設定變更",
};

const ASSIGN_SCOPE_LABEL: Record<string, string> = {
  self: "自己",
  partner: "對方",
  both: "雙方各自",
};

// The card used to show only the request type and task title — for
// change_quota_reward and create_task that's not enough to know what's
// actually being asked for approval (change to what points? which
// reward? worth how much?), which is exactly what got reported. This
// turns each request's payload into a one-line human-readable summary.
function summarize(r: ApprovalRequestDTO, rewards: RewardDTO[]): string | null {
  if (r.requestType === "change_quota_reward") {
    const parts: string[] = [];
    if (typeof r.payload.points === "number") parts.push(`下次完成改為 ${r.payload.points} 點`);
    if (typeof r.payload.rewardId === "number") {
      const reward = rewards.find((x) => x.id === r.payload.rewardId);
      parts.push(`同時解鎖「${reward?.title ?? "獎勵"}」`);
    }
    return parts.length > 0 ? parts.join("、") : null;
  }
  if (r.requestType === "create_task") {
    const points = typeof r.payload.points === "number" ? r.payload.points : 0;
    const assignScope = typeof r.payload.assignScope === "string" ? r.payload.assignScope : undefined;
    const scopeLabel = assignScope ? (ASSIGN_SCOPE_LABEL[assignScope] ?? assignScope) : null;
    const requiresProof = r.payload.requiresProof === true;
    const bindRewardId = typeof r.payload.bindRewardId === "number" ? r.payload.bindRewardId : undefined;
    const parts = [`${points} 點`];
    if (scopeLabel) parts.push(`對象：${scopeLabel}`);
    if (requiresProof) parts.push("需上傳證明");
    if (bindRewardId !== undefined) {
      const reward = rewards.find((x) => x.id === bindRewardId);
      parts.push(`綁定獎勵「${reward?.title ?? "獎勵"}」`);
    }
    return parts.join(" · ");
  }
  return null;
}

export default function ApprovalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [requests, setRequests] = useState<ApprovalRequestDTO[]>([]);
  const [rewards, setRewards] = useState<RewardDTO[]>([]);
  const myId = useMyId();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [data, rewardData] = await Promise.all([
        apiFetch<{ requests: ApprovalRequestDTO[] }>(`/api/rooms/${roomId}/approvals`),
        apiFetch<{ rewards: RewardDTO[] }>(`/api/rooms/${roomId}/rewards`),
      ]);
      setRequests(data.requests);
      setRewards(rewardData.rewards);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function respond(requestId: number, action: "approve" | "reject") {
    try {
      await apiFetch(`/api/rooms/${roomId}/approvals/${requestId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "操作失敗");
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">審核中心</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-600">待處理</h2>
        {pending.length === 0 && <p className="text-sm text-slate-400">目前沒有待處理項目</p>}
        {pending.map((r) => {
          const summary = summarize(r, rewards);
          return (
          <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">
              {REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType} · {r.requestedByNickname} 提出
            </div>
            <div className="font-medium">
              {r.taskTitle ??
                (r.requestType === "room_settings_change" && typeof r.payload.settlementDate === "string"
                  ? `新結算日：${new Date(r.payload.settlementDate).toLocaleString()}`
                  : "（房間設定）")}
            </div>
            {summary && <div className="mt-1 text-sm text-slate-600">{summary}</div>}
            {r.responseDeadline && (
              <div className="text-xs text-slate-500">
                截止：{new Date(r.responseDeadline).toLocaleString()}
              </div>
            )}
            {r.requestedById !== myId ? (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => respond(r.id, "reject")}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
                >
                  拒絕
                </button>
                <button
                  onClick={() => respond(r.id, "approve")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
                >
                  同意
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">等待對方回覆</p>
            )}
          </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-600">歷史紀錄</h2>
        {resolved.slice(0, 20).map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500">
            {REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType} · {r.taskTitle ?? "房間設定"}
            {summarize(r, rewards) ? ` · ${summarize(r, rewards)}` : ""} ·{" "}
            {r.status}
          </div>
        ))}
      </section>
    </div>
  );
}
