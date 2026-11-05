"use client";

import { useState } from "react";
import { OwnerActions } from "@/features/corrections";
import { Banknote, Plus, Settings2, UserPlus } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, PageHeader, PageLoader, Pager, Segmented, Stat, useDebounced, usePager, useSlice } from "@/components/ui";
import {
  type Customer, CustomerDialog, InvoiceDialog, InvoiceSettingsDialog, InvoiceSheet, PaymentDialog, STATUS, day, useAging, useCustomerPage, useInvoices,
  usePayments, useSalesCatalog, useSalesOverview,
} from "@/features/sales";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { cn, naira } from "@/lib/format";

export default function SalesPage() {
  return <RequirePermission permission="sales.view"><Inner /></RequirePermission>;
}

type Tab = "invoices" | "customers" | "payments" | "aging";

function Inner() {
  const ws = useCurrentWorkspace();
  const ov = useSalesOverview(ws.orgId);
  const cat = useSalesCatalog();
  const [tab, setTab] = useState<Tab>("invoices");
  const [selling, setSelling] = useState<{ customerId?: string } | null>(null);
  const [paying, setPaying] = useState<{ customerId?: string } | null>(null);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [settings, setSettings] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (!ws.has("sales")) return <EmptyState title="Sales are not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const edit = ws.can("sales.edit");
  const month = new Date().toLocaleDateString("en-NG", { month: "long" });

  return (
    <>
      <PageHeader eyebrow="Money in" title="Sales" sub="Every sale, who owes what, and every naira received."
        actions={edit ? <>
          <Button onClick={() => setPaying({})}><Banknote size={16} /> Money received</Button>
          <Button variant="primary" onClick={() => setSelling({})}><Plus size={16} /> New sale</Button>
        </> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Sales in ${month}`} value={naira(d.month_sales)} sub={Object.entries(d.by_product).map(([k, v]) => `${cat.data?.products[k]?.label ?? k} ${naira(v)}`).join(" · ") || "No sales yet"} hero />
        <Stat label={`Received in ${month}`} value={naira(d.month_received)} sub={Object.entries(d.by_channel).map(([k, v]) => `${cat.data?.channels[k] ?? k} ${naira(v)}`).join(" · ") || "—"} />
        <Stat label="Owed to you" value={naira(d.outstanding)} sub="All unpaid invoices" />
        <Stat label="Overdue" value={<span className={d.overdue ? "text-crit" : undefined}>{naira(d.overdue)}</span>} sub="Past the due date" />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: "invoices", label: "Invoices" }, { value: "customers", label: "Customers" }, { value: "payments", label: "Payments" }, { value: "aging", label: "Who owes" }]} />
        {edit && <Button size="sm" variant="ghost" onClick={() => setSettings(true)}><Settings2 size={15} /> Invoice details</Button>}
      </div>
      {tab === "invoices" && <Invoices onOpen={setOpen} />}
      {tab === "customers" && <Customers onEdit={setEditing} onSell={(id) => setSelling({ customerId: id })} onPay={(id) => setPaying({ customerId: id })} />}
      {tab === "payments" && <Payments />}
      {tab === "aging" && <AgingTable onPay={(id) => setPaying({ customerId: id })} />}

      <InvoiceDialog open={!!selling} onClose={() => setSelling(null)} customerId={selling?.customerId} onCreated={(inv) => setOpen(inv.id)} />
      <PaymentDialog open={!!paying} onClose={() => setPaying(null)} customerId={paying?.customerId} />
      <CustomerDialog open={!!editing} onClose={() => setEditing(null)} customer={editing === "new" ? null : editing} />
      <InvoiceSettingsDialog open={settings} onClose={() => setSettings(false)} />
      <InvoiceSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Invoices({ onOpen }: { onOpen: (id: string) => void }) {
  const ws = useCurrentWorkspace();
  const [status, setStatus] = useState("");
  const pg = usePager(20, [status]);
  const q = useInvoices(ws.orgId, { status, ...pg.params });
  return (
    <Card title="Invoices" action={<select aria-label="Show" className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="">All</option><option value="open">Unpaid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option></select>}>
      {!q.data ? <PageLoader /> : q.data.total === 0 ? <p className="text-[13.5px] text-ink-3">No invoices{status ? " here" : " yet. Record your first sale with New sale"}.</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {q.data.items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onOpen(i.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><b className="font-mono text-[13px]">{i.number}</b><span className="truncate text-[14px] font-semibold">{i.customer_name}</span></div>
                  <div className="text-[12.5px] text-ink-3">{day(i.issued_on)}{i.balance > 0 && !i.voided_at ? ` · due ${day(i.due_on)}` : ""}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn("font-mono text-[13.5px] font-semibold tnum", i.voided_at && "line-through opacity-60")}>{naira(i.total)}</span>
                  <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}{i.status === "part_paid" || i.status === "overdue" ? ` · ${naira(i.balance)} left` : ""}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager {...pg.bind(q.data?.total, q.isFetching)} noun="invoices" />
    </Card>
  );
}

function Customers({ onEdit, onSell, onPay }: { onEdit: (c: Customer | "new") => void; onSell: (id: string) => void; onPay: (id: string) => void }) {
  const ws = useCurrentWorkspace();
  const cat = useSalesCatalog();
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const pg = usePager(20, [term]);
  const q = useCustomerPage(ws.orgId, { q: term, ...pg.params });
  const edit = ws.can("sales.edit");
  return (
    <Card title="Customers" action={<div className="flex flex-wrap items-center gap-2">
      <div className="w-[190px]"><Input aria-label="Search customers" className="h-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" /></div>
      {edit && <Button size="sm" onClick={() => onEdit("new")}><UserPlus size={15} /> Add customer</Button>}</div>}>
      {!q.data ? <PageLoader /> : q.data.total === 0 ? <p className="text-[13.5px] text-ink-3">{search ? "No customer matches that." : "Add the people who buy from you regularly to give them credit terms and track what they owe."}</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {q.data.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1 basis-[200px]">
                <b className="text-[14px]">{c.name}</b>
                <div className="text-[12.5px] text-ink-3">{[cat.data?.customer_kinds[c.kind], c.phone, c.lga, c.terms_days ? `${c.terms_days} days to pay` : "pays on the day",
                  c.credit_limit != null && `limit ${naira(c.credit_limit)}`].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-mono text-[13.5px] font-semibold tnum", c.overdue > 0 && "text-crit")}>{c.outstanding ? naira(c.outstanding) : "—"}</div>
                <div className="text-[11.5px] text-ink-3">{c.overdue ? `${naira(c.overdue)} overdue` : c.credit ? `${naira(c.credit)} credit` : c.outstanding ? "owed" : "nothing owed"}</div>
              </div>
              {edit && <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onSell(c.id)}>Sell</Button>
                {c.outstanding > 0 && <Button size="sm" variant="ghost" onClick={() => onPay(c.id)}>Paid</Button>}
                <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>Edit</Button>
              </div>}
              <OwnerActions kind="customer" id={c.id} compact />
            </li>
          ))}
        </ul>
      )}
      <Pager {...pg.bind(q.data?.total, q.isFetching)} noun="customers" />
    </Card>
  );
}

function Payments() {
  const ws = useCurrentWorkspace();
  const cat = useSalesCatalog();
  const pg = usePager(20);
  const q = usePayments(ws.orgId, pg.params);
  return (
    <Card title="Payments received" meta="Each one has a receipt number you can print.">
      {!q.data ? <PageLoader /> : q.data.total === 0 ? <p className="text-[13.5px] text-ink-3">No payments yet.</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {q.data.items.map((p) => (
            <li key={p.id} className={cn("flex flex-wrap items-center gap-3 py-2.5", p.voided_at && "opacity-55")}>
              <div className="min-w-0 flex-1 basis-[200px]">
                <div className="flex flex-wrap items-center gap-1.5"><b className="font-mono text-[13px]">{p.number}</b><span className="text-[14px] font-semibold">{p.payer_name}</span>
                  {p.voided_at && <Badge>Void</Badge>}{p.unapplied > 0 && <Badge tone="info">{naira(p.unapplied)} credit</Badge>}</div>
                <div className="text-[12.5px] text-ink-3">{[day(p.received_on), cat.data?.channels[p.channel], p.reference, p.allocations.map((a) => a.number).join(", ")].filter(Boolean).join(" · ")}</div>
              </div>
              <span className="font-mono text-[13.5px] font-semibold tnum">{naira(p.amount)}</span>
              <Link className="text-[12.5px] font-semibold text-brand" href={`/w/${ws.orgId}/sales/payments/${p.id}/print`} target="_blank">Receipt</Link>
              {!p.voided_at && <OwnerActions kind="payment" id={p.id} compact />}
            </li>
          ))}
        </ul>
      )}
      <Pager {...pg.bind(q.data?.total, q.isFetching)} noun="payments" />
    </Card>
  );
}

function AgingTable({ onPay }: { onPay: (id: string) => void }) {
  const ws = useCurrentWorkspace();
  const q = useAging(ws.orgId);
  const { rows, pager } = useSlice(q.data?.rows, 20);
  if (!q.data) return <PageLoader />;
  const a = q.data;
  if (!a.rows.length) return <EmptyState title="Nobody owes you money" body="Credit sales and part payments show here, by how late they are." />;
  return (
    <Card title="Who owes, by how late" meta={`As of ${day(a.as_of)} · ${naira(a.total)} in total`} flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead><tr className="border-b border-line text-left text-[12px] text-ink-3">
            <th className="px-4 py-2 font-semibold">Customer</th>
            {a.buckets.map((b, n) => <th key={b} className={cn("px-3 py-2 text-right font-semibold", n >= 2 && "text-crit")}>{b}</th>)}
            <th className="px-4 py-2 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer_id ?? r.customer_name} className="border-b border-line last:border-0">
                <td className="px-4 py-2"><b>{r.customer_name}</b><div className="text-[11.5px] text-ink-3">{r.invoices} invoice{r.invoices > 1 ? "s" : ""}{r.phone ? ` · ${r.phone}` : ""}
                  {r.customer_id && ws.can("sales.edit") && <> · <button className="font-semibold text-brand" onClick={() => onPay(r.customer_id!)}>Record payment</button></>}</div></td>
                {r.buckets.map((v, n) => <td key={n} className="px-3 py-2 text-right font-mono tnum">{v ? naira(v) : "—"}</td>)}
                <td className="px-4 py-2 text-right font-mono font-semibold tnum">{naira(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-line font-semibold">
            <td className="px-4 py-2">Total</td>{a.totals.map((v, n) => <td key={n} className="px-3 py-2 text-right font-mono tnum">{naira(v)}</td>)}
            <td className="px-4 py-2 text-right font-mono tnum">{naira(a.total)}</td></tr></tfoot>
        </table>
      </div>
      <Pager {...pager} noun="customers" className="mx-4 mb-1" />
    </Card>
  );
}
