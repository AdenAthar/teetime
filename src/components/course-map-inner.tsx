"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CoursePin } from "@/lib/courses";

/**
 * Smoothness note: the real Noteefy embeds a Google *My Maps* iframe, which
 * renders its markers on the GPU. Without a (billed) Google key we use Leaflet +
 * OSM tiles. To keep pan/zoom smooth with ~1,000 points we render them as
 * canvas-drawn CircleMarkers (one <canvas>, not 1,000 DOM nodes) and only swap in
 * a detailed bell pin for the course the user has clicked.
 */

const bellIcon = L.divIcon({
  className: "tt-bell-pin",
  html: `<svg width="28" height="34" viewBox="0 0 26 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 29c0 0-9-8.5-9-16A9 9 0 0 1 22 13c0 7.5-9 16-9 16z" fill="#e11d2e" stroke="#fff" stroke-width="1.5"/>
      <path d="M9 13.5c0-3.6 1.6-5.5 4-5.5s4 1.9 4 5.5l.9 1.2a.5.5 0 0 1-.4.8H8.5a.5.5 0 0 1-.4-.8L9 13.5z" fill="#fff"/>
      <circle cx="13" cy="16.4" r="1.1" fill="#fff"/>
    </svg>`,
  iconSize: [28, 34],
  iconAnchor: [14, 33],
  popupAnchor: [0, -30],
});

function Recenter({ focus }: { focus?: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 11, { duration: 0.8 });
  }, [focus, map]);
  return null;
}

export default function CourseMapInner({
  pins,
  focus,
}: {
  pins: CoursePin[];
  focus?: { lat: number; lng: number } | null;
}) {
  const [renderer] = useState(() => L.canvas({ padding: 0.5 }));
  const markers = useMemo(() => pins.slice(0, 1400), [pins]);

  return (
    <MapContainer
      center={[41, -96]}
      zoom={4}
      minZoom={3}
      scrollWheelZoom={false}
      preferCanvas
      className="h-[460px] w-full"
      style={{ borderRadius: 14 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Recenter focus={focus} />

      {markers.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          renderer={renderer}
          radius={5}
          pathOptions={{
            color: "#ffffff",
            weight: 1,
            fillColor: "#e11d2e",
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <strong>{c.name}</strong>
            <br />
            <span style={{ color: "#6b7280" }}>{c.region}</span>
            {c.bookingUrl && (
              <>
                <br />
                <a href={c.bookingUrl} target="_blank" rel="noreferrer">
                  Booking site →
                </a>
              </>
            )}
          </Popup>
        </CircleMarker>
      ))}

      {focus && <Marker position={[focus.lat, focus.lng]} icon={bellIcon} />}
    </MapContainer>
  );
}
