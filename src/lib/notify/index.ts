import type { PrismaClient } from "@prisma/client";
import { CHANNEL, NOTIFICATION_KIND } from "@/lib/constants";
import { minutesToLabel, minutesFromMidnight, formatDollars } from "@/lib/time";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type AlertInput = {
  search: { id: string; players: number; holes: number };
  user: {
    id: string;
    firstName: string;
    email: string;
    phone: string | null;
    notifyEmail: boolean;
    notifyText: boolean;
  };
  teeTime: {
    id: string;
    teeAt: Date;
    priceCents: number;
    players: number;
    course: { name: string; region: string; bookingUrl: string | null };
  };
};

function buildMessage(a: AlertInput) {
  const { teeTime, search } = a;
  const when = teeTime.teeAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = minutesToLabel(minutesFromMidnight(teeTime.teeAt));
  const subject = `Tee time available: ${teeTime.course.name} — ${when} at ${time}`;
  const link = teeTime.course.bookingUrl ?? "https://example.com/book";
  const body =
    `Hi ${a.user.firstName},\n\n` +
    `A tee time just opened up that matches your search:\n\n` +
    `  ${teeTime.course.name} (${teeTime.course.region})\n` +
    `  ${when} at ${time}\n` +
    `  ${search.players} player(s) · ${search.holes} holes · ${formatDollars(teeTime.priceCents)}/player\n\n` +
    `These go fast — book now: ${link}\n\n` +
    `You're receiving this because of a teetime search. Manage your searches in the app.`;
  return { subject, body };
}

async function deliverEmail(to: string, subject: string, body: string): Promise<"RESEND" | "DEV"> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "DEV";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "teetime <onboarding@resend.dev>",
        to,
        subject,
        text: body,
      }),
    });
    return res.ok ? "RESEND" : "DEV";
  } catch {
    return "DEV";
  }
}

/**
 * Fan out an alert across the user's enabled channels, recording a Notification
 * row per channel. Returns the number of notifications created.
 */
export async function sendAlert(db: PrismaClient, a: AlertInput): Promise<number> {
  const { subject, body } = buildMessage(a);
  const channels: string[] = [];
  if (a.user.notifyEmail) channels.push(CHANNEL.EMAIL);
  if (a.user.notifyText && a.user.phone) channels.push(CHANNEL.TEXT);
  if (channels.length === 0) channels.push(CHANNEL.EMAIL); // always leave a trace

  let count = 0;
  for (const channel of channels) {
    let provider = "DEV";
    if (channel === CHANNEL.EMAIL) provider = await deliverEmail(a.user.email, subject, body);
    // SMS is stubbed — Twilio needs a paid number + A2P registration.
    await db.notification.create({
      data: {
        userId: a.user.id,
        searchId: a.search.id,
        teeTimeId: a.teeTime.id,
        channel,
        kind: NOTIFICATION_KIND.MATCH,
        subject,
        body,
        provider,
      },
    });
    count++;
  }
  return count;
}

type ConfirmRequestInput = {
  teeTime: {
    id: string;
    teeAt: Date;
    players: number;
    holes: number;
    priceCents: number;
    course: { name: string; region: string };
  };
  user: {
    id: string;
    firstName: string;
    email: string;
    phone: string | null;
    notifyEmail: boolean;
    notifyText: boolean;
  };
  token: string;
};

function buildConfirmMessage(a: ConfirmRequestInput) {
  const { teeTime } = a;
  const when = teeTime.teeAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC", // day/window math is UTC everywhere — keep the copy matching
  });
  const time = minutesToLabel(minutesFromMidnight(teeTime.teeAt));
  const link = `${getBaseUrl()}/confirm/${a.token}`;
  const subject = `Please confirm your tee time: ${teeTime.course.name} — ${when} at ${time}`;
  const body =
    `Hi ${a.user.firstName},\n\n` +
    `You're booked to play soon — please confirm you're still coming:\n\n` +
    `  ${teeTime.course.name} (${teeTime.course.region})\n` +
    `  ${when} at ${time}\n` +
    `  ${teeTime.players} player(s) · ${teeTime.holes} holes · ${formatDollars(teeTime.priceCents)}/player\n\n` +
    `Confirm, cancel, or ask to change your time: ${link}\n\n` +
    `If we don't hear from you, this tee time will automatically be released ` +
    `to other golfers a few hours before your round.`;
  return { subject, body };
}

/**
 * The Confirm-side counterpart to sendAlert: a pre-round nudge to a golfer who
 * already holds this tee time, not a match against a Waitlist search — so
 * there's no Search row involved (searchId is null on the Notification).
 */
export async function sendConfirmationRequest(
  db: PrismaClient,
  a: ConfirmRequestInput,
): Promise<number> {
  const { subject, body } = buildConfirmMessage(a);
  const channels: string[] = [];
  if (a.user.notifyEmail) channels.push(CHANNEL.EMAIL);
  if (a.user.notifyText && a.user.phone) channels.push(CHANNEL.TEXT);
  if (channels.length === 0) channels.push(CHANNEL.EMAIL);

  let count = 0;
  for (const channel of channels) {
    let provider = "DEV";
    if (channel === CHANNEL.EMAIL) provider = await deliverEmail(a.user.email, subject, body);
    await db.notification.create({
      data: {
        userId: a.user.id,
        searchId: null,
        teeTimeId: a.teeTime.id,
        channel,
        kind: NOTIFICATION_KIND.CONFIRM_REQUEST,
        subject,
        body,
        provider,
      },
    });
    count++;
  }
  return count;
}
