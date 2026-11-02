"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, PageLoader, Pager, usePager } from "@/components/ui";
import { useAudit } from "@/features/audit/api";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { cn, formatDateTime } from "@/lib/format";

const FILTERS = [
  { v: "", l: "Everything" }, { v: "member.", l: "People" }, { v: "invite.", l: "Invites" },
  { v: "role.", l: "Roles" }, { v: "workspace.", l: "Workspace" }, { v: "admin.", l: "Oko staff" },
];

export default function AuditPage() {
  return <RequirePermission permission="audit.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const [action, setAction] = useState("");
  const pg = usePager(20, [action]);
  const { data, isLoading, isFetching } = useAudit(ws.orgId, action, pg.params);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Audit trail" sub="Every change, who made it and when. Nothing here can be edited or deleted." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setAction(f.v)}
            className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-semibold", action === f.v ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>{f.l}</button>
        ))}
      </div>
      <Card flush>
        {isLoading ? <PageLoader /> : !data?.items.length ? <EmptyState icon={<ScrollText size={22} />} title="Nothing recorded yet" /> : (
          <ol className={cn(isFetching && "opacity-60")}>
            {data.items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-0">
                <span className="w-[150px] shrink-0 font-mono text-[12px] text-ink-3">{formatDateTime(e.created_at)}</span>
                <span className="min-w-[200px] flex-1"><b className="block text-[13.5px]">{e.summary || e.action}</b>
                  <span className="text-[12.5px] text-ink-3">{e.actor_name ?? "System"}</span></span>
                <Badge className="font-mono">{e.action}</Badge>
              </li>
            ))}
          </ol>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(data?.total, isFetching)} noun="entries" />
      </Card>
    </>
  );
}
