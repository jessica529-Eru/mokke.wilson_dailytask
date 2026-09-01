"use client";

import { useState } from "react";
import type { TaskTemplateDTO } from "@/lib/types";

export type UnlockCondition = { unlockConditionType: string; unlockConditionValue: Record<string, unknown> };

type ConditionType = "none" | "single_task" | "multi_task_threshold" | "streak_days";

type PickerState = {
  conditionType: ConditionType;
  singleTaskId: number | "";
  multiTaskIds: number[];
  threshold: number;
  streakDays: number;
};

const INITIAL_STATE: PickerState = {
  conditionType: "none",
  singleTaskId: "",
  multiTaskIds: [],
  threshold: 3,
  streakDays: 7,
};

function computeCondition(state: PickerState): UnlockCondition | undefined {
  if (state.conditionType === "single_task" && state.singleTaskId !== "") {
    return { unlockConditionType: "single_task", unlockConditionValue: { taskId: state.singleTaskId } };
  }
  if (state.conditionType === "multi_task_threshold" && state.multiTaskIds.length > 0) {
    return {
      unlockConditionType: "multi_task_threshold",
      unlockConditionValue: { taskIds: state.multiTaskIds, threshold: state.threshold },
    };
  }
  if (state.conditionType === "streak_days") {
    return { unlockConditionType: "streak_days", unlockConditionValue: { days: state.streakDays } };
  }
  return undefined;
}

// The single_task / multi_task_threshold / streak_days condition picker
// used to unlock something for a specific member — same shape whether
// it's gating a reward (rewards/page.tsx) or a proof-photo stamp
// (tasks/page.tsx). Was duplicated field-for-field in both; this is the
// one definition. Unmount/remount (e.g. toggling the form that renders
// it) resets it back to "none" for free, since all state lives here.
export function ConditionPicker({
  tasks,
  onChange,
  noneLabel = "不設定（手動指派）",
}: {
  tasks: TaskTemplateDTO[];
  onChange: (condition: UnlockCondition | undefined) => void;
  noneLabel?: string;
}) {
  const [state, setState] = useState<PickerState>(INITIAL_STATE);

  function update(patch: Partial<PickerState>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(computeCondition(next));
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      <select
        className="rounded-lg border border-slate-300 px-2 py-1"
        value={state.conditionType}
        onChange={(e) => update({ conditionType: e.target.value as ConditionType })}
      >
        <option value="none">{noneLabel}</option>
        <option value="single_task">完成指定任務一次</option>
        <option value="multi_task_threshold">完成多個任務達門檻次數</option>
        <option value="streak_days">連續天數達標</option>
      </select>

      {state.conditionType === "single_task" && (
        <select
          className="w-full rounded-lg border border-slate-300 px-2 py-1"
          value={state.singleTaskId}
          onChange={(e) => update({ singleTaskId: Number(e.target.value) })}
        >
          <option value="">選擇任務</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      {state.conditionType === "multi_task_threshold" && (
        <div className="space-y-1">
          {tasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.multiTaskIds.includes(t.id)}
                onChange={(e) =>
                  update({
                    multiTaskIds: e.target.checked
                      ? [...state.multiTaskIds, t.id]
                      : state.multiTaskIds.filter((id) => id !== t.id),
                  })
                }
              />
              {t.title}
            </label>
          ))}
          <label className="flex items-center gap-2">
            門檻次數
            <input
              type="number"
              min={1}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
              value={state.threshold}
              onChange={(e) => update({ threshold: Number(e.target.value) })}
            />
          </label>
          <p className="text-xs text-slate-400">
            以上任務加總完成次數達到此數字即可解鎖，不用每項都做、也不用同一項做這麼多次——例如勾 4
            項、門檻設 3，完成其中任意 3 次（可以是不同任務）就會解鎖。
          </p>
        </div>
      )}

      {state.conditionType === "streak_days" && (
        <label className="flex items-center gap-2">
          連續天數
          <input
            type="number"
            min={1}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1"
            value={state.streakDays}
            onChange={(e) => update({ streakDays: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}
