import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, put } from "@/lib/api";
import type { Page, PageQuery } from "@/lib/types";

export type Account = {
  id: string; name: string; kind: "cash" | "bank" | "mobile"; bank_name: string | null; account_number: string | null; opening_balance: number;
  opening_on: string; active: boolean; balance: number; last_reconciled_on: string | null; last_difference: number | null;
};
export type StatementLine = { on: string; kind: string; description: string; reference: string | null; amount: number; balance: number; source_id: string };
export type Statement = { account: Account; start: string; end: string; opening: number; money_in: number; money_out: number; closing: number; lines: StatementLine[]; unassigned_receipts: number;
  before_start?: { kind: "expense" | "money_in"; id: string; number: string; on: string; description: string; amount: number }[] };
export type Reconciliation = { id: string; account_id: string; as_of: string; statement_balance: number; book_balance: number; difference: number; note: string | null; created_at: string; created_by_name: string | null };
export type Expense = {
  id: string; number: string; spent_on: string; category: string; description: string; amount: number; payee: string | null; account_id: string | null;
  account_name: string | null; paid_on: string | null; reference: string | null; batch_id: string | null; batch_code: string | null; unit_id: string | null;
  unit_code: string | null; site_id: string | null; site_name: string | null; media_id: string | null; status: "pending" | "approved" | "rejected";
  decision_note: string | null; decided_by_name: string | null; created_by_name: string | null; created_at: string; voided_at: string | null; void_reason: string | null;
  cash_only: boolean;
};
export type Employee = { id: string; name: string; phone: string | null; job_title: string | null; pay_basis: "monthly" | "daily"; rate: number; bank_name: string | null; account_number: string | null; started_on: string | null; active: boolean };
export type PayLine = { id: string; employee_id: string; employee_name: string; job_title: string | null; days: number | null; gross: number; deductions: number; net: number; note: string | null };
export type PayRun = { id: string; period: string; status: "draft" | "paid"; paid_on: string | null; account_id: string | null; gross: number; deductions: number; net: number; lines: PayLine[] };
export type PnlRow = { key: string; label: string; total: number; by_enterprise: Record<string, number> };
export type Pnl = { start: string; end: string; enterprises: Record<string, string>; revenue: PnlRow[]; costs: PnlRow[]; total_revenue: PnlRow; total_costs: PnlRow; profit: PnlRow; notes: string[] };
export type BatchProfit = {
  batch_id: string; code: string; species: string; enterprise: string; status: string; started_on: string; closed_on: string | null; days: number;
  head_in: number; head_sold: number; survival_pct: number | null; revenue: number; costs: number; cost_breakdown: Record<string, number>; profit: number;
  margin_pct: number | null; profit_per_head_in: number | null; cost_per_kg_sold: number | null;
};
export type UnitProfit = { unit_id: string; code: string; site_name: string | null; batches: number; revenue: number; costs: number; unit_expenses: number; profit: number };
export type CashMonth = { month: string; money_in: number; money_out: number; net: number; out_by_kind: Record<string, number>; in_by_channel: Record<string, number> };
export type CashFlow = { start: string; end: string; opening: number; closing: number; months: CashMonth[]; unassigned_receipts: number };
export type LoansOwed = { owed: number; loans: number; next_due_on: string | null; next_amount: number | null; next_lender: string | null; overdue: number; due_soon: number };
export type RentDue = { site_id: string; site_name: string; paid_until: string | null; due_on: string | null; amount: number | null; overdue: boolean };
export type PaybackPlace = { id: string; name: string; invested: number; profit: number | null; recovered_pct: number | null };
export type Payback = {
  invested: number; sold: number; net_invested: number; since: string | null; profit_since: number; recovered: number; recovered_pct: number | null; left: number;
  avg_monthly_profit: number | null; months_to_go: number | null; rent_per_month: number; by_site: PaybackPlace[]; by_unit: PaybackPlace[];
  items: { expense_id: string; number: string; on: string; category: string; description: string; amount: number; site_name: string | null; units: string[]; status: string }[];
  notes: string[];
};
export type FinanceOverview = { on: string; month_revenue: number; month_costs: number; month_profit: number; cash: number; accounts: Account[]; pending: Expense[]; unpaid_bills: number; approval_limit: number; loans?: LoansOwed | null; rent_due?: RentDue[] };
export type FinanceCatalog = {
  account_kinds: Record<string, string>; expense_categories: Record<string, string>; cash_only: Record<string, string>; pay_basis: Record<string, string>; enterprises: Record<string, string>;
  money_in_kinds: Record<string, string>; money_in_in_profit: string[]; loan_frequencies: Record<string, string>;
};
export type MoneyIn = {
  id: string; number: string; kind: string; kind_label: string; received_on: string; amount: number; account_id: string; account_name: string | null;
  source: string | null; reference: string | null; note: string | null; loan_id: string | null; in_profit: boolean; created_by_name: string | null;
};
export type Repayment = { group_id: string; paid_on: string | null; principal: number; interest: number; account_name: string | null; status: "approved" | "pending" | "rejected"; expense_ids: string[]; numbers: string[] };
export type Loan = {
  id: string; number: string; lender: string; amount: number; received_on: string; account_id: string | null; account_name: string | null;
  interest_rate_pct: number | null; interest_total: number | null; repayment_amount: number | null; frequency: string; first_due_on: string | null;
  final_due_on: string | null; note: string | null; repaid: number; interest_paid: number; outstanding: number; interest_left: number | null;
  waiting_approval: number; payments_made: number; next_due_on: string | null; next_amount: number | null; overdue: boolean; due_soon: boolean;
  repaid_on: string | null; repayments: Repayment[];
};

const base = (orgId: string) => `/organizations/${orgId}/finance`;
const qs = (o: Record<string, string | boolean | undefined | null>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false).map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};

export const useFinanceCatalog = () => useQuery({ queryKey: ["finance-catalog"], queryFn: () => get<FinanceCatalog>("/finance/catalog"), staleTime: Infinity });
export const useFinance = (orgId: string, enabled = true) => useQuery({ queryKey: ["finance", orgId, "overview"], queryFn: () => get<FinanceOverview>(base(orgId)), enabled });
export const useAccounts = (orgId: string, enabled = true) => useQuery({ queryKey: ["finance", orgId, "accounts"], queryFn: () => get<Account[]>(`${base(orgId)}/accounts`), enabled });
export const useStatement = (orgId: string, id: string | null, start: string, end: string) =>
  useQuery({ queryKey: ["finance", orgId, "statement", id, start, end], queryFn: () => get<Statement>(`${base(orgId)}/accounts/${id}/statement${qs({ start, end })}`), enabled: !!id });
export const useReconciliations = (orgId: string, id: string | null) =>
  useQuery({ queryKey: ["finance", orgId, "recs", id], queryFn: () => get<Reconciliation[]>(`${base(orgId)}/accounts/${id}/reconciliations`), enabled: !!id });
export type ExpensePage = Page<Expense> & { approved_count: number; approved_total: number };
export const useExpenses = (orgId: string, f: { status?: string; category?: string; start?: string; end?: string; unpaid?: boolean } & Partial<PageQuery> = {}) =>
  useQuery({ queryKey: ["finance", orgId, "expenses", f], placeholderData: (p) => p,
    queryFn: () => get<ExpensePage>(`${base(orgId)}/expenses${qs(f as Record<string, string | boolean | undefined>)}`) });
export const useEmployees = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "employees"], queryFn: () => get<Employee[]>(`${base(orgId)}/employees`) });
export const usePayRuns = (orgId: string, f: Partial<PageQuery> = {}) =>
  useQuery({ queryKey: ["finance", orgId, "payruns", f], placeholderData: (p) => p,
    queryFn: () => get<Page<PayRun>>(`${base(orgId)}/payruns${qs(f as Record<string, string | undefined>)}`) });
export const usePnl = (orgId: string, start: string, end: string) => useQuery({ queryKey: ["finance", orgId, "pnl", start, end], queryFn: () => get<Pnl>(`${base(orgId)}/pnl${qs({ start, end })}`) });
export const useBatchProfits = (orgId: string, status?: string) => useQuery({ queryKey: ["finance", orgId, "batches", status ?? ""], queryFn: () => get<BatchProfit[]>(`${base(orgId)}/batches${qs({ status })}`) });
export const useUnitProfits = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "units"], queryFn: () => get<UnitProfit[]>(`${base(orgId)}/units`) });
export const useCashFlow = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "cashflow"], queryFn: () => get<CashFlow>(`${base(orgId)}/cashflow`) });

export const usePayback = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "payback"], queryFn: () => get<Payback>(`${base(orgId)}/payback`) });
export const useMoneyIn = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "money-in"], queryFn: () => get<MoneyIn[]>(`${base(orgId)}/money-in`) });
export const useLoans = (orgId: string) => useQuery({ queryKey: ["finance", orgId, "loans"], queryFn: () => get<Loan[]>(`${base(orgId)}/loans`) });
export const useLoan = (orgId: string, id: string | null) => useQuery({ queryKey: ["finance", orgId, "loan", id], queryFn: () => get<Loan>(`${base(orgId)}/loans/${id}`), enabled: !!id });

function useFinanceMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance", orgId] }); qc.invalidateQueries({ queryKey: ["farm", orgId] }); } });
}

export const useSaveAccount = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: Partial<Account> & { id?: string }) => (id ? patch<Account>(`${base(orgId)}/accounts/${id}`, b) : post<Account>(`${base(orgId)}/accounts`, b)));
export const useTransfer = (orgId: string) => useFinanceMutation(orgId, (b: Record<string, unknown>) => post<{ id: string }>(`${base(orgId)}/transfers`, b));
export const useReconcile = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: { id: string; as_of: string; statement_balance: number; note?: string | null }) => post<Reconciliation>(`${base(orgId)}/accounts/${id}/reconcile`, b));
export const useAddExpense = (orgId: string) => useFinanceMutation(orgId, (b: Record<string, unknown>) => post<Expense>(`${base(orgId)}/expenses`, b));
export const useDecideExpense = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: { id: string; approve: boolean; note?: string | null }) => post<Expense>(`${base(orgId)}/expenses/${id}/decide`, b));
export const usePayExpense = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: { id: string; account_id: string; paid_on: string }) => post<Expense>(`${base(orgId)}/expenses/${id}/pay`, b));
export const useVoidExpense = (orgId: string) => useFinanceMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<Expense>(`${base(orgId)}/expenses/${id}/void`, { reason }));
export const useSaveEmployee = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: Partial<Employee> & { id?: string }) => (id ? patch<Employee>(`${base(orgId)}/employees/${id}`, b) : post<Employee>(`${base(orgId)}/employees`, b)));
export const useSavePayRun = (orgId: string) => useFinanceMutation(orgId, (b: { period: string; lines?: { employee_id: string; days?: number | null; deductions?: number; note?: string | null }[] }) => post<PayRun>(`${base(orgId)}/payruns`, b));
export const usePayPayRun = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: { id: string; account_id: string; paid_on: string }) => post<PayRun>(`${base(orgId)}/payruns/${id}/pay`, b));
export const useSaveFinanceSettings = (orgId: string) => useFinanceMutation(orgId, (b: { approval_limit: number }) => put(`${base(orgId)}/settings`, b));

// ---- helpers ----
export const day = (iso: string | null | undefined) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const monthLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
export const monthRange = (offset = 0) => {
  const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth() + offset, 1); const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { start: iso(s), end: iso(e) };
};

export const useAddMoneyIn = (orgId: string) => useFinanceMutation(orgId, (b: Record<string, unknown>) => post<MoneyIn>(`${base(orgId)}/money-in`, b));
export const useVoidMoneyIn = (orgId: string) => useFinanceMutation(orgId, ({ id, reason }: { id: string; reason: string }) => post<MoneyIn>(`${base(orgId)}/money-in/${id}/void`, { reason }));
export const useAddLoan = (orgId: string) => useFinanceMutation(orgId, (b: Record<string, unknown>) => post<Loan>(`${base(orgId)}/loans`, b));
export const useRepayLoan = (orgId: string) =>
  useFinanceMutation(orgId, ({ id, ...b }: { id: string; paid_on: string; account_id: string; principal: number; interest: number; reference?: string | null; client_id?: string }) =>
    post<Loan>(`${base(orgId)}/loans/${id}/repay`, b));
