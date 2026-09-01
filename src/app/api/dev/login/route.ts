import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

/**
 * Dev-only shortcut: GET /api/dev/login?email=demo@teetime.app -> signed-in session.
 * Disabled when NODE_ENV=production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const email = new URL(request.url).searchParams.get("email") ?? "demo@teetime.app";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "no such user" }, { status: 404 });
  await createSession(user.id);
  return NextResponse.redirect(new URL("/searches", request.url));
}
