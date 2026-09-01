"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/uploadClient";
import { ApiClientError } from "@/lib/apiClient";

const MAX_IMAGES = 4;

export function MultiImageUploadField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    const room = MAX_IMAGES - value.length;
    if (room <= 0) {
      setError(`最多上傳 ${MAX_IMAGES} 張照片`);
      return;
    }

    setUploading(true);
    try {
      const urls = await Promise.all(files.slice(0, room).map(uploadImage));
      onChange([...value, ...urls]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl bg-black/60 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
            {uploading ? "上傳中…" : "+ 照片"}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
