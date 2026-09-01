import { ApiClientError } from "@/lib/apiClient";

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(body.error ?? `上傳失敗 (${res.status})`);
  }
  return body.url as string;
}
