import assert from "node:assert/strict";
import test from "node:test";
import { horrorDegree, nextDread } from "../scripts/utility/horror-rules.js";

test("every Dread level expands only the intended natural ranges", () => {
  for (let dread = 0; dread <= 5; dread++) for (let die = 1; die <= 20; die++) {
    assert.equal(horrorDegree(die, dread), dread && die <= dread ? 0 : null);
    assert.equal(horrorDegree(die, dread, true), dread && die >= 21 - dread ? 3 : null);
  }
  assert.equal(horrorDegree(null, 5), null);
  assert.equal(horrorDegree(0, 5), null);
  assert.equal(horrorDegree(21, 5), null);
});
test("enabled-mode minimum, maximum and overflow nightmare", () => {
  assert.equal(nextDread({ value: 2 }, -2).state.value, 1);
  assert.equal(nextDread({ value: 0 }, -2).state.value, 1);
  assert.equal(nextDread({ value: 4 }, 1).nightmare, false);
  const overflow = nextDread({ value: 5 }, 1);
  assert.equal(overflow.state.value, 5);
  assert.equal(overflow.nightmare, true);
});
test("all growth triggers share a per-actor combat round limit, including overflow", () => {
  const clock = { limited: true, combatId: "battle", round: 2, time: 100 };
  const first = nextDread({ value: 5 }, 1, clock);
  assert.equal(first.nightmare, true);
  assert.equal(nextDread(first.state, 1, clock).changed, false);
  assert.equal(nextDread(first.state, 1, { ...clock, round: 3 }).nightmare, true);
  assert.equal(nextDread(first.state, 1, { ...clock, combatId: "next-battle" }).nightmare, true);
});
test("exploration cooldown is rolling ten minutes, not wall-clock buckets", () => {
  const first = nextDread({ value: 1 }, 1, { time: 599, limited: true });
  assert.equal(nextDread(first.state, 1, { time: 600, limited: true }).changed, false);
  assert.equal(nextDread(first.state, 1, { time: 1198, limited: true }).changed, false);
  assert.equal(nextDread(first.state, 1, { time: 1199, limited: true }).state.value, 3);
});
