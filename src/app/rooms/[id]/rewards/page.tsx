"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { RewardDTO, TaskTemplateDTO } from "@/lib/types";

type StreakDTO = {
  roomMemberId: number;
  displayNickname: string;
  streakType: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveLocalDate: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  fixed_item: "固定獎品",
  rescue_voucher: "補救券",
  other: "其他",
};

export default function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [rewards, setRewards] = useState<RewardDTO[]>([]);
  const [tasks, setTasks] = useState<TaskTemplateDTO[]>([]);
  const [streaks, setStreaks] = useState<StreakDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [rewardData, taskData, streakData] = await Promise.all([
        apiFetch<{ rewards: RewardDTO[] }>(`/api/rooms/${roomId}/rewards`),
        apiFetch<{ tasks: TaskTemplateDTO[] }>(`/api/rooms/${roomId}/tasks`),
        apiFetch<{ streaks: StreakDTO[] }>(`/api/rooms/${roomId}/streaks`),
      ]);
      setRewards(rewardData.rewards);
      setTasks(taskData.tasks.filter((t) => t.status === "active"));
      setStreaks(streakData.streaks);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  async function redeemVoucher(rewardId: number) {
    const today = new Intl.DateTimeFormat("en-CA").format(new Date());
    const input = prompt("要回補哪一天？（最近 14 天內，格式 YYYY-MM-DD）", today);
    if (!input) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/rescue-vouchers/use`, {
        method: "POST",
        body: JSON.stringify({ rewardId, makeupForDate: input }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "使用失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">獎勵庫</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          {showForm ? "取消" : "+ 新增獎勵"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {streaks.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">連續天數</h2>
          <div className="flex gap-6 text-sm">
            {streaks.map((s) => (
              <div key={s.roomMemberId}>
                <div className="font-medium">{s.displayNickname}</div>
                <div className="text-slate-500">
                  目前 {s.currentStreak} 天 · 最長 {s.longestStreak} 天
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <NewRewardForm
          roomId={roomId}
          tasks={tasks}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <ul className="space-y-3">
        {rewards.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {TYPE_LABEL[r.type] ?? r.type}
                  {r.stockTotal !== null && ` · 庫存 ${r.stockRemaining}/${r.stockTotal}`}
                </span>
              </div>
              {r.type === "rescue_voucher" ? (
                <button
                  onClick={() => redeemVoucher(r.id)}
                  disabled={r.stockTotal !== null && (r.stockRemaining ?? 0) <= 0}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                >
                  使用補救券
                </button>
              ) : (
                <span className={`text-xs ${r.unlocked ? "text-emerald-600" : "text-slate-400"}`}>
                  {r.unlocked ? "已解鎖" : "🔒 未解鎖"}
                </span>
              )}
            </div>
            {r.unlocked && r.contentText && <p className="mt-2 text-sm text-slate-600">{r.contentText}</p>}
          </li>
        ))}
        {rewards.length === 0 && <p className="text-sm text-slate-400">目前沒有獎勵</p>}
      </ul>
    </div>
  );
}

function NewRewardForm({
  roomId,
  tasks,
  onCreated,
}: {
  roomId: number;
  tasks: TaskTemplateDTO[];
  onCreated: () => void;
}) {
  const [type, setType] = useState<"fixed_item" | "rescue_voucher" | "other">("fixed_item");
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [stockTotal, setStockTotal] = useState<number | "">("");
  const [conditionType, setConditionType] = useState<"none" | "single_task" | "multi_task_threshold" | "streak_days">(
    "none"
  );
  const [singleTaskId, setSingleTaskId] = useState<number | "">("");
  const [multiTaskIds, setMultiTaskIds] = useState<number[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [streakDays, setStreakDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let assignment: { unlockConditionType: string; unlockConditionValue: Record<string, unknown> } | undefined;
    if (conditionType === "single_task" && singleTaskId !== "") {
      assignment = { unlockConditionType: "single_task", unlockConditionValue: { taskId: singleTaskId } };
    } else if (conditionType === "multi_task_threshold" && multiTaskIds.length > 0) {
      assignment = {
        unlockConditionType: "multi_task_threshold",
        unlockConditionValue: { taskIds: multiTaskIds, threshold },
      };
    } else if (conditionType === "streak_days") {
      assignment = { unlockConditionType: "streak_days", unlockConditionValue: { days: streakDays } };
    }

    try {
      await apiFetch(`/api/rooms/${roomId}/rewards`, {
        method: "POST",
        body: JSON.stringify({
          type,
          title,
          contentText: contentText || undefined,
          stockTotal: stockTotal === "" ? undefined : stockTotal,
          assignment,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "建立失敗");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="獎勵名稱"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="獎勵內容說明（解鎖後才看得到）"
        rows={2}
        value={contentText}
        onChange={(e) => setContentText(e.target.value)}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          類型
          <select
            className="rounded-lg border border-slate-300 px-2 py-1"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="fixed_item">固定獎品</option>
            <option value="rescue_voucher">補救券</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          庫存（留白 = 不限）
          <input
            type="number"
            min={1}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1"
            value={stockTotal}
            onChange={(e) => setStockTotal(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="font-medium text-slate-600">解鎖條件（選填）</div>
        <select
          className="rounded-lg border border-slate-300 px-2 py-1"
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value as typeof conditionType)}
        >
          <option value="none">不設定（手動指派）</option>
          <option value="single_task">完成指定任務一次</option>
          <option value="multi_task_threshold">完成多個任務達門檻次數</option>
          <option value="streak_days">連續天數達標</option>
        </select>

        {conditionType === "single_task" && (
          <select
            className="w-full rounded-lg border border-slate-300 px-2 py-1"
            value={singleTaskId}
            onChange={(e) => setSingleTaskId(Number(e.target.value))}
          >
            <option value="">選擇任務</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {conditionType === "multi_task_threshold" && (
          <div className="space-y-1">
            {tasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={multiTaskIds.includes(t.id)}
                  onChange={(e) =>
                    setMultiTaskIds((prev) =>
                      e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                    )
                  }
                />
                {t.title}
              </label>
            ))}
            <label className="flex items-center gap-2">
              門檻次數
              <input
                type="number"
                min={1}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {conditionType === "streak_days" && (
          <label className="flex items-center gap-2">
            連續天數
            <input
              type="number"
              min={1}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
              value={streakDays}
              onChange={(e) => setStreakDays(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        建立獎勵
      </button>
    </form>
  );
}
