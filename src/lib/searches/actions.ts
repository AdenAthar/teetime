"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { SEARCH_STATUS } from "@/lib/constants";
import { dateAtMidnight } from "@/lib/time";
import { ensureSheetsAround } from "@/lib/simulator/engine";

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

  const day = dateAtMidnight(new Date(d.date + "T00:00:00"));
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

async function ownSearch(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const s = await db.search.findUnique({ where: { id } });
  return s && s.userId === user.id ? s : null;
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
