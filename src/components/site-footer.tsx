import Link from "next/link";
import { Logo, LogoMark } from "./logo";
import { InstagramIcon, LinkedInIcon } from "./icons";
import { BRAND } from "@/lib/constants";

function Bullet() {
  return <LogoMark className="mx-2 inline h-3 w-3 align-middle text-crimson" />;
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo tone="crimson" />
            <div className="mt-4 flex gap-3 text-crimson">
              <a href="#" aria-label="Instagram" className="grid h-8 w-8 place-items-center rounded-md border border-crimson/40 hover:bg-crimson-tint">
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="grid h-8 w-8 place-items-center rounded-md border border-crimson/40 hover:bg-crimson-tint">
                <LinkedInIcon className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">{BRAND.email}</p>
          </div>

          <FooterCol
            title="teetime"
            links={[{ label: "Get teetime for Your Course", href: "/find" }]}
          />
          <FooterCol
            title="My Account"
            links={[
              { label: "Profile", href: "/account/profile" },
              { label: "My Searches", href: "/searches" },
              { label: "Find a tee time", href: "/find" },
            ]}
          />
          <FooterCol
            title="Support"
            links={[
              { label: "FAQ", href: "/faq" },
              { label: "Need Help?", href: "/support" },
              { label: "Accessibility Statement", href: "/accessibility" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 text-center text-xs text-muted sm:flex-row sm:justify-between">
          <p>Copyright @ {new Date().getFullYear()} teetime — All Rights Reserved</p>
          <p className="flex flex-wrap items-center justify-center">
            <Link href="/legal/terms" className="hover:text-foreground">Terms &amp; Conditions</Link>
            <Bullet />
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy Notice</Link>
            <Bullet />
            <Link href="/legal/terms-of-use" className="hover:text-foreground">Terms of Use</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-crimson">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-foreground hover:text-crimson">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
