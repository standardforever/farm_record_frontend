/** Types that mirror the backend's response models (see /docs on the API). */

export type User = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  language: string;
  platform_role: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  created_at: string;
};

export type WorkspaceSummary = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  organization_type: string;
  plan_code: string;
  role_key: string;
  role_name: string;
  kind: "member" | "guest";
  permissions: string[];
  access_expires_at: string | null;
};

export type Me = { user: User; workspaces: WorkspaceSummary[] };

export type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan_code: string;
  status: string;
  verification_level: string;
  state: string | null;
  lga: string | null;
  phone: string | null;
  settings: Record<string, unknown>;
  created_at: string;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  description: string;
  kind: "member" | "guest";
  is_system: boolean;
  permissions: string[];
};

export type WorkspaceDetail = {
  organization: Organization;
  my_role: Role;
  my_permissions: string[];
  features: string[];
  member_count: number;
  guest_count: number;
  pending_invites: number;
};

export type Member = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  kind: "member" | "guest";
  scope: Record<string, unknown>;
  status: "active" | "suspended";
  access_expires_at: string | null;
  created_at: string;
};

export type Invite = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  kind: string;
  scope: Record<string, unknown>;
  access_expires_at: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  invited_by_name: string | null;
  accept_token?: string;
};

export type InvitePreview = {
  organization_name: string;
  organization_type: string;
  role_name: string;
  role_description: string;
  kind: string;
  full_name: string;
  invited_by_name: string | null;
  status: string;
  expires_at: string;
  access_expires_at: string | null;
};

export type PermissionGroup = {
  module: string;
  name: string;
  status: "live" | "planned";
  phase: string;
  permissions: { key: string; label: string; description: string }[];
};

export type ModuleInfo = {
  key: string;
  name: string;
  phase: string;
  status: "live" | "planned";
  description: string;
  feature: string | null;
};

export type Meta = {
  name: string;
  version: string;
  environment: string;
  modules: ModuleInfo[];
  organization_types: { key: string; label: string }[];
  permissions: PermissionGroup[];
};

export type Plan = {
  code: string;
  name: string;
  description: string;
  price_ngn_monthly: number;
  billing_unit: string;
  features: string[];
  limits: Record<string, number>;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type AuditEvent = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  actor_name: string | null;
  data: Record<string, unknown>;
  created_at: string;
};
