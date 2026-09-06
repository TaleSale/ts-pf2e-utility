import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeAfflictionDefinition,
  parseAfflictionDescription,
  validateAfflictionDefinition,
} from "../scripts/actionplus/affliction-parser.js";

test("parses Russian plain-text poison", () => {
  const result = parseAfflictionDescription(`
    <p><b>Спас</b> Стойкость КС 22; <b>Возникновение</b> 1 раунд;
    <b>Макс. продолжительность</b> 1 минута</p>
    <p><b>Стадия 1:</b> 1d6 урона ядом и ослаблен 1 (1 раунд);</p>
    <p><b>Стадия 2:</b> 2d6 урона ядом и ослаблен 2 (1 раунд)</p>
  `, { name: "Змеиный яд", traits: ["poison", "virulent"] });
  assert.deepEqual(result.save, { type: "fortitude", dc: 22 });
  assert.deepEqual(result.onset, { formula: "1", unit: "rounds" });
  assert.deepEqual(result.maxDuration, { formula: "1", unit: "minutes" });
  assert.equal(result.virulent, true);
  assert.equal(result.stages.length, 2);
  assert.equal(result.stages[0].damage[0].damageType, "poison");
  assert.equal(result.stages[1].conditions[0].value, 2);
});

test("parses English PF2e enrichers", () => {
  const result = parseAfflictionDescription(`
    <p><strong>Saving Throw</strong> @Check[fortitude|dc:19]; <strong>Maximum Duration</strong> 6 rounds</p>
    <p><strong>Stage 1</strong> @Damage[1d8[poison]] and sickened 1 (1 round)</p>
    <p><strong>Stage 2</strong> @Damage[2d8[poison]] and sickened 2 (1 round)</p>
  `);
  assert.deepEqual(result.save, { type: "fortitude", dc: 19 });
  assert.equal(result.stages[0].damage[0].formula, "1d8");
  assert.equal(result.stages[0].conditions[0].slug, "sickened");
  assert.deepEqual(validateAfflictionDefinition(result), []);
});

test("manual overrides take precedence", () => {
  const parsed = parseAfflictionDescription("Fortitude DC 18; Stage 1: sickened 1 (1 round)");
  const config = { type: "poison", parsed, overrides: { save: { type: "will", dc: 25 } } };
  const merged = mergeAfflictionDefinition(config);
  assert.deepEqual(merged.save, { type: "will", dc: 25 });
  assert.equal(merged.stages.length, 1);

  delete config.overrides.save;
  assert.deepEqual(mergeAfflictionDefinition(config).save, { type: "fortitude", dc: 18 });
});

test("reports incomplete definitions", () => {
  const result = parseAfflictionDescription("Stage 1: sickened 1");
  assert.deepEqual(validateAfflictionDefinition(result), ["save", "stageDuration:1"]);
});

test("ignores a duplicated rendered stage block and keeps damage inside its stage", () => {
  const result = parseAfflictionDescription(`
    Fortitude DC 20; Maximum Duration 3 rounds.
    Stage 1: @Damage[1d6[poison]] (1 round).
    Stage 2: @Damage[2d6[poison]] (1 round).
    Stage 3: @Damage[3d6[poison]] (1 round).
    Stage 1: @Damage[1d6[poison]] (1 round).
    Stage 2: @Damage[2d6[poison]] (1 round).
    Stage 3: @Damage[3d6[poison]] (1 round).
  `);
  assert.equal(result.stages.length, 3);
  assert.deepEqual(result.stages.map((stage) => stage.damage.map((entry) => entry.formula)), [["1d6"], ["2d6"], ["3d6"]]);
});
