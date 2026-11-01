"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useFarmMap } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import {
  type BatchDetail, today, useBatches, useClose, useMerge, useMove, useRecord, useReopen, useSplit, useVoid,
} from "./api";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));
const int = (v: string) => v.replace(/\D/g, "");
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

/** Shared shell: a dialog with an error line and a save button. */
function ActionDialog({ open, onClose, title, children, saveLabel, disabled, loading, onSave, error }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; saveLabel: string; disabled?: boolean; loading?: boolean;
  onSave: () => void; error: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} eyebrow="Batch"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} disabled={disabled} onClick={onSave}>{saveLabel}</Button></>}>
      <div className="flex flex-col gap-4">{error && <Alert tone="crit">{error}</Alert>}{children}</div>
    </Dialog>
  );
}

function UnitSelect({ batch, value, onChange, id, label = "From unit" }: { batch: BatchDetail; value: string; onChange: (v: string) => void; id: string; label?: string }) {
  const open = batch.units.filter((u) => !u.ended_on);
  if (open.length <= 1) return null;
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {open.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code} · {u.count.toLocaleString("en-NG")}</option>)}
      </Select>
    </Field>
  );
}

const defaultUnit = (b: BatchDetail) => { const open = b.units.filter((u) => !u.ended_on); return open.length === 1 ? open[0].unit_id : ""; };
const countIn = (b: BatchDetail, unitId: string) => b.units.find((u) => u.unit_id === unitId && !u.ended_on)?.count ?? b.current;

const LOSS_REASONS = ["Disease", "Heat stress", "Low oxygen", "Predator", "Injury", "Pile-up", "Unknown"];

/** `saleWarning`: shown when selling or using animals that are on a hold (the server refuses them anyway). */
export function RecordDialog({ batch, open, onClose, mode, saleWarning }: {
  batch: BatchDetail; open: boolean; onClose: () => void; mode: "loss" | "other"; saleWarning?: ReactNode;
}) {
  const ws = useCurrentWorkspace();
  const record = useRecord(ws.orgId, batch.id);
  const toast = useToast();
  const kinds = mode === "loss"
    ? [{ value: "died", label: "Died" }, { value: "culled", label: "Culled" }, { value: "missing", label: "Missing" }]
    : [{ value: "sold", label: "Sold" }, { value: "consumed", label: "Home use or gift" }, { value: "added", label: "Count correction (+)" }];
  const [kind, setKind] = useState(kinds[0].value);
  const [f, setF] = useState({ unit: "", qty: "", date: today(), amount: "", weight: "", reason: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setKind(kinds[0].value); setError(null); setF({ unit: defaultUnit(batch), qty: "", date: today(), amount: "", weight: "", reason: "", note: "" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);
  const available = f.unit ? countIn(batch, f.unit) : batch.current;
  const qty = Number(f.qty) || 0;
  const over = kind !== "added" && qty > available;
  const save = async () => {
    setError(null);
    try {
      await record.mutateAsync({ kind, unit_id: f.unit || undefined, quantity: qty, occurred_on: f.date, reason: f.reason || null, note: f.note || null,
        ...(kind === "sold" ? { amount: num(f.amount), weight_kg: num(f.weight) } : {}) });
      toast(`${batch.code}: ${qty.toLocaleString("en-NG")} ${kinds.find((k) => k.value === kind)!.label.toLowerCase()}`);
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <ActionDialog open={open} onClose={onClose} title={mode === "loss" ? "Record losses" : "Record sales and other changes"} error={error}
      saveLabel="Save" loading={record.isPending} disabled={!qty || over || (batch.units.filter((u) => !u.ended_on).length > 1 && !f.unit)} onSave={save}>
      <Segmented value={kind} onChange={setKind} options={kinds} />
      {saleWarning && (kind === "sold" || kind === "consumed") && saleWarning}
      <UnitSelect batch={batch} value={f.unit} onChange={(v) => setF({ ...f, unit: v })} id="r-unit" label="Unit" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many" htmlFor="r-qty" hint={kind !== "added" ? `${available.toLocaleString("en-NG")} there now` : undefined} error={over ? "More than there are" : undefined}>
          <Input id="r-qty" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: int(e.target.value) })} autoFocus /></Field>
        <Field label="Date" htmlFor="r-date"><Input id="r-date" type="date" max={today()} min={batch.started_on} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        {kind === "sold" && ws.can("finance.view") && <Field label="Amount received or invoiced (₦)" htmlFor="r-amount" hint="Optional"><Input id="r-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>}
        {kind === "sold" && <Field label="Total live weight (kg)" htmlFor="r-weight" hint="Optional"><Input id="r-weight" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>}
      </div>
      {mode === "loss" && kind !== "missing" && (
        <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-semibold text-ink-2">Cause</span>
          <div className="flex flex-wrap gap-2">
            {LOSS_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setF({ ...f, reason: f.reason === r ? "" : r })} aria-pressed={f.reason === r}
                className={cn("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold", f.reason === r ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink-3")}>{r}</button>
            ))}
          </div>
        </div>
      )}
      {kind === "sold" && <Field label="Buyer" htmlFor="r-reason" hint="Optional"><Input id="r-reason" value={f.reason} maxLength={80} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
      <Field label="Note" htmlFor="r-note" hint="Optional"><Input id="r-note" value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </ActionDialog>
  );
}

function TargetUnit({ value, onChange, exclude, id, label }: { value: string; onChange: (v: string) => void; exclude?: string; id: string; label: string }) {
  const ws = useCurrentWorkspace();
  const farm = useFarmMap(ws.orgId);
  const units = (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at && u.id !== exclude));
  const occ = farm.data?.unit_batches ?? {};
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.name ? ` · ${u.name}` : ""}{occ[u.id]?.length ? ` (has ${occ[u.id].map((b) => b.code).join(", ")})` : u.status === "empty" ? " (empty)" : ` (${u.status})`}</option>)}
      </Select>
    </Field>
  );
}

export function MoveDialog({ batch, open, onClose }: { batch: BatchDetail; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const move = useMove(ws.orgId, batch.id);
  const toast = useToast();
  const [f, setF] = useState({ from: "", to: "", qty: "", date: today() });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ from: defaultUnit(batch), to: "", qty: "", date: today() }); } }, [open, batch]);
  const available = f.from ? countIn(batch, f.from) : 0;
  const save = async () => {
    setError(null);
    try { await move.mutateAsync({ from_unit_id: f.from, to_unit_id: f.to, quantity: Number(f.qty), occurred_on: f.date }); toast("Moved"); onClose(); }
    catch (e) { setError(errMsg(e)); }
  };
  return (
    <ActionDialog open={open} onClose={onClose} title="Move to another unit" error={error} saveLabel="Move" loading={move.isPending}
      disabled={!f.from || !f.to || !Number(f.qty) || Number(f.qty) > available} onSave={save}>
      <UnitSelect batch={batch} value={f.from} onChange={(v) => setF({ ...f, from: v })} id="m-from" />
      <TargetUnit value={f.to} onChange={(v) => setF({ ...f, to: v })} exclude={f.from} id="m-to" label="To unit" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many" htmlFor="m-qty" hint={f.from ? `${available.toLocaleString("en-NG")} there now` : undefined}>
          <div className="flex gap-2"><Input id="m-qty" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: int(e.target.value) })} />
            {f.from && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, qty: String(available) })}>All</Button>}</div></Field>
        <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" max={today()} min={batch.started_on} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <p className="text-[12.5px] text-ink-3">The batch stays the same; only where the animals are changes.</p>
    </ActionDialog>
  );
}

export function SplitDialog({ batch, open, onClose, onDone }: { batch: BatchDetail; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const ws = useCurrentWorkspace();
  const split = useSplit(ws.orgId, batch.id);
  const toast = useToast();
  const [grade, setGrade] = useState<"split" | "grade">("grade");
  const [f, setF] = useState({ from: "", to: "", qty: "", date: today(), label: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ from: defaultUnit(batch), to: "", qty: "", date: today(), label: "" }); } }, [open, batch]);
  const available = f.from ? countIn(batch, f.from) : 0;
  const save = async () => {
    setError(null);
    try {
      const child = await split.mutateAsync({ from_unit_id: f.from || undefined, to_unit_id: f.to, quantity: Number(f.qty), occurred_on: f.date,
        grade_label: grade === "grade" ? f.label.trim() || null : null });
      toast(`New batch ${child.code} with ${child.current.toLocaleString("en-NG")}`); onClose(); onDone(child.id);
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <ActionDialog open={open} onClose={onClose} title="Split or grade into a new batch" error={error} saveLabel="Create new batch" loading={split.isPending}
      disabled={!f.from || !f.to || !Number(f.qty) || Number(f.qty) > available || (grade === "grade" && !f.label.trim())} onSave={save}>
      <Segmented value={grade} onChange={setGrade} options={[{ value: "grade", label: "Grade by size" }, { value: "split", label: "Just split" }]} />
      {grade === "grade" && (
        <Field label="Grade name" htmlFor="s-label">
          <Input id="s-label" value={f.label} maxLength={40} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Shooters, Large, Small…" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">{["Shooters", "Large", "Medium", "Small"].map((g) =>
            <button key={g} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px] font-semibold hover:border-ink-3" onClick={() => setF({ ...f, label: g })}>{g}</button>)}</div>
        </Field>
      )}
      <UnitSelect batch={batch} value={f.from} onChange={(v) => setF({ ...f, from: v })} id="s-from" />
      <TargetUnit value={f.to} onChange={(v) => setF({ ...f, to: v })} exclude={f.from} id="s-to" label="Into unit" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How many" htmlFor="s-qty" hint={f.from ? `${available.toLocaleString("en-NG")} there now` : undefined}>
          <Input id="s-qty" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: int(e.target.value) })} /></Field>
        <Field label="Date" htmlFor="s-date"><Input id="s-date" type="date" max={today()} min={batch.started_on} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <p className="text-[12.5px] text-ink-3">The new batch keeps the age, breed and a fair share of the purchase cost, and remembers it came from {batch.code}.</p>
    </ActionDialog>
  );
}

export function MergeDialog({ batch, open, onClose, onDone }: { batch: BatchDetail; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const ws = useCurrentWorkspace();
  const merge = useMerge(ws.orgId, batch.id);
  const others = useBatches(ws.orgId, "active", open);
  const toast = useToast();
  const [into, setInto] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const targets = useMemo(() => (others.data ?? []).filter((b) => b.id !== batch.id && b.species === batch.species), [others.data, batch]);
  const target = targets.find((b) => b.id === into);
  const tUnits = target?.units.filter((u) => !u.ended_on) ?? [];
  useEffect(() => { if (open) { setError(null); setInto(""); setUnit(""); setDate(today()); } }, [open]);
  const save = async () => {
    setError(null);
    try { const t = await merge.mutateAsync({ into_batch_id: into, to_unit_id: unit || undefined, occurred_on: date }); toast(`Merged into ${t.code}`); onClose(); onDone(t.id); }
    catch (e) { setError(errMsg(e)); }
  };
  return (
    <ActionDialog open={open} onClose={onClose} title={`Merge ${batch.code} into another batch`} error={error} saveLabel="Merge" loading={merge.isPending}
      disabled={!into || (tUnits.length > 1 && !unit)} onSave={save}>
      {targets.length === 0 ? <Alert tone="info">There is no other active batch of the same species to merge into.</Alert> : (
        <Field label="Into batch" htmlFor="g-into"><Select id="g-into" value={into} onChange={(e) => { setInto(e.target.value); setUnit(""); }}>
          <option value="">Choose…</option>{targets.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.current.toLocaleString("en-NG")} in {b.units.filter((u) => !u.ended_on).map((u) => u.unit_code).join(", ")}</option>)}</Select></Field>
      )}
      {tUnits.length > 1 && <Field label="Into unit" htmlFor="g-unit"><Select id="g-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option value="">Choose…</option>{tUnits.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code}</option>)}</Select></Field>}
      <Field label="Date" htmlFor="g-date"><Input id="g-date" type="date" max={today()} min={batch.started_on} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Alert tone="warn">All {batch.current.toLocaleString("en-NG")} animals move into the chosen batch, and {batch.code} closes. This cannot be undone.</Alert>
    </ActionDialog>
  );
}

export function CloseDialog({ batch, open, onClose }: { batch: BatchDetail; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const close = useClose(ws.orgId, batch.id);
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const last = batch.events.filter((e) => !e.voided_at).map((e) => e.occurred_on).sort().at(-1) ?? batch.started_on;
  useEffect(() => { if (open) { setError(null); setDate(today()); setNote(""); } }, [open]);
  const s = batch.summary;
  const save = async () => {
    setError(null);
    try { await close.mutateAsync({ closed_on: date, note: note || null }); toast(`Closed ${batch.code}`); onClose(); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <ActionDialog open={open} onClose={onClose} title={`Close ${batch.code}`} error={error} saveLabel="Close batch" loading={close.isPending}
      disabled={batch.current !== 0} onSave={save}>
      {batch.current !== 0 ? <Alert tone="warn">{batch.current.toLocaleString("en-NG")} animals are still in this batch. Record what happened to them first.</Alert> : (
        <>
          {s && <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-4 text-[13.5px]">
            <dt className="text-ink-3">Survival</dt><dd className="text-right font-semibold">{s.survival_pct ?? "—"}%</dd>
            <dt className="text-ink-3">Sold</dt><dd className="text-right font-semibold">{s.sold.toLocaleString("en-NG")}</dd>
            {s.result_so_far != null && <><dt className="text-ink-3">Result so far</dt><dd className="text-right font-semibold">{naira(s.result_so_far)}</dd></>}
          </dl>}
          <Field label="Close date" htmlFor="c-date"><Input id="c-date" type="date" min={last} max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Note" htmlFor="c-note" hint="Optional"><Textarea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Harvest done, pond drained" /></Field>
          <p className="text-[12.5px] text-ink-3">The summary is frozen at close. An owner or manager can reopen it to correct mistakes.</p>
        </>
      )}
    </ActionDialog>
  );
}

export function ReasonDialog({ title, open, onClose, onSave, saveLabel, loading, hint }: {
  title: string; open: boolean; onClose: () => void; onSave: (reason: string) => Promise<void>; saveLabel: string; loading?: boolean; hint?: string;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(""); setError(null); } }, [open]);
  return (
    <ActionDialog open={open} onClose={onClose} title={title} error={error} saveLabel={saveLabel} loading={loading} disabled={reason.trim().length < 3}
      onSave={async () => { try { await onSave(reason.trim()); onClose(); } catch (e) { setError(errMsg(e)); } }}>
      {hint && <p className="text-[13px] text-ink-2">{hint}</p>}
      <Field label="Reason" htmlFor="why"><Input id="why" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
    </ActionDialog>
  );
}

export function useVoidAndReopen(batch: BatchDetail) {
  const ws = useCurrentWorkspace();
  return { voidRecord: useVoid(ws.orgId, batch.id), reopen: useReopen(ws.orgId, batch.id) };
}
