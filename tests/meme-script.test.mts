// Test di lib/meme-script.ts — esegui con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, formatCue, parseScript, scriptToText, typedCount } from "../lib/meme-script.ts";

const TEXT = `POV: chiedi al bro come trovare lead
io: fra come trovo dei lead
bro: in ferramenta
io: no i LEAD
bro: il piombo fra. 3€ al chilo 🔊 vine boom
io: i clienti bro
bro: ah. no quelli non li vendono [metal pipe]`;

test("legge POV, mittenti e suoni", () => {
  const s = parseScript(TEXT);
  assert.equal(s.pov, "chiedi al bro come trovare lead");
  assert.equal(s.lines.length, 6);
  assert.deepEqual(s.lines[3], { from: "bro", text: "il piombo fra. 3€ al chilo", sfx: "vine boom" });
  assert.deepEqual(s.lines[5], { from: "bro", text: "ah. no quelli non li vendono", sfx: "metal pipe" });
});

test("testo → copione → testo è stabile", () => {
  const s = parseScript(TEXT);
  assert.deepEqual(parseScript(scriptToText(s)), s);
});

test("i messaggi compaiono in ordine e i suoni hanno il loro secondo", () => {
  const t = buildTimeline(parseScript(TEXT));
  for (let i = 1; i < t.lines.length; i++) assert.ok(t.lines[i].at > t.lines[i - 1].at);
  assert.equal(t.lines[0].typingFrom, null); // "io" non scrive con l'indicatore
  const c = t.lines[0].compose!;
  assert.ok(c.from < c.typeStart && c.typeStart < c.typeEnd && c.typeEnd < c.sendAt && c.sendAt < t.lines[0].at);
  assert.equal(typedCount(t.lines[0], c.from), 0);
  assert.ok(typedCount(t.lines[0], (c.typeStart + c.typeEnd) / 2) > 0);
  assert.equal(typedCount(t.lines[0], c.typeEnd), [...t.lines[0].text].length);
  assert.ok(t.lines[1].typingFrom !== null && t.lines[1].typingFrom < t.lines[1].at);
  assert.deepEqual(t.cues.map((c) => c.sfx), ["vine boom", "metal pipe"]);
  assert.ok(t.duration > t.chatEnd);
  assert.ok(buildTimeline(parseScript(TEXT), 1.5).duration < t.duration);
});

test("formato dei secondi", () => {
  assert.equal(formatCue(3.44), "0:03.4");
  assert.equal(formatCue(65.2), "1:05.2");
});
