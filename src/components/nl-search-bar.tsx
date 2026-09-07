"use client";

import { useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { createSearch, parseSearchFromPrompt } from "@/lib/searches/actions";
import { minutesToLabel } from "@/lib/time";
import type { SearchDraft } from "@/lib/ai/parse-search";

const EXAMPLES = [
  "Saturday morning foursome at Bethpage Black",
  "9 holes in Arizona this week, afternoons",
  "twilight tee time for 2 at Torrey Pines next weekend",
];

function timeOptions() {
  const out: { value: number; label: string }[] = [];
  for (let m = 5 * 60; m <= 19 * 60; m += 30) out.push({ value: m, label: minutesToLabel(m) });
  return out;
}

export function NlSearchBar({ signedIn }: { signedIn: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [result, setResult] = useState<{ drafts: SearchDraft[]; note: string } | null>(null);

  function run(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setError(null);
    setNeedsAuth(false);
    start(async () => {
      const res = await parseSearchFromPrompt(q);
      if (res.ok) {
        setResult({ drafts: res.drafts, note: res.note });
      } else {
        setResult(null);
        setError(res.error);
        setNeedsAuth("needsAuth" in res && Boolean(res.needsAuth));
      }
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-crimson-tint px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-crimson-dark">
          Beta
        </span>
        <h2 className="text-sm font-semibold text-foreground">Describe your ideal tee time</h2>
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(prompt);
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Saturday morning foursome at Bethpage Black"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-crimson"
          maxLength={300}
        />
        <button
          disabled={pending || !prompt.trim()}
          className="shrink-0 rounded-full bg-crimson px-5 py-2 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
        >
          {pending ? "Reading…" : "Find tee times"}
        </button>
      </form>

      {!result && !error && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setPrompt(ex);
                run(ex);
              }}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-crimson hover:text-crimson"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-crimson">
          {error}{" "}
          {needsAuth && (
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>
          )}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            {result.note}{" "}
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPrompt("");
              }}
              className="font-medium text-crimson underline"
            >
              start over
            </button>
          </p>
          {result.drafts.map((d, i) => (
            <DraftCard key={`${d.courseId}-${d.date}-${i}`} draft={d} signedIn={signedIn} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, signedIn }: { draft: SearchDraft; signedIn: boolean }) {
  const [state, action, pending] = useActionState(createSearch, { ok: false });
  const times = useMemo(() => timeOptions(), []);
  const today = new Date();
  const minDate = today.toISOString().slice(0, 10);
  const maxDate = new Date(today.getTime() + 13 * 86_400_000).toISOString().slice(0, 10);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
        <span className="font-medium text-green-800">✓ Watching {draft.courseName}</span>{" "}
        <Link href="/searches" className="text-green-800 underline">
          My Searches
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-border p-4">
      <input type="hidden" name="courseId" value={draft.courseId} />
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{draft.courseName}</p>
        <p className="text-xs text-muted">{draft.region}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Date</span>
          <input
            type="date"
            name="date"
            required
            min={minDate}
            max={maxDate}
            defaultValue={draft.date}
            className="w-full rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Earliest</span>
          <select name="startMin" defaultValue={draft.startMin} className="w-full rounded-md border px-2 py-1.5">
            {times.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Latest</span>
          <select name="endMin" defaultValue={draft.endMin} className="w-full rounded-md border px-2 py-1.5">
            {times.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Players</span>
          <select name="players" defaultValue={draft.players} className="w-full rounded-md border px-2 py-1.5">
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Holes</span>
          <select name="holes" defaultValue={draft.holes} className="w-full rounded-md border px-2 py-1.5">
            <option value={18}>18</option>
            <option value={9}>9</option>
          </select>
        </label>
      </div>

      {!signedIn && (
        <p className="mt-3 rounded-md bg-crimson-tint px-3 py-2 text-xs text-crimson-dark">
          You&apos;ll be asked to log in to save this search.
        </p>
      )}
      {state.error && <p className="mt-2 text-sm text-crimson">{state.error}</p>}
      {state.needsAuth && (
        <p className="mt-2 text-sm text-crimson">
          <Link href="/login" className="font-medium underline">Log in</Link> to save this search.
        </p>
      )}

      <button
        disabled={pending}
        className="mt-3 rounded-full bg-crimson px-4 py-2 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create this search"}
      </button>
    </form>
  );
}
