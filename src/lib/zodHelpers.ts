import { z } from "zod";

// Accepts both a full URL (external image host) and a same-origin relative
// path like "/uploads/abc123.png" (what POST /api/uploads returns) — plain
// z.string().url() rejects the latter.
export const imageUrlSchema = z
  .string()
  .min(1)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "圖片網址格式錯誤",
  });
