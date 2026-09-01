"use client";

import type { RewardDTO } from "@/lib/types";

// The "pick an existing reward from the library, or none" dropdown —
// same option list and empty-value handling was duplicated between the
// task-creation form's 綁定獎勵庫 field and the quota-reward-change
// form's 同時解鎖獎勵 field.
export function RewardSelect({
  rewards,
  value,
  onChange,
  noneLabel = "不指定",
}: {
  rewards: RewardDTO[];
  value: number | "";
  onChange: (value: number | "") => void;
  noneLabel?: string;
}) {
  return (
    <select
      className="rounded-lg border border-slate-300 px-2 py-1"
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    >
      <option value="">{noneLabel}</option>
      {rewards.map((r) => (
        <option key={r.id} value={r.id}>
          {r.title}
        </option>
      ))}
    </select>
  );
}
