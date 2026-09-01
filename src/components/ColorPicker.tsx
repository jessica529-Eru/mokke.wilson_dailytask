"use client";

import { MEMBER_COLOR_PALETTE } from "@/lib/colors";

export function ColorPicker({
  value,
  onChange,
  disabledColors = [],
}: {
  value: string;
  onChange: (color: string) => void;
  disabledColors?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBER_COLOR_PALETTE.map((c) => {
        const disabled = disabledColors.includes(c.value);
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            title={disabled ? `${c.label}（已被對方選用）` : c.label}
            disabled={disabled}
            onClick={() => onChange(c.value)}
            className={`h-9 w-9 rounded-full border-2 transition ${
              selected ? "border-slate-900 scale-110" : "border-transparent"
            } ${disabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:scale-105"}`}
            style={{ backgroundColor: c.value }}
          />
        );
      })}
    </div>
  );
}
