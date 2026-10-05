import type { NextConfig } from "next";

// Variabili segrete lette durante la build (da Vercel o da un file .env.production
// caricato solo su Vercel) e rese disponibili al codice server anche a runtime.
// Sono usate solo in file "server-only": non finiscono mai nel browser.
const SERVER_ENV = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_CONFIG_ID",
  "CRON_SECRET",
  "STRIPE_AUTOMATIC_TAX",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  env: Object.fromEntries(
    SERVER_ENV.filter((key) => process.env[key]).map((key) => [key, process.env[key] as string]),
  ),
};

export default nextConfig;
