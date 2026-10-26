"use client";

import { ALLOWED_IMAGE_TYPES } from "@/lib/validation/upload";

export type UploadTarget = { url: string; fields: Record<string, string> };

/** Client-side pre-check; the server validates again (declared type, size and file content). */
export function precheckImage(file: File, maxMb: number): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "Only JPEG, PNG, WebP or AVIF images are allowed.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `Images must be ${maxMb} MB or smaller.`;
  return null;
}

/** Sends the file straight to storage using a short-lived presigned POST (or the local equivalent). */
export async function sendToStorage(target: UploadTarget, file: File) {
  const body = new FormData();
  for (const [k, v] of Object.entries(target.fields)) body.append(k, v);
  body.append("file", file);
  const res = await fetch(target.url, { method: "POST", body, credentials: "same-origin" });
  if (!res.ok) {
    let message = "Upload failed.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // S3 returns XML errors; keep the generic message.
    }
    throw new Error(message);
  }
}
