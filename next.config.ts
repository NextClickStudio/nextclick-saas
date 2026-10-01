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
];

const nextConfig: NextConfig = {
  env: Object.fromEntries(
    SERVER_ENV.filter((key) => process.env[key]).map((key) => [key, process.env[key] as string]),
  ),
};

export default nextConfig;
