"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TickButton() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/tick", { method: "POST" });
      const j = await res.json();
      setLast(
        `+${j.cancellations} cancellations · ${j.confirmationsSent} confirm nudges · ` +
          `${j.matches} matched · ${j.notifications} alerts sent`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-full bg-crimson px-4 py-2 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
      >
        {busy ? "Running…" : "Run simulator once"}
      </button>
      {last && <span className="text-xs text-muted">{last}</span>}
    </div>
  );
}
