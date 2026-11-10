"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Fuel, Gauge, Pencil, Wrench } from "lucide-react";
import { Alert, Badge, Button, Card, PageLoader } from "@/components/ui";
import { OwnerActions } from "@/features/corrections";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { cn, naira } from "@/lib/format";
import { type EquipmentEventKind, useEquipmentDetail, useInventoryCatalog } from "./api";
import { EquipmentDialog, LogDialog, RetireDialog, day } from "./EquipmentPanel";

const TONE: Record<string, "good" | "warn" | "crit" | "neutral"> = { working: "good", needs_service: "warn", broken: "crit", retired: "neutral" };
const DOT: Record<string, string> = { breakdown: "bg-crit", repair: "bg-good", service: "bg-brand", parts: "bg-brand", fuel: "bg-maize", sold: "bg-ink-3", retired: "bg-ink-3" };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 font-display text-[20px] font-bold tnum">{value}</div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** One machine: what it cost, what it costs to keep, its service, and everything that happened to it. */
export function MachineView({ id }: { id: string }) {
  const ws = useCurrentWorkspace();
  const q = useEquipmentDetail(ws.orgId, id);
  const cat = useInventoryCatalog();
  const [logging, setLogging] = useState<EquipmentEventKind | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [retiring, setRetiring] = useState(false);
  const back = <Link href={`/w/${ws.orgId}/stock?tab=equipment`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Equipment</Link>;
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <>{back}<Alert tone="crit">{q.error instanceof ApiError ? q.error.message : "Could not load this machine."}</Alert></>;
  const e = q.data;
  const money = ws.can("finance.view");
  const canLog = (ws.can("inventory.edit") || ws.can("farm.edit")) && e.status !== "retired";
  const edit = ws.can("inventory.edit") && e.status !== "retired";
  const fuelKind = ["generator", "pump", "vehicle", "feed_mill", "pelletizer"].includes(e.kind) || !!e.fuel_litres_this_year;
  const hoursKind = e.hours != null || !!e.service_every_hours;
  const label = (k: string) => cat.data?.equipment_events[k]?.label ?? k;

  return (
    <>
      {back}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{cat.data?.equipment_kinds[e.kind] ?? e.kind} · {e.unit_code ?? e.site_name ?? "Whole farm"}</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-[26px] font-bold">{e.name}
            <Badge tone={TONE[e.status]} dot>{cat.data?.equipment_status[e.status] ?? e.status}</Badge></h1>
          <p className="mt-1 text-ink-2">{[e.bought_on && `Since ${day(e.bought_on)}`, e.caretaker_name && `looked after by ${e.caretaker_name}`, e.serial && `S/N ${e.serial}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLog && e.status === "broken" && <Button variant="primary" onClick={() => setLogging("repair")}><Wrench size={16} /> Log the repair</Button>}
          {canLog && e.status !== "broken" && <Button variant="primary" onClick={() => setLogging("service")}><Wrench size={16} /> Log work or cost</Button>}
          {canLog && fuelKind && <Button onClick={() => setLogging("fuel")}><Fuel size={16} /> Fuel</Button>}
          {canLog && hoursKind && <Button onClick={() => setLogging("hours")}><Gauge size={16} /> Hours</Button>}
          {canLog && e.status !== "broken" && <Button variant="ghost" onClick={() => setLogging("breakdown")}><AlertTriangle size={16} /> Broke down</Button>}
          {edit && <Button variant="ghost" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</Button>}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {e.status === "broken" && (
          <div role="alert" className="flex gap-2.5 rounded-[14px] border border-[color-mix(in_oklab,var(--crit)_35%,transparent)] bg-crit-soft p-4 text-[14px]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-crit" />
            <span><b className="text-crit">Broken{e.broken_since ? ` since ${day(e.broken_since)}` : ""}.</b> {e.broken_note}
              <span className="block text-ink-2">When it is fixed, log the repair and tick &ldquo;It is working again&rdquo;.</span></span>
          </div>
        )}
        {e.status === "retired" && <Alert tone="info" title="Retired">{e.sold_for ? `Sold for ${naira(e.sold_for)}. ` : ""}Its history is kept below.</Alert>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {money && <Stat label="Bought for" value={e.bought_for != null ? naira(e.bought_for) : "—"}
            sub={e.paid ? `${e.paid.status === "owed" ? "Owed" : `Paid${e.paid.account_name ? ` from ${e.paid.account_name}` : ""}`} · ${e.paid.number}` : e.bought_for != null ? "Not paid from an account" : undefined} />}
          {money && <Stat label="To keep it this year" value={naira(e.running_this_year ?? 0)} sub={`Repairs, parts, fuel · ${naira(e.running_total ?? 0)} in all`} />}
          {money && fuelKind && <Stat label="Fuel this year" value={e.fuel_litres_this_year ? `${e.fuel_litres_this_year.toLocaleString()} L` : "—"}
            sub={e.fuel_cost_this_year ? naira(e.fuel_cost_this_year) : undefined} />}
          {money && e.cost_per_hour != null && <Stat label="Cost per hour run" value={naira(e.cost_per_hour)} sub="Fuel and upkeep" />}
          <Stat label="Next service" value={e.next_service_on ? day(e.next_service_on) : "—"}
            sub={[e.last_service_on && `Last ${day(e.last_service_on)}`, e.service_every_days && `every ${e.service_every_days} days`].filter(Boolean).join(" · ") || "No reminder set"} />
          {hoursKind && <Stat label="Hours" value={e.hours != null ? e.hours.toLocaleString() : "—"}
            sub={e.hours_to_service != null ? (e.hours_to_service <= 0 ? <span className="text-warn">Service is due now</span> : `${e.hours_to_service.toLocaleString()} to service`) : undefined} />}
        </div>

        <Card title="History" meta="Newest first">
          {e.events.length === 0 ? <p className="text-[13.5px] text-ink-3">Nothing logged yet. Log services, repairs, parts and fuel here, so you can see what this machine costs to keep.</p> : (
            <ol className="flex flex-col">
              {e.events.map((x) => (
                <li key={x.id} className="flex gap-3 border-t border-line py-2.5 first:border-0">
                  <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[x.kind] ?? "bg-line")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-[14px]">{label(x.kind)}</b>
                      <span className="text-[12.5px] text-ink-3">{day(x.on)}{x.created_by_name ? ` · ${x.created_by_name}` : ""}</span></div>
                    <p className="text-[13px] text-ink-2">{[x.note, x.litres && `${x.litres.toLocaleString()} litres`, x.hours != null && `${x.hours.toLocaleString()} hours on the meter`,
                      x.done_by && `by ${x.done_by}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  {money && x.amount != null && <span className={cn("shrink-0 font-mono text-[13px] font-semibold tnum", x.kind === "sold" && "text-good")}>{x.kind === "sold" ? "+" : ""}{naira(x.amount)}</span>}
                  <OwnerActions kind="equipment_event" id={x.id} compact evidence={false} edit={x.kind !== "sold" && x.kind !== "retired"} className="shrink-0" />
                </li>
              ))}
            </ol>
          )}
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <OwnerActions kind="equipment" id={e.id} edit={false} onDeleted={() => router.replace(`/w/${ws.orgId}/stock?tab=equipment`)} />
          {edit && <Button size="sm" variant="ghost" onClick={() => setRetiring(true)}>Sold, stolen or beyond repair…</Button>}
        </div>
      </div>

      <LogDialog e={logging ? e : null} kind={logging ?? "service"} onClose={() => setLogging(null)} />
      <EquipmentDialog e={editing ? e : null} onClose={() => setEditing(false)} />
      <RetireDialog e={retiring ? e : null} onClose={() => setRetiring(false)} />
    </>
  );
}
