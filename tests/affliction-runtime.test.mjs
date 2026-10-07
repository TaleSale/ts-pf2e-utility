import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadNativePF2eChecks } from "./helpers/pf2e-check-harness.mjs";

const ID = "ts-pf2e-utility", hooks = new Map(), docs = new Map(), warnings = [], errors = [];
const reportError = console.error;
console.error = (...args) => { errors.push(args); reportError(...args); };
test.after(() => { console.error = reportError; assert.deepEqual(errors, []); });
let serial = 0;
const user = { id: "gm", isGM: true, targets: new Set() };
const collection = (list = []) => Object.defineProperty(Object.assign(list, {
  get(id) { return this.find((entry) => entry.id === id); },
  has(id) { return !!this.get(id); },
}), "contents", { get() { return this; } });
function get(object, path) { return object?.[path] ?? path.split(".").reduce((value, key) => value?.[key], object); }
function set(object, path, value) {
  const keys = path.split("."), last = keys.pop();
  for (const key of keys) object = object[key] ??= {};
  object[last] = structuredClone(value);
}
function emit(name, ...args) { for (const fn of hooks.get(name) ?? []) fn(...args); }
const drain = async () => { for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve)); };
function flagged(object) {
  object.flags ??= {};
  return Object.assign(object, {
    getFlag(module, key) { return this.flags[module]?.[key]; },
    async setFlag(module, key, value) { (this.flags[module] ??= {})[key] = structuredClone(value); },
  });
}
globalThis.Hooks = {
  on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); return fn; },
  once(name, fn) { return this.on(name, fn); },
  off(name, fn) { hooks.set(name, (hooks.get(name) ?? []).filter((entry) => entry !== fn)); },
};
globalThis.foundry = { utils: { deepClone: structuredClone, getProperty: get, setProperty: set, hasProperty: (o, p) => get(o, p) !== undefined, randomID: () => String(++serial), escapeHTML: String } };
Math.clamp = (n, min, max) => Math.max(min, Math.min(max, n));
globalThis.CONFIG = { time: { roundTime: 6 }, PF2E: { damageTypes: { poison: "Poison" }, conditionTypes: { enfeebled: "Enfeebled" } } };
globalThis.ui = { notifications: { warn: (message) => warnings.push(message), info() {} } };
const translations = JSON.parse(fs.readFileSync(new URL("../lang/ru/actionplus.json", import.meta.url), "utf8"));
globalThis.game = {
  user, actors: collection(), messages: collection(),
  i18n: { lang: "ru", localize: (key) => get(translations, key) ?? key },
  combat: { id: "combat", round: 1, turn: 0 },
  settings: { get: () => true },
  pf2e: { ConditionManager: { getCondition(slug) { return { toObject: () => ({ name: slug, type: "condition", system: { slug, value: { value: 1 } } }) }; } } },
};
globalThis.canvas = { tokens: { placeables: [] } };
globalThis.fromUuid = async (uuid) => docs.get(uuid);
globalThis.fromUuidSync = (uuid) => docs.get(uuid);
globalThis.TextEditor = { enrichHTML: async (html) => html };
globalThis.Roll = class { constructor(formula) { this.formula = formula; } async evaluate() { this.total = Number(this.formula); return this; } };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor?.id }),
  async create(source) {
    const message = flagged({ ...structuredClone(source), id: "message-" + ++serial, isAuthor: true, isRoll: false,
      canUserModify: () => true,
      async update(changed) { for (const [key, value] of Object.entries(changed)) set(this, key, value); emit("updateChatMessage", this, changed); },
      updateSource(changed) { for (const [key, value] of Object.entries(changed)) set(this, key, value); },
    });
    game.messages.push(message);
    emit("createChatMessage", message);
    return message;
  },
  async deleteDocuments(ids) { for (const id of ids) { const index = game.messages.findIndex((m) => m.id === id); if (index >= 0) game.messages.splice(index, 1); } },
};
const damageFormulas = [];
game.pf2e.DamageRoll = class {
  constructor(formula) { damageFormulas.push(formula); this.formula = formula; }
  async evaluate() { this.total = 5; return this; }
  async toMessage(source) { return ChatMessage.create(source); }
};

function actor() {
  const id = "actor-" + ++serial;
  const actor = flagged({ id, uuid: "Actor." + id, documentName: "Actor", name: id, type: "character", primaryUpdater: user, items: collection(),
    system: { attributes: { hp: { value: 100, temp: 0 } } },
    get hp() { return this.system.attributes.hp.value; },
    set hp(value) { this.system.attributes.hp.value = value; },
    get hitPoints() { return this.system.attributes.hp; },
    get itemTypes() { return { effect: this.items.filter((item) => item.type === "effect"), action: this.items.filter((item) => item.type === "action") }; },
    canUserModify: () => true,
    async createEmbeddedDocuments(_type, sources) {
      return sources.map((source) => {
        const item = flagged({ ...structuredClone(source), id: "item-" + ++serial, documentName: "Item", actor: this,
          async update(changed, options = {}) {
            emit("preUpdateItem", this, changed, options);
            for (const [key, value] of Object.entries(changed)) {
              if (key === "system" || key === "flags") for (const [part, data] of Object.entries(value)) set(this[key], part, data);
              else set(this, key, value);
            }
            emit("updateItem", this, changed, options);
          },
          async delete(options = {}) { await this.actor.deleteEmbeddedDocuments("Item", [this.id], options); },
        });
        item.uuid = `${this.uuid}.Item.${item.id}`;
        docs.set(item.uuid, item); this.items.push(item); return item;
      });
    },
    async deleteEmbeddedDocuments(_type, ids, options = {}) {
      for (const id of ids) { const item = this.items.get(id); if (!item) continue; this.items.splice(this.items.indexOf(item), 1); docs.delete(item.uuid); emit("deleteItem", item, options); }
    },
    async update(changed, options = {}) {
      await new Promise((resolve) => setImmediate(resolve));
      for (const [key, value] of Object.entries(changed)) set(this, key, value);
      this.lastUpdateOptions = options;
      return this;
    },
    async applyDamage({ damage, rollOptions }) {
      this.damageStartingHp ??= []; this.damageStartingHp.push(this.hp);
      const applied = Math.max(0, damage.total - (this.resistance ?? 0));
      const tempDamage = Math.min(this.hitPoints.temp, applied);
      const hpDamage = Math.min(this.hp, applied - tempDamage);
      this.hitPoints.temp -= tempDamage; this.hp -= hpDamage;
      await ChatMessage.create({ flags: { pf2e: {
        context: { type: "damage-taken", options: [...rollOptions] },
        appliedDamage: applied ? { uuid: this.uuid, isHealing: false, shield: null, persistent: [], updates: [
          { path: "system.attributes.hp.value", value: hpDamage },
          { path: "system.attributes.hp.temp", value: tempDamage },
        ].filter((update) => update.value) } : null,
      } } });
      // Native PF2e returns the Actor; undo data lives on the damage-taken message.
      return this;
    },
    async undoDamage(data) {
      const changed = Object.fromEntries(data.updates.map(({ path, value }) => [path, get(this, path) + value]));
      // Native PF2e also does not await this update before undoDamage resolves.
      void this.update(changed, { damageUndo: true });
    },
  });
  actor.combatant = { id: "combatant-" + id, actor, token: { uuid: "Scene.test.Token." + id } };
  docs.set(actor.uuid, actor); game.actors.push(actor);
  const token = { id, uuid: actor.combatant.token.uuid, documentName: "Token", actor };
  docs.set(token.uuid, token);
  return actor;
}
await import("../scripts/actionplus/affliction.js");
const { isSupportedActionPlusItem } = await import("../scripts/actionplus/actionplus.js");
const root = (actor) => actor.itemTypes.effect.find((item) => item.getFlag(ID, "afflictionInstance"));
const state = (actor) => root(actor)?.getFlag(ID, "afflictionInstance");
async function poison(type = "action", onset = false) {
  const source = actor(); source.type = "npc"; source.level = 9;
  return (await source.createEmbeddedDocuments("Item", [{ name: "Яд", type, flags: { [ID]: { actionOptions: ["affliction"] } }, system: {
    level: { value: 3 }, traits: { value: ["poison"] },
    description: { value: `Стойкость КС 20; ${onset ? "Возникновение 1 раунд;" : ""} Макс. продолжительность 1 минута.
      Стадия 1: @Damage[1d6+2[poison]] и ослаблен 1 (1 раунд).
      Стадия 2: @Damage[2d6+2[poison]] и ослаблен 2 (1 раунд).
      Стадия 3: @Damage[3d6+2[poison]] и ослаблен 3 (1 раунд).` },
  } }]))[0];
}
async function roll(actor, outcome, options, item = null) {
  const message = flagged({ id: "roll-" + ++serial, isRoll: true, actor, item, isAuthor: true,
    flags: { pf2e: { context: { type: "saving-throw", outcome, options } } },
  });
  game.messages.push(message); emit("createChatMessage", message); await drain(); return message;
}
const exposure = (actor, item, outcome = "failure", cycle = "exposure-" + ++serial) => roll(actor, outcome, [`${ID}:affliction-cycle:${cycle}`, `${ID}:affliction-action:${item.uuid}`], item);
async function endTurn(actor) { game.combat.round += 1; emit("pf2e.endTurn", actor.combatant); await drain(); }
function periodicOptions(actor) { const instance = state(actor); return [`${ID}:affliction-cycle:${instance.pendingCycleId}`, `${ID}:affliction-instance:${instance.id}`]; }

test("maximum stage continues saves, repeats its consequences and can recover", async () => {
  const target = actor(), item = await poison();
  await exposure(target, item, "criticalFailure");
  await endTurn(target); await roll(target, "failure", periodicOptions(target));
  assert.equal(state(target).stage, 3);
  for (let i = 0; i < 2; i++) {
    await endTurn(target); assert.equal(state(target).awaitingSave, true);
    const hp = target.hp;
    await roll(target, "criticalFailure", periodicOptions(target));
    assert.equal(state(target).stage, 3); assert.equal(state(target).awaitingSave, false);
    assert.equal(target.hp, hp - 5); assert.equal(state(target).remainingStageTurns, 1);
  }
  await endTurn(target); await roll(target, "success", periodicOptions(target));
  assert.equal(state(target).stage, 2);
  assert.match(root(target).name, /КС 20; Ранг 5/);
  assert.ok(damageFormulas.includes("(3d6+2)[poison]"));
});

test("periodic rerolls replace damage and conditions, including after the poison was cured", async () => {
  const target = actor(), item = await poison();
  await exposure(target, item); await endTurn(target);
  const options = periodicOptions(target), hp = target.hp;
  await roll(target, "success", options); assert.equal(root(target), undefined);
  await roll(target, "criticalFailure", options);
  assert.equal(state(target).stage, 3); assert.equal(target.hp, hp - 5);
  assert.equal(target.items.filter((i) => i.type === "condition").length, 1);
  assert.equal(target.items.find((i) => i.type === "condition").system.value.value, 3);
  await roll(target, "criticalSuccess", options);
  assert.equal(root(target), undefined); assert.equal(target.hp, hp);
  assert.equal(target.items.filter((i) => i.type === "condition").length, 0);
});

test("reroll awaits restoration of actual HP and temporary HP before applying new damage", async () => {
  const target = actor(), item = await poison();
  target.resistance = 2;
  target.hitPoints.temp = 2;
  const prior = await exposure(target, item, "failure");
  assert.equal(target.hp, 99); assert.equal(target.hitPoints.temp, 0);
  const previousDamageMessage = game.messages.findLast((message) => message.flags.pf2e?.appliedDamage?.uuid === target.uuid);
  target.hp -= 7; // Unrelated damage between the original saving throw and reroll.
  await roll(target, "criticalFailure", prior.flags.pf2e.context.options);
  assert.equal(target.damageStartingHp.at(-1), 93);
  assert.equal(target.hp, 92); assert.equal(target.hitPoints.temp, 0);
  assert.equal(game.messages.has(previousDamageMessage.id), false);
  await roll(target, "success", prior.flags.pf2e.context.options);
  assert.equal(target.hp, 93); assert.equal(target.hitPoints.temp, 2);
  assert.equal(target.lastUpdateOptions.damageUndo, true);
});

test("damage capture ignores other messages and removes its temporary hook", async () => {
  const target = actor(), item = await poison();
  const originalApply = target.applyDamage;
  target.applyDamage = async function(options) {
    const result = await originalApply.call(this, options);
    await ChatMessage.create({ flags: { pf2e: {
      context: { type: "damage-taken", options: [] },
      appliedDamage: { uuid: this.uuid, updates: [{ path: "system.attributes.hp.value", value: 77 }], persistent: [] },
    } } });
    return result;
  };
  const listeners = hooks.get("createChatMessage").length;
  const prior = await exposure(target, item);
  assert.equal(hooks.get("createChatMessage").length, listeners);
  assert.equal(target.getFlag(ID, "afflictionTransactions").at(-1).appliedDamage.updates[0].value, 5);
  await roll(target, "success", prior.flags.pf2e.context.options);
  assert.equal(target.hp, 100);
});

test("a manually reverted hit and a fully resisted hit never restore extra HP", async () => {
  const target = actor(), item = await poison();
  const prior = await exposure(target, item);
  const message = game.messages.findLast((entry) => entry.flags.pf2e?.appliedDamage?.uuid === target.uuid);
  target.hp = 100;
  message.flags.pf2e.appliedDamage.isReverted = true;
  await roll(target, "criticalFailure", prior.flags.pf2e.context.options);
  assert.equal(target.hp, 95);
  const resistant = actor(); resistant.resistance = 10;
  const noDamage = await exposure(resistant, item);
  assert.equal(resistant.getFlag(ID, "afflictionTransactions").at(-1).appliedDamage, null);
  await roll(resistant, "success", noDamage.flags.pf2e.context.options);
  assert.equal(resistant.hp, 100);
});

test("re-exposure reaching maximum stage replaces the old pending save with a fresh interval", async () => {
  const target = actor(), item = await poison();
  await exposure(target, item); await endTurn(target);
  const oldOptions = periodicOptions(target);
  await exposure(target, item, "criticalFailure");
  assert.equal(state(target).stage, 3);
  assert.equal(state(target).awaitingSave, false);
  assert.equal(state(target).remainingStageTurns, 1);
  await endTurn(target);
  assert.equal(state(target).awaitingSave, true);
  assert.notEqual(periodicOptions(target)[0], oldOptions[0]);
  await roll(target, "success", oldOptions);
  assert.equal(state(target).stage, 3);
  await roll(target, "success", periodicOptions(target));
  assert.equal(state(target).stage, 2);
});

test("manual badge changes become the next save's stage and invalidate outstanding cards", async () => {
  const target = actor(), item = await poison();
  await exposure(target, item); await endTurn(target);
  const stale = periodicOptions(target), hp = target.hp;
  await root(target).update({ "system.badge.value": 3 }); await drain();
  assert.equal(state(target).stage, 3); assert.equal(target.hp, hp);
  assert.equal(state(target).awaitingSave, false);
  await roll(target, "success", stale); assert.equal(state(target).stage, 3);
  await endTurn(target); await roll(target, "success", periodicOptions(target));
  assert.equal(state(target).stage, 2);
});

test("manual badges with onset use the stage offset", async () => {
  const target = actor(), item = await poison("action", true);
  await exposure(target, item);
  assert.equal(state(target).phase, "onset");
  await root(target).update({ "system.badge.value": 4 }); await drain();
  assert.equal(state(target).stage, 3);
  await endTurn(target); await roll(target, "success", periodicOptions(target));
  assert.equal(state(target).stage, 2); assert.equal(root(target).system.badge.value, 3);
});

test("Toolbelt rerolls and stored results share one transaction at maximum stage", async () => {
  const target = actor(), item = await poison();
  await exposure(target, item, "criticalFailure"); await endTurn(target);
  const card = game.messages.get(state(target).pendingMessageId), token = docs.get(target.combatant.token.uuid);
  const targetRef = { id: token.id, uuid: token.uuid };
  game.toolbelt = { targetHelper: { getMessageTargets: () => [targetRef] } };
  emit("pf2e-toolbelt.rollSave", { message: card, target: targetRef, data: { success: "failure" } }); await drain();
  assert.equal(state(target).stage, 3);
  emit("pf2e-toolbelt.rerollSave", { message: card, target: targetRef, data: { success: "success" } }); await drain();
  assert.equal(state(target).stage, 1);
  const hp = target.hp;
  await card.update({ "flags.pf2e-toolbelt.targetHelper.saveVariants": { null: { saves: { [token.id]: { success: "failure" } } } } }); await drain();
  assert.equal(state(target).stage, 1); assert.equal(target.hp, hp);
  await card.update({ "flags.pf2e-toolbelt.targetHelper.saveVariants": { null: { saves: { [token.id]: { success: "success", rerolled: "new" } } } } }); await drain();
  assert.equal(state(target).stage, 1); assert.equal(target.hp, hp);
  await endTurn(target); assert.equal(state(target).awaitingSave, true);
  delete game.toolbelt;
});

test("consumable poisons enable only their supported feature and use the item rank", async () => {
  const target = actor(), item = await poison("consumable");
  assert.equal(isSupportedActionPlusItem(item, "affliction"), true);
  assert.equal(isSupportedActionPlusItem(item), false);
  assert.equal(isSupportedActionPlusItem(item, "regeneration"), false);
  await exposure(target, item);
  assert.equal(state(target).definition.counteractRank, 2);
  assert.match(root(target).name, /КС 20; Ранг 2/);
});

test("updated standard save messages use the new kept outcome", async () => {
  const target = actor(), item = await poison();
  const message = await exposure(target, item, "criticalFailure");
  message.flags.pf2e.context.outcome = "success";
  emit("updateChatMessage", message, { "flags.pf2e.context.outcome": "success" }); await drain();
  assert.equal(root(target), undefined);
  assert.deepEqual(warnings, []);
});

test("a consumed and deleted poison still resolves from its exposure card", async () => {
  const target = actor(), item = await poison("consumable");
  const { parseAfflictionItem } = await import("../scripts/actionplus/affliction-parser.js");
  const cycleId = "consumed-" + ++serial, actionUuid = item.uuid;
  await ChatMessage.create({ flags: { [ID]: { afflictionExposure: { actionUuid, cycleId, definition: parseAfflictionItem(item, { language: "ru" }) } } } });
  await item.delete();
  await roll(target, "failure", [`${ID}:affliction-cycle:${cycleId}`, `${ID}:affliction-action:${actionUuid}`]);
  assert.equal(state(target).stage, 1);
  assert.equal(state(target).definition.counteractRank, 2);
});

test("consumable snapshot is captured before auto-destruction and prepares its saving throw", async () => {
  const target = actor(), item = await poison("consumable");
  const card = flagged({ id: "consumed-card-" + ++serial, item, isRoll: false, isAuthor: true, content: "Consumed poison",
    updateSource(changed) { for (const [key, value] of Object.entries(changed)) set(this, key, value); },
    async update(changed) { this.updateSource(changed); },
  });
  emit("preCreateChatMessage", card);
  assert.equal(card.getFlag(ID, "afflictionExposure").definition.counteractRank, 2);
  card.item = null;
  await item.delete();
  // A plain consumption message has no .chat-card; exercise the append fallback.
  globalThis.document = { createElement: () => ({ innerHTML: "", content: { querySelector: () => null } }) };
  game.messages.push(card); emit("createChatMessage", card); await drain();
  const snapshot = card.getFlag(ID, "afflictionExposure");
  assert.equal(snapshot.prepared, true);
  assert.match(card.content, /@Check\[fortitude\|dc:20\|immutable:true/);
  await roll(target, "failure", [`${ID}:affliction-cycle:${snapshot.cycleId}`, `${ID}:affliction-action:${snapshot.actionUuid}`]);
  assert.equal(state(target).stage, 1);
  delete globalThis.document;
});

test("installed PF2e replacement-message reroll restores a cured poison with its final outcome", async () => {
  const target = actor(), item = await poison();
  target.isOfType = (...types) => types.includes(target.type);
  target.getResource = () => null;
  game.pf2e.settings = { variants: { pwol: { enabled: false } } };
  const globals = { Roll: globalThis.Roll, ChatMessage: globalThis.ChatMessage, clone: foundry.utils.deepClone };
  const nativeMessages = [];
  const native = loadNativePF2eChecks({ messages: nativeMessages, emit(name, message) {
    message.isRoll = true;
    emit(name, message);
  } });
  globalThis.Roll = globals.Roll; globalThis.ChatMessage = globals.ChatMessage; foundry.utils.deepClone = globals.clone;
  Hooks.callAll = emit;
  await exposure(target, item); await endTurn(target);
  const options = periodicOptions(target);
  const prior = await roll(target, "success", options);
  assert.equal(root(target), undefined);
  native.dice.push(15);
  const oldRoll = await new native.CheckRoll("1d20+10", {}, { totalModifier: 10 }).evaluate();
  prior.rolls = [oldRoll];
  prior.delete = async () => { prior.deleted = true; };
  Object.assign(prior.flags.pf2e.context, { dc: { value: 20 }, origin: { actor: target.uuid }, messageMode: "public" });
  native.dice.push(1);
  await native.Check.rerollFromMessage(prior, { keep: "new" }); await drain();
  assert.equal(nativeMessages.at(-1).flags.pf2e.context.outcome, "criticalFailure");
  assert.equal(state(target).stage, 3);
  assert.equal(target.getFlag(ID, "afflictionTransactions").at(-1).reroll, true);
});
