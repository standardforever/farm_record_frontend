"use client";

import { useState } from "react";
import { Alert, Badge, Button, Dialog, Field, Input, PageLoader, Pager, usePager, useSlice, useToast } from "@/components/ui";
import { OwnerActions } from "@/features/corrections";
import { type PaymentChoice, PaymentFields, noPayment, paymentBody, paymentReady, useCanPay } from "@/features/finance/PaymentFields";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type Lot, type Move, type Payment, type StockItem, qty, useItemMoves, usePayLot, usePriceLot, useStockItem, useVoidLot } from "./api";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });
const KIND: Record<string, string> = { receive: "Received", issue: "Used", adjust: "Count", write_off: "Written off" };

/** One item: what is in which delivery, at what price, and every movement. */
export function ItemSheet({ itemId, onClose, onAction }: {
  itemId: string | null; onClose: () => void; onAction: (a: "receive" | "use" | "count" | "writeoff" | "edit", item: StockItem, lotId?: string) => void;
}) {
  const ws = useCurrentWorkspace();
  const q = useStockItem(ws.orgId, itemId);
  const [pricing, setPricing] = useState<Lot | null>(null);
  const [paying, setPaying] = useState<Lot | null>(null);
  const it = q.data;
  const pg = usePager(20, [itemId]);
  const moves = useItemMoves(ws.orgId, itemId, pg.params);
  // The sheet already carries the newest 20, so the first page shows at once (and offline).
  const moveRows = moves.data?.items ?? (pg.page === 1 ? it?.moves ?? [] : []);
  const lots = useSlice(it?.lots, 10, [itemId]);
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
          <OwnerActions kind="stock_item" id={it.id} className="-ml-2 -mt-2" onDeleted={onClose} />
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
                {lots.rows.map((l) => <LotRow key={l.id} l={l} it={it} onPrice={() => setPricing(l)} onPay={() => setPaying(l)} onWriteOff={() => onAction("writeoff", it, l.id)} />)}
              </ul>
            )}
            <Pager {...lots.pager} noun="deliveries" />
          </section>
          <section>
            <h3 className="eyebrow mb-2">Movements</h3>
            {moveRows.length === 0 ? <p className="text-[13.5px] text-ink-3">Nothing has moved yet.</p> : (
              <ul className="flex flex-col divide-y divide-line">{moveRows.map((m) => <MoveRow key={m.id} m={m} it={it} />)}</ul>
            )}
            <Pager {...pg.bind(moves.data?.total ?? (it.moves.length < 20 ? it.moves.length : undefined), moves.isFetching)} noun="movements" />
          </section>
        </div>
      )}
      <PriceDialog lot={pricing} item={it} onClose={() => setPricing(null)} />
      <PayLotDialog lot={paying} item={it} onClose={() => setPaying(null)} />
    </Dialog>
  );
}

function LotRow({ l, it, onPrice, onPay, onWriteOff }: { l: Lot; it: StockItem; onPrice: () => void; onPay: () => void; onWriteOff: () => void }) {
  const ws = useCurrentWorkspace();
  const canPay = useCanPay();
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
          {l.payment && !l.voided_at && <PaidBadge p={l.payment} />}
        </div>
      </div>
      <div className="flex gap-1">
        {ws.can("finance.edit") && !l.voided_at && <Button size="sm" variant="ghost" onClick={onPrice}>{l.unit_cost == null ? "Add price" : "Price"}</Button>}
        {canPay && !l.voided_at && !l.payment && l.unit_cost != null && ws.can("finance.view") && <Button size="sm" variant="ghost" onClick={onPay}>Record payment</Button>}
        {expired && l.remaining > 0 && ws.can("inventory.edit") && <Button size="sm" variant="danger" onClick={onWriteOff}>Write off</Button>}
        {!used && !l.voided_at && ws.can("inventory.edit") && <Button size="sm" variant="ghost" loading={voidLot.isPending} onClick={async () => {
          try { await voidLot.mutateAsync({ id: l.id, reason: "Entered by mistake" }); toast("Delivery voided"); }
          catch (e) { toast(e instanceof ApiError ? e.message : "Could not void", "crit"); }
        }}>Void</Button>}
        {!l.voided_at && <OwnerActions kind="stock_lot" id={l.id} compact />}
      </div>
    </li>
  );
}

export function PaidBadge({ p }: { p: Payment }) {
  return p.status === "paid" ? <Badge tone="good">Paid {naira(p.amount)}{p.account_name ? ` from ${p.account_name}` : ""}</Badge>
    : p.status === "owed" ? <Badge tone="warn">{naira(p.amount)} owed to supplier</Badge>
    : p.status === "pending" ? <Badge tone="warn">Payment waiting for approval</Badge> : <Badge>Payment rejected</Badge>;
}

function PayLotDialog({ lot, item, onClose }: { lot: Lot | null; item?: StockItem; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const pay = usePayLot(ws.orgId);
  const toast = useToast();
  const [p, setP] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const [lastLot, setLastLot] = useState<string | null>(null);
  if (lot && lot.id !== lastLot) { setLastLot(lot.id); setP(noPayment()); setError(null); }
  const amount = lot && lot.unit_cost != null ? Math.round(lot.unit_cost * lot.quantity * 100) / 100 : 0;
  const body = paymentBody(p, true);
  return (
    <Dialog open={!!lot} onClose={onClose} title="Record what was paid" eyebrow={item && lot ? `${item.name} · delivered ${day(lot.received_on)}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={pay.isPending} disabled={!body || !paymentReady(p, true)} onClick={async () => {
          if (!lot || !body) return;
          setError(null);
          try { await pay.mutateAsync({ id: lot.id, ...body }); toast(body.status === "paid" ? "Payment recorded" : "Recorded as owed"); onClose(); }
          catch (e) { setError(e instanceof ApiError ? e.message : "Could not record it"); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] text-ink-2">For deliveries recorded before payments were linked, or saved without one. Paid takes the money out of the account; the feed still counts as a cost only when it is used.</p>
        <PaymentFields value={p} onChange={setP} amount={amount} what="this delivery" purchasedOn={lot?.received_on} />
        {error && <Alert tone="crit" title={error} />}
      </div>
    </Dialog>
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
      {!m.voided_at && !m.record_id && m.kind !== "receive" && <OwnerActions kind="stock_move" id={m.id} compact edit={m.kind === "issue" || m.kind === "write_off"} />}
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
