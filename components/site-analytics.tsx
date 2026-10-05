"use client";

import { Analytics } from "@vercel/analytics/next";

/** Visite anonime e senza cookie; i report privati (/r/...) restano fuori perché il loro indirizzo è segreto. */
export default function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (new URL(event.url).pathname.startsWith("/r/") ? null : event)} />;
}
