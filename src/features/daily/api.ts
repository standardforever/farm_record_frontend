import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, upload } from "@/lib/api";

export type FarmRecord = {
  id: string; kind: string; occurred_on: string; unit_id: string; unit_code: string | null; batch_id: string | null; batch_code: string | null;
  quantity: string | null; data: Record<string, number | string | null>; note: string | null; created_by_name: string | null;
  created_at: string; voided_at: string | null; void_reason: string | null; can_void: boolean;
};
export type Completion = { id: string; status: "done" | "skipped"; note: string | null; media_id: string | null; latitude: number | null; longitude: number | null; accuracy_m: number | null; done_by_name: string | null; done_at: string };
export type Task = {
  id: string; title: string; details: string | null; unit_id: string | null; site_id: string | null; repeat: string; weekdays: number[] | null;
  every_n: number | null; start_on: string; end_on: string | null; time_slot: string; proof: string; record_kind: string | null; assignee_id: string | null; active: boolean;
};
export type TodayTask = Task & { due_on: string | null; overdue: boolean; unit_code: string | null; site_name: string | null; mine: boolean; completion: Completion | null };
export type Handover = { id: string; on_date: string; shift: string; note: string; issues: string[] | null; from_name: string | null; from_user: string | null; acknowledged_by_name: string | null; acknowledged_at: string | null; created_at: string };
export type Today = { on: string; tasks: TodayTask[]; done: number; total: number; records: FarmRecord[]; handovers: Handover[]; missing_feed: { unit_id: string; unit_code: string }[];
  holds: { batch_id: string; batch_code: string; unit_codes: string[]; product: "meat" | "eggs" | "milk" | "all"; until: string | null; clear_on: string | null; reason: string }[] };
export type DailyCatalog = { record_kinds: Record<string, string>; time_slots: Record<string, string>; repeats: Record<string, string>; proofs: Record<string, string>; shifts: Record<string, string>; suggested_for: string[] };

const base = (orgId: string) => `/organizations/${orgId}/farm`;
export const todayKey = (orgId: string, on: string) => ["farm", orgId, "today", on];

export const useDailyCatalog = () => useQuery({ queryKey: ["daily-catalog"], queryFn: () => get<DailyCatalog>("/farm/daily/catalog"), staleTime: Infinity });
export const useToday = (orgId: string, on: string, enabled = true) =>
  useQuery({ queryKey: todayKey(orgId, on), queryFn: () => get<Today>(`${base(orgId)}/today?on=${on}`), placeholderData: (p) => p,
    refetchInterval: enabled ? 60_000 : false, enabled });
export const useTasks = (orgId: string, enabled: boolean) =>
  useQuery({ queryKey: ["farm", orgId, "tasks"], queryFn: () => get<Task[]>(`${base(orgId)}/tasks`), enabled });

function useFarmMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  // Health too: ticking a vaccination task records the vaccination.
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["farm", orgId] }); qc.invalidateQueries({ queryKey: ["health", orgId] }); } });
}

export const useVoidRecord = (orgId: string) => useFarmMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<FarmRecord>(`${base(orgId)}/records/${id}/void`, { reason }));
export const useComplete = (orgId: string) =>
  useFarmMutation(orgId, ({ taskId, ...b }: { taskId: string; on: string; status?: string; note?: string | null; media_id?: string | null; latitude?: number; longitude?: number; accuracy_m?: number; client_id?: string }) =>
    post<Completion>(`${base(orgId)}/tasks/${taskId}/complete`, b));
export const useUndo = (orgId: string) => useFarmMutation(orgId, ({ taskId, on }: { taskId: string; on: string }) => del(`${base(orgId)}/tasks/${taskId}/complete?on=${on}`));
export const useCreateTask = (orgId: string) => useFarmMutation(orgId, (b: Partial<Task>) => post<Task>(`${base(orgId)}/tasks`, b));
export const useSuggest = (orgId: string) => useFarmMutation(orgId, (b: { species: string; unit_ids: string[] }) => post<Task[]>(`${base(orgId)}/tasks/suggested`, b));
export const useUpdateTask = (orgId: string) => useFarmMutation(orgId, ({ id, ...b }: Partial<Task> & { id: string }) => patch<Task>(`${base(orgId)}/tasks/${id}`, b));
export const useHandover = (orgId: string) => useFarmMutation(orgId, (b: { shift: string; note: string; issues?: string[]; client_id?: string }) => post<Handover>(`${base(orgId)}/handovers`, b));
export const useAcknowledge = (orgId: string) => useFarmMutation(orgId, (id: string) => post<Handover>(`${base(orgId)}/handovers/${id}/acknowledge`));

export async function uploadPhoto(orgId: string, blob: Blob, clientId: string) {
  const form = new FormData();
  form.append("file", blob, "proof.jpg");
  form.append("client_id", clientId);
  return upload<{ id: string }>(`${base(orgId)}/media`, form);
}

export const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const shiftDay = (on: string, n: number) => { const d = new Date(on + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
