"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf8f3", color: "#2b2a28", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 500 }}>Something went wrong</h1>
          <p>Please try again shortly.{error.digest ? ` (Reference: ${error.digest})` : ""}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", background: "#2b2a28", color: "#fbf8f3", border: 0 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
