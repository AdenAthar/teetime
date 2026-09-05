"use server";

// The Confirm-flow golfer actions: confirm / cancel / modify an existing
// booking from the pre-round nudge link. Token-gated, not auth-gated — same
// as clicking a confirm link in an email — so these don't go through
// requireUser()/getCurrentUser().

import { db } from "@/lib/db";
import { CONFIRM_STATUS, TEE_STATUS } from "@/lib/constants";
import { runMatcher } from "@/lib/simulator/engine";

type Result = { ok: boolean; error?: string };

async function findByToken(token: string) {
  return db.teeTime.findUnique({
    where: { confirmToken: token },
    include: { course: true },
  });
}

export async function getBookingByToken(token: string) {
  return findByToken(token);
}

export async function confirmBooking(token: string): Promise<Result> {
  const t = await findByToken(token);
  if (!t || t.confirmStatus !== CONFIRM_STATUS.AWAITING_CONFIRMATION) {
    return { ok: false, error: "This confirmation link is no longer active." };
  }
  await db.teeTime.update({
    where: { id: t.id },
    data: { confirmStatus: CONFIRM_STATUS.CONFIRMED, confirmRespondedAt: new Date() },
  });
  return { ok: true };
}

/** Cancelling immediately frees the slot and hands it to the Waitlist matcher. */
export async function cancelBooking(token: string): Promise<Result> {
  const t = await findByToken(token);
  if (!t || t.confirmStatus !== CONFIRM_STATUS.AWAITING_CONFIRMATION) {
    return { ok: false, error: "This confirmation link is no longer active." };
  }
  const opened = await db.teeTime.update({
    where: { id: t.id },
    data: {
      status: TEE_STATUS.OPEN,
      confirmStatus: CONFIRM_STATUS.CANCELED,
      confirmRespondedAt: new Date(),
    },
    include: { course: true },
  });
  await runMatcher(db, opened);
  return { ok: true };
}

/**
 * "Modify" is scoped down to: release this slot (same as cancel, so someone
 * else can have it) and send the golfer to Find a Tee Time to set up their
 * own search for a better time — reuses the existing Waitlist flow rather
 * than inventing a second booking-change mechanism.
 */
export async function modifyBooking(token: string): Promise<Result> {
  const t = await findByToken(token);
  if (!t || t.confirmStatus !== CONFIRM_STATUS.AWAITING_CONFIRMATION) {
    return { ok: false, error: "This confirmation link is no longer active." };
  }
  const opened = await db.teeTime.update({
    where: { id: t.id },
    data: {
      status: TEE_STATUS.OPEN,
      confirmStatus: CONFIRM_STATUS.MODIFY_REQUESTED,
      confirmRespondedAt: new Date(),
    },
    include: { course: true },
  });
  await runMatcher(db, opened);
  return { ok: true };
}
