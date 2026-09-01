import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";

// Global default stamp library (section 8), usable before a room exists yet
// (e.g. while drafting the initial task list). No per-request dynamic APIs
// are used here, so force dynamic rendering to avoid Next prerendering this
// against the database at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = await db.iconAsset.findMany({
      where: { category: "stamp", roomId: null },
      orderBy: { id: "asc" },
    });
    return NextResponse.json({
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        frames: JSON.parse(a.frameImageUrls) as string[],
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
