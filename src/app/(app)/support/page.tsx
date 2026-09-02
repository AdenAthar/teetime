import { ContentPage } from "@/components/content-page";
import { BRAND } from "@/lib/constants";

export const metadata = { title: "Support — teetime" };

export default function SupportPage() {
  return (
    <ContentPage title="Need Help?">
      <p>
        Something not working, or a tee time alert that didn&apos;t arrive? We want to hear
        about it.
      </p>
      <h2>Email us</h2>
      <p>
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> — include your account email and, if
        it&apos;s about a specific search, the course and date. We usually reply within one
        business day.
      </p>
      <h2>Common fixes</h2>
      <p>
        <strong>Not getting alerts?</strong> Check that email/text are enabled under{" "}
        <a href="/account/notifications">Notification Preferences</a> and that your search
        hasn&apos;t expired.
      </p>
      <p>
        <strong>Can&apos;t log in?</strong> Request a fresh code on the login screen — codes
        expire after 10 minutes.
      </p>
    </ContentPage>
  );
}
