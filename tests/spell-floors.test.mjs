import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/utility/spell-floors.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replaceAll("export ", "");
const scope = "ts-pf2e-utility";
function fixture(item = null) {
  const hooks = {}, once = {}, features = [];
  const context = vm.createContext({
    MODULE_ID: scope, Hooks: { on: (key, fn) => hooks[key] = fn, once: (key, fn) => once[key] = fn },
    game: {}, registerActionPlusFeature: f => features.push(f),
    getItemActionPlusOptions: item => item?.options ?? [], fromUuidSync: () => item,
    CONST: { REGION_VISIBILITY: { LAYER_UNLOCKED: 4 } },
  });
  vm.runInContext(source, context);
  context.game.i18n = { lang: "ru" };
  context.game.user = { id: "caster" };
  return { context, hooks, once, features };
}
test("Floors registers before init without accessing uninitialized localization and supports spells", () => {
  const { features } = fixture();
  assert.equal(features.length, 1);
  assert.equal(features[0].id, "floors");
  assert.ok(features[0].itemTypes.includes("spell"));
  assert.equal(features[0].label, "TS_PF2E_UTILITY.SpellFloorsLabel");
  const html = features[0].render({ flags: {} });
  assert.match(html, /data-spell-floor-enabled/);
  assert.match(html, /Туман/);
});
function region(style = "mist") {
  const tree = [{ points: [0, 0, 100, 0, 100, 100], isHole: false }, { points: [5, 5, 10, 5, 10, 10], isHole: true }];
  tree.testPoint = ({ x, y }) => x >= 0 && y >= 0 && x < 100 && y < 100;
  return { id: "region", flags: { [scope]: { spellFloor: { style } } }, levels: new Set(["ground"]), elevation: { bottom: 10, top: 30 }, polygonTree: tree };
}
test("floor overlays follow live region geometry and disappear with their region", () => {
  const { context } = fixture(); const r = region(); const scene = { regions: [r] };
  assert.equal(context.regionFloorOverlays(scene, 0, "ground").length, 1);
  assert.equal(context.regionFloorOverlays(scene, 1, "upstairs").length, 0);
  r.polygonTree[0].points[0] = 40;
  assert.equal(context.regionFloorOverlays(scene, 0, "ground")[0].points[0].x, 40);
  scene.regions = [];
  assert.equal(context.regionFloorOverlays(scene, 0, "ground").length, 0);
});
test("fog respects region bottom, top, top inclusion, footprint and native level", () => {
  const { context } = fixture(); const r = region(); const scene = { regions: [r] };
  const token = { bounds: { x: 0, y: 0, width: 50, height: 50 }, level: "ground", elevation: 10 };
  assert.equal(context.tokenInsideSpellFog(token, scene), true);
  token.elevation = 9; assert.equal(context.tokenInsideSpellFog(token, scene), false);
  token.elevation = 30; assert.equal(context.tokenInsideSpellFog(token, scene), false);
  r.elevation.topInclusive = true; assert.equal(context.tokenInsideSpellFog(token, scene), true);
  token.level = "upstairs"; assert.equal(context.tokenInsideSpellFog(token, scene), false);
});
test("placement adds floors without losing PF2e origin, targeting flags or existing behaviors", () => {
  const item = { options: ["floors"], flags: { [scope]: { spellFloor: { style: "darkness", height: 20 } } } };
  const { hooks } = fixture(item); let update;
  const data = { flags: { pf2e: { origin: { uuid: "Item.spell" }, messageId: "chat", areaShape: "cone" } }, behaviors: [{ type: "existing" }], elevation: { bottom: 15 } };
  const before = structuredClone(data);
  hooks.preCreateRegion({ updateSource: value => update = value }, data);
  assert.deepEqual(data, before);
  assert.equal(update.behaviors, undefined);
  assert.equal(update.elevation.top, 35);
  assert.equal(update[`flags.${scope}.spellFloor`].style, "weather-darkness");
  assert.equal(update[`flags.${scope}.spellFloor`].placement, true);
});
test("ordinary regions and disabled features are untouched; inline floors take precedence", () => {
  const item = { options: ["floors"], flags: { [scope]: { spellFloor: { enabled: false, style: "mist" } } } };
  const { hooks } = fixture(item); let update;
  const document = { updateSource: value => update = value };
  hooks.preCreateRegion(document, {}); assert.equal(update, undefined);
  hooks.preCreateRegion(document, { flags: { pf2e: { origin: { uuid: "Item.spell" } } } }); assert.equal(update, undefined);
  hooks.preCreateRegion(document, { flags: { [scope]: { spellFloor: { style: "bushes" } } } });
  assert.equal(update[`flags.${scope}.spellFloor`].style, "flowering-shrubs-dense");
  assert.equal(update.elevation, undefined);
});

test("target-helper deletion leaves exactly one durable floor with matching geometry and height", async () => {
  const { context, hooks } = fixture();
  const r = region("weather-snow");
  r.flags[scope].spellFloor.placement = true;
  const source = { _id: r.id, name: "Blizzard", shapes: [{ type: "cone", radius: 300, angle: 90 }],
    elevation: { bottom: 5, top: 35 }, levels: ["ground"], ownership: { caster: 3 },
    flags: { ...r.flags, pf2e: { origin: { uuid: "Item.blizzard" }, messageId: "chat", areaShape: "cone" } },
    behaviors: [{ type: "unrelated-targeting-behavior" }] };
  r.toObject = () => structuredClone(source);
  let created;
  r.parent = { createEmbeddedDocuments: async (type, documents) => { assert.equal(type, "Region"); created = documents; } };
  await hooks.createRegion(r, {}, "different-client"); assert.equal(created, undefined);
  await hooks.createRegion(r, {}, "caster");
  assert.equal(created.length, 1);
  const copy = created[0];
  assert.deepEqual(copy.shapes, source.shapes); assert.deepEqual(copy.elevation, source.elevation);
  assert.deepEqual(copy.ownership, source.ownership);
  assert.equal(copy._id, undefined); assert.equal(copy.flags.pf2e, undefined);
  assert.equal(copy.flags["pf2e-toolbelt"].targetHelper.skip, true);
  assert.equal(copy.behaviors.length, 1); assert.equal(copy.behaviors[0].system.difficulties.walk, 2);
  const durable = { ...r, id: "durable", flags: copy.flags, toObject: () => copy };
  assert.equal(context.regionFloorOverlays({ regions: [r, durable] }, 0, "ground").length, 1);
  assert.equal(context.regionFloorOverlays({ regions: [durable] }, 0, "ground").length, 1);
  assert.equal(context.regionFloorOverlays({ regions: [] }, 0, "ground").length, 0);
  assert.equal(context.persistentSpellFloorData(durable), null);
  hooks.preCreateRegion({ updateSource: () => assert.fail("persistent copy must not be converted again") }, copy);
});

test("darkness behavior moves to durable floor while source behavior remains untouched", () => {
  const { context } = fixture();
  const source = { name: "Darkness", flags: { [scope]: { spellFloor: { placement: true, style: "weather-darkness" } } } };
  const copy = context.persistentSpellFloorData({ id: "source", toObject: () => structuredClone(source) });
  assert.equal(copy.behaviors[0].type, "adjustDarknessLevel");
  assert.equal(copy.behaviors[0].system.modifier, 0.85);
  assert.equal(context.normalizeSpellFloor("snow"), "weather-snow");
});

test("inline enrichment delegates to PF2e and placement preserves return value and arguments without stale context", async () => {
  const { context, once } = fixture();
  let click; const microtasks = [], calls = [];
  const result = Promise.resolve("placed");
  class Layer { placeRegion(...args) { calls.push([this, ...args]); return result; } }
  const element = { dataset: { effectArea: "", type: "cube", distance: "30" } };
  context.CONFIG = { TextEditor: { enrichers: [{ pattern: /@(Check|Template)\[([^\]]+)\]/g, enricher: async () => element }] }, Canvas: { layers: { regions: { layerClass: Layer } } } };
  context.document = { addEventListener: (_, fn) => { click = fn; } };
  context.queueMicrotask = fn => microtasks.push(fn);
  context.foundry = { utils: { deepClone: structuredClone, setProperty: (object, path, value) => {
    const keys = path.split("."); const last = keys.pop(); let target = object;
    for (const key of keys) target = target[key] ??= {};
    target[last] = value;
  } } };
  once.ready();
  const enriched = await context.CONFIG.TextEditor.enrichers[0].enricher(["", "Template", "type:cube|distance:30|floors:mist|height:20"], {});
  assert.equal(enriched, element); assert.equal(element.dataset.tsuFloor, "mist");
  click({ target: { closest: () => element } });
  const layer = new Layer(); const data = { flags: { pf2e: { messageId: "chat" } } };
  assert.equal(layer.placeRegion(data, "options"), result);
  assert.equal(calls[0][0], layer); assert.equal(calls[0][2], "options");
  assert.equal(calls[0][1].flags.pf2e.messageId, "chat");
  assert.equal(calls[0][1].flags[scope].spellFloor.height, "20");
  assert.equal(data.flags[scope], undefined);
  microtasks.forEach(fn => fn()); layer.placeRegion(data);
  assert.equal(calls[1][1], data);
});
