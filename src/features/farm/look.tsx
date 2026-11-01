import type { LucideIcon } from "lucide-react";
import { Bird, Box, Fence, Fish, Hexagon, Rabbit, Warehouse } from "lucide-react";
import type { UnitStatus } from "./api";

export const KIND_ICON: Record<string, LucideIcon> = {
  pond: Fish, tank: Fish, house: Bird, cage_block: Bird, brooder: Bird, pen: Fence, paddock: Fence,
  hutch: Rabbit, hive: Hexagon, store: Warehouse, other: Box,
};
export const kindIcon = (k: string) => KIND_ICON[k] ?? Box;

/** Status colours used on the map tile, the legend and badges. Text is always shown too. */
export const STATUS_LOOK: Record<UnitStatus, { tile: string; dot: string; badge: "neutral" | "good" | "info" | "warn" | "crit" }> = {
  empty: { tile: "border-line bg-surface", dot: "bg-ink-3", badge: "neutral" },
  stocked: { tile: "border-good/50 bg-good-soft", dot: "bg-good", badge: "good" },
  resting: { tile: "border-water/40 bg-water-soft", dot: "bg-water", badge: "info" },
  maintenance: { tile: "border-warn/50 bg-warn-soft", dot: "bg-warn", badge: "warn" },
  quarantine: { tile: "border-crit/50 bg-crit-soft", dot: "bg-crit", badge: "crit" },
};
export const STATUS_ORDER: UnitStatus[] = ["stocked", "empty", "resting", "maintenance", "quarantine"];
