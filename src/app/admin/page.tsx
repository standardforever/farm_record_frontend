"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge, Card, Input, PageHeader, PageLoader, Pager, Select, Stat, useDebounced, usePager, useToast } from "@/components/ui";
import { ORG_TYPES, orgTypeLabel } from "@/config/orgTypes";
import { useAdminOrgs, useAdminStats, useUpdateOrg } from "@/features/admin/api";
import { usePlans } from "@/features/meta/api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

const LEVELS = ["none", "phone", "identity", "business", "farm", "professional"];

export default function AdminHome() {
  const stats = useAdminStats();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const term = useDebounced(q);
  const pg = usePager(20, [term, type]);
  const orgs = useAdminOrgs(term, type, pg.params);
  const plans = usePlans();
  const update = useUpdateOrg();
  const toast = useToast();
  const change = async (id: string, body: Record<string, string>, label: string) => {
    try { await update.mutateAsync({ id, ...body }); toast(label); } catch (e) { toast((e as ApiError).message, "crit"); }
  };

  return (
    <>
      <PageHeader eyebrow="Oko operations" title="Workspaces" sub="Plans, verification and suspension. Staff cannot open a workspace's farm records from here." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label="Accounts" value={stats.data?.users ?? "—"} />
        <Stat label="Workspaces" value={stats.data?.organizations ?? "—"} />
        <Stat label="Memberships" value={stats.data?.memberships ?? "—"} />
        <Stat label="Farms" value={stats.data?.organizations_by_type?.farm ?? 0} sub={`${Object.keys(stats.data?.organizations_by_type ?? {}).length} workspace types`} />
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input className="pl-9" placeholder="Search workspaces" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search workspaces" /></div>
        <Select className="w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{ORG_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
      </div>
      <Card flush>
        {orgs.isLoading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13.5px]">
              <thead><tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-ink-3">
                <th className="px-4 py-2">Workspace</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Members</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Verification</th><th className="px-3 py-2">Status</th>
              </tr></thead>
              <tbody>
                {orgs.data?.items.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="px-4 py-2.5"><b className="block">{o.name}</b><span className="text-[12px] text-ink-3">{o.state ?? "—"} · since {formatDate(o.created_at)}</span></td>
                    <td className="px-3 py-2.5">{orgTypeLabel(o.type)}</td>
                    <td className="px-3 py-2.5 tnum">{o.members}</td>
                    <td className="px-3 py-2.5"><Select className="w-36 py-1.5" value={o.plan_code} aria-label="Plan" onChange={(e) => change(o.id, { plan_code: e.target.value }, `${o.name}: plan changed`)}>
                      {(plans.data ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></td>
                    <td className="px-3 py-2.5"><Select className="w-36 py-1.5" value={o.verification_level} aria-label="Verification" onChange={(e) => change(o.id, { verification_level: e.target.value }, `${o.name}: verification updated`)}>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</Select></td>
                    <td className="px-3 py-2.5"><button className="cursor-pointer" onClick={() => change(o.id, { status: o.status === "active" ? "suspended" : "active" }, `${o.name}: ${o.status === "active" ? "suspended" : "reactivated"}`)}>
                      <Badge tone={o.status === "active" ? "good" : "crit"} dot>{o.status}</Badge></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager className="mx-4 mb-3" {...pg.bind(orgs.data?.total, orgs.isFetching)} noun="workspaces" />
      </Card>
    </>
  );
}
