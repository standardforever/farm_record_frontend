"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Stethoscope } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, PageLoader, Pager, Segmented, usePager } from "@/components/ui";
import {
  CaseRows, DoNow, ReportCaseDialog, TreatmentDialog, TreatmentRows, Vaccinations, useCases, useHealthOverview, useTreatments,
} from "@/features/health";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";

export default function HealthPage() {
  return <RequirePermission permission="health.view"><Suspense fallback={<PageLoader />}><Inner /></Suspense></RequirePermission>;
}

type Tab = "sick" | "vaccines" | "treatments";
type Kind = "all" | "medication" | "vaccination" | "dewormer" | "supplement" | "other";

function Inner() {
  const ws = useCurrentWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const ov = useHealthOverview(ws.orgId);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "sick");
  const go = (t: Tab) => { setTab(t); router.replace(`/w/${ws.orgId}/health?tab=${t}`, { scroll: false }); };
  const [treating, setTreating] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (!ws.has("health")) return <EmptyState title="Health records are not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const canTreat = ws.can("health.edit");
  const canReport = canTreat || ws.can("farm.edit");
  const pendingVaccines = d.vaccinations.filter((x) => x.status === "overdue" || x.status === "due").length;

  return (
    <>
      <PageHeader eyebrow="Farm" title="Health" sub="What needs doing, sick animals, vaccines and every drug given."
        actions={<>
          {canReport && <Button onClick={() => setReporting(true)}><Stethoscope size={16} /> Report sick</Button>}
          {canTreat && <Button variant="primary" onClick={() => setTreating(true)}><Plus size={16} /> Record a drug or vaccine</Button>}
        </>} />

      <div className="flex flex-col gap-4">
        <DoNow d={d} />
        <div className="overflow-x-auto"><Segmented value={tab} onChange={go} options={[
          { value: "sick", label: `Sick animals${d.open_cases.length ? ` (${d.open_cases.length})` : ""}` },
          { value: "vaccines", label: `Vaccinations${pendingVaccines ? ` (${pendingVaccines})` : ""}` },
          { value: "treatments", label: "Drugs and treatments" }]} /></div>
        {tab === "sick" && <SickTab open={d.open_cases} onReport={canReport ? () => setReporting(true) : undefined} />}
        {tab === "vaccines" && <Card title="Vaccinations" meta="From each batch's guide or plan. Tap the circle when a dose is given."><Vaccinations doses={d.vaccinations} /></Card>}
        {tab === "treatments" && <TreatmentsTab />}
      </div>

      <TreatmentDialog open={treating} onClose={() => setTreating(false)} />
      <ReportCaseDialog open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}

function SickTab({ open, onReport }: { open: Parameters<typeof CaseRows>[0]["rows"]; onReport?: () => void }) {
  const ws = useCurrentWorkspace();
  const pg = usePager(20);
  const closed = useCases(ws.orgId, { status: "closed", ...pg.params });
  return (
    <div className="flex flex-col gap-4">
      <Card title="Being looked after" meta={open.length ? `${open.length} open` : undefined}>
        {open.length ? <CaseRows rows={open} /> : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-ink-3">No sick animals reported. Anyone who sees sick animals can report it here or from Today, with a photo for the vet.</p>
            {onReport && <Button size="sm" onClick={onReport}><Stethoscope size={15} /> Report sick</Button>}
          </div>
        )}
      </Card>
      {closed.data && closed.data.total > 0 && (
        <Card title="Closed" meta="Recovered, died or culled">
          <CaseRows rows={closed.data.items} />
          <Pager {...pg.bind(closed.data.total, closed.isFetching)} noun="cases" />
        </Card>
      )}
    </div>
  );
}

function TreatmentsTab() {
  const ws = useCurrentWorkspace();
  const [kind, setKind] = useState<Kind>("all");
  const pg = usePager(20, [kind]);
  const q = useTreatments(ws.orgId, { include_void: true, ...(kind !== "all" ? { kind } : {}), ...pg.params });
  return (
    <Card title="Drugs and treatments" meta="Tap one to see everything about it">
      <div className="-mt-1 mb-3 overflow-x-auto"><Segmented value={kind} onChange={setKind} options={[
        { value: "all", label: "All" }, { value: "medication", label: "Medicines" }, { value: "vaccination", label: "Vaccines" },
        { value: "dewormer", label: "Dewormers" }, { value: "supplement", label: "Vitamins" }, { value: "other", label: "Other" }]} /></div>
      {q.data ? <><TreatmentRows rows={q.data.items} empty={kind === "all" ? "Nothing recorded yet." : "None of these yet."} />
        <Pager {...pg.bind(q.data.total, q.isFetching)} noun="treatments" /></> : <PageLoader />}
    </Card>
  );
}
