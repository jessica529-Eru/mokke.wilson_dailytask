import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { nanoid } from "nanoid";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export class UploadError extends Error {}

/**
 * Local filesystem storage under public/uploads — section 12 names this as
 * an acceptable option ("本地/雲端儲存") alongside S3-compatible services.
 * This app has no cloud storage credentials configured, so local disk is
 * the pragmatic default; swapping in an S3-compatible client later only
 * means changing this one function.
 */
export async function saveUploadedImage(file: File): Promise<{ url: string }> {
  const extension = ALLOWED_MIME_TYPES[file.type];
  if (!extension) {
    throw new UploadError("只接受 JPEG / PNG / WebP / GIF 圖片");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("檔案大小不能超過 5MB");
  }

  const filename = `${nanoid(16)}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  return { url: `/uploads/${filename}` };
}
