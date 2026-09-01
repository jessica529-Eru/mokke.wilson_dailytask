"use client";

import type { IconAssetDTO } from "@/lib/types";

export function StampIconPicker({
  assets,
  value,
  onChange,
}: {
  assets: IconAssetDTO[];
  value?: number;
  onChange: (id: number | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`rounded-lg border px-3 py-2 text-xs ${
          value === undefined ? "border-slate-900 bg-slate-100" : "border-slate-200"
        }`}
      >
        不指定
      </button>
      {assets.map((a) => (
        <button
          key={a.id}
          type="button"
          title={a.name}
          onClick={() => onChange(a.id)}
          className={`flex h-12 w-12 items-center justify-center rounded-lg border ${
            value === a.id ? "border-slate-900 bg-slate-100" : "border-slate-200"
          }`}
        >
          {/* Settled (last) frame — the picker shows the final look, not the in-flight one. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.frames[a.frames.length - 1]} alt={a.name} width={28} height={28} />
        </button>
      ))}
    </div>
  );
}
