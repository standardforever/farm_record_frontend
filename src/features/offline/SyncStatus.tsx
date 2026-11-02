"use client";

import { useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Alert, Button, Dialog, useToast } from "@/components/ui";
import { cn } from "@/lib/format";
import { discard, retry } from "./queue";
import { useSync } from "./useSync";

const ago = (t: number) => {
  if (!t) return "not yet";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" });

/** The small sync pill: quiet when everything is sent, loud when work waits or needs attention. */
export function SyncStatus({ orgId, dark }: { orgId: string; dark?: boolean }) {
  const s = useSync(orgId);
  const [open, setOpen] = useState(false);
  const n = s.waiting.length, c = s.conflicts.length;
  if (s.online && !n && !c) return null;
  const tone = c ? "crit" : !s.online ? "warn" : "brand";
  const text = c ? `${c} need${c === 1 ? "s" : ""} attention` : n ? `${n} waiting` : "Offline";
  const Icon = c ? AlertTriangle : !s.online ? CloudOff : s.syncing ? RefreshCw : UploadCloud;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Sync: ${text}`}
        className={cn("inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold",
          tone === "crit" ? "bg-crit-soft text-crit" : tone === "warn" ? "bg-maize-soft text-warn" : dark ? "bg-side-hi text-white" : "bg-brand-soft text-brand")}>
        <Icon size={14} className={s.syncing ? "animate-spin" : undefined} /> {text}
      </button>
      <SyncSheet orgId={orgId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function SyncSheet({ orgId, open, onClose }: { orgId: string; open: boolean; onClose: () => void }) {
  const s = useSync(orgId);
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} side title="Saved on this phone" eyebrow="Sync">
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] text-ink-2">
          {s.online ? "Connected." : "No network. Keep working: everything is saved on this phone and sent when the network returns."}
          {" "}Last sent {ago(s.lastSync)}.
        </p>
        {s.online && s.waiting.length > 0 && (
          <Button variant="primary" loading={s.syncing} onClick={async () => {
            const r = await s.sendNow();
            toast(r.offline ? "Still no network. Kept on this phone." : `Sent ${r.sent}${r.duplicates ? ` (${r.duplicates} already there)` : ""}${r.conflicts.length ? `, ${r.conflicts.length} need attention` : ""}`);
          }}><UploadCloud size={16} /> Send now</Button>
        )}
        {s.conflicts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[14px] font-bold">Needs your attention</h3>
            <p className="text-[12.5px] text-ink-3">The farm changed while this phone was offline, or the entry was not complete. Fix the farm and try again, or remove it and record it again.</p>
            {s.conflicts.map((o) => (
              <div key={o.client_id} className="rounded-xl border border-crit/40 bg-crit-soft/40 p-3">
                <b className="block text-[13.5px]">{o.label}</b>
                <span className="text-[12px] text-ink-3">Saved {when(o.saved_at)}</span>
                <p className="mt-1 text-[13px] text-crit" role="status">{o.message}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={!s.online} onClick={async () => { const r = await retry(o.client_id); toast(r.conflicts.some((x) => x.client_id === o.client_id) ? "Still cannot be saved" : "Sent"); }}><RefreshCw size={14} /> Try again</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await discard(o.client_id); toast("Removed"); }}><Trash2 size={14} /> Remove</Button>
                </div>
              </div>
            ))}
          </section>
        )}
        <section className="flex flex-col gap-1">
          <h3 className="text-[14px] font-bold">Waiting to send</h3>
          {s.waiting.length === 0 ? <p className="text-[13px] text-ink-3">Nothing waiting.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {s.waiting.map((o) => (
                <li key={o.client_id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0">{o.label}{o.photo ? " · with photo" : ""}</span>
                  <span className="shrink-0 text-[12px] text-ink-3">{when(o.saved_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {!s.online && s.waiting.length > 20 && <Alert tone="warn">Many entries are waiting. Find network soon (or ask someone to send from their phone) so the manager sees them.</Alert>}
      </div>
    </Dialog>
  );
}
