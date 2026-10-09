"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFile, registerFile } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import type { PageFile } from "@/lib/types";

const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with the bucket limit

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FilesManager({ creatorId, pageId, files }: { creatorId: string; pageId: string; files: PageFile[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(null);
    const supabase = createClient();

    for (const file of selected) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 50 MB`);
        continue;
      }
      setUploading(file.name);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${creatorId}/${pageId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("product-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        setError(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const result = await registerFile({ pageId, path, name: file.name, size: file.size, type: file.type || null });
      if (result?.error) setError(`${file.name}: ${result.error}`);
    }
    setUploading(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl bg-surface-soft text-[14px]">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0 break-all">{f.file_name} <span className="num text-[12px] text-muted">{formatSize(f.size_bytes)}</span></span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => startDelete(() => deleteFile(f.id, pageId))}
                className="link shrink-0 text-[14px]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-hairline p-6 text-center text-[14px] font-medium text-body transition hover:border-primary hover:text-primary">
        {uploading ? `Uploading ${uploading}` : "Click to upload files (50 MB each)"}
        <input type="file" multiple onChange={onChange} disabled={!!uploading} className="hidden" />
      </label>
      {error && <p className="text-[14px] text-down">{error}</p>}
    </div>
  );
}
