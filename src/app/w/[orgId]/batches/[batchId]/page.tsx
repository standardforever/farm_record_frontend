"use client";

import Link from "next/link";
import { Fragment, use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, CheckCircle2, GitBranch, GitMerge, MinusCircle, PlusCircle, Receipt, RotateCcw, Undo2 } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, PageLoader, Stat, useToast } from "@/components/ui";
import {
  type BatchDetail, ageLabel, ageOn, CloseDialog, MergeDialog, MoveDialog, ReasonDialog, RecordDialog, SplitDialog,
  useBatch, useBatchCatalog, useVoidAndReopen,
} from "@/features/batches";
import { useCatalog } from "@/features/farm";
import { BatchHealthCard, HoldList, useBatchHealth } from "@/features/health";
import { BatchStockCard, useInventoryCatalog } from "@/features/inventory";
import { InvoiceDialog } from "@/features/sales";
import { StandardCard } from "@/features/packs";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, formatDate, naira } from "@/lib/format";

export default function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  return <RequirePermission permission="farm.view"><Inner id={batchId} /></RequirePermission>;
}

function Inner({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = useBatch(ws.orgId, id);
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <EmptyState title="Batch not found" body={q.error instanceof ApiError ? q.error.message : undefined} />;
  return <View b={q.data} />;
}

type Open = "loss" | "other" | "move" | "split" | "merge" | "close" | "reopen" | null;

function View({ b }: { b: BatchDetail }) {
  const ws = useCurrentWorkspace();
  const router = useRouter();
  const toast = useToast();
  const catalog = useCatalog();
  const bc = useBatchCatalog();
  const [open, setOpen] = useState<Open>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const { voidRecord, reopen } = useVoidAndReopen(b);
  const s = b.summary;
  const active = b.status === "active";
  const health = useBatchHealth(ws.orgId, b.id, active && ws.has("health"));
  const stockCats = useInventoryCatalog();
  const [selling, setSelling] = useState(false);
  const meatHolds = (health.data?.holds ?? []).filter((h) => h.product === "meat" || h.product === "all");
  const approve = ws.can("farm.approve");
  const edit = ws.can("farm.edit") || approve;
  const money = ws.can("finance.view") && s?.cost_so_far != null;
  const species = catalog.data?.purposes[b.species] ?? b.species;
  const age = active ? ageOn(b) : s?.age_days ?? 0;
  const go = (bid: string) => router.push(`/w/${ws.orgId}/batches/${bid}`);
  const evLabel = (k: string) => bc.data?.events[k]?.label ?? k;

  return (
    <>
      <Link href={`/w/${ws.orgId}/batches`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Batches</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">{species}{b.breed ? ` · ${b.breed}` : ""}</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[28px] font-bold">{b.code}
            {b.grade_label && <Badge tone="maize">{b.grade_label}</Badge>}
            <Badge tone={active ? "good" : "neutral"} dot>{active ? "Active" : `Closed ${formatDate(b.closed_on)}`}</Badge></h1>
          <p className="mt-1 text-ink-2">Stocked {formatDate(b.started_on)}{b.source_name ? ` from ${b.source_name}` : ""} · {ageLabel(age)} old
            {active && b.expected_end_on ? ` · expected end ${formatDate(b.expected_end_on)}` : ""}</p>
        </div>
        {active && (
          <div className="flex flex-wrap gap-2">
            {edit && <Button onClick={() => setOpen("loss")}><MinusCircle size={16} /> Record losses</Button>}
            {ws.has("sales") && ws.can("sales.edit") && b.current > 0 && <Button variant="primary" onClick={() => setSelling(true)}><Receipt size={16} /> Sell</Button>}
            {approve && <Button variant={ws.has("sales") && ws.can("sales.edit") ? "secondary" : "primary"} onClick={() => setOpen("other")}><PlusCircle size={16} /> {ws.has("sales") ? "Other changes" : "Sales and other"}</Button>}
          </div>
        )}
      </div>

      {!active && b.close_note && <div className="mb-4"><Alert tone="info">{b.close_note}</Alert></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label={active ? "Animals now" : "Stocked in total"} value={(active ? b.current : s?.total_in ?? 0).toLocaleString("en-NG")}
          sub={active ? `of ${s?.total_in.toLocaleString("en-NG")} in total` : `${s?.sold.toLocaleString("en-NG")} sold`} />
        <Stat label="Survival" value={s?.survival_pct != null ? `${s.survival_pct}%` : "—"} sub={`${s?.died.toLocaleString("en-NG")} died · ${s?.culled.toLocaleString("en-NG")} culled`} />
        <Stat label="Days in cycle" value={s?.days ?? 0} sub={`${ageLabel(age)} old`} />
        <Stat label="Sold" value={(s?.sold ?? 0).toLocaleString("en-NG")} sub={s?.avg_sale_weight_kg ? `avg ${s.avg_sale_weight_kg} kg` : s?.sold_weight_kg ? `${s.sold_weight_kg} kg` : "No sales yet"} />
      </div>

      {b.pack_key && <div className="mb-4"><StandardCard batchId={b.id} active={active} /></div>}
      {ws.has("health") && <div className="mb-4"><BatchHealthCard batchId={b.id} active={active} /></div>}
      {ws.has("inventory") && <div className="mb-4"><BatchStockCard batchId={b.id} active={active} /></div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Where they are" action={active && approve ? <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen("move")} disabled={!b.current}><ArrowRightLeft size={14} /> Move</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen("split")} disabled={!b.current}><GitBranch size={14} /> Split or grade</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen("merge")} disabled={!b.current}><GitMerge size={14} /> Merge</Button>
          </div> : undefined}>
            {b.units.length === 0 ? <p className="text-ink-3">Not in any unit.</p> : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {b.units.map((u) => (
                  <li key={u.unit_id} className={cn("rounded-xl border p-3", u.ended_on ? "border-dashed border-line opacity-70" : "border-good/40 bg-good-soft")}>
                    <b className="font-mono">{u.unit_code}</b>{u.unit_name && <span className="text-[12.5px] text-ink-2"> · {u.unit_name}</span>}
                    <div className="font-display text-[20px] font-bold tnum">{u.count.toLocaleString("en-NG")}</div>
                    <div className="text-[11.5px] text-ink-3">{u.ended_on ? `Left ${formatDate(u.ended_on)}` : `Since ${formatDate(u.started_on)}`}</div>
                  </li>
                ))}
              </ul>
            )}
            {active && b.current === 0 && approve && (
              <div className="mt-3"><Alert tone="good" title="Every animal is accounted for" action={<Button variant="primary" onClick={() => setOpen("close")}><CheckCircle2 size={16} /> Close batch</Button>}>
                Close it to freeze the summary.</Alert></div>
            )}
          </Card>

          <Card title="Records" meta="Every change to the count. Wrong entries are voided, never deleted.">
            <ol className="flex flex-col">
              {b.events.map((e) => (
                <li key={e.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line py-2.5 first:border-0", e.voided_at && "opacity-50")}>
                  <span className={cn("w-[72px] shrink-0 text-right font-mono font-semibold tnum", e.signed > 0 ? "text-good" : e.signed < 0 ? "text-crit" : "text-ink-2")}>
                    {e.signed > 0 ? "+" : ""}{e.signed.toLocaleString("en-NG")}</span>
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <div className={cn("text-[13.5px]", e.voided_at && "line-through")}>
                      <b>{evLabel(e.kind)}</b>{e.unit_code ? ` · ${e.unit_code}` : ""}{e.reason ? ` · ${e.reason}` : ""}
                      {e.related_code && <> · <Link className="font-semibold text-brand" href={`/w/${ws.orgId}/batches/${e.related_batch_id}`}>{e.related_code}</Link></>}
                      {e.amount != null && ` · ${naira(Number(e.amount))}`}{e.weight_kg != null && ` · ${Number(e.weight_kg)} kg`}
                    </div>
                    {e.note && <div className="text-[12.5px] text-ink-2">{e.note}</div>}
                    {e.voided_at && <div className="text-[12.5px] text-crit">Voided: {e.void_reason}</div>}
                    <div className="text-[12px] text-ink-3">{formatDate(e.occurred_on)} · {e.created_by_name ?? "Oko"}</div>
                  </div>
                  {e.can_void && <Button size="sm" variant="ghost" onClick={() => setVoiding(e.id)}><Undo2 size={14} /> Void</Button>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title={active ? "Results so far" : "Close-out summary"} meta={active ? "Updates with every record." : `Frozen on ${formatDate(b.closed_on)}.`}>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[13.5px]">
              <dt className="text-ink-3">Stocked</dt><dd className="text-right font-semibold tnum">{s?.total_in.toLocaleString("en-NG")}</dd>
              <dt className="text-ink-3">Died</dt><dd className="text-right font-semibold tnum">{s?.died.toLocaleString("en-NG")} {s?.mortality_pct != null && <span className="text-ink-3">({s.mortality_pct}%)</span>}</dd>
              <dt className="text-ink-3">Culled · missing</dt><dd className="text-right font-semibold tnum">{s?.culled.toLocaleString("en-NG")} · {s?.missing.toLocaleString("en-NG")}</dd>
              <dt className="text-ink-3">Sold · home use</dt><dd className="text-right font-semibold tnum">{s?.sold.toLocaleString("en-NG")} · {s?.consumed.toLocaleString("en-NG")}</dd>
              {!!s?.transferred_out && <><dt className="text-ink-3">To other batches</dt><dd className="text-right font-semibold tnum">{s.transferred_out.toLocaleString("en-NG")}</dd></>}
              <dt className="text-ink-3">Survival</dt><dd className="text-right font-semibold">{s?.survival_pct ?? "—"}%</dd>
              <dt className="text-ink-3">Feed eaten</dt><dd className="text-right font-semibold tnum">{s?.feed_kg ? `${s.feed_kg.toLocaleString("en-NG")} kg` : "—"}</dd>
              <dt className="text-ink-3">Latest average weight</dt><dd className="text-right font-semibold tnum">{s?.latest_avg_weight_g ? `${s.latest_avg_weight_g.toLocaleString("en-NG")} g` : "—"}</dd>
              {!!s?.eggs && <><dt className="text-ink-3">Eggs collected</dt><dd className="text-right font-semibold tnum">{s.eggs.toLocaleString("en-NG")}{s.cracked_eggs ? ` (${s.cracked_eggs} cracked)` : ""}</dd></>}
              <dt className="text-ink-3">Feed conversion (FCR)</dt><dd className="text-right font-semibold">{s?.fcr ?? "—"}</dd>
              {money && s && <>
                <dt className="mt-2 border-t border-line pt-2 text-ink-3">Purchase cost{s.cost_in || s.cost_out ? " (after transfers)" : ""}</dt>
                <dd className="mt-2 border-t border-line pt-2 text-right font-semibold tnum">{naira((s.cost_so_far ?? 0) - (s.inputs_cost ?? 0))}</dd>
                {Object.entries(s.inputs_by_category ?? {}).map(([k, v]) => (
                  <Fragment key={k}><dt className="text-ink-3">{stockCats.data?.categories[k] ?? k} from stock</dt><dd className="text-right font-semibold tnum">{naira(v)}</dd></Fragment>
                ))}
                {!!s.inputs_cost && <><dt className="text-ink-3">Total cost so far</dt><dd className="text-right font-semibold tnum">{naira(s.cost_so_far ?? 0)}</dd></>}
                <dt className="text-ink-3">Sales</dt><dd className="text-right font-semibold tnum">{naira(s.sales_amount ?? 0)}</dd>
                {Object.entries(s.other_sales ?? {}).map(([k, v]) => (
                  <Fragment key={k}><dt className="pl-3 text-[12.5px] text-ink-3">of which {k}</dt><dd className="text-right text-[12.5px] text-ink-3 tnum">{naira(v)}</dd></Fragment>
                ))}
                <dt className="font-semibold">Result so far</dt>
                <dd className={cn("text-right font-bold tnum", (s.result_so_far ?? 0) < 0 ? "text-crit" : "text-good")}>{naira(s.result_so_far ?? 0)}</dd>
                {s.cost_per_head_in != null && <><dt className="text-ink-3">Cost per head stocked</dt><dd className="text-right tnum">{naira(s.cost_per_head_in)}</dd></>}
              </>}
            </dl>
            {s?.pending.length ? <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-ink-3">{s.pending.map((p) => <li key={p}>• {p}</li>)}</ul> : null}
          </Card>

          {b.links.length > 0 && (
            <Card title="Lineage">
              <ul className="flex flex-col gap-2 text-[13.5px]">
                {b.links.map((l, i) => (
                  <li key={i}>{l.direction === "from" ? "Came from " : "Gave "}{l.direction === "to" && `${l.quantity.toLocaleString("en-NG")} to `}
                    <Link className="font-mono font-semibold text-brand" href={`/w/${ws.orgId}/batches/${l.batch_id}`}>{l.batch_code}</Link>
                    {l.direction === "from" && ` (${l.quantity.toLocaleString("en-NG")})`} · {l.kind} · {formatDate(l.occurred_on)}</li>
                ))}
              </ul>
            </Card>
          )}

          {!active && ws.can("farm.setup") && b.close_note?.startsWith("Merged into") !== true && (
            <Button onClick={() => setOpen("reopen")}><RotateCcw size={16} /> Reopen to correct</Button>
          )}
          {b.notes && <Card title="Notes"><p className="whitespace-pre-line text-[13.5px] text-ink-2">{b.notes}</p></Card>}
        </div>
      </div>

      <InvoiceDialog open={selling} onClose={() => setSelling(false)} batchId={b.id} />
      <RecordDialog batch={b} open={open === "loss" || open === "other"} mode={open === "other" ? "other" : "loss"} onClose={() => setOpen(null)}
        saleWarning={meatHolds.length ? <HoldList compact showBatch={false} holds={meatHolds} title="These animals cannot be sold or eaten yet" /> : undefined} />
      <MoveDialog batch={b} open={open === "move"} onClose={() => setOpen(null)} />
      <SplitDialog batch={b} open={open === "split"} onClose={() => setOpen(null)} onDone={go} />
      <MergeDialog batch={b} open={open === "merge"} onClose={() => setOpen(null)} onDone={go} />
      <CloseDialog batch={b} open={open === "close"} onClose={() => setOpen(null)} />
      <ReasonDialog title={`Reopen ${b.code}`} open={open === "reopen"} onClose={() => setOpen(null)} saveLabel="Reopen" loading={reopen.isPending}
        hint="Reopening unfreezes the summary so records can be corrected. Close it again afterwards."
        onSave={async (reason) => { await reopen.mutateAsync(reason); toast(`Reopened ${b.code}`); }} />
      <ReasonDialog title="Void this record" open={!!voiding} onClose={() => setVoiding(null)} saveLabel="Void record" loading={voidRecord.isPending}
        hint="It stays in the list, crossed out, and the count is corrected."
        onSave={async (reason) => { await voidRecord.mutateAsync({ eventId: voiding!, reason }); toast("Record voided"); }} />
    </>
  );
}
