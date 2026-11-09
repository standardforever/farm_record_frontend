"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, ShieldAlert, Stethoscope } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, PageLoader, Select, Textarea, useToast } from "@/components/ui";
import { OwnerActions } from "@/features/corrections";
import { ProofPhoto } from "@/features/daily/TaskSheets";
import { localDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type Product, KIND_LABEL, PRODUCT_LABEL, shortDay, today, useCase, useCloseCase, useHealthCatalog, useTreatment, useUpdateCase } from "./api";
import { TreatmentRows, VoidDialog } from "./BatchHealthCard";
import { TreatmentDialog } from "./TreatmentDialog";

const longDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const nextDay = (iso: string) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return localDay(d); };

function Back({ tab }: { tab: string }) {
  const ws = useCurrentWorkspace();
  return <Link href={`/w/${ws.orgId}/health?tab=${tab}`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Health</Link>;
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {shown.map(([k, v]) => (
        <div key={k} className="min-w-0"><dt className="text-[12px] font-medium text-ink-3">{k}</dt><dd className="mt-0.5 text-[14px]">{v}</dd></div>
      ))}
    </dl>
  );
}

/** One drug, vaccine or other treatment, in full. */
export function TreatmentView({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = useTreatment(ws.orgId, id);
  const [voiding, setVoiding] = useState(false);
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <><Back tab="treatments" /><Alert tone="crit">{q.error instanceof ApiError ? q.error.message : "Could not load this treatment."}</Alert></>;
  const t = q.data;
  const on = today();
  const where = `${t.batch_code}${t.unit_code ? ` (${t.unit_code})` : ""}`;
  const holds = (Object.entries(t.held_until) as [Product, string][]);
  const days = t.course_days;
  const withdrawal = ([["meat", t.withdrawal_meat_days], ["eggs", t.withdrawal_eggs_days], ["milk", t.withdrawal_milk_days]] as const)
    .filter(([, n]) => n != null).map(([p, n]) => `${PRODUCT_LABEL[p]}: ${n ? `${n} day${n === 1 ? "" : "s"}` : "none"}`);

  return (
    <>
      <Back tab="treatments" />
      <div className="mb-4">
        <div className="eyebrow">{KIND_LABEL[t.kind] ?? t.kind} · {where}</div>
        <h1 className={cn("mt-1 flex flex-wrap items-center gap-2 font-display text-[26px] font-bold", t.voided_at && "line-through decoration-2")}>{t.product}
          {t.voided_at ? <Badge>Voided</Badge> : t.course_day ? <Badge tone="brand">Day {t.course_day} of {days}</Badge>
            : t.end_on < on || t.given_on < on ? <Badge tone="good">Given</Badge> : <Badge tone="warn">Starts {shortDay(t.given_on)}</Badge>}</h1>
        <p className="mt-1 text-ink-2">{days > 1 ? `${longDay(t.given_on)} to ${longDay(t.end_on)} (${days} days)` : longDay(t.given_on)}{t.given_by ? ` · given by ${t.given_by}` : ""}</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {t.voided_at && <Alert tone="info" title="This entry was voided">{t.void_reason}. It no longer holds sales and is kept for the record.</Alert>}
          {!t.voided_at && holds.map(([p, until]) => until >= on ? (
            <div key={p} role="alert" className="flex gap-2.5 rounded-[14px] border border-[color-mix(in_oklab,var(--crit)_35%,transparent)] bg-crit-soft p-4 text-[14px]">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-crit" />
              <span><b className="text-crit">Do not sell or eat {PRODUCT_LABEL[p].toLowerCase()} from {where} until {longDay(until)}.</b>
                <span className="block text-ink-2">Safe to sell from {longDay(nextDay(until))}. The drug needs this time to leave the {p === "meat" ? "animals" : p}.</span></span>
            </div>
          ) : (
            <div key={p} className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface p-3.5 text-[13.5px]">
              <CheckCircle2 size={17} className="shrink-0 text-good" /> {PRODUCT_LABEL[p]}: the withdrawal ended {longDay(until)}. Safe to sell.
            </div>
          ))}
          {t.course_day && !t.voided_at && (
            <Card title="Course" meta={`Last day ${longDay(t.end_on)}`}>
              <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={days} aria-valuenow={t.course_day} aria-label={`Day ${t.course_day} of ${days}`}>
                {Array.from({ length: days }, (_, i) => <span key={i} className={cn("h-2.5 flex-1 rounded-full", i < t.course_day! ? "bg-brand" : "bg-surface-2")} />)}
              </div>
              <p className="mt-2 text-[13px] text-ink-2">Keep giving it every day until {longDay(t.end_on)}, even if the animals look better.</p>
            </Card>
          )}
          <Card title="Details">
            <Facts rows={[
              ["What it is", KIND_LABEL[t.kind] ?? t.kind],
              ["Active ingredient", t.active_ingredient],
              ["Dose", t.dose],
              ["How it is given", t.route],
              ["How long", days > 1 ? `${days} days, ${shortDay(t.given_on)} to ${shortDay(t.end_on)}` : `One day, ${shortDay(t.given_on)}`],
              ["Animals treated", t.animals != null ? t.animals.toLocaleString("en-NG") : `All of ${t.unit_code ?? t.batch_code}`],
              ["Batch", <Link key="b" href={`/w/${ws.orgId}/batches/${t.batch_id}`} className="font-semibold text-brand">{t.batch_code}{t.unit_code ? ` · ${t.unit_code}` : ""}</Link>],
              ["Given by", t.given_by],
              ["Product batch or lot number", t.product_lot],
              ["Withdrawal period", withdrawal.length ? withdrawal.join(" · ") : null],
              ["From", t.task_id ? "The batch's vaccination schedule" : null],
            ]} />
            {t.notes && <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[13.5px]"><div className="mb-0.5 text-[12px] font-medium text-ink-3">Notes</div>{t.notes}</div>}
            <p className="mt-4 text-[12px] text-ink-3">Recorded by {t.created_by_name ?? "—"} on {new Date(t.created_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {t.case && (
            <Card title="Given for">
              <Link href={`/w/${ws.orgId}/health/cases/${t.case.id}`} className="-m-2 flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-crit-soft text-crit"><Stethoscope size={17} /></span>
                <span className="min-w-0 flex-1"><b className="block text-[14px]">{t.case.diagnosis ?? t.case.suspected ?? (t.case.signs.join(", ") || "Sick animals")}</b>
                  <span className="block text-[12.5px] text-ink-3">Reported {shortDay(t.case.opened_on)} · {t.case.status === "open" ? "still open" : "closed"}</span></span>
                <ChevronRight size={17} className="text-ink-3" />
              </Link>
            </Card>
          )}
          <Card title="Photos and changes">
            <p className="mb-3 text-[13px] text-ink-2">Add a photo of the label or the vet&apos;s note. Wrong details? The owner can correct them, and the change is kept in the audit trail.</p>
            <div className="flex flex-wrap items-center gap-2">
              {!t.voided_at && <OwnerActions kind="treatment" id={t.id} />}
              {!t.voided_at && ws.can("health.edit") && <Button size="sm" variant="ghost" onClick={() => setVoiding(true)}>Void (entered by mistake)</Button>}
            </div>
          </Card>
        </div>
      </div>
      <VoidDialog t={voiding ? t : null} onClose={() => setVoiding(false)} />
    </>
  );
}

/** A sick-animal report, told as a story: reported, diagnosed, treated, closed. Supervisors act on it here. */
export function CaseView({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = useCase(ws.orgId, id);
  const cat = useHealthCatalog();
  const update = useUpdateCase(ws.orgId);
  const close = useCloseCase(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ diagnosis: "", by: "", outcome: "recovered", on: localDay(), note: "" });
  const [closing, setClosing] = useState(false);
  const [treating, setTreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = q.data;
  useEffect(() => { if (c) setF((x) => ({ ...x, diagnosis: c.diagnosis ?? "", by: c.diagnosed_by ?? "" })); }, [c?.diagnosis, c?.diagnosed_by]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <PageLoader />;
  if (q.error || !c) return <><Back tab="sick" /><Alert tone="crit">{q.error instanceof ApiError ? q.error.message : "Could not load this case."}</Alert></>;
  const open = c.status === "open";
  const canEdit = ws.can("health.edit") && open;
  const where = `${c.batch_code}${c.unit_code ? ` · ${c.unit_code}` : ""}`;
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setError(null);
    try { await fn(); toast(msg); return true; } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); return false; }
  };
  const title = c.diagnosis ?? c.suspected ?? (c.signs.slice(0, 2).join(", ") || "Sick animals");

  const Step = ({ done, last, children }: { done?: boolean; last?: boolean; children: React.ReactNode }) => (
    <li className="relative flex gap-3 pb-5">
      {!last && <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-0.5 bg-line" aria-hidden />}
      <span className={cn("mt-1 h-4 w-4 shrink-0 rounded-full border-2", done ? "border-brand bg-brand" : "border-ink-3 bg-surface")} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );

  return (
    <>
      <Back tab="sick" />
      <div className="mb-4">
        <div className="eyebrow">Sick animals · {where}</div>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-[26px] font-bold">{title}
          {open ? <Badge tone="crit" dot>Open</Badge> : <Badge tone="good">Closed · {cat.data?.outcomes[c.outcome ?? ""] ?? c.outcome}</Badge>}
          {c.hold_sales && open && <Badge tone="crit">Sales on hold</Badge>}</h1>
        <p className="mt-1 text-ink-2">Since {longDay(c.opened_on)}{c.affected ? ` · ${c.affected.toLocaleString("en-NG")} affected` : ""}</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="What happened">
          <ol className="flex flex-col">
            <Step done>
              <div className="text-[14px] font-semibold">Reported sick <span className="font-normal text-ink-3">· {shortDay(c.opened_on)} by {c.opened_by_name ?? "—"}</span></div>
              {c.signs.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{c.signs.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
              {(c.affected || c.description) && <p className="mt-1.5 text-[13.5px] text-ink-2">{c.affected ? `${c.affected.toLocaleString("en-NG")} look sick. ` : ""}{c.description}</p>}
              {c.suspected && !c.diagnosis && <p className="mt-1 text-[13.5px]"><b>Suspected:</b> {c.suspected}</p>}
              {c.media_id && <div className="mt-2"><ProofPhoto mediaId={c.media_id} /></div>}
            </Step>
            <Step done={!!c.diagnosis}>
              {c.diagnosis ? <><div className="text-[14px] font-semibold">Diagnosis</div>
                <p className="text-[13.5px]">{c.diagnosis}{c.diagnosed_by ? <span className="text-ink-3"> · {c.diagnosed_by}</span> : ""}</p></>
                : <div className="text-[14px] text-ink-3">No diagnosis yet{canEdit ? ": add what the vet or lab found." : "."}</div>}
            </Step>
            <Step done={c.given.length > 0} last={open}>
              <div className="text-[14px] font-semibold">{c.given.length ? `Treatment${c.given.length > 1 ? "s" : ""} given` : <span className="font-normal text-ink-3">No treatment recorded yet</span>}</div>
              {c.given.length > 0 && <div className="mt-1"><TreatmentRows rows={c.given} showBatch={false} /></div>}
            </Step>
            {!open && (
              <Step done last>
                <div className="text-[14px] font-semibold">Closed: {cat.data?.outcomes[c.outcome ?? ""] ?? c.outcome} <span className="font-normal text-ink-3">· {shortDay(c.closed_on)}</span></div>
                {c.close_note && <p className="text-[13.5px] text-ink-2">{c.close_note}</p>}
              </Step>
            )}
          </ol>
          <div className="mt-1 flex flex-wrap gap-2 border-t border-line pt-3"><OwnerActions kind="health_case" id={c.id} /></div>
        </Card>

        {canEdit && (
          <div className="flex flex-col gap-4">
            {error && <Alert tone="crit">{error}</Alert>}
            <Card title="Treat">
              <p className="mb-3 text-[13px] text-ink-2">Record each drug as you give it, so the withdrawal period and the sales hold are worked out for you.</p>
              <Button variant="primary" onClick={() => setTreating(true)}>Record a drug for this case</Button>
            </Card>
            <Card title="Diagnosis">
              <div className="flex flex-col gap-3">
                <Field label="What the vet or lab found" htmlFor="cs-dx"><Input id="cs-dx" value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
                <Field label="By" htmlFor="cs-by" hint="Vet or lab"><Input id="cs-by" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} /></Field>
                <div><Button loading={update.isPending} disabled={f.diagnosis === (c.diagnosis ?? "") && f.by === (c.diagnosed_by ?? "")}
                  onClick={() => run(() => update.mutateAsync({ id: c.id, diagnosis: f.diagnosis || null, diagnosed_by: f.by || null }), "Diagnosis saved")}>Save diagnosis</Button></div>
              </div>
            </Card>
            <Card title="Selling">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13.5px]">{c.hold_sales ? "Nothing from this batch can be sold or eaten until the case is closed or the hold lifted." : "This case does not stop sales. Hold them if the disease could spread through meat or eggs."}</span>
                <Button size="sm" loading={update.isPending} onClick={() => run(() => update.mutateAsync({ id: c.id, hold_sales: !c.hold_sales }), c.hold_sales ? "Sales hold lifted" : "Sales on hold")}>
                  {c.hold_sales ? "Lift the hold" : "Hold all sales"}</Button>
              </div>
            </Card>
            <Card title="Close the case">
              {closing ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="How did it end" htmlFor="cs-outcome"><Select id="cs-outcome" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>
                      {Object.entries(cat.data?.outcomes ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                    <Field label="Closed on" htmlFor="cs-on"><Input id="cs-on" type="date" max={localDay()} min={c.opened_on} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
                  </div>
                  <Field label="Note" htmlFor="cs-note" hint="Optional"><Textarea id="cs-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
                  {c.hold_sales && <p className="text-[12.5px] text-ink-3">Closing lifts this case&apos;s sales hold. Drug withdrawal periods still apply.</p>}
                  <div className="flex gap-2"><Button variant="ghost" onClick={() => setClosing(false)}>Back</Button>
                    <Button variant="primary" loading={close.isPending} onClick={async () => {
                      if (await run(() => close.mutateAsync({ id: c.id, closed_on: f.on, outcome: f.outcome, note: f.note || null, diagnosis: f.diagnosis || null }), "Case closed")) setClosing(false);
                    }}>Close case</Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] text-ink-2">When the animals have recovered, died or been culled.</span>
                  <Button size="sm" onClick={() => setClosing(true)}>Close case…</Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      <TreatmentDialog open={treating} onClose={() => setTreating(false)} batchId={c.batch_id} caseId={c.id} />
    </>
  );
}
