"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import type { StartSize } from "./api";

/** Age at arrival, picked as a size where the species pack has them ("Juveniles, about 20 g"), or typed in days. */
export function StartSizeField({ id, sizes, age, onChange, daysHint }: {
  id: string; sizes: StartSize[] | undefined; age: string;
  onChange: (age: string, size: StartSize | null) => void; daysHint?: string;
}) {
  const match = sizes?.find((s) => String(s.age_days) === (age || "0"));
  const [days, setDays] = useState(false);
  if (!sizes?.length) {
    return <Field label="Age when they arrive (days)" htmlFor={id} hint={daysHint}>
      <Input id={id} inputMode="numeric" value={age} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""), null)} placeholder="0" /></Field>;
  }
  const typing = days || (!match && age !== "");
  return (
    <Field label="Size when they arrive" htmlFor={id} hint={typing ? "Age in days on the guide's growth curve (day 0 is the smallest size)" : match?.note ?? undefined}>
      <div className="flex gap-2">
        <Select id={id} value={typing ? "days" : match?.key ?? sizes[0].key} onChange={(e) => {
          const s = sizes.find((x) => x.key === e.target.value);
          setDays(!s);
          if (s) onChange(String(s.age_days), s);
        }}>
          {sizes.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          <option value="days">Enter days instead</option>
        </Select>
        {typing && <div className="w-24 shrink-0"><Input aria-label="Age in days" inputMode="numeric" value={age}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""), null)} /></div>}
      </div>
    </Field>
  );
}
