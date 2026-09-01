import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { CHANNEL, type Channel } from "@/lib/constants";

const TTL_MS = 10 * 60 * 1000;

function hash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function normalizeIdentifier(channel: Channel, raw: string) {
  const v = raw.trim();
  if (channel === CHANNEL.EMAIL) return v.toLowerCase();
  const digits = v.replace(/[^\d]/g, "");
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

/**
 * Create + "deliver" an OTP. In dev (no RESEND_API_KEY) the code is returned so
 * the UI can show it and logged to the server console.
 */
export async function requestOtp(channel: Channel, identifierRaw: string) {
  const identifier = normalizeIdentifier(channel, identifierRaw);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  await db.otpToken.create({
    data: {
      identifier,
      channel,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const devMode = !process.env.RESEND_API_KEY;
  console.log(`[otp] ${channel} ${identifier} -> ${code}`);

  if (channel === CHANNEL.EMAIL && process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "teetime <onboarding@resend.dev>",
        to: identifier,
        subject: `Your teetime code: ${code}`,
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
      }),
    }).catch(() => {});
  }

  return { identifier, devCode: devMode ? code : undefined };
}

export async function verifyOtp(identifier: string, code: string) {
  const token = await db.otpToken.findFirst({
    where: {
      identifier,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.codeHash !== hash(code.trim())) return false;
  await db.otpToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
