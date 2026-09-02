"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { completeLogin, resendCode } from "@/lib/auth/actions";

export function VerifyForm({
  identifier,
  channel = "EMAIL",
  devCode,
}: {
  identifier: string;
  channel?: string;
  devCode?: string;
}) {
  const [state, action, pending] = useActionState(completeLogin, {} as never);
  const [resent, resendAction] = useActionState(resendCode, {} as never);
  const v = state as { error?: string };
  const r = resent as { devCode?: string };
  const shownCode = r.devCode ?? devCode;

  // green "message sent" toast — shown on load and re-shown on resend (form onSubmit)
  const [toast, setToast] = useState(true);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="text-center">
      <h1 className="text-xl text-foreground/90">Enter verification code</h1>
      <p className="mt-1 text-sm text-muted">Sent to {identifier}</p>

      {shownCode && (
        <p className="mt-3 rounded-md bg-blue-tint px-3 py-2 text-sm text-blue">
          Dev mode — your code is <b>{shownCode}</b>
        </p>
      )}

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="identifier" value={identifier} />
        <input
          name="code"
          inputMode="numeric"
          autoFocus
          placeholder="Verification Code *"
          className="w-full rounded-md border border-border px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-crimson"
        />
        {v.error && <p className="text-sm text-crimson">{v.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-md bg-crimson py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Verify"}
        </button>
      </form>

      <form action={resendAction} className="mt-2" onSubmit={() => setToast(true)}>
        <input type="hidden" name="identifier" value={identifier} />
        <input type="hidden" name="channel" value={channel} />
        <button className="w-full rounded-md border border-border py-2.5 text-sm font-semibold hover:bg-background">
          Resend Code
        </button>
      </form>

      <p className="mt-3 text-xs text-blue">
        If you are having any issues logging in, please{" "}
        <Link href="/support" className="underline">
          file a support ticket
        </Link>
        .
      </p>

      {toast && (
        <div className="tt-fade-in fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/25">✓</span>
          Verification message sent.
          <button
            onClick={() => setToast(false)}
            aria-label="Dismiss"
            className="ml-1 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
