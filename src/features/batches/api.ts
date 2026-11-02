import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "@/lib/api";

export type Placement = { unit_id: string; unit_code: string; unit_name: string | null; started_on: string; ended_on: string | null; count: number };
export type Summary = {
  total_in: number; current: number; died: number; culled: number; sold: number; consumed: number; missing: number; transferred_out: number;
  survival_pct: number | null; mortality_pct: number | null; days: number; age_days: number;
  sold_weight_kg: number | null; avg_sale_weight_kg: number | null;
  sales_amount: number | null; cost_in: number | null; cost_out: number | null; cost_so_far: number | null; result_so_far: number | null;
  cost_per_head_in: number | null; inputs_cost?: number | null; inputs_by_category?: Record<string, number> | null; other_sales?: Record<string, number> | null; feed_kg: number; latest_avg_weight_g: number | null; eggs: number; cracked_eggs: number;
  fcr: number | null; pending: string[];
};
export type Batch = {
  id: string; code: string; species: string; breed: string | null; breed_key?: string | null; pack_key?: string | null; pack_version?: number | null; grade_label: string | null; source_type: string; source_name: string | null;
  started_on: string; age_at_start_days: number; initial_count: number; avg_start_weight_g: string | null; acquisition_cost: string | null;
  expected_end_on: string | null; status: "active" | "closed"; closed_on: string | null; close_note: string | null; notes: string | null;
  created_at: string; current: number; units: Placement[]; summary: Summary | null;
};
export type BatchEvent = {
  id: string; kind: string; unit_id: string | null; unit_code: string | null; quantity: number; signed: number; occurred_on: string;
  amount: string | null; weight_kg: string | null; reason: string | null; note: string | null; related_batch_id: string | null;
  related_code: string | null; voided_at: string | null; void_reason: string | null; created_by_name: string | null; created_at: string; can_void: boolean;
};
export type Link = { kind: string; direction: "from" | "to"; batch_id: string; batch_code: string; quantity: number; occurred_on: string };
export type BatchDetail = Batch & { links: Link[]; events: BatchEvent[] };
export type BatchCatalog = {
  species: Record<string, { prefix: string; cycle_days: number | null }>;
  sources: Record<string, string>;
  events: Record<string, { label: string; sign: number; permission: string | null }>;
};

const base = (orgId: string) => `/organizations/${orgId}/farm/batches`;

export const useBatchCatalog = () => useQuery({ queryKey: ["batch-catalog"], queryFn: () => get<BatchCatalog>("/farm/batches/catalog"), staleTime: Infinity });
export const useBatches = (orgId: string, status: "active" | "closed" | "" = "active", enabled = true) =>
  useQuery({ queryKey: ["farm", orgId, "batches", status], queryFn: () => get<Batch[]>(`${base(orgId)}${status ? `?status=${status}` : ""}`), enabled, placeholderData: (p) => p });
export const useBatch = (orgId: string, id: string) =>
  useQuery({ queryKey: ["farm", orgId, "batch", id], queryFn: () => get<BatchDetail>(`${base(orgId)}/${id}`) });

function useBatchMutation<V>(orgId: string, fn: (v: V) => Promise<BatchDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(["farm", orgId, "batch", data.id], data);
      qc.invalidateQueries({ queryKey: ["farm", orgId] });
      qc.invalidateQueries({ queryKey: ["audit", orgId] });
    },
  });
}

export type StockInput = {
  species: string; breed?: string | null; breed_key?: string; code?: string; source_type: string; source_name?: string | null; started_on: string;
  age_at_start_days: number; avg_start_weight_g?: number | null; acquisition_cost?: number | null; units: { unit_id: string; count: number }[]; notes?: string | null;
};
export type RecordInput = { kind: string; unit_id?: string; quantity: number; occurred_on: string; amount?: number | null; weight_kg?: number | null; reason?: string | null; note?: string | null };

export const useStockBatch = (orgId: string) => useBatchMutation(orgId, (b: StockInput) => post<BatchDetail>(base(orgId), b));
export const useUpdateBatch = (orgId: string, id: string) => useBatchMutation(orgId, (b: Record<string, unknown>) => patch<BatchDetail>(`${base(orgId)}/${id}`, b));
export const useRecord = (orgId: string, id: string) => useBatchMutation(orgId, (b: RecordInput) => post<BatchDetail>(`${base(orgId)}/${id}/records`, b));
export const useVoid = (orgId: string, id: string) =>
  useBatchMutation(orgId, ({ eventId, reason }: { eventId: string; reason: string }) => post<BatchDetail>(`${base(orgId)}/${id}/records/${eventId}/void`, { reason }));
export const useMove = (orgId: string, id: string) =>
  useBatchMutation(orgId, (b: { from_unit_id: string; to_unit_id: string; quantity: number; occurred_on: string; note?: string }) => post<BatchDetail>(`${base(orgId)}/${id}/move`, b));
export const useSplit = (orgId: string, id: string) =>
  useBatchMutation(orgId, (b: { from_unit_id?: string; to_unit_id: string; quantity: number; occurred_on: string; grade_label?: string | null; note?: string }) => post<BatchDetail>(`${base(orgId)}/${id}/split`, b));
export const useMerge = (orgId: string, id: string) =>
  useBatchMutation(orgId, (b: { into_batch_id: string; to_unit_id?: string; occurred_on: string; note?: string }) => post<BatchDetail>(`${base(orgId)}/${id}/merge`, b));
export const useClose = (orgId: string, id: string) =>
  useBatchMutation(orgId, (b: { closed_on: string; note?: string | null }) => post<BatchDetail>(`${base(orgId)}/${id}/close`, b));
export const useReopen = (orgId: string, id: string) =>
  useBatchMutation(orgId, (reason: string) => post<BatchDetail>(`${base(orgId)}/${id}/reopen`, { reason }));

/** Today's date where the person is (not UTC), as YYYY-MM-DD. */
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const ageOn = (b: Batch, on = new Date()) =>
  b.age_at_start_days + Math.max(0, Math.floor((on.getTime() - new Date(b.started_on + "T00:00:00").getTime()) / 86400000));
export const ageLabel = (days: number) => (days < 21 ? `${days} days` : days < 140 ? `${Math.floor(days / 7)} weeks` : `${Math.round(days / 30.4)} months`);
