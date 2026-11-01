"use client";

import { useState } from "react";
import { Alert, Badge, Button, Dialog, Field, Input, PageLoader, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type Lot, type Move, type StockItem, qty, usePriceLot, useStockItem, useVoidLot } from "./api";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });
const KIND: Record<string, string> = { receive: "Received", issue: "Used", adjust: "Count", write_off: "Written off" };

/** One item: what is in which delivery, at what price, and every movement. */
export function ItemSheet({ itemId, onClose, onAction }: {
  itemId: string | null; onClose: () => void; onAction: (a: "receive" | "use" | "count" | "writeoff" | "edit", item: StockItem, lotId?: string) => void;
}) {
  const ws = useCurrentWorkspace();
  const q = useStockItem(ws.orgId, itemId);
  const [pricing, setPricing] = useState<Lot | null>(null);
  const it = q.data;
  const edit = ws.can("inventory.edit");
  const money = ws.can("finance.view");
  return (
    <Dialog open={!!itemId} onClose={onClose} side title={it?.name ?? "Stock item"} eyebrow="Stock item">
      {!it ? <PageLoader /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-3"><div className="text-[12px] text-ink-3">In stock</div>
              <div className={cn("font-display text-[20px] font-bold tnum", it.in_stock < 0 && "text-crit")}>{qty(it.in_stock, it)}</div>
              {it.reorder && <Badge tone="warn">Reorder</Badge>}</div>
            <div className="rounded-xl border border-line p-3"><div className="text-[12px] text-ink-3">{money ? "Value at cost" : "Deliveries in stock"}</div>
              <div className="font-display text-[20px] font-bold tnum">{money ? (it.value != null ? naira(it.value) : "—") : it.open_lots}</div>
              {money && it.avg_unit_cost != null && <div className="text-[12px] text-ink-3">{naira(it.avg_unit_cost)} per {it.unit} on average</div>}</div>
          </div>
          {it.unrecorded > 0 && <Alert tone="warn" title={`${qty(it.unrecorded, it)} used but not in stock`}>Record the delivery it came from. It will cover this first and price it.</Alert>}
          {edit && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="primary" onClick={() => onAction("receive", it)}>Receive</Button>
              <Button size="sm" onClick={() => onAction("use", it)}>Use</Button>
              <Button size="sm" onClick={() => onAction("count", it)}>Count</Button>
              <Button size="sm" onClick={() => onAction("writeoff", it)}>Write off</Button>
              <Button size="sm" variant="ghost" onClick={() => onAction("edit", it)}>Edit item</Button>
            </div>
          )}
          <section>
            <h3 className="eyebrow mb-2">Deliveries</h3>
            {it.lots.length === 0 ? <p className="text-[13.5px] text-ink-3">No deliveries recorded yet.</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {it.lots.map((l) => <LotRow key={l.id} l={l} it={it} onPrice={() => setPricing(l)} onWriteOff={() => onAction("writeoff", it, l.id)} />)}
              </ul>
            )}
          </section>
          <section>
            <h3 className="eyebrow mb-2">Movements</h3>
            <ul className="flex flex-col divide-y divide-line">{it.moves.map((m) => <MoveRow key={m.id} m={m} it={it} />)}</ul>
          </section>
        </div>
      )}
      <PriceDialog lot={pricing} item={it} onClose={() => setPricing(null)} />
    </Dialog>
  );
}

function LotRow({ l, it, onPrice, onWriteOff }: { l: Lot; it: StockItem; onPrice: () => void; onWriteOff: () => void }) {
  const ws = useCurrentWorkspace();
  const voidLot = useVoidLot(ws.orgId);
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const expired = !!l.expires_on && l.expires_on < today;
  const soon = !!l.expires_on && !expired && new Date(l.expires_on).getTime() - Date.now() < 30 * 86400000;
  const used = l.remaining !== l.quantity;
  return (
    <li className={cn("flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5", (l.voided_at || l.remaining <= 0) && "opacity-55")}>
      <div className="w-[52px] shrink-0 font-mono text-[12px] text-ink-3">{day(l.received_on)}</div>
      <div className="min-w-0 flex-1 basis-[180px]">
        <div className="text-[13.5px]"><b className="tnum">{qty(l.remaining, it)}</b> <span className="text-ink-3">left of {qty(l.quantity, it)}</span></div>
        <div className="text-[12px] text-ink-3">{[l.supplier, l.reference && `inv. ${l.reference}`, l.lot_number && `lot ${l.lot_number}`].filter(Boolean).join(" · ")}
          {l.voided_at && " · voided"}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {expired && l.remaining > 0 && <Badge tone="crit">Expired {day(l.expires_on!)}</Badge>}
          {soon && l.remaining > 0 && <Badge tone="warn">Expires {day(l.expires_on!)}</Badge>}
          {ws.can("finance.view") && (l.unit_cost != null ? <Badge>{naira(l.unit_cost)} / {it.unit}</Badge> : <Badge tone="warn">No price</Badge>)}
        </div>
      </div>
      <div className="flex gap-1">
        {ws.can("finance.edit") && !l.voided_at && <Button size="sm" variant="ghost" onClick={onPrice}>{l.unit_cost == null ? "Add price" : "Price"}</Button>}
        {expired && l.remaining > 0 && ws.can("inventory.edit") && <Button size="sm" variant="danger" onClick={onWriteOff}>Write off</Button>}
        {!used && !l.voided_at && ws.can("inventory.edit") && <Button size="sm" variant="ghost" loading={voidLot.isPending} onClick={async () => {
          try { await voidLot.mutateAsync({ id: l.id, reason: "Entered by mistake" }); toast("Delivery voided"); }
          catch (e) { toast(e instanceof ApiError ? e.message : "Could not void", "crit"); }
        }}>Void</Button>}
      </div>
    </li>
  );
}

function MoveRow({ m, it }: { m: Move; it: StockItem }) {
  const neg = m.quantity < 0;
  return (
    <li className={cn("flex items-start gap-3 py-2", (m.voided_at || m.status === "rejected") && "opacity-50")}>
      <div className="w-[52px] shrink-0 font-mono text-[12px] text-ink-3">{day(m.occurred_on)}</div>
      <div className="min-w-0 flex-1 text-[13px]">
        <b>{KIND[m.kind] ?? m.kind}</b>{m.batch_code && <> · {m.batch_code}{m.unit_code ? ` (${m.unit_code})` : ""}</>}{m.reason && ` · ${m.reason}`}
        {m.status !== "posted" && <Badge tone={m.status === "pending" ? "warn" : "neutral"} className="ml-1.5">{m.status === "pending" ? "Waiting for approval" : "Rejected"}</Badge>}
        {m.shortfall && !m.lot_id && <Badge tone="warn" className="ml-1.5">Not in recorded stock</Badge>}
        <div className="text-[12px] text-ink-3">{[m.lot_label, m.created_by_name, m.record_id && "from a feed log", m.voided_at && `voided: ${m.void_reason}`].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="text-right">
        <div className={cn("font-mono text-[13px] font-semibold tnum", neg ? "text-crit" : "text-good")}>{neg ? "" : "+"}{qty(m.quantity, { ...it, pack_name: null })}</div>
        {m.cost_amount != null && <div className="font-mono text-[11.5px] text-ink-3">{naira(m.cost_amount)}</div>}
      </div>
    </li>
  );
}

function PriceDialog({ lot, item, onClose }: { lot: Lot | null; item?: StockItem; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const price = usePriceLot(ws.orgId);
  const toast = useToast();
  const [total, setTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!lot || !item) return null;
  return (
    <Dialog open={!!lot} onClose={() => { setTotal(""); setError(null); onClose(); }} title="Delivery price" eyebrow={`${item.name} · ${day(lot.received_on)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={price.isPending} disabled={!Number(total)} onClick={async () => {
        try { await price.mutateAsync({ id: lot.id, total_cost: Number(total) }); toast("Price saved; what was used from it is priced too"); setTotal(""); onClose(); }
        catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
      }}>Save price</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13.5px] text-ink-2">{qty(lot.quantity, item)} delivered. Enter what was paid for the whole delivery; feed already used from it gets this price on its batch.</p>
        <Field label="Total paid (₦)" htmlFor="p-total" hint={Number(total) ? `${naira(Number(total) / lot.quantity)} per ${item.unit}` : undefined}>
          <Input id="p-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
      </div>
    </Dialog>
  );
}
