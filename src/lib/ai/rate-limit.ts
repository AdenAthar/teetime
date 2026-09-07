import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Sliding-window rate limit for the natural-language search parser, so a public
 * deployment can't be looped into a large Anthropic bill. Backed by the
 * `AiRequestLog` table (one row per accepted parse) rather than in-memory, since
 * serverless invocations don't share memory. Raw SQL keeps it independent of the
 * generated Prisma client; `"AiRequestLog"` / `"createdAt"` quote the same on
 * Postgres and SQLite.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PER_USER = 12;
const PER_IP = 24;

export type RateVerdict = { ok: true } | { ok: false; retryAfterMin: number };

export async function checkAiRateLimit(userId: string, ip: string | null): Promise<RateVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);
  const keys = [`user:${userId}`, ...(ip ? [`ip:${ip}`] : [])];

  const rows = await db.$queryRaw<{ key: string; n: number }[]>(Prisma.sql`
    SELECT key, COUNT(*)::int AS n
    FROM "AiRequestLog"
    WHERE key IN (${Prisma.join(keys)}) AND "createdAt" >= ${since}
    GROUP BY key
  `);
  const count = (k: string) => rows.find((r) => r.key === k)?.n ?? 0;

  if (count(`user:${userId}`) >= PER_USER || (ip && count(`ip:${ip}`) >= PER_IP)) {
    return { ok: false, retryAfterMin: 60 };
  }
  return { ok: true };
}

export async function recordAiRequest(userId: string, ip: string | null): Promise<void> {
  const keys = [`user:${userId}`, ...(ip ? [`ip:${ip}`] : [])];
  for (const key of keys) {
    await db.$executeRaw`INSERT INTO "AiRequestLog" (id, key, "createdAt") VALUES (${randomUUID()}, ${key}, ${new Date()})`;
  }
  // Opportunistic cleanup — keep the table from growing without bound.
  if (Math.random() < 0.05) {
    await db.$executeRaw`DELETE FROM "AiRequestLog" WHERE "createdAt" < ${new Date(Date.now() - 2 * WINDOW_MS)}`;
  }
}
