/**
 * Work saved on this phone, sent to Oko when there is network.
 *
 * Every piece of work (a feed log, deaths, a ticked task, a sick-animal report…) is an *operation* with a
 * client_id made when it was saved. `save()` tries to send it at once through POST /organizations/{org}/sync;
 * with no network it is kept in IndexedDB (with its photo, if any) and sent later by `flush()`.
 *
 * The server answers each operation: applied, duplicate (already saved: never written twice), conflict (the
 * farm changed while offline, or the entry is wrong: kept here with the reason until the person fixes or
 * discards it) or retry (server trouble: kept and sent again).
 *
 * Operation kinds are registered on the server (GET /sync/ops); this file does not need to know them.
 */
import { ApiError, post, upload } from "@/lib/api";
import { idbAll, idbDel, idbGet, idbSet } from "@/lib/idb";

export type OpStatus = "waiting" | "conflict";
export type Op = {
  client_id: string;
  org_id: string;
  kind: string;
  params: Record<string, string>;
  body: Record<string, unknown>;
  label: string;
  saved_at: string;
  status: OpStatus;
  code?: string | null;
  message?: string | null;
  /** A photo kept on the phone until it can be uploaded; its server id goes into body[photo_field]. */
  photo?: boolean;
  photo_field?: string;
  /** Where the photo (or PDF) is uploaded, and its file name. Defaults to the farm's proof-photo upload. */
  photo_path?: string;
  photo_name?: string;
  attempts?: number;
  /** Who saved it: only sent while that person is signed in on this phone. */
  user_id?: string | null;
  /** Being sent right now by the screen that saved it (not shown as waiting, not picked up by flush for a minute). */
  sending_since?: number | null;
};
const SENDING_GRACE = 60_000;
const settled = (o: Op) => !o.sending_since || Date.now() - o.sending_since > SENDING_GRACE;
type Result = { client_id: string; status: "applied" | "duplicate" | "conflict" | "retry"; id: string | null; code: string | null; message: string | null };
type SyncOut = { results: Result[]; applied: number; duplicates: number; conflicts: number; retry: number };

const OP = (id: string) => `op:${id}`;
const PHOTO = (id: string) => `photo:${id}`;
const CHUNK = 50;

// ---- change notifications (this tab and other tabs) ----
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("oko-sync") : null;
channel?.addEventListener("message", () => listeners.forEach((l) => l()));
function changed() { listeners.forEach((l) => l()); channel?.postMessage("changed"); }
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));
}

let currentUser: string | null = null;
/** Set by the sign-in code. Work saved by someone else on this phone waits for them. */
export function setQueueUser(id: string | null) { currentUser = id; changed(); }

export const queued = async (orgId?: string) =>
  (await idbAll<Op>("queue", "op:")).filter((o) => (!orgId || o.org_id === orgId) && (!o.user_id || o.user_id === currentUser) && settled(o))
    .sort((a, b) => a.saved_at.localeCompare(b.saved_at));

const offlineError = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 401);

async function uploadPhoto(orgId: string, blob: Blob, clientId: string, path = "farm/media", name?: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, name ?? "photo.jpg");
  form.append("client_id", clientId);
  if (name) form.append("name", name);
  return (await upload<{ id: string }>(`/organizations/${orgId}/${path}`, form)).id;
}

/** A stable id for the photo of an operation, so a re-upload is recognised by the server. */
const photoClientId = (opId: string) => (parseInt(opId[0], 16) ^ 8).toString(16) + opId.slice(1);

async function sendOps(orgId: string, ops: Op[]): Promise<SyncOut> {
  return post<SyncOut>(`/organizations/${orgId}/sync`, {
    ops: ops.map((o) => ({ client_id: o.client_id, kind: o.kind, params: o.params, body: o.body, saved_at: o.saved_at })),
  });
}

export type Saved = { status: "sent"; id: string | null; duplicate: boolean } | { status: "queued" };

/**
 * Save one piece of work. It is written to the phone first (so closing the app mid-send loses nothing),
 * then sent; once the server has it, it is removed from the phone. With no network it simply waits.
 * A conflict while the person is still on the form is thrown as an ApiError (so the form shows it).
 */
export async function save(orgId: string, kind: string, body: Record<string, unknown>, label: string,
  opts: { params?: Record<string, string>; photo?: Blob | null; photoField?: string; photoPath?: string; photoName?: string; clientId?: string } = {}): Promise<Saved> {
  const op: Op = { client_id: opts.clientId ?? (body.client_id as string) ?? newId(), org_id: orgId, kind, params: opts.params ?? {},
    body: { ...body }, label, saved_at: new Date().toISOString(), status: "waiting", user_id: currentUser };
  delete op.body.client_id;
  const photoField = opts.photoField ?? "media_id";
  if (opts.photo) {
    await idbSet("queue", PHOTO(op.client_id), opts.photo);
    Object.assign(op, { photo: true, photo_field: photoField, photo_path: opts.photoPath, photo_name: opts.photoName });
  }
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  await idbSet("queue", OP(op.client_id), { ...op, sending_since: offline ? null : Date.now() });
  const keep = async () => { await idbSet("queue", OP(op.client_id), { ...op, sending_since: null }); changed(); return { status: "queued" } as const; };
  const done = async () => { await idbDel("queue", OP(op.client_id)); await idbDel("queue", PHOTO(op.client_id)); };
  if (offline) { changed(); return { status: "queued" }; }
  try {
    if (opts.photo) {
      op.body[photoField] = await uploadPhoto(orgId, opts.photo, photoClientId(op.client_id), op.photo_path, op.photo_name);
      await idbSet("queue", OP(op.client_id), { ...op, sending_since: Date.now() });
    }
    const out = await sendOps(orgId, [op]);
    const r = out.results[0];
    if (r.status === "conflict") { await done(); throw new ApiError(409, r.code ?? "conflict", r.message ?? "Could not save this."); }
    if (r.status === "retry") return keep();
    await done();
    return { status: "sent", id: r.id, duplicate: r.status === "duplicate" };
  } catch (e) {
    if (offlineError(e)) return keep();
    if (!(e instanceof ApiError && e.status === 409)) await done();
    throw e;
  }
}

let flushing: Promise<FlushResult> | null = null;
export type FlushResult = { sent: number; duplicates: number; conflicts: Op[]; offline: boolean };

/** Send everything waiting (all workspaces on this phone). Safe to call often; runs one at a time. */
export function flush(): Promise<FlushResult> {
  if (!flushing) flushing = withLock(doFlush).finally(() => { flushing = null; });
  return flushing;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return locks ? locks.request("oko-sync", fn) as Promise<T> : fn();
}

async function doFlush(): Promise<FlushResult> {
  const res: FlushResult = { sent: 0, duplicates: 0, conflicts: [], offline: false };
  if (!currentUser) return res;
  const waiting = (await queued()).filter((o) => o.status === "waiting");
  const byOrg = new Map<string, Op[]>();
  for (const o of waiting) byOrg.set(o.org_id, [...(byOrg.get(o.org_id) ?? []), o]);
  for (const [orgId, ops] of byOrg) {
    for (let i = 0; i < ops.length; i += CHUNK) {
      const chunk = ops.slice(i, i + CHUNK);
      try {
        for (const o of chunk) {
          if (o.photo && !o.body[o.photo_field ?? "media_id"]) {
            const blob = await idbGet<Blob>("queue", PHOTO(o.client_id));
            if (blob) {
              o.body[o.photo_field ?? "media_id"] = await uploadPhoto(orgId, blob, photoClientId(o.client_id), o.photo_path, o.photo_name);
              await idbSet("queue", OP(o.client_id), o);
            }
          }
        }
        const out = await sendOps(orgId, chunk);
        for (const r of out.results) {
          const o = chunk.find((x) => x.client_id === r.client_id);
          if (!o) continue;
          if (r.status === "applied" || r.status === "duplicate") {
            await idbDel("queue", OP(o.client_id)); await idbDel("queue", PHOTO(o.client_id));
            if (r.status === "applied") res.sent++; else res.duplicates++;
          } else if (r.status === "conflict") {
            const c = { ...o, status: "conflict" as const, code: r.code, message: r.message };
            await idbSet("queue", OP(o.client_id), c);
            res.conflicts.push(c);
          } else {
            await idbSet("queue", OP(o.client_id), { ...o, attempts: (o.attempts ?? 0) + 1 });
          }
        }
        changed();
      } catch (e) {
        if (offlineError(e)) { res.offline = true; changed(); return res; }
        // A whole-request error that is not about the network (e.g. removed from the workspace): mark them.
        const msg = e instanceof ApiError ? e.message : "Could not send.";
        for (const o of chunk) { const c = { ...o, status: "conflict" as const, code: (e as ApiError).code ?? "error", message: msg }; await idbSet("queue", OP(o.client_id), c); res.conflicts.push(c); }
        changed();
      }
    }
  }
  if (res.sent || res.duplicates || res.conflicts.length) lastSync = Date.now();
  if (!waiting.length) lastSync = Date.now();
  try { localStorage.setItem("oko.lastSync", String(lastSync)); } catch { /* ignore */ }
  return res;
}

let lastSync = (() => { try { return Number(localStorage.getItem("oko.lastSync")) || 0; } catch { return 0; } })();
export const lastSyncedAt = () => lastSync;

/** Throw away one piece of work (the person decided it was wrong). */
export async function discard(clientId: string) {
  await idbDel("queue", OP(clientId)); await idbDel("queue", PHOTO(clientId)); changed();
}

/** Send a conflicted piece of work again as it is (after fixing the farm, e.g. reopening a batch). */
export async function retry(clientId: string) {
  const o = await idbGet<Op>("queue", OP(clientId));
  if (o) { await idbSet("queue", OP(clientId), { ...o, status: "waiting", code: null, message: null }); changed(); }
  return flush();
}

/** Older versions kept a few logs in localStorage; move them into the queue once. */
export async function migrateLegacy() {
  let items: { id: string; path: string; body: Record<string, unknown>; label: string; at: number; orgId: string }[] = [];
  try { items = JSON.parse(localStorage.getItem("oko.pending.v1") ?? "[]"); } catch { return; }
  if (!items.length) return;
  for (const it of items) {
    const m = it.path.match(/\/farm\/batches\/([0-9a-f-]{36})\/records$/);
    const op: Op = { client_id: (it.body.client_id as string) ?? it.id, org_id: it.orgId, kind: m ? "farm.batch_event" : "farm.record",
      params: m ? { batch_id: m[1] } : {}, body: { ...it.body }, label: it.label, saved_at: new Date(it.at).toISOString(), status: "waiting", user_id: currentUser };
    delete op.body.client_id;
    await idbSet("queue", OP(op.client_id), op);
  }
  try { localStorage.removeItem("oko.pending.v1"); } catch { /* ignore */ }
  changed();
}
