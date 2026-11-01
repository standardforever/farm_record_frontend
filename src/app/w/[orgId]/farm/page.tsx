"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, MapPin, Pencil, Plus, Search } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoader, Select, Toggle } from "@/components/ui";
import { AddUnitsDialog, kindIcon, SiteDialog, STATUS_LOOK, STATUS_ORDER, UnitDrawer, useCatalog, useFarmMap } from "@/features/farm";
import type { Site, Unit, UnitBatch, UnitStatus } from "@/features/farm";
import { StockBatchDialog } from "@/features/batches";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";

export default function FarmPage() {
  return <RequirePermission permission="farm.view"><FarmMapView /></RequirePermission>;
}

function FarmMapView() {
  const ws = useCurrentWorkspace();
  const [archived, setArchived] = useState(false);
  const map = useFarmMap(ws.orgId, archived);
  const catalog = useCatalog();
  const [status, setStatus] = useState<UnitStatus | "">("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [siteDialog, setSiteDialog] = useState<{ site: Site | null } | null>(null);
  const [adding, setAdding] = useState<{ site?: string } | null>(null);
  const [stocking, setStocking] = useState<string | null>(null);
  const canSetup = ws.can("farm.setup");

  const data = map.data;
  const allUnits = useMemo(() => data?.sites.flatMap((s) => s.units) ?? [], [data]);
  const unit = allUnits.find((u) => u.id === openUnit) ?? null;
  const match = (u: Unit) => (!status || u.status === status) && (!kind || u.kind === kind)
    && (!q || `${u.code} ${u.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const room = data?.units_limit != null ? Math.max(data.units_limit - data.units_used, 0) : null;
  const kindsPresent = [...new Set(allUnits.map((u) => u.kind))];

  if (!ws.has("farm")) return <EmptyState icon={<MapIcon size={22} />} title="Farm records are not in your plan" body="Ask Oko to switch your plan to one that includes farm records." />;
  if (map.isLoading || !data) return <PageLoader />;
  const activeCount = allUnits.filter((u) => !u.archived_at).length;

  return (
    <>
      <PageHeader eyebrow="Farm" title="Farm map"
        sub={activeCount ? `${activeCount} unit${activeCount === 1 ? "" : "s"} across ${data.sites.length} site${data.sites.length === 1 ? "" : "s"}${data.total_capacity ? ` · room for ${data.total_capacity.toLocaleString("en-NG")} head` : ""}` : "Every pond, house and pen on your farm, and what state it is in."}
        actions={canSetup && data.sites.length > 0 ? <>
          <Button onClick={() => setSiteDialog({ site: null })}><MapPin size={16} /> Add site</Button>
          <Button variant="primary" onClick={() => setAdding({})}><Plus size={16} /> Add units</Button>
        </> : undefined} />

      {data.limited_to_scope && <div className="mb-4"><Alert tone="info">You see only the part of the farm you are assigned to.</Alert></div>}
      {canSetup && data.units_limit != null && room === 0 && (
        <div className="mb-4"><Alert tone="warn" title={`Your plan's ${data.units_limit} units are all in use`}>Archive units you no longer use, or ask Oko to upgrade your plan.</Alert></div>
      )}

      {data.sites.length === 0 ? (
        <Card>
          <EmptyState icon={<MapIcon size={22} />} title={canSetup ? "Set up your farm" : "No units yet"}
            body={canSetup ? "Start with a site (your main farm), then add your ponds, houses or pens. It takes about a minute." : "An owner or manager sets up the farm's units."}
            action={canSetup ? <Button variant="primary" onClick={() => setSiteDialog({ site: null })}><MapPin size={16} /> Add your first site</Button> : undefined} />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {STATUS_ORDER.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(status === s ? "" : s)} aria-pressed={status === s}
                className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                  status === s ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:border-ink-3")}>
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_LOOK[s].dot)} />
                {catalog.data?.statuses[s] ?? s}<span className="font-mono text-ink-3">{data.by_status[s] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input aria-label="Search units" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search P3, House A…" />
            </div>
            {kindsPresent.length > 1 && (
              <div className="w-[170px]"><Select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All kinds</option>{kindsPresent.map((k) => <option key={k} value={k}>{catalog.data?.kinds[k]?.label ?? k}</option>)}
              </Select></div>
            )}
            <div className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">Show archived <Toggle checked={archived} onChange={setArchived} label="Show archived units" /></div>
            {canSetup && data.units_limit != null && <span className="w-full text-[12.5px] text-ink-3 sm:w-auto">{data.units_used} of {data.units_limit} units on your plan</span>}
          </div>

          <div className="flex flex-col gap-4">
            {data.sites.map((site) => {
              const shown = site.units.filter(match);
              return (
                <Card key={site.id} title={<span className="flex flex-wrap items-center gap-2">{site.name} <Badge>{site.code}</Badge></span>}
                  meta={[site.address, site.lga, site.state].filter(Boolean).join(", ") || undefined}
                  action={canSetup ? <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setAdding({ site: site.id })}><Plus size={14} /> Units</Button>
                    <Button size="sm" variant="ghost" aria-label={`Edit ${site.name}`} onClick={() => setSiteDialog({ site })}><Pencil size={14} /></Button>
                  </div> : undefined}>
                  {site.units.length === 0 ? (
                    <EmptyState title="No units here yet" body={canSetup ? "Add your ponds, houses or pens. You can add several at once, like P1–P4." : undefined}
                      action={canSetup ? <Button variant="primary" onClick={() => setAdding({ site: site.id })}><Plus size={16} /> Add units</Button> : undefined} />
                  ) : shown.length === 0 ? (
                    <p className="py-3 text-center text-ink-3">No units match these filters.</p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                      {shown.map((u) => <Tile key={u.id} unit={u} batches={data.unit_batches[u.id] ?? []} counts={catalog.data?.kinds[u.kind]?.counts} label={catalog.data?.statuses[u.status]} onOpen={() => setOpenUnit(u.id)} />)}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <UnitDrawer unit={unit} sites={data.sites} batches={unit ? data.unit_batches[unit.id] ?? [] : []} onClose={() => setOpenUnit(null)}
        onStock={(id) => { setOpenUnit(null); setStocking(id); }} />
      <StockBatchDialog open={!!stocking} presetUnit={stocking ?? undefined} onClose={() => setStocking(null)} />
      <SiteDialog open={!!siteDialog} site={siteDialog?.site} onClose={() => setSiteDialog(null)} />
      <AddUnitsDialog open={!!adding} presetSite={adding?.site} sites={data.sites} room={room} onClose={() => setAdding(null)} />
    </>
  );
}

function Tile({ unit, batches, counts, label, onOpen }: { unit: Unit; batches: UnitBatch[]; counts?: string; label?: string; onOpen: () => void }) {
  const Icon = kindIcon(unit.kind);
  const look = STATUS_LOOK[unit.status];
  return (
    <li>
      <button type="button" onClick={onOpen}
        className={cn("flex h-full w-full cursor-pointer flex-col gap-1 rounded-[14px] border p-3 text-left transition-shadow hover:shadow-[var(--shadow)]",
          look.tile, unit.archived_at && "border-dashed opacity-55")}>
        <span className="flex items-center justify-between gap-2"><b className="font-mono text-[15px]">{unit.code}</b><Icon size={16} className="text-ink-3" /></span>
        {unit.name && <span className="truncate text-[12.5px] text-ink-2">{unit.name}</span>}
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-[12px] font-semibold text-ink-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", look.dot)} />{unit.archived_at ? "Archived" : label ?? unit.status}
        </span>
        {batches.length > 0 ? batches.map((b) => (
          <span key={b.id} className="text-[11.5px] text-ink-2"><b className="font-mono">{b.code}</b> · {b.count.toLocaleString("en-NG")}{unit.capacity ? ` / ${unit.capacity.toLocaleString("en-NG")}` : ""}</span>
        )) : unit.capacity != null && <span className="text-[11.5px] text-ink-3">{unit.capacity.toLocaleString("en-NG")} {counts}</span>}
      </button>
    </li>
  );
}
