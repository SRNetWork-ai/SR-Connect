"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "brand" | "neutral" | "ghost" | "danger" | "success" | "link";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  brand: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover/90",
  neutral: "bg-card text-t1 hover:bg-[#42454d] active:bg-[#4a4d55]",
  ghost: "bg-transparent text-t3 hover:bg-hover hover:text-t1",
  danger: "bg-danger text-white hover:bg-[#d8353a]",
  success: "bg-success text-white hover:bg-[#1f9450]",
  link: "bg-transparent text-link hover:underline px-0",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-[4px]",
  md: "h-10 px-4 text-sm rounded-[4px]",
  lg: "h-11 px-5 text-base rounded-[4px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "brand", size = "md", block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap",
        "transition-[background-color,opacity,transform] duration-150 active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
      )}
      {children}
    </button>
  );
});
