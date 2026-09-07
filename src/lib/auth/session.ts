import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const COOKIE = "tt_session";
const MAX_AGE = 60 * 15; // 15 min

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-only-teetime-secret-change-me",
  );
}

/**
 * The signed cookie is only half of a session — it carries the `Session` row id
 * (`jti`). Every read re-checks that row still exists and hasn't expired, so
 * logging out (which deletes the row) or deleting the account (cascade) actually
 * invalidates an otherwise-still-valid JWT.
 */
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  const session = await db.session.create({ data: { userId, expiresAt } });

  // Opportunistically sweep expired rows so the table doesn't grow unbounded.
  if (Math.random() < 0.1) {
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(session.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const decoded = await decodeCookie();
  if (decoded) {
    await db.session.deleteMany({ where: { id: decoded.sessionId } });
  }
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Verify the cookie's signature/expiry and pull `sub` + `jti` out of it. */
async function decodeCookie(): Promise<{ userId: string; sessionId: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.sub;
    const sessionId = payload.jti;
    if (typeof userId !== "string" || typeof sessionId !== "string") return null;
    return { userId, sessionId };
  } catch {
    return null;
  }
}

/** The `Session` row for the current cookie, or null if it's gone/expired/mismatched. */
async function currentSession() {
  const decoded = await decodeCookie();
  if (!decoded) return null;
  const session = await db.session.findUnique({
    where: { id: decoded.sessionId },
    include: { user: true },
  });
  if (!session || session.userId !== decoded.userId || session.expiresAt < new Date()) {
    return null;
  }
  return session;
}

export async function getUserId(): Promise<string | null> {
  return (await currentSession())?.userId ?? null;
}

export async function getCurrentUser() {
  return (await currentSession())?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
