# teetime

A working recreation of the Noteefy golfer app (`noteefy.app/timesearch`) — same
product, same visual language, different name and logo. Built as a challenge.

**What it does:** recreates the **Confirm** product — pre-round confirmation and
cancellation recapture. A simulated tee-sheet engine nudges booked golfers 24–48 h
out to confirm / cancel / modify (`/confirm/[token]`); a cancel or non-response
releases the slot, which the retained **Waitlist** flow (golfer *searches* — course
+ date + window + party size) then refills. Notifications land in the Dev Outbox by
default, real email if configured.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design and the tradeoffs, or
[`BRIEFING.md`](./BRIEFING.md) for the full deep-dive (data model, simulator
internals, state machines, diagrams, anticipated review questions).

## Stack

- Next.js 16 (App Router, RSC + server actions) · React 19
- Prisma 6 · **Postgres** (a free Neon project; one-line switch to SQLite — see `prisma/schema.prisma`)
- Leaflet + OpenStreetMap tiles (no API key)
- `jose` for the passwordless session cookie
- Tailwind v4

## Run it

Put a Postgres URL in `.env` first — `DATABASE_URL` (pooled) and `DIRECT_URL`
(direct). A free [Neon](https://neon.tech) project covers both local dev and
production; full walkthrough in [`DEPLOY.md`](./DEPLOY.md).

```bash
npm install
npm run db:push          # create the schema in Postgres
npm run db:seed          # seed ~1,000 courses + a demo user (tee sheets generate lazily)

npm run dev              # http://localhost:3000
npm run tick             # 2nd terminal — churns the tee sheet so alerts fire
```

- Sign in with any email/phone — the OTP code is printed to the dev server console
  and shown on the verify screen. Or use the **"Explore the demo"** button on `/login`.
- Dev shortcut to the demo account: visit `/api/dev/login` (disabled in production).
- Every alert lands in **`/dev/outbox`**; hit "Run simulator once" there to force a tick.

### Stopping the dev server

`npm run stop` kills only the process on port 3000. Use it instead of a blanket
`taskkill /IM node.exe` (which also kills any other Node/Electron apps running on
the machine). To verify a production build while dev might be up, `npm run
build:app` skips `prisma generate` so it doesn't fight the Windows DLL lock.

### Local Postgres or SQLite instead of Neon

```bash
docker compose up -d                       # local Postgres, then point DATABASE_URL at it
# — or SQLite: set provider = "sqlite" in prisma/schema.prisma
#              and DATABASE_URL="file:./dev.db"
npm run db:push && npm run db:seed
```

### Optional: real email

Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`. Without them, alerts and OTP codes
go to the Dev Outbox / console. SMS is stubbed.

### Optional: accurate course locations

`npm run db:seed` uses `data/geocache.json`. Regenerate it (OpenStreetMap Nominatim,
~15 min, cached) with `npm run geocode`, or `npm run geocode -- --offline` to place
pins by state centroid only.

### Optional: natural-language search

Set `ANTHROPIC_API_KEY` in `.env` to show a floating popup in the bottom-right
corner: type *"9 holes in Arizona this week, afternoons"* or *"Saturday morning
tee time for 4 at Bethpage Black"* and it proposes draft searches you review and
submit through the normal form. The model only *extracts* fields (course/area,
dates, time window, party size) — it never writes; course resolution and search
creation stay in the app's own code, and the parser is rate-limited per user/IP.
Unset, the popup isn't rendered and nothing else changes. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §9.

## MCP server

`npm run mcp` starts a [Model Context Protocol](https://modelcontextprotocol.io)
server (stdio) that lets an MCP client (Claude Desktop, etc.) query teetime's
live data directly — no browser, no scraping. It talks to the same Postgres the
app does via the same Prisma models, so it always sees current state.

**What it can do** — three **read-only** tools:

| Tool | Input | Returns |
|---|---|---|
| `search_courses` | a name or region fragment (`"Pebble"`, `"Arizona"`, `"Ontario"`) | up to 25 matching courses — id, name, region, country, booking provider + URL |
| `check_availability` | a `courseId` + a date (`YYYY-MM-DD`) | every OPEN slot that day — tee time, players free, holes, price per player |
| `get_search_status` | a `searchId` (from the app's My Searches page) | that search's status, watched course + time window, and every alert already sent |

A typical chain: *"search teetime for courses in Arizona"* → *"what's open at
`<that courseId>` on 2026-09-12?"* → *"has my search `<searchId>` matched
anything yet?"*. The tools are read-only by design — booking and cancelling stay
in the app, where a human is in the loop (see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8).

Note: teetime only holds a tee sheet while a course is actively watched, so
`check_availability` returns nothing for courses nobody has a search on.

### Connect it to Claude Desktop

Open Claude Desktop → **Settings → Developer** (or **Local MCP servers**) → **Edit
Config**. That opens `claude_desktop_config.json`:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows (installer build) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Windows (Microsoft Store build) | `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json` |

Add a `mcpServers` entry alongside whatever keys are already there, then **fully
quit** Claude Desktop (tray icon → Quit — closing the window isn't enough) and reopen.

**Windows** — point it at the bundled launcher (`scripts/mcp.cmd`), which `cd`s to
the repo itself before starting the server:

```json
{
  "mcpServers": {
    "teetime": {
      "command": "C:\\absolute\\path\\to\\teetime\\scripts\\mcp.cmd"
    }
  }
}
```

**macOS / Linux** — `cwd` is honoured, so just:

```json
{
  "mcpServers": {
    "teetime": { "command": "npm", "args": ["run", "mcp"], "cwd": "/absolute/path/to/teetime" }
  }
}
```

Why the Windows launcher: Claude Desktop's Windows build spawns MCP servers in
`system32` and ignores the config's `cwd`, so a bare `npm run mcp` can't find
`package.json` (and `tsx` can't resolve the `@/` alias). `scripts/mcp.cmd` uses
`%~dp0` to locate the repo from its own path, so working directory doesn't matter.
It needs only `node` on `PATH`.

- To pass the database connection explicitly instead of relying on `.env`, add an
  `"env": { "DATABASE_URL": "postgresql://…", "DIRECT_URL": "postgresql://…" }` block.
- It reads the same database the app does — point it at your Neon project (or a
  local one) and it sees whatever courses / searches / tee sheets exist. Empty
  `check_availability` results are expected for courses nobody is watching (tee
  sheets are generated lazily).

## Layout

```
src/
  app/(app)/      find · searches · account/* · dev/outbox
                  faq · support · accessibility · legal/*     (+ shared header/footer)
  app/(auth)/     login · verify · signup · confirm/[token]   (full-bleed layout)
  app/api/        tick (simulator crank) · dev/login
  lib/
    auth/         OTP + jose session
    simulator/    tee-sheet gen, churn tick, matcher, Confirm nudges + auto-release
    notify/       channel fan-out (Resend | Dev) — Waitlist alerts + Confirm nudges
    confirm/      golfer confirm / cancel / modify actions
    ai/           natural-language search — parse (Anthropic) + rate limit (optional)
    searches/ account/   server actions
  mcp/            server.ts — read-only MCP tools over stdio (npm run mcp)
  components/     site chrome, map, directory, dialogs, account screens
scripts/          seed · geocode · tick-loop · shots (Playwright)
data/             courses-raw.txt (source list) · geocache.json
```
