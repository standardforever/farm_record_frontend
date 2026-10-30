import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { AuditEvent, Page } from "@/lib/types";

export const useAudit = (orgId: string, action: string, offset: number) =>
  useQuery({
    queryKey: ["audit", orgId, action, offset],
    queryFn: () => get<Page<AuditEvent>>(`/organizations/${orgId}/audit-events?limit=25&offset=${offset}${action ? `&action=${action}` : ""}`),
    placeholderData: (prev) => prev,
  });
