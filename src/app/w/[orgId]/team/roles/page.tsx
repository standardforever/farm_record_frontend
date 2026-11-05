"use client";

import { useState } from "react";
import { SHOW_ROADMAP } from "@/config/focus";
import { Lock, Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader, PageLoader } from "@/components/ui";
import { RoleDialog, usePermissionCatalogue, useRoles } from "@/features/team";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import type { Role } from "@/lib/types";
import { TeamTabs } from "../TeamTabs";

export default function RolesPage() {
  return <RequirePermission permission="members.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const roles = useRoles(ws.orgId);
  const cat = usePermissionCatalogue();
  const [open, setOpen] = useState<{ role: Role | null } | null>(null);
  const has = (r: Role, p: string) => r.permissions.includes("*") || r.permissions.includes(p);
  const groups = (cat.data ?? []).filter((g) => g.permissions.length && (SHOW_ROADMAP || g.status !== "planned"));

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Team and access" sub="Roles decide what each person can see and do. Built-in roles cover most needs; make a custom role for anything else."
        actions={ws.can("roles.manage") ? <Button variant="primary" onClick={() => setOpen({ role: null })}><Plus size={16} /> New custom role</Button> : undefined} />
      <TeamTabs />
      {roles.isLoading || cat.isLoading ? <PageLoader /> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(roles.data ?? []).map((r) => (
              <button key={r.id} onClick={() => setOpen({ role: r })} className="flex cursor-pointer flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-4 text-left hover:border-ink-3">
                <span className="flex items-center gap-2"><b>{r.name}</b>
                  <Badge tone={r.kind === "guest" ? "maize" : "brand"}>{r.kind === "guest" ? "Guest" : "Team"}</Badge>
                  {r.is_system ? <Lock size={13} className="ml-auto text-ink-3" /> : <Badge tone="info" className="ml-auto">Custom</Badge>}</span>
                <span className="text-[12.5px] text-ink-3">{r.description}</span>
                <span className="text-[12px] font-semibold text-ink-2">{r.permissions.includes("*") ? "Full access" : `${r.permissions.length} permissions`}</span>
              </button>
            ))}
          </div>
          <Card title="Who can do what" meta="Read across a row to see which roles have a permission." flush>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead><tr>
                  <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-3">Permission</th>
                  {(roles.data ?? []).map((r) => <th key={r.id} className="whitespace-nowrap px-2 py-2 text-center text-[11.5px] font-semibold text-ink-2">{r.name.replace(" (guest)", "")}</th>)}
                </tr></thead>
                <tbody>
                  {groups.map((g) => [
                    <tr key={g.module}><td colSpan={99} className="bg-surface-2 px-4 py-1.5 text-[12px] font-semibold">{g.name}{g.status === "planned" && <span className="ml-2 font-normal text-ink-3">coming {g.phase.replace("phase-", "phase ")}</span>}</td></tr>,
                    ...g.permissions.map((p) => (
                      <tr key={p.key} className="border-t border-line">
                        <td className="sticky left-0 bg-surface px-4 py-2"><span className="block min-w-[180px]">{p.label}</span></td>
                        {(roles.data ?? []).map((r) => (
                          <td key={r.id} className="px-2 py-2 text-center">{has(r, p.key) ? <span className="text-good" aria-label="Yes">●</span> : <span className="text-surface-3" aria-label="No">○</span>}</td>
                        ))}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <RoleDialog open={!!open} role={open?.role ?? null} onClose={() => setOpen(null)} />
    </>
  );
}
