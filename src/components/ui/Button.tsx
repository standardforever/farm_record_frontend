import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/format";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "maize";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand border-brand hover:bg-brand-2 hover:border-brand-2",
  secondary: "bg-surface text-ink border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink",
  danger: "bg-surface text-crit border-line hover:bg-crit-soft",
  maize: "bg-maize text-on-maize border-maize hover:brightness-105",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-[13.5px] rounded-[10px] gap-2",
  lg: "h-12 px-5 text-[15px] rounded-xl gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center border font-semibold whitespace-nowrap transition-colors",
        "disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});
