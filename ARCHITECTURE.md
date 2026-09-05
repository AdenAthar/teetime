# teetime — architecture, decisions & tradeoffs

A working recreation of the Noteefy golfer app (`noteefy.app/timesearch`), built as a
challenge. Same product shape, same visual language, new name + logo.

---

## 1. The product

The real company sells a few products. After researching them, what this app
recreates is **Confirm** — pre-round confirmation and cancellation recapture —
*not* Waitlist (their separate always-on golfer search-and-notify product).

**Confirm (primary):** a course has a tee sheet full of real bookings. 24–48 h
before each booking, the system messages that golfer to **confirm, cancel, or
modify**. If they cancel — or never respond by a cutoff a few hours before
tee-off — that slot is released *immediately*, and only then does the
Waitlist-style matcher fill it from other golfers' searches. Revenue logic:
courses lose money on no-shows and late cancellations; Confirm surfaces them
early enough to resell the slot.

**Waitlist (secondary, retained):** a golfer creates a **search** (course +
date + time window + party size, optionally recurring). When a slot matching an
active search opens up, the golfer gets an email/SMS with a booking link. This
still exists as a real, useful mechanic in its own right — and it's the thing
that *refills* a slot the moment Confirm frees one.

Supporting surface: a ~1,000-course directory + map, account/profile,
notification preferences, searches list. Auth is passwordless (email or phone OTP).

---

## 2. The load-bearing decision — simulate the supply side

The real value is **live integrations with tee-sheet providers**. Those are
proprietary and unreplicable. So the central move is a **fake tee-sheet provider**:

- `src/lib/simulator/engine.ts` generates a realistic tee sheet on demand
  (10-min slots, 06:00–18:00, price curve by time of day, ~65% booked; further-out
  days start with more availability). Sheets are created lazily — only for courses
  with an active search, and only for the days around it — so a hosted Postgres
  stays small. `FULL_SHEETS=1 npm run db:seed` pre-generates all ~1M for local dev.
- A **churn tick** (`tick()`, cranked by `/api/tick`) does, in order:
  1. **Confirm — send nudges:** any `TeeTime` with a real golfer attached
     (`bookedByUserId` set, `confirmStatus: PENDING`) that's now 24–48 h out gets
     a "please confirm" notification and moves to `AWAITING_CONFIRMATION`.
  2. **Confirm — auto-release:** an `AWAITING_CONFIRMATION` booking still
     unanswered within 3 h of tee-off is released (`status: OPEN`), same as an
     explicit cancel, then handed to the matcher.
  3. **Waitlist churn:** flips booked↔open slots to model ambient bookings and
     cancellations, plus a biased "targeted cancellation" inside a random active
     search's window so demos produce hits.
- Everything downstream is **real code**: `runMatcher` queries active searches
  against each newly-opened slot (whether Confirm or Waitlist freed it); the
  notifier fans the hit out; the search moves to `MATCHED`; the alert is recorded.
- The golfer's confirm / cancel / modify link (`/confirm/[token]`, token-gated,
  no login) drives the same `runMatcher` path on cancel/modify.

This keeps the interesting ~80% of the system genuine and observable while the one
unreplicable piece is faked.

---

## 3. System shape

```
Next.js 16 (App Router) — one deployable
  routes (RSC)                server actions / route handlers
  /find    map + directory     auth:    request-otp, verify-otp, dev/login
  /searches  My Searches       searches: create / stop-notifications / delete / reactivate
  /account/{profile,           account:  update profile, toggle prefs, delete
            notifications,     /api/tick: crank the simulator (+ GET status)
            settings}
  /login /verify /signup
  /confirm/[token]  golfer confirm / cancel / modify (token-gated)
  /dev/outbox  sent alerts (Waitlist + Confirm)
        │                                   │
        ▼                                   ▼
  Prisma 6 → Postgres (Neon)          Tee-sheet simulator
  (SQLite = 1-line schema switch)     seed · churn tick · matcher
  User Course Search TeeTime                 │  confirm nudges + auto-release
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
| 3 | **Map library** | Google Maps JS / Leaflet+OSM / MapLibre | **Leaflet + OpenStreetMap tiles.** Noteefy embeds a Google *My Maps* iframe; the Google JS API needs a billed key. Leaflet is keyless and lets us rebuild the Noteefy interaction ourselves — click a pin → red course bar + slide-in detail panel, plus a geolocate-on-load and a "locate me" control. First tried Carto Voyager tiles — they now watermark "API KEY REQUIRED" — so swapped to raw `tile.openstreetmap.org`. |
| 4 | **Marker rendering** | 1,000 DOM `divIcon` bell pins / canvas circle markers / clustering | **Zoom-dependent hybrid.** Below zoom 6: every course as a canvas dot on one shared `L.canvas()` renderer (`preferCanvas`) — smooth at continental scale. Zoom 6+: only the courses in the current viewport, as `divIcon` bell pins, capped at 250 and recomputed on `moveend`/`zoomend`. Started with canvas dots everywhere; added the viewport-culled bells back to match Noteefy's pin look up close. Clustering was rejected — the real map doesn't cluster. |
| 5 | **Map stacking** | default z-index / raise header + isolate map | Leaflet panes/controls use z-index up to ~1000 and bled over the header menu. **Header lifted to z-1200, map wrapped in `isolate z-0`.** |
| 6 | **Course coordinates** | geocode all / state-centroid approximation / hand-curate | **Geocode once via OSM Nominatim** (1 req/s, ~17 min, cached to `data/geocache.json`): 503 exact hits, 350 fall back to state-centroid + deterministic jitter. Real pins matter for a map product. Known issue: a few coastal centroids land in water. |
| 7 | **Database** | Postgres / SQLite | **Postgres, on Neon's free tier** — one hosted DB shared by local dev and the Vercel deployment. Built first on SQLite (Docker wasn't running at the time) and switched to Postgres during deploy; the schema still runs on SQLite by changing `provider` back to `"sqlite"` and the URL to a file, because enums are modelled as validated strings and the one list field (`daysOfWeek`) as a JSON string. `docker-compose.yml` is kept for a local Postgres option. |
| 8 | **ORM version** | Prisma 7 / Prisma 6 | `create-next-app` pulled Prisma 7, whose new driver-adapter + config-file + query-compiler model added friction on a greenfield build. **Downgraded to Prisma 6** for the well-trodden setup. |
| 9 | **Notifications** | real email + SMS / dev outbox | **Dev Outbox by default** — writes every alert to the DB and renders it at `/dev/outbox` + inline on the search card. Real email if `RESEND_API_KEY` is set. SMS stubbed (Twilio needs a paid number + A2P registration). Zero-config runnable. |
| 10 | **Auth** | NextAuth / Clerk / hand-rolled OTP | **Hand-rolled OTP → `jose`-signed session cookie**, matching Noteefy's real passwordless flow, no external dependency. Dev prints the code to the console and shows it on the verify screen; `/api/dev/login` shortcuts to the demo account. A `Session` row backs the JWT so sessions can be revoked. |
| 11 | **Data-fetching** | standalone REST/GraphQL API / Next-native | **RSC for reads, server actions for mutations**, `/api` only for the simulator crank + client polling. Fewer moving parts; the "mock API" boundary is really just the simulator. |
| 12 | **Account-area styling** | pull in Material UI / hand-build | Noteefy's account screens are clearly MUI (that blue `EDIT` button, notched outline fields, light-blue `ALL SEARCHES` tab). **Hand-built those few components in Tailwind** — matches visually at ~0 bundle cost — and kept the crimson brand for the public directory. |
| 13 | **Brand** | mirror Noteefy's crimson / differentiate | **Kept the crimson palette + Material-blue account accents**; swapped the mark and name. The challenge is fidelity, so "same product, different name" is the target. New logo: a bell whose handle is a golf flagstick + pennant. |
| 14 | **Auth-page background** | licensed course photo / generated | **CSS gradient + SVG hills.** Avoids shipping a copyrighted image; reads as a course at golden hour. |
| 15 | **Header on scroll** | always-sticky / hide-on-scroll-down | **Hide-on-scroll-down, reveal-on-scroll-up** (`header-shell.client.tsx`, rAF-throttled, always shown above 80px). |
| 16 | **Mouse-wheel over the map** | always-on scroll-zoom / ctrl+scroll gate / click-to-activate | **Click-to-activate ("cooperative gesture handling")** — the same convention Google Maps embeds default to (that "©2026 Google" attribution on Noteefy's map is the tell). Scroll-zoom stays off until you click into the map; a plain scroll before that just scrolls the page (never trapped, header hide-on-scroll unaffected); moving the cursor off the map re-disarms it. Tried always-on plain scroll first — it reproduces Noteefy's *end state* but traps any scroll gesture that starts over the map, which sits right under the header, so it kept reading as "scrolling is broken." Also tried ctrl+scroll, which solves the trap but isn't what Noteefy's real embed requires. |
| 17 | **Primary mechanic: Confirm vs Waitlist** | model the golfer-initiated always-on search (Waitlist) / model pre-round confirmation + automatic recapture (Confirm) | **Confirm, with Waitlist retained as the refill mechanic.** The first build was pure Waitlist — a golfer sets a search and waits for a slot to open. But researching the real product line, the mechanics I'd actually built (a course-side tee sheet, cancellations freeing slots, notifications firing on the *transition*) map to **Confirm**: the course proactively nudges each booked golfer 24–48 h out; a cancel or a non-response releases the slot; only *then* does search-matching fill it. Confirm is course-initiated and booking-attached (`TeeTime.bookedByUserId` + `confirmStatus`); Waitlist is golfer-initiated and search-attached (`Search`). Modelled Confirm as the primary flow and kept Waitlist because (a) it's a real second product and (b) it's literally what recaptures the freed slot. Modelling booking-ownership as fields on `TeeTime` rather than a separate `Booking` table was deliberate — smaller, reviewable diff, and a slot only ever has one holder. |

---

## 5. Data model

```
User      id, firstName, lastName, email(unique), phone?, zip?, birthday?, gender?,
          notifyEmail, notifyText, notifyPrompts, createdAt
Course    id, name, slug(unique), city?, region, country, lat, lng, bookingUrl?, provider?
Search    id, userId, courseId, date, startMin, endMin, players, holes,
          status "ACTIVE|PAUSED|MATCHED|EXPIRED", recurring, daysOfWeek (json), createdAt, lastCheckedAt
TeeTime   id, courseId, teeAt, players, priceCents, holes, status "OPEN|BOOKED", updatedAt,
          -- Confirm: null unless a real golfer holds this slot --
          bookedByUserId?, confirmStatus? "PENDING|AWAITING_CONFIRMATION|CONFIRMED|CANCELED|MODIFY_REQUESTED",
          confirmToken?(unique), confirmRequestedAt?, confirmRespondedAt?
          @@unique(courseId, teeAt)
Notification id, userId, searchId?, teeTimeId, channel "EMAIL|TEXT",
          kind "MATCH|CONFIRM_REQUEST" (searchId null when CONFIRM_REQUEST),
          subject, body, provider "DEV|RESEND|TWILIO", sentAt, readAt?
OtpToken  id, identifier, channel, codeHash (sha256), expiresAt, consumedAt?, createdAt
Session   id, userId, expiresAt, createdAt
```

Enums are strings and `daysOfWeek` is a JSON string, so the schema is portable
between Postgres and SQLite; constants live in `src/lib/constants.ts`.

---

## 6. Known limitations / inferred

- **Create-a-search modal** was reconstructed — there was no reference screenshot of it.
- Per-state course lists render every course (like Noteefy's accordion); big states
  (California ≈ 200 rows) make those pages tall. No in-card pagination yet.
- ~350 courses are placed by state centroid, not exact address; a few land in water.
- SMS is recorded but not delivered.
- Auth-page background is generated art, not Noteefy's photo.
- **Confirm** is scoped: one fixed auto-release cutoff (3 h), non-configurable
  reminder timing, `confirmToken` never expires, and "modify" is simplified to
  "release the slot + go set up a Waitlist search" rather than true rescheduling.
- No real per-course timezone — all day/window math is UTC. (This *used* to be
  local-server-time, which is worse: it silently broke matching for any data
  seeded from a machine in a different timezone than wherever the code runs.
  Fixed by switching `time.ts` to explicit UTC methods everywhere — see git
  history for the incident. UTC-for-everyone is a known simplification, not a
  bug; local-time-per-process was the bug.)

---

## 7. Run

Needs a Postgres URL in `.env` (`DATABASE_URL` + `DIRECT_URL`) — a free Neon
project works for both local dev and prod. See `DEPLOY.md`.

```bash
npm install
npm run db:push          # create the schema in Postgres
npm run db:seed          # ~1,000 courses + demo user (tee sheets generate lazily)
npm run dev              # http://localhost:3000
npm run tick             # 2nd terminal — churns availability so alerts fire

# optional
npm run geocode          # refresh data/geocache.json (or `-- --offline` for centroids)
```

Local Postgres instead of Neon: `docker compose up -d` and point `DATABASE_URL`
at it. SQLite instead: set `provider = "sqlite"` in `prisma/schema.prisma` and
`DATABASE_URL="file:./dev.db"`.

Visit `/api/dev/login` for the demo account; hit "Run simulator once" on `/dev/outbox`
to watch an alert get generated, matched and "sent".
