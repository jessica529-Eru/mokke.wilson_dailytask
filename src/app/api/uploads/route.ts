import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { saveUploadedImage, UploadError } from "@/lib/uploads";

// Deliberately unauthenticated: avatar upload happens both before a room
// exists (creator setting one up) and before the joiner has a session, so
// there's no member to require yet. File type/size are strictly validated
// server-side, and this app is invite-code-gated rather than public-facing,
// which keeps the exposure of an open upload endpoint acceptable here.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "缺少檔案");
    }
    const result = await saveUploadedImage(file);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) {
      return handleApiError(new ApiError(400, err.message));
    }
    return handleApiError(err);
  }
}
