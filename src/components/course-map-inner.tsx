"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CoursePin } from "@/lib/courses";

/**
 * The real Noteefy embeds a Google *My Maps* iframe (GPU-rendered markers).
 * Without a billed Google key we use Leaflet + OSM tiles. To stay smooth with
 * ~1,000 points:
 *   - zoomed out (< 6): every course as a canvas dot (one <canvas>, not 1k DOM nodes)
 *   - zoomed in  (>= 6): only the courses in view, as bell pins, capped at 250
 * Selection is surfaced to the parent, which draws the red course bar + panel.
 */

const DOT_ZOOM = 6;
const MAX_PINS = 250;

function bellIcon(active: boolean) {
  const size = active ? 38 : 28;
  const h = active ? 46 : 34;
  return L.divIcon({
    className: "tt-bell-pin",
    html: `<svg width="${size}" height="${h}" viewBox="0 0 26 30" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 29c0 0-9-8.5-9-16A9 9 0 0 1 22 13c0 7.5-9 16-9 16z" fill="${active ? "#b3121f" : "#e11d2e"}" stroke="#fff" stroke-width="1.5"/>
        <path d="M9 13.5c0-3.6 1.6-5.5 4-5.5s4 1.9 4 5.5l.9 1.2a.5.5 0 0 1-.4.8H8.5a.5.5 0 0 1-.4-.8L9 13.5z" fill="#fff"/>
        <circle cx="13" cy="16.4" r="1.1" fill="#fff"/>
      </svg>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, h - 1],
  });
}

function Markers({
  pins,
  selectedId,
  onSelect,
}: {
  pins: CoursePin[];
  selectedId: string | null;
  onSelect: (c: CoursePin) => void;
}) {
  const [renderer] = useState(() => L.canvas({ padding: 0.5 }));
  const [dots, setDots] = useState(true);
  const [inView, setInView] = useState<CoursePin[]>([]);

  const recompute = useCallback(
    (map: L.Map) => {
      if (map.getZoom() < DOT_ZOOM) {
        setDots(true);
        return;
      }
      setDots(false);
      const b = map.getBounds();
      const hits: CoursePin[] = [];
      for (const p of pins) {
        if (b.contains([p.lat, p.lng])) {
          hits.push(p);
          if (hits.length >= MAX_PINS) break;
        }
      }
      setInView(hits);
    },
    [pins],
  );

  const map = useMapEvents({
    moveend: () => recompute(map),
    zoomend: () => recompute(map),
  });
  useEffect(() => {
    const id = requestAnimationFrame(() => recompute(map));
    return () => cancelAnimationFrame(id);
  }, [recompute, map]);

  if (dots) {
    return (
      <>
        {pins.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            renderer={renderer}
            radius={c.id === selectedId ? 7 : 4}
            pathOptions={{
              color: "#ffffff",
              weight: 1,
              fillColor: c.id === selectedId ? "#b3121f" : "#e11d2e",
              fillOpacity: 0.95,
            }}
            eventHandlers={{ click: () => onSelect(c) }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {inView.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lng]}
          icon={bellIcon(c.id === selectedId)}
          zIndexOffset={c.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(c) }}
        />
      ))}
    </>
  );
}

function FlyTo({ target }: { target: CoursePin | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 11), { duration: 0.7 });
  }, [target, map]);
  return null;
}

function LocateControl() {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (!navigator.geolocation) return;
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.flyTo([pos.coords.latitude, pos.coords.longitude], 10, { duration: 0.8 });
            setBusy(false);
          },
          () => setBusy(false),
          { timeout: 8000 },
        );
      }}
      title="Center on my location"
      className="absolute right-3 top-16 z-[500] grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-lg text-foreground shadow hover:bg-background"
    >
      {busy ? "…" : "◎"}
    </button>
  );
}

/**
 * Plain scroll always scrolls the page — Leaflet's scrollWheelZoom stays off.
 * Ctrl/⌘+scroll zooms the map instead, same convention as Google Maps/Mapbox
 * embeds, and we preventDefault() on that combo so the browser's own
 * page/pinch-zoom doesn't fire while the cursor is over the map. A brief hint
 * appears if you scroll over the map without the modifier.
 */
function CtrlScrollZoom() {
  const map = useMap();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const container = map.getContainer();
    let hintTimer: ReturnType<typeof setTimeout> | null = null;
    let zoomTimer: ReturnType<typeof setTimeout> | null = null;
    let pending = 0;
    let lastPoint: L.Point | null = null;

    function flushZoom() {
      if (pending !== 0 && lastPoint) {
        map.setZoomAround(lastPoint, map.getZoom() + (pending > 0 ? 1 : -1), {
          animate: true,
        });
      }
      pending = 0;
    }

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // cancel the browser's native page/pinch zoom
        pending += e.deltaY < 0 ? 1 : -1;
        lastPoint = map.mouseEventToContainerPoint(e);
        if (zoomTimer) clearTimeout(zoomTimer);
        zoomTimer = setTimeout(flushZoom, 60);
        setHint(false);
      } else {
        setHint(true);
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setHint(false), 1400);
      }
      // anything without the modifier is left alone — it bubbles up and
      // scrolls the page normally, exactly like scrolling over any other element.
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (hintTimer) clearTimeout(hintTimer);
      if (zoomTimer) clearTimeout(zoomTimer);
    };
  }, [map]);

  if (!hint) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[550] grid place-items-center">
      <span className="rounded-md bg-black/75 px-3 py-1.5 text-xs font-medium text-white shadow">
        Use ctrl + scroll to zoom the map
      </span>
    </div>
  );
}

/** Ask for location once on first load; fall back to a US view. */
function InitialLocate() {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 9, { animate: false }),
      () => {},
      { timeout: 6000, maximumAge: 600000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function CourseMapInner({
  pins,
  selected,
  onSelect,
}: {
  pins: CoursePin[];
  selected: CoursePin | null;
  onSelect: (c: CoursePin) => void;
}) {
  const bounded = useMemo(() => pins, [pins]);
  return (
    <MapContainer
      center={[41, -96]}
      zoom={4}
      minZoom={3}
      scrollWheelZoom={false}
      preferCanvas
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <CtrlScrollZoom />
      <InitialLocate />
      <LocateControl />
      <FlyTo target={selected} />
      <Markers pins={bounded} selectedId={selected?.id ?? null} onSelect={onSelect} />
    </MapContainer>
  );
}
