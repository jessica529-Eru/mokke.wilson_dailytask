import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// A plain Route Handler, not public/ static serving — see the comment in
// lib/uploads.ts for why: it needs to see files written after the server
// process started, which Next's static asset resolution does not.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[filename]">) {
  const { filename } = await ctx.params;

  // Reject anything that isn't exactly the flat filename saveUploadedImage
  // generates — blocks path traversal (../, absolute paths, slashes).
  if (!/^[A-Za-z0-9_-]+\.[a-z]+$/.test(filename)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()];
  if (!contentType) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // UPLOAD_DIR (via resolveUploadDir()) depends on an env var — same
  // Turbopack tracing note as lib/uploads.ts's saveUploadedImage.
  const filePath = path.join(/* turbopackIgnore: true */ resolveUploadDir(), filename);
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) throw new Error("not a file");
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
