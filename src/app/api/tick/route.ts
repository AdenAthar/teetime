import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tick, ensureSheetsForWatchedCourses } from "@/lib/simulator/engine";
import { TEE_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Crank the tee-sheet simulator once. Called by the client heartbeat on the
 * searches page, by "Run simulator once" on /dev/outbox, and by an external cron
 * (cron-job.org / GitHub Actions) in production.
 *
 * If CRON_SECRET is set, require ?key=<secret> or an Authorization: Bearer header.
 */
/** Parse an env var to int, ignoring missing OR empty-string values. */
function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("key") === secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureSheetsForWatchedCourses(db);
  const result = await tick(db, {
    cancels: envInt("SIM_TICK_CANCELS", 4),
    rebookings: envInt("SIM_TICK_BOOKINGS", 5),
  });
  return NextResponse.json({ ok: true, ...result });
}

// GET is convenient for cron services that only do GET, and for a status peek.
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has("run")) return POST(request);
  const [open, booked, notifs] = await Promise.all([
    db.teeTime.count({ where: { status: TEE_STATUS.OPEN } }),
    db.teeTime.count({ where: { status: TEE_STATUS.BOOKED } }),
    db.notification.count(),
  ]);
  return NextResponse.json({ open, booked, notifications: notifs });
}
