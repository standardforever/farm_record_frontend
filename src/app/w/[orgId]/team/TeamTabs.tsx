"use client";

import { LinkTabs } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";

export function TeamTabs() {
  const ws = useCurrentWorkspace();
  const base = `/w/${ws.orgId}/team`;
  return (
    <LinkTabs tabs={[
      { href: base, label: "People", count: ws.member_count + ws.guest_count },
      { href: `${base}/roles`, label: "Roles" },
      ...(ws.can("invites.manage") ? [{ href: `${base}/invites`, label: "Invites", count: ws.pending_invites }] : []),
    ]} />
  );
}
