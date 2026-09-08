import type { PrismaClient } from "@prisma/client";
import {
  SEARCH_STATUS,
  TEE_STATUS,
  BOOKING_PROVIDERS,
  CONFIRM_STATUS,
  CONFIRM_ASK_MIN_HOURS,
  CONFIRM_ASK_MAX_HOURS,
  CONFIRM_AUTO_RELEASE_WITHIN_HOURS,
  SIM_OPEN_FLOOR_FRACTION,
  SEARCH_REARM_COOLDOWN_MS,
  NOTIFICATION_DEDUPE_MS,
} from "@/lib/constants";
import {
  DAY_START_MIN,
  DAY_END_MIN,
  SLOT_INTERVAL_MIN,
  combineDayAndMinutes,
  dateAtMidnight,
  minutesFromMidnight,
  sameUtcDay,
} from "@/lib/time";
import { sendAlert, sendConfirmationRequest } from "@/lib/notify";
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
  confirmationsSent: number;
  rearmed: number;
};

/**
 * One simulator crank:
 *  - expire dead searches; re-arm recently-matched ones so alerts keep coming
 *  - flip some BOOKED future slots -> OPEN (cancellations), then run the matcher
 *  - flip some OPEN future slots -> BOOKED (someone else grabbed it), but never
 *    below SIM_OPEN_FLOOR_FRACTION of the sheet — so availability churns around
 *    an equilibrium instead of draining to zero
 */
export async function tick(
  db: PrismaClient,
  cfg: { cancels: number; rebookings: number } = { cancels: 4, rebookings: 5 }
): Promise<TickResult> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86_400_000);
  const res: TickResult = {
    cancellations: 0,
    rebookings: 0,
    matches: 0,
    notifications: 0,
    confirmationsSent: 0,
    rearmed: 0,
  };

  // --- Confirm: pre-round nudges + auto-release of unanswered bookings ---
  // Runs first so a booking that's about to be auto-released still gets a
  // chance to be picked up by the same tick's Waitlist matching below.
  res.confirmationsSent += await sendConfirmationRequests(db, now);
  const released = await autoReleaseUnconfirmedBookings(db, now);
  res.cancellations += released.released;
  res.matches += released.matches;
  res.notifications += released.notifications;

  // --- search housekeeping: expire the dead, re-arm the recently matched ---
  const todayStart = dateAtMidnight(now);
  const nowMin = minutesFromMidnight(now);
  // Dead = the watched day is past, or it's today and the window has ended.
  await db.search.updateMany({
    where: {
      status: { in: [SEARCH_STATUS.ACTIVE, SEARCH_STATUS.MATCHED] },
      OR: [
        { date: { lt: todayStart } },
        { date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86_400_000) }, endMin: { lte: nowMin } },
      ],
    },
    data: { status: SEARCH_STATUS.EXPIRED },
  });
  // A MATCHED search whose day is still ahead goes back to ACTIVE after a short
  // cooldown, so it can match again on a *new* slot (per-slot dedup in
  // runMatcher prevents re-alerting the same one).
  const rearm = await db.search.updateMany({
    where: {
      status: SEARCH_STATUS.MATCHED,
      date: { gte: todayStart },
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(now.getTime() - SEARCH_REARM_COOLDOWN_MS) } },
      ],
    },
    data: { status: SEARCH_STATUS.ACTIVE },
  });
  res.rearmed += rearm.count;

  // --- cancellations ---
  // `bookedByUserId: null` everywhere in the churn steps: the simulator models
  // *ambient* course activity and must not touch a real golfer's booking (those
  // are handled by the Confirm steps above / the golfer's own actions).
  const booked = await db.teeTime.findMany({
    where: {
      status: TEE_STATUS.BOOKED,
      bookedByUserId: null,
      teeAt: { gt: new Date(now.getTime() + 3_600_000), lt: horizon },
    },
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
    // Skip slots this search was recently alerted about — otherwise the matcher's
    // per-slot dedup would make the opened slot produce no new alert.
    const seen = await db.notification.findMany({
      where: {
        searchId: search.id,
        sentAt: { gt: new Date(now.getTime() - NOTIFICATION_DEDUPE_MS) },
      },
      select: { teeTimeId: true },
    });
    const slot = await db.teeTime.findFirst({
      where: {
        courseId: search.courseId,
        status: TEE_STATUS.BOOKED,
        bookedByUserId: null,
        id: { notIn: seen.map((n) => n.teeTimeId) },
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
  // Capped so we never push a watched sheet below the open-slot floor — without
  // this, rebookings (5) > cancellations (4) drains every sheet to zero over a
  // long-running dev session.
  const futureSlot = { teeAt: { gt: new Date(now.getTime() + 3_600_000), lt: horizon } };
  const [openNow, totalFuture] = await Promise.all([
    db.teeTime.count({ where: { status: TEE_STATUS.OPEN, ...futureSlot } }),
    db.teeTime.count({ where: futureSlot }),
  ]);
  const rebookBudget = Math.max(0, openNow - Math.ceil(totalFuture * SIM_OPEN_FLOOR_FRACTION));
  const open = await db.teeTime.findMany({
    where: { status: TEE_STATUS.OPEN, bookedByUserId: null, ...futureSlot },
    take: 400,
    select: { id: true },
  });
  const toRebook = pickRandom(open, Math.min(cfg.rebookings, rebookBudget));
  for (const t of toRebook) {
    await db.teeTime.update({ where: { id: t.id }, data: { status: TEE_STATUS.BOOKED } });
    res.rebookings++;
  }

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
      where: {
        searchId: search.id,
        teeTimeId: teeTime.id,
        sentAt: { gt: new Date(Date.now() - NOTIFICATION_DEDUPE_MS) },
      },
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

/**
 * Confirm: find real bookings (TeeTime rows with a golfer attached via
 * bookedByUserId) inside the 24-48h pre-round window that haven't been asked
 * yet, send the "please confirm" nudge, and mark them awaiting a response.
 */
export async function sendConfirmationRequests(db: PrismaClient, now = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() + CONFIRM_ASK_MIN_HOURS * 3_600_000);
  const windowEnd = new Date(now.getTime() + CONFIRM_ASK_MAX_HOURS * 3_600_000);

  const due = await db.teeTime.findMany({
    where: {
      bookedByUserId: { not: null },
      confirmStatus: CONFIRM_STATUS.PENDING,
      teeAt: { gte: windowStart, lte: windowEnd },
    },
    include: { course: true, bookedBy: true },
    take: 20,
  });

  let sent = 0;
  for (const t of due) {
    if (!t.bookedBy) continue;
    const token = globalThis.crypto.randomUUID();
    // Guard on PENDING so two concurrent ticks can't both mint a token / send
    // two nudges for the same booking.
    const claimed = await db.teeTime.updateMany({
      where: { id: t.id, confirmStatus: CONFIRM_STATUS.PENDING },
      data: {
        confirmStatus: CONFIRM_STATUS.AWAITING_CONFIRMATION,
        confirmToken: token,
        confirmRequestedAt: now,
      },
    });
    if (claimed.count === 0) continue;
    await sendConfirmationRequest(db, { teeTime: t, user: t.bookedBy, token });
    sent++;
  }
  return sent;
}

/**
 * Confirm: a booking that never got a response and is now within a few hours
 * of tee-off is auto-released — same as an explicit cancel, just golfer-silent.
 * The freed slot immediately feeds the existing Waitlist matcher.
 */
export async function autoReleaseUnconfirmedBookings(db: PrismaClient, now = new Date()) {
  const deadline = new Date(now.getTime() + CONFIRM_AUTO_RELEASE_WITHIN_HOURS * 3_600_000);

  const stale = await db.teeTime.findMany({
    where: {
      confirmStatus: CONFIRM_STATUS.AWAITING_CONFIRMATION,
      teeAt: { gt: now, lte: deadline },
    },
    include: { course: true },
    take: 20,
  });

  let released = 0;
  let matches = 0;
  let notifications = 0;
  for (const t of stale) {
    // Guard on AWAITING_CONFIRMATION: if the golfer just confirmed/cancelled, or
    // another tick already released it, count 0 and skip. Clears the holder too.
    const claimed = await db.teeTime.updateMany({
      where: { id: t.id, confirmStatus: CONFIRM_STATUS.AWAITING_CONFIRMATION },
      data: { status: TEE_STATUS.OPEN, confirmStatus: CONFIRM_STATUS.CANCELED, bookedByUserId: null },
    });
    if (claimed.count === 0) continue;
    released++;
    // `t` already carries `course`; release doesn't change any match-relevant field.
    const m = await runMatcher(db, t);
    matches += m.matches;
    notifications += m.notifications;
  }
  return { released, matches, notifications };
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
