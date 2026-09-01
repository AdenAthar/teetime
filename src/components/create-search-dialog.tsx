"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSearch } from "@/lib/searches/actions";
import { minutesToLabel } from "@/lib/time";
import { clsx } from "@/lib/clsx";
import type { CoursePin } from "@/lib/courses";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function timeOptions() {
  const out: { value: number; label: string }[] = [];
  for (let m = 5 * 60; m <= 19 * 60; m += 30) out.push({ value: m, label: minutesToLabel(m) });
  return out;
}

export function CreateSearchDialog({
  course,
  signedIn,
  onClose,
}: {
  course: CoursePin;
  signedIn: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createSearch, { ok: false });
  const times = useMemo(() => timeOptions(), []);
  const [recurring, setRecurring] = useState(false);
  const [days, setDays] = useState<number[]>([]);

  const today = new Date();
  const minDate = today.toISOString().slice(0, 10);
  const maxDate = new Date(today.getTime() + 13 * 86_400_000).toISOString().slice(0, 10);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="tt-fade-in w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-crimson px-5 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/80">Set a teetime search</p>
            <h2 className="text-lg font-semibold leading-tight">{course.name}</h2>
            <p className="text-xs text-white/80">{course.region}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white/90 hover:text-white">
            ✕
          </button>
        </div>

        {state.ok ? (
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>
            <p className="font-medium">Search created.</p>
            <p className="mt-1 text-sm text-muted">
              We&apos;re watching {course.name}. You&apos;ll get an alert the moment a matching
              tee time opens up.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/searches"
                className="rounded-full bg-crimson px-4 py-2 text-sm font-medium text-white hover:bg-crimson-dark"
              >
                View My Searches
              </Link>
              <button onClick={onClose} className="rounded-full border px-4 py-2 text-sm">
                Done
              </button>
            </div>
          </div>
        ) : state.needsAuth ? (
          <div className="p-6 text-center">
            <p className="font-medium">Log in to create a search</p>
            <p className="mt-1 text-sm text-muted">
              You need a teetime account so we know where to send your alerts.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-full bg-crimson px-5 py-2 text-sm font-medium text-white hover:bg-crimson-dark"
            >
              Log in / Sign up
            </Link>
          </div>
        ) : (
          <form action={action} className="space-y-4 p-5">
            <input type="hidden" name="courseId" value={course.id} />

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Date</span>
              <input
                type="date"
                name="date"
                required
                min={minDate}
                max={maxDate}
                defaultValue={minDate}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-crimson"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="mb-1 block font-medium">Earliest</span>
                <select name="startMin" defaultValue={7 * 60} className="w-full rounded-md border px-2 py-2">
                  {times.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Latest</span>
                <select name="endMin" defaultValue={11 * 60} className="w-full rounded-md border px-2 py-2">
                  {times.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="mb-1 block font-medium">Players</span>
                <select name="players" defaultValue={2} className="w-full rounded-md border px-2 py-2">
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Holes</span>
                <select name="holes" defaultValue={18} className="w-full rounded-md border px-2 py-2">
                  <option value={18}>18</option>
                  <option value={9}>9</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="recurring"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              <span className="font-medium">Make this a recurring weekly search</span>
            </label>

            {recurring && (
              <div className="flex gap-1">
                {DOW.map((d, i) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() =>
                      setDays((cur) =>
                        cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i],
                      )
                    }
                    className={clsx(
                      "h-8 w-8 rounded-full border text-xs font-medium",
                      days.includes(i)
                        ? "border-crimson bg-crimson text-white"
                        : "border-border text-muted",
                    )}
                  >
                    {d}
                  </button>
                ))}
                {days.map((d) => (
                  <input key={d} type="hidden" name="daysOfWeek" value={d} />
                ))}
              </div>
            )}

            {!signedIn && (
              <p className="rounded-md bg-crimson-tint px-3 py-2 text-xs text-crimson-dark">
                You&apos;ll be asked to log in to save this search.
              </p>
            )}
            {state.error && <p className="text-sm text-crimson">{state.error}</p>}

            <button
              disabled={pending}
              className="w-full rounded-full bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create search"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
