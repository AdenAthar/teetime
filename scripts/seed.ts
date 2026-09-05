/**
 * Seed: courses (from data/courses-raw.txt + data/geocache.json), tee sheets for
 * the next SIM_DAYS_AHEAD days, and a demo account with a couple of searches.
 *
 * Run: npm run db:seed   (or npm run db:reset to wipe first)
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseCourses } from "./lib/courses";
import { regionMeta, seededUnit } from "./lib/regions";
import { ensureAllSheets, ensureSheetsAround, providerForSlug } from "../src/lib/simulator/engine";
import { dateAtMidnight } from "../src/lib/time";
import { SEARCH_STATUS, TEE_STATUS, CONFIRM_STATUS } from "../src/lib/constants";

const db = new PrismaClient();
const DAYS_AHEAD = Number(process.env.SIM_DAYS_AHEAD) || 14;

type Geo = Record<string, { lat: number; lng: number; source: string }>;

function loadGeo(): Geo {
  const p = join(process.cwd(), "data", "geocache.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

function centroid(siteKey: string, region: string) {
  const meta = regionMeta(region);
  return {
    lat: +(meta.center[0] + seededUnit(siteKey + ":lat") * meta.jitter).toFixed(5),
    lng: +(meta.center[1] + seededUnit(siteKey + ":lng") * meta.jitter * 1.3).toFixed(5),
  };
}

async function main() {
  const geo = loadGeo();
  const courses = parseCourses();
  console.log(`Seeding ${courses.length} courses…`);

  for (const c of courses) {
    const g = geo[c.siteKey] ?? centroid(c.siteKey, c.region);
    // tiny per-variant offset so stacked courses at one site don't overlap exactly
    const jx = seededUnit(c.slug + ":x") * 0.01;
    const jy = seededUnit(c.slug + ":y") * 0.01;
    await db.course.upsert({
      where: { slug: c.slug },
      create: {
        name: c.name,
        slug: c.slug,
        region: c.region,
        country: c.country,
        lat: g.lat + jy,
        lng: g.lng + jx,
        provider: providerForSlug(c.slug),
        bookingUrl: `https://book.example.com/${c.slug}`,
      },
      update: {
        name: c.name,
        region: c.region,
        country: c.country,
        lat: g.lat + jy,
        lng: g.lng + jx,
      },
    });
  }

  // Tee sheets are generated lazily (on search creation / on tick) so the DB
  // stays small on a hosted free tier. Pass FULL_SHEETS=1 to pre-generate all.
  if (process.env.FULL_SHEETS === "1") {
    console.log(`Pre-generating tee sheets for ${DAYS_AHEAD} days…`);
    await ensureAllSheets(db, DAYS_AHEAD);
  }

  // --- demo user ---
  const demo = await db.user.upsert({
    where: { email: "demo@teetime.app" },
    create: {
      firstName: "Demo",
      lastName: "Golfer",
      email: "demo@teetime.app",
      phone: "+15095551234",
      zip: "99163",
      notifyEmail: true,
      notifyText: true,
    },
    update: {},
  });

  const wa = await db.course.findFirst({ where: { region: "Washington", name: { contains: "Chambers" } } });
  const wa2 = await db.course.findFirst({ where: { region: "Washington", name: { contains: "Newcastle" } } });
  const today = dateAtMidnight(new Date());
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  };

  await db.search.deleteMany({ where: { userId: demo.id } });
  if (wa) await ensureSheetsAround(db, wa, inDays(3), 1);
  if (wa2) await ensureSheetsAround(db, wa2, inDays(6), 1);
  if (wa) {
    await db.search.create({
      data: {
        userId: demo.id,
        courseId: wa.id,
        date: inDays(3),
        startMin: 7 * 60,
        endMin: 10 * 60,
        players: 2,
        holes: 18,
        status: SEARCH_STATUS.ACTIVE,
      },
    });
  }
  if (wa2) {
    await db.search.create({
      data: {
        userId: demo.id,
        courseId: wa2.id,
        date: inDays(6),
        startMin: 8 * 60,
        endMin: 12 * 60,
        players: 4,
        holes: 18,
        status: SEARCH_STATUS.ACTIVE,
        recurring: true,
        daysOfWeek: JSON.stringify([6, 0]),
      },
    });
  }

  // Confirm demo: one real booking the demo golfer holds, ~1.5 days out, so the
  // next simulator tick sends a pre-round confirmation nudge for it. Idempotent —
  // drops any prior demo booking first.
  await db.teeTime.updateMany({
    where: { bookedByUserId: demo.id },
    data: {
      bookedByUserId: null,
      confirmStatus: null,
      confirmToken: null,
      confirmRequestedAt: null,
      confirmRespondedAt: null,
    },
  });
  if (wa) {
    await ensureSheetsAround(db, wa, inDays(2), 1);
    const slot = await db.teeTime.findFirst({
      where: {
        courseId: wa.id,
        status: TEE_STATUS.BOOKED,
        bookedByUserId: null,
        teeAt: {
          gte: new Date(Date.now() + 26 * 3_600_000),
          lte: new Date(Date.now() + 46 * 3_600_000),
        },
      },
      orderBy: { teeAt: "asc" },
    });
    if (slot) {
      await db.teeTime.update({
        where: { id: slot.id },
        data: { bookedByUserId: demo.id, confirmStatus: CONFIRM_STATUS.PENDING },
      });
    }
  }

  const counts = {
    courses: await db.course.count(),
    teeTimes: await db.teeTime.count(),
    openNow: await db.teeTime.count({ where: { status: "OPEN" } }),
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
