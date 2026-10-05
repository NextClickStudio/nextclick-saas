// Test di isBot (lib/report.ts) — esegui con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

// lib/report.ts importa il database: qui ricopio solo la regola da verificare leggendo il sorgente
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../lib/report.ts", import.meta.url), "utf8");
const pattern = new RegExp(src.match(/return \/(.+)\/i\.test\(/)![1], "i");
const isBot = (ua: string | null) => !ua || pattern.test(ua);

test("anteprime dei link non contano come aperture", () => {
  for (const ua of [
    "WhatsApp/2.23.20.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    null,
  ]) assert.equal(isBot(ua), true, String(ua));
});

test("persone vere dai browser delle app contano", () => {
  for (const ua of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  ]) assert.equal(isBot(ua), false, ua);
});
