import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "@/lib/api";
import type { Organization, WorkspaceDetail } from "@/lib/types";

export const wsKey = (orgId: string) => ["workspace", orgId];

export const useWorkspace = (orgId: string) =>
  useQuery({ queryKey: wsKey(orgId), queryFn: () => get<WorkspaceDetail>(`/organizations/${orgId}`), retry: false });

export function useCreateWorkspace() {
  return useMutation({
    mutationFn: (body: { name: string; type: string; state?: string; lga?: string; phone?: string }) =>
      post<WorkspaceDetail>("/organizations", body),
  });
}

export function useUpdateWorkspace(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<Organization, "name" | "state" | "lga" | "phone">>) =>
      patch<Organization>(`/organizations/${orgId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(orgId) }),
  });
}

const LAST = "oko-last-workspace";
export const rememberWorkspace = (id: string) => { try { localStorage.setItem(LAST, id); } catch {} };
export const lastWorkspace = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
