import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function runtime() {
  const hooks = new Map();
  const setProperty = (object, path, value) => {
    const keys = path.split(".");
    const last = keys.pop();
    for (const key of keys) object = object[key] ??= {};
    object[last] = value;
  };
  const sandbox = {
    Hooks: { once() {}, on(name, fn) { const callbacks = hooks.get(name) ?? []; callbacks.push(fn); hooks.set(name, callbacks); } },
    registerActionPlusFeature() {}, MODULE_ID: "ts-pf2e-utility", I18N_PREFIX: "TS_PF2E_UTILITY",
    game: { user: { id: "gm" }, users: { activeGM: { id: "gm" } } },
    foundry: { utils: { setProperty, hasProperty: () => true } },
    fromUuid: async (uuid) => ({ type: "condition", slug: uuid, uuid, system: {},
      toObject: () => ({ type: "condition", system: { value: { value: 1 } } }) }),
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL("../scripts/actionplus/degree-of-success.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, ""), sandbox);
  const items = new Map();
  items.filter = (fn) => [...items.values()].filter(fn);
  let sequence = 0;
  const actor = {
    items, isOwner: true, canUserModify: () => true,
    async createEmbeddedDocuments(_type, sources) {
      const created = [];
      for (const data of sources) {
        const item = { ...data, id: String(++sequence), actor, flags: {},
          getFlag: (module, key) => item.flags[module]?.[key],
          async setFlag(module, key, value) { (item.flags[module] ??= {})[key] = value; },
          async update(updates) { for (const [path, value] of Object.entries(updates)) setProperty(item, path, value); },
        };
        items.set(item.id, item);
        if (data.system.rules?.[0]?.key === "GrantItem") {
          const [condition] = await actor.createEmbeddedDocuments("Item", [{ type: "condition", system: {} }]);
          item.flags.pf2e = { itemGrants: { condition: { id: condition.id } } };
        }
        created.push(item);
      }
      return created;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      for (const id of ids) {
        const item = items.get(id);
        if (!item) continue;
        items.delete(id);
        for (const callback of hooks.get("deleteItem")) await callback(item);
      }
    },
  };
  return { sandbox, actor };
}

test("links support conditions and persistent damage in either direction, including chains", async () => {
  for (const persistentFirst of [false, true]) {
    const { sandbox, actor } = runtime();
    const effects = ["sickened", "persistent-damage", "slowed"].map((uuid) => ({ uuid, value: 1,
      parentUuid: uuid === "slowed" ? "persistent-damage" : "",
      ...(uuid === "persistent-damage" ? { persistent: { formula: "2d6", damageType: "fire", dc: 15 } } : {}),
    }));
    effects[persistentFirst ? 0 : 1].parentUuid = persistentFirst ? "persistent-damage" : "sickened";
    await sandbox.applyRecipient({ enabled: true, effects }, actor);
    assert.equal(actor.items.size, 3);
    assert.equal(actor.items.get("2").system.persistent.formula, "2d6");
    await actor.deleteEmbeddedDocuments("Item", [persistentFirst ? "2" : "1"]);
    assert.equal(actor.items.size, 0);
  }
});

test("removing a dependent leaves its parent and independent conditions intact", async () => {
  const { sandbox, actor } = runtime();
  await sandbox.applyRecipient({ enabled: true, effects: [
    { uuid: "sickened", value: 1 }, { uuid: "slowed", value: 1, parentUuid: "sickened" }, { uuid: "frightened", value: 1 },
  ] }, actor);
  await actor.deleteEmbeddedDocuments("Item", ["2"]);
  assert.deepEqual([...actor.items.keys()], ["1", "3"]);
});

test("self links and cycles are rejected", () => {
  const { sandbox } = runtime();
  const effects = [{ uuid: "a", parentUuid: "b" }, { uuid: "b", parentUuid: "c" }, { uuid: "c" }];
  assert.equal(sandbox.canLinkEffect(effects, "a", "a"), false);
  assert.equal(sandbox.canLinkEffect(effects, "c", "a"), false);
  assert.equal(sandbox.canLinkEffect(effects, "a", "c"), true);
});

test("recovery from a timed persistent condition removes dependants before its wrapper expires", async () => {
  const { sandbox, actor } = runtime();
  await sandbox.applyRecipient({ enabled: true, effects: [
    { uuid: "persistent-damage", durationUnit: "rounds", durationValue: 3, persistent: { formula: "1d6", damageType: "fire", dc: 15 } },
    { uuid: "slowed", value: 1, parentUuid: "persistent-damage" },
  ] }, actor);
  assert.equal(actor.items.get("2").system.persistent.formula, "1d6");
  assert.equal(actor.items.get("3").getFlag("ts-pf2e-utility", "degreeOfSuccessParent"), "2");
  await actor.deleteEmbeddedDocuments("Item", ["2"]);
  assert.deepEqual([...actor.items.keys()], ["1"]);
});

test("automatic temporary healing labels follow the setting and preserve custom labels", async () => {
  for (const enabled of [false, true]) {
    for (const custom of [undefined, "Custom"]) {
      for (const tag of ["thealing", "t+healing"]) {
        class Element {
          dataset = {};
          label = { textContent: custom ?? "6" };
          querySelector() { return this.label; }
        }
        const sandbox = { Hooks: { once() {}, on() {} }, HTMLElement: Element,
          CONFIG: { ux: { TextEditor: { async enrichString(match) {
            assert.doesNotMatch(match[2], /\[(?:thealing|t\+healing)\]/);
            if (!custom) assert.match(match[2], /\|shortLabel/);
            return new Element();
          } } } },
          game: { settings: { get: () => enabled }, i18n: { localize: (key) => ({ TemporaryShort: "ВОЗ", HitPointsShort: "ОЗ" })[key.split(".").at(-1)] ?? key } },
        };
        vm.createContext(sandbox);
        vm.runInContext(readFileSync(new URL("../scripts/utility/temp-hp.js", import.meta.url), "utf8"), sandbox);
        const element = await sandbox.enrichTempHealingDamage([`@Damage[6[${tag}]]`, "Damage", `6[${tag}]`, custom], {});
        assert.equal(element.label.textContent, custom ?? `6 ${enabled ? "ВОЗ" : "ОЗ"}`);
        assert.equal(Boolean(element.dataset.tempHealing), enabled);
      }
    }
  }
});
