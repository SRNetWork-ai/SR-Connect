"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** نشانگر کنار برچسب — مثل وضعیت در دسترس بودن سرور. */
  status?: ReactNode;
  required?: boolean;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, status, className, required, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="flex items-center gap-1 text-xs font-bold text-t3 uppercase"
      >
        {label}
        {required && <span className="text-danger">*</span>}
        {error && <span className="font-medium normal-case text-danger">— {error}</span>}
        {status && <span className="ms-auto normal-case">{status}</span>}
      </label>

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 w-full rounded-[3px] bg-[#1e1f22] px-3 text-base text-t1",
            "border border-transparent outline-none placeholder:text-t5",
            "transition-colors focus:border-brand",
            error && "border-danger focus:border-danger",
            className,
          )}
          {...rest}
        />
      </div>

      {hint && <p className="text-xs text-t4">{hint}</p>}
    </div>
  );
});
