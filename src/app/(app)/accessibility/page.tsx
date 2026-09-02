import { ContentPage } from "@/components/content-page";
import { BRAND } from "@/lib/constants";

export const metadata = { title: "Accessibility Statement — teetime" };

export default function AccessibilityPage() {
  return (
    <ContentPage title="Accessibility Statement" updated="September 2026">
      <p>
        teetime is committed to making its product usable for as many golfers as possible,
        including people who rely on assistive technology. We aim to conform to the WCAG 2.1 AA
        guidelines.
      </p>
      <h2>What we do</h2>
      <p>
        We test with keyboard navigation and screen readers, maintain sufficient colour
        contrast, provide text alternatives for meaningful imagery, and label form fields
        programmatically.
      </p>
      <h2>Known gaps</h2>
      <p>
        The interactive course map is partially accessible; the full course directory below it
        is a complete keyboard- and screen-reader-navigable alternative.
      </p>
      <h2>Tell us about a barrier</h2>
      <p>
        If you hit something that doesn&apos;t work with your assistive technology, email{" "}
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> and we&apos;ll prioritise a fix.
      </p>
    </ContentPage>
  );
}
