import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

/** Kinds of record an owner can correct (see the API's /corrections). */
export type CorrectionKind =
  | "batch" | "batch_event" | "farm_record" | "task" | "handover" | "site" | "unit" | "health_case" | "treatment"
  | "stock_item" | "stock_lot" | "stock_move" | "equipment" | "customer" | "invoice" | "payment" | "expense"
  | "employee" | "pay_run" | "money_account" | "account_transfer" | "reconciliation";

export type CorrectionField = {
  name: string; label: string; type: "text" | "textarea" | "int" | "number" | "money" | "date" | "select" | "bool";
  required: boolean; nullable: boolean; min: number | null; max: number | null; hint: string | null;
  options: { value: string; label: string }[] | null;
};
export type CorrectionForm = {
  kind: CorrectionKind; kind_label: string; id: string; label: string; editable: boolean; blockers: string[];
  fields: CorrectionField[]; values: Record<string, unknown>; revision: string;
};
export type DeletePreview = {
  kind: CorrectionKind; kind_label: string; id: string; label: string; count: number; fingerprint: string;
  records: { kind: string; id: string; label: string }[]; blockers: string[]; notes: string[];
};
export type Change = {
  id: string; operation: "edit" | "delete"; kind: string; kind_label: string; record_id: string; label: string; reason: string;
  actor_name: string | null; created_at: string;
  before: { kind: string; id: string; label: string; record?: Record<string, unknown> }[];
  after: { kind: string; id: string; label: string; record?: Record<string, unknown>; labels?: Record<string, string> }[];
};

const base = (orgId: string) => `/organizations/${orgId}/corrections`;

export const useCorrectionForm = (orgId: string, kind: CorrectionKind, id: string | null) =>
  useQuery({ queryKey: ["corrections", orgId, kind, id, "form"], enabled: !!id, gcTime: 0, staleTime: 0,
    queryFn: () => get<CorrectionForm>(`${base(orgId)}/${kind}/${id}`) });
export const useDeletePreview = (orgId: string, kind: CorrectionKind, id: string | null) =>
  useQuery({ queryKey: ["corrections", orgId, kind, id, "preview"], enabled: !!id, gcTime: 0, staleTime: 0,
    queryFn: () => get<DeletePreview>(`${base(orgId)}/${kind}/${id}/delete-preview`) });
export const useCorrections = (orgId: string, f: { kind?: string } & PageQuery) =>
  useQuery({ queryKey: ["corrections", orgId, "history", f], placeholderData: (p) => p,
    queryFn: () => get<Page<Change>>(`${base(orgId)}${qsOf(f)}`) });

/** After a correction anything on screen may have changed (counts, stock, balances, profit): refetch it all. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
export function useEditRecord(orgId: string, kind: CorrectionKind, id: string) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (b: { revision: string; reason: string; values: Record<string, unknown> }) =>
      patch<{ changed: string[]; id: string; label: string }>(`${base(orgId)}/${kind}/${id}`, b),
    onSuccess: refresh,
  });
}
export function useDeleteRecord(orgId: string, kind: CorrectionKind, id: string) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (b: { reason: string; fingerprint: string }) => post<{ deleted: number; label: string }>(`${base(orgId)}/${kind}/${id}/delete`, b),
    onSuccess: refresh,
  });
}
