import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";

export default async function RoomLayout({
  children,
  params,
}: LayoutProps<"/rooms/[id]">) {
  const { id } = await params;
  const roomId = Number(id);

  const session = await getSession();
  if (!session || session.roomId !== roomId) {
    redirect("/login");
  }

  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) {
    redirect("/login");
  }

  const isDraft = room.status === "draft";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-semibold">{room.roomName}</span>
          {!isDraft && (
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href={`/rooms/${roomId}`} className="hover:text-slate-900">
                首頁
              </Link>
              <Link href={`/rooms/${roomId}/tasks`} className="hover:text-slate-900">
                任務
              </Link>
              <Link href={`/rooms/${roomId}/calendar`} className="hover:text-slate-900">
                月曆
              </Link>
              <Link href={`/rooms/${roomId}/rewards`} className="hover:text-slate-900">
                獎勵庫
              </Link>
              <Link href={`/rooms/${roomId}/approvals`} className="hover:text-slate-900">
                審核中心
              </Link>
              <Link href={`/rooms/${roomId}/notifications`} className="hover:text-slate-900">
                通知
              </Link>
            </nav>
          )}
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
