"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader, Pager, Segmented, usePager, useToast } from "@/components/ui";
import { useComplete } from "@/features/daily";
import {
  type Case, type Dose, CaseSheet, HoldList, ReportCaseDialog, shortDay, TreatmentDialog, TreatmentRows, useHealthOverview, useTreatments,
} from "@/features/health";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";

export default function HealthPage() {
  return <RequirePermission permission="health.view"><Inner /></RequirePermission>;
}

const STATUS: Record<Dose["status"], { label: string; tone: "crit" | "warn" | "neutral" | "good" | "info" }> = {
  overdue: { label: "Missed", tone: "crit" }, due: { label: "Today", tone: "warn" }, upcoming: { label: "Coming", tone: "neutral" },
  done: { label: "Given", tone: "good" }, skipped: { label: "Skipped", tone: "neutral" },
};

function Inner() {
  const ws = useCurrentWorkspace();
  const ov = useHealthOverview(ws.orgId);
  const [log, setLog] = useState<"recent" | "all">("recent");
  const pg = usePager(20);
  const all = useTreatments(ws.orgId, { include_void: true, ...pg.params }, log === "all");
  const [treating, setTreating] = useState<{ batchId?: string; caseId?: string | null } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [openCase, setOpenCase] = useState<Case | null>(null);

  if (!ws.has("health")) return <EmptyState title="Health records are not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const canTreat = ws.can("health.edit");
  const canReport = canTreat || ws.can("farm.edit");

  return (
    <>
      <PageHeader eyebrow="Farm" title="Health" sub="Vaccinations, treatments, sick animals, and what may not be sold yet."
        actions={<>
          {canReport && <Button onClick={() => setReporting(true)}><Stethoscope size={16} /> Report sick</Button>}
          {canTreat && <Button variant="primary" onClick={() => setTreating({})}><Plus size={16} /> Record treatment</Button>}
        </>} />

      <div className="flex flex-col gap-4">
        {d.holds.length > 0 ? <HoldList holds={d.holds} /> : (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink-2">
            <CheckCircle2 size={16} className="text-good" /> No withdrawal or disease holds. Everything may be sold.
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card title="Vaccinations" meta="From each batch’s species pack. Ticking one records it.">
            <Vaccinations doses={d.vaccinations} />
          </Card>
          <Card title="Sick animals" meta={d.open_cases.length ? `${d.open_cases.length} open` : "Nothing open"}>
            {d.open_cases.length ? (
              <ul className="flex flex-col gap-2">
                {d.open_cases.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpenCase(c)} className="w-full rounded-xl border border-line p-3 text-left hover:border-ink-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <b>{c.batch_code}{c.unit_code ? ` · ${c.unit_code}` : ""}</b>
                        {c.hold_sales && <Badge tone="crit">Sales on hold</Badge>}
                        <span className="ml-auto text-[12px] text-ink-3">since {shortDay(c.opened_on)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-2">{c.diagnosis ? <><b>Diagnosis:</b> {c.diagnosis}</> : c.signs.join(", ") || c.description}</p>
                      <p className="text-[12px] text-ink-3">{c.affected ? `${c.affected} affected · ` : ""}reported by {c.opened_by_name ?? "—"}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13.5px] text-ink-3">When someone sees sick animals they report it here (or from Today), with a photo for the vet.</p>}
          </Card>
        </div>

        <Card title="Treatment log" action={<Segmented value={log} onChange={setLog} options={[{ value: "recent", label: "Last 30 days" }, { value: "all", label: "All" }]} />}>
          {log === "recent" ? <TreatmentRows rows={d.recent} /> : all.data ? <><TreatmentRows rows={all.data.items} /><Pager {...pg.bind(all.data.total, all.isFetching)} noun="treatments" /></> : <PageLoader />}
        </Card>
      </div>

      <TreatmentDialog open={!!treating} onClose={() => setTreating(null)} batchId={treating?.batchId} caseId={treating?.caseId} />
      <ReportCaseDialog open={reporting} onClose={() => setReporting(false)} />
      <CaseSheet c={openCase} onClose={() => setOpenCase(null)} onTreat={(c) => { setOpenCase(null); setTreating({ batchId: c.batch_id, caseId: c.id }); }} />
    </>
  );
}

function Vaccinations({ doses }: { doses: Dose[] }) {
  const ws = useCurrentWorkspace();
  const complete = useComplete(ws.orgId);
  const toast = useToast();
  const canTick = ws.can("farm.edit") || ws.can("farm.approve");
  const groups = useMemo(() => {
    const order: [string, (x: Dose) => boolean][] = [
      ["Missed — give as soon as you can", (x) => x.status === "overdue"], ["Today", (x) => x.status === "due"],
      ["Next three weeks", (x) => x.status === "upcoming"], ["Done", (x) => x.status === "done" || x.status === "skipped"],
    ];
    return order.map(([label, f]) => [label, doses.filter(f)] as const).filter(([, xs]) => xs.length);
  }, [doses]);
  if (!doses.length) return <p className="text-[13.5px] text-ink-3">No vaccinations planned. Stock a batch with a species pack (broilers, layers) and its schedule appears here and on Today. <Link href={`/w/${ws.orgId}/batches`} className="text-brand underline">Batches</Link></p>;
  const give = async (x: Dose) => {
    try { await complete.mutateAsync({ taskId: x.task_id, on: x.due_on }); toast(`Recorded: ${x.vaccine} for ${x.batch_code}`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "crit"); }
  };
  return (
    <div className="flex flex-col gap-3">
      {groups.map(([label, xs]) => (
        <section key={label}>
          <h3 className={cn("eyebrow mb-1", label.startsWith("Missed") && "text-crit")}>{label}</h3>
          <ul className="flex flex-col divide-y divide-line">
            {xs.map((x) => {
              const s = STATUS[x.status];
              const pending = x.status === "overdue" || x.status === "due" || x.status === "upcoming";
              return (
                <li key={x.task_id} className="flex items-center gap-3 py-2">
                  {pending && canTick && x.status !== "upcoming" ? (
                    <button type="button" aria-label={`Mark ${x.vaccine} for ${x.batch_code} given`} onClick={() => give(x)} disabled={complete.isPending}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:text-brand"><Circle size={22} /></button>
                  ) : x.status === "done" ? <CheckCircle2 size={22} className="mx-[5px] shrink-0 text-good" /> : <Circle size={22} className="mx-[5px] shrink-0 text-line" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{x.vaccine}</div>
                    <div className="text-[12.5px] text-ink-3">{x.batch_code}{x.unit_code ? ` · ${x.unit_code}` : ""}{x.route ? ` · ${x.route}` : ""}
                      {x.done_on && ` · given ${shortDay(x.done_on)}${x.done_by_name ? ` by ${x.done_by_name}` : ""}`}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="font-mono text-[11.5px] text-ink-3">{shortDay(x.due_on)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
