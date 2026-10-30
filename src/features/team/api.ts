import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api";
import type { Invite, Member, PermissionGroup, Role } from "@/lib/types";

const k = (orgId: string, what: string) => ["team", orgId, what];

export const useMembers = (orgId: string) => useQuery({ queryKey: k(orgId, "members"), queryFn: () => get<Member[]>(`/organizations/${orgId}/members`) });
export const useRoles = (orgId: string) => useQuery({ queryKey: k(orgId, "roles"), queryFn: () => get<Role[]>(`/organizations/${orgId}/roles`) });
export const useInvites = (orgId: string, enabled = true) =>
  useQuery({ queryKey: k(orgId, "invites"), queryFn: () => get<Invite[]>(`/organizations/${orgId}/invites`), enabled });
export const usePermissionCatalogue = () => useQuery({ queryKey: ["permissions"], queryFn: () => get<PermissionGroup[]>("/permissions"), staleTime: 3600_000 });

function useTeamMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      qc.invalidateQueries({ queryKey: ["workspace", orgId] });
      qc.invalidateQueries({ queryKey: ["audit", orgId] });
    },
  });
}

export type MemberChange = { role_id?: string; scope?: Record<string, unknown>; access_expires_at?: string; clear_expiry?: boolean; status?: string };
export const useUpdateMember = (orgId: string) =>
  useTeamMutation(orgId, ({ id, ...body }: MemberChange & { id: string }) => patch<Member>(`/organizations/${orgId}/members/${id}`, body));
export const useRemoveMember = (orgId: string) => useTeamMutation(orgId, (id: string) => del(`/organizations/${orgId}/members/${id}`));

export type InviteInput = { full_name: string; email?: string; phone?: string; role_id: string; access_expires_at?: string | null; scope?: Record<string, unknown> };
export const useCreateInvite = (orgId: string) => useTeamMutation(orgId, (body: InviteInput) => post<Invite>(`/organizations/${orgId}/invites`, body));
export const useRevokeInvite = (orgId: string) => useTeamMutation(orgId, (id: string) => post<Invite>(`/organizations/${orgId}/invites/${id}/revoke`));
export const useRenewInvite = (orgId: string) => useTeamMutation(orgId, (id: string) => post<Invite>(`/organizations/${orgId}/invites/${id}/renew`));

export type RoleInput = { name: string; description?: string; kind?: string; permissions?: string[]; based_on?: string };
export const useCreateRole = (orgId: string) => useTeamMutation(orgId, (body: RoleInput) => post<Role>(`/organizations/${orgId}/roles`, body));
export const useUpdateRole = (orgId: string) =>
  useTeamMutation(orgId, ({ id, ...body }: { id: string; name?: string; description?: string; permissions?: string[] }) => patch<Role>(`/organizations/${orgId}/roles/${id}`, body));
export const useDeleteRole = (orgId: string) => useTeamMutation(orgId, (id: string) => del(`/organizations/${orgId}/roles/${id}`));

export function inviteLink(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${token}`;
}

/** Can the current person give this role to someone? Mirrors the backend rule. */
export function canGrant(myPermissions: string[], role: Role) {
  if (myPermissions.includes("*")) return true;
  if (role.permissions.includes("*")) return false;
  return role.permissions.every((p) => myPermissions.includes(p));
}
