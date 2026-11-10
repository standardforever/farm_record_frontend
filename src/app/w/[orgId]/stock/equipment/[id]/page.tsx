"use client";

import { use } from "react";
import { MachineView } from "@/features/inventory";
import { RequirePermission } from "@/features/workspaces";

export default function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequirePermission permission="inventory.view"><MachineView id={id} /></RequirePermission>;
}
