"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { ColorPicker } from "@/components/ColorPicker";
import { MEMBER_COLOR_PALETTE } from "@/lib/colors";
import { ImageUploadField } from "@/components/ImageUploadField";

export default function JoinPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [displayNickname, setDisplayNickname] = useState("");
  const [color, setColor] = useState<string>(MEMBER_COLOR_PALETTE[3].value);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ room: { id: number } }>("/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode, password, displayNickname, color, avatarUrl }),
      });
      router.push(`/rooms/${data.room.id}/draft`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "加入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="mb-2 text-2xl font-bold">加入房間</h1>
      <p className="mb-6 text-sm text-slate-500">輸入對方給你的邀請碼，並設定你在房間內的個人資料。</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-600">邀請碼</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </div>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "加入中…" : "加入房間"}
        </button>
      </form>
    </main>
  );
}
