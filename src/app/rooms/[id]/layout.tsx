import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

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

  const me = await db.roomMember.findUnique({ where: { id: session.roomMemberId } });

  const isDraft = room.status === "draft";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{room.roomName}</span>
            {me && (
              <span
                className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{ borderColor: me.color, color: me.color, backgroundColor: `${me.color}1a` }}
                title="這是你目前登入的身分"
              >
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: me.color }} />
                )}
                你是 {me.displayNickname}
              </span>
            )}
          </div>
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
          <div className="flex items-center gap-3">
            {!isDraft && <PushNotificationToggle roomId={roomId} />}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
