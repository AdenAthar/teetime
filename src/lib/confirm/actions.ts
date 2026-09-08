"use server";

// The Confirm-flow golfer actions: confirm / cancel / modify an existing
// booking from the pre-round nudge link. Token-gated, not auth-gated — same
// as clicking a confirm link in an email — so these don't go through
// requireUser()/getCurrentUser().

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CONFIRM_STATUS, TEE_STATUS } from "@/lib/constants";
import { runMatcher } from "@/lib/simulator/engine";

type Result = { ok: boolean; error?: string };

function revalidate() {
  revalidatePath("/dev/outbox");
  revalidatePath("/searches");
}

async function findByToken(token: string) {
  return db.teeTime.findUnique({
    where: { confirmToken: token },
    include: { course: true },
  });
}

export async function getBookingByToken(token: string) {
  return findByToken(token);
}

const NOT_ACTIVE = { ok: false as const, error: "This confirmation link is no longer active." };

/**
 * Move an AWAITING_CONFIRMATION booking to a terminal confirm state, atomically.
 * The `confirmStatus` in the WHERE means a double-click, or a Confirm racing a
 * Cancel, only lands once — the loser gets count 0. Returns the freed row (for
 * the matcher) when `release` is set.
 */
async function resolveConfirm(token: string, next: string, release: boolean): Promise<Result> {
  const res = await db.teeTime.updateMany({
    where: { confirmToken: token, confirmStatus: CONFIRM_STATUS.AWAITING_CONFIRMATION },
    data: {
      confirmStatus: next,
      confirmRespondedAt: new Date(),
      ...(release ? { status: TEE_STATUS.OPEN, bookedByUserId: null } : {}),
    },
  });
  if (res.count === 0) return NOT_ACTIVE;
  if (release) {
    const opened = await findByToken(token);
    if (opened) await runMatcher(db, opened);
  }
  revalidate();
  return { ok: true };
}

export async function confirmBooking(token: string): Promise<Result> {
  return resolveConfirm(token, CONFIRM_STATUS.CONFIRMED, false);
}

/** Cancelling immediately frees the slot and hands it to the Waitlist matcher. */
export async function cancelBooking(token: string): Promise<Result> {
  return resolveConfirm(token, CONFIRM_STATUS.CANCELED, true);
}

/**
 * "Modify" is scoped down to: release this slot (same as cancel, so someone
 * else can have it) and send the golfer to Find a Tee Time to set up their
 * own search for a better time — reuses the existing Waitlist flow rather
 * than inventing a second booking-change mechanism.
 */
export async function modifyBooking(token: string): Promise<Result> {
  return resolveConfirm(token, CONFIRM_STATUS.MODIFY_REQUESTED, true);
}
