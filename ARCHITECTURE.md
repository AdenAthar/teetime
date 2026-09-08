# teetime — architecture, decisions & tradeoffs

A working recreation of the Noteefy golfer app (`noteefy.app/timesearch`), built as a
challenge. Same product shape, same visual language, new name + logo.

---

## 1. The product

The real company sells a few products. After researching them, what this app
recreates is **Confirm** — pre-round confirmation and cancellation recapture —
*not* Waitlist (their separate always-on golfer search-and-notify product).

**Confirm (primary):** a course has a tee sheet full of real bookings. Up to
48 h before each booking (and down to ~3 h for short-notice ones), the system
messages that golfer to **confirm, cancel, or modify**. If they cancel — or never
respond by a cutoff a few hours before tee-off — that slot is released
*immediately*, and only then does the Waitlist-style matcher fill it from other
golfers' searches. Revenue logic: courses lose money on no-shows and late
cancellations; Confirm surfaces them early enough to resell the slot.

**Waitlist (secondary, retained):** a golfer creates a **search** (course +
date + time window + party size, optionally recurring). When a slot matching an
active search opens up, the golfer gets an email/SMS with a booking link. This
still exists as a real, useful mechanic in its own right — and it's the thing
that *refills* a slot the moment Confirm frees one.

**The two connect.** A Waitlist match has a working **Book now** (demo booking —
no payment, no real tee sheet): the golfer takes the slot, it becomes theirs
(`TeeTime.bookedByUserId`), and if it's inside the 48 h window the next tick sends
*that* golfer their one Confirm nudge — confirmable inline from the Dev Outbox.
So one account can walk the whole loop: search → match → book → confirm.

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
     (`bookedByUserId` set, `confirmStatus: PENDING`) that's now 3–48 h out gets
     a "please confirm" notification and moves to `AWAITING_CONFIRMATION`. The
     golfer got there either from the seed's demo booking or by hitting **Book
     now** on a Waitlist match.
  2. **Confirm — auto-release:** an `AWAITING_CONFIRMATION` booking still
     unanswered within 3 h of tee-off is released (`status: OPEN`), same as an
     explicit cancel, then handed to the matcher.
  3. **Search housekeeping:** expire searches whose window has fully passed;
     re-arm a `MATCHED` search (future date) back to `ACTIVE` after a 45 s
     cooldown so it can match again on a *new* slot — the demo keeps producing
     alerts instead of going quiet after the first hit.
  4. **Waitlist churn:** flips booked↔open slots to model ambient bookings and
     cancellations, plus a biased "targeted cancellation" inside a random active
     search's window so demos produce hits. Rebookings are **capped so a watched
     sheet never drops below `SIM_OPEN_FLOOR_FRACTION` (18%) open** — otherwise
     rebookings (5/tick) > cancellations (4/tick) drains every sheet to zero over
     a long-running session.
- Everything downstream is **real code**: `runMatcher` queries active searches
  against each newly-opened slot (whether Confirm or Waitlist freed it); the
  notifier fans the hit out; the search moves to `MATCHED`; the alert is recorded
  (never the same `(search, slot)` pair twice within an hour).
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
| 10 | **Auth** | NextAuth / Clerk / hand-rolled OTP | **Hand-rolled OTP → `jose`-signed session cookie**, matching Noteefy's real passwordless flow, no external dependency. Dev prints the code to the console and shows it on the verify screen; `/api/dev/login` shortcuts to the demo account. The JWT carries a `Session` row id (`jti`); every read re-checks that row exists and isn't expired, so logging out (deletes the row) or deleting the account (cascade) actually invalidates a still-unexpired JWT. Expired rows are swept opportunistically on login. |
| 11 | **Data-fetching** | standalone REST/GraphQL API / Next-native | **RSC for reads, server actions for mutations**, `/api` only for the simulator crank + client polling. Fewer moving parts; the "mock API" boundary is really just the simulator. |
| 12 | **Account-area styling** | pull in Material UI / hand-build | Noteefy's account screens are clearly MUI (that blue `EDIT` button, notched outline fields, light-blue `ALL SEARCHES` tab). **Hand-built those few components in Tailwind** — matches visually at ~0 bundle cost — and kept the crimson brand for the public directory. |
| 13 | **Brand** | mirror Noteefy's crimson / differentiate | **Kept the crimson palette + Material-blue account accents**; swapped the mark and name. The challenge is fidelity, so "same product, different name" is the target. New logo: a bell whose handle is a golf flagstick + pennant. |
| 14 | **Auth-page background** | licensed course photo / generated | **CSS gradient + SVG hills.** Avoids shipping a copyrighted image; reads as a course at golden hour. |
| 15 | **Header on scroll** | always-sticky / hide-on-scroll-down | **Hide-on-scroll-down, reveal-on-scroll-up** (`header-shell.client.tsx`, rAF-throttled, always shown above 80px). |
| 16 | **Mouse-wheel over the map** | always-on scroll-zoom / ctrl+scroll gate / click-to-activate | **Click-to-activate ("cooperative gesture handling")** — the same convention Google Maps embeds default to (that "©2026 Google" attribution on Noteefy's map is the tell). Scroll-zoom stays off until you click into the map; a plain scroll before that just scrolls the page (never trapped, header hide-on-scroll unaffected); moving the cursor off the map re-disarms it. Tried always-on plain scroll first — it reproduces Noteefy's *end state* but traps any scroll gesture that starts over the map, which sits right under the header, so it kept reading as "scrolling is broken." Also tried ctrl+scroll, which solves the trap but isn't what Noteefy's real embed requires. |
| 17 | **Primary mechanic: Confirm vs Waitlist** | model the golfer-initiated always-on search (Waitlist) / model pre-round confirmation + automatic recapture (Confirm) | **Confirm, with Waitlist retained as the refill mechanic.** The first build was pure Waitlist — a golfer sets a search and waits for a slot to open. But researching the real product line, the mechanics I'd actually built (a course-side tee sheet, cancellations freeing slots, notifications firing on the *transition*) map to **Confirm**: the course proactively nudges each booked golfer 24–48 h out; a cancel or a non-response releases the slot; only *then* does search-matching fill it. Confirm is course-initiated and booking-attached (`TeeTime.bookedByUserId` + `confirmStatus`); Waitlist is golfer-initiated and search-attached (`Search`). Modelled Confirm as the primary flow and kept Waitlist because (a) it's a real second product and (b) it's literally what recaptures the freed slot. Modelling booking-ownership as fields on `TeeTime` rather than a separate `Booking` table was deliberate — smaller, reviewable diff, and a slot only ever has one holder. |
| 18 | **Natural-language search** | LLM parses *and* creates the search (an agent) / LLM only parses, human submits | **Parse only.** The bottom-right popup (§9) sends the prompt to Claude with one forced tool call that returns structured fields — course text, date range, time window, party size — and nothing else. The server resolves the course against Postgres itself and expands the date range with the app's own UTC helpers; the golfer reviews pre-filled draft cards and submits each through the unchanged `createSearch`. The model never sees a course id, never writes, and a bad/absent key just hides the box. This keeps the LLM on the one job it's good at (fuzzy intent → structure) and off the jobs the app already does deterministically. |
| 19 | **"Book now" on a match** | dead placeholder link / real payment+tee-sheet integration / demo booking | **Demo booking.** No payment and no real tee sheet to write to, but the click does real work: `TeeTime` → `BOOKED` + `bookedByUserId` + `confirmStatus: PENDING`, `Search` → `BOOKED`. That's exactly the state a real integration would leave behind, so the *rest* of the system (the Confirm nudge, auto-release, the outbox) runs unchanged. Booking-ownership lives on `TeeTime` (rows 17), so there's no separate `Booking` entity to reconcile. Lets one demo account show the full search → match → book → confirm loop instead of the seed having to hand-place a booking. **Concurrency:** two golfers whose searches both matched the same freed slot could both see "Book now"; the write is an atomic `updateMany` guarded on `status: OPEN, bookedByUserId: null`, so exactly one wins and the loser gets "just taken" — no clobbered owner, no phantom receipt. The Confirm token actions and the simulator's Confirm steps use the same guarded-update pattern; the simulator's ambient churn skips any slot with a `bookedByUserId`. |

---

## 5. Data model

```
User      id, firstName, lastName, email(unique), phone?, zip?, birthday?, gender?,
          notifyEmail, notifyText, notifyPrompts, createdAt
Course    id, name, slug(unique), city?, region, country, lat, lng, bookingUrl?, provider?
Search    id, userId, courseId, date, startMin, endMin, players, holes,
          status "ACTIVE|PAUSED|MATCHED|BOOKED|EXPIRED", recurring, daysOfWeek (json), createdAt, lastCheckedAt
TeeTime   id, courseId, teeAt, players, priceCents, holes, status "OPEN|BOOKED", updatedAt,
          -- Confirm: null unless a real golfer holds this slot --
          bookedByUserId?, confirmStatus? "PENDING|AWAITING_CONFIRMATION|CONFIRMED|CANCELED|MODIFY_REQUESTED",
          confirmToken?(unique), confirmRequestedAt?, confirmRespondedAt?
          @@unique(courseId, teeAt)
Notification id, userId, searchId?, teeTimeId, channel "EMAIL|TEXT",
          kind "MATCH|BOOKING|CONFIRM_REQUEST",
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
- **Matching is transition-only.** `createSearch` writes the row and generates the
  sheet but runs no matching; `runMatcher` only ever fires on a slot that just
  flipped `OPEN`. So a new search doesn't get checked against slots that are
  *already* open — the first hit waits for the next tick. A real product would
  scan on creation.
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

---

## 8. MCP server

`src/mcp/server.ts` is a small [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes a few read-only slices of teetime as tools an MCP client
(Claude Desktop, etc.) can call. It's a separate entrypoint — `npm run mcp` — not
part of the Next.js app or the Vercel deployment. README → "MCP server" has the
Claude Desktop config.

**Why MCP.** The app already holds the data an assistant would want in order to
reason about a golfer's situation — which courses exist, what's open, whether a
search has fired. MCP is the standard way to hand that to an LLM client as
callable tools with typed inputs, without inventing a bespoke API *and* a bespoke
client for it. It fits cleanly here: the project is TypeScript, so the official
`@modelcontextprotocol/sdk` drops in and reuses the project's zod for input
schemas, and each tool is a thin wrapper over the same Prisma models the app
uses (`@/lib/db`, `@/lib/constants`, `@/lib/time`) — no second data path.

**Tools** (all read-only, zod-validated inputs):

| Tool | Input | Returns |
|---|---|---|
| `search_courses` | `query` (name or region) | up to 25 matching `Course` rows incl. `id` |
| `check_availability` | `courseId`, `date` (YYYY-MM-DD) | OPEN `TeeTime` slots for that course/day (UTC) |
| `get_search_status` | `searchId` | the search's `ACTIVE\|PAUSED\|MATCHED\|EXPIRED` status + every alert sent for it |

They chain: `search_courses` → `id` → `check_availability` / `get_search_status`.

**Tradeoff — read-only for a first pass.** teetime also has obvious *write*
actions worth exposing: create a search, stop notifications, cancel a booking via
its confirm token. Those were left out on purpose. An MCP client may invoke tools
autonomously, and every one of those writes has a real side effect — a new row
someone then gets alerts for, a freed tee time the matcher immediately hands to
other golfers. A read-only surface is still genuinely useful (an assistant can
answer *"is anything open at Chambers Bay Saturday?"* or *"did my search ever
match?"*) with no way to mutate state on the golfer's or the course's behalf.
Adding the writes is a deliberate follow-up — ideally gated behind the client's
own human-in-the-loop confirmation for each call.

**Transport.** stdio only: the client spawns `npm run mcp` as a subprocess and
talks over stdin/stdout. No port, no auth, no CORS, no session management — the
cost is that it's local and single-client, which is fine for a demo. A hosted,
multi-client, or remote server would need Streamable HTTP instead. (Because
stdout carries the JSON-RPC frames, all logging in `server.ts` goes to stderr.)

---

## 9. Natural-language search (optional)

A floating popup in the bottom-right corner — *"9 holes in Arizona this week,
afternoons"* — shown site-wide (rendered from the `(app)` layout) when
`ANTHROPIC_API_KEY` is set (`AI_SEARCH_ENABLED`). Unset, neither the button nor
the panel is rendered and nothing else about the app changes.

**UI.** `NlSearchWidget` (client) is a fixed launcher button + a collapsible
panel (`z-[1300]` — above the header, below the create-search modal). The panel
body (`NlSearchPanel`) holds the prompt box, example chips, and the draft cards.
It deliberately doesn't reuse the `CreateSearchDialog` portal/modal — each draft
is its own inline `<form action={createSearch}>`, so the widget stays a
self-contained overlay with no stacking-context entanglement with the map.

**Flow.** `NlSearchWidget` → `parseSearchFromPrompt` server action (sign-in
required, plus a sliding-window rate limit — 12/user/h, 24/IP/h, `AiRequestLog`
table via raw SQL so it works without a client regen and on serverless where
memory isn't shared — so a public deploy can't be looped into a large Anthropic
bill) → `parseSearchPrompt` in `src/lib/ai/parse-search.ts`:

1. One `messages.create` call to `claude-haiku-4-5`, `tool_choice` forced to a
   single `propose_search` tool. The model returns only: `courseQuery` (free
   text), `dateStart`/`dateEnd`, `startMin`/`endMin`, `players`, `holes`, and a
   one-line `note`. It is given today's UTC date and the 14-day window.
2. The server resolves `courseQuery` against Postgres (`findCourses`, the same
   `contains` query the MCP `search_courses` tool uses — the model never handles
   an id), clamps and expands the date range with `draft-math.ts` (pure, UTC,
   unit-checkable — this app has been bitten by local-vs-UTC date drift before),
   and fans out to at most `MAX_DRAFTS` course×day drafts.
3. `NlSearchPanel` renders each draft as a pre-filled card built from the *same*
   fields the manual dialog uses; submitting posts to the unchanged `createSearch`.

**Why this split.** The model does the one thing it's better at than a parser —
fuzzy natural language → structure — and nothing else. Course lookup, date math,
the app's limits, and the actual write all stay in existing deterministic code,
so the AI path can't create a search the manual form couldn't, and a model
hiccup degrades to "use the form." Cost is one cheap Haiku call per prompt.

**Boundaries of this pass.** No conversation/refinement (each prompt is
independent), no course disambiguation UI (a region match just fans out to the
first few), and it's parse-only by design — an agent that *books* on the golfer's
behalf is the same human-in-the-loop question as the MCP write tools (§8).
