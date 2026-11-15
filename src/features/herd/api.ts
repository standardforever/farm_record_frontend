import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put, qsOf } from "@/lib/api";

export const BREEDING = ["goats", "sheep", "pigs", "cattle", "rabbits"];

export type Ref = { id: string; tag: string; name: string | null; sex: "female" | "male"; status: string };
export type Animal = {
  id: string; batch_id: string; batch_code: string | null; tag: string; name: string | null; species: string; breed: string | null;
  sex: "female" | "male"; born_on: string | null; born_estimated: boolean; age_days: number | null; source: string;
  dam: Ref | null; sire: Ref | null; sire_name: string | null; possible_sires: Ref[]; status: string; status_on: string | null; status_note: string | null; notes: string | null;
  state: string; state_tone: "neutral" | "good" | "warn" | "crit" | "info" | "brand"; next_on: string | null;
};
export type Mating = {
  id: string; dam_id: string; dam_tag: string | null; sire_id: string | null; sire_tag: string | null; sire_name: string | null;
  method: string; mated_on: string; last_served_on: string | null; due_on: string; status: "served" | "pregnant" | "empty" | "born" | "lost";
  checked_on: string | null; ended_on: string | null; born_alive: number | null; born_dead: number | null;
  young_batch_id: string | null; young_batch_code: string | null; weaned_on: string | null; weaned: number | null;
  notes: string | null; voided_at: string | null; void_reason: string | null;
  services: { id: string; served_on: string; sire_id: string | null; sire_tag: string | null; sire_name: string | null; method: string }[];
};
export type Weight = { id: string; on: string; kg: number; note: string | null; gain_g_day: number | null };
export type CostLine = { kind: "expense" | "treatment"; id: string; on: string; label: string; amount: number };
export type AnimalDetail = Animal & { offspring: Ref[]; maybe_offspring: Ref[]; matings: Mating[]; sired: Mating[]; young_total: number; litters: number;
  weights: Weight[]; costs: CostLine[] | null; cost_total: number | null };
export type Setting = { values: Record<string, number | null | [number, number] | string>; defaults: Record<string, number | null | [number, number] | string>; changed: string[] };
export type Upcoming = {
  kind: "heat" | "check" | "prepare" | "due" | "overdue" | "wean" | "ready"; on: string; animal_id: string; tag: string; species: string;
  mating_id: string | null; title: string; detail: string; late: boolean;
};
export type Overview = { females: number; males: number; young: number; pregnant: number; served: number; due_30: number; ready: number; items: Upcoming[] };
type Cycle = { first_mating_f: number; first_mating_m: number; gestation: number; gestation_range: [number, number]; cycle: number | null;
  check: number; check_how: string; prepare: number; prepare_what: string; wean: number; rebreed: number; litter: [number, number]; overdue: number };
export type Words = { female: string; male: string; young: string; birth: string; birth_verb: string; mate: string };
export type HerdCatalog = { cycles: Record<string, Cycle>; words: Record<string, Words>; maiden: Record<string, string>; methods: Record<string, string>; statuses: Record<string, string> };

const base = (orgId: string) => `/organizations/${orgId}/farm/herd`;

export const useHerdCatalog = () => useQuery({ queryKey: ["herd-catalog"], queryFn: () => get<HerdCatalog>("/farm/herd/catalog"), staleTime: Infinity });
export const useHerdOverview = (orgId: string, enabled = true) =>
  useQuery({ queryKey: ["farm", orgId, "herd", "overview"], queryFn: () => get<Overview>(`${base(orgId)}/overview`), enabled });
export const useAnimals = (orgId: string, q: { species?: string; sex?: string; status?: string; batch_id?: string; q?: string } = {}, enabled = true) =>
  useQuery({ queryKey: ["farm", orgId, "herd", "animals", q], queryFn: () => get<Animal[]>(`${base(orgId)}/animals${qsOf(q)}`), enabled });
export const useAnimal = (orgId: string, id: string) =>
  useQuery({ queryKey: ["farm", orgId, "herd", "animal", id], queryFn: () => get<AnimalDetail>(`${base(orgId)}/animals/${id}`) });

function useHerdMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["farm", orgId] }) });
}
export type NewAnimal = { tag: string; sex: "female" | "male"; name?: string | null; born_on?: string | null; born_estimated?: boolean; breed?: string | null;
  dam_id?: string | null; sire_id?: string | null };
export const useTagAnimals = (orgId: string) =>
  useHerdMutation(orgId, (b: { batch_id: string; animals: NewAnimal[] }) => post<Animal[]>(`${base(orgId)}/animals`, b));
export const useUpdateAnimal = (orgId: string) =>
  useHerdMutation(orgId, ({ id, ...b }: { id: string } & Partial<NewAnimal> & { tag?: string; notes?: string | null }) => patch<Animal>(`${base(orgId)}/animals/${id}`, b));
export const useExitAnimal = (orgId: string) =>
  useHerdMutation(orgId, ({ id, ...b }: { id: string; kind: string; on: string; unit_id?: string | null; reason?: string | null; amount?: number | null; weight_kg?: number | null }) =>
    post<Animal>(`${base(orgId)}/animals/${id}/exit`, b));
export const useMoveAnimal = (orgId: string) =>
  useHerdMutation(orgId, ({ id, ...b }: { id: string; to_batch_id: string; on: string; from_unit_id?: string | null; to_unit_id?: string | null }) =>
    post<Animal>(`${base(orgId)}/animals/${id}/move`, b));
export const useMate = (orgId: string) =>
  useHerdMutation(orgId, (b: { dam_id: string; sire_id?: string | null; sire_name?: string | null; sires?: { sire_id?: string | null; sire_name?: string | null }[];
    method: string; mated_on: string; notes?: string | null }) =>
    post<Mating>(`${base(orgId)}/matings`, b));
export const useHerdSettings = (orgId: string, enabled = true) =>
  useQuery({ queryKey: ["farm", orgId, "herd", "settings"], queryFn: () => get<Record<string, Setting>>(`${base(orgId)}/settings`), enabled });
export const useSaveHerdSettings = (orgId: string) =>
  useHerdMutation(orgId, ({ species, values }: { species: string; values: Record<string, number | null> }) => put<Setting>(`${base(orgId)}/settings/${species}`, { values }));
export const useWeigh = (orgId: string) =>
  useHerdMutation(orgId, ({ id, ...b }: { id: string; on: string; kg: number; note?: string | null }) => post<AnimalDetail>(`${base(orgId)}/animals/${id}/weights`, b));
export const useUnweigh = (orgId: string) =>
  useHerdMutation(orgId, ({ id, weightId }: { id: string; weightId: string }) => del<AnimalDetail>(`${base(orgId)}/animals/${id}/weights/${weightId}`));
export const useMatingAction = (orgId: string) =>
  useHerdMutation(orgId, ({ id, action, ...b }: { id: string; action: "check" | "birth" | "lost" | "wean" | "void" | "undo-birth" | "services" } & Record<string, unknown>) =>
    post<Mating>(`${base(orgId)}/matings/${id}/${action}`, b));

export const ageText = (days: number | null) => {
  if (days == null) return "Age not known";
  if (days < 60) return `${days} days`;
  const m = Math.floor(days / 30.4);
  if (m < 24) return `${m} months`;
  const y = Math.floor(m / 12), r = m % 12;
  return `${y} yr${y > 1 ? "s" : ""}${r ? ` ${r} mo` : ""}`;
};
export const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** "B-01" · "B-01 and B-02" · "AI" — who served her. */
export function siresOf(m: Mating): string {
  const names = [...new Set(m.services.map((s) => s.sire_tag ?? s.sire_name ?? (s.method === "ai" ? "AI" : "an outside male")))];
  if (!names.length) return m.sire_tag ?? m.sire_name ?? (m.method === "ai" ? "AI" : "an outside male");
  return names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** This farm's numbers for a species (its own where changed, else the suggested ones). */
export function useCycle(orgId: string, species: string | undefined) {
  const cat = useHerdCatalog();
  const own = useHerdSettings(orgId, !!species);
  if (!species) return undefined;
  const v = own.data?.[species]?.values as unknown as HerdCatalog["cycles"][string] | undefined;
  return v ?? cat.data?.cycles[species];
}
