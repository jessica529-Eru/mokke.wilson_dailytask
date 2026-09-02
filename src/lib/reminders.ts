import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { localDateInTimezone } from "@/lib/taskLifecycle";

const REMINDER_HOUR = 18; // "傍晚" — 6pm local time in the room's own timezone

// Lazily triggered (same "no cron in this deployment" pattern as
// runSettlementIfDue — see settlement.ts) from any dashboard visit: once
// it's evening in the room's timezone, ping whichever member(s) still have
// an incomplete required daily task today. Piggybacking on a request from
// either member (not just the one being reminded) is what makes this an
// actual proactive nudge rather than something only visible after they've
// already opened the app.
export async function checkDailyReminders(roomId: number) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room || room.status !== "active") return;

  const localHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: room.settlementTimezone, hour: "numeric", hour12: false }).format(
      new Date()
    )
  );
  if (localHour < REMINDER_HOUR) return;

  const today = localDateInTimezone(room.settlementTimezone);

  const dailyTasks = await db.taskTemplate.findMany({
    where: { roomId, type: "daily", status: "active" },
  });
  if (dailyTasks.length === 0) return;

  const members = await db.roomMember.findMany({ where: { roomId } });

  for (const member of members) {
    const myTasks = dailyTasks.filter((t) => t.assignScope === "both" || t.assignedToId === member.id);
    if (myTasks.length === 0) continue;

    const completions = await db.taskCompletion.findMany({
      where: {
        roomMemberId: member.id,
        completedLocalDate: today,
        taskTemplateId: { in: myTasks.map((t) => t.id) },
      },
      select: { taskTemplateId: true },
    });
    const doneIds = new Set(completions.map((c) => c.taskTemplateId));
    if (myTasks.every((t) => doneIds.has(t.id))) continue;

    // At most one reminder per member per local day — checked against the
    // existing Notification log rather than a new table.
    const lastReminder = await db.notification.findFirst({
      where: { roomId, roomMemberId: member.id, type: "daily_task_reminder" },
      orderBy: { createdAt: "desc" },
    });
    if (lastReminder && localDateInTimezone(room.settlementTimezone, lastReminder.createdAt) === today) continue;

    await notify({ roomId, roomMemberId: member.id, type: "daily_task_reminder" });
  }
}
