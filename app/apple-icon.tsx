// Icona per la schermata Home di iPhone/iPad (PNG generato dal marchio).
import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(markSvg(180)).toString("base64")}`;
  return new ImageResponse(<img src={src} width={180} height={180} alt="" />, size);
}
