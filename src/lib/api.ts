import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message);
  }
  if (err instanceof ZodError) {
    return jsonError(400, err.issues.map((i) => i.message).join("; "));
  }
  console.error(err);
  return jsonError(500, "Internal server error");
}
