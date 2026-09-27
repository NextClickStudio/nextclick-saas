import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2eee6", color: "#0e0e0d", fontSize: 118, fontWeight: 900 }}>
        M
      </div>
    ),
    size,
  );
}
