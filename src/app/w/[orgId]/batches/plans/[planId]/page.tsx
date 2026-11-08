"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, CheckCircle2, Layers, Loader2 } from "lucide-react";
import { Alert, Badge, Button, PageLoader, Segmented, useToast } from "@/components/ui";
import { StockBatchDialog } from "@/features/batches";
import { useCatalog } from "@/features/farm";
import { Calculator, PlanCash, PlanDays, Results, useArchivePlan, usePlan } from "@/features/planner";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { formatDate, naira } from "@/lib/format";

export default function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  return <RequirePermission permission="farm.view"><Inner id={planId} /></RequirePermission>;
}

type Tab = "costs" | "days" | "cash";

function Inner({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = usePlan(ws.orgId, id);
  const names = useCatalog();
  const archive = useArchivePlan(ws.orgId, id);
  const toast = useToast();
  const money = ws.can("finance.view");
  const [tab, setTab] = useState<Tab>("costs");
  const [saving, setSaving] = useState<string>("");
  const [stocking, setStocking] = useState(false);
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="crit">{q.error instanceof ApiError ? q.error.message : "Could not load the plan."}</Alert>;
  const p = q.data;
  const species = names.data?.purposes[p.species] ?? p.pack.name;
  const approve = ws.can("farm.approve");

  return (
    <>
      <Link href={`/w/${ws.orgId}/batches`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Batches</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Plan · {species}{p.breed_name ? ` · ${p.breed_name}` : ""}</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-[26px] font-bold">{p.name}
            {p.batch_code ? <Badge tone="good" dot>Following: {p.batch_code}</Badge> : <Badge>Not stocked yet</Badge>}
            {p.archived_at && <Badge>Put away</Badge>}</h1>
          <p className="mt-1 text-ink-2">{p.count.toLocaleString("en-NG")} {p.pack.counts} · arrive {formatDate(p.start_on)} · sell around {formatDate(p.sell_on)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-ink-3" role="status" aria-live="polite">
            {saving === "saving" ? <span className="inline-flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Saving…</span>
              : saving === "saved" ? <span className="inline-flex items-center gap-1 text-good"><CheckCircle2 size={13} /> Saved</span>
                : saving ? <span className="text-crit">{saving}</span> : null}</span>
          {p.batch_id ? <Link href={`/w/${ws.orgId}/batches/${p.batch_id}`} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line px-3.5 text-[13.5px] font-semibold hover:bg-surface-2"><Layers size={16} /> Open {p.batch_code}</Link>
            : approve && !p.archived_at && <Button variant="primary" onClick={() => setStocking(true)}><Layers size={16} /> Stock this batch</Button>}
          {approve && !p.batch_id && (
            <Button variant="ghost" onClick={async () => {
              try { await archive.mutateAsync(!p.archived_at); toast(p.archived_at ? "Plan brought back" : "Plan put away"); } catch { toast("Could not change the plan.", "crit"); }
            }}>{p.archived_at ? <><ArchiveRestore size={16} /> Bring back</> : <><Archive size={16} /> Put away</>}</Button>
          )}
        </div>
      </div>

      {p.pack.status !== "reviewed" && p.pack.review_note && (
        <div className="mb-4"><Alert tone="info" title="The guide behind this plan">{p.pack.review_note}</Alert></div>
      )}

      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[
        { value: "costs", label: money ? "Costs" : "What it needs" }, { value: "days", label: "Day by day" },
        ...(money ? [{ value: "cash" as Tab, label: "Week by week" }] : [])]} /></div>

      {tab === "costs" && (
        money ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {p.result?.total_cost != null && (
              <a href="#plan-results" className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-[13.5px] lg:hidden">
                <span>Costs about <b className="tnum">{naira(p.result.total_cost)}</b>
                  {p.result.profit != null && <> · <b className={p.result.profit >= 0 ? "text-good" : "text-crit"}>{p.result.profit >= 0 ? `${naira(p.result.profit)} profit` : `${naira(-p.result.profit)} loss`}</b></>}</span>
                <span className="shrink-0 font-semibold text-brand">See results</span>
              </a>
            )}
            <Calculator plan={p} onSaving={setSaving} />
            <div id="plan-results" className="scroll-mt-4 lg:sticky lg:top-4"><Results plan={p} /></div>
          </div>
        ) : <div className="max-w-[720px]"><Results plan={p} /></div>
      )}
      {tab === "days" && <PlanDays plan={p} />}
      {tab === "cash" && <PlanCash plan={p} />}

      <StockBatchDialog open={stocking} onClose={() => setStocking(false)}
        plan={{ id: p.id, name: p.name, species: p.species, breed_key: p.breed_key, count: p.count, age: p.age_at_start_days, start_on: p.start_on, animal_price: p.inputs.animal_price ?? null }} />
    </>
  );
}
