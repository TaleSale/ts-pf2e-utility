import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE = "coInitiative";
const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.CoInitiative.${key}`);
const entries = (actor) => (actor?.items?.contents ?? []).flatMap((item) =>
  ["action", "feat"].includes(item.type) && isActionPlusFeatureEnabled(item, FEATURE)
    ? item.getFlag(MODULE_ID, FEATURE)?.members ?? [] : []);

function resolve(uuid) {
  try { return fromUuidSync(uuid); } catch { return null; }
}

function matchingTokens(scene, reference) {
  const document = resolve(reference.uuid);
  if (document?.documentName === "Token") return document.parent === scene ? [document] : [];
  if (document?.documentName !== "Actor") return [];
  const tokens = (scene?.tokens?.contents ?? []).filter((token) => token.actor === document
    || token.actor?.uuid === document.uuid || (document.id && token.actorId === document.id));
  // An actor reference must never silently bind a different copy of an NPC.
  return tokens.length === 1 ? tokens : [];
}

export function coInitiativeParents(combat) {
  const combatants = combat.combatants.contents;
  const parents = new Map();
  for (const parent of combatants) {
    for (const reference of entries(parent.actor)) {
      const tokens = matchingTokens(combat.scene ?? parent.token?.parent, reference);
      for (const child of combatants) {
        if (child !== parent && child.actor?.uuid !== parent.actor?.uuid && tokens.includes(child.token) && !parents.has(child.id)) parents.set(child.id, parent.id);
      }
    }
  }
  // Flatten chains; cyclic configurations keep their independent turns.
  const flattened = new Map();
  for (const [child, parent] of parents) {
    const visited = new Set([child]);
    let root = parent;
    while (parents.has(root) && !visited.has(root)) { visited.add(root); root = parents.get(root); }
    if (!visited.has(root)) flattened.set(child, root);
  }
  return flattened;
}

function children(combat, parent) {
  const parents = coInitiativeParents(combat);
  return combat.combatants.contents.filter((child) => parents.get(child.id) === parent.id);
}

async function saveMember(item, uuid) {
  const document = resolve(uuid.trim());
  const actor = document?.documentName === "Token" ? document.actor : document;
  if (actor?.documentName !== "Actor" || actor === item.actor || !["character", "npc", "familiar"].includes(actor.type)) {
    return ui.notifications.warn(localize("Invalid"));
  }
  const members = item.getFlag(MODULE_ID, FEATURE)?.members ?? [];
  if (!members.some((entry) => entry.uuid === document.uuid)) {
    await item.setFlag(MODULE_ID, FEATURE, { members: [...members, { uuid: document.uuid, name: document.name }] });
  }
}

registerActionPlusFeature({
  id: FEATURE,
  label: `${I18N_PREFIX}.ActionPlus.CoInitiative.FeatureLabel`,
  itemTypes: ["action", "feat"],
  render: ({ item }) => `<p>${localize("Hint")}</p><div class="ts-co-drop">
    ${(item.getFlag(MODULE_ID, FEATURE)?.members ?? []).map((entry, index) => `<div>${escapeHtml(entry.name || entry.uuid)} <button type="button" data-co-remove="${index}">${localize("Remove")}</button></div>`).join("")}
    <input type="text" class="ts-co-uuid" placeholder="${localize("Placeholder")}"><button type="button" class="ts-co-add">${localize("Add")}</button></div>`,
  activateListeners: ({ html, item, optionIndex }) => {
    const panel = html.querySelector(`[data-feature-id="${FEATURE}"][data-option-index="${optionIndex}"]`);
    if (!panel) return;
    panel.querySelector(".ts-co-add")?.addEventListener("click", () => saveMember(item, panel.querySelector(".ts-co-uuid").value));
    panel.addEventListener("dragover", (event) => event.preventDefault());
    panel.addEventListener("drop", async (event) => {
      event.preventDefault(); event.stopPropagation();
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.uuid) await saveMember(item, data.uuid);
    });
    for (const button of panel.querySelectorAll("[data-co-remove]")) button.addEventListener("click", async () => {
      const members = [...(item.getFlag(MODULE_ID, FEATURE)?.members ?? [])];
      members.splice(Number(button.dataset.coRemove), 1);
      await item.setFlag(MODULE_ID, FEATURE, { members });
    });
  },
  cleanup: ({ item }) => item.unsetFlag(MODULE_ID, FEATURE),
});

export function installCombatWrappers() {
  const prototype = CONFIG.Combat.documentClass.prototype;
  if (prototype.__tsCoInitiative) return;
  prototype.__tsCoInitiative = true;
  const setup = prototype.setupTurns;
  prototype.setupTurns = function (...args) {
    const activeId = this.combatant?.id;
    const turns = setup.apply(this, args);
    const parents = coInitiativeParents(this);
    this.turns = turns.filter((combatant) => !parents.has(combatant.id));
    const index = this.turns.findIndex((combatant) => combatant.id === (parents.get(activeId) ?? activeId));
    if (index >= 0 && this.turn !== null) this.turn = index;
    return this.turns;
  };
  for (const [method, event] of [["_onStartTurn", "start"], ["_onEndTurn", "end"]]) {
    const original = prototype[method];
    prototype[method] = async function (parent, options = {}) {
      const result = await original.call(this, parent, options);
      if (!parent || !this.started || options.skipped) return result;
      const round = options.round ?? this.round;
      const processedActors = new Set([parent.actor?.uuid]);
      for (const child of children(this, parent)) {
        if (processedActors.has(child.actor?.uuid)) continue;
        processedActors.add(child.actor?.uuid);
        const flag = event === "start" ? "roundOfLastTurn" : "roundOfLastTurnEnd";
        if (child.flags.pf2e?.[flag] === round) continue;
        const familiarHandled = parent.actor?.type === "character" && parent.actor.familiar === child.actor;
        if (!familiarHandled) {
          if (event === "start") await child.onStartTurn();
          else await child.onEndTurn({ round });
        } else {
          // PF2e already runs the familiar's effects and end-turn conditions on its master.
          if (event === "start") {
            const actorUpdates = {};
            for (const rule of child.actor.rules ?? []) await rule.onUpdateEncounter?.({ event: "turn-start", actorUpdates });
            await child.actor.update(actorUpdates);
            await child.actor.recharge({ duration: "round" });
          }
          await child.update({ [`flags.pf2e.${flag}`]: round }, { render: false });
          Hooks.callAll(`pf2e.${event}Turn`, child, this, game.user.id);
        }
      }
      return result;
    };
  }
}

let syncQueue = Promise.resolve();
let hudTracker = null;
function scheduleSync() {
  syncQueue = syncQueue.then(syncCombats).catch((error) => console.error(`${MODULE_ID} | Co-initiative`, error));
  return syncQueue;
}

async function syncCombats() {
  for (const combat of game.combats?.contents ?? []) {
    const activeId = combat.combatant?.id;
    if (game.users.activeGM?.id === game.user.id) {
      const pending = new Map();
      for (const parent of combat.combatants.contents) {
        for (const reference of entries(parent.actor)) {
          for (const token of matchingTokens(combat.scene ?? parent.token?.parent, reference)) {
            if (!combat.combatants.some((entry) => entry.tokenId === token.id && entry.sceneId === token.parent.id)) {
              pending.set(token.uuid, { tokenId: token.id, actorId: token.actorId, sceneId: token.parent.id, hidden: token.hidden });
            }
          }
        }
      }
      // EncounterPF2e#createEmbeddedDocuments rejects minions and eidolons.
      // These explicitly linked creatures need real Combatants for turn events,
      // but setupTurns above excludes them from independent turn navigation.
      // Use the document API, retaining permissions, validation and create hooks.
      if (pending.size) await CONFIG.Combatant.documentClass.createDocuments([...pending.values()], { parent: combat });
      const parents = coInitiativeParents(combat);
      const updates = combat.combatants.contents.flatMap((child) => {
        const parent = combat.combatants.get(parents.get(child.id));
        return parent && child.initiative !== parent.initiative ? [{ _id: child.id, initiative: parent.initiative }] : [];
      });
      if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
      combat.setupTurns();
      const nextId = parents.get(activeId) ?? activeId;
      const index = combat.turns.findIndex((entry) => entry.id === nextId);
      if (combat.started && index >= 0 && (combat._source?.turn ?? combat.turn) !== index) await combat.update({ turn: index });
    } else combat.setupTurns();
    ui.combat?.render();
  }
  hudTracker?.render?.();
}

export function renderCoInitiative(app, html) {
  const root = html?.[0] ?? html ?? app.element;
  if (root?.id !== "pf2e-hud-tracker") return;
  hudTracker = app;
  const combat = app.viewed;
  if (!combat) return;
  root.querySelectorAll(".ts-co-initiative").forEach((row) => row.remove());
  for (const row of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    const parent = combat.combatants.get(row.dataset.combatantId);
    if (!parent) continue;
    let anchor = row;
    for (const child of children(combat, parent)) {
      if (!child.visible || (!game.user.isGM && parent.hidden)) continue;
      const element = document.createElement("li");
      element.className = "ts-co-initiative";
      element.classList.toggle("active", row.classList.contains("active"));
      element.classList.toggle("defeated", child.isDefeated);
      element.style.height = `${Math.max(24, (row.getBoundingClientRect().height || 64) / 2)}px`;
      if (root.classList.contains("collapsed") && !row.classList.contains("active") && !row.classList.contains("next")) element.hidden = true;
      const branch = document.createElement("span"); branch.textContent = "└";
      const image = document.createElement("img"); image.src = child.token?.texture?.src || child.actor?.img || "icons/svg/mystery-man.svg";
      const name = document.createElement("span");
      name.textContent = game.user.isGM || !game.pf2e.settings.tokens.nameVisibility || child.playersCanSeeName
        ? child.name : game.i18n.localize("COMBAT.UnknownCombatant");
      element.append(branch, image, name);
      element.addEventListener("dblclick", () => { if (child.actor?.isOwner) child.actor.sheet.render(true); });
      anchor.after(element); anchor = element;
    }
  }
}

Hooks.once("init", installCombatWrappers);
Hooks.once("ready", scheduleSync);
for (const hook of ["createCombatant", "deleteCombatant", "updateCombatant", "createToken", "deleteToken"]) Hooks.on(hook, scheduleSync);
for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item) => {
  if (item.actor && ["action", "feat"].includes(item.type)) scheduleSync();
});
Hooks.on("renderApplicationV2", renderCoInitiative);
