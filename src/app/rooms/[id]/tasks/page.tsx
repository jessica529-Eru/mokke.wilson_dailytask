"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { StampIconPicker } from "@/components/StampIconPicker";
import { FrameStamp } from "@/components/FrameStamp";
import { MultiImageUploadField } from "@/components/MultiImageUploadField";
import type { AssignScope, IconAssetDTO, MemberDTO, TaskTemplateDTO, TaskType } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "進行中",
  pending_approval: "待對方同意",
  rejected: "已被拒絕",
  deleted_pending_approval: "待對方同意刪除",
  archived: "已封存",
};

const ASSIGN_SCOPE_LABEL: Record<AssignScope, string> = {
  self: "自己",
  partner: "對方",
  both: "雙方各自",
};

type MeResponse = { member: { id: number } | null };

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [tasks, setTasks] = useState<TaskTemplateDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [icons, setIcons] = useState<IconAssetDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [taskData, roomData, me, iconData] = await Promise.all([
        apiFetch<{ tasks: TaskTemplateDTO[] }>(`/api/rooms/${roomId}/tasks`),
        apiFetch<{ members: MemberDTO[] }>(`/api/rooms/${roomId}`),
        apiFetch<MeResponse>("/api/auth/me"),
        apiFetch<{ assets: IconAssetDTO[] }>(`/api/rooms/${roomId}/icon-assets`),
      ]);
      setTasks(taskData.tasks);
      setMembers(roomData.members);
      setMyId(me.member?.id ?? null);
      setIcons(iconData.assets);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const nicknameById = new Map(members.map((m) => [m.id, m.displayNickname]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">任務</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          {showForm ? "取消" : "+ 新增任務"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <NewTaskForm
          roomId={roomId}
          icons={icons}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <ul className="space-y-3">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            roomId={roomId}
            myId={myId}
            assignedNickname={t.assignedToId ? nicknameById.get(t.assignedToId) : undefined}
            onChanged={load}
          />
        ))}
        {tasks.length === 0 && <p className="text-sm text-slate-400">目前沒有任務</p>}
      </ul>
    </div>
  );
}

function NewTaskForm({
  roomId,
  icons,
  onCreated,
}: {
  roomId: number;
  icons: IconAssetDTO[];
  onCreated: () => void;
}) {
  const [type, setType] = useState<TaskType>("daily");
  const [assignScope, setAssignScope] = useState<AssignScope>("self");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(10);
  const [requiresProof, setRequiresProof] = useState(false);
  const [quotaTotal, setQuotaTotal] = useState(1);
  const [stampIconAssetId, setStampIconAssetId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/rooms/${roomId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          type,
          assignScope,
          title,
          points,
          requiresProof,
          quotaTotal: type === "extra_quota" ? quotaTotal : undefined,
          stampIconAssetId,
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
        placeholder="任務名稱"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          類型
          <select className="rounded-lg border border-slate-300 px-2 py-1" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            <option value="daily">日常任務</option>
            <option value="extra_normal">單次額外任務</option>
            <option value="extra_quota">額度任務</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          指派對象
          <select
            className="rounded-lg border border-slate-300 px-2 py-1"
            value={assignScope}
            onChange={(e) => setAssignScope(e.target.value as AssignScope)}
          >
            <option value="self">自己</option>
            <option value="partner">對方</option>
            <option value="both">雙方各自</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          點數
          <input
            type="number"
            className="w-20 rounded-lg border border-slate-300 px-2 py-1"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </label>
        {type === "extra_quota" && (
          <label className="flex items-center gap-2">
            額度上限
            <input
              type="number"
              min={1}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
              value={quotaTotal}
              onChange={(e) => setQuotaTotal(Number(e.target.value))}
            />
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} />
          需上傳照片/文字證明
        </label>
      </div>
      <StampIconPicker assets={icons} value={stampIconAssetId} onChange={setStampIconAssetId} />
      {assignScope !== "self" && (
        <p className="text-xs text-amber-600">此任務需要對方同意才會生效。</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        建立任務
      </button>
    </form>
  );
}

function TaskRow({
  task,
  roomId,
  myId,
  assignedNickname,
  onChanged,
}: {
  task: TaskTemplateDTO;
  roomId: number;
  myId: number | null;
  assignedNickname?: string;
  onChanged: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [proofText, setProofText] = useState("");
  const [proofImageUrls, setProofImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justStamped, setJustStamped] = useState(false);

  const canComplete =
    task.status === "active" && (task.assignScope === "both" || task.assignedToId === myId);

  async function complete() {
    setError(null);
    try {
      const localDate = new Intl.DateTimeFormat("en-CA").format(new Date());
      await apiFetch(`/api/rooms/${roomId}/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          completedLocalDate: localDate,
          proofText: proofText || undefined,
          proofImageUrls: proofImageUrls.length > 0 ? proofImageUrls : undefined,
        }),
      });
      setCompleting(false);
      setProofText("");
      setProofImageUrls([]);
      setJustStamped(true);
      setTimeout(() => setJustStamped(false), 700);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "完成失敗");
    }
  }

  async function requestDelete() {
    if (!confirm("確定要提出刪除此任務嗎？需要對方同意。")) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/tasks/${task.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "操作失敗");
    }
  }

  async function requestQuotaRewardChange() {
    const input = prompt("下一次完成時要改成多少點？（僅套用於下一次完成）", String(task.points ?? 0));
    if (input === null) return;
    const points = Number(input);
    if (!Number.isFinite(points) || points < 0) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/tasks/${task.id}/quota-reward-change`, {
        method: "POST",
        body: JSON.stringify({ points }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "操作失敗");
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {task.stampIcon && (
            <span className={`h-10 w-10 shrink-0 ${justStamped ? "animate-stamp-fall" : ""}`}>
              <FrameStamp frames={task.stampIcon.frames} play={justStamped} className="h-full w-full" />
            </span>
          )}
          <div>
            <div className="font-medium">{task.title}</div>
            <div className="text-xs text-slate-400">
              {task.points ?? 0} 點 · {ASSIGN_SCOPE_LABEL[task.assignScope]}
              {assignedNickname ? `（${assignedNickname}）` : ""}
              {task.type === "extra_quota" && ` · 額度 ${task.quotaUsed}/${task.quotaTotal}`}
              {task.isSystemGenerated && " · 🎁 驚喜任務"}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {canComplete && (
        <div className="mt-3">
          {completing ? (
            <div className="space-y-2">
              {task.requiresProof && (
                <>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="留下文字證明（會產生郵票）"
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                  />
                  <MultiImageUploadField value={proofImageUrls} onChange={setProofImageUrls} />
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => setCompleting(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">
                  取消
                </button>
                <button onClick={complete} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white">
                  確認完成
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => (task.requiresProof ? setCompleting(true) : complete())}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white"
              >
                完成
              </button>
              <button onClick={requestDelete} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600">
                提出刪除
              </button>
              {task.type === "extra_quota" && (
                <button
                  onClick={requestQuotaRewardChange}
                  className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700"
                >
                  變更下次獎勵
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
