/**
 * Tell Oko's error log about a crash in this browser (POST /api/v1/client-errors).
 * Sends the message, the stack and the page path only: never form contents or the query string.
 * Each distinct error is sent once per page load, and never from local development.
 */
import { ApiError } from "./api";

const sent = new Set<string>();
export const RELEASE = process.env.NEXT_PUBLIC_RELEASE || "dev";

export function reportError(err: unknown, kind: "error" | "unhandledrejection" | "render" = "error") {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  // Network drops and the API's own refusals are not bugs in the app.
  if (err instanceof ApiError || /Failed to fetch|NetworkError|Load failed|ChunkLoadError|Loading chunk/i.test(e.message)) return;
  const key = `${e.name}: ${e.message}`.slice(0, 300);
  if (sent.has(key) || sent.size > 20) return;
  sent.add(key);
  const body = JSON.stringify({ message: key, stack: (e.stack ?? "").slice(0, 8000), path: window.location.pathname, kind, release: RELEASE });
  try {
    // keepalive: still goes out if the page is closing.
    fetch("/api/v1/client-errors", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" }, credentials: "omit" }).catch(() => null);
  } catch { /* never let reporting break the page */ }
}

/** Catch what no component caught: script errors and promises nobody awaited. */
export function watchGlobalErrors(): () => void {
  const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message, "error");
  const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason, "unhandledrejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
}
