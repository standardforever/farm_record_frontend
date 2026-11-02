"use client";

import { useQuery } from "@tanstack/react-query";
import { useBatchCatalog, useBatches } from "@/features/batches";
import { localDay, useDailyCatalog, useToday } from "@/features/daily";
import { useCatalog, useFarmMap } from "@/features/farm";
import { useHealthCatalog } from "@/features/health";
import { useCurrentWorkspace } from "@/features/workspaces";
import { get } from "@/lib/api";

/**
 * Loads what the day's work needs (lists of units and batches, today's jobs, the choices in each form)
 * whenever the app is open with network, so every form still works after the network goes.
 * Mounted once in the app shell; draws nothing.
 */
export function OfflineWarmup() {
  const ws = useCurrentWorkspace();
  const farm = ws.has("farm") && ws.can("farm.view");
  const stock = farm && ws.has("inventory") && ws.can("inventory.view");
  useFarmMap(ws.orgId, false, farm);
  useBatches(ws.orgId, "active", farm);
  useToday(ws.orgId, localDay(), farm);
  useCatalog(); useDailyCatalog(); useBatchCatalog();
  useHealthCatalog(); // public and small
  useQuery({ queryKey: ["inventory", ws.orgId, "items", "feed"], enabled: stock,
    queryFn: () => get(`/organizations/${ws.orgId}/inventory/items?category=feed`) });
  return null;
}
