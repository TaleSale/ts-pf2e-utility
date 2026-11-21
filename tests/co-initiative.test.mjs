import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/actionplus/co-initiative.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replaceAll("export function", "function");

function harness() {
  const documents = new Map();
  const events = [];
  let feature;
  class Combat {
    constructor() {
      this.scene = { tokens: { contents: [] } };
      this.combatants = { contents: [], get(id) { return this.contents.find((entry) => entry.id === id); }, some(fn) { return this.contents.some(fn); } };
      this.turns = []; this.turn = 0; this.round = 1; this.started = true;
    }
    get combatant() { return this.turns[this.turn]; }
    setupTurns() { return this.turns = [...this.combatants.contents]; }
    async _onStartTurn(parent, options) {
      if (parent.flags.pf2e.roundOfLastTurn !== options.round) await parent.onStartTurn();
    }
    async _onEndTurn(parent, options) {
      if (!options.skipped && parent.flags.pf2e.roundOfLastTurnEnd !== options.round) await parent.onEndTurn(options);
    }
  }
  const context = vm.createContext({
    MODULE_ID: "ts-pf2e-utility", I18N_PREFIX: "TS_PF2E_UTILITY", console,
    escapeHtml: String, fromUuidSync: (uuid) => documents.get(uuid),
    registerActionPlusFeature: (value) => { feature = value; },
    isActionPlusFeatureEnabled: (item) => item.enabled,
    Hooks: { once() {}, on() {}, callAll: (...args) => events.push(args) },
    CONFIG: { Combat: { documentClass: Combat } },
    game: { user: { id: "gm" } },
  });
  vm.runInContext(source, context);
  context.installCombatWrappers();
  const combat = new Combat();
  function member(id, type = "npc") {
    const actor = { uuid: `Actor.${id}`, documentName: "Actor", type, items: { contents: [] }, rules: [],
      update: async () => {}, recharge: async () => {} };
    const token = { uuid: `Scene.scene.Token.${id}`, documentName: "Token", parent: combat.scene, actor };
    documents.set(actor.uuid, actor); documents.set(token.uuid, token);
    combat.scene.tokens.contents.push(token);
    const entry = { id, actor, token, flags: { pf2e: {} }, starts: 0, ends: 0,
      async onStartTurn() { this.starts++; this.flags.pf2e.roundOfLastTurn = combat.round; },
      async onEndTurn({ round }) { this.ends++; this.flags.pf2e.roundOfLastTurnEnd = round; },
      async update(data) { for (const [key, value] of Object.entries(data)) this.flags.pf2e[key.split(".").at(-1)] = value; },
    };
    combat.combatants.contents.push(entry);
    return entry;
  }
  function link(parent, ...children) {
    parent.actor.items.contents.push({ type: "feat", enabled: true, getFlag: () => ({ members: children.map((entry) => ({ uuid: entry.token.uuid })) }) });
  }
  return { context, combat, member, link, events, feature };
}

test("character feats support multiple companions and remove them from turn navigation", () => {
  const { combat, member, link, feature } = harness();
  assert.deepEqual(Array.from(feature.itemTypes), ["action", "feat"]);
  const owner = member("owner", "character"), child = member("child"), second = member("second"), enemy = member("enemy");
  combat.setupTurns(); combat.turn = 3;
  link(owner, child, second);
  assert.deepEqual(Array.from(combat.setupTurns(), (entry) => entry.id), ["owner", "enemy"]);
  assert.equal(combat.combatant, enemy);
  owner.actor.items.contents = [];
  combat.setupTurns();
  assert.equal(combat.turns.length, 4);
  assert.equal(combat.combatant, enemy);
});

test("cycles fail open and chains share the root owner's turn", () => {
  const { context, combat, member, link } = harness();
  const a = member("a"), b = member("b"), c = member("c");
  link(a, b); link(b, c);
  assert.equal(context.coInitiativeParents(combat).get("c"), "a");
  link(c, a);
  assert.equal(context.coInitiativeParents(combat).size, 0);
  assert.equal(combat.setupTurns().length, 3);
});

test("start and end events run once per round for all companions", async () => {
  const { combat, member, link } = harness();
  const owner = member("owner"), child = member("child"), second = member("second");
  link(owner, child, second); combat.setupTurns();
  for (let i = 0; i < 2; i++) {
    await combat._onStartTurn(owner, { round: 1 });
    await combat._onEndTurn(owner, { round: 1 });
  }
  for (const entry of [owner, child, second]) {
    assert.equal(entry.starts, 1); assert.equal(entry.ends, 1);
  }
  combat.round = 2;
  await combat._onEndTurn(owner, { round: 2, skipped: true });
  assert.equal(child.ends, 1);
  await combat._onStartTurn(owner, { round: 2 });
  await combat._onEndTurn(owner, { round: 2 });
  assert.equal(child.starts, 2); assert.equal(child.ends, 2);
});

test("native familiar processing is not duplicated but hooks and round flags advance", async () => {
  const { combat, member, link, events } = harness();
  const owner = member("owner", "character"), familiar = member("familiar", "familiar");
  owner.actor.familiar = familiar.actor;
  let recharge = 0, rules = 0;
  familiar.actor.recharge = async () => { recharge++; };
  familiar.actor.rules = [{ onUpdateEncounter: async () => { rules++; } }];
  link(owner, familiar); combat.setupTurns();
  for (let i = 0; i < 2; i++) {
    await combat._onStartTurn(owner, { round: 1 });
    await combat._onEndTurn(owner, { round: 1 });
  }
  assert.equal(familiar.starts, 0); assert.equal(familiar.ends, 0);
  assert.equal(recharge, 1); assert.equal(rules, 1);
  assert.equal(events.length, 2);
  assert.equal(familiar.flags.pf2e.roundOfLastTurnEnd, 1);
});

test("actor references reject ambiguous scene copies; token references remain exact", () => {
  const { context, combat, member, link } = harness();
  const owner = member("owner"), child = member("child");
  owner.actor.items.contents.push({ type: "action", enabled: true, getFlag: () => ({ members: [{ uuid: child.actor.uuid }] }) });
  assert.equal(context.coInitiativeParents(combat).get(child.id), owner.id);
  combat.scene.tokens.contents.push({ ...child.token, uuid: "Scene.scene.Token.copy" });
  assert.equal(context.coInitiativeParents(combat).size, 0);
  link(owner, child);
  assert.equal(context.coInitiativeParents(combat).get(child.id), owner.id);
});

test("an actor reference resolves a single unlinked NPC token", () => {
  const { context, combat, member } = harness();
  const owner = member("owner"), child = member("child");
  const baseActor = child.actor;
  baseActor.id = "child";
  child.token.actorId = baseActor.id;
  child.actor = child.token.actor = { ...baseActor, uuid: `${child.token.uuid}.Actor.child` };
  owner.actor.items.contents.push({ type: "action", enabled: true, getFlag: () => ({ members: [{ uuid: baseActor.uuid }] }) });
  assert.equal(context.coInitiativeParents(combat).get(child.id), owner.id);
});

test("sync creates linked minions and eidolons through the Combatant API, bypassing PF2e's encounter exclusion", async () => {
  const { context, combat, member, link } = harness();
  const owner = member("owner", "character"), minion = member("minion"), eidolon = member("eidolon");
  combat.scene.id = "scene";
  for (const entry of [owner, minion, eidolon]) {
    entry.token.id = entry.tokenId = entry.id;
    entry.token.actorId = entry.id;
    entry.sceneId = "scene";
    entry.initiative = null;
  }
  link(owner, minion, eidolon);
  combat.combatants.contents = [owner];
  combat.setupTurns();
  combat.createEmbeddedDocuments = () => { throw new Error("PF2e rejects minions and eidolons here"); };
  let creations = 0;
  context.CONFIG.Combatant = { documentClass: {
    async createDocuments(data, options) {
      creations++;
      assert.equal(options.parent, combat);
      assert.deepEqual(Array.from(data, (entry) => entry.tokenId), ["minion", "eidolon"]);
      combat.combatants.contents.push(minion, eidolon);
      return [minion, eidolon];
    },
  } };
  context.game.users = { activeGM: { id: "gm" } };
  context.game.combats = { contents: [combat] };
  context.ui = { combat: { render() {} } };
  await context.syncCombats();
  await context.syncCombats();
  assert.equal(creations, 1, "subsequent sync must not add duplicates");
  assert.equal(combat.combatants.contents.length, 3);
  assert.deepEqual(Array.from(combat.turns, (entry) => entry.id), ["owner"]);
  await combat._onEndTurn(owner, { round: 1 });
  assert.equal(minion.ends, 1);
  assert.equal(eidolon.ends, 1);
});
