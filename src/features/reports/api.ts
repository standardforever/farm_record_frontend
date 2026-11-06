import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put, qsOf } from "@/lib/api";

export type DashBatch = {
  id: string; code: string; species: string; breed: string | null; status: string; started_on: string; expected_end_on: string | null;
  age_days: number; current: number; total_in: number; survival_pct: number | null; died: number; fcr: number | null; feed_kg: number;
  latest_avg_weight_g: number | null; eggs: number; result_so_far: number | null; cost_so_far: number | null; sales_amount: number | null;
};
export type DayPoint = { on: string; feed_kg: number; eggs: number; deaths: number };
export type Dashboard = {
  on: string; farm: boolean;
  animals?: { active_batches: number; now: number; by_species: Record<string, number>; deaths_7d: number; deaths_prev_7d: number; mortality_7d_pct: number | null };
  production?: { feed_kg_7d: number; feed_kg_prev_7d: number; eggs_7d: number; eggs_prev_7d: number; daily: DayPoint[] };
  batches?: DashBatch[];
  today: { done: number; total: number; overdue: number; missing_feed: string[] } | null;
  weather: { title: string; on: string; level: "watch" | "danger" } | null;
  health: { open_cases: number; holds: { batch_code: string | null; product: string; until: string | null }[]; doses_due: number; doses_overdue: number } | null;
  stock: { count: number; alerts: { kind: string; title: string; item_id: string }[] } | null;
  sales: { month_sales: number; month_received: number; outstanding: number; overdue: number } | null;
  money: { month_sales: number; month_costs: number; month_profit: number; cash: number; accounts: number;
    loans?: { owed: number; next_due_on: string | null; next_amount: number | null; next_lender: string | null; overdue: number } | null } | null;
};
export type WeeklyBatch = {
  id: string; code: string; species: string; status: string; start_count: number; added: number; end_count: number; died: number; culled: number;
  missing: number; sold: number; feed_kg: number; eggs: number; latest_avg_weight_g: number | null; survival_pct: number | null; fcr: number | null;
};
export type Weekly = {
  start: string; end: string; farm: string; batches: WeeklyBatch[]; daily: DayPoint[];
  totals: { deaths: number; feed_kg: number; eggs: number }; jobs: { done: number; skipped: number };
  health: { treatments: { on: string; product: string; kind: string }[]; cases_opened: number; holds: { batch_code: string | null; product: string; until: string | null }[] } | null;
  sales: { invoiced: number; received: number } | null; money: { expenses: number } | null;
};
export type Row = { key: string; label: string; total: number; by_enterprise: Record<string, number> };
export type Monthly = {
  start: string; end: string; farm: string;
  pnl: { enterprises: Record<string, string>; revenue: Row[]; costs: Row[]; total_revenue: Row; total_costs: Row; profit: Row; notes: string[] };
  cashflow: { months: { month: string; money_in: number; money_out: number; net: number }[] };
  expenses_by_category: { key: string; label: string; amount: number }[];
  accounts: { name: string; kind: string; opening: number; closing: number }[];
  aging: { buckets: number[]; customers: { customer_name: string; total: number; buckets: number[] }[] };
  batches: { code: string; species: string; status: string; revenue: number; costs: number; profit: number; margin_pct: number | null; head_in: number }[];
};
export type BatchReport = {
  farm: string; money: boolean;
  batch: { id: string; code: string; species: string; breed: string | null; status: string; started_on: string; closed_on: string | null;
    initial_count: number; current: number; source_name: string | null; units: { unit_code: string }[];
    summary: Record<string, number | null | string[] | Record<string, number>> | null; close_note: string | null };
  weights: { on: string; avg_g: number; sample: number | null }[];
  weeks: { week: number; from: string; feed_kg: number; eggs: number; deaths: number }[];
  losses: { on: string; kind: string; quantity: number; reason: string | null }[];
  treatments: { on: string; product: string; kind: string; dose: string | null; route: string | null }[];
  expenses: { on: string; description: string; category: string; amount: number }[];
};
export type ReportPerson = { id: string; name: string; email: string | null; role: string; owner: boolean; weekly: boolean; monthly: boolean };
export type ReportEmail = {
  weekly: { enabled: boolean; weekday: number; hour: number; to: string[] | null };
  monthly: { enabled: boolean; day: number; hour: number; to: string[] | null };
  last: { weekly?: string; monthly?: string }; people: ReportPerson[]; finance: boolean;
};

const b = (orgId: string) => `/organizations/${orgId}`;
export const useDashboard = (orgId: string, enabled = true) =>
  useQuery({ queryKey: ["dashboard", orgId], enabled, queryFn: () => get<Dashboard>(`${b(orgId)}/dashboard`) });
export const useWeekly = (orgId: string, end?: string, days = 7) =>
  useQuery({ queryKey: ["reports", orgId, "weekly", end, days], placeholderData: (p) => p, queryFn: () => get<Weekly>(`${b(orgId)}/reports/weekly${qsOf({ end, days })}`) });
export const useMonthly = (orgId: string, month: string, enabled = true) =>
  useQuery({ queryKey: ["reports", orgId, "monthly", month], enabled, placeholderData: (p) => p, queryFn: () => get<Monthly>(`${b(orgId)}/reports/monthly?month=${month}`) });
export const useBatchReport = (orgId: string, id: string | null) =>
  useQuery({ queryKey: ["reports", orgId, "batch", id], enabled: !!id, queryFn: () => get<BatchReport>(`${b(orgId)}/reports/batches/${id}`) });
export const useReportEmail = (orgId: string) => useQuery({ queryKey: ["reports", orgId, "email"], queryFn: () => get<ReportEmail>(`${b(orgId)}/reports/email`) });
export function useSaveReportEmail(orgId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Pick<ReportEmail, "weekly" | "monthly">) => put<ReportEmail>(`${b(orgId)}/reports/email`, body),
    onSuccess: (d) => qc.setQueryData(["reports", orgId, "email"], d) });
}
export const useSendTestReport = (orgId: string) =>
  useMutation({ mutationFn: (which: "weekly" | "monthly") => post<{ sent: number; to: string }>(`${b(orgId)}/reports/email/test?which=${which}`) });
