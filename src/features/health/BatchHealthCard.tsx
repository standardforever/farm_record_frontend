"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus, Stethoscope } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Case, type Treatment, courseNow, KIND_LABEL, PRODUCT_LABEL, shortDay, today, useBatchHealth, useVoidTreatment } from "./api";
import { ReportCaseDialog } from "./CaseDialogs";
import { HoldList } from "./HoldList";
import { TreatmentDialog } from "./TreatmentDialog";

const KIND_TONE: Record<string, "info" | "maize" | "neutral"> = { vaccination: "info", medication: "maize" };

/** Treatments as a list: each one opens in full. */
export function TreatmentRows({ rows, showBatch = true, empty = "Nothing recorded yet." }: { rows: Treatment[]; showBatch?: boolean; empty?: string }) {
  const ws = useCurrentWorkspace();
  if (!rows.length) return <p className="text-[13.5px] text-ink-3">{empty}</p>;
  const on = today();
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((t) => {
        const held = Object.entries(t.held_until).filter(([, d]) => d >= on);
        const course = courseNow(t, on);
        return (
          <li key={t.id}>
            <Link href={`/w/${ws.orgId}/health/treatments/${t.id}`} className={cn("-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2", t.voided_at && "opacity-55")}>
              <div className="w-[54px] shrink-0 pt-0.5 font-mono text-[12px] text-ink-3">{shortDay(t.given_on)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b className={cn("text-[14px]", t.voided_at && "line-through")}>{t.product}</b>
                  <Badge tone={KIND_TONE[t.kind] ?? "neutral"}>{KIND_LABEL[t.kind] ?? t.kind}</Badge>
                  {course && <Badge tone="brand">Day {course.day} of {course.of}</Badge>}
                  {held.map(([p, d]) => <Badge key={p} tone="crit">{PRODUCT_LABEL[p as "meat"]} held to {shortDay(d)}</Badge>)}
                  {t.voided_at && <Badge>Voided</Badge>}
                </div>
                <p className="text-[12.5px] text-ink-3">
                  {[showBatch && `${t.batch_code}${t.unit_code ? ` · ${t.unit_code}` : ""}`, t.route, t.dose,
                    t.end_on !== t.given_on && `${shortDay(t.given_on)}–${shortDay(t.end_on)}`, t.given_by && `by ${t.given_by}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ChevronRight size={17} className="mt-1 shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sick-animal reports as a list: each one opens in full. */
export function CaseRows({ rows, showBatch = true, empty = "No sick animals reported." }: { rows: Case[]; showBatch?: boolean; empty?: string }) {
  const ws = useCurrentWorkspace();
  if (!rows.length) return <p className="text-[13.5px] text-ink-3">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/w/${ws.orgId}/health/cases/${c.id}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
            <div className="w-[54px] shrink-0 pt-0.5 font-mono text-[12px] text-ink-3">{shortDay(c.opened_on)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b className="text-[14px]">{c.diagnosis ?? c.suspected ?? (c.signs.length ? c.signs.slice(0, 2).join(", ") : "Sick animals")}</b>
                {c.status === "open" ? <Badge tone="crit" dot>Open</Badge> : <Badge tone="good">Closed</Badge>}
                {c.hold_sales && c.status === "open" && <Badge tone="crit">Sales on hold</Badge>}
              </div>
              <p className="text-[12.5px] text-ink-3">
                {[showBatch && `${c.batch_code}${c.unit_code ? ` · ${c.unit_code}` : ""}`, c.affected && `${c.affected.toLocaleString()} affected`,
                  c.treatments && `${c.treatments} treatment${c.treatments > 1 ? "s" : ""}`, c.opened_by_name && `reported by ${c.opened_by_name}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ChevronRight size={17} className="mt-1 shrink-0 text-ink-3" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function VoidDialog({ t, onClose }: { t: Treatment | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const voidIt = useVoidTreatment(ws.orgId);
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!t) return null;
  const holds = Object.keys(t.held_until).length > 0;
  return (
    <Dialog open={!!t} onClose={() => { setReason(""); setError(null); onClose(); }} title={`Void ${t.product}?`} eyebrow={t.batch_code ?? "Treatment"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={voidIt.isPending} disabled={reason.trim().length < 3} onClick={async () => {
          try { await voidIt.mutateAsync({ id: t.id, reason: reason.trim() }); toast("Voided"); setReason(""); onClose(); }
          catch (e) { setError(e instanceof ApiError ? e.message : "Could not void."); }
        }}>Void entry</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">Only void an entry that was a mistake (wrong batch, never given).{holds && " Its withdrawal hold will be lifted."} This is kept in the audit trail.</p>
        <Field label="Why?" htmlFor="v-reason"><Input id="v-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Entered on the wrong batch" /></Field>
      </div>
    </Dialog>
  );
}

/** Health on the batch page: holds, open cases, treatments, and the buttons to add them. */
export function BatchHealthCard({ batchId, active }: { batchId: string; active: boolean }) {
  const ws = useCurrentWorkspace();
  const visible = ws.can("health.view");
  const h = useBatchHealth(ws.orgId, batchId, visible);
  const [treating, setTreating] = useState(false);
  const [reporting, setReporting] = useState(false);
  if (!visible) return null;
  const cases = h.data?.cases ?? [];
  const open = cases.filter((c) => c.status === "open");
  const canReport = active && (ws.can("farm.edit") || ws.can("health.edit"));
  return (
    <Card title="Health" meta={h.data ? `${h.data.treatments.filter((t) => !t.voided_at).length} treatments · ${open.length} open case${open.length === 1 ? "" : "s"}` : undefined}
      action={<div className="flex gap-1.5">
        {canReport && <Button size="sm" variant="ghost" onClick={() => setReporting(true)}><Stethoscope size={15} /> Report sick</Button>}
        {active && ws.can("health.edit") && <Button size="sm" onClick={() => setTreating(true)}><Plus size={15} /> Treatment</Button>}
      </div>}>
      <div className="flex flex-col gap-3">
        {h.data && <HoldList holds={h.data.holds} showBatch={false} title="Do not sell or eat from this batch" />}
        {open.length > 0 && <CaseRows rows={open} showBatch={false} />}
        {h.data && <TreatmentRows rows={h.data.treatments} showBatch={false} />}
      </div>
      <TreatmentDialog open={treating} onClose={() => setTreating(false)} batchId={batchId} />
      <ReportCaseDialog open={reporting} onClose={() => setReporting(false)} batchId={batchId} />
    </Card>
  );
}
