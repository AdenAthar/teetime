"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, destroySession } from "@/lib/auth/session";

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  zip: z.string().optional(),
  birthday: z.string().optional(),
  gender: z.string().optional(),
});

export async function updateProfile(_prev: { ok?: boolean; error?: string }, form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "First and last name are required." };
  const d = parsed.data;
  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone || null,
      zip: d.zip || null,
      gender: d.gender || null,
      birthday: d.birthday ? new Date(d.birthday) : null,
    },
  });
  revalidatePath("/account/profile");
  return { ok: true };
}

export async function setNotificationPref(field: string, value: boolean) {
  const user = await getCurrentUser();
  if (!user) return;
  const allowed = ["notifyEmail", "notifyText", "notifyPrompts"] as const;
  if (!allowed.includes(field as (typeof allowed)[number])) return;
  await db.user.update({ where: { id: user.id }, data: { [field]: value } });
  revalidatePath("/account/notifications");
}

export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) return;
  await db.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login");
}
