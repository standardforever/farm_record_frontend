"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Link2, Paperclip, Trash2 } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, PageLoader, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError, blobUrl } from "@/lib/api";
import { cn, relative } from "@/lib/format";
import { EvidencePicker } from "./EvidencePicker";
import {
  type EvidenceItem, type EvidenceKind, attachPicked, emptyPicked, fileUrl, hasPicked, recordPhotoUrl, removeEvidence,
  useEvidence, useEvidenceCount, useEvidenceRefresh, viewPermission,
} from "./api";

/**
 * The paperclip next to a record: how many photos, PDFs or links back it up, and a sheet to see them or add more.
 * Shown to anyone who can see the record. <EvidenceButton kind="expense" id={e.id} />
 */
export function EvidenceButton({ kind, id, label, compact, className }: {
  kind: EvidenceKind; id: string; label?: string; compact?: boolean; className?: string;
}) {
  const ws = useCurrentWorkspace();
  const [open, setOpen] = useState(false);
  const allowed = ws.can(viewPermission(kind));
  const count = useEvidenceCount(ws.orgId, kind, id, allowed);
  if (!allowed) return null;
  const n = count.data ?? 0;
  const name = n ? `Evidence (${n})` : "Add evidence";
  return (
    <span className={cn("inline-flex shrink-0", className)} onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={label ? `${name} for ${label}` : name} title={name}
        className={cn(n > 0 && "!text-brand")}>
        <Paperclip size={14} />{n > 0 ? <span className="tnum">{n}</span> : !compact && " Evidence"}
      </Button>
      {open && <EvidenceSheet kind={kind} id={id} onClose={() => setOpen(false)} />}
    </span>
  );
}

export function EvidenceSheet({ kind, id, onClose }: { kind: EvidenceKind; id: string; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const toast = useToast();
  const refresh = useEvidenceRefresh(ws.orgId);
  const [showRemoved, setShowRemoved] = useState(false);
  const q = useEvidence(ws.orgId, kind, id, { removed: showRemoved });
  const [picked, setPicked] = useState(emptyPicked);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const d = q.data;
  const live = d?.items.filter((i) => !i.removed_at) ?? [];
  const removed = d?.items.filter((i) => i.removed_at) ?? [];
  const full = !!d && live.length >= d.limit;

  const add = async () => {
    if (!d) return;
    setErr(null); setBusy(true);
    try {
      const r = await attachPicked(ws.orgId, kind, { record_id: id }, picked, d.label);
      toast(r.queued ? `Saved on this phone; sent when there is network` : "Evidence added");
      setPicked(emptyPicked());
      refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not add it. Try again.");
      refresh();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} side title="Evidence" eyebrow={d ? `${d.kind_label} · ${d.label}` : undefined}
      footer={<Button onClick={onClose}>Close</Button>}>
      {!d ? (q.isError ? <Alert tone="crit" title={(q.error as ApiError).message} /> : <PageLoader />) : (
        <div className="flex flex-col gap-4">
          {d.record_photo && (
            <div>
              <h3 className="mb-1.5 text-[13px] font-semibold">Taken when it was recorded</h3>
              <Thumb path={recordPhotoUrl(ws.orgId, kind, id)} pdf={d.record_photo.content_type === "application/pdf"} name={d.record_photo.name} />
            </div>
          )}
          {live.length === 0 && !d.record_photo && <p className="text-[13.5px] text-ink-3">Nothing added yet. Evidence is optional; add a photo, a PDF or a link below.</p>}
          {live.length > 0 && <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">{live.map((i) => <Row key={i.id} item={i} onRemoved={refresh} />)}</ul>}
          {full ? <Alert tone="info" title={`This record has ${d.limit} files, the most it can hold. Remove one to add another.`} /> : (
            <div className="flex flex-col gap-2">
              <EvidencePicker value={picked} onChange={setPicked} open hint="Photos are shrunk on this phone first. PDFs up to 5 MB. Anyone who can see this record can see what you add." />
              {err && <Alert tone="crit" title={err} />}
              <div><Button variant="primary" loading={busy} disabled={!hasPicked(picked)} onClick={add}>Add to this record</Button></div>
            </div>
          )}
          {(removed.length > 0 || !showRemoved) && (
            <div>
              {!showRemoved ? <button type="button" className="cursor-pointer text-[12.5px] font-semibold text-ink-3 hover:text-ink" onClick={() => setShowRemoved(true)}>Show removed evidence</button> : (
                <>
                  <h3 className="mb-1.5 text-[13px] font-semibold text-ink-2">Removed ({removed.length})</h3>
                  <ul className="flex flex-col gap-1 text-[12.5px] text-ink-3">{removed.map((i) => (
                    <li key={i.id}>{i.name ?? (i.type === "link" ? i.url : i.type)} · removed {relative(i.removed_at!)}: “{i.remove_reason}”</li>))}</ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Row({ item: i, onRemoved }: { item: EvidenceItem; onRemoved: () => void }) {
  const ws = useCurrentWorkspace();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try { await removeEvidence(ws.orgId, i.id, reason.trim()); toast("Removed. It is kept in the history."); onRemoved(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not remove it", "crit"); }
    finally { setBusy(false); }
  };
  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        {i.type === "link" ? (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"><Link2 size={18} /></span>
        ) : <Thumb path={fileUrl(ws.orgId, i.id)} pdf={i.type === "pdf"} name={i.name} small />}
        <div className="min-w-0 flex-1 text-[13px]">
          {i.type === "link" ? (
            <a href={i.url!} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-semibold text-brand">
              <span className="truncate">{i.url}</span><ExternalLink size={12} className="shrink-0" /></a>
          ) : <b className="block truncate">{i.name ?? (i.type === "pdf" ? "Document" : "Photo")}</b>}
          {i.note && <p className="text-ink-2">{i.note}</p>}
          <p className="text-[12px] text-ink-3">{i.added_by ?? "Someone"} · {relative(i.added_at)}{i.size ? ` · ${Math.max(1, Math.round(i.size / 1024))} KB` : ""}</p>
        </div>
        {i.can_remove && !removing && (
          <Button size="sm" variant="ghost" className="!text-crit" aria-label="Remove this evidence" onClick={() => setRemoving(true)}><Trash2 size={14} /></Button>
        )}
      </div>
      {removing && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Why remove it?" htmlFor={`rm-${i.id}`} className="min-w-[180px] flex-1">
            <Input id={`rm-${i.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong photo" autoFocus />
          </Field>
          <Button size="sm" variant="ghost" onClick={() => setRemoving(false)}>Keep</Button>
          <Button size="sm" variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={remove}>Remove</Button>
        </div>
      )}
    </li>
  );
}

/** A photo thumbnail (fetched with the person's sign-in) or a PDF tile; both open full size in a new tab. */
function Thumb({ path, pdf, name, small }: { path: string; pdf?: boolean; name?: string | null; small?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false, made: string | null = null;
    blobUrl(path).then((u) => { made = u; if (!gone) setUrl(u); else URL.revokeObjectURL(u); }).catch(() => !gone && setFailed(true));
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [path]);
  const size = small ? "h-14 w-14" : "h-40 w-full max-w-[320px]";
  if (failed) return <span className={cn(size, "grid shrink-0 place-items-center rounded-lg bg-surface-2 text-center text-[11px] text-ink-3")}>Not available</span>;
  if (!url) return <span className={cn(size, "shrink-0 animate-pulse rounded-lg bg-surface-2")} />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={`Open ${name ?? (pdf ? "document" : "photo")}`}>
      {pdf ? (
        <span className={cn(size, "grid place-items-center rounded-lg border border-line bg-surface-2 text-ink-3")}><FileText size={small ? 18 : 28} /></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ?? "Evidence photo"} className={cn(size, "rounded-lg border border-line object-cover")} />
      )}
    </a>
  );
}
