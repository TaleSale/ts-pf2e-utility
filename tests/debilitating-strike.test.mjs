import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/actionplus/debilitating-strike.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from "\.\/actionplus.js";/, "")
  .split('Hooks.on("preUpdateItem"')[0];
const context = vm.createContext({
  MODULE_ID: "ts-pf2e-utility",
  Hooks: { once: () => {} },
  isSupportedActionPlusItem: (item) => item.type === "action",
  isActionPlusFeatureEnabled: (item) => item.enabled === true,
  foundry: { utils: {
    deepClone: structuredClone,
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
    setProperty: (object, path, value) => {
      const keys = path.split(".");
      const last = keys.pop();
      const parent = keys.reduce((value, key) => value[key] ??= {}, object);
      parent[last] = value;
    },
  } },
});

test("startup refresh repairs existing actions once and only on the active GM", async () => {
  let updates = 0;
  const item = {
    type: "action", enabled: true,
    getFlag: () => ({}),
    _source: { system: { rules: [], description: { value: "" } } },
    update: async (changed) => { updates++; item._source.system = structuredClone(changed.system); },
  };
  context.game = {
    user: { id: "gm" }, users: { activeGM: { id: "gm" } },
    actors: { contents: [{ items: { contents: [item] } }] },
    items: { contents: [] }, scenes: { contents: [] },
  };
  await context.refreshExistingDebilitations();
  assert.equal(updates, 1);
  await context.refreshExistingDebilitations();
  assert.equal(updates, 1);
  item._source.system.rules = [];
  context.game.user.id = "player";
  await context.refreshExistingDebilitations();
  assert.equal(updates, 1);
});
vm.runInContext(source, context);
const passes = (predicate, level) => predicate.every((entry) => !entry.gte || level >= entry.gte[1]);

test("level gates constrain generated and pre-existing merged controls", () => {
  const item = {
    getFlag: () => ({ selected: ["clumsy", "bloody"] }),
    _source: { system: { rules: [
      { key: "RollOption", option: "debilitation", suboptions: [{ value: "clumsy" }, { value: "bloody" }] },
      { key: "RollOption", option: "second-debilitation", suboptions: [{ value: "enfeebled" }] },
      { key: "Note", selector: "strike-damage", predicate: ["second-debilitation:enfeebled"] },
    ] } },
  };
  const changed = {};
  context.syncGeneratedData(item, changed);
  const rules = changed.system.rules;
  for (const level of [8, 9, 10, 12, 14, 15, 20]) {
    const controls = rules.filter((rule) => rule.key === "RollOption" && passes(rule.predicate, level));
    assert.equal(controls.some((rule) => rule.option === "second-debilitation"), level >= 15);
    assert.equal(controls.some((rule) => rule.option === "debilitation"), level >= 9);
    const choices = new Set(controls.filter((rule) => rule.option === "debilitation")
      .flatMap((rule) => rule.suboptions.filter((option) => passes(option.predicate ?? [], level)).map((option) => option.value)));
    if (level === 9) assert.deepEqual([...choices].sort(), ["enfeebled", "speed-penalty"]);
    assert.equal(choices.has("clumsy"), level >= 10);
    assert.equal(choices.has("bloody"), level >= 12);
    assert.equal(choices.has("master-strike"), level >= 20);
    const secondNotes = rules.filter((rule) => rule.key === "Note" && rule.predicate.some((entry) => typeof entry === "string" && entry.startsWith("second-debilitation:")));
    assert.equal(secondNotes.some((rule) => passes(rule.predicate, level)), level >= 15);
  }
  const again = {};
  context.syncGeneratedData({ ...item, _source: { system: changed.system } }, again);
  assert.equal(JSON.stringify(again.system.rules), JSON.stringify(rules));
});
