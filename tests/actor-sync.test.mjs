import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/utility/actor-sync.js", import.meta.url), "utf8");
const actorLinkSource = source.slice(
  source.indexOf("function getUuidFromActorLink(value) {"),
  source.indexOf("async function resolveDroppedWorldActor("),
);

test("full refresh accepts world and compendium actors through UUID, rich link, and drag data", async () => {
  const world = { documentName: "Actor", uuid: "Actor.yPYQC2bfOYmqcfIB" };
  const compendium = { documentName: "Actor", uuid: "Compendium.pf2e.monsters.Actor.example", pack: "pf2e.monsters" };
  const documents = new Map([world, compendium].map((actor) => [actor.uuid, actor]));
  documents.set("Item.example", { documentName: "Item" });
  const context = vm.createContext({
    MODULE_ID: "ts-pf2e-utility",
    console: { warn() {} },
    fromUuid: async (uuid) => {
      if (uuid === "invalid") throw new Error("Invalid UUID");
      return documents.get(uuid) ?? null;
    },
  });
  vm.runInContext(actorLinkSource, context);
  for (const actor of [world, compendium]) {
    for (const link of [actor.uuid, `  ${actor.uuid}  `, `@UUID[${actor.uuid}]{Actor}`, JSON.stringify({ type: "Actor", uuid: actor.uuid })]) {
      assert.equal(await context.resolvePastedSourceActor(link), actor);
    }
  }
  for (const link of ["", "not a link", "Actor.missing", "@UUID[Item.example]{Item}", '{"uuid":"invalid"}']) {
    assert.equal(await context.resolvePastedSourceActor(link), null);
  }
});

const refreshSource = source.slice(
  source.indexOf("async function refreshSelectedItems(root) {"),
  source.indexOf("async function renderItemRefreshContentFromItemSources("),
);

async function refreshItem({ type, stored, prepared = stored, flags = {} }) {
  const calls = [];
  const item = {
    id: "owned", type, sort: 42, system: prepared, flags,
    toObject: () => ({ type, system: structuredClone(stored) }),
  };
  const compendiumData = {
    _id: "source", type, name: "Updated translation", img: "updated.webp",
    system: { description: { value: "Updated description" }, rules: [{ key: "GrantItem" }] },
    flags: { translation: { updated: true } },
  };
  if (Object.hasOwn(stored, "quantity")) compendiumData.system.quantity = 1;
  if (Object.hasOwn(stored, "runes")) compendiumData.system.runes = { potency: 0, property: [] };
  const actor = {
    items: new Map([[item.id, item]]),
    async updateEmbeddedDocuments(...args) { calls.push(structuredClone(args)); },
  };
  const context = vm.createContext({
    MODULE_ID: "ts-pf2e-utility",
    foundry: { utils: { deepClone: structuredClone } },
    game: { actors: new Map([["actor", actor]]) },
    ui: { notifications: { warn() {}, info() {} } },
    fromUuid: async () => ({ documentName: "Item", toObject: () => structuredClone(compendiumData) }),
  });
  vm.runInContext(refreshSource, context);
  assert.equal(await context.refreshSelectedItems({
    dataset: { actorId: "actor" },
    querySelectorAll: () => [{ dataset: { itemId: "owned", sourceUuid: "Compendium.test.source" } }],
  }), true);
  const update = calls[0][1][0];
  assert.equal(update._id, "owned");
  assert.equal(update.sort, 42);
  assert.equal(update.name, compendiumData.name);
  assert.deepEqual(update.system.description, compendiumData.system.description);
  assert.deepEqual(update.system.rules, compendiumData.system.rules);
  assert.deepEqual(update.flags.translation, compendiumData.flags.translation);
  assert.deepEqual(calls[0][2], { diff: false, recursive: false });
  return { update, calls };
}

test("custom refresh preserves stored quantity and runes, including zero and empty runes", async () => {
  for (const type of ["weapon", "armor", "shield"]) {
    for (const quantity of [0, 9]) {
      const runes = quantity ? { potency: 2, striking: 2, property: ["flaming"] } : { potency: 0, property: [] };
      const { update } = await refreshItem({
        type, stored: { quantity, runes },
        prepared: { quantity: 99, runes: { potency: 4, property: ["holy"] } },
      });
      assert.equal(update.system.quantity, quantity);
      assert.deepEqual(update.system.runes, runes);
    }
  }
  const { update } = await refreshItem({ type: "consumable", stored: { quantity: 12 } });
  assert.equal(update.system.quantity, 12);
  assert.equal(Object.hasOwn(update.system, "runes"), false);
});

test("custom refresh retains spell placement, heightened rank, and module flags", async () => {
  const location = { value: "entry", heightenedLevel: 5 };
  const flags = { "ts-pf2e-utility": { custom: true } };
  const { update, calls } = await refreshItem({ type: "spell", stored: { location }, flags });
  assert.deepEqual(update.system.location, location);
  assert.deepEqual(update.flags["ts-pf2e-utility"], flags["ts-pf2e-utility"]);
  assert.equal(Object.hasOwn(update.system, "quantity"), false);
  assert.deepEqual(calls[1][1], [{ _id: "owned", "system.location.value": "entry", "system.location.heightenedLevel": 5 }]);
});

test("custom refresh retains linked weapon references", async () => {
  const { update, calls } = await refreshItem({ type: "melee", stored: {}, flags: { pf2e: { linkedWeapon: "weapon" } } });
  assert.equal(update.flags.pf2e.linkedWeapon, "weapon");
  assert.equal(calls.length, 1);
});
