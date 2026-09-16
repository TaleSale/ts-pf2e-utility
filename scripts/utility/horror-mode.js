import { installHorrorChecks, naturalOf } from "./horror-checks.js";
import { MODULE_ID, escapeHtml } from "../core.js";
import { clampDread, nextDread } from "./horror-rules.js";

const SETTING = "enableHorrorMode";
const FLAG = "horrorMode";
const EFFECT = "horrorDread";
const WRITE = "tsuHorrorWrite";
let queue = Promise.resolve();
const pendingMessages = new Set();
const tr = (key, data = {}) => game.i18n.format(`TS_PF2E_UTILITY.Horror.${key}`, data);
const enabled = () => game.settings.get(MODULE_ID, SETTING) === true;
const authority = () => game.user?.isGM && game.users.activeGM?.id === game.user.id;
const now = () => Number(game.time.worldTime);
const storedStateOf = (actor) => actor?.getFlag(MODULE_ID, FLAG) ?? {};
export const dreadValue = (actor) => clampDread(storedStateOf(actor).value);
const stateOf = (actor) => ({ ...storedStateOf(actor), value: dreadValue(actor) });
const dreadOf = (actor) => enabled() ? dreadValue(actor) : 0;
export function horrorPartyMembers() {
  return [...new Map((game.actors.party?.members ?? []).map((actor) => [actor.uuid, actor])).values()];
}
export function horrorDC() { return 1 + horrorPartyMembers().reduce((sum, actor) => sum + dreadValue(actor), 0); }
const managedEffects = (actor) => [...actor.items].filter((item) => item.getFlag(MODULE_ID, EFFECT));
const enqueue = (work) => {
  queue = queue.then(work).catch((error) => { console.error(`${MODULE_ID} | Horror Mode`, error); ui.notifications.error(tr("Error")); });
  return queue;
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "TS_PF2E_UTILITY.Horror.Name", hint: "TS_PF2E_UTILITY.Horror.Hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => enqueue(explorationTick),
  });
  game.settings.register(MODULE_ID, "horrorScareTableId", { scope: "world", config: false, type: String, default: "" });
  game.settings.registerMenu(MODULE_ID, "horrorScareTable", {
    name: "TS_PF2E_UTILITY.Horror.ScareTable", label: "TS_PF2E_UTILITY.Horror.EditScareTable",
    hint: "TS_PF2E_UTILITY.Horror.ScareTableHint", icon: "fas fa-table", restricted: true,
    type: class extends foundry.applications.api.ApplicationV2 {
      render() { void openHorrorScareTable(); return this; }
    },
  });
  game.settings.register(MODULE_ID, "horrorScares", {
    name: "TS_PF2E_UTILITY.Horror.ScareTable", hint: "TS_PF2E_UTILITY.Horror.ScareTableHint",
    scope: "world", config: false, type: String, default: "",
  });
});

let tablePromise;
async function scareTable() {
  const saved = game.tables.get(game.settings.get(MODULE_ID, "horrorScareTableId"))
    ?? game.tables.find((table) => table.getFlag(MODULE_ID, "horrorScareTable"));
  if (saved) return saved;
  if (!game.user.isGM) return null;
  if (tablePromise) return tablePromise;
  tablePromise = (async () => {
    const legacy = String(game.settings.get(MODULE_ID, "horrorScares") ?? "").split(/\r?\n/);
    const table = await RollTable.create({
      name: tr("ScareTable"), formula: "1d20", replacement: true, displayRoll: true,
      description: tr("ScareTableHint"), flags: { [MODULE_ID]: { horrorScareTable: true } },
      ownership: { default: 0 }, results: Array.from({ length: 20 }, (_, index) => ({
        type: "text", name: String(index + 1), description: '<p>' + escapeHtml(legacy[index]?.trim() || tr("Scares." + (index + 1))) + '</p>',
        range: [index + 1, index + 1], weight: 1, drawn: false,
      })),
    });
    await game.settings.set(MODULE_ID, "horrorScareTableId", table.id);
    return table;
  })();
  try { return await tablePromise; } finally { tablePromise = null; }
}
export async function openHorrorScareTable() {
  if (!game.user.isGM) return ui.notifications.warn(tr("GMOnly"));
  return (await scareTable()).sheet.render(true);
}

function relevantScene(scene) {
  return scene.active || [...game.users].some((user) => user.active && user.viewedScene === scene.id)
    || [...game.combats].some((combat) => combat.started && combat.scene?.id === scene.id);
}
function allTokens() { return [...game.scenes].filter(relevantScene).flatMap((scene) => [...scene.tokens]); }
function allCharacters() {
  return [...new Map([...game.actors, ...[...game.scenes].flatMap((s) => [...s.tokens].map((t) => t.actor))].filter((a) => a?.type === "character").map((a) => [a.uuid, a])).values()];
}
function tokensOf(actor) { return allTokens().filter((t) => t.actor?.uuid === actor.uuid); }
const minimumDread = () => enabled() ? 1 : 0;
function actorCombat(actor) {
  return [...game.combats].find((combat) => combat.started && [...combat.combatants].some((c) => c.actor?.uuid === actor.uuid));
}
function combatClock(actor) {
  const combat = actorCombat(actor);
  return { time: now(), combatId: combat?.id ?? null, round: combat?.round ?? null };
}

async function setDreadEffect(actor, value) {
  const items = managedEffects(actor).filter((item) => item.type === "effect");
  if (!value) {
    if (items.length) await actor.deleteEmbeddedDocuments("Item", items.map((item) => item.id), { [WRITE]: true });
    return;
  }
  const name = tr("Dread", { value });
  const system = {
    slug: "horror-dread", description: { value: tr("EffectDescription") },
    duration: { value: -1, unit: "unlimited", expiry: null },
    // PF2e clamps badges before preUpdateItem; let our hook detect overflow and enforce the enabled-mode minimum.
    tokenIcon: { show: true }, badge: { type: "counter", value, min: 0, max: null }, rules: [],
  };
  if (!items.length) {
    await actor.createEmbeddedDocuments("Item", [{ name, type: "effect", img: "icons/magic/death/skull-humanoid-white-blue.webp",
      system, flags: { [MODULE_ID]: { [EFFECT]: true } },
    }], { [WRITE]: true });
  } else {
    const item = items[0];
    if (item.name !== name || item.system.badge?.value !== value || item.system.rules?.length
        || item.system.badge?.min !== 0 || item.system.badge?.max != null
        || item.system.slug !== system.slug || item.system.description?.value !== system.description.value) {
      await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, name, system }], { [WRITE]: true });
    }
    if (items.length > 1) await actor.deleteEmbeddedDocuments("Item", items.slice(1).map((item) => item.id), { [WRITE]: true });
  }
}
async function migrateDread(actor) {
  const old = storedStateOf(actor);
  if (old.counterVersion === 2) return old;
  const conditions = managedEffects(actor).filter((item) => item.type === "condition" && item.slug === "frightened");
  const state = { ...old, value: conditions.length ? clampDread(Math.max(...conditions.map((item) => item.value))) : clampDread(old.value), counterVersion: 2 };
  // Only release conditions owned by the preceding Horror implementation.
  // Ordinary Frightened is independent and must never be captured or reduced.
  const borrowed = conditions.filter((item) => item.getFlag(MODULE_ID, "horrorOriginalFrightened") > 0);
  if (borrowed.length) await actor.updateEmbeddedDocuments("Item", borrowed.map((item) => ({
    _id: item.id, "system.value.value": Math.min(item.value, item.getFlag(MODULE_ID, "horrorOriginalFrightened")),
    ["flags." + MODULE_ID + ".-=" + EFFECT]: null, ["flags." + MODULE_ID + ".-=horrorOriginalFrightened"]: null,
  })), { [WRITE]: true });
  const remove = conditions.filter((item) => !borrowed.includes(item));
  if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove.map((item) => item.id), { [WRITE]: true });
  await actor.setFlag(MODULE_ID, FLAG, state);
  return state;
}
async function writeState(actor, state) {
  const next = { ...state, value: Math.max(minimumDread(), clampDread(state.value)), counterVersion: 2 };
  if (JSON.stringify(storedStateOf(actor)) !== JSON.stringify(next)) await actor.setFlag(MODULE_ID, FLAG, next);
  await setDreadEffect(actor, enabled() ? next.value : 0);
}
async function gmMessage(content, extra = {}) {
  return ChatMessage.create({ content, whisper: game.users.filter((u) => u.isGM).map((u) => u.id), ...extra });
}
async function changeDread(actor, delta, limited = false) {
  if (!authority() || !enabled() || actor?.type !== "character") return;
  const result = nextDread(stateOf(actor), delta, { ...combatClock(actor), limited });
  if (!result.changed) return;
  await writeState(actor, result.state);
  if (result.nightmare) await gmMessage(`<h3>${escapeHtml(tr("Nightmare"))}</h3><p>${escapeHtml(tr("NightmareDescription", { name: actor.name }))}</p>`);
}
async function synchronize() {
  if (!authority()) return;
  for (const actor of allCharacters()) {
    const old = await migrateDread(actor);
    const state = { ...old };
    delete state.tracked;
    delete state.leftAt;
    await writeState(actor, state);
  }
}

function visibleAlly(observer, source) {
  if (!observer?.object || !source?.object || observer.parent !== source.parent || observer.level !== source.level) return false;
  if (!observer.actor?.isAllyOf?.(source.actor) || observer.actor.canSee === false || source.hidden) return false;
  if (source.actor.hasCondition?.("undetected") || !observer.sight?.enabled) return false;
  // GM-wide visibility is not the observer's sight. Uncontrolled GM tokens may
  // have no source, so initialize an unregistered source and destroy it afterwards.
  let vision = observer.object.vision;
  const temporary = !vision;
  try {
    if (temporary) {
      vision = new CONFIG.Canvas.visionSourceClass({ sourceId: observer.uuid + ".horror", object: observer.object });
      Object.assign(vision.blinded, observer.object._getVisionBlindedStates());
      vision.initialize(observer.object._getVisionSourceData());
    }
    const config = canvas.visibility._createVisibilityTestConfig([source.object.center], { object: source.object });
    return Object.entries(observer.detectionModes ?? {}).some(([id, mode]) => {
      const detection = CONFIG.Canvas.detectionModes[id];
      return detection && detection.type === detection.constructor.DETECTION_TYPES.SIGHT
        && detection.testVisibility(vision, mode, config);
    });
  } finally { if (temporary) vision?.destroy(); }
}
function messageToken(message) {
  const context = message.flags.pf2e?.context;
  const reference = context?.origin?.actor === message.actor?.uuid ? context.origin?.token : context?.target?.token;
  return (reference ? fromUuidSync(reference) : null) ?? game.scenes.get(message.speaker?.scene)?.tokens.get(message.speaker?.token) ?? null;
}
async function processMessage(message) {
  if (!authority() || !enabled() || message.getFlag(MODULE_ID, "horrorProcessed")) return;
  const context = message.flags.pf2e?.context;
  const roll = message.rolls?.[0];
  if (!context || naturalOf(roll) == null) return;
  const affected = new Map();
  const actor = message.actor;
  if (context.outcome === "criticalFailure") {
    if (actor?.type === "character" && dreadOf(actor)) affected.set(actor.uuid, actor);
    const source = messageToken(message);
    if (source) for (const token of source.parent.tokens) {
      if (token.actor?.type === "character" && dreadOf(token.actor) && visibleAlly(token, source)) affected.set(token.actor.uuid, token.actor);
    }
  }
  if (context.type === "attack-roll" && context.outcome === "criticalSuccess") {
    const target = context.target?.actor ? await fromUuid(context.target.actor) : null;
    if (target?.type === "character" && dreadOf(target) && actor?.isEnemyOf?.(target)) affected.set(target.uuid, target);
  }
  await message.setFlag(MODULE_ID, "horrorProcessed", true);
  for (const target of affected.values()) await changeDread(target, 1, true);
}
Hooks.on("createChatMessage", (message) => {
  if (!authority() || !enabled() || pendingMessages.has(message.id)) return;
  pendingMessages.add(message.id);
  enqueue(async () => { try { await processMessage(message); } finally { pendingMessages.delete(message.id); } });
});

function affectedParty() {
  return horrorPartyMembers().filter((actor) => dreadOf(actor));
}
export async function rollScare(scene = canvas.scene) {
  if (!authority() || !enabled()) return;
  if (!game.actors.party) return ui.notifications.warn(tr("PartyRequired"));
  const party = affectedParty();
  if (!party.length) return;
  const dc = horrorDC();
  const roll = await new Roll("1d20").evaluate();
  const failed = roll.total < dc; // A flat check: no natural-20 override, even for DC > 20.
  await roll.toMessage({ flavor: `<h3>${escapeHtml(tr("ScareCheck", { dc }))}</h3><p>${escapeHtml(tr(failed ? "ScareFailed" : "ScarePassed"))}</p>`,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id) });
  if (!failed) return;
  const table = await scareTable();
  await table.draw({ roll: new Roll("1d20"), recursive: false, displayChat: true, messageMode: "gm" });
}
async function explorationTick() {
  await synchronize();
  if (!authority()) return;
  const party = game.actors.party;
  if (!party) return;
  const members = new Set(horrorPartyMembers().map((actor) => actor.uuid));
  const activeCombat = [...game.combats].some((combat) => combat.started && [...combat.combatants].some((c) => members.has(c.actor?.uuid)));
  const previous = party.getFlag(MODULE_ID, "horrorExplorationAt");
  if (!enabled() || activeCombat || !affectedParty().length) {
    if (previous != null) await party.unsetFlag(MODULE_ID, "horrorExplorationAt");
    return;
  }
  if (!Number.isFinite(previous) || now() < previous) { await party.setFlag(MODULE_ID, "horrorExplorationAt", now()); return; }
  const ticks = Math.floor((now() - previous) / 600);
  if (!ticks) return;
  await party.setFlag(MODULE_ID, "horrorExplorationAt", previous + ticks * 600);
  for (let i = 0; i < ticks && enabled(); i++) await rollScare();
}
Hooks.on("updateActor", (actor) => { if (actor.type === "party") enqueue(explorationTick); });
Hooks.on("deleteCombat", () => enqueue(explorationTick));
Hooks.on("updateWorldTime", () => enqueue(explorationTick));
Hooks.on("updateCombat", (combat, change) => {
  if (!authority() || !enabled() || !("round" in change) || combat.round < 2) return;
  if (![...combat.combatants].some((c) => horrorPartyMembers().some((actor) => actor.uuid === c.actor?.uuid))) return;
  enqueue(async () => {
    const last = Number(combat.getFlag(MODULE_ID, "horrorScareRound") ?? 1);
    if (combat.round <= last) return;
    await combat.setFlag(MODULE_ID, "horrorScareRound", combat.round);
    await rollScare(combat.scene);
  });
});
for (const hook of ["createActor", "createToken", "deleteToken", "canvasReady", "updateUser"]) Hooks.on(hook, () => enqueue(explorationTick));
Hooks.on("updateToken", (_token, change) => {
  if (["actorId", "actorLink"].some((key) => key in change)) enqueue(explorationTick);
});
function horrorCounter(item) { return enabled() && item.parent?.type === "character" && item.type === "effect" && item.getFlag(MODULE_ID, EFFECT); }
Hooks.on("preUpdateItem", (item, change, options) => {
  if (options[WRITE] || !horrorCounter(item)) return;
  const value = change["system.badge.value"] ?? foundry.utils.getProperty(change, "system.badge.value");
  if (value == null) return;
  if (Number(value) > 5) options.tsuHorrorOverflow = true;
  const next = Math.max(minimumDread(item.parent), clampDread(value));
  if ("system.badge.value" in change) change["system.badge.value"] = next;
  else foundry.utils.setProperty(change, "system.badge.value", next);
});
Hooks.on("preCreateItem", (item, _data, options) => {
  if (options[WRITE] || !horrorCounter(item)) return;
  if (Number(item.system.badge.value) > 5) options.tsuHorrorOverflow = true;
  item.updateSource({ "system.badge.value": Math.max(minimumDread(item.parent), clampDread(item.system.badge.value)) });
});
Hooks.on("preDeleteItem", (item, options) => {
  if (!options[WRITE] && horrorCounter(item) && minimumDread(item.parent) > 0) return false;
});
for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item, ...args) => {
  const options = hook === "updateItem" ? args[1] : args[0];
  if (options?.[WRITE] || !authority() || !horrorCounter(item)) return;
  enqueue(async () => {
    if (options?.tsuHorrorOverflow) await gmMessage('<h3>' + escapeHtml(tr("Nightmare")) + '</h3><p>' + escapeHtml(tr("NightmareDescription", { name: item.parent.name })) + '</p>');
    await writeState(item.parent, { ...stateOf(item.parent), value: hook === "deleteItem" ? minimumDread(item.parent) : Math.max(minimumDread(item.parent), clampDread(item.system.badge.value)) });
  });
});
Hooks.once("ready", () => {
  installHorrorChecks({ enabled, dreadOf, label: () => tr("Name") });
  enqueue(explorationTick);
  game.socket.on(`module.${MODULE_ID}`, (request) => {
    if (request?.action !== "horror-action" || !authority()) return;
    enqueue(() => performAction(request));
  });
});

async function performAction({ actorUuid, targetUuid, kind, userId }) {
  if (!authority() || !enabled()) return;
  const actor = await fromUuid(actorUuid);
  const target = await fromUuid(targetUuid ?? actorUuid);
  const user = game.users.get(userId);
  if (!user || actor?.type !== "character" || target?.type !== "character" || !actor.testUserPermission(user, "OWNER")) return;
  if (kind === "increase" || kind === "decrease") { if (user.isGM) await changeDread(target, kind === "increase" ? 1 : -1); return; }
  if (kind === "flee") {
    const combat = actorCombat(actor);
    if (!combat || actor.uuid !== target.uuid) return;
    const key = `${combat.id}:${combat.round}`;
    if (stateOf(actor).lastFlee === key) return;
    await writeState(actor, { ...stateOf(actor), lastFlee: key });
    await changeDread(actor, -2);
    await ChatMessage.create({ content: `<p>${escapeHtml(tr("Fled", { name: actor.name }))}</p>` });
    return;
  }
  if (!["prevent", "suppress"].includes(kind)) return;
  if (target.uuid !== actor.uuid && (!actor.isAllyOf(target) || !tokensOf(actor).some((a) => tokensOf(target).some((b) => a.parent === b.parent)))) return;
  const combat = actorCombat(actor);
  if ((kind === "prevent" && !combat) || (kind === "suppress" && combat)) return;
  if (kind === "suppress" && target.uuid !== actor.uuid) return;
  const actionKey = combat ? `${combat.id}:${combat.round}` : now();
  const state = stateOf(actor);
  if (kind === "suppress" && Number.isFinite(state.lastSuppress) && now() - state.lastSuppress < 600) {
    ui.notifications.warn(tr("TenMinutes")); return;
  }
  if (!game.actors.party) return ui.notifications.warn(tr("PartyRequired"));
  const dc = horrorDC();
  const roll = await actor.saves.will.check.roll({ dc: { value: dc }, skipDialog: false, title: tr(kind === "prevent" ? "Prevent" : "Suppress") });
  if (!roll || !enabled()) return;
  await writeState(actor, { ...stateOf(actor), [kind === "prevent" ? "lastPrevent" : "lastSuppress"]: actionKey });
  const delta = [0, 0, -1, -2][roll.degreeOfSuccess] ?? 0;
  if (delta) await changeDread(target, delta);
  if (kind === "suppress") await game.time.advance(600);
}

export async function toggleHorrorMode() {
  if (!game.user.isGM) return ui.notifications.warn(tr("GMOnly"));
  const value = !enabled();
  await game.settings.set(MODULE_ID, SETTING, value);
  await queue;
  ui.notifications.info(tr(value ? "Enabled" : "Disabled"));
}

export async function openHorrorPanel() {
  if (!game.actors.party) return ui.notifications.warn(tr("PartyRequired"));
  if (!enabled()) return ui.notifications.warn(tr("Disabled"));
  const actors = horrorPartyMembers().filter((actor) => actor.type === "character");
  const own = actors.filter((a) => a.isOwner);
  if (!own.length) return ui.notifications.warn(tr("SelectCharacter"));
  const options = (list) => list.map((a) => `<option value="${escapeHtml(a.uuid)}">${escapeHtml(a.name)} — ${dreadOf(a)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["tsu-horror-panel"],
    position: { width: 640 },
    window: { title: tr("Name") }, content: `<p>${escapeHtml(tr("PartyDC", { dc: horrorDC() }))}</p><p>${escapeHtml(tr("ActionRules"))}</p>
      <label>${escapeHtml(tr("Actor"))}<select name="actor">${options(own)}</select></label>
      <label>${escapeHtml(tr("Target"))}<select name="target">${options(actors)}</select></label>
      <p>${escapeHtml(tr("FleeHint"))}</p>`,
    buttons: ["prevent", "suppress", "flee", ...(game.user.isGM ? ["increase", "decrease", "scare", "table"] : [])].map((kind) => ({
      action: kind, label: tr({ prevent: "Prevent", suppress: "Suppress", flee: "Flee", increase: "Increase", decrease: "Decrease", scare: "Scare", table: "EditScareTable" }[kind]),
      callback: (_event, button) => ({ kind, actorUuid: button.form.elements.actor.value, targetUuid: button.form.elements.target.value, userId: game.user.id }),
    })), rejectClose: false,
  });
  if (!result) return;
  if (result.kind === "scare") return rollScare();
  if (result.kind === "table") return openHorrorScareTable();
  if (!game.users.activeGM) return ui.notifications.warn(tr("GMRequired"));
  if (authority()) return enqueue(() => performAction(result));
  game.socket.emit(`module.${MODULE_ID}`, { action: "horror-action", ...result });
}
