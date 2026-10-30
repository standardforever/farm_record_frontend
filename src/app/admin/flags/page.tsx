"use client";

import { Badge, Card, PageHeader, PageLoader, Toggle, useToast } from "@/components/ui";
import { useFlags, useUpdateFlag } from "@/features/admin/api";
import { ApiError } from "@/lib/api";

export default function Flags() {
  const flags = useFlags();
  const update = useUpdateFlag();
  const toast = useToast();
  return (
    <>
      <PageHeader eyebrow="Oko operations" title="Feature switches" sub="A feature is on for a workspace when its switch is on here and its plan includes it. Use per-workspace overrides for pilots." />
      <Card flush>
        {flags.isLoading ? <PageLoader /> : (
          <ul>
            {flags.data?.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3.5 first:border-0">
                <span className="min-w-[220px] flex-1"><b className="block font-mono text-[13.5px]">{f.key}</b><span className="text-[13px] text-ink-3">{f.description}</span>
                  {f.allowed_states && <span className="mt-1 flex gap-1">{f.allowed_states.map((s) => <Badge key={s}>{s}</Badge>)}</span>}</span>
                <Toggle checked={f.enabled} label={f.key} onChange={async (v) => {
                  try { await update.mutateAsync({ key: f.key, enabled: v }); toast(`${f.key} ${v ? "on" : "off"} for everyone`); } catch (e) { toast((e as ApiError).message, "crit"); }
                }} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
