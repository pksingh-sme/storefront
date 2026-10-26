"use client";

import { deleteBannerAction } from "@/app/admin/actions";
import { useActionRunner } from "./use-action-feedback";

export function BannerDeleteButton({ bannerId, title }: { bannerId: string; title: string }) {
  const { pending, feedback, run } = useActionRunner();
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        className="text-sm text-danger underline underline-offset-4"
        onClick={() => confirm(`Delete banner "${title}"?`) && run(() => deleteBannerAction(bannerId))}
      >
        Delete<span className="sr-only"> {title}</span>
      </button>
      {feedback?.tone === "error" ? <span className="ml-2 text-sm text-danger">{feedback.text}</span> : null}
    </span>
  );
}
