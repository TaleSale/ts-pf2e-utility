const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

Math.clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
global.game = {
  i18n: {
    lang: "ru",
    localize: (key) => key,
    format: (key) => key,
  },
  pf2e: { settings: { variants: { pwol: { enabled: false } } } },
};
global.CONFIG = { PF2E: { skills: {} } };
global.foundry = { utils: { randomID: () => "attempt-id" } };
global.Hooks = { once() {}, on() {} };

const sourcePath = path.resolve(__dirname, "../scripts/utility/ritual-checks.js");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace(
  /^import .*$/m,
  'const MODULE_ID = "ts-pf2e-utility", SOCKET_CHANNEL = "module.ts-pf2e-utility", escapeHtml = String, i18nKey = (key) => `TS_PF2E_UTILITY.${key}`;',
);
source += "\nglobalThis.__ritualChecksTest = { parseCheckOptions, candidateAllowsStatistic, recomputeSecondaryEffects, buildMarkerOptions, parseRitualMarker, getRitualDCs, getMaximumRitualRank };";
vm.runInThisContext(source, { filename: sourcePath });

const api = global.__ritualChecksTest;
const primary = api.parseCheckOptions("Ремесло, Природа или Общество (эксперт)");
assert.deepEqual(primary.map((option) => option.slug), ["crafting", "nature", "society"]);
assert.ok(primary.every((option) => option.minimumRank === undefined));
assert.equal(api.candidateAllowsStatistic(
  { kind: "skill", slug: "arcana" },
  {},
  { slug: "arcana", rank: 0 },
), true);

const markerOptions = api.buildMarkerOptions(
  { id: "session-id" },
  "secondary",
  { id: "skill-medicine" },
  { id: "actor-id" },
  { slug: "medicine" },
);
const marker = api.parseRitualMarker({ flags: { pf2e: { context: { options: markerOptions } } } });
assert.equal(marker.attemptId, "attempt-id");
assert.equal(marker.actorId, "actor-id");
assert.equal(marker.statisticSlug, "medicine");

const secondary = api.parseCheckOptions("Знания алкоголя (или схожие знания), Ремесло, Общество");
assert.equal(secondary[0].kind, "lore");
assert.equal(secondary[0].query, "алкоголя");
assert.equal(secondary[0].allowAnyLore, true);
assert.deepEqual(secondary.slice(1).map((option) => option.slug), ["crafting", "society"]);

const state = {
  secondaryResults: {
    first: { outcome: "failure" },
    second: { outcome: "criticalSuccess" },
  },
};
api.recomputeSecondaryEffects(state);
assert.equal(state.aggregateBonus, 2);
assert.equal(state.aggregatePenalty, -4);
assert.equal(state.aggregateModifier, -2);

state.secondaryResults = {
  first: { outcome: "failure" },
  second: { outcome: "failure" },
};
api.recomputeSecondaryEffects(state);
assert.equal(state.aggregateBonus, 0);
assert.equal(state.aggregatePenalty, -4);
assert.equal(state.aggregateModifier, -4);

state.secondaryResults = {
  first: { outcome: "criticalSuccess" },
  second: { outcome: "criticalSuccess" },
};
api.recomputeSecondaryEffects(state);
assert.equal(state.aggregateBonus, 2);
assert.equal(state.aggregatePenalty, 0);
assert.equal(state.aggregateModifier, 2);

state.secondaryResults = {
  first: { outcome: "criticalFailure" },
  second: { outcome: "criticalFailure" },
};
api.recomputeSecondaryEffects(state);
assert.equal(state.aggregateModifier, -4);

state.secondaryResults.first = { outcome: "success" };
api.recomputeSecondaryEffects(state);
assert.equal(Object.keys(state.secondaryResults).length, 2);
assert.equal(state.aggregateModifier, -4);
assert.deepEqual(api.getRitualDCs(3), { level: 6, secondary: 22, primary: 27 });
assert.deepEqual(api.getRitualDCs(5), { level: 10, secondary: 27, primary: 32 });
game.pf2e.settings.variants.pwol.enabled = true;
assert.deepEqual(api.getRitualDCs(3), { level: 6, secondary: 16, primary: 21 });
game.pf2e.settings.variants.pwol.enabled = false;
assert.equal(api.getMaximumRitualRank({ level: 20 }, 1), 10);
assert.equal(api.getMaximumRitualRank({ level: 7 }, 2), 4);

delete global.__ritualChecksTest;
console.log("ritual-checks tests passed");
