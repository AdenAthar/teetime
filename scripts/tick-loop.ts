/**
 * Runs the simulator crank on an interval against the running dev server.
 * Keeps tee-sheet availability churning so alerts actually fire.
 *
 * Run (in a second terminal, after `npm run dev`):  npm run tick
 */
import "dotenv/config";

const URL = process.env.TICK_URL ?? "http://localhost:3000/api/tick";
const EVERY_MS = Number(process.env.TICK_INTERVAL_MS ?? 20_000);

async function once() {
  try {
    const res = await fetch(URL, { method: "POST" });
    const json = await res.json();
    const t = new Date().toLocaleTimeString();
    console.log(
      `[${t}] cancellations=${json.cancellations} rebookings=${json.rebookings} matches=${json.matches} notifications=${json.notifications}`,
    );
  } catch (e) {
    console.error("tick failed — is `npm run dev` running?", (e as Error).message);
  }
}

console.log(`ticking ${URL} every ${EVERY_MS / 1000}s`);
void once();
setInterval(once, EVERY_MS);
