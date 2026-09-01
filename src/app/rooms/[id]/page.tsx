"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { TugOfWar } from "@/components/TugOfWar";
import type { RoomDTO, ScoresDTO, SettlementRecordDTO, TaskTemplateDTO, TopUpDTO } from "@/lib/types";

type MeResponse = { member: { id: number } | null };

export default function RoomHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [scores, setScores] = useState<ScoresDTO | null>(null);
  const [tasks, setTasks] = useState<TaskTemplateDTO[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecordDTO[]>([]);
  const [topUps, setTopUps] = useState<TopUpDTO[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(100);
  const [showTopUp, setShowTopUp] = useState(false);
  const [coinAnim, setCoinAnim] = useState(false);
  const [settlementInput, setSettlementInput] = useState("");

  async function load() {
    try {
      const [roomData, scoreData, taskData, settlementData, topUpData, me] = await Promise.all([
        apiFetch<{ room: RoomDTO }>(`/api/rooms/${roomId}`),
        apiFetch<ScoresDTO>(`/api/rooms/${roomId}/scores`),
        apiFetch<{ tasks: TaskTemplateDTO[] }>(`/api/rooms/${roomId}/tasks`),
        apiFetch<{ settlements: SettlementRecordDTO[] }>(`/api/rooms/${roomId}/settlements`),
        apiFetch<{ topUps: TopUpDTO[] }>(`/api/rooms/${roomId}/topup`),
        apiFetch<MeResponse>("/api/auth/me"),
      ]);
      setRoom(roomData.room);
      setScores(scoreData);
      setTasks(taskData.tasks.filter((t) => t.status === "active").slice(0, 5));
      setSettlements(settlementData.settlements);
      setTopUps(topUpData.topUps);
      setMyId(me.member?.id ?? null);
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

  async function handleDeleteTopUp(topUpId: number) {
    if (!confirm("確定要撤銷這筆加碼嗎？")) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/topup`, {
        method: "DELETE",
        body: JSON.stringify({ topUpId }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "撤銷失敗");
    }
  }

  async function handleRequestSettlementDateChange() {
    if (!settlementInput) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/settlement-date`, {
        method: "POST",
        body: JSON.stringify({ settlementDate: new Date(settlementInput).toISOString() }),
      });
      setSettlementInput("");
      alert("已送出結算日變更請求，需對方同意後才會生效");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "送出失敗");
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

        {topUps.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-slate-400">本期加碼紀錄</div>
            {topUps.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  {t.addedByNickname} +{t.amount} 元
                </span>
                {t.addedById === myId && (
                  <button
                    onClick={() => handleDeleteTopUp(t.id)}
                    className="text-xs text-red-500 underline hover:text-red-700"
                  >
                    打錯了，撤銷
                  </button>
                )}
              </div>
            ))}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">結算</h2>
        <p className="text-sm text-slate-600">
          下次結算：{room.settlementDate ? new Date(room.settlementDate).toLocaleString() : "尚未設定"}
        </p>
        <p className="mt-1 text-xs text-slate-400">變更結算日需要對方同意，送出後請到審核中心等待回覆。</p>
        <div className="mt-2 flex gap-2">
          <input
            type="datetime-local"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={settlementInput}
            onChange={(e) => setSettlementInput(e.target.value)}
          />
          <button
            onClick={handleRequestSettlementDateChange}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
          >
            提出變更
          </button>
        </div>

        {settlements.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-slate-400">歷史結算紀錄</div>
            {settlements.map((s) => (
              <div key={s.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="text-slate-500">
                  {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                </div>
                {scores.members.map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span style={{ color: m.color }}>{m.displayNickname}</span>
                    <span>
                      {s.memberScores[m.id] ?? 0} 點 · {s.moneyDistribution[m.id] ?? 0} 元
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
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
