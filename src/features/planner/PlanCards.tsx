"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";
import { Badge, Button, Card, useToast } from "@/components/ui";
import type { Batch } from "@/features/batches/api";
import { useCatalog } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { formatDate, naira } from "@/lib/format";
import { SPECIES_PLANNED, useBatchPlan, useCreatePlan, useLinkPlan, usePlans } from "./api";
import { NewPlanDialog } from "./NewPlanDialog";

/** On the Batches screen: plans not stocked yet, and the way to start one. */
export function PlansCard() {
  const ws = useCurrentWorkspace();
  const plans = usePlans(ws.orgId);
  const names = useCatalog();
  const [open, setOpen] = useState(false);
  const money = ws.can("finance.view");
  const waiting = (plans.data ?? []).filter((p) => !p.batch_id);
  if (!ws.can("farm.approve") && !waiting.length) return null;
  return (
    <>
      <Card flush title="Plans" meta="Work out a batch before you buy: feed, vaccines, money and the days"
        action={ws.can("farm.approve") ? <Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Plan a batch</Button> : undefined}>
        {waiting.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-ink-3">No plans waiting. Starting out? Plan your first batch: it shows what it will cost and whether you have the money, before you spend any.</p>
        ) : (
          <ul className="divide-y divide-line">{waiting.map((p) => (
            <li key={p.id}><Link href={`/w/${ws.orgId}/batches/plans/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2">
              <CalendarRange size={17} className="text-ink-3" />
              <span className="min-w-0 flex-1"><b>{p.name}</b>
                <span className="block text-[12.5px] text-ink-3">{p.count.toLocaleString("en-NG")} {names.data?.purposes[p.species]?.toLowerCase() ?? p.species} · {formatDate(p.start_on)} to {formatDate(p.sell_on)}</span></span>
              {money && p.total_cost != null && <span className="text-right text-[12.5px]"><span className="font-mono font-semibold tnum">{naira(p.total_cost)}</span>
                {p.profit != null && <span className={p.profit >= 0 ? "block text-good" : "block text-crit"}>{p.profit >= 0 ? `${naira(p.profit)} profit` : `${naira(-p.profit)} loss`}</span>}</span>}
            </Link></li>))}
          </ul>
        )}
      </Card>
      <NewPlanDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** On a batch: the plan it follows, or a way to make one from the batch. */
export function BatchPlanCard({ b }: { b: Batch }) {
  const ws = useCurrentWorkspace();
  const router = useRouter();
  const toast = useToast();
  const supported = (SPECIES_PLANNED as readonly string[]).includes(b.species);
  const plan = useBatchPlan(ws.orgId, b.id, supported);
  const create = useCreatePlan(ws.orgId);
  const link = useLinkPlan(ws.orgId);
  if (!supported || plan.isLoading) return null;
  const p = plan.data;
  const today = new Date().toISOString().slice(0, 10);
  if (!p) {
    if (b.status !== "active" || !ws.can("farm.approve")) return null;
    const make = async () => {
      try {
        const n = await create.mutateAsync({ species: b.species, breed_key: b.breed_key ?? null, count: b.initial_count, start_on: b.started_on, age_at_start_days: b.age_at_start_days, name: `${b.code} plan` });
        await link.mutateAsync({ id: n.id, batch_id: b.id });
        router.push(`/w/${ws.orgId}/batches/plans/${n.id}`);
      } catch (e) { toast(e instanceof ApiError ? e.message : "Could not make the plan.", "crit"); }
    };
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-line p-4">
        <CalendarRange size={18} className="text-ink-3" />
        <span className="min-w-0 flex-1 text-[13.5px]"><b>No plan for this batch</b>
          <span className="block text-ink-2">A plan works out the feed, vaccines and money it needs from your prices, and lets you change any day.</span></span>
        <Button size="sm" loading={create.isPending || link.isPending} onClick={make}>Make a plan</Button>
      </div>
    );
  }
  const next = p.days.filter((d) => !d.removed && d.on >= today && d.kind !== "prepare").slice(0, 3);
  return (
    <Card title="Plan" meta={p.name} action={<Link href={`/w/${ws.orgId}/batches/plans/${p.id}`} className="text-[13px] font-semibold text-brand">Open the plan</Link>}>
      {p.total_cost != null && <p className="mb-2 text-[13.5px] text-ink-2">Planned cost <b className="tnum text-ink">{naira(p.total_cost)}</b>
        {p.profit != null && <> · expected {p.profit >= 0 ? <b className="text-good">{naira(p.profit)} profit</b> : <b className="text-crit">{naira(-p.profit)} loss</b>}</>}</p>}
      {next.length ? (
        <ul className="flex flex-col gap-1.5">{next.map((d) => (
          <li key={d.id} className="flex items-baseline gap-2 text-[13.5px]"><span className="w-[92px] shrink-0 font-mono text-[12px] text-ink-3">{formatDate(d.on)}</span>
            <span className="flex-1">{d.title}</span>{d.on === today && <Badge tone="maize">Today</Badge>}</li>))}
        </ul>
      ) : <p className="text-[13px] text-ink-3">Nothing left on the plan.</p>}
    </Card>
  );
}
