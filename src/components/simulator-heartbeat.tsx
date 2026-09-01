"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While someone has the searches page open, quietly crank the simulator so tee
 * times actually open up and their search gets matched during the visit. Backs
 * up (or replaces) an external cron on the public deploy.
 */
export function SimulatorHeartbeat({ everyMs = 20_000, maxTicks = 30 }) {
  const router = useRouter();

  useEffect(() => {
    let n = 0;
    let stopped = false;

    async function beat() {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch("/api/tick", { method: "POST" });
        const j = await res.json().catch(() => null);
        if (j?.notifications > 0) router.refresh();
      } catch {
        /* ignore */
      }
    }

    const id = setInterval(() => {
      if (++n > maxTicks) {
        clearInterval(id);
        stopped = true;
        return;
      }
      void beat();
    }, everyMs);

    const t = setTimeout(beat, 2000); // one soon after load
    return () => {
      stopped = true;
      clearInterval(id);
      clearTimeout(t);
    };
  }, [everyMs, maxTicks, router]);

  return null;
}
