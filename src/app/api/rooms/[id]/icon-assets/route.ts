import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/icon-assets">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const assets = await db.iconAsset.findMany({
      where: { category: "stamp", OR: [{ roomId: null }, { roomId }] },
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
