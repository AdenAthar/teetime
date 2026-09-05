"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { confirmBooking, cancelBooking, modifyBooking } from "@/lib/confirm/actions";

type Result = "confirmed" | "canceled" | "modified" | null;

export function ConfirmActions({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(
    initialStatus === "CONFIRMED"
      ? "confirmed"
      : initialStatus === "MODIFY_REQUESTED"
        ? "modified"
        : initialStatus === "CANCELED"
          ? "canceled"
          : null,
  );

  if (result === "confirmed") {
    return (
      <p className="mt-6 rounded-md bg-green-50 px-3 py-2.5 text-sm text-green-700">
        ✓ You&apos;re confirmed — see you on the course.
      </p>
    );
  }
  if (result === "canceled") {
    return (
      <p className="mt-6 rounded-md bg-crimson-tint px-3 py-2.5 text-sm text-crimson-dark">
        Your tee time has been released. Golfers watching this course are being notified.
      </p>
    );
  }
  if (result === "modified") {
    return (
      <p className="mt-6 rounded-md bg-crimson-tint px-3 py-2.5 text-sm text-crimson-dark">
        Your original time has been released.{" "}
        <Link href="/find" className="underline">
          Set up a new search
        </Link>{" "}
        for a time that works better.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await confirmBooking(token);
            if (r.ok) setResult("confirmed");
            else setError(r.error ?? "Something went wrong.");
          })
        }
        className="w-full rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
      >
        Confirm — I&apos;ll be there
      </button>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await modifyBooking(token);
            if (r.ok) setResult("modified");
            else setError(r.error ?? "Something went wrong.");
          })
        }
        className="w-full rounded-md border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-60"
      >
        Request a different time
      </button>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelBooking(token);
            if (r.ok) setResult("canceled");
            else setError(r.error ?? "Something went wrong.");
          })
        }
        className="w-full rounded-md border border-crimson py-2.5 text-sm font-semibold text-crimson hover:bg-crimson-tint disabled:opacity-60"
      >
        Cancel my tee time
      </button>
      {error && <p className="text-sm text-crimson">{error}</p>}
    </div>
  );
}
