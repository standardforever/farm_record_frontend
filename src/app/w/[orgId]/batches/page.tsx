"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers, Plus } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader, Pager, Segmented, usePager } from "@/components/ui";
import { type Batch, ageLabel, ageOn, StockBatchDialog, useBatchPage } from "@/features/batches";
import { useCatalog } from "@/features/farm";
import { PlansCard } from "@/features/planner";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { cn, formatDate } from "@/lib/format";

export default function BatchesPage() {
  return <RequirePermission permission="farm.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const [status, setStatus] = useState<"active" | "closed">("active");
  const pg = usePager(20, [status]);
  const batches = useBatchPage(ws.orgId, { status, ...pg.params });
  const catalog = useCatalog();
  const [stocking, setStocking] = useState(false);
  const canStock = ws.can("farm.approve");
  return (
    <>
      <PageHeader eyebrow="Farm" title="Batches" sub="Every flock, stocking or herd from the day it arrives to close-out."
        actions={canStock ? <Button variant="primary" onClick={() => setStocking(true)}><Plus size={16} /> Stock a batch</Button> : undefined} />
      {status === "active" && <div className="mb-4"><PlansCard /></div>}
      <div className="mb-4"><Segmented value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} /></div>
      {batches.isLoading ? <PageLoader /> : !batches.data?.items.length ? (
        <Card><EmptyState icon={<Layers size={22} />} title={status === "active" ? "No active batches" : "No closed batches yet"}
          body={status === "active" ? (canStock ? "Stock your first batch: day-old chicks, point-of-lay birds, fingerlings or a herd." : "Batches appear here when an owner or manager stocks them.") : "Closed batches keep their close-out summary here."}
          action={status === "active" && canStock ? <Button variant="primary" onClick={() => setStocking(true)}><Plus size={16} /> Stock a batch</Button> : undefined} /></Card>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batches.data.items.map((b) => <BatchCard key={b.id} b={b} species={catalog.data?.purposes[b.species] ?? b.species} />)}
          </ul>
          <Pager {...pg.bind(batches.data.total, batches.isFetching)} noun="batches" />
        </>
      )}
      <StockBatchDialog open={stocking} onClose={() => setStocking(false)} />
    </>
  );
}

function BatchCard({ b, species }: { b: Batch; species: string }) {
  const ws = useCurrentWorkspace();
  const s = b.summary;
  const age = b.status === "active" ? ageOn(b) : s?.age_days ?? 0;
  const progress = b.expected_end_on && b.status === "active"
    ? Math.min(100, Math.max(0, 100 * (Date.now() - new Date(b.started_on).getTime()) / (new Date(b.expected_end_on).getTime() - new Date(b.started_on).getTime()))) : null;
  return (
    <li>
      <Link href={`/w/${ws.orgId}/batches/${b.id}`} className="flex h-full flex-col gap-2 rounded-[14px] border border-line bg-surface p-4 hover:shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-2">
          <div><b className="font-mono text-[16px]">{b.code}</b>
            <div className="text-[13px] text-ink-2">{species}{b.breed ? ` · ${b.breed}` : ""}</div></div>
          <div className="flex flex-wrap justify-end gap-1">{b.grade_label && <Badge tone="maize">{b.grade_label}</Badge>}
            <Badge tone={b.status === "active" ? "good" : "neutral"} dot>{b.status === "active" ? "Active" : "Closed"}</Badge></div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div><span className="font-display text-[26px] font-bold tnum">{(b.status === "active" ? b.current : s?.total_in ?? b.initial_count).toLocaleString("en-NG")}</span>
            <span className="ml-1 text-[12.5px] text-ink-3">{b.status === "active" ? "now" : "stocked"}</span></div>
          <div className="text-right text-[12.5px] text-ink-2">
            {s?.survival_pct != null && <div><b className={cn(s.survival_pct < 90 ? "text-warn" : "text-good")}>{s.survival_pct}%</b> survival</div>}
            <div>{ageLabel(age)} old</div></div>
        </div>
        <div className="text-[12.5px] text-ink-3">{b.units.map((u) => u.unit_code).join(", ") || "—"} · since {formatDate(b.started_on)}{b.closed_on ? ` · closed ${formatDate(b.closed_on)}` : ""}</div>
        {progress != null && (
          <div className="mt-auto"><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
            <div className="mt-1 text-[11.5px] text-ink-3">Expected end {formatDate(b.expected_end_on)}</div></div>
        )}
      </Link>
    </li>
  );
}
