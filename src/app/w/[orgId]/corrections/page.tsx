"use client";

import { Fragment } from "react";
import { History } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, PageLoader, Pager, usePager } from "@/components/ui";
import { type Change, useCorrections } from "@/features/corrections";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { formatDateTime } from "@/lib/format";

export default function CorrectionsPage() {
  return <RequirePermission permission="audit.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const pg = usePager(20);
  const q = useCorrections(ws.orgId, pg.params);
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Corrections" sub="Every record the owner edited or deleted, why, and what it was before. Nothing here can be changed." />
      <Card flush>
        {q.isLoading ? <PageLoader /> : !q.data?.items.length ? (
          <EmptyState icon={<History size={22} />} title="No corrections yet" body="When the owner edits or deletes a record, it shows here with the reason and the old values." />
        ) : (
          <ul>{q.data.items.map((c) => <ChangeRow key={c.id} c={c} />)}</ul>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(q.data?.total, q.isFetching)} noun="corrections" />
      </Card>
    </>
  );
}

const show = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v);

function ChangeRow({ c }: { c: Change }) {
  const before = c.before[0]?.record ?? {};
  const after = c.after[0]?.record ?? {};
  const keys = c.operation === "edit" ? Object.keys({ ...before, ...after }) : [];
  const linked = c.operation === "delete" ? c.before.slice(1) : [];
  return (
    <li className="border-t border-line px-4 py-3 first:border-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={c.operation === "delete" ? "crit" : "maize"}>{c.operation === "delete" ? "Deleted" : "Edited"}</Badge>
        <b className="min-w-0 break-words text-[14px]">{c.kind_label}: {c.label}</b>
        <span className="ml-auto text-[12px] text-ink-3">{c.actor_name ?? "Someone"} · {formatDateTime(c.created_at)}</span>
      </div>
      <p className="mt-1 text-[13.5px] text-ink-2">“{c.reason}”</p>
      {keys.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-[12.5px]">
            <thead className="text-left text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Field</th><th className="py-1 pr-3 font-semibold">Before</th><th className="py-1 font-semibold">After</th></tr></thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k}><td className="py-1 pr-3 text-ink-3">{c.after[0]?.labels?.[k] ?? k}</td>
                  <td className="py-1 pr-3 text-crit line-through decoration-1">{show(before[k])}</td><td className="py-1 font-semibold">{show(after[k])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c.operation === "delete" && (
        <details className="mt-1.5 text-[12.5px]">
          <summary className="cursor-pointer text-ink-3">What was deleted{linked.length ? ` (and ${linked.length} linked)` : ""}</summary>
          <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            {Object.entries(before).filter(([k, v]) => v !== null && !["organization_id", "id"].includes(k)).map(([k, v]) => (
              <Fragment key={k}><dt className="font-mono text-ink-3">{k}</dt><dd className="break-words">{show(v)}</dd></Fragment>
            ))}
          </dl>
          {linked.length > 0 && <ul className="mt-1.5 list-disc pl-5 text-ink-2">{linked.map((r) => <li key={r.id + r.label}>{r.kind}: {r.label}</li>)}</ul>}
        </details>
      )}
    </li>
  );
}
