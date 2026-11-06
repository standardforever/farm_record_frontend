"use client";

import { Alert } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";
import { useAccounts } from "./api";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

/**
 * An account counts money from its start date; anything dated before is taken as already inside its opening
 * balance and does not move the balance. Say so wherever money in or out is dated, so nobody wonders where it went.
 */
export function AccountStartNote({ accountId, on, flow, what }: { accountId: string | null | undefined; on: string | null | undefined; flow: "in" | "out"; what?: string }) {
  const ws = useCurrentWorkspace();
  const acc = useAccounts(ws.orgId, !!accountId).data?.find((a) => a.id === accountId);
  if (!acc || !on || on >= acc.opening_on) return null;
  return (
    <Alert tone="warn" title={`${acc.name} starts counting on ${day(acc.opening_on)}`}>
      {flow === "out"
        ? <>A payment dated {day(on)} is before that, so it is taken as already in the opening balance and the balance will not go down. If it was paid on or after {day(acc.opening_on)}, put the day it was paid.</>
        : <>{what ?? "This money"} came in before that, so it is taken as already in the opening balance and the balance will not go up again.{what === "The loan" ? " What you owe is still kept." : ""}</>}
    </Alert>
  );
}
