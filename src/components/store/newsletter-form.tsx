"use client";

import { startTransition, useActionState } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/app/(store)/actions";
import { cn } from "@/lib/cn";

export function NewsletterForm({ idPrefix, compact }: { idPrefix: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, null);
  const emailId = `${idPrefix}-newsletter-email`;
  const consentId = `${idPrefix}-newsletter-consent`;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <p role="status" className="mt-4 text-sm text-success">
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // With JavaScript, submit without React's automatic form reset so input is kept on errors.
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className={cn("mt-4 space-y-3", !compact && "mx-auto max-w-md")} noValidate>
      <div className="flex">
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          aria-invalid={errors?.email ? true : undefined}
          aria-describedby={errors?.email ? `${emailId}-error` : undefined}
          className="min-w-0 flex-1 border border-r-0 border-charcoal/40 bg-white px-3 py-2.5 text-sm focus:border-charcoal focus:outline-none"
        />
        <button type="submit" disabled={pending} className="bg-charcoal px-4 text-sm font-medium text-ivory hover:bg-ink disabled:opacity-60">
          {pending ? "…" : "Subscribe"}
        </button>
      </div>
      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor={consentId} className="flex items-start gap-2 text-xs text-stone">
        <input
          id={consentId}
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 accent-charcoal"
          aria-invalid={errors?.consent ? true : undefined}
          aria-describedby={errors?.consent ? `${consentId}-error` : undefined}
        />
        <span>I agree to receive marketing emails and can unsubscribe at any time.</span>
      </label>
      {errors?.email ? (
        <p id={`${emailId}-error`} className="text-sm text-danger">
          {errors.email[0]}
        </p>
      ) : null}
      {errors?.consent ? (
        <p id={`${consentId}-error`} className="text-sm text-danger">
          {errors.consent[0]}
        </p>
      ) : null}
      {state && !state.ok && !errors ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
