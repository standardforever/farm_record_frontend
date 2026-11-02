/**
 * Navigation registry. Each screen registers here once; the sidebar and bottom bar
 * show only what the person's role and plan allow.
 *
 * To add a screen for a new module: add an item with its permission (and feature, if
 * the module is plan-gated). Planned backend modules are added automatically under
 * "Coming next" from GET /api/v1/meta, so the menu always matches the roadmap.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, HeartPulse, Home, KeyRound, Layers, Map, Package, Receipt, ScrollText, Settings, Users, Wallet } from "lucide-react";

/** Workspace types that keep animals and so get the farm screens. */
export const FARM_ORG_TYPES = ["farm", "cooperative", "hatchery", "integrator", "programme"];

export type NavItem = {
  key: string;
  label: string;
  path: string; // relative to /w/[orgId]
  icon: LucideIcon;
  permission?: string;
  feature?: string;
  /** Only for these workspace types (e.g. farm screens are hidden for a vet practice). */
  orgTypes?: string[];
  group: "Overview" | "Farm" | "Workspace";
  mobile?: boolean; // show in the phone bottom bar
};

export const NAV: NavItem[] = [
  { key: "home", label: "Home", path: "", icon: Home, group: "Overview", mobile: true },
  { key: "today", label: "Today", path: "/today", icon: ClipboardCheck, permission: "farm.view", feature: "farm", orgTypes: FARM_ORG_TYPES, group: "Farm", mobile: true },
  { key: "farm", label: "Farm map", path: "/farm", icon: Map, permission: "farm.view", feature: "farm", orgTypes: FARM_ORG_TYPES, group: "Farm", mobile: true },
  { key: "batches", label: "Batches", path: "/batches", icon: Layers, permission: "farm.view", feature: "farm", orgTypes: FARM_ORG_TYPES, group: "Farm", mobile: true },
  { key: "health", label: "Health", path: "/health", icon: HeartPulse, permission: "health.view", feature: "health", orgTypes: FARM_ORG_TYPES, group: "Farm" },
  { key: "stock", label: "Stock", path: "/stock", icon: Package, permission: "inventory.view", feature: "inventory", orgTypes: FARM_ORG_TYPES, group: "Farm" },
  { key: "sales", label: "Sales", path: "/sales", icon: Receipt, permission: "sales.view", feature: "sales", orgTypes: FARM_ORG_TYPES, group: "Farm" },
  { key: "finance", label: "Finance", path: "/finance", icon: Wallet, permission: "finance.view", feature: "finance", orgTypes: FARM_ORG_TYPES, group: "Farm" },
  { key: "team", label: "Team and access", path: "/team", icon: Users, permission: "members.view", group: "Workspace" },
  { key: "roles", label: "Roles", path: "/team/roles", icon: KeyRound, permission: "members.view", group: "Workspace" },
  { key: "audit", label: "Audit trail", path: "/audit", icon: ScrollText, permission: "audit.view", group: "Workspace" },
  { key: "settings", label: "Settings", path: "/settings", icon: Settings, group: "Workspace" },
];

export const PHASE_LABEL: Record<string, string> = {
  "phase-0": "Phase 0", "phase-1": "Phase 1", "phase-2": "Phase 2", "phase-3": "Phase 3", "phase-4": "Phase 4", "phase-5": "Phase 5",
};
