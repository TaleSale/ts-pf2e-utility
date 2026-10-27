import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("dynamic checks are enriched before Target Helper reads the card", async () => {
  const ready = [];
  const calls = [];
  const actor = { uuid: "Actor.source" };
  const item = { type: "action", actor, getFlag: () => ({}), getRollData: () => ({}) };
  const sandbox = {
    Hooks: { once: (name, fn) => { if (name === "ready") ready.push(fn); }, on() {} },
    registerActionPlusFeature() {}, MODULE_ID: "ts-pf2e-utility", I18N_PREFIX: "TS_PF2E_UTILITY",
    game: { actors: { get: () => actor }, pf2e: { TextEditor: {
      async enrichString(match, options) {
        assert.equal(options.rollData.actor, actor);
        assert.equal(options.rollData.item, item);
        return { outerHTML: '<a class="inline-check" data-pf2-check="will" data-pf2-dc="24">Save</a>' };
      },
    } } },
    canvas: { tokens: { placeables: [] } }, fromUuid: async () => item,
    ChatMessage: { async createDocuments(data, options) { calls.push([this, data, options]); return data; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL("../scripts/actionplus/degree-of-success.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, ""), sandbox);
  ready[0]();
  for (const dc of ["", "v1"]) {
    const source = { content: `@Check[will|dc:${dc}|basic]`, flags: { pf2e: { origin: { uuid: "Actor.source.Item.action" } } } };
    const options = { render: false };
    const [result] = await sandbox.ChatMessage.createDocuments([source], options);
    assert.match(result.content, /data-pf2-dc="24"/);
    assert.match(source.content, /@Check/);
    assert.equal(calls.at(-1)[0], sandbox.ChatMessage);
    assert.equal(calls.at(-1)[2], options);
  }
  const fixed = { content: "@Check[will|dc:25|basic]" };
  assert.equal((await sandbox.ChatMessage.createDocuments([fixed]))[0], fixed);
});

test("damage saves never interpret an empty DC as zero and include adjustments", () => {
  const sandbox = { Hooks: { once() {}, on() {} } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL("../scripts/utility/damage-save.js", import.meta.url), "utf8"), sandbox);
  for (const dc of ["", "v1", "0"]) {
    assert.equal(sandbox.getSaveVariantFromInline(`@Check[will|dc:${dc}|basic]`), null);
    assert.equal(sandbox.isSaveLink({ dataset: { pf2Check: "will", pf2Dc: dc } }), false);
  }
  assert.equal(sandbox.getSaveVariantFromInline("@Check[will|dc:24|basic]").dc, 24);
  sandbox.MonsterDC = (level, tier) => { assert.equal(level, 7); return tier === "high" ? 25 : 22; };
  const item = { actor: { type: "npc", level: 7 } };
  assert.equal(sandbox.getSaveVariantFromInline("@Check[will|dc:|basic]", item).dc, 22);
  assert.equal(sandbox.getSaveVariantFromInline("@Check[will|dc:v1|basic]", item).dc, 22);
  assert.equal(sandbox.getSaveVariantFromInline("@Check[will|dc:|V2|basic]", item).dc, 25);
  assert.equal(sandbox.getSaveVariant({ dataset: { pf2Check: "will", pf2Dc: "24", pf2Adjustment: "2" } }).dc, 26);
});
