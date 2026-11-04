import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, limitOffset, patch, post, put, qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

export type AdminOrg = { id: string; name: string; slug: string; type: string; plan_code: string; status: string; verification_level: string; state: string | null; lga: string | null; created_at: string; members: number };
export type AdminUser = { id: string; full_name: string; email: string | null; phone: string | null; status: string; platform_role: string | null; last_login_at: string | null; created_at: string };
export type Flag = { key: string; description: string; enabled: boolean; allowed_org_types: string[] | null; allowed_states: string[] | null };

export const useAdminStats = () => useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<{ users: number; organizations: number; memberships: number; organizations_by_type: Record<string, number> }>("/admin/stats") });
export const useAdminOrgs = (q: string, type: string, pg: PageQuery = { page: 1, page_size: 20 }) =>
  useQuery({ queryKey: ["admin", "orgs", q, type, pg], queryFn: () => get<Page<AdminOrg>>(`/admin/organizations?${limitOffset(pg)}${q ? `&q=${encodeURIComponent(q)}` : ""}${type ? `&type=${type}` : ""}`), placeholderData: (p) => p });
export const useAdminUsers = (q: string, pg: PageQuery = { page: 1, page_size: 20 }) =>
  useQuery({ queryKey: ["admin", "users", q, pg], queryFn: () => get<Page<AdminUser>>(`/admin/users?${limitOffset(pg)}${q ? `&q=${encodeURIComponent(q)}` : ""}`), placeholderData: (p) => p });
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

export const useMessages = (status: string, q: string, pg: PageQuery = { page: 1, page_size: 20 }) =>
  useQuery({ queryKey: ["admin", "messages", status, q, pg], refetchInterval: 10000, placeholderData: (p) => p,
    queryFn: () => get<Page<OutboundMessage>>(`/admin/messages?${limitOffset(pg)}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`) });
export const useDeliveryConfig = () => useQuery({ queryKey: ["admin", "delivery-config"], queryFn: () => get<DeliveryConfig>("/admin/messages/config") });
export const useSendTest = () => useAdminMutation((to: string) => post<OutboundMessage>("/admin/messages/test", { to }));
export const useRetryMessage = () => useAdminMutation((id: string) => post<OutboundMessage>(`/admin/messages/${id}/retry`));

export type ErrorGroup = { id: string; source: "api" | "worker" | "web"; title: string; location: string; count: number; people: number; release: string; first_seen: string; last_seen: string; resolved_at: string | null };
export type ErrorDetail = ErrorGroup & { sample: { traceback?: string; stack?: string; path?: string; method?: string; kind?: string; user_agent?: string; web_release?: string; logger?: string; note?: string } };
export const useErrors = (status: string, source: string, pg: PageQuery) =>
  useQuery({ queryKey: ["admin", "errors", status, source, pg], placeholderData: (p) => p, refetchInterval: 30000,
    queryFn: () => get<Page<ErrorGroup>>(`/admin/errors${qsOf({ status, source, ...pg })}`) });
export const useErrorDetail = (id: string | null) =>
  useQuery({ queryKey: ["admin", "error", id], enabled: !!id, queryFn: () => get<ErrorDetail>(`/admin/errors/${id}`) });
export const useResolveError = () => useAdminMutation(({ id, resolved }: { id: string; resolved: boolean }) => patch(`/admin/errors/${id}`, { resolved }));
