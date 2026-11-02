"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { localDay } from "@/features/daily/api";
import { useAccounts } from "@/features/finance/api";
import { newId } from "@/features/daily/queue";
import { LocationFields } from "@/features/geo";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import {
  type Customer, type InvoiceSettings, useCustomers, useInvoices, useInvoiceSettings, useRecordPayment, useSalesCatalog, useSaveCustomer,
  useSaveInvoiceSettings,
} from "./api";

const dec = (v: string) => v.replace(/[^\d.]/g, "");
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save.");

/** Money received from a customer, applied to their oldest invoices first (or to one invoice). */
export function PaymentDialog({ open, onClose, customerId, invoiceId, amount }: {
  open: boolean; onClose: () => void; customerId?: string | null; invoiceId?: string | null; amount?: number;
}) {
  const ws = useCurrentWorkspace();
  const cat = useSalesCatalog();
  const customers = useCustomers(ws.orgId, open);
  const record = useRecordPayment(ws.orgId);
  const seeAccounts = ws.has("finance") && ws.can("finance.view");
  const accounts = useAccounts(ws.orgId, open && seeAccounts);
  const toast = useToast();
  const [f, setF] = useState({ customer: "", amount: "", channel: "transfer", on: localDay(), reference: "", note: "", account: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setError(null); setF({ customer: customerId ?? "", amount: amount ? String(amount) : "", channel: "transfer", on: localDay(), reference: "", note: "", account: "" }); }
  }, [open, customerId, amount]);
  const open_ = useInvoices(ws.orgId, { status: "open", customer_id: f.customer }, open && !!f.customer);
  const cust = customers.data?.find((c) => c.id === f.customer);
  const amt = Number(f.amount) || 0;
  // Preview where the money goes: oldest due first.
  let rest = amt;
  const plan = (open_.data ?? []).slice().sort((a, b) => (invoiceId ? Number(b.id === invoiceId) - Number(a.id === invoiceId) : 0) || a.due_on.localeCompare(b.due_on))
    .map((i) => { const take = Math.min(rest, i.balance); rest -= take; return { i, take }; }).filter((x) => x.take > 0);
  return (
    <Dialog open={open} onClose={onClose} title="Money received" eyebrow="Sales"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={record.isPending} disabled={!amt || (!f.customer && !invoiceId)} onClick={async () => {
        setError(null);
        try {
          const p = await record.mutateAsync({ customer_id: f.customer || null, invoice_id: invoiceId ?? null, received_on: f.on, amount: amt, channel: f.channel,
            reference: f.reference || null, note: f.note || null, account_id: f.account || null, client_id: newId() });
          toast(`${p.number}: ${naira(p.amount)} from ${p.payer_name}` + (p.unapplied ? ` (${naira(p.unapplied)} kept as credit)` : ""));
          onClose();
        } catch (e) { setError(errMsg(e)); }
      }}>Save payment</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        {!invoiceId || customerId ? (
          <Field label="From" htmlFor="p-cust" hint={cust ? `Owes ${naira(cust.outstanding)}` : undefined}>
            <Select id="p-cust" value={f.customer} disabled={!!customerId} onChange={(e) => setF({ ...f, customer: e.target.value })}>
              <option value="">Choose a customer</option>{customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.outstanding ? ` · owes ${naira(c.outstanding)}` : ""}</option>)}
            </Select></Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount (₦)" htmlFor="p-amount"><Input id="p-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: dec(e.target.value) })} /></Field>
          <Field label="How" htmlFor="p-channel"><Select id="p-channel" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            {Object.entries(cat.data?.channels ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Received on" htmlFor="p-on"><Input id="p-on" type="date" max={localDay()} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        </div>
        <div className={seeAccounts && accounts.data?.length ? "grid gap-4 sm:grid-cols-2" : undefined}>
          <Field label="Reference" htmlFor="p-ref" hint="Transfer reference, POS slip or cheque number"><Input id="p-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          {seeAccounts && !!accounts.data?.length && (
            <Field label="Into account" htmlFor="p-account" hint="Left on automatic: cash to the cash box, the rest to the bank">
              <Select id="p-account" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
                <option value="">Automatic</option>{accounts.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          )}
        </div>
        {f.customer && amt > 0 && (
          <div className="rounded-xl border border-line p-3 text-[13px]">
            <b>Where it goes</b>
            {plan.length ? <ul className="mt-1">{plan.map(({ i, take }) => <li key={i.id} className="flex justify-between gap-2"><span>{i.number}{i.status === "overdue" ? " (overdue)" : ""}</span><span className="font-mono tnum">{naira(take)}</span></li>)}</ul>
              : <p className="text-ink-3">Nothing is owed: all of it is kept as credit for their next purchase.</p>}
            {rest > 0 && plan.length > 0 && <p className="mt-1 text-ink-2">{naira(rest)} kept as credit for their next purchase.</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function CustomerDialog({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer | null; onSaved?: (c: Customer) => void }) {
  const ws = useCurrentWorkspace();
  const cat = useSalesCatalog();
  const save = useSaveCustomer(ws.orgId);
  const toast = useToast();
  const blank = { name: "", kind: "individual", phone: "", email: "", address: "", state: "", lga: "", credit_limit: "", terms_days: "0", notes: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(customer ? { name: customer.name, kind: customer.kind, phone: customer.phone ?? "", email: customer.email ?? "", address: customer.address ?? "",
      state: customer.state ?? "", lga: customer.lga ?? "", credit_limit: customer.credit_limit?.toString() ?? "", terms_days: String(customer.terms_days), notes: customer.notes ?? "" }
      : { ...blank, state: ws.organization.state ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);
  return (
    <Dialog open={open} onClose={onClose} title={customer ? `Edit ${customer.name}` : "Add a customer"} eyebrow="Sales"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.trim().length < 2} onClick={async () => {
        setError(null);
        try {
          const c = await save.mutateAsync({ ...(customer ? { id: customer.id } : {}), name: f.name.trim(), kind: f.kind, phone: f.phone || null, email: f.email || null,
            address: f.address || null, state: f.state || null, lga: f.lga || null, credit_limit: f.credit_limit ? Number(f.credit_limit) : null,
            terms_days: Number(f.terms_days) || 0, notes: f.notes || null });
          toast(customer ? `Saved ${c.name}` : `Added ${c.name}`); onSaved?.(c); onClose();
        } catch (e) { setError(errMsg(e)); }
      }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-name"><Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Mama Nkechi Fish" /></Field>
          <Field label="Type" htmlFor="c-kind"><Select id="c-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {Object.entries(cat.data?.customer_kinds ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0803 555 0147" /></Field>
          <Field label="Email" htmlFor="c-email" hint="Optional"><Input id="c-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Days to pay" htmlFor="c-terms" hint="0 = pays on the day"><Input id="c-terms" inputMode="numeric" value={f.terms_days} onChange={(e) => setF({ ...f, terms_days: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Credit limit (₦)" htmlFor="c-limit" hint="Optional: most they may owe"><Input id="c-limit" inputMode="decimal" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: dec(e.target.value) })} /></Field>
        </div>
        <LocationFields idPrefix="c" value={{ state: f.state, lga: f.lga }} onChange={(p) => setF({ ...f, state: p.state, lga: p.lga })} />
        <Field label="Address or market" htmlFor="c-address" hint="Optional"><Input id="c-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Bodija market, stall 14" /></Field>
        <Field label="Notes" htmlFor="c-notes" hint="Optional"><Textarea id="c-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

export function InvoiceSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const q = useInvoiceSettings(ws.orgId);
  const save = useSaveInvoiceSettings(ws.orgId);
  const toast = useToast();
  const [f, setF] = useState<InvoiceSettings>({ bank_name: "", account_name: "", account_number: "", footer: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open && q.data) setF({ bank_name: q.data.bank_name ?? "", account_name: q.data.account_name ?? "", account_number: q.data.account_number ?? "", footer: q.data.footer ?? "" }); }, [open, q.data]);
  return (
    <Dialog open={open} onClose={onClose} title="Invoice details" eyebrow="Sales"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={async () => {
        setError(null);
        try { await save.mutateAsync({ bank_name: f.bank_name || null, account_name: f.account_name || null, account_number: f.account_number || null, footer: f.footer || null }); toast("Saved"); onClose(); }
        catch (e) { setError(errMsg(e)); }
      }}>Save</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="crit">{error}</Alert>}
        <p className="text-[13px] text-ink-3">Printed on every invoice so customers know where to pay.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank" htmlFor="b-bank"><Input id="b-bank" value={f.bank_name ?? ""} onChange={(e) => setF({ ...f, bank_name: e.target.value })} placeholder="GTBank" /></Field>
          <Field label="Account number" htmlFor="b-num" hint="10 digits"><Input id="b-num" inputMode="numeric" maxLength={10} value={f.account_number ?? ""} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <Field label="Account name" htmlFor="b-name"><Input id="b-name" value={f.account_name ?? ""} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></Field>
        <Field label="Footer" htmlFor="b-footer" hint="Optional, e.g. Thank you for your business"><Input id="b-footer" value={f.footer ?? ""} onChange={(e) => setF({ ...f, footer: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
