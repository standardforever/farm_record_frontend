"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ChevronRight, CloudOff, Droplets, Egg, LayoutGrid, NotebookPen, Scale, Skull, Stethoscope, UploadCloud, Wheat } from "lucide-react";
import { Button, PageLoader } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { ClimateHomeCard } from "@/features/climate";
import { type QuickKind, QuickLog, localDay, useToday } from "@/features/daily";
import { useFarmMap } from "@/features/farm";
import { ReportCaseDialog } from "@/features/health";
import { InstallOko, SyncSheet, useSync } from "@/features/offline";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";
import { setSimpleMode } from "./mode";

const LAST_UNIT = "oko.simple.unit";
const FISH = ["catfish", "tilapia", "fish"];

type Action = { kind: QuickKind | "sick"; label: string; icon: LucideIcon; tone: string; show?: (species: string[]) => boolean };
const ACTIONS: Action[] = [
  { kind: "feed", label: "Feed", icon: Wheat, tone: "bg-maize-soft text-warn" },
  { kind: "deaths", label: "Deaths", icon: Skull, tone: "bg-crit-soft text-crit" },
  { kind: "eggs", label: "Eggs", icon: Egg, tone: "bg-maize-soft text-warn", show: (s) => s.some((x) => x === "layers" || x === "noilers" || x === "quail" || x === "duck") },
  { kind: "water", label: "Water check", icon: Droplets, tone: "bg-water-soft text-water", show: (s) => s.some((x) => FISH.includes(x)) },
  { kind: "weight", label: "Weigh", icon: Scale, tone: "bg-brand-soft text-brand" },
  { kind: "sick", label: "Sick animals", icon: Stethoscope, tone: "bg-crit-soft text-crit" },
  { kind: "note", label: "Note", icon: NotebookPen, tone: "bg-surface-2 text-ink-2" },
];

/** The whole day's work on one screen: where you are, big buttons, what is left, and whether it is sent. */
export function SimpleHome() {
  const ws = useCurrentWorkspace();
  const { me } = useAuth();
  const farm = useFarmMap(ws.orgId);
  const today = useToday(ws.orgId, localDay());
  const sync = useSync(ws.orgId);
  const [unit, setUnit] = useState<string | null>(null);
  const [log, setLog] = useState<QuickKind | null>(null);
  const [sick, setSick] = useState(false);
  const [sheet, setSheet] = useState(false);
  const canLog = ws.can("farm.edit") || ws.can("farm.approve");

  const units = useMemo(() => {
    const occ = farm.data?.unit_batches ?? {};
    return (farm.data?.sites ?? []).flatMap((s) => s.units.filter((u) => !u.archived_at && occ[u.id]?.length))
      .map((u) => ({ ...u, batches: occ[u.id] }));
  }, [farm.data]);
  useEffect(() => {
    if (!units.length) return;
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_UNIT); } catch { /* ignore */ }
    setUnit((u) => u && units.some((x) => x.id === u) ? u : units.find((x) => x.id === last)?.id ?? units[0].id);
  }, [units]);
  const pick = (id: string) => { setUnit(id); try { localStorage.setItem(LAST_UNIT, id); } catch { /* ignore */ } };

  if (!farm.data) return <PageLoader label={sync.online ? "Loading your farm…" : "No network yet. Open Oko once with network to use it offline."} />;
  const here = units.find((u) => u.id === unit);
  const species = here?.batches.map((b) => b.species) ?? [];
  const actions = ACTIONS.filter((a) => !a.show || a.show(species) || (!here && a.kind === "note"));
  const firstName = me?.user.full_name.split(" ")[0] ?? "";
  const done = today.data?.done ?? 0, total = today.data?.total ?? 0;
  const waiting = sync.waiting.length, conflicts = sync.conflicts.length;

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5">
      <div>
        <p className="text-[15px] text-ink-3">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-[28px] font-bold leading-tight">Hello{firstName ? `, ${firstName}` : ""}</h1>
      </div>

      <button type="button" onClick={() => setSheet(true)}
        className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left",
          conflicts ? "border-crit bg-crit-soft" : !sync.online ? "border-warn bg-maize-soft" : waiting ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
        {conflicts ? <CloudOff size={28} className="text-crit" /> : !sync.online ? <CloudOff size={28} className="text-warn" />
          : waiting ? <UploadCloud size={28} className="text-brand" /> : <CheckCircle2 size={28} className="text-good" />}
        <span className="min-w-0 flex-1">
          <b className="block text-[17px]">{conflicts ? `${conflicts} could not be sent` : !sync.online ? "No network. Keep working." : waiting ? `Sending ${waiting}…` : "Everything is sent"}</b>
          <span className="text-[14px] text-ink-2">{conflicts ? "Tap to see why and fix it." : !sync.online ? `${waiting ? `${waiting} saved on this phone. ` : ""}It sends by itself when the network is back.` : waiting ? "Saved on this phone until it goes." : "Your manager can see your work."}</span>
        </span>
        <ChevronRight size={20} className="text-ink-3" />
      </button>

      <ClimateHomeCard big />

      {units.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-[15px] text-ink-2">No pond, house or pen has animals in it yet. Your manager stocks a batch first.</p>
      ) : (
        <section>
          <h2 className="mb-2 text-[15px] font-bold text-ink-2">Where are you working?</h2>
          <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Unit">
            {units.map((u) => (
              <button key={u.id} type="button" role="radio" aria-checked={u.id === unit} onClick={() => pick(u.id)}
                className={cn("min-w-[104px] shrink-0 rounded-2xl border-2 px-3.5 py-2.5 text-left", u.id === unit ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
                <b className="block font-mono text-[18px]">{u.code}</b>
                <span className="text-[13px] text-ink-2">{u.batches.reduce((n, b) => n + b.count, 0).toLocaleString("en-NG")} {u.batches[0].species}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {canLog && (
        <section className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button key={a.kind} type="button" disabled={a.kind !== "note" && !here}
              onClick={() => (a.kind === "sick" ? setSick(true) : setLog(a.kind))}
              className="flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-2xl border border-line bg-surface p-4 text-left active:scale-[.98] disabled:opacity-50">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", a.tone)}><a.icon size={24} /></span>
              <b className="text-[18px]">{a.label}</b>
            </button>
          ))}
        </section>
      )}

      <Link href={`/w/${ws.orgId}/today`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><CheckCircle2 size={24} /></span>
        <span className="min-w-0 flex-1"><b className="block text-[17px]">Today&apos;s jobs</b>
          <span className="text-[14px] text-ink-2">{total ? `${done} of ${total} done` : "Nothing planned today"}</span></span>
        <ChevronRight size={20} className="text-ink-3" />
      </Link>

      <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
        <InstallOko compact />
        <Button variant="ghost" onClick={() => setSimpleMode(false)}><LayoutGrid size={16} /> Use the full app</Button>
      </div>

      <QuickLog kind={log} on={localDay()} presetUnit={unit} open={!!log} onClose={() => setLog(null)} />
      <ReportCaseDialog open={sick} onClose={() => setSick(false)} batchId={here?.batches[0]?.id} unitId={here?.id} />
      <SyncSheet orgId={ws.orgId} open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
