"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, PageLoader, Segmented } from "@/components/ui";
import { BatchReportView, MonthlyReport, ReportEmailSettings, WeeklyReport } from "@/features/reports";
import { RequirePermission, useCurrentWorkspace } from "@/features/workspaces";

type Tab = "weekly" | "monthly" | "batch" | "email";

export default function ReportsPage() {
  return <RequirePermission permission="reports.view"><Suspense fallback={<PageLoader />}><Inner /></Suspense></RequirePermission>;
}

function Inner() {
  const ws = useCurrentWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const money = ws.has("finance") && ws.can("finance.view");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "weekly");
  const go = (t: Tab) => { setTab(t); router.replace(`/w/${ws.orgId}/reports?tab=${t}`, { scroll: false }); };
  return (
    <>
      <PageHeader eyebrow="Farm" title="Reports" sub="Your records, summed up for a week, a month or a whole batch. Print them, save them as PDF, or have them emailed." />
      <div className="no-print mb-4">
        <Segmented value={tab} onChange={go} options={[{ value: "weekly", label: "Week" }, ...(money ? [{ value: "monthly" as Tab, label: "Money" }] : []),
          { value: "batch", label: "Batch" }, { value: "email", label: "By email" }]} />
      </div>
      {tab === "weekly" && <WeeklyReport initialEnd={params.get("end") ?? undefined} />}
      {tab === "monthly" && money && <MonthlyReport initialMonth={params.get("month") ?? undefined} />}
      {tab === "batch" && <BatchReportView initialId={params.get("batch") ?? undefined} />}
      {tab === "email" && <ReportEmailSettings />}
    </>
  );
}
