"use client";

import { useState } from "react";
import { Copy, RotateCcw, UserPlus, XCircle } from "lucide-react";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, PageHeader, PageLoader, useToast } from "@/components/ui";
import { InviteDialog, inviteLink, useInvites, useRenewInvite, useRevokeInvite } from "@/features/team";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { formatDate, relative } from "@/lib/format";
import type { Invite } from "@/lib/types";
import { TeamTabs } from "../TeamTabs";

const TONE = { pending: "maize", accepted: "good", revoked: "neutral", expired: "neutral" } as const;

export default function InvitesPage() {
  return <RequirePermission permission="invites.manage"><Inner /></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const { data, isLoading } = useInvites(ws.orgId, ws.can("invites.manage"));
  const revoke = useRevokeInvite(ws.orgId);
  const renew = useRenewInvite(ws.orgId);
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [fresh, setFresh] = useState<Invite | null>(null);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Team and access" sub="Invites work once and expire after 7 days. Cancel one any time."
        actions={<Button variant="primary" onClick={() => setInviting(true)}><UserPlus size={16} /> Invite someone</Button>} />
      <TeamTabs />
      <Card flush>
        {isLoading ? <PageLoader /> : !data?.length ? (
          <EmptyState icon={<UserPlus size={22} />} title="No invites yet" body="Invite staff, or guests like a vet, lender or buyer." action={<Button variant="primary" onClick={() => setInviting(true)}>Invite someone</Button>} />
        ) : (
          <ul>
            {data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-0">
                <Avatar name={i.full_name} tone={i.kind === "guest" ? "maize" : "brand"} />
                <span className="min-w-[180px] flex-1"><b className="block">{i.full_name}</b>
                  <span className="text-[12.5px] text-ink-3">{i.phone ?? i.email} · sent {relative(i.created_at)}{i.invited_by_name ? ` by ${i.invited_by_name}` : ""}</span></span>
                <Badge tone={i.kind === "guest" ? "maize" : "brand"}>{i.role.name}</Badge>
                <Badge tone={TONE[i.status]} dot>{i.status === "pending" ? `Pending · until ${formatDate(i.expires_at)}` : i.status[0].toUpperCase() + i.status.slice(1)}</Badge>
                <span className="flex gap-1.5">
                  {(i.status === "pending" || i.status === "expired" || i.status === "revoked") && (
                    <Button size="sm" loading={renew.isPending && renew.variables === i.id} onClick={async () => setFresh(await renew.mutateAsync(i.id))}><RotateCcw size={14} /> New link</Button>
                  )}
                  {i.status === "pending" && (
                    <Button size="sm" variant="danger" loading={revoke.isPending && revoke.variables === i.id} onClick={async () => { await revoke.mutateAsync(i.id); toast(`Cancelled invite for ${i.full_name}`); }}><XCircle size={14} /> Cancel</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      <Dialog open={!!fresh} onClose={() => setFresh(null)} title="New invite link" footer={<Button variant="primary" onClick={() => setFresh(null)}>Done</Button>}>
        {fresh?.accept_token && (
          <div className="flex flex-col gap-3">
            <p className="text-ink-2">The old link no longer works. {fresh.emailed ? <>We emailed the new link to <b className="text-ink">{fresh.email}</b>.</> : <>Send this one to {fresh.full_name}.</>}</p>
            <div className="break-all rounded-xl bg-surface-2 p-3 font-mono text-[12.5px] select-all">{inviteLink(fresh.accept_token)}</div>
            <Button variant="primary" onClick={() => navigator.clipboard.writeText(inviteLink(fresh.accept_token!)).then(() => toast("Link copied"), () => toast("Select the link and copy it", "crit"))}><Copy size={16} /> Copy link</Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
