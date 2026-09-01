"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { TugOfWar } from "@/components/TugOfWar";
import type { RoomDTO, ScoresDTO, TaskTemplateDTO } from "@/lib/types";

export default function RoomHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [scores, setScores] = useState<ScoresDTO | null>(null);
  const [tasks, setTasks] = useState<TaskTemplateDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(100);
  const [showTopUp, setShowTopUp] = useState(false);
  const [coinAnim, setCoinAnim] = useState(false);

  async function load() {
    try {
      const [roomData, scoreData, taskData] = await Promise.all([
        apiFetch<{ room: RoomDTO }>(`/api/rooms/${roomId}`),
        apiFetch<ScoresDTO>(`/api/rooms/${roomId}/scores`),
        apiFetch<{ tasks: TaskTemplateDTO[] }>(`/api/rooms/${roomId}/tasks`),
      ]);
      setRoom(roomData.room);
      setScores(scoreData);
      setTasks(taskData.tasks.filter((t) => t.status === "active").slice(0, 5));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleTopUp() {
    try {
      await apiFetch(`/api/rooms/${roomId}/topup`, {
        method: "POST",
        body: JSON.stringify({ amount: topUpAmount }),
      });
      setCoinAnim(true);
      setShowTopUp(false);
      setTimeout(() => setCoinAnim(false), 800);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "加碼失敗");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!room || !scores) return <p className="text-slate-500">載入中…</p>;

  return (
    <div className="space-y-8">
      {coinAnim && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center gap-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="animate-coin-fall text-3xl"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              🪙
            </span>
          ))}
        </div>
      )}

      <section>
        <h1 className="mb-4 text-xl font-bold">拉鋸戰現況</h1>
        <TugOfWar members={scores.members} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">獎金池</h2>
          <button
            onClick={() => setShowTopUp((v) => !v)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            加碼
          </button>
        </div>
        <p className="text-2xl font-bold">{scores.currentMoneyPool} 元</p>

        {showTopUp && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(Number(e.target.value))}
            />
            <button onClick={handleTopUp} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">
              確認加碼
            </button>
          </div>
        )}

        <div className="mt-4 space-y-1 text-sm text-slate-600">
          {scores.members.map((m) => (
            <div key={m.id} className="flex justify-between">
              <span style={{ color: m.color }}>{m.displayNickname}</span>
              <span>若現在結算可拿到 {m.projectedPayout} 元</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-600">※ 僅為即時試算，非最終結算結果</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">進行中的任務</h2>
          <Link href={`/rooms/${roomId}/tasks`} className="text-sm text-slate-500 underline">
            查看全部
          </Link>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
              <span className="font-medium">{t.title}</span>
              <span className="ml-2 text-slate-400">{t.points ?? 0} 點</span>
            </li>
          ))}
          {tasks.length === 0 && <p className="text-sm text-slate-400">目前沒有進行中的任務</p>}
        </ul>
      </section>
    </div>
  );
}
