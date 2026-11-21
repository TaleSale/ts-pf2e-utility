import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/actionplus/alchemy.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
const context = vm.createContext({
  MODULE_ID: "ts-pf2e-utility", I18N_PREFIX: "TS", escapeHtml: String,
  foundry: { utils: { deepClone: structuredClone, randomID: () => "id" } },
  registerActionPlusFeature: () => {}, Hooks: { on: () => {} },
  ui: { notifications: { info: () => {}, warn: () => {} } },
});
vm.runInContext(source, context);

const descriptionRanges = [{ start: 1, end: 20, items: [{ name: "Fire", uuid: "Item.fire", quantity: 1 }] }];
const mergeDescription = (value, ranges = descriptionRanges) => context.descriptionWithGeneratedAlchemy({ system: { description: { value } } }, ranges);
const legacyBlock = '<h3>Продвинутая алхимия</h3><p><strong>1–20 уровень:</strong> @UUID[Item.fire]{Fire} ×1</p>';

test("repeated saves without HTML comments keep exactly one generated block", () => {
  let description = "<p>Мой текст.</p>";
  for (let index = 0; index < 20; index++) {
    description = mergeDescription(description.replace(/<!--[\s\S]*?-->/g, ""));
    assert.equal((description.match(/<h3>/g) ?? []).length, 1);
    assert.ok(description.startsWith("<p>Мой текст.</p>"));
  }
  assert.equal(mergeDescription(description), description);
});

test("legacy duplicates are removed while manual text before, between and after survives", () => {
  const description = `<p>До.</p>${legacyBlock}<p>Между.</p><!-- ts-pf2e-utility:alchemy -->${legacyBlock}${legacyBlock}<p>После.</p>`;
  const repaired = mergeDescription(description);
  assert.equal((repaired.match(/<h3>/g) ?? []).length, 1);
  assert.ok(repaired.startsWith("<p>До.</p><p>Между.</p><p>После.</p>"));
  assert.equal(context.removeGeneratedAlchemy(repaired), "<p>До.</p><p>Между.</p><p>После.</p>");
});

test("recipe changes replace generated rows and clearing recipes retains manual prose", () => {
  const initial = mergeDescription("<p>Manual</p>");
  const updated = mergeDescription(initial, [{ start: 2, end: 5, items: [{ name: "Poison", quantity: 3 }] }]);
  assert.ok(!updated.includes("Item.fire"));
  assert.ok(updated.includes("Poison ×3"));
  assert.equal(mergeDescription(updated, []), "<p>Manual</p>");
  const manual = "<h3>Продвинутая алхимия</h3><p>Моё описание.</p>";
  assert.equal(context.removeGeneratedAlchemy(manual), manual);
});

test("legacy recipes default to unchecked; selected recipes retain the setting", () => {
  assert.equal(context.normalizeFormula({}).useCreatureDC, false);
  assert.equal(context.normalizeFormula({ useCreatureDC: true }).useCreatureDC, true);
  const html = context.renderControls({ flags: { alchemyCreatureDC: 30 } });
  assert.match(html, /value="30"/);
  assert.ok(html.indexOf("ts-alchemy-creature-dc") < html.indexOf("ts-alchemy-ranges"));
});

test("creature DC uses moderate level values unless explicitly overridden", () => {
  assert.equal(context.getCreatureDC({ actor: { level: 10 } }), 26);
  assert.equal(context.getCreatureDC({ actor: { level: -1 } }), 13);
  assert.equal(context.getCreatureDC({ actor: { level: 10 }, getFlag: () => 30 }), 30);
  assert.equal(context.getCreatureDC({ actor: { level: 10 }, getFlag: () => "" }), 26);
});

test("daily creation raises selected save DCs without lowering higher DCs or mutating recipes", async () => {
  const recipeSource = { type: "consumable", system: {
    traits: { value: ["alchemical", "poison"] }, savingThrow: { dc: 19 },
    description: { value: "@Check[fortitude|dc:19] @Check[type:reflex|dc:35|basic] @Check[crafting|dc:15] @Check[will|dc:@actor.level]" },
  } };
  const ranges = [{ id: "r", start: 1, end: 20, items: [
    { id: "a", name: "Poison", quantity: 2, useCreatureDC: true, source: recipeSource },
    { id: "b", name: "Other", quantity: 1, source: recipeSource },
  ] }];
  let created;
  const actor = { level: 10, createEmbeddedDocuments: async (_type, sources) => { created = sources; } };
  const action = { actor, getFlag: (_module, key) => key === "alchemyRanges" ? ranges : 30 };
  await context.createDailyItems(action);
  assert.equal(created[0].system.savingThrow.dc, 30);
  assert.equal(created[0].system.quantity, 2);
  assert.ok(created[0].system.traits.value.includes("infused"));
  assert.equal(created[0].system.description.value, "@Check[fortitude|dc:30] @Check[type:reflex|dc:35|basic] @Check[crafting|dc:15] @Check[will|dc:@actor.level]");
  assert.equal(created[1].system.savingThrow.dc, 19);
  assert.equal(recipeSource.system.savingThrow.dc, 19);
  assert.equal(recipeSource.system.traits.value.includes("infused"), false);
});
