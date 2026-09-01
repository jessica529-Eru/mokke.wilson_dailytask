"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { ColorPicker } from "@/components/ColorPicker";
import { MEMBER_COLOR_PALETTE } from "@/lib/colors";
import { TaskDraftListEditor } from "@/components/TaskDraftListEditor";
import { ImageUploadField } from "@/components/ImageUploadField";
import type { DraftContentDTO, IconAssetDTO, TaskDraftItemDTO } from "@/lib/types";

export default function NewRoomPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [initialMoneyPool, setInitialMoneyPool] = useState(1000);
  const [settlementDate, setSettlementDate] = useState("");
  const [password, setPassword] = useState("");
  const [displayNickname, setDisplayNickname] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLOR_PALETTE[0].value);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [dailyTasks, setDailyTasks] = useState<TaskDraftItemDTO[]>([]);
  const [extraTasks, setExtraTasks] = useState<TaskDraftItemDTO[]>([]);
  const [icons, setIcons] = useState<IconAssetDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ assets: IconAssetDTO[] }>("/api/icon-assets")
      .then((data) => setIcons(data.assets))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (dailyTasks.some((t) => !t.title.trim()) || extraTasks.some((t) => !t.title.trim())) {
      setError("每個任務都需要填寫名稱");
      return;
    }
    if (!settlementDate) {
      setError("請設定結算日期");
      return;
    }

    setLoading(true);
    try {
      const content: DraftContentDTO = {
        roomName,
        initialMoneyPool,
        settlementDate: new Date(settlementDate).toISOString(),
        dailyTasks,
        extraTasks,
      };
      const data = await apiFetch<{ room: { id: number } }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ password, displayNickname, color, avatarUrl, content }),
      });
      router.push(`/rooms/${data.room.id}/draft`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "建立失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">建立新房間</h1>
      <p className="mb-8 text-sm text-slate-500">
        設定房間內容後送出，系統會產生邀請碼；對方加入後可以同意或針對單一項目提出修改，直到雙方都同意為止。
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">基本設定</h2>
          <div>
            <label className="mb-1 block text-sm text-slate-600">房間名稱（全域唯一，日常登入使用）</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">初始總金額（雙方各出一半，純記帳）</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={initialMoneyPool}
              onChange={(e) => setInitialMoneyPool(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              結算日期（雙方同意此契約即代表同意此日期，之後要更改需要對方同意）
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              required
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">你的個人設定</h2>
          <div>
            <label className="mb-1 block text-sm text-slate-600">你的暱稱</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={displayNickname}
              onChange={(e) => setDisplayNickname(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">
              密碼（你的識別碼，建立後不可修改）
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">個人識別色</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <ImageUploadField value={avatarUrl} onChange={setAvatarUrl} />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">日常任務</h2>
          <TaskDraftListEditor kind="daily" items={dailyTasks} onChange={setDailyTasks} icons={icons} />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">額外任務</h2>
          <TaskDraftListEditor kind="extra" items={extraTasks} onChange={setExtraTasks} icons={icons} />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "送出中…" : "送出，產生邀請碼"}
        </button>
      </form>
    </main>
  );
}
