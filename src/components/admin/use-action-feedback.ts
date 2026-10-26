"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState, useTransition } from "react";

type Result = { ok: boolean; error?: string; message?: string };

/** Runs an admin action, shows its message and refreshes server data on success. */
export function useActionRunner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, onSuccess?: () => void) =>
    start(async () => {
      setFeedback(null);
      const r = await fn();
      if (r.ok) {
        if (r.message) setFeedback({ tone: "success", text: r.message });
        onSuccess?.();
        router.refresh();
      } else {
        setFeedback({ tone: "error", text: r.error ?? "Something went wrong." });
      }
    });
  return { pending, feedback, setFeedback, run };
}

/**
 * Submits a form to a `useActionState` dispatcher without React's automatic form reset,
 * so the admin's input is kept when validation fails.
 */
export function keepValuesOnSubmit(dispatch: (formData: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
