import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { decodeCursor, encodeCursor, nextQueryIndex } from "./cursor.ts";
import { heuristicCurate, heuristicQueries } from "./curator.ts";
import { demoFeed, liveFeed, mergeQueries } from "./feed.ts";
import { isLangCode, langFromLocale } from "./languages.ts";
import { matchSeedTopic } from "./seed.ts";
import { decodeEntities, keywordHits, looksLikeBait, parseIsoDuration, topicKeywords } from "./text.ts";
import type { Candidate } from "./youtube.ts";

delete process.env.ANTHROPIC_API_KEY;

describe("text", () => {
  it("parses YouTube ISO durations", () => {
    assert.equal(parseIsoDuration("PT45S"), 45);
    assert.equal(parseIsoDuration("PT1M5S"), 65);
    assert.equal(parseIsoDuration("PT2H"), 7200);
    assert.equal(parseIsoDuration("P0D"), 0);
    assert.equal(parseIsoDuration("garbage"), 0);
  });

  it("decodes HTML entities in titles", () => {
    assert.equal(decodeEntities("L&#39;articolo &quot;12&quot; &amp; altro"), `L'articolo "12" & altro`);
  });

  it("flags rage-bait titles but not explainers", () => {
    assert.ok(looksLikeBait("Bocchino umilia Formigli in diretta #politica"));
    assert.ok(looksLikeBait("Snowboard fail GONE WRONG"));
    assert.ok(looksLikeBait("NON CI CREDERAI MAI A QUESTO!!!"));
    assert.ok(!looksLikeBait("How to ollie on a snowboard"));
    assert.ok(!looksLikeBait("La legge elettorale spiegata in 60 secondi"));
  });

  it("keeps only the words that say what the topic is", () => {
    assert.deepEqual(topicKeywords("guitar lesson for beginners"), ["guitar"]);
    assert.deepEqual(topicKeywords("impara la chitarra"), ["chitarra"]);
    assert.deepEqual(topicKeywords("snowboard tricks"), ["snowboard"]);
  });

  it("matches word variants", () => {
    assert.equal(keywordHits(["snowboarding"], "Easy SNOWBOARD trick for beginners"), 1);
    assert.equal(keywordHits(["guitar"], "Learn this chord progression"), 0);
  });
});

describe("languages", () => {
  it("maps browser locales", () => {
    assert.equal(langFromLocale("it-IT"), "it");
    assert.equal(langFromLocale("pt-BR"), "pt");
    assert.equal(langFromLocale("ja-JP"), "en");
    assert.equal(langFromLocale(undefined), "en");
  });

  it("validates codes", () => {
    assert.ok(isLangCode("it"));
    assert.ok(isLangCode("any"));
    assert.ok(!isLangCode("xx"));
    assert.ok(!isLangCode(null));
  });

  it("builds search variants in the chosen language", () => {
    assert.deepEqual(heuristicQueries("guitar", "en").slice(0, 3), ["guitar", "guitar tutorial", "guitar tips"]);
    assert.ok(heuristicQueries("chitarra", "it").includes("chitarra consigli"));
  });
});

describe("cursor", () => {
  it("round-trips state", () => {
    const state = { q: ["a", "b"], i: 1, t: { "0": "TOKEN", "1": null } };
    assert.deepEqual(decodeCursor(encodeCursor(state)), state);
  });

  it("rejects garbage", () => {
    assert.equal(decodeCursor("not-base64-json"), null);
    assert.equal(decodeCursor(Buffer.from(JSON.stringify({ q: [], i: 0, t: {} })).toString("base64url")), null);
  });

  it("skips exhausted queries and stops when all are done", () => {
    assert.equal(nextQueryIndex({ q: ["a", "b", "c"], i: 0, t: { "0": null } }), 1);
    assert.equal(nextQueryIndex({ q: ["a", "b", "c"], i: 2, t: { "2": null } }), 0);
    assert.equal(nextQueryIndex({ q: ["a", "b"], i: 0, t: { "0": null, "1": null } }), -1);
  });
});

describe("demo mode", () => {
  it("matches free text to a ready topic, in any language", () => {
    assert.equal(matchSeedTopic("snowboard tricks")?.label, "Snowboarding");
    assert.equal(matchSeedTopic("impara la chitarra")?.label, "Guitar");
    assert.equal(matchSeedTopic("politica italiana")?.label, "Italian politics");
    assert.equal(matchSeedTopic("skiing")?.label, "Skiing");
    assert.equal(matchSeedTopic("science")?.label, "Physics");
    assert.equal(matchSeedTopic("photography camera"), null);
  });

  it("explains itself when the topic is not available", () => {
    const res = demoFeed("japanese cooking knives sharpening", "en");
    assert.equal(res.items.length > 0, true); // "cooking" matches the demo set
    const none = demoFeed("photography", "en");
    assert.equal(none.items.length, 0);
    assert.ok(none.notice);
    assert.ok(none.suggestions?.some((s) => s.topic === "Guitar"));
  });

  it("says when a demo topic exists only in another language", () => {
    const res = demoFeed("politics", "en");
    assert.equal(res.lang, "it");
    assert.match(res.notice ?? "", /Italian/);
  });
});

describe("curation without AI", () => {
  const base = { channel: "c", thumbnail: "", durationSec: 30, description: "", tags: [] as string[] };

  it("drops bait and anything that doesn't name the topic", () => {
    const out = heuristicCurate("snowboard tricks", [
      { ...base, id: "1", title: "Best ski resorts in Europe" },
      { ...base, id: "2", title: "Snowboard fail GONE WRONG" },
      { ...base, id: "3", title: "How to ollie on a snowboard" },
      { ...base, id: "4", title: "Easy beginner trick", tags: ["snowboarding", "ollie"] },
    ] satisfies Candidate[]);
    assert.deepEqual(
      out.map((v) => v.id),
      ["3", "4"],
    );
  });

  it("merges planned queries without duplicates", () => {
    assert.deepEqual(mergeQueries(["Guitar"], ["guitar", "fingerpicking for beginners"]), [
      "Guitar",
      "fingerpicking for beginners",
    ]);
  });
});

describe("liveFeed (YouTube simulato)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function fakeYouTube() {
    const searches: Array<{ q: string; lang: string | null; region: string | null }> = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        const q = url.searchParams.get("q")!;
        searches.push({ q, lang: url.searchParams.get("relevanceLanguage"), region: url.searchParams.get("regionCode") });
        const n = searches.length;
        const item = (id: string, title: string, live = "none") => ({
          id: { videoId: `${id}-${n}` },
          snippet: { title, channelTitle: "Channel", liveBroadcastContent: live, thumbnails: {} },
        });
        return Response.json({
          nextPageToken: `tok-${n}`,
          items: [
            item("short", `${q} explained`),
            item("long", `${q} full lesson`),
            item("bait", "Guitar drama EXPOSED"),
            item("live", `${q} live`, "live"),
            item("foreign", `${q} chitarra`),
            item("offtopic", "My morning routine"),
          ],
        });
      }
      if (url.pathname.endsWith("/videos")) {
        const ids = url.searchParams.get("id")!.split(",");
        return Response.json({
          items: ids.map((id) => ({
            id,
            contentDetails: { duration: id.startsWith("long") ? "PT12M" : "PT50S" },
            snippet: { defaultAudioLanguage: id.startsWith("foreign") ? "it" : "en-US", tags: [] },
          })),
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    return searches;
  }

  it("keeps short, on-topic videos in the chosen language and paginates across queries", async () => {
    const searches = fakeYouTube();

    const first = await liveFeed("KEY", "guitar", "en");
    assert.deepEqual(
      first.items.map((v) => v.id),
      ["short-1", "short-2"],
    );
    assert.deepEqual(
      searches.map((s) => s.q),
      ["guitar", "guitar tutorial"],
    );
    assert.equal(searches[0].lang, "en");
    assert.equal(searches[0].region, "US");
    assert.ok(first.cursor);

    const second = await liveFeed("KEY", "guitar", "en", first.cursor!);
    assert.deepEqual(
      searches.slice(2).map((s) => s.q),
      ["guitar tips", "how to guitar"],
    );
    assert.equal(second.items.length, 2);
  });

  it("does not filter by language when 'any' is chosen", async () => {
    const searches = fakeYouTube();
    const res = await liveFeed("KEY", "guitar", "any");
    assert.equal(searches[0].lang, null);
    assert.ok(res.items.some((v) => v.id.startsWith("foreign")));
  });

  it("stops when YouTube has no more pages", async () => {
    globalThis.fetch = (async () => Response.json({ items: [] })) as unknown as typeof fetch;
    const res = await liveFeed("KEY", "argomento introvabile", "it");
    assert.equal(res.items.length, 0);
    assert.ok(res.cursor);
    const state = decodeCursor(res.cursor!)!;
    assert.equal(state.t["0"], null);
    assert.equal(state.t["1"], null);
  });
});
