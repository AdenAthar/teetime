"use client";

import { useState, useTransition } from "react";
import { clsx } from "@/lib/clsx";

/** Navy "ON / OFF" pill toggle, matching the account settings look. */
export function Toggle({
  defaultOn,
  onChange,
  disabled,
  label,
}: {
  defaultOn: boolean;
  onChange?: (next: boolean) => Promise<void> | void;
  disabled?: boolean;
  label?: string;
}) {
  const [on, setOn] = useState(defaultOn);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        if (onChange) start(() => void onChange(next));
      }}
      className={clsx(
        "relative inline-flex h-7 w-14 items-center rounded-full px-1 text-[10px] font-bold transition-colors",
        on ? "bg-toggle-on text-white" : "bg-gray-300 text-gray-600",
        (disabled || pending) && "opacity-60",
      )}
    >
      <span className={clsx("absolute", on ? "left-2" : "right-2")}>
        {on ? "ON" : "OFF"}
      </span>
      <span
        className={clsx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-7" : "translate-x-0",
        )}
      />
    </button>
  );
}
