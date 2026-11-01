"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoader, Segmented } from "@/components/ui";
import { scopeLabel, useScopeLookup } from "@/features/farm";
import { InviteDialog, MemberDialog, useMembers } from "@/features/team";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { daysUntil, formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";
import { TeamTabs } from "./TeamTabs";

export default function TeamPage() {
  return <RequirePermission permission="members.view"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const { data, isLoading } = useMembers(ws.orgId);
  const [filter, setFilter] = useState<"all" | "member" | "guest">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [inviting, setInviting] = useState(false);
  const lookup = useScopeLookup();
  const list = useMemo(() => (data ?? []).filter((m) => (filter === "all" || m.kind === filter)
    && (!q || `${m.full_name} ${m.email ?? ""} ${m.phone ?? ""} ${m.role.name}`.toLowerCase().includes(q.toLowerCase()))), [data, filter, q]);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Team and access" sub="Everyone who can open this workspace, what they can do and until when."
        actions={ws.can("invites.manage") ? <Button variant="primary" onClick={() => setInviting(true)}><UserPlus size={16} /> Invite someone</Button> : undefined} />
      <TeamTabs />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "Everyone" }, { value: "member", label: "Team" }, { value: "guest", label: "Guests" }]} />
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input className="pl-9" placeholder="Search name, phone or role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        </div>
      </div>
      <Card flush>
        {isLoading ? <PageLoader /> : list.length === 0 ? (
          <EmptyState title="No one here yet" body="Invite your staff, or a vet or lender as a guest." />
        ) : (
          <ul>
            {list.map((m) => {
              const days = daysUntil(m.access_expires_at);
              return (
                <li key={m.id} className="border-t border-line first:border-0">
                  <button onClick={() => setSelected(m)} className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 sm:flex-nowrap">
                    <Avatar name={m.full_name} tone={m.kind === "guest" ? "maize" : "brand"} />
                    <span className="min-w-0 flex-1"><b className="block truncate">{m.full_name}</b>
                      <span className="block truncate text-[12.5px] text-ink-3">{m.phone ?? m.email}</span></span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={m.kind === "guest" ? "maize" : "brand"}>{m.role.name}</Badge>
                      {m.status === "suspended" && <Badge tone="neutral" dot>Suspended</Badge>}
                      {scopeLabel(m.scope, lookup) && <Badge tone="info">Only {scopeLabel(m.scope, lookup)}</Badge>}
                      {days !== null && <Badge tone={days <= 7 ? "warn" : "neutral"}>{days <= 0 ? "Access ended" : `Until ${formatDate(m.access_expires_at)}`}</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <MemberDialog member={selected} onClose={() => setSelected(null)} />
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}
