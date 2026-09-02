import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";
import { localDateInTimezone } from "@/lib/taskLifecycle";

const WINDOW_DAYS = 7;

// Simple, lightweight trend view (section "簡單統計/趨勢"): a rolling
// 7-day daily-task completion rate per member. "Due" is approximated as
// today's active daily tasks × 7 days — a task created partway through the
// window isn't backed out, same kind of approximation the home page's
// "if we settled right now" preview already makes (section 4).
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/stats">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    const members = await db.roomMember.findMany({ where: { roomId }, orderBy: { joinedAt: "asc" } });
    const dailyTasks = await db.taskTemplate.findMany({ where: { roomId, type: "daily", status: "active" } });

    const today = localDateInTimezone(room.settlementTimezone);
    const days: string[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const completions = dailyTasks.length
      ? await db.taskCompletion.findMany({
          where: { taskTemplateId: { in: dailyTasks.map((t) => t.id) }, completedLocalDate: { in: days } },
          select: { roomMemberId: true, taskTemplateId: true },
        })
      : [];

    const weeklyCompletion = members.map((m) => {
      const myTaskIds = new Set(
        dailyTasks.filter((t) => t.assignScope === "both" || t.assignedToId === m.id).map((t) => t.id)
      );
      const dueCount = myTaskIds.size * days.length;
      const completedCount = completions.filter((c) => c.roomMemberId === m.id && myTaskIds.has(c.taskTemplateId)).length;
      return {
        roomMemberId: m.id,
        displayNickname: m.displayNickname,
        color: m.color,
        completedCount,
        dueCount,
        rate: dueCount > 0 ? completedCount / dueCount : 0,
      };
    });

    return NextResponse.json({ windowDays: WINDOW_DAYS, days, weeklyCompletion });
  } catch (err) {
    return handleApiError(err);
  }
}
