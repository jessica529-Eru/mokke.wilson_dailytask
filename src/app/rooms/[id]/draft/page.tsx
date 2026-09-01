"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { TaskDraftListEditor } from "@/components/TaskDraftListEditor";
import type {
  DraftContentDTO,
  IconAssetDTO,
  MemberDTO,
  RoomCreationDraftDTO,
  RoomDTO,
} from "@/lib/types";

type MeResponse = { member: { id: number } | null };

export default function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);
  const router = useRouter();

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [drafts, setDrafts] = useState<RoomCreationDraftDTO[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [icons, setIcons] = useState<IconAssetDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [animation, setAnimation] = useState<"approve" | "revise" | null>(null);

  const [revising, setRevising] = useState(false);
  const [editContent, setEditContent] = useState<DraftContentDTO | null>(null);
  const [comment, setComment] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [roomData, draftData, me, iconData] = await Promise.all([
        apiFetch<{ room: RoomDTO; members: MemberDTO[] }>(`/api/rooms/${roomId}`),
        apiFetch<{ drafts: RoomCreationDraftDTO[] }>(`/api/rooms/${roomId}/draft`),
        apiFetch<MeResponse>("/api/auth/me"),
        apiFetch<{ assets: IconAssetDTO[] }>(`/api/rooms/${roomId}/icon-assets`).catch(() => ({ assets: [] })),
      ]);
      setRoom(roomData.room);
      setMembers(roomData.members);
      setDrafts(draftData.drafts);
      setMyId(me.member?.id ?? null);
      setIcons(iconData.assets);
      if (roomData.room.status === "active") {
        router.replace(`/rooms/${roomId}`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (loading) return <p className="text-slate-500">載入中…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!room) return null;

  const latest = drafts[drafts.length - 1];
  const iAmReviewer = latest && myId !== null && latest.proposedById !== myId;
  const isPendingReview = latest?.status === "pending_review";

  if (members.length < 2) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-xl font-bold">等待對方加入</h1>
        <p className="text-slate-500">把邀請碼分享給對方，讓他們加入房間並檢視你擬的契約內容。</p>
        <div className="mx-auto w-fit rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-6">
          <div className="text-xs text-slate-400">邀請碼</div>
          <div className="text-3xl font-mono font-bold tracking-[0.3em]">{room.inviteCode}</div>
        </div>
        <button onClick={load} className="text-sm text-slate-500 underline">
          重新整理
        </button>
      </div>
    );
  }

  async function handleApprove() {
    setAnimation("approve");
    try {
      await apiFetch(`/api/rooms/${roomId}/draft/approve`, { method: "POST" });
      setTimeout(() => {
        router.push(`/rooms/${roomId}`);
        router.refresh();
      }, 700);
    } catch (err) {
      setAnimation(null);
      setError(err instanceof ApiClientError ? err.message : "核准失敗");
    }
  }

  function startRevise() {
    if (!latest) return;
    setEditContent(structuredClone(latest.content));
    setComment("");
    setRevising(true);
  }

  async function submitRevise() {
    if (!editContent) return;
    if (!comment.trim()) {
      setError("請說明你修改了什麼");
      return;
    }
    setAnimation("revise");
    try {
      await apiFetch(`/api/rooms/${roomId}/draft/revise`, {
        method: "POST",
        body: JSON.stringify({
          content: editContent,
          itemComments: [{ targetKey: "general", comment }],
        }),
      });
      setTimeout(() => {
        setAnimation(null);
        setRevising(false);
        load();
      }, 700);
    } catch (err) {
      setAnimation(null);
      setError(err instanceof ApiClientError ? err.message : "送出失敗");
    }
  }

  const creator = members.find((m) => m.role === "creator");
  const partner = members.find((m) => m.role === "member");
  const nameFor = (scope: string) =>
    scope === "self" ? creator?.displayNickname ?? "房主" : scope === "partner" ? partner?.displayNickname ?? "加入者" : "雙方各自";

  return (
    <div className="space-y-6">
      {animation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div
            className={`animate-stamp-fall rounded-full border-8 px-10 py-6 text-3xl font-bold ${
              animation === "approve" ? "border-emerald-600 text-emerald-600" : "border-amber-600 text-amber-600"
            } bg-white/95`}
          >
            {animation === "approve" ? "同 意" : "退 回"}
          </div>
        </div>
      )}

      <h1 className="text-xl font-bold">卷軸契約</h1>

      {!revising && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between text-sm text-amber-700">
            <span>第 {latest.version} 版 · 由 {latest.proposedByNickname} 提出</span>
            <span>{isPendingReview ? "待對方回覆" : latest.status}</span>
          </div>

          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">房間名稱</dt>
              <dd className="font-medium">{latest.content.roomName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">初始總金額</dt>
              <dd className="font-medium">{latest.content.initialMoneyPool} 元（雙方各半）</dd>
            </div>
          </dl>

          <TaskList title="日常任務" items={latest.content.dailyTasks} nameFor={nameFor} />
          <TaskList title="額外任務" items={latest.content.extraTasks} nameFor={nameFor} />

          {latest.itemComments && latest.itemComments.length > 0 && (
            <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600">
              <span className="font-medium">修改說明：</span>
              {latest.itemComments.map((c, i) => (
                <span key={i}> {c.comment}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {revising && editContent && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <label className="block text-sm text-slate-600">房間名稱</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={editContent.roomName}
              onChange={(e) => setEditContent({ ...editContent, roomName: e.target.value })}
            />
            <label className="block text-sm text-slate-600">初始總金額</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={editContent.initialMoneyPool}
              onChange={(e) => setEditContent({ ...editContent, initialMoneyPool: Number(e.target.value) })}
            />
          </div>

          <section className="space-y-3">
            <h2 className="font-semibold">日常任務</h2>
            <TaskDraftListEditor
              kind="daily"
              items={editContent.dailyTasks}
              onChange={(items) => setEditContent({ ...editContent, dailyTasks: items })}
              icons={icons}
            />
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">額外任務</h2>
            <TaskDraftListEditor
              kind="extra"
              items={editContent.extraTasks}
              onChange={(items) => setEditContent({ ...editContent, extraTasks: items })}
              icons={icons}
            />
          </section>

          <div>
            <label className="mb-1 block text-sm text-slate-600">說明你修改了什麼</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setRevising(false)}
              className="flex-1 rounded-xl border border-slate-300 py-3 font-medium"
            >
              取消
            </button>
            <button
              onClick={submitRevise}
              className="flex-1 rounded-xl bg-amber-600 py-3 font-medium text-white"
            >
              送回給對方
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!revising && (
        <div className="flex gap-3">
          {iAmReviewer && isPendingReview ? (
            <>
              <button
                onClick={startRevise}
                className="flex-1 rounded-xl border border-amber-400 py-3 font-medium text-amber-700 hover:bg-amber-50"
              >
                針對內容提出修改
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500"
              >
                整體同意
              </button>
            </>
          ) : (
            <p className="w-full text-center text-slate-500">
              {isPendingReview ? "已送出，等待對方回覆…" : "已完成"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskList({
  title,
  items,
  nameFor,
}: {
  title: string;
  items: DraftContentDTO["dailyTasks"];
  nameFor: (scope: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-sm font-medium text-amber-800">{title}</div>
      <ul className="space-y-1">
        {items.map((t) => (
          <li key={t.tempId} className="rounded-lg bg-white px-3 py-2 text-sm">
            <span className="font-medium">{t.title}</span>
            <span className="ml-2 text-slate-400">{t.points ?? 0} 點 · {nameFor(t.assignScope)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
