import { clsx } from "@/lib/clsx";

/**
 * teetime mark — an alert bell whose handle is a golf flagstick + pennant.
 * Keeps the "you'll be notified" read of a bell, adds the golf cue.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={clsx("h-7 w-7 text-crimson", className)}
      aria-hidden="true"
    >
      {/* flagstick */}
      <path
        d="M16 10.5V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* pennant */}
      <path d="M16 3.2L23.5 5.4L16 7.6V3.2Z" fill="currentColor" />
      {/* bell body */}
      <path
        d="M8.2 21.2c0-7.2 3-10.8 7.8-10.8s7.8 3.6 7.8 10.8l1.7 2.2a1 1 0 0 1-.8 1.6H7.3a1 1 0 0 1-.8-1.6l1.7-2.2Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* clapper */}
      <circle cx="16" cy="27.4" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  wordClassName,
  tone = "crimson",
}: {
  className?: string;
  wordClassName?: string;
  tone?: "crimson" | "dark" | "white";
}) {
  const word =
    tone === "white"
      ? "text-white"
      : tone === "dark"
        ? "text-foreground"
        : "text-crimson";
  const mark = tone === "white" ? "text-white" : "text-crimson";
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark className={mark} />
      <span
        className={clsx(
          "font-display font-semibold tracking-tight text-[1.35rem] leading-none",
          word,
          wordClassName,
        )}
      >
        teetime
      </span>
    </span>
  );
}
