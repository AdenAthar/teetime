"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { startLogin } from "@/lib/auth/actions";
import { VerifyForm } from "./verify-form";

type Mode = "choose" | "email" | "phone";

export function LoginFlow() {
  const [mode, setMode] = useState<Mode>("choose");
  const [state, action, pending] = useActionState(startLogin, {} as never);
  const s = state as { error?: string; devCode?: string; identifier?: string; channel?: string };

  if (s.identifier && !s.error) {
    return <VerifyForm identifier={s.identifier} channel={s.channel} devCode={s.devCode} />;
  }

  if (mode === "email" || mode === "phone") {
    return (
      <form action={action} className="space-y-3 text-left">
        <input type="hidden" name="channel" value={mode === "email" ? "EMAIL" : "TEXT"} />
        <input
          name="identifier"
          type={mode === "email" ? "email" : "tel"}
          placeholder={mode === "email" ? "you@example.com" : "(555) 123-4567"}
          autoFocus
          className="w-full rounded-md border border-border px-3 py-2.5 text-sm outline-none focus:border-crimson"
        />
        {s.error && (
          <p className="text-sm text-crimson">
            {s.error}{" "}
            {s.error.includes("No account") && (
              <Link href="/signup" className="underline">
                Create one
              </Link>
            )}
          </p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send me a code"}
        </button>
        <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-muted">
          ← back
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setMode("email")}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark"
      >
        ✉️ Log In With Email
      </button>
      <button
        onClick={() => setMode("phone")}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark"
      >
        📞 Log In With Phone Number
      </button>
    </div>
  );
}
