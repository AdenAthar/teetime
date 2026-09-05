// Small time helpers shared by the simulator and UI.
// Tee times are stored as absolute timestamps; "day" and time-of-day math is
// always done in UTC — never the running process's local timezone. Two
// processes computing "midnight" for the same instant must agree regardless
// of which machine/timezone they run in (dev laptop vs. a UTC serverless
// function), or window boundaries silently drift between them.
// (Real per-course timezone is still out of scope — good enough for a demo.)

export const SLOT_INTERVAL_MIN = 10;
export const DAY_START_MIN = 6 * 60; // 06:00
export const DAY_END_MIN = 18 * 60; // 18:00

export function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function dateAtMidnight(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

export function minutesFromMidnight(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function combineDayAndMinutes(day: Date, minutes: number): Date {
  const c = dateAtMidnight(day);
  c.setUTCMinutes(minutes);
  return c;
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function isoDate(d: Date): string {
  return dateAtMidnight(d).toISOString().slice(0, 10);
}
