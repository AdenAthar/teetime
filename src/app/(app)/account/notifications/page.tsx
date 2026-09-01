import { requireUser } from "@/lib/auth/session";
import { AccountShell } from "@/components/account-shell";
import { NotificationPrefs } from "@/components/notification-prefs";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  return (
    <AccountShell active="notifications">
      <NotificationPrefs
        prefs={{
          notifyEmail: user.notifyEmail,
          notifyText: user.notifyText,
          notifyPrompts: user.notifyPrompts,
        }}
      />
    </AccountShell>
  );
}
