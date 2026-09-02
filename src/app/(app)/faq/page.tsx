import { ContentPage } from "@/components/content-page";

export const metadata = { title: "FAQ — teetime" };

export default function FaqPage() {
  return (
    <ContentPage title="Frequently Asked Questions">
      <h2>How does teetime work?</h2>
      <p>
        Pick a course, a date, and a time window, and we watch that course&apos;s tee sheet for
        you. The moment a matching time opens up — usually because someone cancelled — we send
        you an alert with a link to book it.
      </p>
      <h2>Does it cost anything?</h2>
      <p>teetime is free for golfers. Participating courses partner with us to fill cancellations.</p>
      <h2>How fast are the alerts?</h2>
      <p>
        We check partner tee sheets continuously and notify you within a minute of a slot
        opening. Open times go fast, so book as soon as you get the alert.
      </p>
      <h2>Can I set a standing weekly search?</h2>
      <p>
        Yes. When creating a search, toggle <em>recurring</em> and choose the days of the week
        you want us to watch.
      </p>
      <h2>How do I stop getting alerts?</h2>
      <p>
        Pause or delete any search from <a href="/searches">My Searches</a>, or turn channels
        off entirely under <a href="/account/notifications">Notification Preferences</a>.
      </p>
    </ContentPage>
  );
}
