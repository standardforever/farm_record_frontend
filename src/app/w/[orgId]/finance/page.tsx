"use client";

import { useState } from "react";
import { ArrowDownLeft, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader, PageLoader, Segmented, Stat } from "@/components/ui";
import {
  AccountDialog, CashPanel, ExpenseDialog, ExpensesPanel, LoanDialog, LoansCard, LoansPanel, MoneyInDialog, OverviewPanel, PaybackCard, PaybackPanel,
  PayrollPanel, ProfitPanel, RentDueCard, useFinance,
} from "@/features/finance";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";
import { naira } from "@/lib/format";

export default function FinancePage() {
  return <RequirePermission permission="finance.view"><Inner /></RequirePermission>;
}

type Tab = "overview" | "expenses" | "profit" | "payback" | "cash" | "loans" | "payroll";

function Inner() {
  const ws = useCurrentWorkspace();
  const ov = useFinance(ws.orgId);
  const [tab, setTab] = useState<Tab>("overview");
  const [spending, setSpending] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [moneyIn, setMoneyIn] = useState(false);
  const [loan, setLoan] = useState(false);
  if (!ws.has("finance")) return <EmptyState title="Finance is not in your plan" />;
  if (ov.isLoading || !ov.data) return <PageLoader />;
  const d = ov.data;
  const month = new Date().toLocaleDateString("en-NG", { month: "long" });
  return (
    <>
      <PageHeader eyebrow="Money" title="Finance" sub="What you spent, what you made, and where the money is."
        actions={ws.can("finance.edit") ? <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMoneyIn(true)}><ArrowDownLeft size={16} /> Money in</Button>
          <Button variant="primary" onClick={() => setSpending(true)}><Plus size={16} /> Record expense</Button></div> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Profit in ${month}`} value={naira(d.month_profit)} sub="So far this month" hero />
        <Stat label={`Earned in ${month}`} value={naira(d.month_revenue)} sub="Sales invoiced" />
        <Stat label={`Costs in ${month}`} value={naira(d.month_costs)} sub="Animals, stock used, expenses, wages" />
        <Stat label="Money you have" value={naira(d.cash)} sub={d.loans?.owed ? `${naira(d.loans.owed)} of it is owed on loans` : d.accounts.length ? `${d.accounts.length} account${d.accounts.length > 1 ? "s" : ""}` : "Add your accounts"} />
      </div>
      <div className="mb-4 overflow-x-auto">
        <Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "expenses", label: "Expenses" }, { value: "profit", label: "Profit" },
          { value: "payback", label: "Payback" }, { value: "cash", label: "Cash and bank" }, { value: "loans", label: "Loans" }, { value: "payroll", label: "Payroll" }]} />
      </div>
      {tab === "overview" && !!d.rent_due?.length && <div className="mb-4"><RentDueCard rent={d.rent_due} /></div>}
      {tab === "overview" && d.loans && d.loans.loans > 0 && <div className="mb-4"><LoansCard loans={d.loans} onOpen={() => setTab("loans")} /></div>}
      {tab === "overview" && <div className="mb-4"><PaybackCard onOpen={() => setTab("payback")} /></div>}
      {tab === "overview" && <OverviewPanel onAddAccount={() => setAddingAccount(true)} />}
      {tab === "expenses" && <ExpensesPanel />}
      {tab === "profit" && <ProfitPanel />}
      {tab === "cash" && <CashPanel onMoneyIn={() => setMoneyIn(true)} />}
      {tab === "loans" && <LoansPanel />}
      {tab === "payback" && <PaybackPanel />}
      {tab === "payroll" && <PayrollPanel />}
      <ExpenseDialog open={spending} onClose={() => setSpending(false)} />
      <AccountDialog open={addingAccount} onClose={() => setAddingAccount(false)} />
      <MoneyInDialog open={moneyIn} onClose={() => setMoneyIn(false)} onLoan={() => setLoan(true)} />
      <LoanDialog open={loan} onClose={() => setLoan(false)} />
    </>
  );
}
