// Anteprima quando il link di yeppo.it viene condiviso (WhatsApp, LinkedIn, Instagram...).
import { ImageResponse } from "next/og";
import { BRAND, markSvg } from "@/lib/brand";

export const alt = "Yeppo — Trova clienti B2B senza cold email";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg(120)).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: `radial-gradient(circle at 80% 10%, rgba(139,123,255,0.35), transparent 50%), radial-gradient(circle at 10% 100%, rgba(94,234,212,0.18), transparent 45%), #05060a`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={96} height={96} alt="" />
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>Yeppo</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>Il tuo commerciale AI.</div>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, color: BRAND.to }}>Senza cold email.</div>
        </div>
        <div style={{ fontSize: 30, color: "#a1a1aa" }}>Trova le aziende giuste, analizza i loro siti, ti dice chi contattare e come.</div>
      </div>
    ),
    size,
  );
}
