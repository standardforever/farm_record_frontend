"use client";

import { use } from "react";
import { TreatmentView } from "@/features/health";
import { RequirePermission } from "@/features/workspaces";

export default function TreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequirePermission permission="health.view"><TreatmentView id={id} /></RequirePermission>;
}
