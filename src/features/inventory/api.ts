import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

export type StockItem = {
  id: string; name: string; category: string; unit: string; pack_name: string | null; pack_size: number | null;
  reorder_level: number | null; reorder_qty: number | null; supplier: string | null; notes: string | null; active: boolean;
  in_stock: number; unrecorded: number; value: number | null; avg_unit_cost: number | null; next_expiry: string | null; open_lots: number; reorder: boolean;
};
export type Lot = {
  id: string; item_id: string; received_on: string; quantity: number; remaining: number; unit_cost: number | null; supplier: string | null;
  reference: string | null; lot_number: string | null; expires_on: string | null; notes: string | null; voided_at: string | null; created_at: string;
  payment?: Payment | null;
};
/** What was paid for a purchase (a delivery, a batch's animals): the linked expense. */
export type Payment = { expense_id: string; number: string; amount: number; status: "paid" | "owed" | "pending" | "rejected"; account_name: string | null; paid_on: string | null };
export type Move = {
  id: string; item_id: string; item_name: string | null; item_unit: string | null; lot_id: string | null; lot_label: string | null; kind: string;
  quantity: number; occurred_on: string; cost_amount: number | null; batch_id: string | null; batch_code: string | null; unit_id: string | null;
  unit_code: string | null; record_id: string | null; group_id: string | null; shortfall: boolean; reason: string | null; note: string | null;
  status: "posted" | "pending" | "rejected"; created_at: string; created_by_name: string | null; decided_by_name: string | null;
  voided_at: string | null; void_reason: string | null;
};
export type ItemDetail = StockItem & { lots: Lot[]; moves: Move[] };
export type Alert = { kind: "reorder" | "expiring" | "expired" | "unrecorded" | "service"; item_id: string | null; equipment_id: string | null; title: string; detail: string };
export type Overview = { on: string; items: StockItem[]; alerts: Alert[]; pending: Move[]; recent: Move[]; value: number | null };
export type Equipment = {
  id: string; name: string; kind: string; site_id: string | null; unit_id: string | null; unit_code: string | null; site_name: string | null;
  serial: string | null; bought_on: string | null; cost: number | null; status: string; last_service_on: string | null; next_service_on: string | null;
  notes: string | null; service_due: boolean;
  caretaker_id: string | null; caretaker_name: string | null; service_every_days: number | null; service_every_hours: number | null;
  hours: number | null; hours_to_service: number | null; broken_since: string | null; broken_note: string | null;
  spent_this_year: number | null; paid: { expense_id: string; number: string; amount: number; status: "paid" | "owed" | "pending" | "rejected"; account_name: string | null; paid_on: string | null } | null;
};
export type EquipmentEventKind = "service" | "repair" | "parts" | "install" | "fuel" | "hours" | "breakdown" | "moved" | "note" | "sold" | "retired";
export type EquipmentEvent = {
  id: string; kind: EquipmentEventKind; on: string; amount: number | null; litres: number | null; hours: number | null; note: string | null;
  done_by: string | null; media_id: string | null; expense_id: string | null; money_in_id: string | null; created_by_name: string | null; created_at: string;
};
export type EquipmentDetail = Equipment & {
  events: EquipmentEvent[]; bought_for: number | null; installed_for?: number | null; running_this_year: number | null; running_total: number | null;
  fuel_litres_this_year: number | null; fuel_cost_this_year: number | null; cost_per_hour: number | null; sold_for: number | null;
};
export type EquipmentInfo = { label: string; group: string; for?: string[]; days?: number; hours?: number; hint?: string };
export type InventoryCatalog = {
  categories: Record<string, string>; units: Record<string, string>; moves: Record<string, string>; write_off_reasons: string[];
  equipment_kinds: Record<string, string>; equipment_status: Record<string, string>;
  equipment_info: Record<string, EquipmentInfo>; equipment_groups: Record<string, string>; equipment_events: Record<string, { label: string; money?: string }>;
};
export type PayIn = { status: "paid" | "owed"; account_id?: string; paid_on?: string | null; reference?: string | null };
export type EventInput = {
  kind: EquipmentEventKind; on: string; amount?: number | null; litres?: number | null; hours?: number | null; note?: string | null;
  done_by?: string | null; fixed?: boolean; next_service_on?: string | null; payment?: PayIn | null;
};

const base = (orgId: string) => `/organizations/${orgId}/inventory`;

export const useInventoryCatalog = () => useQuery({ queryKey: ["inventory-catalog"], queryFn: () => get<InventoryCatalog>("/inventory/catalog"), staleTime: Infinity });
export const useStock = (orgId: string) => useQuery({ queryKey: ["inventory", orgId, "overview"], queryFn: () => get<Overview>(base(orgId)) });
export const useStockItems = (orgId: string, category?: string, enabled = true) =>
  useQuery({ queryKey: ["inventory", orgId, "items", category ?? ""], queryFn: () => get<StockItem[]>(`${base(orgId)}/items${category ? `?category=${category}` : ""}`), enabled });
export const useStockItem = (orgId: string, id: string | null) =>
  useQuery({ queryKey: ["inventory", orgId, "item", id], queryFn: () => get<ItemDetail>(`${base(orgId)}/items/${id}`), enabled: !!id });
export const useItemMoves = (orgId: string, id: string | null, f: PageQuery) =>
  useQuery({ queryKey: ["inventory", orgId, "item", id, "moves", f], placeholderData: (p) => p, enabled: !!id,
    queryFn: () => get<Page<Move>>(`${base(orgId)}/items/${id}/moves${qsOf(f)}`) });
export const useBatchStock = (orgId: string, batchId: string, enabled = true) =>
  useQuery({ queryKey: ["inventory", orgId, "batch", batchId], queryFn: () => get<Move[]>(`${base(orgId)}/batches/${batchId}`), enabled });
export const useEquipment = (orgId: string, includeRetired = false) =>
  useQuery({ queryKey: ["inventory", orgId, "equipment", includeRetired], queryFn: () => get<Equipment[]>(`${base(orgId)}/equipment?include_retired=${includeRetired}`) });

function useStockMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>, money = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", orgId] });
      qc.invalidateQueries({ queryKey: ["farm", orgId] }); // batch costs change with stock use; service reminders are tasks
      if (money) qc.invalidateQueries({ queryKey: ["finance", orgId] });
    },
  });
}

export type ItemInput = Partial<Pick<StockItem, "name" | "category" | "unit" | "pack_name" | "pack_size" | "reorder_level" | "reorder_qty" | "supplier" | "notes" | "active">>;
export const useCreateItem = (orgId: string) => useStockMutation(orgId, (b: ItemInput) => post<StockItem>(`${base(orgId)}/items`, b));
export const useUpdateItem = (orgId: string) => useStockMutation(orgId, ({ id, ...b }: ItemInput & { id: string }) => patch<StockItem>(`${base(orgId)}/items/${id}`, b));
export const useReceive = (orgId: string) => useStockMutation(orgId, (b: Record<string, unknown>) => post<Lot>(`${base(orgId)}/receive`, b));
export const useIssue = (orgId: string) =>
  useStockMutation(orgId, (b: Record<string, unknown>) => post<{ moves: Move[]; quantity: number; cost_amount: number | null; shortfall: number }>(`${base(orgId)}/issue`, b));
export const useCount = (orgId: string) => useStockMutation(orgId, (b: Record<string, unknown>) => post<Move[]>(`${base(orgId)}/count`, b));
export const useWriteOff = (orgId: string) => useStockMutation(orgId, (b: Record<string, unknown>) => post<Move[]>(`${base(orgId)}/write-off`, b));
export const useDecide = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: { id: string; approve: boolean; note?: string | null }) => post(`${base(orgId)}/pending/${id}`, b));
export const usePriceLot = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: { id: string; unit_cost?: number; total_cost?: number }) => post<Lot>(`${base(orgId)}/lots/${id}/price`, b));
export const usePayLot = (orgId: string) => useStockMutation(orgId, ({ id, ...b }: { id: string; status: "paid" | "owed"; account_id?: string; reference?: string | null }) =>
  post<Lot>(`${base(orgId)}/lots/${id}/payment`, b));
export const useVoidLot = (orgId: string) => useStockMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<Lot>(`${base(orgId)}/lots/${id}/void`, { reason }));
export const useVoidIssue = (orgId: string) => useStockMutation(orgId, ({ group, reason }: { group: string; reason: string }) => post(`${base(orgId)}/moves/${group}/void`, { reason }));
export const useSaveEquipment = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: Partial<Equipment> & { id?: string; payment?: PayIn | null; hours_at_service?: number }) =>
    (id ? patch<Equipment>(`${base(orgId)}/equipment/${id}`, b) : post<Equipment>(`${base(orgId)}/equipment`, b)), true);
export const useEquipmentDetail = (orgId: string, id: string) =>
  useQuery({ queryKey: ["inventory", orgId, "equipment", "one", id], queryFn: () => get<EquipmentDetail>(`${base(orgId)}/equipment/${id}`) });
export const useEquipmentEvent = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: EventInput & { id: string }) => post<EquipmentDetail>(`${base(orgId)}/equipment/${id}/events`, b), true);
export const useRetireEquipment = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: { id: string; on: string; reason: string; amount?: number | null; account_id?: string | null; note?: string | null }) =>
    post<EquipmentDetail>(`${base(orgId)}/equipment/${id}/retire`, b), true);
export const useServiced = (orgId: string) =>
  useStockMutation(orgId, ({ id, ...b }: { id: string; on: string; next_on?: string | null; note?: string | null }) => post<Equipment>(`${base(orgId)}/equipment/${id}/serviced`, b));

// ---- helpers ----

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-NG") : n.toLocaleString("en-NG", { maximumFractionDigits: 2 }));

/** "210 kg (14 bags)" */
export function qty(n: number, it: Pick<StockItem, "unit" | "pack_name" | "pack_size">) {
  const main = `${num(n)} ${it.unit}`;
  if (!it.pack_size || !it.pack_name || it.unit === it.pack_name) return main;
  const packs = n / it.pack_size;
  return `${main} (${num(Math.round(packs * 10) / 10)} ${it.pack_name}${Math.abs(packs) === 1 ? "" : "s"})`;
}
