"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, EmptyState, PageHeader, PageLoader, Segmented, Stat } from "@/components/ui";
import { AccountDialog, CashPanel, ExpenseDialog, ExpensesPanel, OverviewPanel, PayrollPanel, ProfitPanel, useFinance } from "@/features/finance";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";

export default function FinancePage() {
  return <RequirePermission permission="finance.view"><Inner /></RequirePermission>;
}

type Tab = "overview" | "expenses" | "profit" | "cash" | "payroll";

function Inner() {
  const ws = useCurrentWorkspace();
  const ov = useFinance(ws.orgId);
  const [tab, setTab] = useState<Tab>("overview");
  const [spending, setSpending] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  if (!ws.has("finance")) return <EmptyState title="Finance is not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const month = new Date().toLocaleDateString("en-NG", { month: "long" });
  return (
    <>
      <PageHeader eyebrow="Money" title="Finance" sub="What you spent, what you made, and where the money is."
        actions={ws.can("finance.edit") ? <Button variant="primary" onClick={() => setSpending(true)}><Plus size={16} /> Record expense</Button> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Profit in ${month}`} value={naira(d.month_profit)} sub="So far this month" hero />
        <Stat label={`Earned in ${month}`} value={naira(d.month_revenue)} sub="Sales invoiced" />
        <Stat label={`Costs in ${month}`} value={naira(d.month_costs)} sub="Animals, stock used, expenses, wages" />
        <Stat label="Money you have" value={naira(d.cash)} sub={d.accounts.length ? `${d.accounts.length} account${d.accounts.length > 1 ? "s" : ""}` : "Add your accounts"} />
      </div>
      <div className="mb-4 overflow-x-auto">
        <Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "expenses", label: "Expenses" }, { value: "profit", label: "Profit" },
          { value: "cash", label: "Cash and bank" }, { value: "payroll", label: "Payroll" }]} />
      </div>
      {tab === "overview" && <OverviewPanel onAddAccount={() => setAddingAccount(true)} />}
      {tab === "expenses" && <ExpensesPanel />}
      {tab === "profit" && <ProfitPanel />}
      {tab === "cash" && <CashPanel />}
      {tab === "payroll" && <PayrollPanel />}
      <ExpenseDialog open={spending} onClose={() => setSpending(false)} />
      <AccountDialog open={addingAccount} onClose={() => setAddingAccount(false)} />
    </>
  );
}
