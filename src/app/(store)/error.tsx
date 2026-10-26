"use client";

import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      {/* Only a generic message and the opaque digest are shown; details stay in server logs. */}
      <p className="mt-4 text-stone">Please try again in a moment.{error.digest ? ` (Reference: ${error.digest})` : ""}</p>
      <button type="button" onClick={reset} className="mt-8 h-11 bg-charcoal px-5 text-sm text-ivory">
        Try again
      </button>
    </div>
  );
}
