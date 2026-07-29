import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "shoulderToShoulder";
const FLAG_KEY = "shoulderToShoulder";
const AUTOMATION_LOCK_FLAG = "shoulderToShoulderAutomationLocked";
const MIN_ALLIES = 1;
const MAX_ALLIES = 20;

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.ShoulderToShoulder.${key}`);
}

function normalizeRequiredAllies(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.clamp(Math.trunc(number), MIN_ALLIES, MAX_ALLIES)
    : MIN_ALLIES;
}

function normalizeConfiguration(value) {
  const legacyRequiredAllies = normalizeRequiredAllies(value?.requiredAllies ?? value);
  const useReach = value?.useReach === true;
  const nearTarget = useReach || value?.nearTarget === true;
  return {
    nearSelf: nearTarget ? false : value?.nearSelf !== false,
    selfRequiredAllies: normalizeRequiredAllies(value?.selfRequiredAllies ?? legacyRequiredAllies),
    nearTarget,
    targetRequiredAllies: normalizeRequiredAllies(value?.targetRequiredAllies ?? legacyRequiredAllies),
    useReach,
  };
}

function getConfiguration(item) {
  return normalizeConfiguration(item?.getFlag?.(MODULE_ID, FLAG_KEY));
}

function isAutomationLocked(item) {
  return item?.getFlag?.(MODULE_ID, AUTOMATION_LOCK_FLAG) === true;
}

function hasToggleableRollOption(item) {
  const rules = item?._source?.system?.rules ?? item?.system?.rules ?? [];
  return rules.some((rule) => rule?.key === "RollOption" && rule.toggleable === true);
}

function getConfiguredItems(actor) {
  return (actor?.itemTypes?.action ?? []).filter((item) => (
    isActionPlusFeatureEnabled(item, FEATURE_ID) && hasToggleableRollOption(item)
  ));
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function injectAutomationLock(toggle, item) {
  if (!(toggle instanceof HTMLElement)) return;
  toggle.classList.add("ts-automation-toggle-row");
  let button = toggle.querySelector(":scope > .ts-shoulder-to-shoulder-lock");
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "ts-automation-lock ts-shoulder-to-shoulder-lock";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        const wasLocked = isAutomationLocked(item);
        await item.setFlag(MODULE_ID, AUTOMATION_LOCK_FLAG, !wasLocked);
        updateAutomationLockButton(button, item);
        if (wasLocked) void syncActorRuleValues(item.actor);
      } finally {
        button.disabled = false;
      }
    });
    toggle.append(button);
  }

  updateAutomationLockButton(button, item);
}

function updateAutomationLockButton(button, item) {
  const locked = isAutomationLocked(item);
  button.dataset.tooltip = localize(locked ? "AutomationLocked" : "AutomationEnabled");
  const iconClass = locked ? "fa-lock" : "fa-lock-open";
  const icon = button.querySelector("i");
  if (icon?.classList.contains(iconClass)) return;
  button.innerHTML = `<i class="fas fa-fw ${iconClass}"></i>`;
}

function injectActorSheetLocks(app, html) {
  const actor = app?.document ?? app?.actor ?? app?.object ?? null;
  const root = getHtmlElement(html);
  if (!actor?.isOwner || !root) return;

  const scan = () => {
    if (!root.isConnected) return;
    for (const item of getConfiguredItems(actor)) {
      const escapedId = CSS.escape(item.id);
      for (const toggle of root.querySelectorAll(`ul[data-option-toggles] [data-item-id="${escapedId}"]`)) injectAutomationLock(toggle, item);
    }
  };
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
}

function getConfiguredSceneActors() {
  if (!canvas?.ready) return [];
  return Array.from(new Set(
    (canvas.tokens?.placeables ?? [])
      .map((token) => token.actor)
      .filter((actor) => actor && getConfiguredItems(actor).length > 0),
  ));
}

function renderControls({ item }) {
  const configuration = getConfiguration(item);
  return `
    <div class="form-group" style="margin: 0;">
      <label>${foundry.utils.escapeHTML(localize("NearSelf"))}</label>
      <div class="form-fields">
        <input type="checkbox" class="ts-shoulder-to-shoulder-near-self" ${configuration.nearSelf ? "checked" : ""}>
        <input
          type="number"
          class="ts-shoulder-to-shoulder-self-allies"
          min="${MIN_ALLIES}"
          max="${MAX_ALLIES}"
          step="1"
          value="${configuration.selfRequiredAllies}"
        >
      </div>
    </div>
    <div class="form-group" style="margin: 0;">
      <label>${foundry.utils.escapeHTML(localize("NearTarget"))}</label>
      <div class="form-fields">
        <input type="checkbox" class="ts-shoulder-to-shoulder-near-target" ${configuration.nearTarget ? "checked" : ""}>
        <input type="number" class="ts-shoulder-to-shoulder-target-allies" min="${MIN_ALLIES}" max="${MAX_ALLIES}" step="1" value="${configuration.targetRequiredAllies}">
      </div>
    </div>
    <div class="form-group" style="margin: 0;">
      <label>${foundry.utils.escapeHTML(localize("Reach"))}</label>
      <div class="form-fields">
        <input type="checkbox" class="ts-shoulder-to-shoulder-use-reach" ${configuration.useReach ? "checked" : ""}>
      </div>
      <p class="hint">${foundry.utils.escapeHTML(localize("Hint"))}</p>
    </div>
  `;
}

function activateListeners({ html, item, optionIndex }) {
  const panel = html.querySelector(
    `.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`,
  );
  if (!panel) return;
  const save = async (event) => {
    const nearSelfInput = panel.querySelector(".ts-shoulder-to-shoulder-near-self");
    const nearTargetInput = panel.querySelector(".ts-shoulder-to-shoulder-near-target");
    const useReachInput = panel.querySelector(".ts-shoulder-to-shoulder-use-reach");
    if (event.currentTarget.checked) {
      if (event.currentTarget.matches(".ts-shoulder-to-shoulder-near-self") && nearTargetInput) {
        nearTargetInput.checked = false;
        if (useReachInput) useReachInput.checked = false;
      }
      if (event.currentTarget.matches(".ts-shoulder-to-shoulder-near-target") && nearSelfInput) {
        nearSelfInput.checked = false;
      }
    }
    if (event.currentTarget.matches(".ts-shoulder-to-shoulder-use-reach") && event.currentTarget.checked) {
      if (nearSelfInput) nearSelfInput.checked = false;
      if (nearTargetInput) nearTargetInput.checked = true;
    }
    const configuration = normalizeConfiguration({
      nearSelf: panel.querySelector(".ts-shoulder-to-shoulder-near-self")?.checked,
      selfRequiredAllies: panel.querySelector(".ts-shoulder-to-shoulder-self-allies")?.value,
      nearTarget: panel.querySelector(".ts-shoulder-to-shoulder-near-target")?.checked,
      targetRequiredAllies: panel.querySelector(".ts-shoulder-to-shoulder-target-allies")?.value,
      useReach: panel.querySelector(".ts-shoulder-to-shoulder-use-reach")?.checked,
    });
    if (nearSelfInput) nearSelfInput.checked = configuration.nearSelf;
    if (nearTargetInput) nearTargetInput.checked = configuration.nearTarget;
    if (useReachInput) useReachInput.checked = configuration.useReach;
    const targetAlliesInput = panel.querySelector(".ts-shoulder-to-shoulder-target-allies");
    if (targetAlliesInput) {
      targetAlliesInput.min = String(MIN_ALLIES);
      targetAlliesInput.value = String(configuration.targetRequiredAllies);
    }
    await item.setFlag(MODULE_ID, FLAG_KEY, configuration);
  };
  for (const input of panel.querySelectorAll("input")) input.addEventListener("change", save);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.ShoulderToShoulder.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup: async ({ item }) => item.unsetFlag(MODULE_ID, FLAG_KEY),
});

function activeTokensFor(actor) {
  if (!canvas?.ready) return [];
  return canvas.tokens?.placeables?.filter((token) => token.actor === actor) ?? [];
}

function isWithinReach(token, other, reach) {
  if (!token?.actor || !other?.actor || token === other) return false;

  const gridSize = Number(canvas.scene?.grid?.size);
  const tokenDocument = token.document;
  const otherDocument = other.document;
  if (Number.isFinite(gridSize) && gridSize > 0 && tokenDocument && otherDocument) {
    const leftA = Number(tokenDocument.x) || 0;
    const topA = Number(tokenDocument.y) || 0;
    const rightA = leftA + (Number(tokenDocument.width) || 1) * gridSize;
    const bottomA = topA + (Number(tokenDocument.height) || 1) * gridSize;
    const leftB = Number(otherDocument.x) || 0;
    const topB = Number(otherDocument.y) || 0;
    const rightB = leftB + (Number(otherDocument.width) || 1) * gridSize;
    const bottomB = topB + (Number(otherDocument.height) || 1) * gridSize;
    const horizontalGap = Math.max(0, leftB - rightA, leftA - rightB);
    const verticalGap = Math.max(0, topB - bottomA, topA - bottomB);
    const gridDistance = Number(canvas.scene?.grid?.distance) || 5;
    const elevationGap = Math.abs((Number(tokenDocument.elevation) || 0) - (Number(otherDocument.elevation) || 0));

    // Less than one empty grid space between occupied token rectangles means
    // their nearest occupied squares are adjacent (including diagonally).
    // Measure between the nearest occupied grid spaces. Touching token
    // rectangles are one grid increment apart; every full gap adds another.
    const planarDistance = (Math.floor(Math.max(horizontalGap, verticalGap) / gridSize) + 1) * gridDistance;
    return Math.max(planarDistance, elevationGap) <= reach;
  }

  const distance = token.distanceTo?.(other);
  return Number.isFinite(distance) && distance <= reach;
}

function countAlliesWithinReach(origin, alliance, reach, excludedTokens = new Set([origin])) {
  return (canvas.tokens?.placeables ?? []).filter((other) => (
    !excludedTokens.has(other) && other?.actor?.alliance === alliance && isWithinReach(origin, other, reach)
  )).length;
}

function countGangUpAllies(target, alliance, excludedTokens) {
  return (canvas.tokens?.placeables ?? []).filter((ally) => (
    !excludedTokens.has(ally)
    && ally?.actor?.alliance === alliance
    && ally.canFlank?.(target) === true
  )).length;
}

function hasEnoughNearbyAllies(actor, configuration) {
  const actorTokens = activeTokensFor(actor);
  if (!actorTokens.length) return false;
  const alliance = actor.alliance;
  if (alliance == null) return false;
  const adjacentReach = Number(canvas.scene?.grid?.distance) || 5;
  if (configuration.nearSelf && actorTokens.some((token) => (
    countAlliesWithinReach(token, alliance, adjacentReach) >= configuration.selfRequiredAllies
  ))) return true;
  if (!configuration.nearTarget) return false;
  const actorTokenSet = new Set(actorTokens);
  return Array.from(game.user?.targets ?? []).some((target) => (
    target?.actor
    && (configuration.useReach
      ? countGangUpAllies(target, alliance, actorTokenSet)
      : countAlliesWithinReach(target, alliance, adjacentReach, actorTokenSet)) >= configuration.targetRequiredAllies
  ));
}

// Synthetic actors belonging to unlinked copies of the same NPC can expose
// the same id/uuid. Key synchronization by the actual actor instance.
const syncingActors = new WeakMap();

async function syncActorRuleValues(actor) {
  if (!actor) return;
  const existing = syncingActors.get(actor);
  if (existing) return existing;

  const synchronization = (async () => {
  try {
    for (const item of getConfiguredItems(actor)) {
      if (!item.isOwner) continue;
      if (isAutomationLocked(item)) continue;
      const active = hasEnoughNearbyAllies(actor, getConfiguration(item));
      const rules = foundry.utils.deepClone(item._source?.system?.rules ?? item.system?.rules ?? []);
      let changed = false;
      for (const rule of rules) {
        if (rule?.key !== "RollOption" || rule.toggleable !== true) continue;
        if (rule.value === active) continue;
        rule.value = active;
        changed = true;
      }
      if (changed) {
        await item.update({ "system.rules": rules });
      }
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Shoulder to Shoulder synchronization failed`, error);
  }
  })();
  syncingActors.set(actor, synchronization);
  try {
    await synchronization;
  } finally {
    syncingActors.delete(actor);
  }
}

async function syncSceneActors() {
  if (!canvas?.ready) return;
  await Promise.all(getConfiguredSceneActors().map((actor) => syncActorRuleValues(actor)));
}

function refreshShoulderToShoulder() {
  void syncSceneActors();
}

Hooks.once("ready", () => {
  refreshShoulderToShoulder();
  setInterval(() => void syncSceneActors(), 500);
});

for (const hook of ["createToken", "deleteToken"]) {
  Hooks.on(hook, refreshShoulderToShoulder);
}

Hooks.on("updateToken", (_document, changed) => {
  if (!["x", "y", "elevation", "width", "height"].some((key) => key in changed)) return;
  refreshShoulderToShoulder();
});

Hooks.on("targetToken", refreshShoulderToShoulder);
Hooks.on("renderActorSheet", injectActorSheetLocks);

Hooks.on("updateItem", (item, changed) => {
  if (item.type !== "action" || !item.actor) return;
  const featureChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`);
  const rulesChanged = foundry.utils.hasProperty(changed, "system.rules");
  if (featureChanged || rulesChanged) void syncActorRuleValues(item.actor);
});
