import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NlSearchWidget } from "@/components/nl-search-widget";
import { AI_SEARCH_ENABLED } from "@/lib/ai/parse-search";
import { getUserId } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const signedIn = AI_SEARCH_ENABLED ? Boolean(await getUserId()) : false;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {AI_SEARCH_ENABLED && <NlSearchWidget signedIn={signedIn} />}
    </>
  );
}
