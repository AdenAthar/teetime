"use client";

import { useActionState, useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import { updateProfile } from "@/lib/account/actions";

type U = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zip: string;
  gender: string;
  birthday: string;
};

export function ProfileForm({ user }: { user: U }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateProfile, {} as { ok?: boolean; error?: string });

  return (
    <form
      action={action}
      onSubmit={() => setEditing(false)}
      className="mx-auto max-w-2xl"
    >
      <h1 className="text-center text-3xl font-semibold text-foreground/90">My Profile</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="First Name" name="firstName" defaultValue={user.firstName} disabled={!editing} required />
        <Field label="Last Name" name="lastName" defaultValue={user.lastName} disabled={!editing} required />
        <Field label="Email" name="email" defaultValue={user.email} disabled />
        <Field label="Phone Number" name="phone" defaultValue={user.phone} disabled={!editing} />
        <Field label="Zip/Postal Code" name="zip" defaultValue={user.zip} disabled={!editing} optional />
        <Field label="Birthday" name="birthday" type="date" defaultValue={user.birthday} disabled={!editing} />
      </div>

      <div className="mt-4">
        <SelectField
          label="Gender"
          name="gender"
          optional
          disabled={!editing}
          defaultValue={user.gender}
          options={["Male", "Female", "Non-binary", "Prefer not to say"]}
        />
      </div>

      {state.error && <p className="mt-3 text-center text-sm text-crimson">{state.error}</p>}
      {state.ok && <p className="mt-3 text-center text-sm text-green-600">Profile saved.</p>}

      <div className="mt-6 flex justify-center gap-3">
        {editing ? (
          <>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-blue px-6 py-2 text-sm font-semibold uppercase text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-border px-6 py-2 text-sm font-semibold uppercase text-muted"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded bg-blue px-6 py-2 text-sm font-semibold uppercase text-white"
          >
            Edit
          </button>
        )}
      </div>
    </form>
  );
}
