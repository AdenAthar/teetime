"use client";

import { Toggle } from "@/components/ui/toggle";
import { setNotificationPref } from "@/lib/account/actions";

export function NotificationPrefs({
  prefs,
}: {
  prefs: { notifyEmail: boolean; notifyText: boolean; notifyPrompts: boolean };
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-center text-3xl font-semibold text-foreground/90">
        Notification Preferences
      </h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-muted">Booking Notifications</h2>
        <Row
          label="Send via email"
          defaultOn={prefs.notifyEmail}
          onChange={(v) => setNotificationPref("notifyEmail", v)}
        />
        <Row
          label="Send via text"
          defaultOn={prefs.notifyText}
          onChange={(v) => setNotificationPref("notifyText", v)}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-muted">teetime Prompts</h2>
        <Row
          label="Receive reminder emails to create new searches"
          defaultOn={prefs.notifyPrompts}
          onChange={(v) => setNotificationPref("notifyPrompts", v)}
        />
      </section>
    </div>
  );
}

function Row({
  label,
  defaultOn,
  onChange,
}: {
  label: string;
  defaultOn: boolean;
  onChange: (v: boolean) => Promise<void> | void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3">
      <span className="text-[15px] text-foreground">{label}</span>
      <Toggle defaultOn={defaultOn} onChange={onChange} label={label} />
    </div>
  );
}
