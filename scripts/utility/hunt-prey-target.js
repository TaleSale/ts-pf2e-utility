import { MODULE_ID } from "../core.js";

const HUNT_PREY_SLUG = /hunt(?:ed)?-prey/;
const HUNT_PREY_DOMAIN = "all";
const HUNT_PREY_OPTION = "hunted-prey";
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

async function applyHuntPreyTargetState(actor) {
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

for (const hook of ["createItem", "deleteItem"]) {
  Hooks.on(hook, (item) => {
    if (isSceneNpcActor(item.actor)) void syncActor(item.actor);
  });
}

Hooks.on("updateItem", (item, changed) => {
  if (!isSceneNpcActor(item.actor) || !foundry.utils.hasProperty(changed, "system.rules")) return;
  void syncActor(item.actor);
});
