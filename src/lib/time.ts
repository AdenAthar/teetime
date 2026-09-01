// Small time helpers shared by the simulator and UI.
// Tee times are stored as absolute timestamps; "day" comparisons use the local
// server day. Good enough for a demo (real Noteefy keys off course timezone).

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
  c.setHours(0, 0, 0, 0);
  return c;
}

export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function combineDayAndMinutes(day: Date, minutes: number): Date {
  const c = dateAtMidnight(day);
  c.setMinutes(minutes);
  return c;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function isoDate(d: Date): string {
  return dateAtMidnight(d).toISOString().slice(0, 10);
}
