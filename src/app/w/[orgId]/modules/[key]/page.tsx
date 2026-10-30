"use client";

import { use } from "react";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import { Badge, Card, PageHeader, PageLoader } from "@/components/ui";
import { PHASE_LABEL } from "@/config/navigation";
import { useMeta } from "@/features/meta/api";
import { useCurrentWorkspace } from "@/features/workspaces";

const ROADMAP = "https://github.com/standardforever/farm_record_backend/blob/main/docs/ROADMAP.md";

export default function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const ws = useCurrentWorkspace();
  const { data, isLoading } = useMeta();
  if (isLoading) return <PageLoader />;
  const m = data?.modules.find((x) => x.key === key);
  if (!m) return <PageHeader title="Module not found" />;
  const perms = data?.permissions.find((g) => g.module === key)?.permissions ?? [];
  const inPlan = !m.feature || ws.has(m.feature);

  return (
    <>
      <PageHeader eyebrow={`${PHASE_LABEL[m.phase]} · coming soon`} title={m.name} sub={m.description} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Status">
          <div className="flex flex-col gap-3 text-[13.5px]">
            <span className="flex items-center gap-2"><Clock size={16} className="text-warn" /><b>Being built in {PHASE_LABEL[m.phase]}</b></span>
            <span className="flex items-center gap-2">{inPlan ? <Badge tone="good" dot>Included in your plan</Badge> : <Badge dot>Not in your current plan</Badge>}</span>
            <p className="text-ink-2">This screen turns into the working module as soon as it is released. You do not need to do anything.</p>
            <Link href={ROADMAP} target="_blank" className="inline-flex items-center gap-1.5 font-semibold text-brand">See the roadmap and milestones <ExternalLink size={14} /></Link>
          </div>
        </Card>
        {perms.length > 0 && (
          <Card title="What people will be able to do" meta="You can already give these permissions in custom roles.">
            <ul className="flex flex-col gap-2 text-[13.5px]">
              {perms.map((p) => <li key={p.key} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span><b>{p.label}</b> <span className="font-mono text-[11.5px] text-ink-3">{p.key}</span></span></li>)}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
