// the sites the extension works on (extension/manifest.json, content_scripts)
const TRADING_SITES = [
  "https://pump.fun", "https://*.pump.fun", "https://gmgn.ai", "https://*.gmgn.ai", "https://axiom.trade", "https://*.axiom.trade",
  "https://photon-sol.tinyastro.io", "https://bullx.io", "https://*.bullx.io", "https://dexscreener.com", "https://birdeye.so",
  "https://solscan.io", "https://jup.ag",
].join(" ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // only yeppo itself and the browser extension may frame the site; the extension's card on a trading page puts
  // /panel inside that page, and the browser checks every page above it, so /panel also allows those sites
  async headers() {
    return [
      {
        source: "/((?!panel).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' chrome-extension:" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/panel",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' chrome-extension: ${TRADING_SITES}` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
