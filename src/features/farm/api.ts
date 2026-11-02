import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

export type UnitStatus = "empty" | "stocked" | "resting" | "maintenance" | "quarantine";
export type Site = {
  id: string; name: string; code: string; address: string | null; state: string | null; lga: string | null; ward: string | null;
  location_precision: "gps" | "ward" | "lga" | null;
  latitude: number | null; longitude: number | null; area_hectares: number | null; notes: string | null;
  status: "active" | "archived"; created_at: string; unit_count: number;
};
export type Unit = {
  id: string; site_id: string; code: string; name: string | null; kind: string; purpose: string | null;
  capacity: number | null; area_m2: number | null; volume_m3: number | null; latitude: number | null; longitude: number | null;
  status: UnitStatus; status_note: string | null; status_changed_at: string | null; notes: string | null;
  sort_order: number; archived_at: string | null; created_at: string; updated_at: string;
};
export type SiteWithUnits = Site & { units: Unit[] };
export type FarmMap = {
  sites: SiteWithUnits[]; by_status: Record<UnitStatus, number>; total_capacity: number;
  units_used: number; units_limit: number | null; limited_to_scope: boolean;
  unit_batches: Record<string, UnitBatch[]>;
};
export type UnitBatch = { id: string; code: string; species: string; count: number; age_days: number };
export type Catalog = {
  kinds: Record<string, { label: string; prefix: string; counts: string; water: boolean }>;
  purposes: Record<string, string>; statuses: Record<UnitStatus, string>;
};
export type UnitActivity = { action: string; summary: string; actor_name: string | null; data: Record<string, unknown>; created_at: string };

export type SiteInput = Partial<Pick<Site, "name" | "code" | "address" | "state" | "lga" | "latitude" | "longitude" | "area_hectares" | "notes">>;
export type UnitInput = Partial<Pick<Unit, "site_id" | "kind" | "code" | "name" | "purpose" | "capacity" | "area_m2" | "volume_m3" | "latitude" | "longitude" | "notes" | "status" | "status_note">>;
export type BulkInput = { site_id: string; kind: string; count: number; prefix?: string; start?: number; purpose?: string | null; capacity?: number | null; area_m2?: number | null; volume_m3?: number | null };

const base = (orgId: string) => `/organizations/${orgId}/farm`;
const key = (orgId: string) => ["farm", orgId];

export const useCatalog = () => useQuery({ queryKey: ["farm-catalog"], queryFn: () => get<Catalog>("/farm/catalog"), staleTime: Infinity });
export const useFarmMap = (orgId: string, includeArchived = false, enabled = true) =>
  useQuery({ queryKey: [...key(orgId), "map", includeArchived], queryFn: () => get<FarmMap>(`${base(orgId)}/map?include_archived=${includeArchived}`), placeholderData: (p) => p, enabled });
export const useSites = (orgId: string, enabled = true) =>
  useQuery({ queryKey: [...key(orgId), "sites"], queryFn: () => get<Site[]>(`${base(orgId)}/sites`), enabled });
export const useUnits = (orgId: string, enabled = true) =>
  useQuery({ queryKey: [...key(orgId), "units"], queryFn: () => get<Unit[]>(`${base(orgId)}/units`), enabled });
export const useUnitActivity = (orgId: string, unitId: string | null, f: Partial<PageQuery> = {}) =>
  useQuery({ queryKey: [...key(orgId), "activity", unitId, f], placeholderData: (p) => p, enabled: !!unitId,
    queryFn: () => get<Page<UnitActivity>>(`${base(orgId)}/units/${unitId}/activity${qsOf(f)}`) });

function useFarmMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(orgId) });
      qc.invalidateQueries({ queryKey: ["audit", orgId] });
    },
  });
}

export const useCreateSite = (orgId: string) => useFarmMutation(orgId, (b: SiteInput) => post<Site>(`${base(orgId)}/sites`, b));
export const useUpdateSite = (orgId: string) => useFarmMutation(orgId, ({ id, ...b }: SiteInput & { id: string }) => patch<Site>(`${base(orgId)}/sites/${id}`, b));
export const useArchiveSite = (orgId: string) => useFarmMutation(orgId, (id: string) => post<Site>(`${base(orgId)}/sites/${id}/archive`));
export const useCreateUnit = (orgId: string) => useFarmMutation(orgId, (b: UnitInput) => post<Unit>(`${base(orgId)}/units`, b));
export const useBulkUnits = (orgId: string) => useFarmMutation(orgId, (b: BulkInput) => post<Unit[]>(`${base(orgId)}/units/bulk`, b));
export const useUpdateUnit = (orgId: string) => useFarmMutation(orgId, ({ id, ...b }: UnitInput & { id: string }) => patch<Unit>(`${base(orgId)}/units/${id}`, b));
export const useArchiveUnit = (orgId: string) => useFarmMutation(orgId, (id: string) => post<Unit>(`${base(orgId)}/units/${id}/archive`));
export const useRestoreUnit = (orgId: string) => useFarmMutation(orgId, (id: string) => post<Unit>(`${base(orgId)}/units/${id}/restore`));
