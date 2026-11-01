"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay, uploadPhoto } from "@/features/daily/api";
import { shrinkPhoto } from "@/features/daily/device";
import { newId } from "@/features/daily/queue";
import { ProofPhoto } from "@/features/daily/TaskSheets";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Case, shortDay, useCloseCase, useHealthCatalog, useOpenCase, useUpdateCase } from "./api";

const groupOf = (groups: Record<string, string[]> | undefined, species?: string) =>
  (species && Object.entries(groups ?? {}).find(([, s]) => s.includes(species))?.[0]) || "other";

/** Anyone logging daily work can report sick animals: what they see, how many, a photo. */
export function ReportCaseDialog({ open, onClose, batchId }: { open: boolean; onClose: () => void; batchId?: string }) {
  const ws = useCurrentWorkspace();
  const cat = useHealthCatalog();
  const batches = useBatches(ws.orgId, "active", open);
  const report = useOpenCase(ws.orgId);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ batch: "", unit: "", on: localDay(), affected: "", description: "", suspected: "", hold: false });
  const [signs, setSigns] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ batch: batchId ?? "", unit: "", on: localDay(), affected: "", description: "", suspected: "", hold: false });
    setSigns([]); setPhoto(null); setError(null);
  }, [open, batchId]);

  const batch = batches.data?.find((b) => b.id === f.batch);
  const units = (batch?.units ?? []).filter((u) => !u.ended_on);
  const options = cat.data?.signs[groupOf(cat.data?.groups, batch?.species)] ?? [];
  const toggle = (s: string) => setSigns((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const pick = async (file?: File) => {
    if (!file) return;
    try { const blob = await shrinkPhoto(file); setPhoto({ blob, url: URL.createObjectURL(blob) }); } catch (e) { setError((e as Error).message); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const media_id = photo ? (await uploadPhoto(ws.orgId, photo.blob, newId())).id : null;
      const c = await report.mutateAsync({ batch_id: f.batch, unit_id: f.unit || (units.length === 1 ? units[0].unit_id : null), opened_on: f.on, signs,
        affected: f.affected ? Number(f.affected) : null, description: f.description || null, suspected: f.suspected || null, media_id, hold_sales: f.hold, client_id: newId() });
      toast(c.hold_sales ? `Reported. Sales from ${c.batch_code} are on hold` : `Reported for ${c.batch_code}`);
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Report sick animals" eyebrow="Health"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!f.batch || (!signs.length && f.description.trim().length < 3)} onClick={save}>Report</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Batch" htmlFor="c-batch">
            <Select id="c-batch" value={f.batch} disabled={!!batchId} onChange={(e) => { setF({ ...f, batch: e.target.value, unit: "" }); setSigns([]); }}>
              <option value="">Choose a batch</option>
              {batches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.units.filter((u) => !u.ended_on).map((u) => u.unit_code).join(", ")}</option>)}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="c-unit">
            <Select id="c-unit" value={f.unit} disabled={units.length < 2} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              <option value="">{units.length === 1 ? units[0].unit_code : "Not sure / several"}</option>
              {units.length > 1 && units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code}</option>)}
            </Select>
          </Field>
          <Field label="Since" htmlFor="c-on"><Input id="c-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        {batch && (
          <div>
            <span className="text-[12.5px] font-semibold text-ink-2">What do you see?</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((s) => (
                <button key={s} type="button" aria-pressed={signs.includes(s)} onClick={() => toggle(s)}
                  className={cn("rounded-full border px-3 py-1.5 text-[13px]", signs.includes(s) ? "border-crit bg-crit-soft font-semibold text-crit" : "border-line bg-surface text-ink-2 hover:border-ink-3")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="How many look sick" htmlFor="c-affected" hint="Rough count"><Input id="c-affected" inputMode="numeric" value={f.affected} onChange={(e) => setF({ ...f, affected: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Anything else" htmlFor="c-desc" hint={signs.length ? "Optional" : "Describe it if none of the above fit"}>
            <Textarea id="c-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Started in the corner by the door…" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo" onChange={(e) => pick(e.target.files?.[0])} />
          {photo ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Sick animals" className="max-h-48 rounded-xl border border-line" />
              <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[var(--scrim)] text-white"><X size={16} /></button>
            </div>
          ) : <div><Button size="sm" onClick={() => fileRef.current?.click()}><Camera size={15} /> Add a photo for the vet</Button></div>}
        </div>
        <div className="rounded-xl border border-line p-3">
          <Checkbox checked={f.hold} onChange={(v) => setF({ ...f, hold: v })} label="Hold all sales from this batch"
            description="Nothing from it can be sold or eaten until a supervisor or vet closes this case or lifts the hold." />
        </div>
      </div>
    </Dialog>
  );
}

/** Supervisor or vet: add the diagnosis, hold or release sales, close the case. Others just read it. */
export function CaseSheet({ c, onClose, onTreat }: { c: Case | null; onClose: () => void; onTreat: (c: Case) => void }) {
  const ws = useCurrentWorkspace();
  const cat = useHealthCatalog();
  const update = useUpdateCase(ws.orgId);
  const close = useCloseCase(ws.orgId);
  const toast = useToast();
  const canEdit = ws.can("health.edit");
  const [f, setF] = useState({ diagnosis: "", by: "", outcome: "recovered", on: localDay(), note: "" });
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!c) return;
    setF({ diagnosis: c.diagnosis ?? "", by: c.diagnosed_by ?? "", outcome: "recovered", on: localDay(), note: "" });
    setClosing(false); setError(null);
  }, [c]);
  if (!c) return null;
  const open = c.status === "open";

  const run = async (fn: () => Promise<unknown>, msg: string, done = false) => {
    setError(null);
    try { await fn(); toast(msg); if (done) onClose(); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
  };

  return (
    <Dialog open={!!c} onClose={onClose} title={`${c.batch_code}${c.unit_code ? ` · ${c.unit_code}` : ""}`} eyebrow={`Health case · since ${shortDay(c.opened_on)}`}
      footer={open && canEdit ? (closing ? <>
        <Button variant="ghost" onClick={() => setClosing(false)}>Back</Button>
        <Button variant="primary" loading={close.isPending} onClick={() => run(() => close.mutateAsync({ id: c.id, closed_on: f.on, outcome: f.outcome, note: f.note || null, diagnosis: f.diagnosis || null }), "Case closed", true)}>Close case</Button>
      </> : <>
        <Button variant="ghost" className="mr-auto" onClick={() => setClosing(true)}>Close case…</Button>
        <Button onClick={() => onTreat(c)}>Record treatment</Button>
        <Button variant="primary" loading={update.isPending} onClick={() => run(() => update.mutateAsync({ id: c.id, diagnosis: f.diagnosis || null, diagnosed_by: f.by || null }), "Saved")}>Save</Button>
      </>) : <Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="flex flex-wrap gap-1.5">
          {c.status === "closed" ? <Badge tone="good">Closed · {cat.data?.outcomes[c.outcome ?? ""] ?? c.outcome}</Badge> : <Badge tone="crit" dot>Open</Badge>}
          {c.hold_sales && open && <Badge tone="crit">Sales on hold</Badge>}
          {c.signs.map((s) => <Badge key={s}>{s}</Badge>)}
        </div>
        <p className="text-[13.5px] text-ink-2">
          {c.affected ? `${c.affected.toLocaleString()} look sick. ` : ""}{c.description}
          <span className="block text-[12.5px] text-ink-3">Reported by {c.opened_by_name ?? "—"}{c.treatments ? ` · ${c.treatments} treatment${c.treatments > 1 ? "s" : ""} recorded` : ""}</span>
        </p>
        {c.media_id && <ProofPhoto mediaId={c.media_id} />}
        {closing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How did it end" htmlFor="cs-outcome"><Select id="cs-outcome" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>
              {Object.entries(cat.data?.outcomes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Closed on" htmlFor="cs-on"><Input id="cs-on" type="date" max={localDay()} min={c.opened_on} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
            <Field label="Note" htmlFor="cs-note" hint="Optional" className="sm:col-span-2"><Textarea id="cs-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            {c.hold_sales && <p className="text-[12.5px] text-ink-3 sm:col-span-2">Closing lifts this case’s sales hold. Medicine withdrawal periods still apply.</p>}
          </div>
        ) : canEdit && open ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diagnosis" htmlFor="cs-dx" hint="What the vet or lab found"><Input id="cs-dx" value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
              <Field label="By" htmlFor="cs-by" hint="Vet or lab"><Input id="cs-by" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <span className="text-[13.5px]">{c.hold_sales ? "All sales from this batch are on hold." : "Sales are not held by this case."}</span>
              <Button size="sm" loading={update.isPending} onClick={() => run(() => update.mutateAsync({ id: c.id, hold_sales: !c.hold_sales }), c.hold_sales ? "Sales hold lifted" : "Sales on hold")}>
                {c.hold_sales ? "Lift the hold" : "Hold all sales"}</Button>
            </div>
          </>
        ) : (c.diagnosis || c.suspected) ? (
          <p className="text-[13.5px]"><b>{c.diagnosis ? "Diagnosis" : "Suspected"}:</b> {c.diagnosis ?? c.suspected}{c.diagnosed_by ? ` (${c.diagnosed_by})` : ""}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
