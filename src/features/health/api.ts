import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

export type Product = "meat" | "eggs" | "milk";
export type Hold = {
  batch_id: string; batch_code: string | null; unit_codes: string[]; product: Product | "all"; until: string | null; clear_on: string | null;
  reason: string; source: "treatment" | "case"; source_id: string; via_batch_id: string | null; via_batch_code: string | null;
};
export type Treatment = {
  id: string; batch_id: string; batch_code: string | null; unit_id: string | null; unit_code: string | null; case_id: string | null; task_id: string | null;
  kind: string; product: string; active_ingredient: string | null; dose: string | null; route: string | null; given_on: string; end_on: string;
  animals: number | null; given_by: string | null; product_lot: string | null;
  withdrawal_meat_days: number | null; withdrawal_eggs_days: number | null; withdrawal_milk_days: number | null;
  held_until: Partial<Record<Product, string>>; notes: string | null; created_at: string; created_by_name: string | null;
  voided_at: string | null; void_reason: string | null;
};
export type Case = {
  id: string; batch_id: string; batch_code: string | null; species: string | null; unit_id: string | null; unit_code: string | null; opened_on: string;
  signs: string[]; affected: number | null; description: string | null; media_id: string | null; suspected: string | null; diagnosis: string | null;
  diagnosed_by: string | null; hold_sales: boolean; status: "open" | "closed"; outcome: string | null; closed_on: string | null; close_note: string | null;
  created_at: string; opened_by_name: string | null; treatments: number;
};
export type Dose = {
  task_id: string; batch_id: string; batch_code: string; unit_id: string | null; unit_code: string | null; vaccine: string; route: string | null;
  due_on: string; status: "overdue" | "due" | "upcoming" | "done" | "skipped"; done_on: string | null; done_by_name: string | null; treatment_id: string | null;
};
export type ProductHint = {
  product: string; kind: string; active_ingredient: string | null; route: string | null; dose: string | null;
  withdrawal_meat_days: number | null; withdrawal_eggs_days: number | null; withdrawal_milk_days: number | null; last_used: string;
};
export type Overview = { on: string; holds: Hold[]; open_cases: Case[]; vaccinations: Dose[]; recent: Treatment[] };
export type BatchHealth = { products: Product[]; holds: Hold[]; treatments: Treatment[]; cases: Case[]; can_sell: Partial<Record<Product, boolean>> };
export type HealthCatalog = {
  kinds: Record<string, string>; withdrawal_required: string[]; routes: string[]; signs: Record<string, string[]>;
  groups: Record<string, string[]>; outcomes: Record<string, string>; products_by_species: Record<string, Product[]>;
};
export type TreatmentInput = {
  batch_id: string; unit_id?: string | null; case_id?: string | null; kind: string; product: string; active_ingredient?: string | null; dose?: string | null;
  route?: string | null; given_on: string; course_days: number; animals?: number | null; given_by?: string | null; product_lot?: string | null;
  withdrawal_meat_days?: number | null; withdrawal_eggs_days?: number | null; withdrawal_milk_days?: number | null; notes?: string | null; client_id?: string;
};
export type CaseInput = {
  batch_id: string; unit_id?: string | null; opened_on: string; signs: string[]; affected?: number | null; description?: string | null;
  media_id?: string | null; suspected?: string | null; hold_sales: boolean; client_id?: string;
};

const base = (orgId: string) => `/organizations/${orgId}/health`;

export const useHealthCatalog = () => useQuery({ queryKey: ["health-catalog"], queryFn: () => get<HealthCatalog>("/health/catalog"), staleTime: Infinity });
export const useHealthOverview = (orgId: string) => useQuery({ queryKey: ["health", orgId, "overview"], queryFn: () => get<Overview>(base(orgId)) });
export const useBatchHealth = (orgId: string, batchId: string, enabled = true) =>
  useQuery({ queryKey: ["health", orgId, "batch", batchId], queryFn: () => get<BatchHealth>(`${base(orgId)}/batches/${batchId}`), enabled: enabled && !!batchId });
export const useProductHints = (orgId: string, enabled = true) =>
  useQuery({ queryKey: ["health", orgId, "products"], queryFn: () => get<ProductHint[]>(`${base(orgId)}/products`), enabled });
export const useTreatments = (orgId: string, f: { include_void?: boolean; batch_id?: string } & Partial<PageQuery> = {}, enabled = true) =>
  useQuery({ queryKey: ["health", orgId, "treatments", f], placeholderData: (p) => p, enabled,
    queryFn: () => get<Page<Treatment>>(`${base(orgId)}/treatments${qsOf(f)}`) });

function useHealthMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health", orgId] });
      qc.invalidateQueries({ queryKey: ["farm", orgId] }); // Today shows holds; batch pages show health
    },
  });
}

export const useCreateTreatment = (orgId: string) => useHealthMutation(orgId, (b: TreatmentInput) => post<Treatment>(`${base(orgId)}/treatments`, b));
export const useVoidTreatment = (orgId: string) =>
  useHealthMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<Treatment>(`${base(orgId)}/treatments/${id}/void`, { reason }));
export const useOpenCase = (orgId: string) => useHealthMutation(orgId, (b: CaseInput) => post<Case>(`${base(orgId)}/cases`, b));
export const useUpdateCase = (orgId: string) =>
  useHealthMutation(orgId, ({ id, ...b }: { id: string; diagnosis?: string | null; diagnosed_by?: string | null; suspected?: string | null; hold_sales?: boolean }) =>
    patch<Case>(`${base(orgId)}/cases/${id}`, b));
export const useCloseCase = (orgId: string) =>
  useHealthMutation(orgId, ({ id, ...b }: { id: string; closed_on: string; outcome: string; note?: string | null; diagnosis?: string | null }) =>
    post<Case>(`${base(orgId)}/cases/${id}/close`, b));

// ---- helpers ----

const dayFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });
export const shortDay = (iso: string | null | undefined) => (iso ? dayFmt.format(new Date(iso + "T12:00:00")) : "");

export const PRODUCT_LABEL: Record<Product | "all", string> = { meat: "Animals and meat", eggs: "Eggs", milk: "Milk", all: "All sales" };

/** "until 8 Nov · sell from 9 Nov" or "until the case is closed". */
export function holdWhen(h: Pick<Hold, "until" | "clear_on">) {
  return h.until ? `until ${shortDay(h.until)} · sell from ${shortDay(h.clear_on)}` : "until the case is closed";
}

/** Last held day for a planned course: end of course + withdrawal days. */
export function planHold(givenOn: string, courseDays: number, days: number | null | undefined) {
  if (!givenOn || !days) return null;
  const d = new Date(givenOn + "T12:00:00");
  d.setDate(d.getDate() + Math.max(1, courseDays) - 1 + days);
  const until = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 1);
  return { until, clear_on: d.toISOString().slice(0, 10) };
}
