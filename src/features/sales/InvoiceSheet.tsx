"use client";

import { Fragment, useState } from "react";
import { OwnerActions } from "@/features/corrections";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Alert, Badge, Button, Dialog, Field, Input, PageLoader, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { STATUS, day, units, useInvoice, useSalesCatalog, useVoidInvoice } from "./api";
import { PaymentDialog } from "./SalesDialogs";

/** One invoice: lines, payments, balance; record a payment, print, void. */
export function InvoiceSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const q = useInvoice(ws.orgId, id);
  const cat = useSalesCatalog();
  const voidIt = useVoidInvoice(ws.orgId);
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inv = q.data;
  const edit = ws.can("sales.edit");
  return (
    <Dialog open={!!id} onClose={onClose} side title={inv ? `${inv.number} · ${inv.customer_name}` : "Invoice"} eyebrow="Invoice">
      {!inv ? <PageLoader /> : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}{inv.status === "overdue" ? ` · ${inv.days_overdue} days` : ""}</Badge>
            <span className="text-[13px] text-ink-3">Issued {day(inv.issued_on)} · due {day(inv.due_on)}</span>
            {!inv.voided_at && <OwnerActions kind="invoice" id={inv.id} className="ml-auto" onDeleted={onClose} />}
          </div>
          {inv.voided_at && <Alert tone="info" title="Void">{inv.void_reason}</Alert>}
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line px-3">
            {inv.lines.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-2.5 text-[13.5px]">
                <div className="min-w-0 flex-1"><b>{l.description}</b>
                  <div className="text-[12px] text-ink-3">{units(l.quantity, l.unit)} × {naira(l.unit_price)}{l.unit_code ? ` · from ${l.unit_code}` : ""}
                    {l.weight_kg ? ` · ${l.weight_kg.toLocaleString("en-NG")} kg` : ""}{!l.batch_code && cat.data ? ` · ${cat.data.products[l.product]?.label}` : ""}</div></div>
                <span className="font-mono font-semibold tnum">{naira(l.amount)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13.5px]">
            {inv.discount > 0 && <><dt className="text-ink-3">Subtotal</dt><dd className="text-right tnum">{naira(inv.subtotal)}</dd>
              <dt className="text-ink-3">Discount</dt><dd className="text-right tnum">−{naira(inv.discount)}</dd></>}
            <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tnum">{naira(inv.total)}</dd>
            {inv.payments.map((p) => <Fragment key={p.payment_id}><dt className="text-ink-3">{p.number} · {cat.data?.channels[p.channel] ?? p.channel} · {day(p.received_on)}</dt>
              <dd className="text-right text-good tnum">−{naira(p.amount)}</dd></Fragment>)}
            <dt className="mt-1 border-t border-line pt-1 font-bold">Balance</dt><dd className="mt-1 border-t border-line pt-1 text-right font-bold tnum">{naira(inv.balance)}</dd>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {edit && !inv.voided_at && inv.balance > 0 && <Button variant="primary" onClick={() => setPaying(true)}>Record payment</Button>}
            <Link href={`/w/${ws.orgId}/sales/invoices/${inv.id}/print`} target="_blank"><Button><Printer size={15} /> Print or save PDF</Button></Link>
            {edit && !inv.voided_at && <Button variant="ghost" onClick={() => setVoiding(true)}>Void</Button>}
          </div>
          {voiding && (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
              {error && <Alert tone="crit">{error}</Alert>}
              <p className="text-[13px] text-ink-2">Voiding puts any animals sold back on their batch. Money already paid stays as credit for the customer (void the payment too if it was refunded).</p>
              <Field label="Why" htmlFor="iv-reason"><Input id="iv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer returned them" /></Field>
              <div className="flex gap-1.5"><Button variant="ghost" onClick={() => setVoiding(false)}>Keep it</Button>
                <Button variant="danger" loading={voidIt.isPending} disabled={reason.trim().length < 3} onClick={async () => {
                  setError(null);
                  try { await voidIt.mutateAsync({ id: inv.id, reason: reason.trim() }); toast(`${inv.number} voided`); setVoiding(false); setReason(""); }
                  catch (e) { setError(e instanceof ApiError ? e.message : "Could not void."); }
                }}>Void invoice</Button></div>
            </div>
          )}
        </div>
      )}
      <PaymentDialog open={paying} onClose={() => setPaying(false)} customerId={inv?.customer_id} invoiceId={inv?.id} amount={inv?.balance} />
    </Dialog>
  );
}
