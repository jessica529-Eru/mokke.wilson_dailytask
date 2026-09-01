"use client";

import { useEffect, useState, use as usePromise } from "react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { CalendarDayDTO, CalendarDTO, MemberDTO } from "@/lib/types";

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" })
    .format(new Date())
    .replace("/", "-");
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const roomId = Number(id);

  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [viewMemberId, setViewMemberId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [calendar, setCalendar] = useState<CalendarDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDayDTO | null>(null);

  async function loadMembers() {
    try {
      const [roomData, me] = await Promise.all([
        apiFetch<{ members: MemberDTO[] }>(`/api/rooms/${roomId}`),
        apiFetch<{ member: { id: number } | null }>("/api/auth/me"),
      ]);
      setMembers(roomData.members);
      setMyId(me.member?.id ?? null);
      setViewMemberId(me.member?.id ?? roomData.members[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function loadCalendar() {
    if (viewMemberId === null) return;
    try {
      const data = await apiFetch<CalendarDTO>(
        `/api/rooms/${roomId}/calendar?month=${month}&memberId=${viewMemberId}`
      );
      setCalendar(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "載入失敗");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, month, viewMemberId]);

  const dayByDate = new Map((calendar?.days ?? []).map((d) => [d.date, d]));
  const total = viewMemberId ? daysInMonth(month) : 0;
  const nameById = new Map(members.map((m) => [m.id, m.displayNickname]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">月曆回顧</h1>
        <div className="flex items-center gap-2 text-sm">
          <select
            className="rounded-lg border border-slate-300 px-2 py-1"
            value={viewMemberId ?? ""}
            onChange={(e) => setViewMemberId(Number(e.target.value))}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayNickname}
                {m.id === myId ? "（我）" : ""}
              </option>
            ))}
          </select>
          <input
            type="month"
            className="rounded-lg border border-slate-300 px-2 py-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const dayNum = i + 1;
          const dateStr = `${month}-${String(dayNum).padStart(2, "0")}`;
          const day = dayByDate.get(dateStr);
          return (
            <div
              key={dateStr}
              onClick={() => day?.producedStamp && setSelectedDay(day)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-1 ${
                day?.producedStamp ? "cursor-pointer hover:border-slate-400" : ""
              }`}
            >
              <span className="absolute left-1 top-1 text-[10px] text-slate-400">{dayNum}</span>
              {day?.producedStamp ? (
                <StampFrame stamp={day.producedStamp} />
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  {day?.stamps.slice(0, 4).map((s, i2) => (
                    <span key={i2} title={s.title} className="h-5 w-5">
                      {s.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.icon[s.icon.length - 1]} alt={s.title} className="h-full w-full" />
                      ) : (
                        <span className="block h-full w-full rounded-full bg-amber-400" />
                      )}
                    </span>
                  ))}
                </div>
              )}
              {day && day.stamps.length > 0 && day.producedStamp && (
                <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                  {day.stamps.slice(0, 3).map((s, i2) => (
                    <span key={i2} title={s.title} className="h-3.5 w-3.5">
                      {s.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.icon[s.icon.length - 1]} alt={s.title} className="h-full w-full" />
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        {viewMemberId !== myId && "鎖住的郵票代表對方尚未解鎖，只有本人與已解鎖者能看到完整內容。"}
        {viewMemberId !== myId && nameById.get(viewMemberId ?? -1)}
      </p>

      {selectedDay?.producedStamp && (
        <StampDetailModal
          stamp={selectedDay.producedStamp}
          isOwner={viewMemberId === myId}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

function StampDetailModal({
  stamp,
  isOwner,
  onClose,
}: {
  stamp: NonNullable<CalendarDayDTO["producedStamp"]>;
  isOwner: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-bold">{stamp.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {!stamp.unlocked ? (
          <p className="text-sm text-slate-500">🔒 你還沒達成解鎖條件，完成對方指定的任務後就能看到內容。</p>
        ) : (
          <div className="space-y-3">
            {stamp.contentText && <p className="whitespace-pre-wrap text-sm text-slate-700">{stamp.contentText}</p>}
            {stamp.contentImageUrls && stamp.contentImageUrls.length > 0 && (
              <div className="space-y-2">
                {stamp.contentImageUrls.map((url, i) => (
                  // Full, uncropped image — object-cover in a fixed-ratio
                  // box was cutting off parts of the photo, which is
                  // exactly what "open and see the whole thing" shouldn't do.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="w-full rounded-lg object-contain" />
                ))}
              </div>
            )}
            {!stamp.contentText && (!stamp.contentImageUrls || stamp.contentImageUrls.length === 0) && (
              <p className="text-sm text-slate-400">這則完成紀錄沒有留下文字或照片。</p>
            )}
          </div>
        )}

        {isOwner && stamp.unlocked && (
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {stamp.hasUnlockCondition
              ? "對方需要達成你設定的解鎖條件才能看到這則內容。"
              : "沒有設定解鎖條件，對方永遠看不到這則內容。"}
          </div>
        )}
      </div>
    </div>
  );
}

function StampFrame({
  stamp,
}: {
  stamp: { title: string; unlocked: boolean; contentText: string | null; contentImageUrls: string[] | null };
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/stamp-frames/default.svg"
        alt=""
        className={`h-full w-full object-contain ${stamp.unlocked ? "" : "opacity-50 grayscale"}`}
      />
      {!stamp.unlocked && (
        <span className="absolute inset-0 flex items-center justify-center text-lg">🔒</span>
      )}
      {stamp.unlocked && stamp.contentImageUrls?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stamp.contentImageUrls[0]}
          alt={stamp.title}
          className="absolute inset-[15%] h-[70%] w-[70%] rounded object-cover"
        />
      )}
    </div>
  );
}
