"use client";

import dynamic from "next/dynamic";
import type { CoursePin } from "@/lib/courses";

const MapInner = dynamic(() => import("./course-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[460px] w-full place-items-center rounded-[14px] bg-gray-200 text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function CourseMap({
  pins,
  focus,
}: {
  pins: CoursePin[];
  focus?: { lat: number; lng: number } | null;
}) {
  return <MapInner pins={pins} focus={focus} />;
}
