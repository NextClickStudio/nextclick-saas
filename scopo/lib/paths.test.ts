import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { heuristicCurate } from "./curator.ts";
import { decodeCursor, encodeCursor, nextQueryIndex } from "./cursor.ts";
import { aiPlan, buildPlan, demoPlan, templatePlan } from "./curriculum.ts";
import { fetchStepVideos } from "./feed.ts";
import { GEMINI_KEY_ENVS, generateJson, type GeminiSchema } from "./gemini.ts";
import { isLangCode, langFromLocale } from "./languages.ts";
import { estimateMinutes, positiveClauses, startFromKnowledge } from "./paths.ts";
import { matchSeedTopic, seedSteps } from "./seed.ts";
import { decodeEntities, keywordHits, looksLikeBait, parseIsoDuration, topicKeywords } from "./text.ts";
import type { Candidate } from "./youtube.ts";

for (const env of GEMINI_KEY_ENVS) delete process.env[env];
delete process.env.GEMINI_MODEL;
delete process.env.YOUTUBE_API_KEY;

describe("text", () => {
  it("parses YouTube ISO durations", () => {
    assert.equal(parseIsoDuration("PT45S"), 45);
    assert.equal(parseIsoDuration("PT1M5S"), 65);
    assert.equal(parseIsoDuration("garbage"), 0);
  });

  it("decodes HTML entities in titles", () => {
    assert.equal(decodeEntities("L&#39;articolo &quot;12&quot; &amp; altro"), `L'articolo "12" & altro`);
  });

  it("flags rage-bait titles but not explainers", () => {
    assert.ok(looksLikeBait("Bocchino umilia Formigli in diretta #politica"));
    assert.ok(looksLikeBait("Snowboard fail GONE WRONG"));
    assert.ok(!looksLikeBait("How to ollie on a snowboard"));
  });

  it("keeps only the words that say what the topic is", () => {
    assert.deepEqual(topicKeywords("guitar lesson for beginners"), ["guitar"]);
    assert.deepEqual(topicKeywords("impara la chitarra"), ["chitarra"]);
    assert.equal(keywordHits(["snowboarding"], "Easy SNOWBOARD trick"), 1);
  });
});

describe("languages", () => {
  it("maps browser locales and validates codes", () => {
    assert.equal(langFromLocale("it-IT"), "it");
    assert.equal(langFromLocale("ja-JP"), "en");
    assert.ok(isLangCode("any"));
    assert.ok(!isLangCode("xx"));
  });
});

describe("cursor", () => {
  it("round-trips state and rejects garbage", () => {
    const state = { q: ["a", "b"], i: 1, t: { "0": "TOKEN", "1": null } };
    assert.deepEqual(decodeCursor(encodeCursor(state)), state);
    assert.equal(decodeCursor("not-base64-json"), null);
  });

  it("skips exhausted queries", () => {
    assert.equal(nextQueryIndex({ q: ["a", "b", "c"], i: 0, t: { "0": null } }), 1);
    assert.equal(nextQueryIndex({ q: ["a", "b"], i: 0, t: { "0": null, "1": null } }), -1);
  });
});

describe("scan: where to start", () => {
  const guitar = seedSteps(matchSeedTopic("guitar")!);

  it("ignores things the learner says they can't do", () => {
    assert.deepEqual(positiveClauses("I can tune, but barre chords are hard."), ["i can tune"]);
    assert.deepEqual(positiveClauses("so l'ollie ma non so fare i 180"), ["so l ollie"]);
  });

  it("starts after the last step they already know", () => {
    const r = startFromKnowledge(guitar, "new", "I know open chords and can tune my guitar, but barre chords are hard");
    assert.equal(guitar[r.startIndex].title, "Clean chord changes");
  });

  it("uses the level as a minimum starting point", () => {
    assert.equal(startFromKnowledge(guitar, "new", "").startIndex, 0);
    assert.equal(startFromKnowledge(guitar, "intermediate", "").startIndex, Math.floor(guitar.length / 2));
    assert.equal(startFromKnowledge(guitar, "advanced", "").startIndex, Math.floor(guitar.length * 0.75));
  });

  it("never starts past the last step", () => {
    const r = startFromKnowledge(guitar, "advanced", "I can play songs and solo with licks");
    assert.equal(r.startIndex, guitar.length - 1);
  });
});

describe("demo paths", () => {
  it("builds an ordered path with hand-picked videos", () => {
    const res = demoPlan({ topic: "snowboard tricks", lang: "en", level: "new", known: "" });
    assert.ok("plan" in res);
    if (!("plan" in res)) return;
    assert.equal(res.plan.title, "Snowboarding");
    assert.equal(res.plan.mode, "demo");
    assert.equal(res.plan.startIndex, 0);
    assert.ok(res.plan.steps.length >= 5);
    assert.ok(res.plan.steps.every((s) => (s.videos?.length ?? 0) > 0));
  });

  it("reads what the learner already knows", () => {
    const res = demoPlan({ topic: "snowboard", lang: "en", level: "basics", known: "I can link turns and do small ollies" });
    assert.ok("plan" in res && res.plan.steps[res.plan.startIndex].title === "Ollie & nollie");
  });

  it("says when a demo path exists only in another language", () => {
    const res = demoPlan({ topic: "impara la chitarra", lang: "it", level: "new", known: "" });
    assert.ok("plan" in res && /English/.test(res.plan.notice ?? ""));
  });

  it("explains itself when the topic is not in the demo", () => {
    const res = demoPlan({ topic: "photography", lang: "en", level: "new", known: "" });
    assert.ok("notice" in res);
    assert.ok("suggestions" in res && res.suggestions.some((s) => s.topic === "Guitar"));
  });

  it("estimates time from the videos", () => {
    assert.ok(estimateMinutes(seedSteps(matchSeedTopic("chess")!)) > 5);
  });
});

describe("template paths (YouTube on, no AI)", () => {
  it("writes the step searches in the chosen language", () => {
    const plan = templatePlan({ topic: "fotografia", lang: "it", level: "advanced", known: "" });
    assert.equal(plan.steps[0].queries[0], "fotografia per principianti");
    assert.equal(plan.startIndex, Math.floor(plan.steps.length * 0.75));
  });

  it("is what buildPlan returns when only YouTube is configured", async () => {
    process.env.YOUTUBE_API_KEY = "KEY";
    try {
      const res = await buildPlan({ topic: "photography", lang: "en", level: "new", known: "" });
      assert.ok("plan" in res && res.plan.mode === "template");
    } finally {
      delete process.env.YOUTUBE_API_KEY;
    }
  });
});

describe("curation without AI", () => {
  const base = { channel: "c", thumbnail: "", durationSec: 30, description: "", tags: [] as string[] };

  it("drops bait and anything that doesn't name the topic", () => {
    const out = heuristicCurate("snowboard: The ollie", [
      { ...base, id: "1", title: "Best ski resorts in Europe" },
      { ...base, id: "2", title: "Snowboard fail GONE WRONG" },
      { ...base, id: "3", title: "How to ollie on a snowboard" },
      { ...base, id: "4", title: "Pop higher", tags: ["snowboarding"] },
    ] satisfies Candidate[]);
    assert.deepEqual(
      out.map((v) => v.id),
      ["3", "4"],
    );
  });
});

describe("step videos (YouTube simulato)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("keeps short, on-topic videos in the chosen language", async () => {
    const searches: Array<{ q: string; lang: string | null }> = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        searches.push({ q: url.searchParams.get("q")!, lang: url.searchParams.get("relevanceLanguage") });
        const n = searches.length;
        const item = (id: string, title: string, live = "none") => ({
          id: { videoId: `${id}-${n}` },
          snippet: { title, channelTitle: "Channel", liveBroadcastContent: live, thumbnails: {} },
        });
        return Response.json({
          nextPageToken: `tok-${n}`,
          items: [
            item("short", "Barre chords on guitar made easy"),
            item("long", "Guitar barre chords full lesson"),
            item("live", "Guitar live", "live"),
            item("foreign", "Accordi barrè chitarra"),
            item("offtopic", "My morning routine"),
          ],
        });
      }
      const ids = new URL(String(input)).searchParams.get("id")!.split(",");
      return Response.json({
        items: ids.map((id) => ({
          id,
          contentDetails: { duration: id.startsWith("long") ? "PT12M" : "PT50S" },
          snippet: { defaultAudioLanguage: id.startsWith("foreign") ? "it" : "en-US", tags: [] },
        })),
      });
    }) as typeof fetch;

    const res = await fetchStepVideos("KEY", {
      topic: "guitar",
      step: "Barre chords",
      queries: ["guitar barre chords"],
      lang: "en",
    });
    assert.deepEqual(
      res.items.map((v) => v.id),
      ["short-1", "short-2"],
    );
    assert.deepEqual(
      searches.map((s) => s.q),
      ["guitar barre chords", "guitar barre chords"],
    );
    assert.equal(searches[0].lang, "en");
    assert.ok(res.cursor);
  });
});

describe("Gemini (API simulata)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  });

  const reply = (value: unknown) =>
    Response.json({
      candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: JSON.stringify(value) }] } }],
    });

  it("sends the key in a header, asks for JSON and skips models that don't exist", async () => {
    process.env.GEMINI_API_KEY = "GKEY";
    const calls: Array<{ url: string; key: string | null; body: { generationConfig: { responseMimeType: string } } }> = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, key: new Headers(init?.headers).get("x-goog-api-key"), body: JSON.parse(String(init?.body)) });
      if (url.includes("gemini-flash-latest")) {
        return Response.json({ error: { message: "model not found" } }, { status: 404 });
      }
      return reply({ ok: "yes" });
    }) as typeof fetch;

    const out = await generateJson("hi", { type: "OBJECT", properties: { ok: { type: "STRING" } }, required: ["ok"] }, (v) => v);
    assert.deepEqual(out.value, { ok: "yes" });
    assert.equal(out.model, "gemini-2.5-flash");
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.key === "GKEY" && !c.url.includes("GKEY")));
    assert.equal(calls[0].body.generationConfig.responseMimeType, "application/json");
  });

  it("asks for short thinking and drops it when the model refuses", async () => {
    process.env.GEMINI_API_KEY = "GKEY";
    const configs: unknown[] = [];
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
      const config = JSON.parse(String(init?.body)).generationConfig;
      configs.push(config.thinkingConfig ?? null);
      if (config.thinkingConfig) {
        return Response.json({ error: { message: "Thinking level is not supported for this model." } }, { status: 400 });
      }
      return reply({ ok: "yes" });
    }) as typeof fetch;

    const schema: GeminiSchema = { type: "OBJECT", properties: { ok: { type: "STRING" } }, required: ["ok"] };
    assert.deepEqual((await generateJson("hi", schema, (v) => v)).value, { ok: "yes" });
    assert.deepEqual(configs, [{ thinkingLevel: "low" }, null]);
    await generateJson("again", schema, (v) => v);
    assert.deepEqual(configs.at(-1), null);
  });

  it("designs a path and picks where to start", async () => {
    process.env.GEMINI_API_KEY = "GKEY";
    globalThis.fetch = (async () =>
      reply({
        title: "Piano from zero",
        emoji: "🎹",
        steps: [
          { title: "Find middle C", summary: "Know the keyboard", query: "piano middle c" },
          { title: "Your first chords", summary: "Play C, F and G", query: "piano first chords" },
          { title: "Both hands", summary: "Play hands together", query: "piano hands together" },
        ],
        startIndex: 9,
        startReason: "You know the keys, so you start with chords.",
      })) as typeof fetch;

    const plan = await aiPlan({ topic: "piano", lang: "en", level: "basics", known: "I know where middle C is" });
    assert.ok(plan);
    assert.equal(plan.mode, "ai");
    assert.equal(plan.steps.length, 3);
    assert.deepEqual(plan.steps[1].queries, ["piano first chords"]);
    assert.equal(plan.startIndex, 2);
  });

  it("falls back to generic steps when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "GKEY";
    process.env.YOUTUBE_API_KEY = "KEY";
    globalThis.fetch = (async () => Response.json({ error: { message: "bad key" } }, { status: 400 })) as typeof fetch;
    try {
      const res = await buildPlan({ topic: "piano", lang: "en", level: "new", known: "" });
      assert.ok("plan" in res && res.plan.mode === "template");
    } finally {
      delete process.env.YOUTUBE_API_KEY;
    }
  });
});
