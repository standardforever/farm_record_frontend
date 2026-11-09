"use client";

import { use } from "react";
import { CaseView } from "@/features/health";
import { RequirePermission } from "@/features/workspaces";

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequirePermission permission="health.view"><CaseView id={id} /></RequirePermission>;
}
