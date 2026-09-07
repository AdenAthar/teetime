/**
 * Pure date/time math for natural-language search parsing — no DB, no SDK, no
 * `server-only`, so it can be unit-tested directly. All arithmetic is in UTC to
 * match the rest of the app (see time.ts).
 */
import { isoDate } from "@/lib/time";

export const WINDOW_DAYS = 14; // how far ahead a search may watch
export const MAX_DRAFTS = 6; // courses × dates fan-out cap
export const MAX_DAYS = 5; // distinct days from a single date range
export const EARLIEST_MIN = 5 * 60;
export const LATEST_MIN = 19 * 60;

/** Clamp a YYYY-MM-DD string into [today, today + WINDOW_DAYS - 1] (UTC). */
export function clampDate(iso: string, today: Date): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  const max = new Date(today.getTime() + (WINDOW_DAYS - 1) * 86_400_000);
  if (Number.isNaN(d.getTime()) || d < today) return today;
  if (d > max) return max;
  return d;
}

/** Inclusive list of YYYY-MM-DD days between two (possibly reversed) bounds, capped. */
export function expandDays(startIso: string, endIso: string, today: Date): string[] {
  let start = clampDate(startIso, today);
  let end = clampDate(endIso, today);
  if (end < start) [start, end] = [end, start];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime() && out.length < MAX_DAYS; t += 86_400_000) {
    out.push(isoDate(new Date(t)));
  }
  return out;
}

/** Normalise an earliest/latest minute pair into a sane, ordered window. */
export function normalizeWindow(startMin: number, endMin: number): [number, number] {
  let s = Math.min(Math.max(Math.round(startMin), EARLIEST_MIN), LATEST_MIN);
  let e = Math.min(Math.max(Math.round(endMin), EARLIEST_MIN), LATEST_MIN);
  if (e <= s) e = Math.min(s + 120, LATEST_MIN);
  if (e <= s) s = e - 60;
  return [s, e];
}
