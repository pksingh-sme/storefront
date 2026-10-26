"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "@/app/(store)/actions";

export function CheckoutButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<CheckoutState>(startCheckout, null);
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-12 w-full bg-charcoal text-sm font-medium tracking-[0.12em] text-ivory uppercase hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Redirecting to secure payment…" : "Checkout"}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
