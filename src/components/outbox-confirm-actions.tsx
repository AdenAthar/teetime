"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmBooking, cancelBooking } from "@/lib/confirm/actions";

/**
 * Inline Confirm / Cancel for a CONFIRM_REQUEST notification in the Dev Outbox —
 * the same token actions the emailed /confirm/[token] page uses, surfaced here so
 * the whole Waitlist -> book -> confirm loop is clickable in one place.
 */
export function OutboxConfirmActions({
  token,
  status,
}: {
  token: string | null;
  status: string | null;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<string | null>(status);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (state === "CONFIRMED") {
    return <p className="mt-3 text-xs font-semibold text-green-700">✓ Confirmed — see you on the course.</p>;
  }
  if (state === "CANCELED") {
    return <p className="mt-3 text-xs font-semibold text-crimson">Tee time released to other golfers.</p>;
  }
  if (state === "MODIFY_REQUESTED") {
    return <p className="mt-3 text-xs font-semibold text-crimson">Original time released.</p>;
  }
  if (!token || state !== "AWAITING_CONFIRMATION") return null;

  function act(fn: (t: string) => Promise<{ ok: boolean; error?: string }>, next: string) {
    if (!token) return;
    start(async () => {
      setError(null);
      const r = await fn(token);
      if (r.ok) {
        setState(next);
        router.refresh();
      } else {
        setError(r.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => act(confirmBooking, "CONFIRMED")}
        disabled={pending}
        className="rounded-full bg-crimson px-3 py-1.5 text-xs font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
      >
        Confirm
      </button>
      <button
        onClick={() => act(cancelBooking, "CANCELED")}
        disabled={pending}
        className="rounded-full border border-crimson px-3 py-1.5 text-xs font-semibold text-crimson hover:bg-crimson-tint disabled:opacity-60"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-crimson">{error}</span>}
    </div>
  );
}
