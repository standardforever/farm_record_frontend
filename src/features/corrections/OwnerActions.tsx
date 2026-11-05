"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, PageLoader, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type CorrectionField, type CorrectionKind, useCorrectionForm, useDeletePreview, useDeleteRecord, useEditRecord } from "./api";

export const CAN_CORRECT = "records.correct";

/**
 * Edit and Delete for any record, shown only to the workspace's Owner or Co-owner.
 * Put it next to a record: <OwnerActions kind="expense" id={e.id} />.
 */
export function OwnerActions({ kind, id, edit = true, compact, onDeleted, className }: {
  kind: CorrectionKind; id: string; edit?: boolean; compact?: boolean; onDeleted?: () => void; className?: string;
}) {
  const ws = useCurrentWorkspace();
  const [open, setOpen] = useState<"edit" | "delete" | null>(null);
  if (!ws.can(CAN_CORRECT)) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)} onClick={(e) => e.stopPropagation()}>
      {edit && <Button size="sm" variant="ghost" onClick={() => setOpen("edit")} aria-label="Edit (owner)" title="Edit (owner)">
        <Pencil size={14} />{!compact && " Edit"}</Button>}
      <Button size="sm" variant="ghost" className="!text-crit" onClick={() => setOpen("delete")} aria-label="Delete (owner)" title="Delete (owner)">
        <Trash2 size={14} />{!compact && " Delete"}</Button>
      {open === "edit" && <EditDialog kind={kind} id={id} onClose={() => setOpen(null)} />}
      {open === "delete" && <DeleteDialog kind={kind} id={id} onClose={() => setOpen(null)} onDeleted={onDeleted} />}
    </span>
  );
}

function asInput(f: CorrectionField, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (f.type === "date") return String(v).slice(0, 10);
  return String(v);
}

function EditDialog({ kind, id, onClose }: { kind: CorrectionKind; id: string; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const toast = useToast();
  const form = useCorrectionForm(ws.orgId, kind, id);
  const save = useEditRecord(ws.orgId, kind, id);
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const f = form.data;
  useEffect(() => { if (f) setVals(Object.fromEntries(f.fields.map((x) => [x.name, x.type === "bool" ? !!f.values[x.name] : asInput(x, f.values[x.name])]))); }, [f]);
  const changed = useMemo(() => f ? f.fields.filter((x) => (x.type === "bool" ? !!f.values[x.name] : asInput(x, f.values[x.name])) !== vals[x.name]).map((x) => x.name) : [], [f, vals]);
  const blocked = !!f?.blockers.length;

  const submit = async () => {
    if (!f) return;
    setErr(null);
    try {
      const r = await save.mutateAsync({ revision: f.revision, reason: reason.trim(), values: Object.fromEntries(changed.map((n) => [n, vals[n]])) });
      toast(r.changed.length ? `Saved. ${f.kind_label} corrected.` : "Nothing changed.");
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save.");
    }
  };

  return (
    <Dialog open onClose={onClose} side title={f ? `Edit ${f.label}` : "Edit"} eyebrow="Owner correction · the old values are kept"
      footer={f && !blocked ? <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} disabled={!changed.length || reason.trim().length < 3} onClick={submit}>Save correction</Button>
      </> : <Button onClick={onClose}>Close</Button>}>
      {!f ? (form.isError ? <Alert tone="crit" title={(form.error as ApiError).message} /> : <PageLoader />) : blocked ? (
        <Alert tone="warn" title="This cannot be edited here">{f.blockers.join(" ")}</Alert>
      ) : (
        <div className="flex flex-col gap-3.5">
          {f.fields.map((x) => (
            <Field key={x.name} label={x.label + (x.required ? "" : " (optional)")} htmlFor={`cf-${x.name}`} hint={x.hint ?? undefined}>
              {x.type === "bool" ? (
                <Toggle checked={!!vals[x.name]} onChange={(v) => setVals((s) => ({ ...s, [x.name]: v }))} label={x.label} showLabel />
              ) : x.type === "select" ? (
                <Select id={`cf-${x.name}`} value={String(vals[x.name] ?? "")} onChange={(e) => setVals((s) => ({ ...s, [x.name]: e.target.value }))}>
                  {(!x.required || !vals[x.name]) && <option value="">—</option>}
                  {(x.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : x.type === "textarea" ? (
                <Textarea id={`cf-${x.name}`} rows={3} value={String(vals[x.name] ?? "")} onChange={(e) => setVals((s) => ({ ...s, [x.name]: e.target.value }))} />
              ) : (
                <Input id={`cf-${x.name}`} type={x.type === "date" ? "date" : ["int", "number", "money"].includes(x.type) ? "number" : "text"}
                  inputMode={x.type === "int" ? "numeric" : ["number", "money"].includes(x.type) ? "decimal" : undefined}
                  step={x.type === "int" ? 1 : x.type === "money" ? "0.01" : "any"} min={x.min ?? undefined} max={x.max ?? undefined}
                  value={String(vals[x.name] ?? "")} onChange={(e) => setVals((s) => ({ ...s, [x.name]: e.target.value }))} />
              )}
            </Field>
          ))}
          <Field label="Why are you correcting it?" htmlFor="corr-why" hint="Kept with the change, for anyone who checks the records later.">
            <Input id="corr-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: typed 70 instead of 7" />
          </Field>
          {err && <Alert tone="crit" title={err} />}
        </div>
      )}
    </Dialog>
  );
}

function DeleteDialog({ kind, id, onClose, onDeleted }: { kind: CorrectionKind; id: string; onClose: () => void; onDeleted?: () => void }) {
  const ws = useCurrentWorkspace();
  const toast = useToast();
  const pv = useDeletePreview(ws.orgId, kind, id);
  const del = useDeleteRecord(ws.orgId, kind, id);
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = pv.data;
  const blocked = !!p?.blockers.length;

  const submit = async () => {
    if (!p) return;
    setErr(null);
    try {
      const r = await del.mutateAsync({ reason: reason.trim(), fingerprint: p.fingerprint });
      toast(`Deleted ${r.label}${r.deleted > 1 ? ` and ${r.deleted - 1} linked record${r.deleted > 2 ? "s" : ""}` : ""}`);
      onClose();
      onDeleted?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not delete.");
    }
  };

  return (
    <Dialog open onClose={onClose} title={p ? `Delete ${p.label}?` : "Delete"} eyebrow="Owner deletion · kept in the history"
      footer={p && !blocked ? <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={del.isPending} disabled={!sure || reason.trim().length < 3} onClick={submit}>
          <Trash2 size={15} /> Delete {p.count > 1 ? `${p.count} records` : "it"}</Button>
      </> : <Button onClick={onClose}>Close</Button>}>
      {!p ? (pv.isError ? <Alert tone="crit" title={(pv.error as ApiError).message} /> : <PageLoader />) : blocked ? (
        <Alert tone="warn" title="Fix this first">{p.blockers.join(" ")}</Alert>
      ) : (
        <div className="flex flex-col gap-3.5 text-[13.5px]">
          <p className="flex items-start gap-2 text-ink-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-crit" />
            <span>This removes the {p.kind_label.toLowerCase()} from every list and total. What it was is kept in the workspace&apos;s correction history.</span></p>
          {p.records.length > 0 && (
            <div>
              <b>Also deleted with it ({p.records.length})</b>
              <ul className="mt-1.5 max-h-48 overflow-auto rounded-xl border border-line px-3 py-1.5">
                {p.records.map((r) => <li key={r.id + r.label} className="border-t border-line py-1.5 first:border-0"><span className="text-ink-3">{r.kind}:</span> {r.label}</li>)}
              </ul>
            </div>
          )}
          {p.notes.length > 0 && <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <Field label="Why are you deleting it?" htmlFor="del-why">
            <Input id="del-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: entered twice" />
          </Field>
          <Checkbox checked={sure} onChange={setSure} label={p.count > 1 ? `I checked the ${p.count} records above` : "I am sure"} />
          {err && <Alert tone="crit" title={err} />}
        </div>
      )}
    </Dialog>
  );
}
