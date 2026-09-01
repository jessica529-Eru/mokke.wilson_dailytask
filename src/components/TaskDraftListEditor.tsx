"use client";

import { useId } from "react";
import type { IconAssetDTO, TaskDraftItemDTO } from "@/lib/types";
import { StampIconPicker } from "@/components/StampIconPicker";

const ASSIGN_SCOPE_LABELS: Record<TaskDraftItemDTO["assignScope"], string> = {
  self: "自己（房主）",
  partner: "對方（加入者）",
  both: "雙方各自",
};

export function TaskDraftListEditor({
  kind,
  items,
  onChange,
  icons,
}: {
  kind: "daily" | "extra";
  items: TaskDraftItemDTO[];
  onChange: (items: TaskDraftItemDTO[]) => void;
  icons: IconAssetDTO[];
}) {
  const idPrefix = useId();

  function update(index: number, patch: Partial<TaskDraftItemDTO>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...items,
      {
        tempId: `${idPrefix}-${kind}-${Date.now()}-${items.length}`,
        type: kind === "daily" ? "daily" : "extra_normal",
        assignScope: "self",
        title: "",
        requiresProof: false,
        points: 10,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.tempId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="任務名稱，例如：運動 30 分鐘"
              value={item.title}
              onChange={(e) => update(index, { title: e.target.value })}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
            >
              移除
            </button>
          </div>

          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="任務說明（選填）"
            rows={2}
            value={item.description ?? ""}
            onChange={(e) => update(index, { description: e.target.value || undefined })}
          />

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              指派對象
              <select
                className="rounded-lg border border-slate-300 px-2 py-1"
                value={item.assignScope}
                onChange={(e) => update(index, { assignScope: e.target.value as TaskDraftItemDTO["assignScope"] })}
              >
                {(Object.keys(ASSIGN_SCOPE_LABELS) as TaskDraftItemDTO["assignScope"][]).map((s) => (
                  <option key={s} value={s}>
                    {ASSIGN_SCOPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            {kind === "extra" && (
              <label className="flex items-center gap-2">
                類型
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={item.type}
                  onChange={(e) => update(index, { type: e.target.value as TaskDraftItemDTO["type"] })}
                >
                  <option value="extra_normal">單次額外任務</option>
                  <option value="extra_quota">額度任務</option>
                </select>
              </label>
            )}

            <label className="flex items-center gap-2">
              點數
              <input
                type="number"
                min={0}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                value={item.points ?? 0}
                onChange={(e) => update(index, { points: Number(e.target.value) })}
              />
            </label>

            {item.type === "extra_quota" && (
              <label className="flex items-center gap-2">
                額度上限
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                  value={item.quotaTotal ?? 1}
                  onChange={(e) => update(index, { quotaTotal: Number(e.target.value) })}
                />
              </label>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.requiresProof}
                onChange={(e) => update(index, { requiresProof: e.target.checked })}
              />
              需上傳照片/文字證明（產生郵票）
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              驚喜任務觸發機率
              <input
                type="number"
                min={0}
                max={100}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                value={item.triggerProbability ? Math.round(item.triggerProbability * 100) : 0}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  update(index, {
                    triggerProbability: pct > 0 ? pct / 100 : undefined,
                    triggerTargetType: pct > 0 ? item.triggerTargetType ?? "random_from_existing" : undefined,
                  });
                }}
              />
              %
            </label>
            {item.triggerProbability ? (
              <label className="flex items-center gap-2">
                觸發內容
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1"
                  value={item.triggerTargetType}
                  onChange={(e) =>
                    update(index, { triggerTargetType: e.target.value as TaskDraftItemDTO["triggerTargetType"] })
                  }
                >
                  <option value="random_from_existing">隨機挑一個現有任務</option>
                </select>
              </label>
            ) : null}
          </div>

          <div>
            <div className="mb-1 text-xs text-slate-500">印章圖示</div>
            <StampIconPicker
              assets={icons}
              value={item.stampIconAssetId}
              onChange={(id) => update(index, { stampIconAssetId: id })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        + 新增{kind === "daily" ? "日常" : "額外"}任務
      </button>
    </div>
  );
}
