"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHANNEL } from "@/lib/constants";
import { requestOtp, verifyOtp, normalizeIdentifier } from "./otp";
import { createSession, destroySession } from "./session";

type State = { error?: string; devCode?: string; identifier?: string; channel?: string };

const startSchema = z.object({
  channel: z.enum(["EMAIL", "TEXT"]),
  identifier: z.string().min(3),
});

export async function startLogin(_prev: State, form: FormData): Promise<State> {
  const parsed = startSchema.safeParse({
    channel: form.get("channel"),
    identifier: form.get("identifier"),
  });
  if (!parsed.success) return { error: "Enter a valid email or phone number." };

  const { channel, identifier } = parsed.data;
  const norm = normalizeIdentifier(channel, identifier);

  const existing =
    channel === CHANNEL.EMAIL
      ? await db.user.findUnique({ where: { email: norm } })
      : await db.user.findFirst({ where: { phone: norm } });

  if (!existing) {
    return {
      error: "No account found. Create one first.",
      identifier: norm,
      channel,
    };
  }

  const { devCode } = await requestOtp(channel, identifier);
  return { devCode, identifier: norm, channel };
}

const verifySchema = z.object({
  identifier: z.string().min(3),
  code: z.string().min(4),
});

export async function completeLogin(_prev: State, form: FormData): Promise<State> {
  const parsed = verifySchema.safeParse({
    identifier: form.get("identifier"),
    code: form.get("code"),
  });
  if (!parsed.success) return { error: "Enter the code we sent you." };

  const ok = await verifyOtp(parsed.data.identifier, parsed.data.code);
  if (!ok) return { error: "That code is wrong or expired.", identifier: parsed.data.identifier };

  const user =
    (await db.user.findUnique({ where: { email: parsed.data.identifier } })) ??
    (await db.user.findFirst({ where: { phone: parsed.data.identifier } }));
  if (!user) return { error: "Account not found." };

  await createSession(user.id);
  redirect("/searches");
}

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  birthday: z.string().optional(),
  zip: z.string().optional(),
  gender: z.string().optional(),
  notify: z.string().optional(),
});

export async function signUp(_prev: State, form: FormData): Promise<State> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fill in all required fields." };
  const d = parsed.data;
  const email = d.email.toLowerCase();
  const phone = normalizeIdentifier(CHANNEL.TEXT, d.phone);

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists.", channel: "EMAIL", identifier: email };
  }

  const notify = d.notify ?? "Phone and Email";
  const user = await db.user.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email,
      phone,
      zip: d.zip || null,
      gender: d.gender || null,
      birthday: d.birthday ? new Date(d.birthday) : null,
      notifyEmail: notify.includes("Email"),
      notifyText: notify.includes("Phone"),
    },
  });

  void user;
  const { devCode } = await requestOtp(CHANNEL.EMAIL, email);
  const params = new URLSearchParams({ to: email, channel: "EMAIL" });
  if (devCode) params.set("dev", devCode);
  redirect(`/verify?${params.toString()}`);
}

export async function resendCode(_prev: State, form: FormData): Promise<State> {
  const identifier = String(form.get("identifier") ?? "");
  const channel = (String(form.get("channel") ?? "EMAIL") === "TEXT"
    ? CHANNEL.TEXT
    : CHANNEL.EMAIL) as "EMAIL" | "TEXT";
  if (!identifier) return { error: "Missing identifier." };
  const { devCode } = await requestOtp(channel, identifier);
  return { devCode, identifier, channel };
}

export async function logOut() {
  await destroySession();
  redirect("/login");
}

/**
 * One-click demo access for the public deployment — no signup, no OTP.
 * Signs the visitor into a shared "Demo Golfer" account.
 */
export async function enterDemo() {
  const email = "demo@teetime.app";
  const user =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.create({
      data: {
        firstName: "Demo",
        lastName: "Golfer",
        email,
        phone: "+15095551234",
        zip: "99163",
      },
    }));
  await createSession(user.id);
  redirect("/searches");
}
