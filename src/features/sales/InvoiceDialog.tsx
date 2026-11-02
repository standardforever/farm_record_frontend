"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { useBatches } from "@/features/batches";
import { localDay } from "@/features/daily/api";
import { newId } from "@/features/daily/queue";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { type Invoice, day, useCreateInvoice, useCustomers, useSalesCatalog } from "./api";

type Row = { key: string; product: string; batch: string; unit: string; qty: string; price: string; weight: string; desc: string; saleUnit: string };
const blankRow = (product = "animals", batch = ""): Row => ({ key: newId(), product, batch, unit: "", qty: "", price: "", weight: "", desc: "", saleUnit: "" });
const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/,/g, "")));
const dec = (v: string) => v.replace(/[^\d.]/g, "");

/** Record a sale: who bought, what (from which batch), and what was paid now. */
export function InvoiceDialog({ open, onClose, batchId, customerId, onCreated }: {
  open: boolean; onClose: () => void; batchId?: string; customerId?: string; onCreated?: (inv: Invoice) => void;
}) {
  const ws = useCurrentWorkspace();
  const cat = useSalesCatalog();
  const customers = useCustomers(ws.orgId, open);
  const batches = useBatches(ws.orgId, "active", open);
  const create = useCreateInvoice(ws.orgId);
  const toast = useToast();
  const [who, setWho] = useState({ id: "", name: "" });
  const [on, setOn] = useState(localDay());
  const [due, setDue] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [discount, setDiscount] = useState("");
  const [pay, setPay] = useState<{ mode: "full" | "part" | "credit"; amount: string; channel: string; reference: string }>({ mode: "full", amount: "", channel: "cash", reference: "" });
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setWho({ id: customerId ?? "", name: "" }); setOn(localDay()); setDue(""); setRows([blankRow("animals", batchId ?? "")]);
    setDiscount(""); setPay({ mode: "full", amount: "", channel: "cash", reference: "" }); setNotes(""); setOverride(false); setError(null);
  }, [open, batchId, customerId]);

  const cust = customers.data?.find((c) => c.id === who.id);
  useEffect(() => { if (cust && cust.terms_days > 0) setPay((p) => ({ ...p, mode: "credit" })); }, [cust]);
  const subtotal = useMemo(() => rows.reduce((a, r) => a + Math.round(num(r.qty) * num(r.price) * 100) / 100, 0), [rows]);
  const total = Math.max(subtotal - num(discount), 0);
  const paidNow = pay.mode === "full" ? total : pay.mode === "part" ? num(pay.amount) : 0;
  const dueOn = due || (() => { const d = new Date(on + "T12:00:00"); d.setDate(d.getDate() + (cust?.terms_days ?? 0)); return d.toISOString().slice(0, 10); })();
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ready = (who.id || who.name.trim().length > 1) && rows.length > 0 && total > 0 && rows.every((r) => {
    const p = cat.data?.products[r.product];
    return num(r.qty) > 0 && r.price !== "" && (!p?.needs_batch || !!r.batch);
  }) && (pay.mode !== "part" || paidNow > 0);

  const save = async () => {
    setError(null);
    try {
      const inv = await create.mutateAsync({
        customer_id: who.id || null, customer_name: who.id ? null : who.name.trim(), issued_on: on, due_on: due || null, discount: num(discount),
        lines: rows.map((r) => ({ product: r.product, batch_id: r.batch || null, unit_id: r.unit || null, quantity: num(r.qty), unit_price: num(r.price),
          weight_kg: r.product === "animals" && r.weight ? num(r.weight) : null, description: r.desc || null, ...(r.saleUnit ? { unit: r.saleUnit } : {}) })),
        paid_now: paidNow > 0 ? { amount: paidNow, channel: pay.channel, reference: pay.reference || null } : null,
        notes: notes || null, override_credit_limit: override, client_id: newId(),
      });
      toast(`${inv.number}: ${naira(inv.total)}${inv.status === "paid" ? ", paid" : inv.balance ? `, ${naira(inv.balance)} owed` : ""}`);
      onCreated?.(inv);
      onClose();
    } catch (e) { setError(e instanceof ApiError ? { message: e.message, code: e.code } : { message: "Could not save." }); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New sale" eyebrow="Sales" wide
      footer={<><span className="mr-auto font-display text-[18px] font-bold tnum">{naira(total)}</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={create.isPending} disabled={!ready} onClick={save}>Save sale</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error.message}</Alert>}
        {error?.code === "credit_limit" && ws.can("finance.approve") && (
          <Checkbox checked={override} onChange={setOverride} label="Allow it anyway" description="You can approve finance. This is recorded in the audit trail." />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Customer" htmlFor="s-cust" hint={cust ? (cust.outstanding ? `Owes ${naira(cust.outstanding)}${cust.overdue ? `, ${naira(cust.overdue)} overdue` : ""}` : cust.credit ? `${naira(cust.credit)} credit on account` : "Owes nothing") : undefined}>
            <Select id="s-cust" value={who.id || (who.name !== "" ? "__other" : "")} onChange={(e) => setWho(e.target.value === "__other" ? { id: "", name: " " } : { id: e.target.value, name: "" })}>
              <option value="">Choose…</option>
              {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__other">Someone else (type the name)</option>
            </Select>
          </Field>
          <Field label="Date" htmlFor="s-on"><Input id="s-on" type="date" max={localDay()} value={on} onChange={(e) => setOn(e.target.value)} /></Field>
          <Field label="Due" htmlFor="s-due" hint={cust?.terms_days ? `${cust.terms_days} days to pay` : "Pay on the day"}>
            <Input id="s-due" type="date" min={on} value={dueOn} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {!who.id && who.name !== "" && <Field label="Buyer's name" htmlFor="s-name"><Input id="s-name" autoFocus value={who.name.trim() ? who.name : ""} onChange={(e) => setWho({ id: "", name: e.target.value || " " })} placeholder="Walk-in buyer" /></Field>}

        <div className="flex flex-col gap-3">
          {rows.map((r, n) => {
            const p = cat.data?.products[r.product];
            const b = batches.data?.find((x) => x.id === r.batch);
            const units = (b?.units ?? []).filter((u) => !u.ended_on);
            const showBatch = p?.needs_batch || r.product === "meat" || r.product === "fish";
            return (
              <fieldset key={r.key} className="rounded-xl border border-line p-3">
                <legend className="sr-only">Item {n + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                  <Field label="What" htmlFor={`l-prod-${n}`}>
                    <Select id={`l-prod-${n}`} value={r.product} onChange={(e) => set(r.key, { product: e.target.value, saleUnit: "" })}>
                      {Object.entries(cat.data?.products ?? {}).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </Select></Field>
                  {showBatch ? (
                    <Field label={p?.needs_batch ? "From which batch" : "From which batch (optional)"} htmlFor={`l-batch-${n}`}>
                      <Select id={`l-batch-${n}`} value={r.batch} onChange={(e) => set(r.key, { batch: e.target.value, unit: "" })}>
                        <option value="">{p?.needs_batch ? "Choose…" : "None"}</option>
                        {batches.data?.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.current.toLocaleString("en-NG")} {x.species}</option>)}
                      </Select></Field>
                  ) : (
                    <Field label="Description" htmlFor={`l-desc-${n}`}><Input id={`l-desc-${n}`} value={r.desc} onChange={(e) => set(r.key, { desc: e.target.value })} placeholder={p?.label} /></Field>
                  )}
                  {rows.length > 1 && <Button variant="ghost" className="self-end" aria-label={`Remove item ${n + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 size={16} /></Button>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {r.product === "animals" && units.length > 1 && (
                    <Field label="From unit" htmlFor={`l-unit-${n}`}><Select id={`l-unit-${n}`} value={r.unit} onChange={(e) => set(r.key, { unit: e.target.value })}>
                      <option value="">Choose…</option>{units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_code} · {u.count.toLocaleString("en-NG")}</option>)}</Select></Field>
                  )}
                  <Field label={`How many (${r.product === "animals" ? "head" : r.saleUnit || p?.unit || ""})`} htmlFor={`l-qty-${n}`}>
                    <Input id={`l-qty-${n}`} inputMode="decimal" value={r.qty} onChange={(e) => set(r.key, { qty: r.product === "animals" ? e.target.value.replace(/\D/g, "") : dec(e.target.value) })} /></Field>
                  {r.product !== "animals" && (
                    <Field label="Sold by" htmlFor={`l-su-${n}`}><Select id={`l-su-${n}`} value={r.saleUnit || p?.unit} onChange={(e) => set(r.key, { saleUnit: e.target.value })}>
                      {cat.data?.units.map((u) => <option key={u}>{u}</option>)}</Select></Field>
                  )}
                  <Field label={`Price per ${r.product === "animals" ? "head" : r.saleUnit || p?.unit || "unit"} (₦)`} htmlFor={`l-price-${n}`}>
                    <Input id={`l-price-${n}`} inputMode="decimal" value={r.price} onChange={(e) => set(r.key, { price: dec(e.target.value) })} /></Field>
                  {r.product === "animals" && <Field label="Total weight (kg)" htmlFor={`l-wt-${n}`} hint="Optional"><Input id={`l-wt-${n}`} inputMode="decimal" value={r.weight} onChange={(e) => set(r.key, { weight: dec(e.target.value) })} /></Field>}
                </div>
                {num(r.qty) > 0 && num(r.price) > 0 && <p className="mt-2 text-right font-mono text-[13px] font-semibold tnum">{naira(num(r.qty) * num(r.price))}</p>}
              </fieldset>
            );
          })}
          <div><Button size="sm" onClick={() => setRows((rs) => [...rs, blankRow(rs[rs.length - 1]?.product, rs[rs.length - 1]?.batch)])}><Plus size={15} /> Add item</Button></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Discount (₦)" htmlFor="s-disc" hint="Optional"><Input id="s-disc" inputMode="decimal" value={discount} onChange={(e) => setDiscount(dec(e.target.value))} /></Field>
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-ink-2">Payment</span>
            <Segmented value={pay.mode} onChange={(v) => setPay({ ...pay, mode: v })} options={[{ value: "full", label: "Paid in full" }, { value: "part", label: "Part paid" }, { value: "credit", label: "On credit" }]} />
          </div>
        </div>
        {pay.mode !== "credit" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {pay.mode === "part" && <Field label="Paid now (₦)" htmlFor="s-paid"><Input id="s-paid" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: dec(e.target.value) })} /></Field>}
            <Field label="How" htmlFor="s-channel"><Select id="s-channel" value={pay.channel} onChange={(e) => setPay({ ...pay, channel: e.target.value })}>
              {Object.entries(cat.data?.channels ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Reference" htmlFor="s-ref" hint="Transfer ref, POS slip"><Input id="s-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
          </div>
        )}
        {pay.mode !== "full" && total > 0 && <p className="text-[13px] text-ink-2">{naira(total - paidNow)} will be owed, due {day(dueOn)}.</p>}
        <Field label="Notes on the invoice" htmlFor="s-notes" hint="Optional"><Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
