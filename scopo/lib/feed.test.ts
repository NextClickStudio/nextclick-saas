import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { decodeCursor, encodeCursor, nextQueryIndex } from "./cursor.ts";
import { heuristicCurate } from "./curator.ts";
import { demoFeed, liveFeed, mergeQueries } from "./feed.ts";
import { matchSeedTopic } from "./seed.ts";
import { decodeEntities, looksLikeBait, parseIsoDuration } from "./text.ts";

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
    assert.ok(looksLikeBait("LITIGIO in studio tra ministri"));
    assert.ok(looksLikeBait("NON CI CREDERAI MAI A QUESTO!!!"));
    assert.ok(!looksLikeBait("Come funziona il Parlamento italiano"));
    assert.ok(!looksLikeBait("La legge elettorale spiegata in 60 secondi"));
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
  it("matches free text to a ready topic", () => {
    assert.equal(matchSeedTopic("politica italiana")?.label, "Politica italiana");
    assert.equal(matchSeedTopic("voglio capire la Costituzione")?.label, "Politica italiana");
    assert.equal(matchSeedTopic("imparare l'inglese")?.label, "Inglese");
    assert.equal(matchSeedTopic("cucina giapponese"), null);
  });

  it("explains itself when the topic is not available", () => {
    const res = demoFeed("cucina giapponese");
    assert.equal(res.items.length, 0);
    assert.ok(res.notice);
    assert.ok(res.suggestions?.includes("Politica italiana"));
  });
});

describe("curation without AI", () => {
  it("drops bait and ranks on-topic titles first", () => {
    const base = { channel: "c", thumbnail: "", durationSec: 30, description: "" };
    const out = heuristicCurate("politica italiana", [
      { ...base, id: "1", title: "Ricetta della carbonara" },
      { ...base, id: "2", title: "Scontro in diretta: lo umilia" },
      { ...base, id: "3", title: "La politica italiana in 60 secondi" },
    ]);
    assert.deepEqual(
      out.map((v) => v.id),
      ["3", "1"],
    );
  });

  it("merges planned queries without duplicates", () => {
    assert.deepEqual(mergeQueries(["Politica italiana"], ["politica italiana", "come funziona il senato"]), [
      "Politica italiana",
      "come funziona il senato",
    ]);
  });
});

describe("liveFeed (YouTube simulato)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function fakeYouTube() {
    const searches: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        const q = url.searchParams.get("q")!;
        searches.push(q);
        const n = searches.length;
        return Response.json({
          nextPageToken: `tok-${n}`,
          items: [
            { id: { videoId: `short-${n}` }, snippet: { title: `${q} spiegato`, channelTitle: "Canale", liveBroadcastContent: "none", thumbnails: {} } },
            { id: { videoId: `long-${n}` }, snippet: { title: `${q} lezione lunga`, channelTitle: "Canale", liveBroadcastContent: "none", thumbnails: {} } },
            { id: { videoId: `bait-${n}` }, snippet: { title: "Lo UMILIA in diretta", channelTitle: "Canale", liveBroadcastContent: "none", thumbnails: {} } },
            { id: { videoId: `live-${n}` }, snippet: { title: `${q} live`, channelTitle: "Canale", liveBroadcastContent: "live", thumbnails: {} } },
          ],
        });
      }
      if (url.pathname.endsWith("/videos")) {
        const ids = url.searchParams.get("id")!.split(",");
        return Response.json({
          items: ids.map((id) => ({ id, contentDetails: { duration: id.startsWith("long") ? "PT12M" : "PT50S" } })),
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    return searches;
  }

  it("keeps short, non-live, non-bait videos and paginates across planned queries", async () => {
    const searches = fakeYouTube();

    const first = await liveFeed("KEY", "politica italiana");
    // 1 video buono per ricerca, quindi fa 2 ricerche (il massimo per pagina).
    assert.deepEqual(
      first.items.map((v) => v.id),
      ["short-1", "short-2"],
    );
    assert.equal(first.items[0].durationSec, 50);
    assert.deepEqual(searches, ["politica italiana", "politica italiana spiegato semplice"]);
    assert.ok(first.cursor);

    const second = await liveFeed("KEY", "politica italiana", first.cursor!);
    assert.deepEqual(searches.slice(2), ["politica italiana in 1 minuto", "politica italiana #shorts"]);
    assert.equal(second.items.length, 2);
  });

  it("stops when YouTube has no more pages", async () => {
    globalThis.fetch = (async () => Response.json({ items: [] })) as unknown as typeof fetch;
    const res = await liveFeed("KEY", "argomento introvabile");
    assert.equal(res.items.length, 0);
    // Ogni ricerca senza nextPageToken è esaurita, ma ne restano altre pianificate.
    assert.ok(res.cursor);
    const state = decodeCursor(res.cursor!)!;
    assert.equal(state.t["0"], null);
    assert.equal(state.t["1"], null);
  });
});
