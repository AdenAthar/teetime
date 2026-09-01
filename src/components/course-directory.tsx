"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/lib/clsx";
import type { CoursePin, RegionGroup } from "@/lib/courses";
import { CreateSearchDialog } from "./create-search-dialog";
import { BellIcon, GlobeIcon } from "./icons";

const PAGE = 8; // regions per page, matches Noteefy's chunked directory feel

export function CourseDirectory({
  groups,
  signedIn,
}: {
  groups: RegionGroup[];
  signedIn: boolean;
}) {
  const [region, setRegion] = useState("All");
  const [page, setPage] = useState(0);
  const [dialogCourse, setDialogCourse] = useState<CoursePin | null>(null);

  const regions = useMemo(() => groups.map((g) => g.region), [groups]);

  const filtered = region === "All" ? groups : groups.filter((g) => g.region === region);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div>
      <div className="relative mb-8 max-w-xs">
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setPage(0);
          }}
          className="w-full appearance-none rounded-md border border-border bg-surface px-3 pt-5 pb-2 text-[15px] outline-none focus:border-crimson focus:ring-1 focus:ring-crimson"
        >
          <option value="All">All</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <label className="pointer-events-none absolute left-2.5 top-1.5 bg-surface px-1 text-[11px] text-muted">
          Select a Location
        </label>
        <span className="pointer-events-none absolute right-3 top-4 text-muted">▾</span>
      </div>

      <div className="space-y-5">
        {shown.map((g) => (
          <section
            key={g.region}
            className="overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <h3 className="px-6 pt-5 text-2xl font-bold tracking-tight text-foreground">
              {g.region}
            </h3>
            <ul className="mt-3 divide-y divide-border">
              {g.courses.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5"
                >
                  <span className="text-[15px] text-foreground">{c.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setDialogCourse(c)}
                      title={`Set an alert for ${c.name}`}
                      className="grid h-9 w-9 place-items-center rounded-full bg-crimson text-white hover:bg-crimson-dark"
                    >
                      <BellIcon className="h-4 w-4" />
                    </button>
                    <a
                      href={c.bookingUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the course booking site"
                      className="grid h-9 w-9 place-items-center rounded-full border border-crimson text-crimson hover:bg-crimson-tint"
                    >
                      <GlobeIcon className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <PagerBtn disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ‹
          </PagerBtn>
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={clsx(
                "h-8 min-w-8 rounded-md border px-2 text-sm",
                i === page ? "border-blue text-blue" : "border-border text-muted",
              )}
            >
              {i + 1}
            </button>
          ))}
          <PagerBtn
            disabled={page === pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </PagerBtn>
        </div>
      )}

      {dialogCourse && (
        <CreateSearchDialog
          course={dialogCourse}
          signedIn={signedIn}
          onClose={() => setDialogCourse(null)}
        />
      )}
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-md border border-border text-sm text-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}
