import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api";

export type ClimateDay = { on: string; t_max: number | null; t_min: number | null; feels_max: number | null; rh_min: number | null; rain_mm: number | null;
  rain_chance: number | null; wind_max: number | null; gust_max: number | null; code: number | null };
export type ClimateAlert = { id: string; site_id: string; site_name: string; rule: string; on_date: string; level: "watch" | "danger"; title: string; why: string;
  jobs: string[]; unit_codes: string[]; tasks: number; tasks_done: number; dismissed: boolean; cleared: boolean };
export type SiteClimate = { site_id: string; name: string; place: string | null; located_by: string | null; has_animals: boolean; fetched_at: string | null; source: string | null; days: ClimateDay[] };
export type Climate = { alerts: ClimateAlert[]; sites: SiteClimate[]; auto_tasks: boolean; last_run: string | null; provider: string };

const base = (orgId: string) => `/organizations/${orgId}/climate`;
export const climateKey = (orgId: string) => ["climate", orgId];
export const useClimate = (orgId: string, enabled = true) =>
  useQuery({ queryKey: climateKey(orgId), queryFn: () => get<Climate>(base(orgId)), enabled, staleTime: 10 * 60_000 });

function useClimateMutation<V>(orgId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (data) => {
    if (data && typeof data === "object" && "alerts" in data) qc.setQueryData(climateKey(orgId), data);
    else qc.invalidateQueries({ queryKey: climateKey(orgId) });
    qc.invalidateQueries({ queryKey: ["farm", orgId] });
  } });
}
export const useRefreshClimate = (orgId: string) => useClimateMutation(orgId, () => post<Climate>(`${base(orgId)}/refresh`));
export const useDismissAlert = (orgId: string) => useClimateMutation(orgId, (id: string) => post<Climate>(`${base(orgId)}/alerts/${id}/dismiss`));
export const useClimateSettings = (orgId: string) => useClimateMutation(orgId, (b: { auto_tasks: boolean }) => put(`${base(orgId)}/settings`, b));

export const dayName = (iso: string, short = false) => {
  const d = new Date(iso + "T12:00:00"); const t = new Date(); t.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NG", short ? { weekday: "short" } : { weekday: "long", day: "numeric", month: "short" });
};
