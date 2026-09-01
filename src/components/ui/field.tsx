"use client";

import { useId } from "react";
import { clsx } from "@/lib/clsx";

/** Material-style outlined field with a notched floating label. */
export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  disabled,
  optional,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        placeholder={placeholder ?? " "}
        autoComplete={autoComplete}
        className={clsx(
          "peer w-full rounded-md border border-border bg-surface px-3 pt-5 pb-2 text-[15px] text-foreground outline-none",
          "focus:border-blue focus:ring-1 focus:ring-blue",
          "disabled:bg-background disabled:text-muted",
        )}
      />
      <label
        htmlFor={id}
        className={clsx(
          "pointer-events-none absolute left-2.5 top-1.5 bg-surface px-1 text-[11px] text-muted transition-all",
          "peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[15px]",
          "peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-blue",
          "peer-disabled:bg-transparent",
        )}
      >
        {label}
        {required ? " *" : optional ? " (optional)" : ""}
      </label>
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  disabled,
  optional,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
  disabled?: boolean;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="w-full appearance-none rounded-md border border-border bg-surface px-3 pt-5 pb-2 text-[15px] text-foreground outline-none focus:border-blue focus:ring-1 focus:ring-blue disabled:bg-background disabled:text-muted"
      >
        <option value="" disabled hidden />
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-2.5 top-1.5 bg-surface px-1 text-[11px] text-muted"
      >
        {label}
        {optional ? " (optional)" : ""}
      </label>
      <span className="pointer-events-none absolute right-3 top-4 text-muted">▾</span>
    </div>
  );
}
