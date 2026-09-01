"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/lib/account/actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded bg-crimson px-4 py-2 text-sm font-semibold uppercase text-white hover:bg-crimson-dark"
      >
        Delete Account
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        This permanently deletes your account and all of your searches. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => start(() => void deleteAccount())}
          disabled={pending}
          className="rounded bg-crimson px-4 py-2 text-sm font-semibold uppercase text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded border border-border px-4 py-2 text-sm font-semibold uppercase text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
