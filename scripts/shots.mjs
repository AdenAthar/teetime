import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "scratchpad-shots";
mkdirSync(OUT, { recursive: true });
const base = "http://localhost:3000";
const full = process.argv.includes("--full");

const authed = [
  ["searches", "/searches"],
  ["profile", "/account/profile"],
  ["notifications", "/account/notifications"],
  ["settings", "/account/settings"],
  ["outbox", "/dev/outbox"],
];
const anon = [
  ["find", "/find"],
  ["login", "/login"],
  ["signup", "/signup"],
];

const b = await chromium.launch();

// --- anonymous context ---
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  for (const [name, path] of anon) {
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    console.log("shot", name);
  }
  // create-search dialog
  await p.goto(base + "/find", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator("button[title^='Set an alert']").first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/create-search.png` });
  console.log("shot create-search");
  await ctx.close();
}

// --- authed context ---
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + "/api/dev/login?email=demo@teetime.app", { waitUntil: "networkidle" });

  // avatar menu open over the map (overlap regression check)
  await p.goto(base + "/find", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.locator("header button[aria-haspopup='menu']").click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/avatar-menu.png` });
  console.log("shot avatar-menu");

  for (const [name, path] of authed) {
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    console.log("shot", name);
  }
  await ctx.close();
}

await b.close();
