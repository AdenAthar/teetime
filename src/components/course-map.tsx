"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { CoursePin } from "@/lib/courses";
import { CreateSearchDialog } from "./create-search-dialog";
import { BellIcon } from "./icons";

const MapInner = dynamic(() => import("./course-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-gray-200 text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function CourseMap({ pins, signedIn }: { pins: CoursePin[]; signedIn: boolean }) {
  const [selected, setSelected] = useState<CoursePin | null>(null);
  const [dialogCourse, setDialogCourse] = useState<CoursePin | null>(null);

  const directionsUrl = selected
    ? `https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`
    : "#";

  return (
    <>
      <div className="relative h-[460px] w-full">
        <MapInner pins={pins} selected={selected} onSelect={setSelected} />

        {selected && (
          <>
            {/* red course bar across the top of the map */}
            <div className="tt-fade-in absolute inset-x-0 top-0 z-[600] flex h-12 items-center gap-3 bg-crimson px-3 text-white">
              <button
                onClick={() => setSelected(null)}
                aria-label="Back to all courses"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15"
              >
                ←
              </button>
              <span className="flex-1 truncate text-sm font-semibold">{selected.name}</span>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Directions"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15"
              >
                ➤
              </a>
            </div>

            {/* left detail panel */}
            <div className="tt-fade-in absolute bottom-0 left-0 top-12 z-[600] w-[300px] max-w-[70%] overflow-y-auto border-r border-border bg-surface p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted">name</p>
              <p className="text-[15px] font-medium text-foreground">{selected.name}</p>

              <p className="mt-3 text-[11px] uppercase tracking-wide text-muted">location</p>
              <p className="text-sm text-foreground">
                {selected.region}, {selected.country}
              </p>

              {selected.provider && (
                <>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-muted">booking provider</p>
                  <p className="text-sm text-foreground">{selected.provider}</p>
                </>
              )}

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => setDialogCourse(selected)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-crimson py-2 text-sm font-semibold text-white hover:bg-crimson-dark"
                >
                  <BellIcon className="h-4 w-4" />
                  Set a teetime alert
                </button>
                {selected.bookingUrl && (
                  <a
                    href={selected.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-full border border-crimson py-2 text-center text-sm font-semibold text-crimson hover:bg-crimson-tint"
                  >
                    Course booking site
                  </a>
                )}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-full border border-border py-2 text-center text-sm text-foreground hover:bg-background"
                >
                  Directions
                </a>
              </div>
            </div>
          </>
        )}
      </div>

      {dialogCourse && (
        <CreateSearchDialog
          course={dialogCourse}
          signedIn={signedIn}
          onClose={() => setDialogCourse(null)}
        />
      )}
    </>
  );
}
