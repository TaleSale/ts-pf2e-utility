import { I18N_PREFIX, MODULE_ID } from "../core.js";

const HUNT_PREY_SLUG = /hunt(?:ed)?-prey/;
const HUNT_PREY_DOMAIN = "all";
const HUNT_PREY_OPTION = "hunted-prey";
const AUTOMATION_LOCK_FLAG = "huntPreyAutomationLocked";
const syncStates = new WeakMap();

function getSceneNpcActors() {
  return Array.from(new Set(
    (canvas.tokens?.placeables ?? [])
      .map((token) => token.actor)
      .filter((actor) => actor?.type === "npc" && actor.isOwner),
  ));
}

function isSceneNpcActor(actor) {
  return actor?.type === "npc" && getSceneNpcActors().includes(actor);
}

function isHuntPreyEffect(item) {
  const rules = item._source?.system?.rules ?? [];
  const itemSlug = String(item.slug ?? item.system?.slug ?? "");
  return HUNT_PREY_SLUG.test(itemSlug)
    || rules.some((rule) => (
      rule?.key === "TokenMark" && HUNT_PREY_SLUG.test(String(rule.slug ?? ""))
    ));
}

function getHuntPreyEffects(actor) {
  return actor.items.filter((item) => item.type === "effect" && isHuntPreyEffect(item));
}

function isAutomationLocked(actor) {
  return actor?.getFlag?.(MODULE_ID, AUTOMATION_LOCK_FLAG) === true;
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function automationTooltip(locked) {
  return game.i18n.localize(`${I18N_PREFIX}.Utility.HuntPrey.${locked ? "AutomationLocked" : "AutomationEnabled"}`);
}

function injectAutomationLock(toggle, actor) {
  if (!(toggle instanceof HTMLElement)) return;
  toggle.classList.add("ts-automation-toggle-row");
  let button = toggle.querySelector(":scope > .ts-hunt-prey-lock");
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "ts-automation-lock ts-hunt-prey-lock";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        const wasLocked = isAutomationLocked(actor);
        await actor.setFlag(MODULE_ID, AUTOMATION_LOCK_FLAG, !wasLocked);
        updateAutomationLockButton(button, actor);
        if (wasLocked) void syncActor(actor);
      } finally {
        button.disabled = false;
      }
    });
    toggle.append(button);
  }
  updateAutomationLockButton(button, actor);
}

function updateAutomationLockButton(button, actor) {
  const locked = isAutomationLocked(actor);
  button.dataset.tooltip = automationTooltip(locked);
  const iconClass = locked ? "fa-lock" : "fa-lock-open";
  const icon = button.querySelector("i");
  if (icon?.classList.contains(iconClass)) return;
  button.innerHTML = `<i class="fas fa-fw ${iconClass}"></i>`;
}

function injectActorSheetLocks(app, html) {
  const actor = app?.document ?? app?.actor ?? app?.object ?? null;
  const root = getHtmlElement(html);
  if (!actor?.isOwner || !root || !getHuntPreyEffects(actor).length) return;
  const scan = () => {
    if (!root.isConnected) return;
    for (const toggle of root.querySelectorAll(`ul[data-option-toggles] li[data-option="${HUNT_PREY_OPTION}"]`)) injectAutomationLock(toggle, actor);
  };
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
}

async function applyHuntPreyTargetState(actor) {
  if (isAutomationLocked(actor)) return;
  const targetUuids = new Set(
    Array.from(game.user?.targets ?? [], (target) => target?.document?.uuid).filter(Boolean),
  );

  const markedTokenUuids = getHuntPreyEffects(actor).flatMap((item) => (
    (item._source?.system?.rules ?? [])
      .filter((rule) => rule?.key === "TokenMark" && rule.uuid)
      .map((rule) => String(rule.uuid))
  ));
  if (markedTokenUuids.length === 0) return;

  const active = markedTokenUuids.some((uuid) => targetUuids.has(uuid));
  const toggle = actor.synthetics?.toggles?.[HUNT_PREY_DOMAIN]?.[HUNT_PREY_OPTION];
  if (!toggle || toggle.checked === active) return;

  await actor.toggleRollOption(
    HUNT_PREY_DOMAIN,
    HUNT_PREY_OPTION,
    toggle.itemId ?? null,
    active,
  );
}

async function syncActor(actor) {
  if (!actor) return;

  const state = syncStates.get(actor) ?? { revision: 0, running: null };
  state.revision += 1;
  syncStates.set(actor, state);
  if (state.running) return state.running;

  state.running = (async () => {
    try {
      let handledRevision;
      do {
        handledRevision = state.revision;
        await applyHuntPreyTargetState(actor);
      } while (handledRevision !== state.revision);
    } catch (error) {
      console.error(`${MODULE_ID} | Hunt Prey target synchronization failed`, error);
    } finally {
      state.running = null;
    }
  })();

  return state.running;
}

function syncSceneNpcActors() {
  if (!game.user?.isGM || !canvas?.ready) return;
  for (const actor of getSceneNpcActors()) void syncActor(actor);
}

Hooks.once("ready", syncSceneNpcActors);
Hooks.on("targetToken", () => setTimeout(syncSceneNpcActors, 0));
Hooks.on("canvasReady", syncSceneNpcActors);
Hooks.on("renderActorSheet", injectActorSheetLocks);

for (const hook of ["createItem", "deleteItem"]) {
  Hooks.on(hook, (item) => {
    if (isSceneNpcActor(item.actor)) void syncActor(item.actor);
  });
}

Hooks.on("updateItem", (item, changed) => {
  if (!isSceneNpcActor(item.actor) || !foundry.utils.hasProperty(changed, "system.rules")) return;
  void syncActor(item.actor);
});
