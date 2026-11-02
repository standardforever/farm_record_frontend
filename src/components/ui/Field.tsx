import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

const control =
  "w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-60 aria-[invalid=true]:border-crit";

export function Field({ label, hint, error, htmlFor, children, className }: {
  label: string; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-ink-2">{label}</label>
      {children}
      {error ? <p className="text-[12.5px] text-crit" role="alert">{error}</p> : hint ? <p className="text-[12.5px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn(control, "pr-8", className)} {...p}>{children}</select>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-20 resize-y", className)} {...p} />;
});

export function Toggle({ checked, onChange, label, disabled, showLabel }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; /** Write the label next to the switch. */ showLabel?: boolean;
}) {
  if (showLabel) {
    return (
      <div className="flex items-start gap-3">
        <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
        <span className="cursor-pointer text-[14px] leading-6" onClick={() => !disabled && onChange(!checked)}>{label}</span>
      </div>
    );
  }
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 cursor-pointer", checked ? "bg-brand" : "bg-surface-3")}
    >
      <span className={cn("absolute top-[3px] h-[18px] w-[18px] rounded-full bg-surface shadow transition-all", checked ? "left-[19px]" : "left-[3px]")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, disabled, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; description?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 py-1.5", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--brand)]" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 text-[13.5px]"><span className="font-semibold">{label}</span>
        {description && <span className="block text-[12.5px] text-ink-3">{description}</span>}</span>
    </label>
  );
}
