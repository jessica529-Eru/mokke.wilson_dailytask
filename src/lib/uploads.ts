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

// Deliberately NOT under public/: Next's production server (`next start`)
// resolves public/ static assets once at boot and does not re-scan the
// directory per request, so a file written after the server started 404s
// until the next restart (confirmed by testing — a plain file dropped into
// public/ mid-run 404s even though it's on disk). Storing outside public/
// and serving through src/app/uploads/[filename]/route.ts (a normal
// dynamic route handler, always live) sidesteps that entirely, in both
// dev and prod. UPLOAD_DIR lets a production deployment point this at a
// persistent volume (see docs/deploy-railway.md); defaults to a top-level
// `uploads/` folder for local dev.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export function resolveUploadDir() {
  return UPLOAD_DIR;
}

/**
 * Local filesystem storage — section 12 names this as an acceptable option
 * ("本地/雲端儲存") alongside S3-compatible services. This app has no cloud
 * storage credentials configured, so local disk is the pragmatic default;
 * swapping in an S3-compatible client later only means changing this one
 * function (and the GET route that serves uploads/[filename]).
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
  // UPLOAD_DIR's value depends on an env var, so Turbopack can't statically
  // scope this filesystem access — ignoring its trace-the-whole-project
  // fallback is correct here since this is a full (non-standalone) build.
  // The ignore comment must sit inside the call whose argument is dynamic,
  // not in front of the whole expression, or Turbopack doesn't pick it up.
  await mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, filename), buffer);

  return { url: `/uploads/${filename}` };
}
