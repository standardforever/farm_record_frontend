"use client";

import { use } from "react";
import { EmptyState, PageLoader } from "@/components/ui";
import { day, useInvoiceSettings, usePayment, useSalesCatalog } from "@/features/sales";
import { PrintDoc } from "@/features/sales/PrintDoc";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";

export default function PrintReceipt({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = use(params);
  return <RequirePermission permission="sales.view"><Inner id={paymentId} /></RequirePermission>;
}

function Inner({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = usePayment(ws.orgId, id);
  const cat = useSalesCatalog();
  const settings = useInvoiceSettings(ws.orgId);
  if (q.isLoading) return <PageLoader />;
  const p = q.data;
  if (!p) return <EmptyState title="Receipt not found" />;
  const o = ws.organization;
  return (
    <PrintDoc seller={{ name: o.name, phone: o.phone, state: o.state, lga: o.lga, footer: settings.data?.footer }} title={p.voided_at ? "Receipt (void)" : "Receipt"}
      number={p.number} meta={<>Date {day(p.received_on)}</>}>
      <p className="text-[15px]">Received from <b>{p.payer_name}</b> the sum of <b>{naira(p.amount)}</b> by {(cat.data?.channels[p.channel] ?? p.channel).toLowerCase()}
        {p.reference ? ` (ref. ${p.reference})` : ""}.</p>
      {p.allocations.length > 0 && (
        <table className="mt-5 w-full border-collapse">
          <thead><tr className="border-b border-[#16181a] text-left text-[11.5px] uppercase tracking-wider"><th className="py-2">For invoice</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>{p.allocations.map((a) => <tr key={a.invoice_id} className="border-b border-[#e3e1da]"><td className="py-2 font-mono">{a.number}</td><td className="py-2 text-right tabular-nums">{naira(a.amount)}</td></tr>)}</tbody>
        </table>
      )}
      {p.unapplied > 0 && <p className="mt-3">{naira(p.unapplied)} kept as credit for future purchases.</p>}
      {p.note && <p className="mt-3 text-[#5b5f62]">{p.note}</p>}
    </PrintDoc>
  );
}
