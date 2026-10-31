import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "yeppo: know who made it. catch the move.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** the preview card on X */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#07060e",
          backgroundImage: "radial-gradient(circle at 15% 20%, #2a1d6b 0%, #07060e 45%)",
          color: "#f3f3f6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#5b6cff,#ff5fd2,#45d6ff)" }} />
          yeppo
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          <span>know who made it.</span>
          <span style={{ color: "#1fd47c" }}>catch the move.</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#a9a9bd" }}>
          {[
            ["#1fd47c", "Momentum"],
            ["#ffb23e", "Wait"],
            ["#ff5b3d", "Don't buy"],
          ].map(([c, t]) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: c }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
              {t}
            </span>
          ))}
          <span>pump.fun / GMGN / Axiom</span>
        </div>
      </div>
    ),
    size,
  );
}
