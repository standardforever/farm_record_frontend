import { useQuery } from "@tanstack/react-query";
import { get, limitOffset } from "@/lib/api";
import type { AuditEvent, Page, PageQuery } from "@/lib/types";

export const useAudit = (orgId: string, action: string, pg: PageQuery) =>
  useQuery({
    queryKey: ["audit", orgId, action, pg],
    queryFn: () => get<Page<AuditEvent>>(`/organizations/${orgId}/audit-events?${limitOffset(pg)}${action ? `&action=${action}` : ""}`),
    placeholderData: (prev) => prev,
  });
