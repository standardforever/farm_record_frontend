"use client";

import { useCurrentWorkspace } from "@/features/workspaces";
import { type Upcoming, useAnimal } from "./api";
import { BirthDialog, CheckDialog, MateDialog, WeanDialog } from "./Dialogs";

/** What to do about a calendar item, in one tap: loads the animal, then opens the right form. */
export function actionFor(kind: Upcoming["kind"]): { label: string; act: "check" | "birth" | "wean" | "mate" } | null {
  switch (kind) {
    case "check": case "heat": return { label: "Record check", act: "check" };
    case "due": case "overdue": case "prepare": return { label: "Record birth", act: "birth" };
    case "wean": return { label: "Wean", act: "wean" };
    case "ready": return { label: "Record mating", act: "mate" };
  }
}

export function ItemAction({ item, act, onClose }: { item: Upcoming; act: "check" | "birth" | "wean" | "mate"; onClose: () => void }) {
  const ws = useCurrentWorkspace();
  const q = useAnimal(ws.orgId, item.animal_id);
  const a = q.data ?? null;
  const m = a?.matings.find((x) => x.id === item.mating_id) ?? null;
  const ready = !!a && (act === "mate" || !!m);
  return <>
    <MateDialog open={ready && act === "mate"} onClose={onClose} dam={a} />
    <CheckDialog open={ready && act === "check"} onClose={onClose} m={m} dam={a} />
    <BirthDialog open={ready && act === "birth"} onClose={onClose} m={m} dam={a} />
    <WeanDialog open={ready && act === "wean"} onClose={onClose} m={m} dam={a} />
  </>;
}
