"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { SEARCH_STATUS, TEE_STATUS, CONFIRM_STATUS } from "@/lib/constants";
import { dateAtMidnight } from "@/lib/time";
import { ensureSheetsAround } from "@/lib/simulator/engine";
import { sendBookingConfirmation } from "@/lib/notify";
import { parseSearchPrompt, type ParseResult } from "@/lib/ai/parse-search";
import { checkAiRateLimit, recordAiRequest } from "@/lib/ai/rate-limit";

type Result = { ok: boolean; error?: string; needsAuth?: boolean };

const createSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().min(8), // yyyy-mm-dd
  startMin: z.coerce.number().min(0).max(1439),
  endMin: z.coerce.number().min(0).max(1439),
  players: z.coerce.number().min(1).max(4),
  holes: z.coerce.number().refine((v) => v === 9 || v === 18),
  recurring: z.union([z.literal("on"), z.null(), z.string()]).optional(),
  daysOfWeek: z.array(z.coerce.number().min(0).max(6)).optional(),
});

export async function createSearch(_prev: Result, form: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true };

  const parsed = createSchema.safeParse({
    courseId: form.get("courseId"),
    date: form.get("date"),
    startMin: form.get("startMin"),
    endMin: form.get("endMin"),
    players: form.get("players"),
    holes: form.get("holes"),
    recurring: form.get("recurring"),
    daysOfWeek: form.getAll("daysOfWeek"),
  });
  if (!parsed.success) return { ok: false, error: "Check the search details and try again." };
  const d = parsed.data;
  if (d.endMin <= d.startMin) return { ok: false, error: "End time must be after start time." };

  const day = dateAtMidnight(new Date(d.date + "T00:00:00Z"));
  const recurring = d.recurring === "on";

  const course = await db.course.findUnique({
    where: { id: d.courseId },
    select: { id: true, slug: true },
  });
  if (!course) return { ok: false, error: "That course no longer exists." };

  await db.search.create({
    data: {
      userId: user.id,
      courseId: d.courseId,
      date: day,
      startMin: d.startMin,
      endMin: d.endMin,
      players: d.players,
      holes: d.holes,
      recurring,
      daysOfWeek: JSON.stringify(recurring ? (d.daysOfWeek ?? []) : []),
      status: SEARCH_STATUS.ACTIVE,
    },
  });

  // Generate this course's tee sheet now so the simulator has something to open.
  await ensureSheetsAround(db, course, day, 1);

  revalidatePath("/searches");
  return { ok: true };
}

/**
 * Natural-language search parsing. Returns draft searches for the user to review
 * and submit through `createSearch` — it never writes. Sign-in required so the
 * LLM call sits behind auth, and rate-limited per user + IP so a public deploy
 * can't be looped into a large Anthropic bill.
 */
export async function parseSearchFromPrompt(
  prompt: string,
): Promise<ParseResult | { ok: false; error: string; needsAuth?: true }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to use natural-language search.", needsAuth: true };

  const fwd = (await headers()).get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]!.trim() || null;

  const verdict = await checkAiRateLimit(user.id, ip);
  if (!verdict.ok) {
    return {
      ok: false,
      error: "You've hit the hourly limit for natural-language search — use the form below, or try again later.",
    };
  }
  await recordAiRequest(user.id, ip);

  return parseSearchPrompt(prompt);
}

async function ownSearch(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const s = await db.search.findUnique({ where: { id } });
  return s && s.userId === user.id ? s : null;
}

/**
 * Book the tee time a search most recently matched. Demo-only "booking": the
 * golfer takes the slot (TeeTime.bookedByUserId), it flips to BOOKED + confirm
 * status PENDING, and the search is done (SEARCH_STATUS.BOOKED). If the slot is
 * inside the Confirm window the next simulator tick sends the one pre-round
 * confirmation nudge (see the Confirm flow).
 */
export async function bookMatchedSlot(searchId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, error: "Log in to book." };

  const search = await db.search.findUnique({
    where: { id: searchId },
    include: { notifications: { orderBy: { sentAt: "desc" }, take: 1 } },
  });
  if (!search || search.userId !== user.id) return { ok: false, error: "Search not found." };

  const slotId = search.notifications[0]?.teeTimeId;
  if (!slotId) return { ok: false, error: "Nothing has matched this search yet." };

  const slot = await db.teeTime.findUnique({
    where: { id: slotId },
    include: { course: { select: { name: true, region: true } } },
  });
  if (!slot) return { ok: false, error: "That tee time is no longer on the sheet." };
  if (slot.status !== TEE_STATUS.OPEN || slot.bookedByUserId) {
    return { ok: false, error: "That tee time was just taken — another search may catch the next one." };
  }

  await db.teeTime.update({
    where: { id: slot.id },
    data: {
      status: TEE_STATUS.BOOKED,
      bookedByUserId: user.id,
      confirmStatus: CONFIRM_STATUS.PENDING,
      confirmToken: null,
      confirmRequestedAt: null,
      confirmRespondedAt: null,
    },
  });
  await db.search.update({ where: { id: search.id }, data: { status: SEARCH_STATUS.BOOKED } });

  // Booking receipt lands in the outbox now; the reconfirm nudge comes later.
  await sendBookingConfirmation(db, { search: { id: search.id }, teeTime: slot, user });

  revalidatePath("/searches");
  revalidatePath("/dev/outbox");
  return { ok: true };
}

export async function pauseSearch(id: string) {
  const s = await ownSearch(id);
  if (!s) return;
  await db.search.update({
    where: { id },
    data: {
      status:
        s.status === SEARCH_STATUS.PAUSED ? SEARCH_STATUS.ACTIVE : SEARCH_STATUS.PAUSED,
    },
  });
  revalidatePath("/searches");
}

export async function deleteSearch(id: string) {
  const s = await ownSearch(id);
  if (!s) return;
  await db.search.delete({ where: { id } });
  revalidatePath("/searches");
}

export async function reactivateSearch(id: string) {
  const s = await ownSearch(id);
  if (!s) return;
  await db.search.update({ where: { id }, data: { status: SEARCH_STATUS.ACTIVE } });
  revalidatePath("/searches");
}
