/**
 * Best-effort geocoder for the course list.
 *
 * - Groups rows by physical site (siteKey) so "X - Course A/B" hit one lookup.
 * - Tries OpenStreetMap Nominatim (1 req/sec, User-Agent required).
 * - ALWAYS falls back to region-centroid + deterministic jitter, so the map is
 *   fully populated even offline / rate-limited.
 * - Caches to data/geocache.json; re-running only fetches missing sites.
 *
 * Run: npm run geocode
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseCourses } from "./lib/courses";
import { regionMeta, seededUnit } from "./lib/regions";

type Cache = Record<string, { lat: number; lng: number; source: "osm" | "centroid" }>;

const DATA = join(process.cwd(), "data");
const CACHE_PATH = join(DATA, "geocache.json");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "teetime-dev/0.1 (course map seed; contact: local dev)";
const SLEEP_MS = 1200;
const OFFLINE = process.argv.includes("--offline");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function centroidFor(siteKey: string, region: string) {
  const meta = regionMeta(region);
  const dLat = seededUnit(siteKey + ":lat") * meta.jitter;
  const dLng = seededUnit(siteKey + ":lng") * meta.jitter * 1.3;
  return {
    lat: +(meta.center[0] + dLat).toFixed(5),
    lng: +(meta.center[1] + dLng).toFixed(5),
    source: "centroid" as const,
  };
}

async function osmLookup(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!json.length) return null;
    return { lat: +(+json[0].lat).toFixed(5), lng: +(+json[0].lon).toFixed(5) };
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
  const cache: Cache = existsSync(CACHE_PATH)
    ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
    : {};

  const courses = parseCourses();
  const sites = new Map<string, { region: string; label: string }>();
  for (const c of courses) {
    if (!sites.has(c.siteKey)) {
      sites.set(c.siteKey, { region: c.region, label: c.siteKey.split("|")[0] });
    }
  }

  const missing = [...sites.entries()].filter(([k]) => !cache[k]);
  console.log(
    `${sites.size} sites total, ${cache ? Object.keys(cache).length : 0} cached, ${missing.length} to resolve`
  );

  let osmHits = 0;
  for (let i = 0; i < missing.length; i++) {
    const [siteKey, { region, label }] = missing[i];
    let resolved = null as null | { lat: number; lng: number };
    if (!OFFLINE) {
      const q = `${label} golf course, ${region}`;
      resolved = await osmLookup(q);
      if (resolved) osmHits++;
      await sleep(SLEEP_MS);
    }
    cache[siteKey] = resolved
      ? { ...resolved, source: "osm" }
      : centroidFor(siteKey, region);
    if ((i + 1) % 25 === 0 || i === missing.length - 1) {
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
      console.log(`  ${i + 1}/${missing.length}  (osm hits: ${osmHits})`);
    }
  }

  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
  const bySource = Object.values(cache).reduce(
    (a, v) => ((a[v.source] = (a[v.source] || 0) + 1), a),
    {} as Record<string, number>
  );
  console.log("done:", bySource);
}

main();
