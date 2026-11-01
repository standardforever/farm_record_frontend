import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type GeoPoint = { name: string; latitude: number; longitude: number };
export type StateItem = GeoPoint & { lga_count: number };
export type StateDetail = GeoPoint & { lgas: (GeoPoint & { wards: GeoPoint[] })[] };
export type Located = { state: string; lga: string; ward: string; distance_km: number };

// The lists only change with a deploy, so keep them for the whole visit.
const forever = { staleTime: Infinity, gcTime: Infinity } as const;

export const useStates = () => useQuery({ queryKey: ["geo", "states"], queryFn: () => get<StateItem[]>("/geo/ng/states"), ...forever });
export const useStateDetail = (state: string) => useQuery({
  queryKey: ["geo", "state", state], queryFn: () => get<StateDetail>(`/geo/ng/states/${encodeURIComponent(state)}`),
  enabled: !!state, ...forever,
});
export const locatePlace = (lat: number, lng: number) => get<Located>(`/geo/ng/locate?lat=${lat}&lng=${lng}`);
