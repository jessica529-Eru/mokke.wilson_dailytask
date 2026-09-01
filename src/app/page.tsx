import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(`/rooms/${session.roomId}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">任務拉鋸戰</h1>
        <p className="text-slate-500">雙人任務集點競爭 · 卷軸契約 · 月曆蓋章回顧</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/new-room"
          className="rounded-xl bg-slate-900 px-6 py-3 text-center font-medium text-white hover:bg-slate-700"
        >
          建立新房間
        </Link>
        <Link
          href="/join"
          className="rounded-xl border border-slate-300 px-6 py-3 text-center font-medium hover:bg-slate-50"
        >
          使用邀請碼加入
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-slate-300 px-6 py-3 text-center font-medium hover:bg-slate-50"
        >
          登入既有房間
        </Link>
      </div>
    </main>
  );
}
