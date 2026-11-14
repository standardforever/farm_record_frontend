import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

export type PackSummary = {
  key: string; version: number; name: string; status: string; review_note: string | null; active: boolean; source: string;
  change_note: string | null; breeds: { key: string; name: string; note: string | null }[]; vaccinations: number; phases: number;
  start_sizes?: StartSize[]; stocking?: { harvest_g: number; by_build: Record<string, { per: "m2" | "m3"; good: number; most: number; note?: string | null }> } | null;
};
/** A size the young are bought at ("Juveniles, about 20 g"), placed on the pack's growth curve. */
export type StartSize = { key: string; name: string; weight_g: number; age_days: number; note?: string | null };
export type Dose = { day: number; name: string; route: string | null; note: string | null; due_on: string; status: "done" | "skipped" | "due" | "overdue" | "upcoming" | "before_arrival"; task_id: string | null };
export type Phase = { from_day: number; to_day: number; name: string; protein_pct?: number | null; form?: string | null; note?: string | null; on?: string };
export type Standard = {
  pack: { key: string; version: number; name: string; status: string; review_note: string | null; age_unit: string; counts: string; latest_version: number };
  breed: { key: string; name: string; note: string | null } | null;
  age_days: number; expected_weight_g: number | null; latest_weight_g: number | null; latest_weight_age: number | null; weight_vs_standard_pct: number | null;
  expected_feed_g_per_head: number | null; actual_feed_g_per_head: number | null; average_alive?: number | null; phase_now: Phase | null; next_phase: Phase | null;
  vaccinations: Dose[]; checks: Dose[]; growth_standard: [number, number][]; growth_actual: [number, number][];
  lay_standard: [number, number][] | null; lay_actual: [number, number][] | null; water: Record<string, (number | null)[]> | null; alerts: Record<string, number>;
};

export const usePacks = () => useQuery({ queryKey: ["packs"], queryFn: () => get<PackSummary[]>("/farm/packs"), staleTime: 300_000 });
export const useStandard = (orgId: string, batchId: string) =>
  useQuery({ queryKey: ["farm", orgId, "standard", batchId], queryFn: () => get<Standard | null>(`/organizations/${orgId}/farm/batches/${batchId}/standard`) });
export function useUpgradePack(orgId: string, batchId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post(`/organizations/${orgId}/farm/batches/${batchId}/pack-upgrade`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm", orgId] }) });
}

export const useAllPackVersions = () => useQuery({ queryKey: ["admin", "packs"], queryFn: () => get<PackSummary[]>("/admin/packs") });
export function useAddBreed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pack, ...breed }: { pack: string; [k: string]: unknown }) => post<PackSummary>(`/admin/packs/${pack}/breeds`, breed),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "packs"] }); qc.invalidateQueries({ queryKey: ["packs"] }); },
  });
}
