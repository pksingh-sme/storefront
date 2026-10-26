"use client";

import { useId, useState } from "react";
import { finalizeMediaUploadAction, requestMediaUploadAction } from "@/app/admin/actions";
import { ALLOWED_IMAGE_TYPES } from "@/lib/validation/upload";
import { precheckImage, sendToStorage } from "./upload";

/**
 * Single-image upload for logos, banners and categories. Uploads immediately and puts
 * the new asset id in a hidden field; the surrounding form saves it.
 */
export function MediaPicker({
  label,
  name,
  currentUrl,
  maxUploadMb,
  removeName,
}: {
  label: string;
  name: string;
  currentUrl: string | null;
  maxUploadMb: number;
  removeName?: string;
}) {
  const id = useId();
  const [assetId, setAssetId] = useState("");
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-start gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden border border-line bg-cream text-xs text-stone">
          {preview && !removed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            "No image"
          )}
        </div>
        <div className="space-y-2 text-sm">
          <label htmlFor={id} className="cursor-pointer underline underline-offset-4">
            {preview ? "Replace image" : "Upload image"}
          </label>
          <input
            id={id}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError(null);
              const problem = precheckImage(file, maxUploadMb);
              if (problem) return setError(problem);
              setPreview(URL.createObjectURL(file));
              setRemoved(false);
              try {
                setStatus("Uploading…");
                const req = await requestMediaUploadAction({ fileName: file.name, contentType: file.type, size: file.size });
                if (!req.ok || !req.data) throw new Error(req.ok ? "Upload failed." : req.error);
                await sendToStorage(req.data.upload, file);
                setStatus("Optimising…");
                const fin = await finalizeMediaUploadAction(req.data.assetId);
                if (!fin.ok || !fin.data) throw new Error(fin.ok ? "Upload failed." : fin.error);
                setAssetId(fin.data.id);
                setPreview(fin.data.url);
                setStatus("Uploaded — remember to save.");
              } catch (err) {
                setStatus(null);
                setPreview(currentUrl);
                setError(err instanceof Error ? err.message : "Upload failed.");
              }
            }}
          />
          {removeName && currentUrl && !assetId ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" name={removeName} checked={removed} onChange={(e) => setRemoved(e.target.checked)} className="accent-charcoal" />
              Remove image
            </label>
          ) : null}
          {status ? (
            <p role="status" className="text-xs text-stone">
              {status}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <input type="hidden" name={name} value={assetId} />
    </div>
  );
}
