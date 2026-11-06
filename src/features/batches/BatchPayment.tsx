"use client";

import { useState } from "react";
import { Alert, Button, Dialog } from "@/components/ui";
import { type PaymentChoice, PaymentFields, noPayment, paymentBody, paymentReady, useCanPay } from "@/features/finance/PaymentFields";
import { PaidBadge } from "@/features/inventory/ItemSheet";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { naira } from "@/lib/format";
import { type BatchDetail, usePayBatch } from "./api";

/** What the animals cost and whether it was paid; for batches stocked without a payment, a way to record it. */
export function BatchPayment({ b }: { b: BatchDetail }) {
  const ws = useCurrentWorkspace();
  const canPay = useCanPay();
  const [open, setOpen] = useState(false);
  if (!ws.can("finance.view") || !b.acquisition_cost) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
      Animals cost {naira(Number(b.acquisition_cost))}
      {b.payment ? <PaidBadge p={b.payment} /> : canPay && b.source_type === "purchased"
        ? <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Record what you paid</Button> : null}
      {open && <PayBatchDialog b={b} onClose={() => setOpen(false)} />}
    </span>
  );
}

function PayBatchDialog({ b, onClose }: { b: BatchDetail; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const pay = usePayBatch(ws.orgId, b.id);
  const [p, setP] = useState<PaymentChoice>(noPayment);
  const [error, setError] = useState<string | null>(null);
  const body = paymentBody(p, true);
  return (
    <Dialog open onClose={onClose} title="Record what was paid" eyebrow={`${b.code} · the animals`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={pay.isPending} disabled={!body || !paymentReady(p, true)} onClick={async () => {
          if (!body) return;
          setError(null);
          try { await pay.mutateAsync(body); onClose(); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not record it"); }
        }}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-[13.5px] text-ink-2">Paid takes the money out of the account. The animals are already counted once in the batch&apos;s cost and the profit; this does not count them again.</p>
        <PaymentFields value={p} onChange={setP} amount={Number(b.acquisition_cost)} what="the animals" />
        {error && <Alert tone="crit" title={error} />}
      </div>
    </Dialog>
  );
}
