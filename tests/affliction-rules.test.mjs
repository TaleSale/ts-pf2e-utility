import test from "node:test";
import assert from "node:assert/strict";
import { exposureTransition, periodicTransition } from "../scripts/actionplus/affliction-rules.js";

test("re-exposure only worsens failures", () => {
  assert.deepEqual(exposureTransition({ stage: 2, outcome: "success", maxStage: 4 }), { stage: 2, changed: false });
  assert.deepEqual(exposureTransition({ stage: 2, outcome: "failure", maxStage: 4 }), { stage: 3, changed: true });
  assert.deepEqual(exposureTransition({ stage: 3, outcome: "criticalFailure", maxStage: 4 }), { stage: 4, changed: true });
});

test("ordinary periodic saves follow PF2e stage steps", () => {
  assert.equal(periodicTransition({ stage: 3, outcome: "criticalSuccess", maxStage: 5 }).stage, 1);
  assert.equal(periodicTransition({ stage: 3, outcome: "success", maxStage: 5 }).stage, 2);
  assert.equal(periodicTransition({ stage: 3, outcome: "failure", maxStage: 5 }).stage, 3);
  assert.equal(periodicTransition({ stage: 3, outcome: "criticalFailure", maxStage: 5 }).stage, 5);
  assert.equal(periodicTransition({ stage: 1, outcome: "success", maxStage: 5 }).cured, true);
});

test("virulent poison requires two successes", () => {
  const first = periodicTransition({ stage: 2, outcome: "success", maxStage: 4, virulent: true, virulentSuccesses: 0 });
  assert.deepEqual(first, { stage: 2, virulentSuccesses: 1, cured: false });
  const second = periodicTransition({ stage: 2, outcome: "success", maxStage: 4, virulent: true, virulentSuccesses: first.virulentSuccesses });
  assert.deepEqual(second, { stage: 1, virulentSuccesses: 0, cured: false });
  assert.equal(periodicTransition({ stage: 1, outcome: "criticalSuccess", maxStage: 4, virulent: true }).cured, true);
});

