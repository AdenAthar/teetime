"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { logOut } from "@/lib/auth/actions";

const LINKS = [
  { href: "/find", label: "Find a Tee Time" },
  { href: "/searches", label: "My Searches" },
];

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-10 sm:flex">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "relative py-1 text-[17px] font-medium text-foreground transition-colors hover:text-crimson",
              active && "text-foreground",
            )}
          >
            {l.label}
            {active && (
              <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-crimson" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AvatarMenu({ initials, name }: { initials: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/30 text-sm font-semibold text-foreground hover:bg-foreground/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1190]" onClick={() => setOpen(false)} />
          <div className="tt-fade-in absolute right-0 z-[1210] mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
            <div className="px-4 py-2 text-xs text-muted">{name}</div>
            <MenuLink href="/account/profile" label="Profile" />
            <MenuLink href="/searches" label="My Searches" />
            <MenuLink href="/account/notifications" label="Notification Preferences" />
            <MenuLink href="/account/settings" label="Account Settings" />
            <MenuLink href="/dev/outbox" label="Dev Outbox" />
            <form action={logOut}>
              <button className="block w-full px-4 py-2 text-left text-sm text-crimson hover:bg-crimson-tint">
                Log out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block px-4 py-2 text-sm text-foreground hover:bg-background">
      {label}
    </Link>
  );
}
