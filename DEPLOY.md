# Deploying teetime to a public URL

Target: **Vercel** (Next.js host) + **Neon** (free Postgres). ~15 minutes.
The tee-sheet simulator is kept alive by a client heartbeat on the searches page,
plus an optional external cron.

---

## 1. Create the database (Neon)

1. Sign up at <https://neon.tech> → **New Project** → name it `teetime`, pick a region.
2. On the project dashboard, **Connection string** panel:
   - Copy the **pooled** string (has `-pooler` in the host) → this is `DATABASE_URL`.
   - Toggle **"Direct connection"** and copy that one → this is `DIRECT_URL`.
   Both end with `?sslmode=require`.

## 2. Point your local project at it and load data

In `teetime/.env`:

```
DATABASE_URL="<neon pooled string>"
DIRECT_URL="<neon direct string>"
AUTH_SECRET="<paste output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">"
```

Then, from `teetime/`:

```bash
npm install
npm run db:push      # creates the tables in Neon
npm run geocode      # optional: real course coordinates (~15 min, cached). skip to use approximate pins
npm run db:seed      # ~1,000 courses + a demo account. tee sheets are generated on demand.
```

Verify locally: `npm run dev` → <http://localhost:3000>.

## 3. Push to GitHub

```bash
cd teetime
git init
git add -A
git commit -m "teetime"
gh repo create teetime --private --source=. --push
# (or make the repo on github.com and `git remote add origin … && git push -u origin main`)
```

## 4. Deploy on Vercel

1. <https://vercel.com> → **Add New… → Project** → import the `teetime` repo.
2. Framework preset auto-detects **Next.js**. Leave build/output settings default.
3. **Environment Variables** — add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled string |
   | `DIRECT_URL` | Neon direct string |
   | `AUTH_SECRET` | the 64-char hex you generated |
   | `CRON_SECRET` | any random string (used in step 6) |

4. **Deploy.** You get `https://teetime-xxxx.vercel.app`.

The schema is already in Neon from step 2, so the first deploy comes up working.
(On later schema changes: run `npm run db:push` locally against Neon, then redeploy.)

## 5. Make the demo easy to try

The deployed `/login` page has an **"Explore the demo — no signup"** button that
signs visitors into a shared demo account. That's the link to send people:

```
https://teetime-xxxx.vercel.app/login
```

Real email/phone OTP still works too if you set `RESEND_API_KEY` + `EMAIL_FROM`
(Resend free tier). Without it, OTP codes only appear in the server logs, so the
demo button is the way in.

## 6. Keep the simulator running

While anyone has the **My Searches** page open, the browser cranks `/api/tick`
every 20s, so a visitor who creates a search sees it get matched within a minute.

For activity even when nobody's looking, add a free external cron:

- <https://cron-job.org> → **Create cronjob**
  - URL: `https://teetime-xxxx.vercel.app/api/tick?key=<CRON_SECRET>&run=1`
  - Schedule: every 5 minutes
  - Method: GET

(Vercel's own Cron on the Hobby plan only runs once per day, which is why we use
an external one.)

## Notes / limits

- Neon free tier is 0.5 GB. Tee sheets are generated lazily (only for courses with
  active searches), so a demo stays well under that. If you ever want the whole
  map pre-populated with availability, run `FULL_SHEETS=1 npm run db:seed` — but
  that's ~1M rows, don't do it on the free tier.
- `/api/dev/login` is disabled when `NODE_ENV=production`; the demo button uses a
  proper server action instead.
- SMS is stubbed. Email needs Resend.
