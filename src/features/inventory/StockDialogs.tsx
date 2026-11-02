"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay } from "@/features/daily/api";
import { newId } from "@/features/offline/queue";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import {
  type StockItem, qty, useCount, useCreateItem, useInventoryCatalog, useIssue, useReceive, useStockItem, useStockItems, useUpdateItem, useWriteOff,
} from "./api";

const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));
const dec = (v: string) => v.replace(/[^\d.]/g, "");
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save.");

function Shell({ open, onClose, title, children, save, saving, disabled, error, label = "Save" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; save: () => void; saving: boolean; disabled?: boolean; error: string | null; label?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} eyebrow="Stock"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={disabled} onClick={save}>{label}</Button></>}>
      <div className="flex flex-col gap-4">{error && <Alert tone="crit">{error}</Alert>}{children}</div>
    </Dialog>
  );
}

function ItemSelect({ items, value, onChange, id }: { items?: StockItem[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose an item</option>
      {items?.map((i) => <option key={i.id} value={i.id}>{i.name} · {qty(i.in_stock, i)} in stock</option>)}
    </Select>
  );
}

/** Amount in the item's unit, or in packs when it has a pack size. */
function Amount({ item, value, onChange, mode, setMode, label = "How much" }: {
  item?: StockItem; value: string; onChange: (v: string) => void; mode: "packs" | "units"; setMode: (m: "packs" | "units") => void; label?: string;
}) {
  const packs = !!item?.pack_size && !!item.pack_name;
  const total = item && value ? (mode === "packs" && packs ? Number(value) * item.pack_size! : Number(value)) : null;
  return (
    <div className="flex flex-col gap-2">
      {packs && <Segmented value={mode} onChange={setMode} options={[{ value: "packs", label: `${item!.pack_name}s of ${item!.pack_size} ${item!.unit}` }, { value: "units", label: item!.unit }]} />}
      <Field label={`${label} (${mode === "packs" && packs ? `${item!.pack_name}s` : item?.unit ?? "units"})`} htmlFor="s-amount"
        hint={total != null && mode === "packs" && packs ? `= ${total.toLocaleString("en-NG")} ${item!.unit}` : undefined}>
        <Input id="s-amount" inputMode="decimal" value={value} onChange={(e) => onChange(dec(e.target.value))} />
      </Field>
    </div>
  );
}

export function ItemDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item?: StockItem | null }) {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const create = useCreateItem(ws.orgId);
  const update = useUpdateItem(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ name: "", category: "feed", unit: "kg", pack_name: "bag", pack_size: "25", reorder_level: "", reorder_qty: "", supplier: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(item ? { name: item.name, category: item.category, unit: item.unit, pack_name: item.pack_name ?? "", pack_size: item.pack_size?.toString() ?? "",
      reorder_level: item.reorder_level?.toString() ?? "", reorder_qty: item.reorder_qty?.toString() ?? "", supplier: item.supplier ?? "" }
      : { name: "", category: "feed", unit: "kg", pack_name: "bag", pack_size: "25", reorder_level: "", reorder_qty: "", supplier: "" });
  }, [open, item]);
  const save = async () => {
    setError(null);
    const body = { name: f.name.trim(), category: f.category, pack_name: f.pack_name || null, pack_size: n(f.pack_size),
      reorder_level: n(f.reorder_level), reorder_qty: n(f.reorder_qty), supplier: f.supplier || null };
    try {
      if (item) { await update.mutateAsync({ id: item.id, ...body }); toast(`Saved ${body.name}`); }
      else { await create.mutateAsync({ ...body, unit: f.unit }); toast(`Added ${body.name}`); }
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Shell open={open} onClose={onClose} title={item ? `Edit ${item.name}` : "Add a stock item"} save={save} saving={create.isPending || update.isPending}
      disabled={f.name.trim().length < 2} error={error}>
      <Field label="Name" htmlFor="i-name" hint="As you call it, e.g. Broiler starter (Top Feeds), Amprolium 20%"><Input id="i-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor="i-cat"><Select id="i-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {Object.entries(cat.data?.categories ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Counted in" htmlFor="i-unit" hint={item ? "Fixed once stock is recorded" : "Feed: kg, so feed logs come off stock"}>
          <Select id="i-unit" value={f.unit} disabled={!!item} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {Object.entries(cat.data?.units ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Pack" htmlFor="i-pack" hint="Optional: bag, carton, bottle"><Input id="i-pack" value={f.pack_name} onChange={(e) => setF({ ...f, pack_name: e.target.value })} /></Field>
        <Field label={`${f.unit} in one ${f.pack_name || "pack"}`} htmlFor="i-size"><Input id="i-size" inputMode="decimal" value={f.pack_size} onChange={(e) => setF({ ...f, pack_size: dec(e.target.value) })} /></Field>
        <Field label={`Reorder at (${f.unit})`} htmlFor="i-reorder" hint="Alert when stock falls to this"><Input id="i-reorder" inputMode="decimal" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: dec(e.target.value) })} /></Field>
        <Field label={`Usual order (${f.unit})`} htmlFor="i-reorder-qty" hint="Optional"><Input id="i-reorder-qty" inputMode="decimal" value={f.reorder_qty} onChange={(e) => setF({ ...f, reorder_qty: dec(e.target.value) })} /></Field>
      </div>
      <Field label="Usual supplier" htmlFor="i-supplier" hint="Optional"><Input id="i-supplier" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></Field>
    </Shell>
  );
}

export function ReceiveDialog({ open, onClose, itemId }: { open: boolean; onClose: () => void; itemId?: string }) {
  const ws = useCurrentWorkspace();
  const items = useStockItems(ws.orgId, undefined, open);
  const receive = useReceive(ws.orgId);
  const toast = useToast();
  const money = ws.can("finance.view");
  const [f, setF] = useState({ item: "", amount: "", price: "", priceMode: "total" as "total" | "unit", on: localDay(), supplier: "", reference: "", lot: "", expires: "" });
  const [mode, setMode] = useState<"packs" | "units">("packs");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ item: itemId ?? "", amount: "", price: "", priceMode: "total", on: localDay(), supplier: "", reference: "", lot: "", expires: "" }); } }, [open, itemId]);
  const it = items.data?.find((i) => i.id === f.item);
  const packs = mode === "packs" && !!it?.pack_size && !!it.pack_name;
  const total = it && f.amount ? (packs ? Number(f.amount) * it.pack_size! : Number(f.amount)) : 0;
  const save = async () => {
    setError(null);
    try {
      await receive.mutateAsync({ item_id: f.item, received_on: f.on, ...(packs ? { packs: n(f.amount) } : { quantity: n(f.amount) }),
        ...(f.price ? (f.priceMode === "total" ? { total_cost: n(f.price) } : { unit_cost: n(f.price) }) : {}),
        supplier: f.supplier || null, reference: f.reference || null, lot_number: f.lot || null, expires_on: f.expires || null, client_id: newId() });
      toast(`Received ${qty(total, it!)} of ${it!.name}`);
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Shell open={open} onClose={onClose} title="Receive a delivery" save={save} saving={receive.isPending} disabled={!f.item || !total} error={error}>
      <Field label="Item" htmlFor="r-item"><ItemSelect id="r-item" items={items.data} value={f.item} onChange={(v) => setF({ ...f, item: v, supplier: f.supplier || items.data?.find((i) => i.id === v)?.supplier || "" })} /></Field>
      {it && <Amount item={it} value={f.amount} onChange={(v) => setF({ ...f, amount: v })} mode={mode} setMode={setMode} label="How much came" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Delivered on" htmlFor="r-on"><Input id="r-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <Field label="Expires" htmlFor="r-exp" hint="From the pack or label, if any"><Input id="r-exp" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
      </div>
      {money && (
        <div className="grid gap-3 rounded-xl border border-line p-3.5">
          <Segmented value={f.priceMode} onChange={(v) => setF({ ...f, priceMode: v })} options={[{ value: "total", label: "Total paid" }, { value: "unit", label: `Price per ${it?.unit ?? "unit"}` }]} />
          <Field label={f.priceMode === "total" ? "Total for this delivery (₦)" : `₦ per ${it?.unit ?? "unit"}`} htmlFor="r-price"
            hint={f.price && total ? (f.priceMode === "total" ? `${naira(Number(f.price) / total)} per ${it?.unit}` : `${naira(Number(f.price) * total)} in total`) : "Feed costs per batch use this price. You can add it later."}>
            <Input id="r-price" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: dec(e.target.value) })} />
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Supplier" htmlFor="r-supplier"><Input id="r-supplier" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></Field>
        <Field label="Invoice / waybill no." htmlFor="r-ref" hint="Optional"><Input id="r-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Lot no. on pack" htmlFor="r-lot" hint="Optional"><Input id="r-lot" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /></Field>
      </div>
    </Shell>
  );
}

export function IssueDialog({ open, onClose, itemId, batchId }: { open: boolean; onClose: () => void; itemId?: string; batchId?: string }) {
  const ws = useCurrentWorkspace();
  const items = useStockItems(ws.orgId, undefined, open);
  const batches = useBatches(ws.orgId, "active", open);
  const issue = useIssue(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ item: "", amount: "", batch: "", on: localDay(), note: "" });
  const [mode, setMode] = useState<"packs" | "units">("units");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ item: itemId ?? "", amount: "", batch: batchId ?? "", on: localDay(), note: "" }); } }, [open, itemId, batchId]);
  const it = items.data?.find((i) => i.id === f.item);
  const packs = mode === "packs" && !!it?.pack_size && !!it.pack_name;
  const save = async () => {
    setError(null);
    try {
      const r = await issue.mutateAsync({ item_id: f.item, occurred_on: f.on, ...(packs ? { packs: n(f.amount) } : { quantity: n(f.amount) }),
        batch_id: f.batch || null, note: f.note || null, client_id: newId() });
      const b = batches.data?.find((x) => x.id === f.batch);
      toast(`Used ${qty(r.quantity, it!)} of ${it!.name}${b ? ` for ${b.code}` : ""}` + (r.cost_amount != null && ws.can("finance.view") ? ` · ${naira(r.cost_amount)}` : ""));
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Shell open={open} onClose={onClose} title="Use stock" save={save} saving={issue.isPending} disabled={!f.item || !n(f.amount)} error={error}>
      <p className="-mt-1 text-[13px] text-ink-3">Feed given on Today comes off stock by itself when you pick the feed there. Use this for medicine, litter, fuel and the like.</p>
      <Field label="Item" htmlFor="u-item"><ItemSelect id="u-item" items={items.data} value={f.item} onChange={(v) => setF({ ...f, item: v })} /></Field>
      {it && <Amount item={it} value={f.amount} onChange={(v) => setF({ ...f, amount: v })} mode={mode} setMode={setMode} label="How much was used" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="For which batch" htmlFor="u-batch" hint="Its cost goes on that batch">
          <Select id="u-batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}>
            <option value="">General use (no batch)</option>
            {batches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.units.filter((u) => !u.ended_on).map((u) => u.unit_code).join(", ")}</option>)}
          </Select></Field>
        <Field label="On" htmlFor="u-on"><Input id="u-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
      </div>
      <Field label="Note" htmlFor="u-note" hint="Optional"><Input id="u-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </Shell>
  );
}

export function CountDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: StockItem | null }) {
  const ws = useCurrentWorkspace();
  const count = useCount(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ counted: "", note: "" });
  const [mode, setMode] = useState<"packs" | "units">("units");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ counted: "", note: "" }); } }, [open]);
  if (!item) return null;
  const packs = mode === "packs" && !!item.pack_size && !!item.pack_name;
  const counted = f.counted === "" ? null : packs ? Number(f.counted) * item.pack_size! : Number(f.counted);
  const diff = counted == null ? null : counted - item.in_stock;
  const save = async () => {
    setError(null);
    try {
      const r = await count.mutateAsync({ item_id: item.id, counted, counted_on: localDay(), note: f.note || null });
      toast(r[0]?.status === "pending" ? "Count saved. It waits for a supervisor to approve." : `Stock of ${item.name} corrected`);
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Shell open={open} onClose={onClose} title={`Count ${item.name}`} save={save} saving={count.isPending} disabled={counted == null || diff === 0} error={error}
      label={ws.can("inventory.approve") ? "Correct stock" : "Send for approval"}>
      <p className="text-[13.5px] text-ink-2">The records say <b>{qty(item.in_stock, item)}</b>. Count what is in the store now.</p>
      <Amount item={item} value={f.counted} onChange={(v) => setF({ ...f, counted: v })} mode={mode} setMode={setMode} label="Counted" />
      {diff != null && diff !== 0 && <Alert tone={diff < 0 ? "warn" : "info"}>{diff < 0 ? `${qty(-diff, item)} less than the records` : `${qty(diff, item)} more than the records`}</Alert>}
      <Field label="Note" htmlFor="c-note" hint="Optional"><Textarea id="c-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </Shell>
  );
}

export function WriteOffDialog({ open, onClose, item, lotId }: { open: boolean; onClose: () => void; item: StockItem | null; lotId?: string | null }) {
  const ws = useCurrentWorkspace();
  const cat = useInventoryCatalog();
  const detail = useStockItem(ws.orgId, open && item ? item.id : null);
  const writeOff = useWriteOff(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState({ amount: "", lot: "", reason: "Expired", note: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF({ amount: "", lot: lotId ?? "", reason: lotId ? "Expired" : "Spoilt or wet", note: "" }); } }, [open, lotId]);
  const lots = useMemo(() => (detail.data?.lots ?? []).filter((l) => !l.voided_at && l.remaining > 0), [detail.data]);
  useEffect(() => {
    const l = lots.find((x) => x.id === f.lot);
    if (l && !f.amount) setF((x) => ({ ...x, amount: String(l.remaining) }));
  }, [lots, f.lot, f.amount]);
  if (!item) return null;
  const save = async () => {
    setError(null);
    try {
      const r = await writeOff.mutateAsync({ item_id: item.id, quantity: n(f.amount), lot_id: f.lot || null, occurred_on: localDay(), reason: f.reason, note: f.note || null });
      toast(r[0]?.status === "pending" ? "Write-off saved. It waits for a supervisor to approve." : `Wrote off ${qty(Number(f.amount), item)} of ${item.name}`);
      onClose();
    } catch (e) { setError(errMsg(e)); }
  };
  return (
    <Shell open={open} onClose={onClose} title={`Write off ${item.name}`} save={save} saving={writeOff.isPending} disabled={!n(f.amount)} error={error}
      label={ws.can("inventory.approve") ? "Write off" : "Send for approval"}>
      <Field label="Which delivery" htmlFor="w-lot" hint="Pick the expired or spoilt one if you know it">
        <Select id="w-lot" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value, amount: "" })}>
          <option value="">Oldest first</option>
          {lots.map((l) => <option key={l.id} value={l.id}>{new Date(l.received_on).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {qty(l.remaining, item)} left{l.expires_on ? ` · expires ${new Date(l.expires_on + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}</option>)}
        </Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`How much (${item.unit})`} htmlFor="w-amount"><Input id="w-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
        <Field label="Why" htmlFor="w-reason"><Select id="w-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
          {cat.data?.write_off_reasons.map((r) => <option key={r}>{r}</option>)}</Select></Field>
      </div>
      <Field label="Note" htmlFor="w-note" hint="Optional"><Input id="w-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </Shell>
  );
}
