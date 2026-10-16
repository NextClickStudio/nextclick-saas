import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { award, EMPTY_STATS, levelFor, liveStreak } from "./xp.ts";

describe("xp", () => {
  it("levels up at 100, 300, 600 XP", () => {
    assert.equal(levelFor(0).level, 1);
    assert.equal(levelFor(99).level, 1);
    assert.equal(levelFor(100).level, 2);
    assert.equal(levelFor(299).level, 2);
    assert.equal(levelFor(300).level, 3);
    assert.deepEqual(
      { into: levelFor(350).into, span: levelFor(350).span },
      { into: 50, span: 300 },
    );
  });

  it("counts a day once and keeps the streak across days", () => {
    let s = award(EMPTY_STATS, "video", "2026-10-14");
    s = award(s, "step", "2026-10-14");
    assert.equal(s.streak, 1);
    assert.equal(s.xp, 60);
    s = award(s, "video", "2026-10-15");
    assert.equal(s.streak, 2);
    assert.equal(s.best, 2);
  });

  it("restarts the streak after a missed day", () => {
    const s = award(award(EMPTY_STATS, "video", "2026-10-10"), "video", "2026-10-12");
    assert.equal(s.streak, 1);
    assert.equal(liveStreak(s, "2026-10-13"), 1);
    assert.equal(liveStreak(s, "2026-10-14"), 0);
  });

  it("crosses month boundaries", () => {
    const s = award(award(EMPTY_STATS, "video", "2026-10-31"), "video", "2026-11-01");
    assert.equal(s.streak, 2);
  });
});
