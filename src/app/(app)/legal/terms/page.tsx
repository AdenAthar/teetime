import { ContentPage } from "@/components/content-page";

export const metadata = { title: "Terms & Conditions — teetime" };

export default function TermsPage() {
  return (
    <ContentPage title="Terms & Conditions" updated="September 2026">
      <p>
        These terms govern your use of teetime. By creating an account you agree to them. This
        is placeholder text for a recreation project and is not legal advice.
      </p>
      <h2>The service</h2>
      <p>
        teetime notifies you when tee times matching your saved searches become available at
        partner courses. We do not sell tee times, take payment, or guarantee that any
        particular slot will still be open when you act on an alert.
      </p>
      <h2>Your account</h2>
      <p>
        You are responsible for the accuracy of the contact details you provide and for
        activity under your account. You may delete your account at any time from Account
        Settings.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Don&apos;t scrape the service, resell alerts, or use automated tools to claim tee times
        in a way that violates a course&apos;s own booking rules.
      </p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use after a change means you accept the new version.</p>
    </ContentPage>
  );
}
