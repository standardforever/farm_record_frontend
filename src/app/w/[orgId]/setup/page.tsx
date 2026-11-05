"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Layers, MapPinned, Package, Smartphone, UserPlus } from "lucide-react";
import { Button, Card, PageHeader, PageLoader } from "@/components/ui";
import { StockBatchDialog, useBatchPage } from "@/features/batches";
import { AddUnitsDialog, SiteDialog, useFarmMap } from "@/features/farm";
import { ItemDialog, ReceiveDialog, useStockItems } from "@/features/inventory";
import { InstallOko } from "@/features/offline";
import { InviteDialog } from "@/features/team";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";

/**
 * Setting up a new farm, one step at a time: where it is, its houses or ponds, the first batch, the feed store, the
 * team, and the phones. Each step uses the same forms as the rest of the app; any step can wait for later. Made so a
 * field agent can set up a farmer in one visit.
 */
export default function SetupPage() {
  return <RequirePermission permission="farm.view"><Inner /></RequirePermission>;
}

type Step = { key: string; icon: React.ReactNode; title: string; body: string; done: boolean; show: boolean; action: React.ReactNode };

function Inner() {
  const ws = useCurrentWorkspace();
  const base = `/w/${ws.orgId}`;
  const farm = useFarmMap(ws.orgId, false);
  const batches = useBatchPage(ws.orgId, { page: 1, page_size: 1 });
  const stock = useStockItems(ws.orgId, undefined, ws.has("inventory") && ws.can("inventory.view"));
  const [open, setOpen] = useState<"site" | "units" | "batch" | "item" | "receive" | "invite" | null>(null);
  // What was put off, and whether the phones are done, is remembered on this device so the guide reads the same tomorrow.
  const key = `oko.setup.${ws.orgId}`;
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
  });
  const remember = (k: string) => {
    const next = [...new Set([...saved, k])]; setSaved(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private window: kept for this visit only */ }
  };
  const skipped = new Set(saved.filter((k) => k !== "phones"));
  const phonesDone = saved.includes("phones");
  if (!farm.data || !batches.data) return <PageLoader />;

  const sites = farm.data.sites;
  const units = sites.reduce((n, s) => n + s.unit_count, 0);
  const room = farm.data.units_limit != null ? Math.max(farm.data.units_limit - farm.data.units_used, 0) : null;
  const items = stock.data ?? [];
  const steps: Step[] = [
    { key: "site", icon: <MapPinned size={18} />, title: "Where is the farm?", show: ws.can("farm.setup"), done: sites.length > 0,
      body: "Name the farm site, so weather alerts and reports know where it is. A second site can be added later.",
      action: <Button variant="primary" onClick={() => setOpen("site")}>Add the farm site</Button> },
    { key: "units", icon: <Layers size={18} />, title: "Houses, ponds or pens", show: ws.can("farm.setup"), done: units > 0,
      body: "Add each poultry house, pond, tank or pen. Ten ponds take one step: give the number and they are named P1 to P10.",
      action: <Button variant="primary" disabled={!sites.length} onClick={() => setOpen("units")}>Add them</Button> },
    { key: "batch", icon: <Layers size={18} />, title: "The animals on the farm now", show: ws.can("farm.approve"), done: batches.data.total > 0,
      body: "Stock a batch for each flock or stocking: when they came, how many, from where. Broilers, layers and catfish get their vaccination schedule and growth standard.",
      action: <Button variant="primary" disabled={!units} onClick={() => setOpen("batch")}>Stock a batch</Button> },
    { key: "stock", icon: <Package size={18} />, title: "The feed store", show: ws.has("inventory") && ws.can("inventory.edit"), done: items.some((i) => i.in_stock > 0),
      body: "Add the feed you buy, and the bags in the store now. Feed logged each day then comes out of the store, at the price you paid.",
      action: items.length ? <Button onClick={() => setOpen("receive")}>Record a delivery</Button> : <Button variant="primary" onClick={() => setOpen("item")}>Add a feed</Button> },
    { key: "team", icon: <UserPlus size={18} />, title: "Your workers and manager", show: ws.can("invites.manage"), done: ws.member_count + ws.guest_count > 1 || ws.pending_invites > 0,
      body: "Invite them by phone or email. Workers see only the houses or ponds you give them, in Simple mode with big buttons.",
      action: <Button variant="primary" onClick={() => setOpen("invite")}>Invite someone</Button> },
    { key: "phones", icon: <Smartphone size={18} />, title: "Put Oko on the phones", show: true, done: phonesDone,
      body: "Install Oko on each phone while it has network. It then opens without network and sends the day's records when signal comes back.",
      action: <div className="flex flex-col items-start gap-2"><InstallOko compact /><Button onClick={() => remember("phones")}>Done</Button></div> },
  ].filter((s) => s.show);
  const isDone = (s: Step) => s.done || skipped.has(s.key);
  const current = steps.find((s) => !isDone(s));
  const doneCount = steps.filter(isDone).length;

  return (
    <>
      <PageHeader eyebrow={ws.organization.name} title="Set up your farm" sub="A few steps, about ten minutes. Anything can wait for later; the records start working from the first step." />
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}
        aria-label={`${doneCount} of ${steps.length} steps done`}>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(100 * doneCount) / steps.length}%` }} />
      </div>
      <ol className="flex max-w-[760px] flex-col gap-3">
        {steps.map((s, i) => {
          const now = s === current;
          return (
            <li key={s.key}>
              <Card className={cn(now && "border-brand shadow-[inset_0_0_0_1px_var(--brand)]", isDone(s) && !now && "opacity-75")}>
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold", s.done ? "bg-good text-white" : now ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-3")}>
                    {s.done ? <Check size={18} /> : i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-[16px] font-bold">{s.title}
                      {skipped.has(s.key) && !s.done && <span className="text-[12px] font-normal text-ink-3">later</span>}</h2>
                    {(now || !isDone(s)) && <p className="mt-1 text-[13.5px] text-ink-2">{s.body}</p>}
                    {now && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {s.action}
                        {s.key !== "phones" && <Button variant="ghost" onClick={() => remember(s.key)}>Later</Button>}
                      </div>
                    )}
                    {s.done && s.key === "units" && <p className="text-[12.5px] text-ink-3">{units} on {sites.length} site{sites.length > 1 ? "s" : ""} · <Link className="font-semibold text-brand" href={`${base}/farm`}>see the farm map</Link></p>}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      {!current && (
        <Card className="mt-4 max-w-[760px]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1"><b className="text-[16px]">The farm is set up.</b>
              <p className="text-[13.5px] text-ink-2">Every morning, Today shows the jobs and what to record. The home page shows how the farm is doing.</p></div>
            <Link href={`${base}/today`} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand px-4 text-[13.5px] font-semibold text-on-brand">Open Today <ArrowRight size={16} /></Link>
          </div>
        </Card>
      )}
      <SiteDialog open={open === "site"} onClose={() => setOpen(null)} />
      <AddUnitsDialog open={open === "units"} onClose={() => setOpen(null)} sites={sites} presetSite={sites[0]?.id} room={room} />
      <StockBatchDialog open={open === "batch"} onClose={() => setOpen(null)} onStocked={() => batches.refetch()} />
      <ItemDialog open={open === "item"} onClose={() => { setOpen(null); stock.refetch(); }} />
      <ReceiveDialog open={open === "receive"} onClose={() => { setOpen(null); stock.refetch(); }} itemId={items[0]?.id} />
      <InviteDialog open={open === "invite"} onClose={() => setOpen(null)} />
    </>
  );
}
