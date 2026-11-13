import type { PackSummary, StartSize } from "@/features/packs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api";

export type SellUnit = "each" | "kg" | "crate";
export type FeedPrice = { phase: string; name?: string | null; price_per_bag?: number | null; kg_per_bag: number; bags?: number | null };
export type VaccinePrice = { name: string; product?: string | null; price_per_bottle?: number | null; doses_per_bottle?: number | null };
export type Vitamin = { name: string; price: number; pack_size?: string | null; days_per_pack: number; days_used?: number | null };
export type OtherCost = { label: string; amount: number; day: number };
export type PlanInputs = {
  animal_price?: number | null; feeds: FeedPrice[]; vaccines: VaccinePrice[]; vitamins: Vitamin[]; others: OtherCost[];
  mortality_pct: number; sell_price?: number | null; sell_unit: SellUnit; spent_price?: number | null; sell_day: number;
};
export type PlanDay = {
  id: string; kind: "prepare" | "feed_phase" | "vaccination" | "check" | "harvest" | "custom"; day: number; title: string; note: string | null;
  ref: string; usual_day: number | null; on: string; before_stock: boolean; moved_note: string | null;
  removed?: boolean; edited?: boolean; done?: boolean; task_id?: string;
};
export type FeedLine = { phase: string; name: string | null; kg: number; bags: number; worked_out_bags: number; own_bags: boolean; kg_per_bag: number; price_per_bag: number | null; cost: number | null; from_day: number; to_day: number; from_on: string; to_on: string };
export type VaccineLine = { name: string; product: string | null; day: number; on: string; doses: number; bottles: number | null; doses_per_bottle: number | null; price_per_bottle: number | null; cost: number | null };
export type PlanWeek = { week: number; label: string; from_on: string | null; out: number; in: number; spent_so_far: number; back_so_far: number; buy: string[] };
export type PlanResult = {
  count: number; end_alive: number; deaths: number; days: number; sell_on: string; weight_end_g: number | null; kg_total: number | null;
  eggs: number | null; crates: number | null; feed_kg: number; feed_per_kg_gain: number | null; sell_unit: SellUnit;
  feed?: FeedLine[]; vaccines?: VaccineLine[]; vitamins?: { name: string; pack_size: string | null; packs: number; price: number; cost: number }[];
  others?: { label: string; amount: number; day: number; on: string }[];
  costs?: { animals: number | null; feed: number; vaccines: number; vitamins: number; other: number };
  total_cost?: number; revenue?: number | null; profit?: number | null; margin_pct?: number | null; cost_per_head?: number | null;
  cost_per_kg?: number | null; break_even?: number | null; weeks?: PlanWeek[]; peak_cash?: number; suggested_cash?: number;
  available?: number | null; short_by?: number | null; short_from_week?: number | null; missing?: string[];
};
export type PlanSummary = {
  id: string; name: string; species: string; breed_key: string | null; breed_name: string | null; count: number; start_on: string; sell_on: string;
  batch_id: string | null; batch_code: string | null; total_cost: number | null; profit: number | null; archived_at: string | null; updated_at: string;
};
export type Phase = { from_day: number; to_day: number; name: string; protein_pct?: number | null; form?: string | null; note?: string | null };
export type Plan = PlanSummary & {
  age_at_start_days: number;
  pack: { key: string; version: number; name: string; status: string; review_note: string | null; counts: string; terms: Record<string, string>; breeds: { key: string; name: string }[]; phases: Phase[];
    start_sizes?: StartSize[]; stocking?: PackSummary["stocking"] };
  hints: { bag_kg: number; mortality_pct: number; sell_unit: SellUnit; sell_day: number; max_day: number; young: string; unit_price_hint: string; doses_per_bottle: number | null; other_costs: string[]; eggs_per_crate?: number };
  inputs: Partial<PlanInputs>; days: PlanDay[]; result: PlanResult | null;
};
export type PlanStart = { name?: string | null; species: string; breed_key?: string | null; count: number; start_on: string; age_at_start_days?: number };
export type PlannerCatalog = { species: Record<string, { young: string; sell_unit: SellUnit; sell_day: number }>; sell_units: Record<SellUnit, string> };

const base = (orgId: string) => `/organizations/${orgId}/farm/planner`;

export const usePlannerCatalog = () => useQuery({ queryKey: ["planner-catalog"], queryFn: () => get<PlannerCatalog>("/farm/planner/catalog"), staleTime: Infinity });
export const usePlans = (orgId: string, archived = false) =>
  useQuery({ queryKey: ["planner", orgId, "list", archived], queryFn: () => get<PlanSummary[]>(`${base(orgId)}${archived ? "?archived=true" : ""}`) });
export const usePlan = (orgId: string, id: string) => useQuery({ queryKey: ["planner", orgId, id], queryFn: () => get<Plan>(`${base(orgId)}/${id}`) });
export const useBatchPlan = (orgId: string, batchId: string, enabled = true) =>
  useQuery({ queryKey: ["planner", orgId, "batch", batchId], enabled, queryFn: () => get<Plan | null>(`/organizations/${orgId}/farm/batches/${batchId}/plan`) });

function usePlanMutation<V>(orgId: string, fn: (v: V) => Promise<Plan>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(["planner", orgId, p.id], p);
      qc.invalidateQueries({ queryKey: ["planner", orgId, "list"] });
      if (p.batch_id) {
        qc.invalidateQueries({ queryKey: ["planner", orgId, "batch", p.batch_id] });
        qc.invalidateQueries({ queryKey: ["farm", orgId] });
      }
    },
  });
}

export const useCreatePlan = (orgId: string) => usePlanMutation(orgId, (v: PlanStart & { inputs?: PlanInputs }) => post<Plan>(base(orgId), v));
export const useUpdatePlan = (orgId: string, id: string) =>
  usePlanMutation(orgId, (v: { name?: string; breed_key?: string; count?: number; start_on?: string; age_at_start_days?: number; inputs?: PlanInputs }) => patch<Plan>(`${base(orgId)}/${id}`, v));
export const useEditDay = (orgId: string, id: string) =>
  usePlanMutation(orgId, ({ item, ...v }: { item: string; day?: number; title?: string; note?: string | null; removed?: boolean; done?: boolean }) =>
    patch<Plan>(`${base(orgId)}/${id}/days/${item}`, v));
export const useAddDay = (orgId: string, id: string) =>
  usePlanMutation(orgId, (v: { day: number; title: string; note?: string | null }) => post<Plan>(`${base(orgId)}/${id}/days`, v));
export const useDeleteDay = (orgId: string, id: string) => usePlanMutation(orgId, (item: string) => del<Plan>(`${base(orgId)}/${id}/days/${item}`));
export const useArchivePlan = (orgId: string, id: string) => usePlanMutation(orgId, (archived: boolean) => post<Plan>(`${base(orgId)}/${id}/archive`, { archived }));
export const useLinkPlan = (orgId: string) =>
  usePlanMutation(orgId, ({ id, batch_id }: { id: string; batch_id: string }) => post<Plan>(`${base(orgId)}/${id}/link`, { batch_id }));

export const SPECIES_PLANNED = ["broilers", "layers", "catfish"] as const;
export const SELL_LABEL: Record<SellUnit, string> = { each: "each", kg: "per kg", crate: "per crate" };
