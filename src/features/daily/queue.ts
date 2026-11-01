/**
 * Send-later queue for quick logs on a weak network.
 *
 * Every log gets a client_id before it is sent. If the network is down (or the server is
 * waking up), the request is kept in this browser and retried when the connection returns.
 * The server treats a repeated client_id as the same record, so a retry never duplicates.
 * Validation errors (4xx) are not queued: they come back to the person straight away.
 */
import { ApiError, post } from "@/lib/api";

export type Pending = { id: string; path: string; body: Record<string, unknown>; label: string; at: number; orgId: string };

const KEY = "oko.pending.v1";
const listeners = new Set<() => void>();

function read(): Pending[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function write(items: Pending[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
}

export const pendingFor = (orgId: string) => read().filter((p) => p.orgId === orgId);
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));
}

const retryable = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500 || e.status === 429);

/** Send now; if the network fails, keep it and say so. Returns the server reply, or null when queued. */
export async function send<T>(orgId: string, path: string, body: Record<string, unknown>, label: string): Promise<T | null> {
  const withId = { ...body, client_id: (body.client_id as string) ?? newId() };
  try {
    return await post<T>(path, withId);
  } catch (e) {
    if (!retryable(e)) throw e;
    write([...read(), { id: withId.client_id as string, path, body: withId, label, at: Date.now(), orgId }]);
    return null;
  }
}

let flushing = false;
/** Try everything waiting. Items the server rejects as invalid are dropped (reported to the caller). */
export async function flush(): Promise<{ sent: number; rejected: Pending[] }> {
  if (flushing) return { sent: 0, rejected: [] };
  flushing = true;
  let sent = 0;
  const rejected: Pending[] = [];
  try {
    for (const item of read()) {
      try {
        await post(item.path, item.body);
        sent++;
        write(read().filter((p) => p.id !== item.id));
      } catch (e) {
        if (retryable(e)) break; // still offline: keep the rest for later
        rejected.push(item);
        write(read().filter((p) => p.id !== item.id));
      }
    }
  } finally { flushing = false; }
  return { sent, rejected };
}
