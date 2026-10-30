import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, put } from "@/lib/api";
import type { Page } from "@/lib/types";

export type AdminOrg = { id: string; name: string; slug: string; type: string; plan_code: string; status: string; verification_level: string; state: string | null; lga: string | null; created_at: string; members: number };
export type AdminUser = { id: string; full_name: string; email: string | null; phone: string | null; status: string; platform_role: string | null; last_login_at: string | null; created_at: string };
export type Flag = { key: string; description: string; enabled: boolean; allowed_org_types: string[] | null; allowed_states: string[] | null };

export const useAdminStats = () => useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<{ users: number; organizations: number; memberships: number; organizations_by_type: Record<string, number> }>("/admin/stats") });
export const useAdminOrgs = (q: string, type: string) =>
  useQuery({ queryKey: ["admin", "orgs", q, type], queryFn: () => get<Page<AdminOrg>>(`/admin/organizations?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}${type ? `&type=${type}` : ""}`), placeholderData: (p) => p });
export const useAdminUsers = (q: string) =>
  useQuery({ queryKey: ["admin", "users", q], queryFn: () => get<Page<AdminUser>>(`/admin/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`), placeholderData: (p) => p });
export const useFlags = () => useQuery({ queryKey: ["admin", "flags"], queryFn: () => get<Flag[]>("/admin/feature-flags") });

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }) });
}
export const useUpdateOrg = () => useAdminMutation(({ id, ...b }: { id: string; status?: string; plan_code?: string; verification_level?: string }) => patch(`/admin/organizations/${id}`, b));
export const useUpdateUser = () => useAdminMutation(({ id, ...b }: { id: string; status?: string; platform_role?: string; clear_platform_role?: boolean }) => patch(`/admin/users/${id}`, b));
export const useUpdateFlag = () => useAdminMutation(({ key, ...b }: { key: string; enabled: boolean }) => patch(`/admin/feature-flags/${key}`, b));
export const useOverride = () => useAdminMutation(({ id, key, enabled }: { id: string; key: string; enabled: boolean | null }) => put(`/admin/organizations/${id}/features/${key}`, { enabled }));
