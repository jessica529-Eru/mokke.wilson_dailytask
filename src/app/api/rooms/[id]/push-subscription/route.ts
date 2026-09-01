import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRoomMember } from "@/lib/currentMember";
import { handleApiError } from "@/lib/api";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/push-subscription">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = subscriptionSchema.parse(await req.json());

    await db.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { roomMemberId: member.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
      create: {
        roomMemberId: member.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/rooms/[id]/push-subscription">) {
  try {
    const { id } = await ctx.params;
    const roomId = Number(id);
    const member = await requireRoomMember(roomId);
    const body = unsubscribeSchema.parse(await req.json());

    await db.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, roomMemberId: member.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
