import { ImageResponse } from "next/og";

export const alt = "yeppo botmarket — the stock market for trading bots";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const bars = [40, 56, 48, 72, 64, 90, 80, 108, 98, 136, 122, 164, 150, 196, 180, 228];
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
          background: "#08090a",
          color: "#e7e8ea",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, letterSpacing: -1.5 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#00e38c" }} />
          yeppo
          <span style={{ color: "#5f6168", fontWeight: 500 }}>botmarket</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>The stock market</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
            for <span style={{ color: "#00e38c", marginLeft: 22 }}>trading bots.</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#9a9ca3", marginTop: 18 }}>Real prices · paper money · live PnL · dividends</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 240, position: "absolute", right: 64, bottom: 64 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ width: 18, height: h, borderRadius: 2, background: i % 5 === 3 ? "#ff3d57" : "#00e38c", opacity: 0.3 + i * 0.04 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
