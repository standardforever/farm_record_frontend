import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Meta, Plan } from "@/lib/types";

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => get<Meta>("/meta"), staleTime: 3600_000 });
export const usePlans = () => useQuery({ queryKey: ["plans"], queryFn: () => get<Plan[]>("/plans"), staleTime: 3600_000 });
