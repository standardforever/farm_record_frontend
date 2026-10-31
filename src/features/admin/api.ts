import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, put } from "@/lib/api";
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

export type OutboundMessage = { id: string; channel: string; template: string; to_address: string; subject: string | null; status: "queued" | "sent" | "failed"; provider: string | null; attempts: number; last_error: string | null; created_at: string; sent_at: string | null; next_attempt_at: string };
export type DeliveryConfig = { email_providers: string[]; real_email_delivery: boolean; sms_providers: string[]; from_name: string; app_url: string };

export const useMessages = (status: string, q: string) =>
  useQuery({ queryKey: ["admin", "messages", status, q], refetchInterval: 10000, placeholderData: (p) => p,
    queryFn: () => get<Page<OutboundMessage>>(`/admin/messages?limit=100${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`) });
export const useDeliveryConfig = () => useQuery({ queryKey: ["admin", "delivery-config"], queryFn: () => get<DeliveryConfig>("/admin/messages/config") });
export const useSendTest = () => useAdminMutation((to: string) => post<OutboundMessage>("/admin/messages/test", { to }));
export const useRetryMessage = () => useAdminMutation((id: string) => post<OutboundMessage>(`/admin/messages/${id}/retry`));
