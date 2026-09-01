"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {} as never);
  const s = state as { error?: string };

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input name="firstName" placeholder="First Name *" required />
        <Input name="lastName" placeholder="Last Name *" required />
      </div>
      <Input name="email" type="email" placeholder="Email *" required />
      <Input name="phone" type="tel" placeholder="Cell Phone Number *" required />
      <label className="block text-xs text-muted">
        Birthday *
        <Input name="birthday" type="date" required />
      </label>
      <Input name="zip" placeholder="Zip/Postal Code" />
      <select
        name="gender"
        defaultValue=""
        className="w-full rounded-md border border-border px-3 py-2.5 text-sm text-muted outline-none focus:border-crimson"
      >
        <option value="" disabled hidden>
          Gender
        </option>
        <option>Male</option>
        <option>Female</option>
        <option>Non-binary</option>
        <option>Prefer not to say</option>
      </select>
      <select
        name="notify"
        defaultValue="Phone and Email"
        className="w-full rounded-md border border-border px-3 py-2.5 text-sm outline-none focus:border-crimson"
      >
        <option>Phone and Email</option>
        <option>Email</option>
        <option>Phone</option>
      </select>

      <p className="text-[11px] leading-snug text-muted">
        By signing up you agree to teetime&apos;s{" "}
        <Link href="/legal/terms" className="text-blue underline">
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-blue underline">
          Privacy Notice
        </Link>
        . You may receive SMS notifications and/or emails and can opt out any time. Message
        frequency varies based on tee time availability. Message and data rates may apply.
      </p>

      {s.error && <p className="text-sm text-crimson">{s.error}</p>}

      <button
        disabled={pending}
        className="w-full rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create My Account"}
      </button>
    </form>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-border px-3 py-2.5 text-sm outline-none focus:border-crimson"
    />
  );
}
