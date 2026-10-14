import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie policy" };

const STORAGE = [
  ["scopo:recent", "Your recent topics and their language, so you can jump back in."],
  ["scopo:lang", "The video language you picked last."],
  ["scopo:notice-ok", "Remembers that you closed the cookie notice."],
  ["scopo:install-dismissed", "Remembers that you closed the “install the app” tip."],
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      intro="Short answer: Scopo doesn't set any tracking or advertising cookies. Here's exactly what is stored and by whom."
    >
      <h2>What Scopo stores</h2>
      <p>
        Scopo itself sets no cookies. It uses your browser&apos;s local storage, which stays on your device and is
        never sent to us, for these preferences:
      </p>
      <div className="legal-table" role="table" aria-label="Local storage used by Scopo">
        {STORAGE.map(([key, purpose]) => (
          <div key={key} role="row">
            <code role="cell">{key}</code>
            <span role="cell">{purpose}</span>
          </div>
        ))}
      </div>
      <p>
        If you install Scopo on your home screen, your browser may also keep a small offline page so it can tell
        you when there&apos;s no connection.
      </p>

      <h2>Third parties</h2>
      <h3>YouTube</h3>
      <p>
        Videos are embedded with YouTube&apos;s privacy-enhanced mode (youtube-nocookie.com), which is designed to
        limit what YouTube stores when a video is merely shown on a page. When you play a video, YouTube and Google
        may set cookies or use local storage on their own domains (for example to remember playback settings, keep the service
        secure or measure views). This is governed by the{" "}
        <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">
          Google cookie policy
        </a>
        .
      </p>
      <h3>Hosting</h3>
      <p>
        While Scopo is in demo, access to some versions of the site may be limited to the team. In that case our
        hosting provider (Vercel) sets a strictly necessary cookie to remember that you&apos;re signed in to view
        it.
      </p>

      <h2>How to control it</h2>
      <p>
        You can delete Scopo&apos;s data at any time by clearing this site&apos;s data in your browser settings.
        You can block third-party cookies in your browser too; videos should still play, though some YouTube
        features may not work.
      </p>

      <h2>Questions</h2>
      <p>
        For anything about cookies or storage: <Contact />.
      </p>
    </LegalPage>
  );
}
