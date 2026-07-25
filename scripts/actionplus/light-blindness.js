import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "lightBlindness";
const CONDITION_FLAG = "lightBlindnessCondition";
const TURN_ENDS_FLAG = "remainingOwnerTurnEnds";
const BRIGHT_LIGHT_LEVEL = 0.75;

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.LightBlindness.${key}`);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.LightBlindness.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup: cleanupLightBlindness,
});

function renderControls() {
  return `<p class="hint" style="margin: 0;">${foundry.utils.escapeHTML(localize("Hint"))}</p>`;
}

function activateListeners({ item }) {
  void syncActor(item.actor);
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function injectUseButton(row, actor) {
  if (!(row instanceof HTMLElement)) return;
  row.querySelectorAll(".item-summary .ts-light-blindness-use").forEach((button) => button.remove());
  row.querySelector(":scope > .button-group > .use-action[data-action=\"use-action\"]")?.closest(".button-group")?.remove();
  if (row.querySelector(":scope > .ts-light-blindness-use")) return;
  const group = document.createElement("div");
  group.className = "button-group ts-light-blindness-use";
  group.innerHTML = `
    <button type="button" class="blue">
      <i class="fas fa-eye-slash"></i> ${foundry.utils.escapeHTML(localize("ApplyBlinded"))}
    </button>
  `;
  group.querySelector("button")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await applyInitialBlindness(actor);
    } finally {
      button.disabled = false;
    }
  });
  const summary = row.querySelector(":scope > .item-summary");
  if (summary) summary.before(group);
  else row.append(group);
}

function injectActorSheetButtons(app, html) {
  if (!game.user.isGM) return;
  const actor = app?.document ?? app?.actor ?? app?.object ?? null;
  const root = getHtmlElement(html);
  if (!actor || !root) return;
  const items = (actor.itemTypes?.action ?? []).filter((item) => isActionPlusFeatureEnabled(item, FEATURE_ID));
  if (!items.length) return;

  const scan = () => {
    if (!root.isConnected) return;
    for (const item of items) {
      const escapedId = CSS.escape(item.id);
      for (const row of root.querySelectorAll(`[data-item-id="${escapedId}"], [data-document-id="${escapedId}"]`)) {
        if (!row.matches(".item-summary")) injectUseButton(row, actor);
      }
    }
  };

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
}

function getConfiguredItem(actor) {
  return actor?.itemTypes?.action?.find((item) => isActionPlusFeatureEnabled(item, FEATURE_ID)) ?? null;
}

function getActorTokens(actor) {
  if (!canvas?.ready) return [];
  return canvas.tokens?.placeables?.filter((token) => token.actor === actor) ?? [];
}

function tokenPoint(token) {
  return {
    x: Number(token.center?.x ?? token.document?.x ?? 0),
    y: Number(token.center?.y ?? token.document?.y ?? 0),
    elevation: Number(token.document?.elevation ?? 0),
  };
}

function isInsideLight(token, { brightOnly = false } = {}) {
  const point = tokenPoint(token);
  const sources = canvas.effects?.lightSources ?? [];
  return Array.from(sources).some((source) => {
    if (!source?.active || source.isPreview) return false;
    if (!source.testPoint?.(point)) return false;
    if (!brightOnly) return true;

    const brightRadius = Math.abs(Number(source.data?.bright ?? source.object?.brightRadius ?? 0));
    if (!(brightRadius > 0)) return false;
    return Math.hypot(point.x - Number(source.x ?? 0), point.y - Number(source.y ?? 0)) <= brightRadius;
  });
}

function ambientLightLevel(token) {
  const darkness = Number(canvas.effects?.getDarknessLevel?.(tokenPoint(token)) ?? canvas.environment?.darknessLevel ?? 0);
  return 1 - Math.clamp(darkness, 0, 1);
}

function isTokenBright(token) {
  return ambientLightLevel(token) >= BRIGHT_LIGHT_LEVEL || isInsideLight(token, { brightOnly: true });
}

function ownedConditions(actor, slug) {
  return (actor?.itemTypes?.condition ?? []).filter((condition) => (
    condition.slug === slug && condition.getFlag(MODULE_ID, CONDITION_FLAG) === FEATURE_ID
  ));
}

async function createOwnedCondition(actor, slug, extraFlags = {}) {
  if (actor.itemTypes?.condition?.some((condition) => condition.slug === slug)) return null;
  const source = game.pf2e.ConditionManager.getCondition(slug)?.toObject();
  if (!source) return null;
  if (slug === "blinded") {
    foundry.utils.setProperty(source, "system.references.overrides", []);
  }
  source.flags = foundry.utils.mergeObject(source.flags ?? {}, {
    [MODULE_ID]: {
      [CONDITION_FLAG]: FEATURE_ID,
      ...extraFlags,
    },
  });
  return (await actor.createEmbeddedDocuments("Item", [source])).shift() ?? null;
}

async function removeOwnedConditions(actor, slug) {
  const ids = ownedConditions(actor, slug).map((condition) => condition.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

async function applyInitialBlindness(actor) {
  const isOwnTurn = actor.combatant?.id && game.combat?.combatant?.id === actor.combatant.id;
  const remainingOwnerTurnEnds = isOwnTurn ? 2 : 1;
  const existing = ownedConditions(actor, "blinded")[0];
  if (existing) {
    await existing.update({
      "system.references.overrides": [],
      [`flags.${MODULE_ID}.${TURN_ENDS_FLAG}`]: remainingOwnerTurnEnds,
    });
  } else {
    await createOwnedCondition(actor, "blinded", { [TURN_ENDS_FLAG]: remainingOwnerTurnEnds });
  }
}

const syncingActors = new WeakMap();

async function syncActor(actor) {
  if (!actor || game.user !== actor.primaryUpdater) return;
  const existing = syncingActors.get(actor);
  if (existing) return existing;

  const synchronization = (async () => {
    const item = getConfiguredItem(actor);
    if (!item) return;
    const tokens = getActorTokens(actor);
    if (!tokens.length) return;

    const bright = tokens.some(isTokenBright);

    if (bright) {
      await createOwnedCondition(actor, "dazzled");
    } else {
      await removeOwnedConditions(actor, "dazzled");
    }
  })().catch((error) => console.error(`${MODULE_ID} | Light Blindness synchronization failed`, error));

  syncingActors.set(actor, synchronization);
  try {
    await synchronization;
  } finally {
    syncingActors.delete(actor);
  }
}

async function cleanupLightBlindness({ item }) {
  const actor = item.actor;
  if (actor && game.user === actor.primaryUpdater) {
    await removeOwnedConditions(actor, "dazzled");
    await removeOwnedConditions(actor, "blinded");
  }
}

async function syncSceneActors() {
  if (!canvas?.ready) return;
  const actors = Array.from(new Set(
    (canvas.tokens?.placeables ?? []).map((token) => token.actor).filter((actor) => getConfiguredItem(actor)),
  ));
  await Promise.all(actors.map(syncActor));
}

Hooks.once("ready", () => {
  void syncSceneActors();
  setInterval(() => void syncSceneActors(), 1000);
});

Hooks.on("canvasReady", () => void syncSceneActors());
Hooks.on("renderActorSheet", injectActorSheetButtons);

for (const hook of ["createToken", "deleteToken", "createAmbientLight", "updateAmbientLight", "deleteAmbientLight"]) {
  Hooks.on(hook, () => void syncSceneActors());
}

Hooks.on("updateToken", (_token, changed) => {
  if (["x", "y", "elevation", "width", "height", "light", "hidden"].some((key) => key in changed)) {
    void syncSceneActors();
  }
});

Hooks.on("updateScene", (_scene, changed) => {
  if (foundry.utils.hasProperty(changed, "environment") || foundry.utils.hasProperty(changed, "darkness")) {
    void syncSceneActors();
  }
});

Hooks.on("updateItem", (item, changed) => {
  const optionsChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOptions`)
    || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOption`);
  if (item.type === "action" && item.actor && optionsChanged) {
    void syncActor(item.actor);
  }
});

Hooks.on("deleteItem", (item) => {
  const actor = item.actor;
  if (item.type !== "action" || !actor || game.user !== actor.primaryUpdater) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID)) return;
  queueMicrotask(async () => {
    if (getConfiguredItem(actor)) return;
    await removeOwnedConditions(actor, "dazzled");
    await removeOwnedConditions(actor, "blinded");
  });
});

Hooks.on("pf2e.endTurn", async (combatant) => {
  const actor = combatant?.actor;
  if (!actor || game.user !== actor.primaryUpdater) return;
  for (const condition of ownedConditions(actor, "blinded")) {
    const remaining = Number(condition.getFlag(MODULE_ID, TURN_ENDS_FLAG) ?? 0);
    if (remaining <= 1) await condition.delete();
    else await condition.update({ [`flags.${MODULE_ID}.${TURN_ENDS_FLAG}`]: remaining - 1 });
  }
  await syncActor(actor);
});

Hooks.on("deleteCombat", async (combat) => {
  const actors = Array.from(new Set(
    (combat?.combatants?.contents ?? []).map((combatant) => combatant.actor).filter(Boolean),
  ));
  for (const actor of actors) {
    if (game.user === actor.primaryUpdater) await removeOwnedConditions(actor, "blinded");
  }
});
