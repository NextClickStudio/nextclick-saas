import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="By using Scopo you agree to these terms. They're short because Scopo is a free demo, but please read them."
    >
      <h2>1. A free demo</h2>
      <p>
        Scopo is free to use while it&apos;s in demo. It&apos;s a work in progress: features may change, break or
        be removed at any time, and the service may be unavailable without notice. It&apos;s provided &ldquo;as
        is&rdquo;, without warranties of any kind.
      </p>

      <h2>2. Videos belong to their creators</h2>
      <p>
        Scopo doesn&apos;t host any videos. It finds public videos on YouTube and shows them with YouTube&apos;s
        embedded player. Videos remain the property of their creators and are subject to the{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>
        , which you agree to by watching them. We don&apos;t create, review in advance or endorse the content. To
        report a video, use YouTube&apos;s own reporting tools.
      </p>

      <h2>3. Learning, not professional advice</h2>
      <p>
        Videos are for general learning and inspiration. They aren&apos;t professional advice (financial, medical,
        legal or otherwise). If you try what you see, from snowboard tricks to knife skills, do it safely and
        within your limits.
      </p>

      <h2>4. Curation isn&apos;t perfect</h2>
      <p>
        We work hard to put the steps of your path in a sensible order, to show only videos that match each step and
        your language, and to filter out clickbait, but automatic selection can make mistakes. Use the
        &ldquo;Off-topic&rdquo; button to remove anything that doesn&apos;t belong, and mark steps you already know.
      </p>

      <h2>5. Saved paths</h2>
      <p>
        Your paths and progress are saved only in this browser on this device. If you clear your browser data or
        switch device, they won&apos;t come with you. During the demo we can&apos;t recover lost paths.
      </p>

      <h2>6. Fair use of the service</h2>
      <p>
        Please don&apos;t misuse Scopo: no automated scraping, no attempts to overload or break the service, and
        nothing illegal.
      </p>

      <h2>7. Age</h2>
      <p>You must be at least 13, or the minimum age required in your country to use YouTube.</p>

      <h2>8. Liability</h2>
      <p>
        To the extent permitted by law, we&apos;re not liable for any damage arising from the use of Scopo or of
        third-party content shown in it. Nothing in these terms limits rights you have as a consumer under the law
        of your country.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms as Scopo evolves, and we&apos;ll change the date at the top when we do. Complete
        terms will be published before any public, non-demo launch. Questions: <Contact />.
      </p>
    </LegalPage>
  );
}
