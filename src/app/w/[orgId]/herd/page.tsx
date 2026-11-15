"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Baby, CalendarHeart, Eye, Heart, PawPrint, Plus, Search, Settings2, Sprout, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, PageLoader, Segmented, Stat } from "@/components/ui";
import { ItemAction, actionFor } from "@/features/herd/Actions";
import { type Animal, type Upcoming, ageText, shortDate, useAnimals, useHerdOverview } from "@/features/herd/api";
import { MateDialog, SettingsDialog, TagDialog, useBreedingGroups } from "@/features/herd/Dialogs";
import { localDay } from "@/features/daily/api";
import { useCurrentWorkspace } from "@/features/workspaces";
import { cn } from "@/lib/format";

const KIND: Record<Upcoming["kind"], { icon: LucideIcon; tone: string }> = {
  overdue: { icon: AlertTriangle, tone: "bg-crit-soft text-crit" },
  due: { icon: Baby, tone: "bg-brand-soft text-brand" },
  prepare: { icon: Sprout, tone: "bg-warn-soft text-warn" },
  check: { icon: Stethoscope, tone: "bg-water-soft text-water" },
  heat: { icon: Eye, tone: "bg-water-soft text-water" },
  wean: { icon: PawPrint, tone: "bg-good-soft text-good" },
  ready: { icon: Heart, tone: "bg-good-soft text-good" },
};
const SPECIES: Record<string, string> = { goats: "Goats", sheep: "Sheep", pigs: "Pigs", cattle: "Cattle", rabbits: "Rabbits" };

export default function HerdPage() {
  const ws = useCurrentWorkspace();
  const ov = useHerdOverview(ws.orgId);
  const [tab, setTab] = useState<"next" | "animals">("next");
  const [tagging, setTagging] = useState(false);
  const [mating, setMating] = useState(false);
  const [setting, setSetting] = useState(false);
  const edit = ws.can("farm.edit");
  const groups = useBreedingGroups(true);
  const all = useAnimals(ws.orgId);

  if (ov.isLoading || all.isLoading) return <PageLoader />;
  const o = ov.data;
  const none = !all.data?.length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Farm</div>
          <h1 className="mt-1 font-display text-[28px] font-bold">Breeding</h1>
          <p className="mt-1 max-w-[620px] text-ink-2">Goats, sheep, pigs, cattle and rabbits one by one: who was mated, who is due, and what to do next.</p>
        </div>
        {edit && !none && (
          <div className="flex flex-wrap gap-2">
            {ws.can("farm.approve") && <Button variant="ghost" aria-label="Breeding numbers" onClick={() => setSetting(true)}><Settings2 size={16} /> Numbers</Button>}
            <Button onClick={() => setTagging(true)}><Plus size={16} /> Tag animals</Button>
            <Button variant="primary" onClick={() => setMating(true)}><Heart size={16} /> Record mating</Button>
          </div>
        )}
      </div>

      {none ? (
        <Card>
          <EmptyState icon={<CalendarHeart size={24} />} title="Keep each breeding animal on record"
            body={groups.length
              ? "Give each doe, ewe, sow, cow or rabbit a tag. Oko then works out heat, pregnancy checks, due dates and weaning for you."
              : "First stock a group of goats, sheep, pigs, cattle or rabbits in Batches. Feed and costs stay on the group; here you tag the breeding animals one by one."}
            action={groups.length ? (edit ? <Button variant="primary" onClick={() => setTagging(true)}><Plus size={16} /> Tag animals</Button> : undefined)
              : <Link href={`/w/${ws.orgId}/batches`} className="font-semibold text-brand">Go to Batches</Link>} />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat hero label="Breeding females" value={o?.females ?? 0} sub={`${o?.males ?? 0} male${o?.males === 1 ? "" : "s"} · ${o?.young ?? 0} young`} />
            <Stat label="Pregnant" value={o?.pregnant ?? 0} sub={`${o?.served ?? 0} mated, not checked`} />
            <Stat label="Due in 30 days" value={o?.due_30 ?? 0} sub="to give birth" />
            <Stat label="Ready to mate" value={o?.ready ?? 0} sub="rested and old enough" />
          </div>
          <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: "next", label: "Coming up" }, { value: "animals", label: `Animals (${all.data?.length ?? 0})` }]} /></div>
          {tab === "next" ? <Calendar items={o?.items ?? []} edit={edit} /> : <Animals rows={all.data ?? []} />}
        </>
      )}
      <TagDialog open={tagging} onClose={() => setTagging(false)} />
      <MateDialog open={mating} onClose={() => setMating(false)} />
      <SettingsDialog open={setting} onClose={() => setSetting(false)} />
    </>
  );
}

function Calendar({ items, edit }: { items: Upcoming[]; edit: boolean }) {
  const ws = useCurrentWorkspace();
  const [doing, setDoing] = useState<{ item: Upcoming; act: "check" | "birth" | "wean" | "mate" } | null>(null);
  const today = localDay();
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const groups: [string, Upcoming[]][] = [
    ["Needs attention", items.filter((i) => i.late || i.kind === "overdue" || (i.kind === "ready" && i.on <= today))],
    ["This week", items.filter((i) => !i.late && i.kind !== "overdue" && !(i.kind === "ready" && i.on <= today) && i.on <= week)],
    ["Later", items.filter((i) => !i.late && i.kind !== "overdue" && i.on > week)],
  ];
  if (!items.length) return <Card><EmptyState title="Nothing coming up" body="Record a mating and Oko lists the heat watch, pregnancy check, due date and weaning here." /></Card>;
  return (
    <div className="flex flex-col gap-4">
      {groups.filter(([, l]) => l.length).map(([title, list]) => (
        <Card key={title} title={title} meta={`${list.length}`}>
          <ul className="flex flex-col">
            {list.map((i) => {
              const k = KIND[i.kind], a = actionFor(i.kind);
              return (
                <li key={`${i.kind}-${i.animal_id}-${i.mating_id}`} className="flex items-start gap-3 border-t border-line py-3 first:border-0 first:pt-0">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[12px]", k.tone)}><k.icon size={19} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <b className="text-[14.5px]">{i.title}</b>
                      <span className={cn("text-[12.5px] font-semibold", i.kind === "ready" && i.on <= today ? "text-good" : i.late || i.kind === "overdue" ? "text-crit" : "text-ink-3")}>
                        {i.kind === "ready" && i.on <= today ? "Now" : i.on === today ? "Today" : shortDate(i.on)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-2">{i.detail}</p>
                    <Link href={`/w/${ws.orgId}/herd/${i.animal_id}`} className="mt-1 inline-block text-[12.5px] font-semibold text-brand hover:underline">Open {i.tag}</Link>
                  </div>
                  {edit && a && <Button size="sm" variant={i.kind === "overdue" || i.kind === "due" ? "primary" : "secondary"} onClick={() => setDoing({ item: i, act: a.act })}>{a.label}</Button>}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {doing && <ItemAction item={doing.item} act={doing.act} onClose={() => setDoing(null)} />}
    </div>
  );
}

function Animals({ rows }: { rows: Animal[] }) {
  const ws = useCurrentWorkspace();
  const species = [...new Set(rows.map((a) => a.species))];
  const [sp, setSp] = useState("");
  const [sex, setSex] = useState<"" | "female" | "male">("");
  const [q, setQ] = useState("");
  const shown = useMemo(() => rows.filter((a) => (!sp || a.species === sp) && (!sex || a.sex === sex)
    && (!q || a.tag.toLowerCase().includes(q.toLowerCase()) || (a.name ?? "").toLowerCase().includes(q.toLowerCase()))), [rows, sp, sex, q]);
  return (
    <Card flush>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {species.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {["", ...species].map((s) => (
              <button key={s || "all"} type="button" aria-pressed={sp === s} onClick={() => setSp(s)}
                className={cn("rounded-full border px-3 py-1 text-[13px] font-semibold", sp === s ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>{s ? SPECIES[s] ?? s : "All"}</button>
            ))}
          </div>
        )}
        <Segmented value={sex} onChange={setSex} options={[{ value: "", label: "All" }, { value: "female", label: "Females" }, { value: "male", label: "Males" }]} />
        <label className="relative ml-auto w-full sm:w-[220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input aria-label="Find by tag or name" placeholder="Tag or name" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
      </div>
      <ul className="divide-y divide-line">
        {shown.map((a) => (
          <li key={a.id}>
            <Link href={`/w/${ws.orgId}/herd/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold", a.sex === "female" ? "bg-brand-soft text-brand" : "bg-surface-3 text-ink-2")}
                aria-label={a.sex}>{a.sex === "female" ? "♀" : "♂"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2"><b className="font-mono text-[14.5px]">{a.tag}</b>{a.name && <span className="text-[13.5px]">{a.name}</span>}</div>
                <div className="text-[12.5px] text-ink-3">{SPECIES[a.species] ?? a.species} · {ageText(a.age_days)} · {a.batch_code}</div>
              </div>
              {a.state && <Badge tone={a.state_tone} className="max-sm:max-w-[150px] max-sm:truncate">{a.state}</Badge>}
            </Link>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-6 text-center text-[13.5px] text-ink-3">No animals match.</li>}
      </ul>
    </Card>
  );
}
