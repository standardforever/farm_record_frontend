"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";
import { useBatchStock } from "./api";
import { IssueDialog } from "./StockDialogs";

/** Batch page: stock this batch used, from which delivery, at what price. */
export function BatchStockCard({ batchId, active }: { batchId: string; active: boolean }) {
  const ws = useCurrentWorkspace();
  const visible = ws.has("inventory") && (ws.can("inventory.view") || ws.can("farm.view"));
  const q = useBatchStock(ws.orgId, batchId, visible);
  const [using, setUsing] = useState(false);
  if (!visible || !q.data) return null;
  const money = ws.can("finance.view");
  // One line per item: total used and cost.
  const byItem = new Map<string, { name: string; unit: string; qty: number; cost: number | null; lots: Set<string> }>();
  for (const m of q.data) {
    const k = m.item_id;
    const cur = byItem.get(k) ?? { name: m.item_name ?? "", unit: m.item_unit ?? "", qty: 0, cost: 0, lots: new Set<string>() };
    cur.qty += -m.quantity;
    cur.cost = cur.cost == null || m.cost_amount == null ? null : cur.cost + m.cost_amount;
    if (m.lot_label) cur.lots.add(m.lot_label);
    byItem.set(k, cur);
  }
  if (!byItem.size && !(active && ws.can("inventory.edit"))) return null;
  return (
    <Card title="Stock used" meta="Feed from feed logs, plus medicine and supplies used for this batch. Priced from each delivery."
      action={active && ws.can("inventory.edit") ? <Button size="sm" onClick={() => setUsing(true)}>Use stock</Button> : undefined}>
      {!byItem.size ? <p className="text-[13.5px] text-ink-3">Nothing used from stock yet. Pick the feed from your stock when logging feed on Today.</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {[...byItem.entries()].map(([id, x]) => (
            <li key={id} className="flex items-start gap-3 py-2">
              <div className="min-w-0 flex-1">
                <b className="text-[13.5px]">{x.name}</b>
                <div className="text-[12px] text-ink-3">{x.lots.size} deliver{x.lots.size === 1 ? "y" : "ies"}{x.lots.size ? `: ${[...x.lots].slice(0, 2).join("; ")}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-semibold tnum">{x.qty.toLocaleString("en-NG", { maximumFractionDigits: 2 })} {x.unit}</div>
                {money && <div className="font-mono text-[12px] text-ink-3">{x.cost != null ? naira(x.cost) : "price missing"}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <IssueDialog open={using} onClose={() => setUsing(false)} batchId={batchId} />
    </Card>
  );
}
