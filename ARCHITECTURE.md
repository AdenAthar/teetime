# teetime — architecture, decisions & tradeoffs

A working recreation of the Noteefy golfer app (`noteefy.app/timesearch`), built as a
challenge. Same product shape, same visual language, new name + logo.

---

## 1. The product

Stripping away Noteefy's marketing site, the app is a **demand-capture alerting system**:

1. A directory of ~1,000 partner golf courses, grouped by state/province, with a map.
2. A golfer creates a **search**: course + date + time window + party size (+ optional
   recurring weekly searches).
3. A monitoring engine watches each course's tee sheet via booking-provider
   integrations (GolfNow, foreUp, Club Prophet, TeeSnap, Lightspeed/Chronogolf…).
4. When a slot matching an active search opens up — almost always a *cancellation* —
   the golfer gets an email/SMS with a booking link.
5. Account surface: profile, notification preferences (email/text toggles), searches
   list (all / recurring), delete account. Auth is passwordless (email or phone OTP).

Revenue logic: courses lose money on unfilled cancellations; Noteefy refills them and
captures golfer demand that would otherwise leak to a competitor.

---

## 2. The load-bearing decision — simulate the supply side

Noteefy's real value is the **live integrations with tee-sheet providers**. Those are
proprietary and unreplicable. So the central move is a **fake tee-sheet provider**:

- `src/lib/simulator/engine.ts` seeds a realistic 14-day tee sheet per course
  (10-min slots, 06:00–18:00, price curve by time of day, ~65% booked; further-out
  days start with more availability).
- A **churn tick** flips booked↔open slots over time to model bookings and
  cancellations, plus a biased "targeted cancellation" that opens a slot inside a
  random active search's window so demos actually produce hits.
- Everything downstream is **real code**: the matcher queries active searches against
  each newly-opened slot; the notifier fans the hit out across the user's channels;
  the search moves to `MATCHED`; the alert is recorded and rendered.

This keeps the interesting ~80% of the system genuine and observable while the one
unreplicable piece is faked.

---

## 3. System shape

```
Next.js 16 (App Router) — one deployable
  routes (RSC)                server actions / route handlers
  /find    map + directory     auth:    request-otp, verify-otp, dev/login
  /searches  My Searches       searches: create / pause / delete / reactivate
  /account/{profile,           account:  update profile, toggle prefs, delete
            notifications,     /api/tick: crank the simulator (+ GET status)
            settings}
  /login /verify /signup
  /dev/outbox  sent alerts
        │                                   │
        ▼                                   ▼
  Prisma 6 → SQLite (default)         Tee-sheet simulator
  (Postgres = 1-line switch)          seed · churn tick · matcher
  User Course Search TeeTime                 │
  Notification OtpToken Session              ▼
                                     Notifier → Resend if keyed
                                              else Dev Outbox (DB + /dev/outbox)
```

---

## 4. Decisions & tradeoffs

| # | Decision | Options considered | Choice — and why |
|---|---|---|---|
| 1 | **Supply data** | real integrations / simulate | **Simulate.** No alternative; it's what makes the rest real. |
| 2 | **Simulator runtime** | long-lived worker / serverless cron / lazy on page-load | **`/api/tick` + a `npm run tick` loop.** No second process to babysit in dev; deploys to Vercel Cron unchanged. Lazy-on-load would make "live" alerts a fiction. |
| 3 | **Map library** | Google Maps JS / Leaflet+OSM / MapLibre | **Leaflet + OpenStreetMap tiles.** Noteefy embeds a Google *My Maps* iframe; the Google JS API needs a billed key. Leaflet is keyless and gives full control of the markers + detail panel. First tried Carto Voyager tiles — they now watermark "API KEY REQUIRED" — so swapped to raw `tile.openstreetmap.org`. |
| 4 | **Marker rendering** | 1,000 DOM `divIcon` bell pins / canvas circle markers / clustering | **Canvas `CircleMarker`s on one shared `L.canvas()` renderer** (`preferCanvas`). 1,000 DOM nodes made pan/zoom janky; one `<canvas>` is smooth. Tradeoff: dots not bells at continental zoom (near-identical at that scale); the detailed bell pin still shows for a focused course. Clustering was rejected — the real map doesn't cluster. |
| 5 | **Map stacking** | default z-index / raise header + isolate map | Leaflet panes/controls use z-index up to ~1000 and bled over the header menu. **Header lifted to z-1200, map wrapped in `isolate z-0`.** |
| 6 | **Course coordinates** | geocode all / state-centroid approximation / hand-curate | **Geocode once via OSM Nominatim** (1 req/s, ~17 min, cached to `data/geocache.json`): 503 exact hits, 350 fall back to state-centroid + deterministic jitter. Real pins matter for a map product. Known issue: a few coastal centroids land in water. |
| 7 | **Database** | Postgres / SQLite | You asked for Postgres; Docker Desktop wasn't running and I can't start a GUI app. **Shipped on Prisma + SQLite** (runs instantly) with `docker-compose.yml` + a one-line schema switch to Postgres. To stay portable: enums modelled as validated strings, the one list field (`daysOfWeek`) as a JSON string. |
| 8 | **ORM version** | Prisma 7 / Prisma 6 | `create-next-app` pulled Prisma 7, whose new driver-adapter + config-file + query-compiler model added friction on a greenfield build. **Downgraded to Prisma 6** for the well-trodden setup. |
| 9 | **Notifications** | real email + SMS / dev outbox | **Dev Outbox by default** — writes every alert to the DB and renders it at `/dev/outbox` + inline on the search card. Real email if `RESEND_API_KEY` is set. SMS stubbed (Twilio needs a paid number + A2P registration). Zero-config runnable. |
| 10 | **Auth** | NextAuth / Clerk / hand-rolled OTP | **Hand-rolled OTP → `jose`-signed session cookie**, matching Noteefy's real passwordless flow, no external dependency. Dev prints the code to the console and shows it on the verify screen; `/api/dev/login` shortcuts to the demo account. A `Session` row backs the JWT so sessions can be revoked. |
| 11 | **Data-fetching** | standalone REST/GraphQL API / Next-native | **RSC for reads, server actions for mutations**, `/api` only for the simulator crank + client polling. Fewer moving parts; the "mock API" boundary is really just the simulator. |
| 12 | **Account-area styling** | pull in Material UI / hand-build | Noteefy's account screens are clearly MUI (that blue `EDIT` button, notched outline fields, light-blue `ALL SEARCHES` tab). **Hand-built those few components in Tailwind** — matches visually at ~0 bundle cost — and kept the crimson brand for the public directory. |
| 13 | **Brand** | mirror Noteefy's crimson / differentiate | **Kept the crimson palette + Material-blue account accents**; swapped the mark and name. The challenge is fidelity, so "same product, different name" is the target. New logo: a bell whose handle is a golf flagstick + pennant. |
| 14 | **Auth-page background** | licensed course photo / generated | **CSS gradient + SVG hills.** Avoids shipping a copyrighted image; reads as a course at golden hour. |
| 15 | **Header on scroll** | always-sticky / hide-on-scroll-down | **Hide-on-scroll-down, reveal-on-scroll-up** (`header-shell.client.tsx`, rAF-throttled, always shown above 80px). |

---

## 5. Data model

```
User      id, firstName, lastName, email(unique), phone?, zip?, birthday?, gender?,
          notifyEmail, notifyText, notifyPrompts, createdAt
Course    id, name, slug(unique), city?, region, country, lat, lng, bookingUrl?, provider?
Search    id, userId, courseId, date, startMin, endMin, players, holes,
          status "ACTIVE|PAUSED|MATCHED|EXPIRED", recurring, daysOfWeek (json), createdAt, lastCheckedAt
TeeTime   id, courseId, teeAt, players, priceCents, holes, status "OPEN|BOOKED", updatedAt
          @@unique(courseId, teeAt)
Notification id, userId, searchId, teeTimeId, channel "EMAIL|TEXT", subject, body,
          provider "DEV|RESEND|TWILIO", sentAt, readAt?
OtpToken  id, identifier, channel, codeHash (sha256), expiresAt, consumedAt?, createdAt
Session   id, userId, expiresAt, createdAt
```

Enums are strings (SQLite/Postgres portability); constants live in `src/lib/constants.ts`.

---

## 6. Known limitations / inferred

- **Create-a-search modal** was reconstructed — there was no reference screenshot of it.
- Per-state course lists render every course (like Noteefy's accordion); big states
  (California ≈ 200 rows) make those pages tall. No in-card pagination yet.
- ~350 courses are placed by state centroid, not exact address; a few land in water.
- SMS is recorded but not delivered.
- Auth-page background is generated art, not Noteefy's photo.

---

## 7. Run

```bash
npm install
npm run db:push          # SQLite schema
npm run db:seed          # ~1,000 courses + 14 days of tee sheets + demo user
npm run dev              # http://localhost:3000
npm run tick             # 2nd terminal — churns availability so alerts fire

# optional
docker compose up -d     # + set provider="postgresql" in prisma/schema.prisma
npm run geocode          # refresh data/geocache.json (or `-- --offline` for centroids)
```

Visit `/api/dev/login` for the demo account; hit "Run simulator once" on `/dev/outbox`
to watch an alert get generated, matched and "sent".
