import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="Scopo lets you learn by scrolling short videos on a topic you choose. This page explains, in plain words, what happens to your data when you use it."
    >
      <h2>The short version</h2>
      <ul>
        <li>No accounts, no sign-up, no ads, no analytics or tracking tools.</li>
        <li>Your saved paths, progress and video language stay on your device.</li>
        <li>What you search and what you tell us you already know are used only to build your path. We don&apos;t store them.</li>
        <li>Videos are played through YouTube&apos;s embedded player.</li>
      </ul>

      <h2>What we process and why</h2>
      <h3>1. Your topic and what you already know</h3>
      <p>
        When you build a path, the topic you typed, the language you picked, your level and what you wrote about
        what you already know are sent to our server. We use them to design the steps of your path and to search the
        YouTube Data API for videos for each step. To do this well, this information, together with the public titles
        and descriptions of the videos found, may also be sent to an AI service (Anthropic). Please don&apos;t write
        personal details in the &ldquo;what can you already do&rdquo; box. We don&apos;t keep a database of searches
        or paths, and we don&apos;t link them to you.
      </p>
      <h3>2. Technical data</h3>
      <p>
        Like any website, our hosting provider (Vercel) processes technical data such as your IP address, browser
        type and request logs to deliver the site, keep it secure and fix errors. These logs are kept for a limited
        time under the provider&apos;s own policies.
      </p>
      <h3>3. Data stored on your device</h3>
      <p>
        We use your browser&apos;s local storage to keep your saved paths and where you left off, your preferred video
        language and whether you&apos;ve dismissed our notices. This data never leaves your device and you can delete it at any
        time by clearing your browser&apos;s site data. See the <a href="/cookies">cookie policy</a> for the full
        list.
      </p>

      <h2>YouTube</h2>
      <p>
        Scopo uses YouTube API Services. Videos are shown with YouTube&apos;s embedded player in privacy-enhanced
        mode (youtube-nocookie.com) and thumbnails are loaded from YouTube&apos;s servers. When you watch a video,
        YouTube and Google may collect data under their own terms. By using Scopo you also agree to the{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>
        , and Google&apos;s handling of data is described in the{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google Privacy Policy
        </a>
        . Scopo does not access your YouTube or Google account.
      </p>

      <h2>Legal basis</h2>
      <p>
        Where the GDPR applies, we process the data above because it&apos;s needed to provide the service you ask
        for (finding and showing videos) and for our legitimate interest in running a secure, working website.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete or object to the processing
        of your personal data, and to complain to your data protection authority. Since we don&apos;t keep accounts
        or search history, what&apos;s stored about you lives on your own device and you can clear it yourself, for
        example by deleting a path from your library or clearing this site&apos;s data.
      </p>

      <h2>Children</h2>
      <p>
        Scopo is not meant for children under 13 (or the minimum age required in your country to use YouTube).
      </p>

      <h2>Changes and contact</h2>
      <p>
        We&apos;ll update this page as Scopo grows and change the date at the top when we do. For privacy
        questions: <Contact />.
      </p>
    </LegalPage>
  );
}
