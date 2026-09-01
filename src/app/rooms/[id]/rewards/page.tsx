"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { MultiImageUploadField } from "@/components/MultiImageUploadField";
import { ConditionPicker, type UnlockCondition } from "@/components/ConditionPicker";
import type { MemberDTO, RewardDTO, TaskTemplateDTO } from "@/lib/types";

type StreakDTO = {
  roomMemberId: number;
  displayNickname: string;
  streakType: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveLocalDate: string | null;
};

type MeResponse = { member: { id: number } | null };

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
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<number | null>(null);
  const [makeupDate, setMakeupDate] = useState("");

  async function load() {
    try {
      const [rewardData, taskData, streakData, roomData, me] = await Promise.all([
        apiFetch<{ rewards: RewardDTO[] }>(`/api/rooms/${roomId}/rewards`),
        apiFetch<{ tasks: TaskTemplateDTO[] }>(`/api/rooms/${roomId}/tasks`),
        apiFetch<{ streaks: StreakDTO[] }>(`/api/rooms/${roomId}/streaks`),
        apiFetch<{ members: MemberDTO[] }>(`/api/rooms/${roomId}`),
        apiFetch<MeResponse>("/api/auth/me"),
      ]);
      setRewards(rewardData.rewards);
      setTasks(taskData.tasks.filter((t) => t.status === "active"));
      setStreaks(streakData.streaks);
      setMembers(roomData.members);
      setMyId(me.member?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  const colorByMemberId = new Map(members.map((m) => [m.id, m.color]));

  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const earliestMakeupDate = new Intl.DateTimeFormat("en-CA").format(fourteenDaysAgo);

  function startRedeemVoucher(rewardId: number) {
    setRedeemingRewardId(rewardId);
    setMakeupDate(today);
  }

  async function confirmRedeemVoucher(rewardId: number) {
    try {
      await apiFetch(`/api/rooms/${roomId}/rescue-vouchers/use`, {
        method: "POST",
        body: JSON.stringify({ rewardId, makeupForDate: makeupDate }),
      });
      setRedeemingRewardId(null);
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
            {streaks.map((s) => {
              const color = colorByMemberId.get(s.roomMemberId) ?? "#94a3b8";
              return (
                <div key={s.roomMemberId} className="border-l-2 pl-2" style={{ borderLeftColor: color }}>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {s.displayNickname}
                    {s.roomMemberId === myId && <span className="text-xs font-normal text-slate-400">（你）</span>}
                  </div>
                  <div className="text-slate-500">
                    目前 {s.currentStreak} 天 · 最長 {s.longestStreak} 天
                  </div>
                </div>
              );
            })}
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
        {rewards.map((r) => {
          const creatorColor = colorByMemberId.get(r.createdById);
          return (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4 border-l-4"
              style={{ borderLeftColor: creatorColor ?? "#e2e8f0" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {TYPE_LABEL[r.type] ?? r.type}
                    {r.stockTotal !== null && ` · 庫存 ${r.stockRemaining}/${r.stockTotal}`}
                  </span>
                </div>
                {r.type === "rescue_voucher" ? (
                  r.unlocked ? (
                    redeemingRewardId !== r.id && (
                      <button
                        onClick={() => startRedeemVoucher(r.id)}
                        disabled={r.stockTotal !== null && (r.stockRemaining ?? 0) <= 0}
                        className="rounded-lg bg-amber-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                      >
                        使用補救券
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-slate-400" title="只有達成解鎖條件的本人才能使用">
                      🔒 尚未解鎖
                    </span>
                  )
                ) : (
                  <span className={`text-xs ${r.unlocked ? "text-emerald-600" : "text-slate-400"}`}>
                    {r.unlocked ? "已解鎖" : "🔒 未解鎖"}
                  </span>
                )}
              </div>
              {redeemingRewardId === r.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs">
                  <label className="flex items-center gap-1.5">
                    要回補哪一天？
                    <input
                      type="date"
                      autoFocus
                      className="rounded-lg border border-slate-300 px-2 py-1"
                      value={makeupDate}
                      min={earliestMakeupDate}
                      max={today}
                      onChange={(e) => setMakeupDate(e.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => setRedeemingRewardId(null)}
                    className="rounded-lg border border-slate-300 px-2 py-1"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => confirmRedeemVoucher(r.id)}
                    className="rounded-lg bg-amber-600 px-2 py-1 text-white"
                  >
                    確認回補
                  </button>
                </div>
              )}
              {r.unlocked && r.contentText && <p className="mt-2 text-sm text-slate-600">{r.contentText}</p>}
              {r.unlocked && r.contentImageUrls && r.contentImageUrls.length > 0 && (
                <div className="mt-2 space-y-2">
                  {r.contentImageUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt="" className="w-full rounded-lg object-contain" />
                  ))}
                </div>
              )}
            </li>
          );
        })}
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
  const [contentImageUrls, setContentImageUrls] = useState<string[]>([]);
  const [stockTotal, setStockTotal] = useState<number | "">("");
  const [assignment, setAssignment] = useState<UnlockCondition | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await apiFetch(`/api/rooms/${roomId}/rewards`, {
        method: "POST",
        body: JSON.stringify({
          type,
          title,
          contentText: contentText || undefined,
          contentImageUrls: contentImageUrls.length > 0 ? contentImageUrls : undefined,
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
      <div>
        <label className="mb-1 block text-xs text-slate-500">附上照片（選填，解鎖後才看得到）</label>
        <MultiImageUploadField value={contentImageUrls} onChange={setContentImageUrls} />
      </div>
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

      <div>
        <div className="mb-1 text-xs text-slate-500">解鎖條件（選填）</div>
        <ConditionPicker tasks={tasks} onChange={setAssignment} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        建立獎勵
      </button>
    </form>
  );
}
