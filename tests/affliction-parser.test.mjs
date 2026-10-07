import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeAfflictionDefinition,
  normalizeDamageFormula,
  parseAfflictionDescription,
  parseAfflictionItem,
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

test("Russian locale stops before Babele's folded original for every automatic field", () => {
  const raw = `<p>Стойкость КС 23; Возникновение 1 раунд; Макс. продолжительность 5 раундов.</p>
    <p>Стадия 1: 1d6+3 урона ядом, ослаблен 1 (1 раунд).</p>
    <hr><details><summary>Оригинал</summary>
    <p>Fortitude DC 99; Onset 2 days; Maximum Duration 8 days; virulent.</p>
    <p>Stage 1: @Damage[10d6[poison]] and sickened 4 and drained 3 (3 days).</p>
    <p>Stage 2: @Damage[20d6[poison]] (4 days).</p></details>`;
  const result = parseAfflictionDescription(raw, { language: "ru" });
  assert.equal(result.save.dc, 23);
  assert.equal(result.stages.length, 1);
  assert.deepEqual(result.stages[0].damage, [{ formula: "(1d6+3)", damageType: "poison", category: null }]);
  assert.equal(result.stages[0].conditions[0].slug, "enfeebled");
  assert.equal(result.virulent, false);
  assert.deepEqual(result.maxDuration, { formula: "5", unit: "rounds" });
  assert.deepEqual(result.onset, { formula: "1", unit: "rounds" });
  assert.equal(parseAfflictionDescription(raw, { language: "en" }).stages.length, 2);
});

test("damage arithmetic is grouped once, including subtraction and existing groups", () => {
  for (const [raw, expected] of [["1d6+4", "(1d6+4)"], ["2d8 - 2", "(2d8 - 2)"], ["(1d6+4)", "(1d6+4)"], ["(1d6)+(2)", "((1d6)+(2))"], ["2d8", "2d8"]]) {
    assert.equal(normalizeDamageFormula(raw), expected);
  }
  const result = parseAfflictionDescription("Fortitude DC 20; Stage 1: @Damage[2d6+4[poison]] (1 round)");
  assert.equal(result.stages[0].damage[0].formula, "(2d6+4)");
});

test("NPC adjustment and counteract rank follow the creature; physical poisons use their own level", () => {
  const item = { type: "action", name: "Venom", actor: { type: "npc", level: 9, isElite: true }, system: {
    description: { value: "Fortitude DC 20; Stage 1: @Damage[2d6+4[poison]] (1 round)" },
  } };
  let parsed = parseAfflictionItem(item);
  assert.equal(parsed.save.dc, 22);
  assert.equal(parsed.counteractRank, 5);
  assert.equal(parsed.stages[0].damage[0].formula, "((2d6+4) + 2)");
  item.actor = { type: "npc", level: 7, isWeak: true };
  parsed = parseAfflictionItem(item);
  assert.equal(parsed.save.dc, 18);
  assert.equal(parsed.counteractRank, 4);
  assert.equal(parsed.stages[0].damage[0].formula, "((2d6+4) - 2)");
  item.system.frequency = { max: 1 };
  assert.equal(parseAfflictionItem(item).stages[0].damage[0].formula, "((2d6+4) - 4)");
  item.type = "consumable";
  item.system.level = { value: 3 };
  parsed = parseAfflictionItem(item);
  assert.equal(parsed.counteractRank, 2);
  assert.equal(parsed.level, 3);
  assert.equal(parsed.save.dc, 20);
  assert.equal(parsed.stages[0].damage[0].formula, "(2d6+4)");
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
