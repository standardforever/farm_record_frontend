"use client";

import { useState } from "react";
import { Alert, Badge, Button, Dialog, Field, Input, Select, Toggle, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { type FarmScope, ScopePicker, scopeIsValid } from "@/features/farm";
import { useCurrentWorkspace } from "@/features/workspaces";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";
import { canGrant, useRemoveMember, useRoles, useUpdateMember } from "./api";

export function MemberDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const { me } = useAuth();
  const roles = useRoles(ws.orgId);
  const update = useUpdateMember(ws.orgId);
  const remove = useRemoveMember(ws.orgId);
  const toast = useToast();
  const [roleId, setRoleId] = useState("");
  const [end, setEnd] = useState<string | null>(null);
  const [scope, setScope] = useState<FarmScope | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (!member) return null;
  const isMe = member.user_id === me?.user.id;
  const canManage = ws.can("members.manage") && canGrant(ws.my_permissions, member.role);
  const options = (roles.data ?? []).filter((r) => canGrant(ws.my_permissions, r));
  const currentEnd = end ?? (member.access_expires_at ? member.access_expires_at.slice(0, 10) : "");
  const err = (update.error ?? remove.error) as ApiError | null;

  const selectedRole = options.find((r) => r.id === (roleId || member.role.id)) ?? member.role;
  const isOwnerRole = selectedRole.permissions.includes("*");
  const close = () => { setRoleId(""); setEnd(null); setScope(null); setConfirm(false); update.reset(); remove.reset(); onClose(); };
  const save = async () => {
    await update.mutateAsync({
      id: member.id,
      ...(roleId && roleId !== member.role.id ? { role_id: roleId } : {}),
      ...(end !== null ? (end ? { access_expires_at: new Date(end + "T23:59:00").toISOString() } : { clear_expiry: true }) : {}),
      ...(scope !== null ? { scope: isOwnerRole ? {} : scope } : isOwnerRole && Object.keys(member.scope ?? {}).length ? { scope: {} } : {}),
    });
    toast(`Updated ${member.full_name}`);
    close();
  };
  const toggleStatus = async (active: boolean) => {
    await update.mutateAsync({ id: member.id, status: active ? "active" : "suspended" });
    toast(active ? `${member.full_name} can sign in again` : `${member.full_name} is suspended`);
  };
  const doRemove = async () => {
    await remove.mutateAsync(member.id);
    toast(isMe ? "You left the workspace" : `${member.full_name} removed. Their access ended now.`);
    close();
  };

  return (
    <Dialog open={!!member} onClose={close} side title={member.full_name} eyebrow={member.kind === "guest" ? "Guest" : "Team member"}
      footer={canManage && !isMe ? <><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" loading={update.isPending} onClick={save} disabled={(!roleId && end === null && scope === null) || (scope !== null && !scopeIsValid(scope))}>Save changes</Button></> : undefined}>
      <div className="flex flex-col gap-5">
        {err && <Alert tone="crit">{err.message}</Alert>}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[13.5px]">
          <dt className="text-ink-3">Phone</dt><dd className="text-right">{member.phone ?? "—"}</dd>
          <dt className="text-ink-3">Email</dt><dd className="truncate text-right">{member.email ?? "—"}</dd>
          <dt className="text-ink-3">Joined</dt><dd className="text-right">{formatDate(member.created_at)}</dd>
          <dt className="text-ink-3">Status</dt><dd className="text-right"><Badge tone={member.status === "active" ? "good" : "neutral"} dot>{member.status === "active" ? "Active" : "Suspended"}</Badge></dd>
        </dl>
        {canManage && !isMe ? (
          <>
            <Field label="Role" htmlFor="m-role">
              <Select id="m-role" value={roleId || member.role.id} onChange={(e) => setRoleId(e.target.value)}>
                {options.map((r) => <option key={r.id} value={r.id}>{r.name}{r.kind === "guest" ? " (guest)" : ""}</option>)}
              </Select>
            </Field>
            {!isOwnerRole && <ScopePicker value={scope ?? (member.scope as FarmScope)} onChange={setScope} />}
            <Field label="Access ends" htmlFor="m-end" hint="Leave empty for no end date.">
              <Input id="m-end" type="date" value={currentEnd} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span className="text-[13.5px]"><b className="block">Can sign in to this workspace</b><span className="text-ink-3">Suspend to pause access without removing them.</span></span>
              <Toggle checked={member.status === "active"} onChange={toggleStatus} label="Active" disabled={update.isPending} />
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3 text-[13.5px]"><b>{member.role.name}</b><p className="text-ink-3">{member.role.description}</p></div>
        )}
        {(isMe || canManage) && (
          <div className="border-t border-line pt-4">
            {!confirm ? <Button variant="danger" onClick={() => setConfirm(true)}>{isMe ? "Leave this workspace" : "Remove from workspace"}</Button> : (
              <Alert tone="crit" title={isMe ? "Leave this workspace?" : `Remove ${member.full_name}?`}
                action={<div className="flex gap-2"><Button size="sm" onClick={() => setConfirm(false)}>Keep</Button><Button size="sm" variant="danger" loading={remove.isPending} onClick={doRemove}>{isMe ? "Leave" : "Remove"}</Button></div>}>
                {isMe ? "You will lose access until someone invites you again." : "Their access ends immediately. Their past records stay."}
              </Alert>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
