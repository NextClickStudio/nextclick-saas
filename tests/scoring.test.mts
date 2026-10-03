// Test di lib/scoring.ts — esegui con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { average, computeTotalScore, rankByScore } from "../lib/scoring.ts";

test("media ponderata su scala 0-100", () => {
  const criteria = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ];
  // (10*1 + 5*3) / (10*4) = 25/40 = 62.5 -> 63
  assert.equal(
    computeTotalScore(criteria, [
      { criterion_id: "a", score: 10 },
      { criterion_id: "b", score: 5 },
    ]),
    63,
  );
});

test("tutti 10 = 100, tutti 0 = 0", () => {
  const criteria = [
    { id: "a", weight: 2 },
    { id: "b", weight: 5 },
  ];
  assert.equal(computeTotalScore(criteria, criteria.map((c) => ({ criterion_id: c.id, score: 10 }))), 100);
  assert.equal(computeTotalScore(criteria, criteria.map((c) => ({ criterion_id: c.id, score: 0 }))), 0);
});

test("criterio senza punteggio conta 0, punteggi fuori scala vengono limitati", () => {
  const criteria = [
    { id: "a", weight: 1 },
    { id: "b", weight: 1 },
  ];
  assert.equal(computeTotalScore(criteria, [{ criterion_id: "a", score: 10 }]), 50);
  assert.equal(computeTotalScore(criteria, [{ criterion_id: "a", score: 15 }, { criterion_id: "b", score: -3 }]), 50);
  assert.equal(computeTotalScore([], []), 0);
});

test("posizioni: ordine decrescente, pari merito con stessa posizione", () => {
  const ranked = rankByScore([
    { name: "Charlie", score: 40 },
    { name: "Alfa", score: 80 },
    { name: "Bravo", score: 80 },
    { name: "Delta", score: 90 },
  ]);
  assert.deepEqual(
    ranked.map((r) => [r.name, r.position]),
    [
      ["Delta", 1],
      ["Alfa", 2],
      ["Bravo", 2],
      ["Charlie", 4],
    ],
  );
});

test("media arrotondata", () => {
  assert.equal(average([50, 51]), 51);
  assert.equal(average([]), 0);
});
