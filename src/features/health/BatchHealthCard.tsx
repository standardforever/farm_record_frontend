"use client";

import { useState } from "react";
import { OwnerActions } from "@/features/corrections";
import { Plus, Stethoscope } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Field, Input, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Case, type Treatment, PRODUCT_LABEL, shortDay, useBatchHealth, useVoidTreatment } from "./api";
import { CaseSheet, ReportCaseDialog } from "./CaseDialogs";
import { HoldList } from "./HoldList";
import { TreatmentDialog } from "./TreatmentDialog";

const KIND: Record<string, string> = { medication: "Medicine", dewormer: "Dewormer", vaccination: "Vaccine", supplement: "Vitamins", other: "Other" };

/** Treatment log rows: what, when, how long it holds; editors can void a wrong entry. */
export function TreatmentRows({ rows, showBatch = true }: { rows: Treatment[]; showBatch?: boolean }) {
  const ws = useCurrentWorkspace();
  const [voiding, setVoiding] = useState<Treatment | null>(null);
  if (!rows.length) return <p className="text-[13.5px] text-ink-3">Nothing recorded yet.</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((t) => {
          const held = Object.entries(t.held_until).filter(([, d]) => d >= new Date().toISOString().slice(0, 10));
          return (
            <li key={t.id} className={cn("flex items-start gap-3 py-2.5", t.voided_at && "opacity-55")}>
              <div className="w-[54px] shrink-0 pt-0.5 font-mono text-[12px] text-ink-3">{shortDay(t.given_on)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b className={cn("text-[14px]", t.voided_at && "line-through")}>{t.product}</b>
                  <Badge tone={t.kind === "vaccination" ? "info" : t.kind === "medication" ? "maize" : "neutral"}>{KIND[t.kind] ?? t.kind}</Badge>
                  {held.map(([p, d]) => <Badge key={p} tone="crit">{PRODUCT_LABEL[p as "meat"]} held to {shortDay(d)}</Badge>)}
                </div>
                <p className="text-[12.5px] text-ink-3">
                  {[showBatch && `${t.batch_code}${t.unit_code ? ` · ${t.unit_code}` : ""}`, t.route, t.dose,
                    t.end_on !== t.given_on && `${shortDay(t.given_on)}–${shortDay(t.end_on)}`, t.given_by && `by ${t.given_by}`,
                    t.task_id && "from the vaccination schedule"].filter(Boolean).join(" · ")}
                  {t.voided_at && <span className="block">Voided: {t.void_reason}</span>}
                </p>
              </div>
              {!t.voided_at && ws.can("health.edit") && (
                <Button size="sm" variant="ghost" aria-label={`Void ${t.product}`} onClick={() => setVoiding(t)}>Void</Button>
              )}
              {!t.voided_at && <OwnerActions kind="treatment" id={t.id} compact />}
            </li>
          );
        })}
      </ul>
      <VoidDialog t={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

function VoidDialog({ t, onClose }: { t: Treatment | null; onClose: () => void }) {
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
  const [treating, setTreating] = useState<{ caseId?: string | null } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [openCase, setOpenCase] = useState<Case | null>(null);
  if (!visible) return null;
  const cases = h.data?.cases ?? [];
  const open = cases.filter((c) => c.status === "open");
  const canReport = active && (ws.can("farm.edit") || ws.can("health.edit"));
  return (
    <Card title="Health" meta={h.data ? `${h.data.treatments.filter((t) => !t.voided_at).length} treatments · ${open.length} open case${open.length === 1 ? "" : "s"}` : undefined}
      action={<div className="flex gap-1.5">
        {canReport && <Button size="sm" variant="ghost" onClick={() => setReporting(true)}><Stethoscope size={15} /> Report sick</Button>}
        {active && ws.can("health.edit") && <Button size="sm" onClick={() => setTreating({})}><Plus size={15} /> Treatment</Button>}
      </div>}>
      <div className="flex flex-col gap-3">
        {h.data && <HoldList holds={h.data.holds} showBatch={false} title="Do not sell or eat from this batch" />}
        {open.map((c) => (
          <button key={c.id} type="button" onClick={() => setOpenCase(c)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-ink-3">
            <Badge tone="crit" dot>Open case</Badge>
            <span className="min-w-0 flex-1 truncate text-[13.5px]">{c.diagnosis ?? c.suspected ?? c.signs.join(", ")}</span>
            <span className="text-[12px] text-ink-3">since {shortDay(c.opened_on)}</span>
          </button>
        ))}
        {h.data && <TreatmentRows rows={h.data.treatments} showBatch={false} />}
      </div>
      <TreatmentDialog open={!!treating} onClose={() => setTreating(null)} batchId={batchId} caseId={treating?.caseId} />
      <ReportCaseDialog open={reporting} onClose={() => setReporting(false)} batchId={batchId} />
      <CaseSheet c={openCase} onClose={() => setOpenCase(null)} onTreat={(c) => { setOpenCase(null); setTreating({ caseId: c.id }); }} />
    </Card>
  );
}
