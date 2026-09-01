import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { saveUploadedImage, UploadError } from "@/lib/uploads";

// Deliberately unauthenticated: avatar upload happens both before a room
// exists (creator setting one up) and before the joiner has a session, so
// there's no member to require yet. File type/size are strictly validated
// server-side, and this app is invite-code-gated rather than public-facing,
// which keeps the exposure of an open upload endpoint acceptable here.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    // A failure here (truncated upload on a flaky mobile connection,
    // malformed multipart body) was falling into the generic 500 path
    // with no distinguishing detail — this is a different failure mode
    // from a storage/fs problem, so log and message it separately.
    console.error("[uploads] failed to parse multipart form data:", err);
    return handleApiError(new ApiError(400, "上傳中斷，請重新選擇檔案再試一次"));
  }

  try {
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
