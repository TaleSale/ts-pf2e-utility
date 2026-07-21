import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "shoulderToShoulder";
const FLAG_KEY = "shoulderToShoulder";
const MIN_ALLIES = 1;
const MAX_ALLIES = 20;

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.ShoulderToShoulder.${key}`);
}

function normalizeRequiredAllies(value) {
  const number = Number(value?.requiredAllies ?? value);
  return Number.isFinite(number)
    ? Math.clamp(Math.trunc(number), MIN_ALLIES, MAX_ALLIES)
    : MIN_ALLIES;
}

function getRequiredAllies(item) {
  return normalizeRequiredAllies(item?.getFlag?.(MODULE_ID, FLAG_KEY));
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

function getConfiguredSceneActors() {
  if (!canvas?.ready) return [];
  return Array.from(new Set(
    (canvas.tokens?.placeables ?? [])
      .map((token) => token.actor)
      .filter((actor) => actor && getConfiguredItems(actor).length > 0),
  ));
}

function renderControls({ item }) {
  return `
    <div class="form-group" style="margin: 0;">
      <label>${foundry.utils.escapeHTML(localize("RequiredAllies"))}</label>
      <div class="form-fields">
        <input
          type="number"
          class="ts-shoulder-to-shoulder-allies"
          min="${MIN_ALLIES}"
          max="${MAX_ALLIES}"
          step="1"
          value="${getRequiredAllies(item)}"
        >
      </div>
      <p class="hint">${foundry.utils.escapeHTML(localize("Hint"))}</p>
    </div>
  `;
}

function activateListeners({ html, item, optionIndex }) {
  const panel = html.querySelector(
    `.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`,
  );
  const input = panel?.querySelector(".ts-shoulder-to-shoulder-allies");
  input?.addEventListener("change", async (event) => {
    const requiredAllies = normalizeRequiredAllies(event.currentTarget.value);
    event.currentTarget.value = requiredAllies;
    await item.setFlag(MODULE_ID, FLAG_KEY, { requiredAllies });
  });
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

function isAdjacent(token, other) {
  if (!token?.actor || !other?.actor || token === other) return false;
  const alliance = token.actor.alliance;
  if (alliance == null || alliance !== other.actor.alliance) return false;

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
    return horizontalGap < gridSize && verticalGap < gridSize && elevationGap <= gridDistance;
  }

  const distance = token.distanceTo?.(other);
  return Number.isFinite(distance) && distance <= (Number(canvas.scene?.grid?.distance) || 5);
}

function hasEnoughAdjacentAllies(actor, requiredAllies) {
  const actorTokens = activeTokensFor(actor);
  if (!actorTokens.length) return false;

  const sceneTokens = canvas.tokens?.placeables ?? [];
  return actorTokens.some((token) => {
    // Count creature tokens, not unique actor UUIDs: several unlinked copies of
    // the same NPC are separate allies on the battlefield.
    const adjacentAllies = sceneTokens.filter((other) => isAdjacent(token, other));
    return adjacentAllies.length >= requiredAllies;
  });
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
      const active = hasEnoughAdjacentAllies(actor, getRequiredAllies(item));
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

Hooks.on("updateItem", (item, changed) => {
  if (item.type !== "action" || !item.actor) return;
  const featureChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`);
  const rulesChanged = foundry.utils.hasProperty(changed, "system.rules");
  if (featureChanged || rulesChanged) void syncActorRuleValues(item.actor);
});
