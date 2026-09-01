import Link from "next/link";
import { clsx } from "@/lib/clsx";

type Tab = "profile" | "searches" | "notifications" | "settings";

const ITEMS: { key: Tab; label: string; href: string; icon: string }[] = [
  { key: "profile", label: "My Profile", href: "/account/profile", icon: "👤" },
  { key: "searches", label: "My Searches", href: "/searches", icon: "📅" },
  { key: "notifications", label: "Notification Preferences", href: "/account/notifications", icon: "✉️" },
  { key: "settings", label: "Account Settings", href: "/account/settings", icon: "⚙️" },
];

export function AccountShell({
  active,
  children,
}: {
  active: Tab;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl bg-surface p-3 sm:p-5">
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <nav className="h-fit rounded-2xl bg-background p-3">
            <ul className="space-y-1">
              {ITEMS.map((it) => {
                const on = it.key === active;
                return (
                  <li key={it.key}>
                    <Link
                      href={it.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        on
                          ? "bg-crimson text-white"
                          : "text-foreground/80 hover:bg-surface",
                      )}
                    >
                      <span
                        className={clsx(
                          "grid h-7 w-7 place-items-center rounded-full text-xs",
                          on ? "bg-white/20" : "bg-foreground/10",
                        )}
                      >
                        {it.icon}
                      </span>
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="rounded-2xl bg-background p-5 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
