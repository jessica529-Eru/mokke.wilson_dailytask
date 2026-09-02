"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { StatsDTO, SettlementRecordDTO, MemberDTO } from "@/lib/types";

export default function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [settlements, setSettlements] = useState<SettlementRecordDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [statsData, settlementData, roomData] = await Promise.all([
        apiFetch<StatsDTO>(`/api/rooms/${roomId}/stats`),
        apiFetch<{ settlements: SettlementRecordDTO[] }>(`/api/rooms/${roomId}/settlements`),
        apiFetch<{ members: MemberDTO[] }>(`/api/rooms/${roomId}`),
      ]);
      setStats(statsData);
      setSettlements(settlementData.settlements);
      setMembers(roomData.members);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-slate-500">載入中…</p>;

  // Periods where each member's score in the same settlement was strictly
  // higher — a tie (equal scores) counts toward neither.
  const periodsWon = new Map<number, number>();
  for (const s of settlements) {
    const entries = Object.entries(s.memberScores).map(([mid, score]) => [Number(mid), score] as const);
    if (entries.length === 0) continue;
    const maxScore = Math.max(...entries.map(([, score]) => score));
    for (const [mid, score] of entries) {
      if (score === maxScore && maxScore > 0) {
        periodsWon.set(mid, (periodsWon.get(mid) ?? 0) + 1);
      }
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">統計</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">本週日常任務完成率</h2>
        <p className="mb-4 text-xs text-slate-400">
          以目前有效的每日任務為基準，估算最近 {stats.windowDays} 天的完成情況
        </p>
        <div className="space-y-4">
          {stats.weeklyCompletion.map((w) => (
            <div key={w.roomMemberId}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium" style={{ color: w.color }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
                  {w.displayNickname}
                </span>
                <span className="text-slate-500">
                  {w.completedCount}/{w.dueCount}（{Math.round(w.rate * 100)}%）
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(w.rate * 100))}%`, backgroundColor: w.color }}
                />
              </div>
            </div>
          ))}
          {stats.weeklyCompletion.every((w) => w.dueCount === 0) && (
            <p className="text-sm text-slate-400">目前沒有進行中的日常任務</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">歷史結算對比</h2>
        {settlements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">還沒有已結算的期別</p>
        ) : (
          <>
            <div className="mt-3 flex gap-6 text-sm">
              {members.map((m) => (
                <div key={m.id}>
                  <span style={{ color: m.color }} className="font-medium">
                    {m.displayNickname}
                  </span>
                  <span className="ml-1 text-slate-500">贏了 {periodsWon.get(m.id) ?? 0} 期</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {settlements.map((s) => {
                const entries = Object.entries(s.memberScores).map(([mid, score]) => [Number(mid), score] as const);
                const maxScore = entries.length > 0 ? Math.max(...entries.map(([, score]) => score)) : 0;
                return (
                  <div key={s.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="text-slate-500">
                      {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                    </div>
                    {members.map((m) => {
                      const score = s.memberScores[m.id] ?? 0;
                      const isWinner = maxScore > 0 && score === maxScore;
                      return (
                        <div key={m.id} className="flex justify-between">
                          <span style={{ color: m.color }}>
                            {m.displayNickname}
                            {isWinner && " 🏆"}
                          </span>
                          <span>{score} 點</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
