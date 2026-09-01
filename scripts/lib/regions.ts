// Region -> country + approximate centroid [lat, lng] + bounding jitter (deg).
// Centroids are the fallback when geocoding is unavailable; jitter spreads pins
// across the region so the map reads like the real one.

export type RegionMeta = {
  country: string;
  center: [number, number];
  jitter: number; // +/- degrees applied to lat and lng
};

export const REGIONS: Record<string, RegionMeta> = {
  Alabama: { country: "USA", center: [32.8, -86.8], jitter: 1.6 },
  Alberta: { country: "Canada", center: [53.0, -113.5], jitter: 2.5 },
  Arizona: { country: "USA", center: [34.0, -111.7], jitter: 1.8 },
  Arkansas: { country: "USA", center: [34.8, -92.4], jitter: 1.4 },
  "British Columbia": { country: "Canada", center: [50.0, -120.5], jitter: 3.0 },
  California: { country: "USA", center: [36.8, -119.6], jitter: 3.2 },
  Colorado: { country: "USA", center: [39.2, -105.5], jitter: 1.8 },
  Connecticut: { country: "USA", center: [41.6, -72.7], jitter: 0.6 },
  Delaware: { country: "USA", center: [39.0, -75.5], jitter: 0.4 },
  "Dominican Republic": { country: "Dominican Republic", center: [18.7, -70.2], jitter: 0.8 },
  Florida: { country: "USA", center: [28.4, -81.7], jitter: 2.4 },
  Georgia: { country: "USA", center: [32.9, -83.6], jitter: 1.6 },
  Hawaii: { country: "USA", center: [20.8, -156.3], jitter: 0.9 },
  Idaho: { country: "USA", center: [45.5, -114.6], jitter: 2.0 },
  Illinois: { country: "USA", center: [40.4, -89.2], jitter: 1.8 },
  Indiana: { country: "USA", center: [39.9, -86.3], jitter: 1.4 },
  Iowa: { country: "USA", center: [42.0, -93.5], jitter: 1.4 },
  Japan: { country: "Japan", center: [36.2, 138.3], jitter: 1.5 },
  Kansas: { country: "USA", center: [38.5, -98.0], jitter: 1.8 },
  Kentucky: { country: "USA", center: [37.6, -85.3], jitter: 1.6 },
  Maine: { country: "USA", center: [45.3, -69.2], jitter: 1.4 },
  Manitoba: { country: "Canada", center: [50.5, -98.5], jitter: 2.0 },
  Maryland: { country: "USA", center: [39.1, -76.7], jitter: 0.9 },
  Massachusetts: { country: "USA", center: [42.3, -71.8], jitter: 0.8 },
  Michigan: { country: "USA", center: [44.3, -85.6], jitter: 2.0 },
  Minnesota: { country: "USA", center: [46.0, -94.3], jitter: 2.0 },
  Mississippi: { country: "USA", center: [32.7, -89.7], jitter: 1.4 },
  Missouri: { country: "USA", center: [38.5, -92.5], jitter: 1.6 },
  Montana: { country: "USA", center: [46.9, -110.4], jitter: 2.4 },
  Nebraska: { country: "USA", center: [41.5, -99.8], jitter: 1.8 },
  Nevada: { country: "USA", center: [39.3, -116.6], jitter: 2.2 },
  "New Brunswick": { country: "Canada", center: [46.5, -66.1], jitter: 1.0 },
  "New Hampshire": { country: "USA", center: [43.7, -71.6], jitter: 0.7 },
  "New Jersey": { country: "USA", center: [40.2, -74.7], jitter: 0.8 },
  "New Mexico": { country: "USA", center: [34.4, -106.1], jitter: 1.8 },
  "New York": { country: "USA", center: [42.9, -75.5], jitter: 1.6 },
  "New Zealand": { country: "New Zealand", center: [-41.5, 172.8], jitter: 2.5 },
  "North Carolina": { country: "USA", center: [35.5, -79.4], jitter: 1.8 },
  "North Dakota": { country: "USA", center: [47.4, -100.3], jitter: 1.8 },
  "Nova Scotia": { country: "Canada", center: [45.0, -63.0], jitter: 1.2 },
  Ohio: { country: "USA", center: [40.3, -82.8], jitter: 1.4 },
  Oklahoma: { country: "USA", center: [35.5, -97.5], jitter: 1.8 },
  Ontario: { country: "Canada", center: [44.5, -79.5], jitter: 2.2 },
  Oregon: { country: "USA", center: [43.9, -120.6], jitter: 2.0 },
  Pennsylvania: { country: "USA", center: [40.9, -77.7], jitter: 1.6 },
  "Rhode Island": { country: "USA", center: [41.7, -71.5], jitter: 0.3 },
  Saskatchewan: { country: "Canada", center: [52.5, -106.0], jitter: 2.0 },
  "South Carolina": { country: "USA", center: [33.8, -80.8], jitter: 1.4 },
  "South Dakota": { country: "USA", center: [44.4, -100.2], jitter: 1.8 },
  Tennessee: { country: "USA", center: [35.8, -86.3], jitter: 1.8 },
  Texas: { country: "USA", center: [31.3, -98.5], jitter: 3.0 },
  Utah: { country: "USA", center: [39.3, -111.7], jitter: 1.8 },
  Vermont: { country: "USA", center: [44.0, -72.7], jitter: 0.7 },
  Virginia: { country: "USA", center: [37.6, -78.6], jitter: 1.8 },
  Washington: { country: "USA", center: [47.4, -120.5], jitter: 1.8 },
  Wisconsin: { country: "USA", center: [44.6, -89.7], jitter: 1.8 },
  Wyoming: { country: "USA", center: [43.0, -107.5], jitter: 1.8 },
};

export function regionMeta(region: string): RegionMeta {
  return REGIONS[region] ?? { country: "USA", center: [39.8, -98.6], jitter: 3 };
}

// Deterministic pseudo-random in [-1, 1] from a string seed (so pins don't jump
// between seed runs).
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift a couple rounds
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}
