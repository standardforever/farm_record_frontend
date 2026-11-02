import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qsOf } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";
import { get, patch, post, put } from "@/lib/api";

export type Customer = {
  id: string; name: string; kind: string; phone: string | null; email: string | null; address: string | null; state: string | null; lga: string | null;
  credit_limit: number | null; terms_days: number; notes: string | null; active: boolean; created_at: string;
  outstanding: number; overdue: number; credit: number; last_sale_on: string | null;
};
export type Invoice = {
  id: string; number: string; customer_id: string | null; customer_name: string; issued_on: string; due_on: string;
  subtotal: number; discount: number; total: number; paid: number; balance: number; status: "paid" | "part_paid" | "unpaid" | "overdue" | "void";
  days_overdue: number; notes: string | null; created_at: string; created_by_name: string | null; voided_at: string | null; void_reason: string | null;
};
export type Line = {
  id: string; position: number; product: string; description: string; batch_id: string | null; batch_code: string | null; unit_id: string | null;
  unit_code: string | null; quantity: number; unit: string; unit_price: number; amount: number; weight_kg: number | null;
};
export type InvoiceDetail = Invoice & {
  lines: Line[]; payments: { payment_id: string; number: string; received_on: string; channel: string; amount: number }[];
  customer: Customer | null;
  seller: { name: string; phone: string | null; state: string | null; lga: string | null; bank_name?: string | null; account_name?: string | null; account_number?: string | null; footer?: string | null };
};
export type Payment = {
  id: string; number: string; customer_id: string | null; payer_name: string; received_on: string; amount: number; channel: string;
  reference: string | null; note: string | null; applied: number; unapplied: number; allocations: { invoice_id: string; number: string; amount: number }[];
  created_at: string; created_by_name: string | null; voided_at: string | null; void_reason: string | null;
};
export type AgingRow = { customer_id: string | null; customer_name: string; phone: string | null; buckets: number[]; total: number; invoices: number };
export type Aging = { as_of: string; buckets: string[]; rows: AgingRow[]; totals: number[]; total: number };
export type SalesOverview = {
  on: string; month_sales: number; month_received: number; outstanding: number; overdue: number;
  by_channel: Record<string, number>; by_product: Record<string, number>; recent: Invoice[];
};
export type SalesCatalog = {
  products: Record<string, { label: string; unit: string; needs_batch: boolean; hold_product: string | null }>;
  units: string[]; customer_kinds: Record<string, string>; channels: Record<string, string>; aging_buckets: string[];
};
export type InvoiceSettings = { bank_name: string | null; account_name: string | null; account_number: string | null; footer: string | null };

const base = (orgId: string) => `/organizations/${orgId}/sales`;

export const useSalesCatalog = () => useQuery({ queryKey: ["sales-catalog"], queryFn: () => get<SalesCatalog>("/sales/catalog"), staleTime: Infinity });
export const useSalesOverview = (orgId: string) => useQuery({ queryKey: ["sales", orgId, "overview"], queryFn: () => get<SalesOverview>(base(orgId)) });
/** For pickers: up to 100 customers by name, as a plain list (type to search). */
export const useCustomers = (orgId: string, enabled = true, q = "") =>
  useQuery({ queryKey: ["sales", orgId, "customers", "all", q], enabled, placeholderData: (p) => p,
    queryFn: async () => (await get<Page<Customer>>(`${base(orgId)}/customers${qsOf({ page_size: 100, q })}`)).items });
export const useCustomerPage = (orgId: string, f: { q?: string } & PageQuery) =>
  useQuery({ queryKey: ["sales", orgId, "customers", "page", f], placeholderData: (p) => p,
    queryFn: () => get<Page<Customer>>(`${base(orgId)}/customers${qsOf(f)}`) });
export const useInvoices = (orgId: string, params: { status?: string; customer_id?: string; batch_id?: string } & Partial<PageQuery> = {}, enabled = true) =>
  useQuery({ queryKey: ["sales", orgId, "invoices", params], enabled, placeholderData: (p) => p,
    queryFn: () => get<Page<Invoice>>(`${base(orgId)}/invoices${qsOf(params)}`) });
export const useInvoice = (orgId: string, id: string | null) =>
  useQuery({ queryKey: ["sales", orgId, "invoice", id], queryFn: () => get<InvoiceDetail>(`${base(orgId)}/invoices/${id}`), enabled: !!id });
export const usePayments = (orgId: string, f: { customer_id?: string } & Partial<PageQuery> = {}) =>
  useQuery({ queryKey: ["sales", orgId, "payments", f], placeholderData: (p) => p,
    queryFn: () => get<Page<Payment>>(`${base(orgId)}/payments${qsOf(f)}`) });
export const usePayment = (orgId: string, id: string | null) =>
  useQuery({ queryKey: ["sales", orgId, "payment", id], queryFn: () => get<Payment>(`${base(orgId)}/payments/${id}`), enabled: !!id });
export const useAging = (orgId: string, asOf?: string) =>
  useQuery({ queryKey: ["sales", orgId, "aging", asOf ?? ""], queryFn: () => get<Aging>(`${base(orgId)}/aging${asOf ? `?as_of=${asOf}` : ""}`) });
export const useInvoiceSettings = (orgId: string) => useQuery({ queryKey: ["sales", orgId, "settings"], queryFn: () => get<InvoiceSettings>(`${base(orgId)}/settings`) });

function useSalesMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", orgId] });
      qc.invalidateQueries({ queryKey: ["farm", orgId] }); // animals sold come off the batch
    },
  });
}

export type LineInput = { product: string; description?: string | null; batch_id?: string | null; unit_id?: string | null; quantity: number; unit?: string; unit_price: number; weight_kg?: number | null };
export type InvoiceInput = {
  customer_id?: string | null; customer_name?: string | null; issued_on: string; due_on?: string | null; lines: LineInput[]; discount?: number;
  notes?: string | null; paid_now?: { amount: number; channel: string; reference?: string | null } | null; override_credit_limit?: boolean; client_id?: string;
};
export const useCreateInvoice = (orgId: string) => useSalesMutation(orgId, (b: InvoiceInput) => post<Invoice>(`${base(orgId)}/invoices`, b));
export const useVoidInvoice = (orgId: string) => useSalesMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<Invoice>(`${base(orgId)}/invoices/${id}/void`, { reason }));
export const useRecordPayment = (orgId: string) => useSalesMutation(orgId, (b: Record<string, unknown>) => post<Payment>(`${base(orgId)}/payments`, b));
export const useVoidPayment = (orgId: string) => useSalesMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<Payment>(`${base(orgId)}/payments/${id}/void`, { reason }));
export const useSaveCustomer = (orgId: string) =>
  useSalesMutation(orgId, ({ id, ...b }: Partial<Customer> & { id?: string }) => (id ? patch<Customer>(`${base(orgId)}/customers/${id}`, b) : post<Customer>(`${base(orgId)}/customers`, b)));
export const useSaveInvoiceSettings = (orgId: string) => useSalesMutation(orgId, (b: InvoiceSettings) => put<InvoiceSettings>(`${base(orgId)}/settings`, b));

export const STATUS: Record<Invoice["status"], { label: string; tone: "good" | "warn" | "crit" | "neutral" | "info" }> = {
  paid: { label: "Paid", tone: "good" }, part_paid: { label: "Part paid", tone: "info" }, unpaid: { label: "Unpaid", tone: "warn" },
  overdue: { label: "Overdue", tone: "crit" }, void: { label: "Void", tone: "neutral" },
};
export const day = (iso: string | null | undefined) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** "20 bags", "1 crate", "480 kg", "400 head" */
export function units(qty: number, unit: string) {
  const n = qty.toLocaleString("en-NG", { maximumFractionDigits: 3 });
  return `${n} ${qty === 1 || ["kg", "head", "g"].includes(unit) ? unit : unit === "litre" ? "litres" : `${unit}s`}`;
}
