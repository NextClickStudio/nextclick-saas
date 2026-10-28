import { ImageResponse } from "next/og";

export const alt = "yeppo — memecoin arena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const bars = [38, 52, 44, 70, 62, 88, 76, 104, 96, 132, 118, 160, 150, 190, 176, 220];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#050507",
          color: "#ececf3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 700, letterSpacing: -2 }}>
          yeppo
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#c6ff1a", boxShadow: "0 0 24px #c6ff1a" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            Memecoin <span style={{ color: "#c6ff1a", marginLeft: 20 }}>reali.</span>
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            Soldi <span style={{ color: "#ff2d75", marginLeft: 20 }}>finti.</span>
          </div>
          <div style={{ fontSize: 30, color: "#9a9aae", marginTop: 18 }}>Stanze da 50 trader · mercato live · classifica in diretta</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 230, position: "absolute", right: 64, bottom: 64 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{ width: 18, height: h, borderRadius: 3, background: i % 4 === 2 ? "#ff2d75" : "#c6ff1a", opacity: 0.35 + i * 0.04 }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
