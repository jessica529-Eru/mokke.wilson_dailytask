import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[id]/draft">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    await requireRoomMember(roomId);

    const drafts = await db.roomCreationDraft.findMany({
      where: { roomId },
      orderBy: { version: "asc" },
      include: { proposedBy: true },
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        version: d.version,
        proposedById: d.proposedById,
        proposedByNickname: d.proposedBy.displayNickname,
        content: JSON.parse(d.contentSnapshot),
        itemComments: d.itemComments ? JSON.parse(d.itemComments) : null,
        status: d.status,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
