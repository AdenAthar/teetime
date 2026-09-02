import { ContentPage } from "@/components/content-page";

export const metadata = { title: "Terms of Use — teetime" };

export default function TermsOfUsePage() {
  return (
    <ContentPage title="Terms of Use" updated="September 2026">
      <p>
        These website terms of use cover browsing teetime.app. For the terms that govern using
        the alerting service with an account, see{" "}
        <a href="/legal/terms">Terms &amp; Conditions</a>. Placeholder text for a recreation
        project.
      </p>
      <h2>Content</h2>
      <p>
        Course listings, availability, and pricing shown here are provided for convenience and
        may be out of date. Always confirm on the course&apos;s own booking site.
      </p>
      <h2>Intellectual property</h2>
      <p>
        The teetime name, logo, and site design are ours. Course names and locations are
        factual information.
      </p>
      <h2>No warranty</h2>
      <p>
        The site is provided &quot;as is&quot; without warranty of any kind, and we are not
        liable for missed or late alerts.
      </p>
    </ContentPage>
  );
}
