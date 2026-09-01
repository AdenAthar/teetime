# teetime

A working recreation of the Noteefy golfer app (`noteefy.app/timesearch`) — same
product, same visual language, different name and logo. Built as a challenge.

**What it does:** golfers create *searches* (course + date + time window + party
size); a simulated tee-sheet engine churns availability; when a matching slot opens
up, an alert is sent (Dev Outbox by default, real email if configured).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design and the tradeoffs.

## Stack

- Next.js 16 (App Router, RSC + server actions) · React 19
- Prisma 6 · SQLite by default (one-line switch to Postgres — see `prisma/schema.prisma`)
- Leaflet + OpenStreetMap tiles (no API key)
- `jose` for the passwordless session cookie
- Tailwind v4

## Run it

```bash
npm install
npm run db:push          # create the SQLite schema
npm run db:seed          # seed ~1,000 courses + 14 days of tee sheets + a demo user

npm run dev              # http://localhost:3000
npm run tick             # 2nd terminal — churns the tee sheet so alerts fire
```

- Sign in with any email/phone — the OTP code is printed to the dev server console
  and shown on the verify screen.
- Dev shortcut to the demo account: visit `/api/dev/login`.
- Every alert lands in **`/dev/outbox`**; hit "Run simulator once" there to force a tick.

### Optional: real Postgres

```bash
docker compose up -d
# in prisma/schema.prisma set: provider = "postgresql"
# in .env set the postgres DATABASE_URL (commented example is there)
npm run db:push && npm run db:seed
```

### Optional: real email

Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`. Without them, alerts and OTP codes
go to the Dev Outbox / console. SMS is stubbed.

### Optional: accurate course locations

`npm run db:seed` uses `data/geocache.json`. Regenerate it (OpenStreetMap Nominatim,
~15 min, cached) with `npm run geocode`, or `npm run geocode -- --offline` to place
pins by state centroid only.

## Layout

```
src/
  app/(app)/      find · searches · account/* · dev/outbox   (+ shared header/footer)
  app/(auth)/     login · verify · signup                    (full-bleed layout)
  app/api/        tick (simulator crank) · dev/login
  lib/
    auth/         OTP + jose session
    simulator/    tee-sheet generation, churn tick, matcher
    notify/       channel fan-out (Resend | Dev)
    searches/ account/   server actions
  components/     site chrome, map, directory, dialogs, account screens
scripts/          seed · geocode · tick-loop · shots (Playwright)
data/             courses-raw.txt (source list) · geocache.json
```
