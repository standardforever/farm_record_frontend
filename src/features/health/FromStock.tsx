"use client";

import { useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, Segmented, Select, useToast } from "@/components/ui";
import { type StockItem, qty, useStockItems } from "@/features/inventory/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { type StockUse, type Treatment, useTreatmentStock } from "./api";

/** Stock categories that hold things given to animals, best match for the treatment type first. */
const FOR_KIND: Record<string, string[]> = {
  vaccination: ["vaccine", "medicine", "supplement"],
  supplement: ["supplement", "medicine", "vaccine"],
};
const DEFAULT = ["medicine", "vaccine", "supplement"];
export const KIND_FOR_CATEGORY: Record<string, string> = { vaccine: "vaccination", supplement: "supplement", medicine: "medication" };

export type StockPick = { item: string; amount: string; packs: boolean };
export const noStock = (): StockPick => ({ item: "", amount: "", packs: true });

export function stockBody(p: StockPick, items: StockItem[] | undefined): StockUse {
  const it = items?.find((i) => i.id === p.item);
  const n = Number(p.amount);
  if (!it || !(n > 0)) return { stock_item_id: null };
  return p.packs && it.pack_size ? { stock_item_id: it.id, stock_packs: n } : { stock_item_id: it.id, stock_quantity: n };
}

export function useTreatmentItems(kind: string, enabled: boolean) {
  const ws = useCurrentWorkspace();
  const q = useStockItems(ws.orgId, undefined, enabled && ws.has("inventory"));
  const order = FOR_KIND[kind] ?? DEFAULT;
  const items = (q.data ?? []).filter((i) => i.active && order.includes(i.category))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  return { items, ready: !q.isLoading, on: ws.has("inventory") };
}

/** "Which product from your stock, and how much was used." Picking one fills the product name. */
export function FromStock({ kind, value, onChange, onPicked, open }: {
  kind: string; value: StockPick; onChange: (v: StockPick) => void; onPicked?: (it: StockItem | null) => void; open: boolean;
}) {
  const ws = useCurrentWorkspace();
  const { items, on } = useTreatmentItems(kind, open);
  if (!on) return null;
  const it = items.find((i) => i.id === value.item);
  const unit = it ? (value.packs && it.pack_size ? `${it.pack_name ?? "pack"}s` : it.unit) : "";
  const n = Number(value.amount) || 0;
  const base = it ? (value.packs && it.pack_size ? n * it.pack_size : n) : 0;
  const short = it && base > it.in_stock;
  return (
    <div className="rounded-[14px] border border-line bg-surface-2/60 p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold"><PackageOpen size={16} className="text-brand" aria-hidden /> From your stock</div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Field label="Product used" htmlFor="t-stock">
          <Select id="t-stock" value={value.item} onChange={(e) => {
            const next = items.find((i) => i.id === e.target.value) ?? null;
            onChange({ item: e.target.value, amount: value.amount, packs: !!next?.pack_size });
            onPicked?.(next);
          }}>
            <option value="">Not from stock</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {qty(i.in_stock, i)} left</option>)}
          </Select>
        </Field>
        {it && (
          <Field label={`How much was used (${unit})`} htmlFor="t-stock-qty"
            hint={short ? `Only ${qty(it.in_stock, it)} recorded in stock. It will still save.` : `${qty(it.in_stock, it)} in stock`}>
            <div className="flex gap-2">
              <Input id="t-stock-qty" inputMode="decimal" value={value.amount} className="min-w-0 flex-1"
                onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d.]/g, "") })} />
              {it.pack_size ? (
                <Segmented value={value.packs ? "p" : "u"} onChange={(v) => onChange({ ...value, packs: v === "p" })}
                  options={[{ value: "p", label: it.pack_name ?? "pack" }, { value: "u", label: it.unit }]} />
              ) : null}
            </div>
          </Field>
        )}
      </div>
      {!items.length && (
        <p className="mt-2 text-[12.5px] text-ink-3">No medicines or vaccines in stock yet. Add them in <a className="font-semibold text-brand" href={`/w/${ws.orgId}/stock`}>Stock</a> to take them out as you use them.</p>
      )}
      {it && <p className="mt-2 text-[12.5px] text-ink-3">It comes out of stock and is costed to this batch.</p>}
    </div>
  );
}

/** Treatment page: add, change or clear what it took from stock (a ticked vaccination starts with nothing). */
export function TreatmentStockDialog({ t, open, onClose }: { t: Treatment; open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const save = useTreatmentStock(ws.orgId);
  const toast = useToast();
  const { items } = useTreatmentItems(t.kind, open);
  const [pick, setPick] = useState<StockPick>(noStock());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    const s = t.stock;
    setPick(s ? { item: s.item_id, amount: String(s.pack_size ? +(s.quantity / s.pack_size).toFixed(3) : s.quantity), packs: !!s.pack_size } : noStock());
  }, [open, t.stock]);
  return (
    <Dialog open={open} onClose={onClose} title="Stock used" eyebrow={t.product}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} onClick={async () => {
          try {
            const r = await save.mutateAsync({ id: t.id, ...stockBody(pick, items) });
            toast(r.stock ? `${r.stock.item_name}: ${qty(r.stock.quantity, r.stock)} taken from stock` : "Nothing taken from stock");
            onClose();
          } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save."); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="crit">{error}</Alert>}
        <FromStock kind={t.kind} value={pick} onChange={setPick} open={open} />
        {t.stock && <p className="text-[12.5px] text-ink-3">What it took before goes back into stock first.</p>}
      </div>
    </Dialog>
  );
}
