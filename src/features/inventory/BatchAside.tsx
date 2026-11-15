"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Dialog, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/format";
import { type AssignedStock, type Lot, type StockItem, qty, useBatchAssigned, useLotBatches } from "./api";
import { ASIDE_HINT, BatchPick } from "./BatchPick";
import { ReceiveDialog } from "./StockDialogs";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/** Change which batches a delivery is set aside for. */
export function LotBatchesDialog({ lot, item, onClose }: { lot: Lot | null; item?: StockItem; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const save = useLotBatches(ws.orgId);
  const toast = useToast();
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (lot) { setIds(lot.batch_ids ?? []); setError(null); } }, [lot]);
  return (
    <Dialog open={!!lot} onClose={onClose} title="Set aside for batches" eyebrow="Stock"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} onClick={async () => {
          try {
            await save.mutateAsync({ id: lot!.id, batch_ids: ids });
            toast(ids.length ? `Set aside for ${ids.length} batch${ids.length > 1 ? "es" : ""}` : "No longer set aside for a batch");
            onClose();
          } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        {lot && item && <p className="text-[13.5px] text-ink-2">{item.name}: delivered {day(lot.received_on)}, {qty(lot.remaining, item)} left of {qty(lot.quantity, item)}.</p>}
        <BatchPick value={ids} onChange={setIds} open={!!lot} />
        <p className="text-[12.5px] text-ink-3">{ASIDE_HINT}</p>
      </div>
    </Dialog>
  );
}

/** Batch page: the stock set aside for this batch, what is left, and about how long it lasts. */
export function AssignedStockCard({ batchId, active }: { batchId: string; active: boolean }) {
  const ws = useCurrentWorkspace();
  const visible = ws.has("inventory") && (ws.can("inventory.view") || ws.can("farm.view"));
  const q = useBatchAssigned(ws.orgId, batchId, visible);
  const [adding, setAdding] = useState(false);
  const edit = active && ws.can("inventory.edit");
  if (!visible || !q.data || (!q.data.length && !edit)) return null;
  return (
    <Card title="Stock for this batch"
      meta="Deliveries set aside for this batch. It uses these first; other batches can still use them."
      action={edit ? <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>Receive for this batch</Button> : undefined}>
      {!q.data.length ? (
        <p className="text-[13.5px] text-ink-3">Nothing set aside yet. When feed or drugs arrive, pick this batch on the delivery, or set an existing delivery aside from Stock.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">{q.data.map((r) => <Row key={r.item_id} r={r} />)}</ul>
      )}
      <ReceiveDialog open={adding} onClose={() => setAdding(false)} batchId={batchId} />
    </Card>
  );
}

function Row({ r }: { r: AssignedStock }) {
  const [more, setMore] = useState(false);
  const pct = r.delivered > 0 ? Math.max(0, Math.min(100, (r.remaining / r.delivered) * 100)) : 0;
  const tone = r.status === "out" ? "crit" : r.status === "low" ? "warn" : "good";
  const badge = r.status === "ok" && r.days_left == null ? "neutral" : tone;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <b className="text-[14px]">{r.item_name}</b>
          <div className="text-[13px] text-ink-2"><b className="tnum text-ink">{qty(r.remaining, r)}</b> left of {qty(r.delivered, r)}</div>
        </div>
        <Badge tone={badge}>
          {r.status === "out" ? "Used up" : r.days_left != null ? `About ${r.days_left} day${r.days_left === 1 ? "" : "s"} left` : "Not used this week"}
        </Badge>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${Math.round(pct)}% left`}>
        <div className={cn("h-full rounded-full", tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3">
        <span>This batch used {qty(r.used_by_batch, r)}</span>
        {r.used_by_others > 0 && <span>Others used {qty(r.used_by_others, r)}</span>}
        {r.per_day != null && <span>Using about {qty(r.per_day, r)} a day</span>}
        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? "Hide deliveries" : `${r.lots.length} deliver${r.lots.length === 1 ? "y" : "ies"}`}
        </button>
      </div>
      {more && (
        <ul className="mt-2 flex flex-col gap-1 rounded-[12px] bg-surface-2 p-2.5 text-[12.5px]">
          {r.lots.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-x-3">
              <span>{day(l.received_on)}{l.supplier ? ` · ${l.supplier}` : ""}{l.shared_with.length ? ` · shared with ${l.shared_with.join(", ")}` : ""}</span>
              <span className="tnum text-ink-2">{qty(l.remaining, r)} left of {qty(l.quantity, r)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
