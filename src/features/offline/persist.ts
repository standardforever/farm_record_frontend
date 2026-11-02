/**
 * Keep what the app last loaded (farm map, today's tasks, batches, stock…) on the phone, so screens
 * open with no network. Saved to IndexedDB a moment after data changes; restored before the app draws.
 *
 * Tied to the signed-in person: another account on the same phone never sees it, and sign-out clears it.
 * Admin screens and anything older than two weeks are not kept.
 */
import { type QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { idbDel, idbGet, idbSet } from "@/lib/idb";

const KEY = "queries.v1";
const MAX_AGE = 14 * 24 * 3600 * 1000;
const SKIP = new Set(["admin", "audit"]);
type Saved = { user: string; at: number; state: unknown };

export async function restoreOfflineCache(client: QueryClient, userId: string | null) {
  if (!userId) return;
  const saved = await Promise.race([idbGet<Saved>("cache", KEY), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
  if (saved && saved.user === userId && Date.now() - saved.at < MAX_AGE) {
    try {
      hydrate(client, saved.state);
      // Shown at once, but always checked with the server when a screen opens (if there is network).
      await client.invalidateQueries({ refetchType: "none" });
    } catch { /* an older shape: ignore */ }
  }
}

export function keepOfflineCache(client: QueryClient, getUser: () => string | null) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    const user = getUser();
    if (!user) return;
    const state = dehydrate(client, {
      shouldDehydrateQuery: (q) => q.state.status === "success" && !SKIP.has(String(q.queryKey[0])),
    });
    idbSet("cache", KEY, { user, at: Date.now(), state } satisfies Saved);
  };
  // Save soon after data arrives, and right away when the page is hidden or closed (a phone locks, the app is swapped).
  const now = () => { if (timer) { clearTimeout(timer); write(); } };
  const hidden = () => { if (document.visibilityState === "hidden") now(); };
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", now);
  const stop = client.getQueryCache().subscribe((e) => {
    if (e.type !== "updated" || e.action.type !== "success") return;
    if (!timer) timer = setTimeout(write, 800);
  });
  return () => { stop(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", now); };
}

let restored: Promise<void> | null = null;
let resolveRestored: () => void = () => {};
const restoredSignal = new Promise<void>((r) => { resolveRestored = r; });
/** Providers hands over the restore; sign-in waits on `offlineCacheReady()` before showing screens. */
export function markRestored(p: Promise<void>) { restored = p.catch(() => undefined).finally(resolveRestored); }
export const offlineCacheReady = () => restored ?? restoredSignal;

export const clearOfflineCache = () => idbDel("cache", KEY);
