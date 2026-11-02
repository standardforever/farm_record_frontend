"use client";

import { use } from "react";
import { EmptyState, PageLoader } from "@/components/ui";
import { day, STATUS, units, useInvoice } from "@/features/sales";
import { PrintDoc } from "@/features/sales/PrintDoc";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";

export default function PrintInvoice({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  return <RequirePermission permission="sales.view"><Inner id={invoiceId} /></RequirePermission>;
}

function Inner({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = useInvoice(ws.orgId, id);
  if (q.isLoading) return <PageLoader />;
  const inv = q.data;
  if (!inv) return <EmptyState title="Invoice not found" />;
  const s = inv.seller;
  return (
    <PrintDoc seller={s} title={inv.voided_at ? "Invoice (void)" : "Invoice"} number={inv.number}
      meta={<>Date {day(inv.issued_on)}<br />Due {day(inv.due_on)}</>}
      footer={(s.bank_name || s.account_number) && inv.balance > 0 ? (
        <p><b className="text-[#16181a]">Pay to:</b> {s.bank_name} · {s.account_number} · {s.account_name}. Use {inv.number} as the reference.</p>
      ) : undefined}>
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5b5f62]">Bill to</div>
        <div className="text-[15px] font-semibold">{inv.customer_name}</div>
        {inv.customer && <div className="text-[#5b5f62]">{[inv.customer.phone, inv.customer.address, inv.customer.lga, inv.customer.state].filter(Boolean).join(" · ")}</div>}
      </div>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-[#16181a] text-left text-[11.5px] uppercase tracking-wider">
          <th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-[#e3e1da] align-top">
              <td className="py-2">{l.description}{l.weight_kg ? <div className="text-[11.5px] text-[#5b5f62]">{l.weight_kg.toLocaleString("en-NG")} kg live weight</div> : null}</td>
              <td className="py-2 text-right tabular-nums">{units(l.quantity, l.unit)}</td>
              <td className="py-2 text-right tabular-nums">{naira(l.unit_price)}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{naira(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-4 grid w-full max-w-[300px] grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        {inv.discount > 0 && <><dt>Subtotal</dt><dd className="text-right tabular-nums">{naira(inv.subtotal)}</dd><dt>Discount</dt><dd className="text-right tabular-nums">−{naira(inv.discount)}</dd></>}
        <dt className="font-bold">Total</dt><dd className="text-right font-bold tabular-nums">{naira(inv.total)}</dd>
        <dt>Paid</dt><dd className="text-right tabular-nums">{naira(inv.paid)}</dd>
        <dt className="border-t border-[#16181a] pt-1 font-bold">Balance due</dt><dd className="border-t border-[#16181a] pt-1 text-right font-bold tabular-nums">{naira(inv.balance)}</dd>
      </dl>
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider">{STATUS[inv.status].label}</p>
      {inv.notes && <p className="mt-3 whitespace-pre-line text-[#5b5f62]">{inv.notes}</p>}
    </PrintDoc>
  );
}
