export const MEMBER_COLOR_PALETTE = [
  { value: "#ef4444", label: "赤紅" },
  { value: "#f97316", label: "橙" },
  { value: "#f59e0b", label: "琥珀" },
  { value: "#84cc16", label: "萊姆綠" },
  { value: "#10b981", label: "翠綠" },
  { value: "#06b6d4", label: "青藍" },
  { value: "#3b82f6", label: "天藍" },
  { value: "#6366f1", label: "靛紫" },
  { value: "#a855f7", label: "紫" },
  { value: "#ec4899", label: "桃紅" },
] as const;

export function isValidMemberColor(value: string): boolean {
  return MEMBER_COLOR_PALETTE.some((c) => c.value === value);
}
