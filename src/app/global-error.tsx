"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report";

/** Last resort when even the page frame fails: plain HTML, no app styles or components. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, "render"); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f1f4ee", color: "#13241b" }}>
        <div role="alert" style={{ maxWidth: 420, margin: "120px auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Oko hit a problem</h1>
          <p style={{ color: "#4a5a50" }}>The team has been told. Anything you saved is safe, including records waiting to send.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#1f5a3d", color: "#fff", fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
