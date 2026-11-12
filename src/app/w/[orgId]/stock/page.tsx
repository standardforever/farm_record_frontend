"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ChevronRight, Clock, PackagePlus, Wrench, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader, Segmented, useToast } from "@/components/ui";
import {
  type StockItem, CountDialog, EquipmentPanel, IssueDialog, ItemDialog, ItemSheet, qty, ReceiveDialog, useDecide, useInventoryCatalog, useStock, WriteOffDialog,
} from "@/features/inventory";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";

const ALERTS_SHOWN = 4;  // the most urgent first (the server sorts them); the rest behind "Show more"

export default function StockPage() {
  return <RequirePermission permission="inventory.view"><Suspense fallback={<PageLoader />}><Inner /></Suspense></RequirePermission>;
}

type Act = { kind: "receive" | "use" | "count" | "writeoff" | "edit" | "new"; item?: StockItem; lotId?: string } | null;
const ALERT_ICON = { unrecorded: AlertTriangle, expired: AlertTriangle, reorder: PackagePlus, expiring: Clock, service: Wrench } as const;

function Inner() {
  const ws = useCurrentWorkspace();
  const ov = useStock(ws.orgId);
  const cat = useInventoryCatalog();
  const decide = useDecide(ws.orgId);
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState<"stock" | "equipment">(params.get("tab") === "equipment" ? "equipment" : "stock");
  const [open, setOpen] = useState<string | null>(null);
  const [act, setAct] = useState<Act>(null);
  const [category, setCategory] = useState("");
  const [allAlerts, setAllAlerts] = useState(false);
  if (!ws.has("inventory")) return <EmptyState title="Stock is not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const edit = ws.can("inventory.edit");
  const items = d.items.filter((i) => !category || i.category === category);
  const cats = [...new Set(d.items.map((i) => i.category))];
  const findItem = (id: string | null) => d.items.find((i) => i.id === id);

  return (
    <>
      <PageHeader eyebrow="Farm" title="Stock" sub="Feed, medicine and supplies by delivery, so each batch is charged what its feed really cost."
        actions={edit ? <>
          <Button onClick={() => setAct({ kind: "use" })}>Use stock</Button>
          <Button variant="primary" onClick={() => setAct({ kind: "receive" })}><PackagePlus size={16} /> Receive delivery</Button>
        </> : undefined} />

      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: "stock", label: "Stock" }, { value: "equipment", label: "Equipment" }]} /></div>

      {tab === "equipment" ? <EquipmentPanel /> : (
        <div className="flex flex-col gap-4">
          {(d.alerts.length > 0 || d.pending.length > 0) && (
            <div className={cn("grid gap-4", d.alerts.length > 0 && d.pending.length > 0 && "lg:grid-cols-2")}>
              {d.alerts.length > 0 && (
                <Card title="Needs attention" meta={`${d.alerts.length} alert${d.alerts.length > 1 ? "s" : ""}`}>
                  <ul className={cn("-my-1 grid divide-y divide-line", !d.pending.length && "lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0 [&>li]:border-line lg:[&>li]:border-b")}>
                    {(allAlerts ? d.alerts : d.alerts.slice(0, ALERTS_SHOWN)).map((a, i) => {
                      const Icon = ALERT_ICON[a.kind];
                      const red = a.kind === "unrecorded" || a.kind === "expired" || a.title.endsWith("is broken");
                      const body = <>
                        <Icon size={16} className={cn("mt-0.5 shrink-0", red ? "text-crit" : "text-warn")} />
                        <span className="min-w-0 flex-1"><b className="text-[13.5px]">{a.title}</b><span className="block truncate text-[12.5px] text-ink-3">{a.detail}</span></span>
                        <ChevronRight size={15} className="mt-0.5 shrink-0 text-ink-3" />
                      </>;
                      const cls = "flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-surface-2 disabled:cursor-default";
                      return (
                        <li key={i}>
                          {a.equipment_id
                            ? <Link href={`/w/${ws.orgId}/stock/equipment/${a.equipment_id}`} className={cls}>{body}</Link>
                            : <button type="button" disabled={!a.item_id} onClick={() => a.item_id && setOpen(a.item_id)} className={cls}>{body}</button>}
                        </li>
                      );
                    })}
                  </ul>
                  {d.alerts.length > ALERTS_SHOWN && (
                    <button type="button" onClick={() => setAllAlerts(!allAlerts)} className="mt-2 text-[13px] font-semibold text-brand hover:underline">
                      {allAlerts ? "Show fewer" : `Show ${d.alerts.length - ALERTS_SHOWN} more`}
                    </button>
                  )}
                </Card>
              )}
              {d.pending.length > 0 && (
                <Card title="Waiting for approval" meta="Counts and write-offs change stock once approved.">
                  <ul className="flex flex-col divide-y divide-line">
                    {d.pending.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                        <div className="min-w-0 flex-1 text-[13.5px]">
                          <b>{m.kind === "adjust" ? "Count" : "Write-off"}: {m.item_name}</b> <span className="font-mono tnum">{m.quantity > 0 ? "+" : ""}{m.quantity.toLocaleString("en-NG")} {m.item_unit}</span>
                          <div className="text-[12px] text-ink-3">{[m.reason, m.note, m.created_by_name].filter(Boolean).join(" · ")}</div>
                        </div>
                        {ws.can("inventory.approve") && <div className="flex gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Reject ${m.item_name}`} onClick={() => decide.mutate({ id: m.id, approve: false }, { onSuccess: () => toast("Rejected") })}><X size={15} /> Reject</Button>
                          <Button size="sm" variant="primary" aria-label={`Approve ${m.item_name}`} onClick={() => decide.mutate({ id: m.id, approve: true }, {
                            onSuccess: () => toast("Approved: stock corrected"), onError: (e) => toast(e instanceof ApiError ? e.message : "Could not approve", "crit") })}><Check size={15} /> Approve</Button>
                        </div>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          <Card title="Items" meta={d.value != null ? `Worth ${naira(d.value)} at cost` : `${d.items.length} item${d.items.length === 1 ? "" : "s"}`}
            action={edit ? <Button size="sm" onClick={() => setAct({ kind: "new" })}>Add item</Button> : undefined}>
            {d.items.length === 0 ? (
              <EmptyState icon={<PackagePlus size={22} />} title="No stock items yet" body="Add your feeds first (counted in kg), then record each delivery with its price."
                action={edit ? <Button variant="primary" onClick={() => setAct({ kind: "new" })}>Add your first item</Button> : undefined} />
            ) : (
              <>
                {cats.length > 1 && <div className="mb-3 flex flex-wrap gap-1.5">
                  {["", ...cats].map((c) => (
                    <button key={c || "all"} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
                      className={cn("rounded-full border px-3 py-1 text-[12.5px] font-semibold", category === c ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-ink-3")}>
                      {c ? cat.data?.categories[c] ?? c : "All"}</button>
                  ))}
                </div>}
                <ul className="flex flex-col divide-y divide-line">
                  {items.map((i) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => setOpen(i.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5"><b className="text-[14px]">{i.name}</b>
                            {i.reorder && <Badge tone="warn">Reorder</Badge>}{i.unrecorded > 0 && <Badge tone="crit">Delivery missing</Badge>}</div>
                          <div className="text-[12.5px] text-ink-3">{cat.data?.categories[i.category] ?? i.category}{i.next_expiry ? ` · next expiry ${new Date(i.next_expiry + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn("font-mono text-[13.5px] font-semibold tnum", i.in_stock < 0 && "text-crit")}>{qty(i.in_stock, i)}</div>
                          {i.value != null && <div className="font-mono text-[12px] text-ink-3">{naira(i.value)}</div>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {d.recent.length > 0 && (
            <Card title="Recent movements">
              <ul className="flex flex-col divide-y divide-line">
                {d.recent.slice(0, 12).map((m) => (
                  <li key={m.id} className={cn("flex items-center gap-3 py-2 text-[13px]", m.voided_at && "opacity-50")}>
                    <span className="w-[52px] shrink-0 font-mono text-[12px] text-ink-3">{new Date(m.occurred_on + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                    <span className="min-w-0 flex-1 truncate"><b>{m.item_name}</b> · {cat.data?.moves[m.kind] ?? m.kind}{m.batch_code ? ` · ${m.batch_code}` : ""}{m.created_by_name ? ` · ${m.created_by_name}` : ""}</span>
                    <span className={cn("font-mono font-semibold tnum", m.quantity < 0 ? "text-crit" : "text-good")}>{m.quantity > 0 ? "+" : ""}{m.quantity.toLocaleString("en-NG")} {m.item_unit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <ItemSheet itemId={open} onClose={() => setOpen(null)} onAction={(kind, item, lotId) => { setAct({ kind, item, lotId }); }} />
      <ReceiveDialog open={act?.kind === "receive"} onClose={() => setAct(null)} itemId={act?.item?.id} />
      <IssueDialog open={act?.kind === "use"} onClose={() => setAct(null)} itemId={act?.item?.id} />
      <CountDialog open={act?.kind === "count"} onClose={() => setAct(null)} item={act?.kind === "count" ? findItem(act.item!.id) ?? act.item! : null} />
      <WriteOffDialog open={act?.kind === "writeoff"} onClose={() => setAct(null)} item={act?.kind === "writeoff" ? act.item! : null} lotId={act?.lotId} />
      <ItemDialog open={act?.kind === "edit" || act?.kind === "new"} onClose={() => setAct(null)} item={act?.kind === "edit" ? act.item : null} />
    </>
  );
}
