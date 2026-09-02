import { ContentPage } from "@/components/content-page";
import { BRAND } from "@/lib/constants";

export const metadata = { title: "Privacy Notice — teetime" };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Notice" updated="September 2026">
      <p>Placeholder privacy notice for a recreation project.</p>
      <h2>What we collect</h2>
      <p>
        Your name, email, phone number, and optional zip code and birthday; the searches you
        create; and basic delivery logs for the alerts we send you.
      </p>
      <h2>How we use it</h2>
      <p>
        Only to run the service — matching your searches against tee sheets and delivering
        alerts by the channels you enable. We don&apos;t sell your data.
      </p>
      <h2>Notifications</h2>
      <p>
        You can turn email and text alerts on or off at any time under{" "}
        <a href="/account/notifications">Notification Preferences</a>. Text STOP to any SMS to
        opt out of texts.
      </p>
      <h2>Deleting your data</h2>
      <p>
        Deleting your account from Account Settings removes your profile and all of your
        searches. Contact <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> with any request.
      </p>
    </ContentPage>
  );
}
