"use client";

import type { ScoreMemberDTO } from "@/lib/types";

export function TugOfWar({ members }: { members: ScoreMemberDTO[] }) {
  const [a, b] = members;
  if (!a || !b) return null;

  const aPct = Math.round(a.ratio * 100);
  const bPct = 100 - aPct;

  return (
    <div className="space-y-3">
      <div className="flex h-28 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div
          className="tug-of-war-bar flex items-center justify-start pl-4 text-white"
          style={{ flexBasis: `${Math.max(aPct, 8)}%`, backgroundColor: a.color }}
        >
          <MemberBadge member={a} />
        </div>
        <div
          className="tug-of-war-bar flex items-center justify-end pr-4 text-white"
          style={{ flexBasis: `${Math.max(bPct, 8)}%`, backgroundColor: b.color }}
        >
          <MemberBadge member={b} align="right" />
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{a.score} 點（{aPct}%）</span>
        <span>{b.score} 點（{bPct}%）</span>
      </div>
    </div>
  );
}

function MemberBadge({ member, align = "left" }: { member: ScoreMemberDTO; align?: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20 text-sm font-bold">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          member.displayNickname.slice(0, 1)
        )}
      </div>
      <span className="text-sm font-semibold drop-shadow">{member.displayNickname}</span>
    </div>
  );
}
