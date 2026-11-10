import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CorrectionKind } from "@/features/corrections/api";
import { newId, save } from "@/features/offline/queue";
import { get, post, qsOf } from "@/lib/api";

/** Any record an owner can correct, plus a ticked-off job. */
export type EvidenceKind = CorrectionKind | "task_completion";

/** Who may see a kind of record (and so its evidence). The API checks this too. */
const FEATURE: Record<EvidenceKind, string> = {
  batch: "farm", batch_event: "farm", farm_record: "farm", task: "farm", task_completion: "farm", handover: "farm", site: "farm", unit: "farm",
  health_case: "health", treatment: "health", stock_item: "inventory", stock_lot: "inventory", stock_move: "inventory", equipment: "inventory", equipment_event: "inventory",
  customer: "sales", invoice: "sales", payment: "sales", expense: "finance", employee: "finance", pay_run: "finance",
  money_account: "finance", account_transfer: "finance", reconciliation: "finance", money_in: "finance", loan: "finance",
};
export const viewPermission = (kind: EvidenceKind) => `${FEATURE[kind]}.view`;

export type EvidenceItem = {
  id: string; type: "photo" | "pdf" | "link"; url: string | null; note: string | null; name: string | null; content_type: string | null;
  size: number | null; added_by: string | null; added_at: string; removed_at: string | null; remove_reason: string | null; can_remove: boolean;
};
export type EvidenceList = {
  kind: EvidenceKind; record_id: string; label: string; kind_label: string; limit: number;
  record_photo: { content_type: string; size: number; name: string | null } | null; items: EvidenceItem[];
};
export type RecentEvidence = {
  items: { id: string; kind: EvidenceKind; kind_label: string; record_id: string; label: string; type: EvidenceItem["type"];
    url: string | null; name: string | null; note: string | null; added_by: string | null; added_at: string }[];
  total: number; page: number; page_size: number;
};

export const base = (orgId: string) => `/organizations/${orgId}/evidence`;
export const fileUrl = (orgId: string, id: string) => `${base(orgId)}/${id}/file`;
export const recordPhotoUrl = (orgId: string, kind: EvidenceKind, id: string) => `${base(orgId)}/record-photo${qsOf({ kind, record_id: id })}`;

export const useEvidence = (orgId: string, kind: EvidenceKind, id: string, opts: { enabled?: boolean; removed?: boolean } = {}) =>
  useQuery({ queryKey: ["evidence", orgId, kind, id, "list", !!opts.removed], enabled: opts.enabled ?? true,
    queryFn: () => get<EvidenceList>(`${base(orgId)}${qsOf({ kind, record_id: id, removed: opts.removed || undefined })}`) });

export const useRecentEvidence = (orgId: string, page: number, pageSize = 20) =>
  useQuery({ queryKey: ["evidence", orgId, "recent", page, pageSize], placeholderData: (p) => p,
    queryFn: () => get<RecentEvidence>(`${base(orgId)}/recent${qsOf({ page, page_size: pageSize })}`) });

// ---- counts, asked for in one request per list ----------------------------------------------------------------

type Waiting = { ids: Set<string>; done: ((c: Record<string, number>) => void)[]; fail: ((e: unknown) => void)[] };
const waiting = new Map<string, Waiting>();

function countLater(orgId: string, kind: EvidenceKind, id: string): Promise<number> {
  const key = `${orgId}|${kind}`;
  let w = waiting.get(key);
  if (!w) {
    w = { ids: new Set(), done: [], fail: [] };
    waiting.set(key, w);
    setTimeout(async () => {
      const mine = waiting.get(key)!; waiting.delete(key);
      try {
        const out = await get<Record<string, number>>(`${base(orgId)}/counts${qsOf({ kind, ids: [...mine.ids].join(",") })}`);
        mine.done.forEach((f) => f(out));
      } catch (e) { mine.fail.forEach((f) => f(e)); }
    }, 25);
  }
  w.ids.add(id);
  return new Promise((resolve, reject) => { w!.done.push((c) => resolve(c[id] ?? 0)); w!.fail.push(reject); });
}

export const useEvidenceCount = (orgId: string, kind: EvidenceKind, id: string, enabled = true) =>
  useQuery({ queryKey: ["evidence", orgId, kind, id, "count"], enabled, staleTime: 60_000, retry: false,
    queryFn: () => countLater(orgId, kind, id) });

// ---- adding --------------------------------------------------------------------------------------------------

export type PickedFile = { id: string; blob: Blob; name: string; type: "photo" | "pdf"; preview?: string };
export type Picked = { files: PickedFile[]; link: string; note: string };
export const emptyPicked = (): Picked => ({ files: [], link: "", note: "" });
export const hasPicked = (p: Picked) => p.files.length > 0 || !!p.link.trim();

/** Which record the evidence is for: its id, or (for a record still on its way from this phone) the phone's id for it. */
export type RecordRef = { record_id: string } | { record_client_id: string };

/** After saving through the phone's queue: the record's id when it was sent, or the phone's id for it while it waits. */
export const refOf = (r: { status: "sent"; id: string | null } | { status: "queued" }, clientId: string): RecordRef =>
  r.status === "sent" && r.id ? { record_id: r.id } : { record_client_id: clientId };

/**
 * Add what was picked to a record. Each file goes through the phone's queue like any other work, so with no
 * network it waits and is sent after the record itself. Returns how many were sent now and how many wait.
 */
export async function attachPicked(orgId: string, kind: EvidenceKind, ref: RecordRef, picked: Picked, label: string) {
  const note = picked.note.trim() || null;
  let sent = 0, queued = 0;
  const one = async (body: Record<string, unknown>, f?: PickedFile) => {
    const r = await save(orgId, "evidence.attach", { kind, ...ref, note, ...body }, `Evidence for ${label}`,
      f ? { photo: f.blob, photoPath: "evidence/files", photoName: f.name, clientId: newId() } : { clientId: newId() });
    if (r.status === "queued") queued++; else sent++;
  };
  for (const f of picked.files) await one({}, f);
  if (picked.link.trim()) await one({ url: picked.link.trim() });
  return { sent, queued };
}

export function useEvidenceRefresh(orgId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["evidence", orgId] });
}

export const removeEvidence = (orgId: string, id: string, reason: string) => post(`${base(orgId)}/${id}/remove`, { reason });
