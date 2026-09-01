import { requireUser } from "@/lib/auth/session";
import { AccountShell } from "@/components/account-shell";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <AccountShell active="profile">
      <ProfileForm
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ?? "",
          zip: user.zip ?? "",
          gender: user.gender ?? "",
          birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : "",
        }}
      />
    </AccountShell>
  );
}
