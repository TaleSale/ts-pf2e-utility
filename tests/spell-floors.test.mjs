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

test("effects are independent of visuals and retain legacy terrain behavior", () => {
  const { context, features } = fixture();
  assert.equal(context.spellFloorEffect({ style: "snow" }), "difficult");
  assert.equal(context.spellFloorBehaviors("weather-blizzard", "concealment").length, 0);
  assert.equal(context.spellFloorBehaviors("forest-pine", "greaterDifficult")[0].system.difficulties.walk, 3);
  const html = features[0].render({ flags: { spellFloor: { effect: "hazardous", style: "devil", damage: '2d6[fire]"<x>' } } });
  assert.match(html, /data-spell-floor-effect/);
  assert.match(html, /Огонь/);
  assert.match(html, /Кислота/);
  assert.equal(context.normalizeSpellFloor("devil-trails"), "hazard-fire");
  assert.equal(context.normalizeSpellFloor("acid"), "hazard-acid");
  assert.equal(context.spellFloorEffect({ style: "acid" }), "hazardous");
  assert.match(html, /Без спасброска/);
  assert.match(html, /&quot;&lt;x&gt;/);
});

const grid = {
  sizeX: 100, sizeY: 100,
  getDirectPath: ([a, b]) => {
    const from = Math.floor(a.x / 100), to = Math.floor(b.x / 100);
    return Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => ({ i: 0, j: from + index * Math.sign(to - from) }));
  },
  getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 }),
};
function hazardFixture() {
  const r = region("devil");
  r.flags[scope].spellFloor = { style: "devil", effect: "hazardous", damage: "1d6[fire]" };
  r.polygonTree.testPoint = ({ x }) => x >= 100 && x < 400;
  const token = { x: 0, y: 0, width: 1, height: 1, elevation: 10, level: "ground" };
  return { r, token };
}
const waypoint = x => ({ x, y: 0, elevation: 10, level: "ground" });
test("hazards count each entered cell, not exits; preserve re-entry and ignore undo", () => {
  const { context } = fixture(); const { token, r } = hazardFixture();
  const entries = (from, to, middle = [], method = "dragging") => context.hazardousFloorEntries(token,
    { origin: waypoint(from), destination: waypoint(to), passed: { waypoints: middle.map(waypoint) }, method }, r, grid);
  assert.equal(entries(0, 400), 3);
  assert.equal(entries(100, 300), 2);
  assert.equal(entries(300, 400), 0);
  assert.equal(entries(100, 100), 0);
  assert.equal(entries(0, 0, [200]), 3);
  assert.equal(entries(0, 400, [], "undo"), 0);
  token.level = "upper";
  const movement = { origin: { ...waypoint(0), level: "upper" }, destination: { ...waypoint(400), level: "upper" } };
  assert.equal(context.hazardousFloorEntries(token, movement, r, grid), 0);
});
test("hazard configuration survives durable region creation", () => {
  const { context } = fixture(); const { r } = hazardFixture();
  r.flags[scope].spellFloor = { ...r.flags[scope].spellFloor, placement: true, save: "reflex", dc: 23 };
  const copy = context.persistentSpellFloorData({ ...r, toObject: () => ({ flags: r.flags }) });
  assert.equal(copy.flags[scope].spellFloor.damage, "1d6[fire]");
  assert.equal(copy.flags[scope].spellFloor.dc, 23);
  assert.equal(copy.flags[scope].spellFloor.placement, false);
  assert.equal(copy.behaviors.length, 0);
});
test("hazards use PF2e damage, basic saves and exactly one turn-start trigger", async () => {
  const { context, hooks } = fixture(); const { token, r } = hazardFixture();
  const applied = []; let rolled = 0;
  class DamageRoll {
    constructor(formula) { this.formula = formula; this.multiplier = 1; }
    async evaluate() { rolled++; return this; }
    async toMessage() {}
    alter(multiplier) { this.multiplier = multiplier; return this; }
  }
  context.game.pf2e = { DamageRoll };
  context.ChatMessage = { getSpeaker: () => ({}) };
  context.game.user.isGM = true;
  context.game.users = { activeGM: { id: "caster" } };
  token.actor = { applyDamage: async data => applied.push(data), saves: { reflex: { check: { roll: async () => ({ degreeOfSuccess: 2 }) } } } };
  token.x = 100; token.parent = { grid, regions: [r] };
  await context.applySpellFloorHazard(token, { damage: "2d6[fire]" }, "Hazard");
  assert.equal(applied[0].damage.multiplier, 1);
  const combat = { id: "combat", started: true, round: 1, turn: 0, combatant: { id: "combatant", token } };
  await hooks.updateCombat(combat, { turn: 0 });
  await hooks.updateCombat(combat, { turn: 0 });
  assert.equal(applied.length, 2);
  context.game.user.isGM = false;
  await hooks.moveToken(token, { origin: waypoint(0), destination: waypoint(300) });
  assert.equal(rolled, 2);
});

test("smoke and blizzard both grant poor visibility", () => {
  const { context } = fixture();
  const token = { bounds: { x: 0, y: 0, width: 50, height: 50 }, level: "ground", elevation: 10 };
  for (const style of ["smoke", "blizzard"]) {
    assert.equal(context.tokenInsideSpellFog(token, { regions: [region(style)] }), true);
  }
});
test("teleport damages only the destination, never crossed cells", () => {
  const { context } = fixture(); const { token, r } = hazardFixture();
  context.CONFIG = { Token: { movement: { actions: { displace: { teleport: true } } } } };
  assert.equal(context.hazardousFloorEntries(token, { origin: waypoint(0), destination: { ...waypoint(300), action: "displace" } }, r, grid), 1);
  assert.equal(context.hazardousFloorEntries(token, { origin: waypoint(0), destination: { ...waypoint(400), action: "displace" } }, r, grid), 0);
});
test("hazards with saves post a targeted card without rolling or damaging", async () => {
  const { context } = fixture(); let posted;
  context.foundry = { utils: { randomID: () => "cycle" } };
  context.ChatMessage = { getSpeaker: () => ({}), create: async data => posted = data };
  context.game.toolbelt = { targetHelper: {} };
  const token = { uuid: "Scene.scene.Token.token", name: "Target", actor: { uuid: "Actor.target", applyDamage: () => assert.fail("premature damage") } };
  await context.applySpellFloorHazard(token, { damage: "2d6[fire]", save: "reflex", dc: 20 }, "Hazard");
  assert.match(posted.content, /@Check\[reflex\|dc:20/);
  assert.equal(posted.flags[scope].spellFloorSave.damage, "2d6[fire]");
  assert.equal(posted.flags["pf2e-toolbelt"].targetHelper.targets[0], token.uuid);
});
test("save reroll reverses only prior damage, preserves other damage, and reuses dice", async () => {
  const { context, hooks } = fixture(); let hp = 100, rolls = 0, serial = 0;
  const messages = new Map();
  context.game.messages = messages;
  context.Hooks.off = () => {};
  context.foundry = { utils: { getProperty: () => hp } };
  context.ChatMessage = { getSpeaker: () => ({}) };
  class DamageRoll {
    constructor() { this.total = 10; }
    async evaluate() { rolls++; return this; }
    async toMessage() {}
    toJSON() { return { total: 10 }; }
    static fromData() { return new DamageRoll(); }
    alter(multiplier) { return { total: this.total * multiplier }; }
  }
  context.game.pf2e = { DamageRoll };
  const actor = { uuid: "Actor.target", items: new Map(), get hitPoints() { return { value: hp }; },
    update: async data => { hp = data["system.attributes.hp.value"]; },
    applyDamage: async ({ damage, rollOptions }) => {
      hp -= damage.total;
      const message = { id: `damage${++serial}`, flags: { pf2e: { context: { options: [...rollOptions] }, appliedDamage: { uuid: "Actor.target", updates: [{ path: "system.attributes.hp.value", value: damage.total }] } } },
        setFlag: async () => { message.flags.pf2e.appliedDamage.isReverted = true; } };
      messages.set(message.id, message); hooks.createChatMessage(message);
    } };
  context.fromUuid = async () => ({ actor });
  const state = { cycle: "cycle", tokenUuid: "token", damage: "2d6[fire]", name: "Hazard" };
  const card = { flags: { [scope]: { spellFloorSave: state } }, setFlag: async (_, key, value) => { state[key.split(".").at(-1)] = value; } };
  await context.resolveSpellFloorSave(card, "failure"); assert.equal(hp, 90);
  hp -= 3;
  await context.resolveSpellFloorSave(card, "success", true); assert.equal(hp, 92);
  await context.resolveSpellFloorSave(card, "success", true); assert.equal(hp, 92);
  await context.resolveSpellFloorSave(card, "criticalSuccess", true); assert.equal(hp, 97);
  await context.resolveSpellFloorSave(card, "failure"); assert.equal(hp, 97);
  assert.equal(rolls, 1);
});

test("blizzard rendering contains transparent snow streaks without a filled backdrop", () => {
  const floors = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8");
  const fn = floors.slice(floors.indexOf("function createSpellParticles("));
  const graphics = [];
  class Graphic {
    constructor() { this.fills = []; this.lines = []; graphics.push(this); }
    beginFill(color, alpha) { this.fills.push({ color, alpha }); }
    lineStyle(width, color, alpha) { this.lines.push({ width, color, alpha }); }
    moveTo() {} lineTo() {} drawCircle() {} drawEllipse() {} endFill() {}
  }
  class Container { addChild() {} }
  const context = vm.createContext({ PIXI: { Container }, newGraphics: () => new Graphic(),
    drawPolygon: () => {}, polygonBounds: () => ({ x: 0, y: 0, width: 400, height: 400 }),
    canvas: { dimensions: { size: 100 } }, seededRandom: () => () => 0.5 });
  vm.runInContext(fn, context);
  context.createSpellParticles([], "test", "blizzard", false);
  assert.equal(graphics[0].fills.length, 0);
  assert.equal(graphics[0].lines.length, 512);
  assert.ok(graphics[0].lines.every(line => line.alpha < 1 && line.width < 2));
});

test("hazardous placements with no damage warn instead of creating a silent floor", () => {
  const { context, hooks } = fixture();
  const warnings = []; context.ui = { notifications: { warn: message => warnings.push(message) } };
  let updated = false;
  hooks.preCreateRegion({ updateSource: () => updated = true }, { flags: { [scope]: { spellFloor: { effect: "hazardous", style: "devil", damage: "", save: "reflex", dc: 20 } } } });
  assert.equal(updated, false);
  assert.equal(warnings.length, 1);
  hooks.preCreateRegion({ updateSource: value => { updated = value; } }, { flags: { [scope]: { spellFloor: { effect: "hazardous", style: "devil", damage: "2d6[fire]", save: "reflex", dc: 20 } } } });
  assert.equal(updated[`flags.${scope}.spellFloor`].damage, "2d6[fire]");
});
