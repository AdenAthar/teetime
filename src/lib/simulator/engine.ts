import type { PrismaClient } from "@prisma/client";
import { SEARCH_STATUS, TEE_STATUS, BOOKING_PROVIDERS } from "@/lib/constants";
import {
  DAY_START_MIN,
  DAY_END_MIN,
  SLOT_INTERVAL_MIN,
  combineDayAndMinutes,
  dateAtMidnight,
  minutesFromMidnight,
  sameUtcDay,
} from "@/lib/time";
import { sendAlert } from "@/lib/notify";
import { seededUnit } from "@/lib/rand";

/** Price curve: prime AM and twilight are cheaper-to-pricier by time of day. */
function priceForMinute(min: number, base: number): number {
  const h = min / 60;
  let mult = 1;
  if (h < 8) mult = 1.15; // dawn premium
  else if (h < 12) mult = 1.25; // prime morning
  else if (h < 15) mult = 1.0; // midday
  else mult = 0.7; // twilight
  return Math.round((base * mult) / 100) * 100;
}

/**
 * Ensure a full tee sheet exists for one course on one day.
 * Idempotent: uses createMany with skipDuplicates on (courseId, teeAt).
 */
export async function ensureSheet(
  db: PrismaClient,
  course: { id: string; slug: string },
  day: Date,
  opts: { daysOut: number } = { daysOut: 0 }
) {
  const base = 4500 + Math.floor(Math.abs(seededUnit(course.slug)) * 9000);
  // Further-out days start with more availability; near days are busy.
  const openBias = Math.min(0.55, 0.12 + opts.daysOut * 0.03);

  const rows: {
    courseId: string;
    teeAt: Date;
    players: number;
    priceCents: number;
    holes: number;
    status: string;
  }[] = [];

  for (let min = DAY_START_MIN; min <= DAY_END_MIN; min += SLOT_INTERVAL_MIN) {
    const teeAt = combineDayAndMinutes(day, min);
    const r = seededUnit(`${course.slug}:${teeAt.toISOString()}`);
    const isOpen = (r + 1) / 2 < openBias;
    rows.push({
      courseId: course.id,
      teeAt,
      players: 1 + Math.floor(((seededUnit(`${course.slug}:${min}:p`) + 1) / 2) * 4), // 1-4
      priceCents: priceForMinute(min, base),
      holes: 18,
      status: isOpen ? TEE_STATUS.OPEN : TEE_STATUS.BOOKED,
    });
  }

  await db.teeTime.createMany({ data: rows });
}

async function hasSheet(db: PrismaClient, courseId: string, day: Date) {
  const n = await db.teeTime.count({
    where: { courseId, teeAt: { gte: day, lt: new Date(day.getTime() + 86_400_000) } },
  });
  return n > 0;
}

/**
 * Make sure a course has tee sheets for `day` and a few days on either side.
 * Called lazily when a search is created and on each tick — so the DB only ever
 * holds sheets for courses people are actually watching (keeps it tiny on a
 * hosted Postgres free tier).
 */
export async function ensureSheetsAround(
  db: PrismaClient,
  course: { id: string; slug: string },
  day: Date,
  spread = 1,
) {
  const today = dateAtMidnight(new Date());
  for (let off = -spread; off <= spread; off++) {
    const d = dateAtMidnight(new Date(day.getTime() + off * 86_400_000));
    if (d < today) continue;
    if (await hasSheet(db, course.id, d)) continue;
    const daysOut = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    await ensureSheet(db, course, d, { daysOut });
  }
}

/** Ensure sheets exist for every course with an upcoming active/paused search. */
export async function ensureSheetsForWatchedCourses(db: PrismaClient) {
  const today = dateAtMidnight(new Date());
  const searches = await db.search.findMany({
    where: {
      status: { in: [SEARCH_STATUS.ACTIVE, SEARCH_STATUS.MATCHED] },
      date: { gte: today },
    },
    select: { date: true, course: { select: { id: true, slug: true } } },
    take: 200,
  });
  for (const s of searches) {
    await ensureSheetsAround(db, s.course, dateAtMidnight(s.date), 1);
  }
}

/** Full pre-generation — only used by the local dev seed / `npm run tick` loop. */
export async function ensureAllSheets(db: PrismaClient, daysAhead: number) {
  const courses = await db.course.findMany({ select: { id: true, slug: true } });
  const today = dateAtMidnight(new Date());
  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + d);
    for (const c of courses) {
      if (!(await hasSheet(db, c.id, day))) await ensureSheet(db, c, day, { daysOut: d });
    }
  }
}

type TickResult = {
  cancellations: number;
  rebookings: number;
  matches: number;
  notifications: number;
};

/**
 * One simulator crank:
 *  - flip some BOOKED future slots -> OPEN (cancellations), then run the matcher
 *  - flip some OPEN future slots -> BOOKED (someone else grabbed it)
 *  - expire past searches
 */
export async function tick(
  db: PrismaClient,
  cfg: { cancels: number; rebookings: number } = { cancels: 4, rebookings: 5 }
): Promise<TickResult> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86_400_000);
  const res: TickResult = { cancellations: 0, rebookings: 0, matches: 0, notifications: 0 };

  // --- cancellations ---
  const booked = await db.teeTime.findMany({
    where: { status: TEE_STATUS.BOOKED, teeAt: { gt: new Date(now.getTime() + 3_600_000), lt: horizon } },
    take: 400,
    select: { id: true },
  });
  const toCancel = pickRandom(booked, cfg.cancels);
  for (const t of toCancel) {
    const updated = await db.teeTime.update({
      where: { id: t.id },
      data: {
        status: TEE_STATUS.OPEN,
        players: 1 + Math.floor(Math.random() * 4),
      },
      include: { course: true },
    });
    res.cancellations++;
    const m = await runMatcher(db, updated);
    res.matches += m.matches;
    res.notifications += m.notifications;
  }

  // --- targeted cancellations: make sure active searches actually get hits ---
  // Real Noteefy fires when a watched slot frees up; here we bias the simulation
  // toward opening a slot inside a random active search's window each tick.
  const activeSearches = await db.search.findMany({
    where: { status: SEARCH_STATUS.ACTIVE, date: { gte: dateAtMidnight(now) } },
    take: 25,
  });
  for (const search of pickRandom(activeSearches, Math.min(2, activeSearches.length))) {
    const dayStart = dateAtMidnight(search.date);
    const windowStart = new Date(dayStart.getTime() + search.startMin * 60_000);
    const windowEnd = new Date(dayStart.getTime() + search.endMin * 60_000);
    const slot = await db.teeTime.findFirst({
      where: {
        courseId: search.courseId,
        status: TEE_STATUS.BOOKED,
        teeAt: {
          gte: new Date(Math.max(windowStart.getTime(), now.getTime() + 3_600_000)),
          lte: windowEnd,
        },
      },
      orderBy: { teeAt: "asc" },
    });
    if (!slot) continue;
    const opened = await db.teeTime.update({
      where: { id: slot.id },
      data: { status: TEE_STATUS.OPEN, players: Math.max(search.players, 2) },
      include: { course: true },
    });
    res.cancellations++;
    const m = await runMatcher(db, opened);
    res.matches += m.matches;
    res.notifications += m.notifications;
  }

  // --- rebookings (slots quietly filling back up) ---
  const open = await db.teeTime.findMany({
    where: { status: TEE_STATUS.OPEN, teeAt: { gt: new Date(now.getTime() + 3_600_000), lt: horizon } },
    take: 400,
    select: { id: true },
  });
  const toRebook = pickRandom(open, cfg.rebookings);
  for (const t of toRebook) {
    await db.teeTime.update({ where: { id: t.id }, data: { status: TEE_STATUS.BOOKED } });
    res.rebookings++;
  }

  // --- expire stale searches ---
  await db.search.updateMany({
    where: { status: SEARCH_STATUS.ACTIVE, date: { lt: dateAtMidnight(now) } },
    data: { status: SEARCH_STATUS.EXPIRED },
  });

  return res;
}

/** Match one open tee time against active searches and fire alerts. */
export async function runMatcher(
  db: PrismaClient,
  teeTime: { id: string; courseId: string; teeAt: Date; players: number; priceCents: number; course: { id: string; name: string; region: string; bookingUrl: string | null } }
) {
  const slotMin = minutesFromMidnight(teeTime.teeAt);
  const dayStart = dateAtMidnight(teeTime.teeAt);

  const searches = await db.search.findMany({
    where: {
      courseId: teeTime.courseId,
      status: SEARCH_STATUS.ACTIVE,
      date: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
      startMin: { lte: slotMin },
      endMin: { gte: slotMin },
      players: { lte: teeTime.players },
    },
    include: { user: true },
  });

  let matches = 0;
  let notifications = 0;
  for (const search of searches) {
    if (!sameUtcDay(search.date, teeTime.teeAt)) continue;
    const already = await db.notification.findFirst({
      where: { searchId: search.id, teeTimeId: teeTime.id },
      select: { id: true },
    });
    if (already) continue;

    const sent = await sendAlert(db, { search, user: search.user, teeTime });
    matches++;
    notifications += sent;
    await db.search.update({
      where: { id: search.id },
      data: { status: SEARCH_STATUS.MATCHED, lastCheckedAt: new Date() },
    });
  }
  return { matches, notifications };
}

export function providerForSlug(slug: string): string {
  const i = Math.floor(Math.abs(seededUnit(slug + ":prov")) * BOOKING_PROVIDERS.length);
  return BOOKING_PROVIDERS[Math.min(i, BOOKING_PROVIDERS.length - 1)];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
