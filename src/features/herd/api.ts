import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, qsOf } from "@/lib/api";

export const BREEDING = ["goats", "sheep", "pigs", "cattle", "rabbits"];

export type Ref = { id: string; tag: string; name: string | null; sex: "female" | "male"; status: string };
export type Animal = {
  id: string; batch_id: string; batch_code: string | null; tag: string; name: string | null; species: string; breed: string | null;
  sex: "female" | "male"; born_on: string | null; born_estimated: boolean; age_days: number | null; source: string;
  dam: Ref | null; sire: Ref | null; sire_name: string | null; status: string; status_on: string | null; status_note: string | null; notes: string | null;
  state: string; state_tone: "neutral" | "good" | "warn" | "crit" | "info" | "brand"; next_on: string | null;
};
export type Mating = {
  id: string; dam_id: string; dam_tag: string | null; sire_id: string | null; sire_tag: string | null; sire_name: string | null;
  method: string; mated_on: string; due_on: string; status: "served" | "pregnant" | "empty" | "born" | "lost";
  checked_on: string | null; ended_on: string | null; born_alive: number | null; born_dead: number | null;
  young_batch_id: string | null; young_batch_code: string | null; weaned_on: string | null; weaned: number | null;
  notes: string | null; voided_at: string | null; void_reason: string | null;
};
export type AnimalDetail = Animal & { offspring: Ref[]; matings: Mating[]; sired: Mating[]; young_total: number; litters: number };
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
  useHerdMutation(orgId, (b: { dam_id: string; sire_id?: string | null; sire_name?: string | null; method: string; mated_on: string; notes?: string | null }) =>
    post<Mating>(`${base(orgId)}/matings`, b));
export const useMatingAction = (orgId: string) =>
  useHerdMutation(orgId, ({ id, action, ...b }: { id: string; action: "check" | "birth" | "lost" | "wean" | "void" | "undo-birth" } & Record<string, unknown>) =>
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
