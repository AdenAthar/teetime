import { requireUser } from "@/lib/auth/session";
import { AccountShell } from "@/components/account-shell";
import { DeleteAccountButton } from "@/components/delete-account-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser();
  return (
    <AccountShell active="settings">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center text-3xl font-semibold text-foreground/90">
          Account Settings
        </h1>
        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium">Advanced Settings</h2>
          <div className="mt-4">
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
