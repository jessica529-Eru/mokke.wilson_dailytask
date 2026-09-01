"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/uploadClient";
import { ApiClientError } from "@/lib/apiClient";

// Section 2.3: avatar is self-uploaded then cropped to a circle client-side
// for preview (the server keeps the original — cropping to a perfect circle
// on the backend adds an image-processing dependency this app doesn't
// otherwise need; the CSS rounding here is visually equivalent for a small
// avatar and keeps the upload path simple).
export function ImageUploadField({
  value,
  onChange,
  label = "大頭貼（選填）",
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-slate-600">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="大頭貼預覽" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">無</span>
          )}
        </div>
        <div className="space-y-1">
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="text-sm" />
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="block text-xs text-slate-400 underline"
            >
              移除
            </button>
          )}
        </div>
      </div>
      {uploading && <p className="mt-1 text-xs text-slate-400">上傳中…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
