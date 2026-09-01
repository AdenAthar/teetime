import Link from "next/link";
import { Logo } from "./logo";
import { HeaderNav, AvatarMenu } from "./site-header.client";
import { HeaderShell } from "./header-shell.client";
import { getCurrentUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <HeaderShell>
      <div className="flex h-16 w-full items-center justify-between px-5 sm:px-8">
        <Link href="/find" aria-label="teetime home">
          <Logo tone="dark" />
        </Link>

        <HeaderNav />

        {user ? (
          <AvatarMenu initials={initials!} name={`${user.firstName} ${user.lastName}`} />
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-crimson px-4 py-2 text-sm font-medium text-white hover:bg-crimson-dark"
          >
            Login
          </Link>
        )}
      </div>
    </HeaderShell>
  );
}
