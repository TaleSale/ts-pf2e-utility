import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "mountedCombat";
const FLAG_KEY = "mountedCombat";
const RIDING_FLAG = "ridingEnabled";
const EFFECT_FLAG = "mountedEffect";
const MOUNTED_EFFECT_UUID = "Compendium.pf2e.other-effects.Item.9c93NfZpENofiGUp";
const UPDATE_OPTION = `${MODULE_ID}.mountedCombat`;

const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.MountedCombat.${key}`);

function normalizeConfig(value) {
  return {
    mountUuid: String(value?.mountUuid ?? "").trim(),
    mountName: String(value?.mountName ?? "").trim(),
  };
}

function getConfig(item) {
  return normalizeConfig(item?.getFlag?.(MODULE_ID, FLAG_KEY));
}

function getMountedAction(actor) {
  return (actor?.itemTypes?.action ?? []).find((item) => isActionPlusFeatureEnabled(item, FEATURE_ID)) ?? null;
}

function canUpdate(document) {
  return document?.canUserModify instanceof Function
    ? document.canUserModify(game.user, "update")
    : Boolean(document?.isOwner);
}

function isResponsibleUser(document) {
  const activeGMs = (game.users?.contents ?? []).filter((user) => user.active && user.isGM);
  if (activeGMs.length) return activeGMs[0] === game.user;
  return canUpdate(document);
}

function getSceneTokenDocument(document) {
  if (!document) return null;
  if (document.documentName === "Token") return document;
  if (document.document?.documentName === "Token") return document.document;
  return null;
}

async function resolveUuid(uuid) {
  if (!uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch (error) {
    console.warn(`${MODULE_ID} | Unable to resolve mount UUID: ${uuid}`, error);
    return null;
  }
}

function tokensForActorOnScene(actor, scene) {
  if (!actor || !scene) return [];
  return (scene.tokens?.contents ?? []).filter((token) => token.actor === actor || (
    // An unlinked token owns a synthetic Actor instance, so identity comparison
    // with the world actor fails even though both share the same base actorId.
    // Actor UUID intentionally means "any token based on this actor"; use a
    // Token UUID when one particular unlinked copy is required.
    !actor.isToken && actor.documentName === "Actor" && token.actorId === actor.id
  ));
}

async function resolveMountToken(config, scene) {
  const document = await resolveUuid(config.mountUuid);
  const token = getSceneTokenDocument(document);
  if (token) return token.parent === scene ? token : null;
  if (document?.documentName === "Actor") return tokensForActorOnScene(document, scene)[0] ?? null;
  return null;
}

function getRiderTokens(actor, scene = null) {
  if (!actor) return [];
  if (actor.isToken) {
    const token = actor.token ?? actor.parent ?? null;
    return token && (!scene || token.parent === scene) ? [token] : [];
  }
  const scenes = scene ? [scene] : (game.scenes?.contents ?? []);
  return scenes.flatMap((entry) => tokensForActorOnScene(actor, entry));
}

function ridingEnabled(actor) {
  return actor?.getFlag?.(MODULE_ID, RIDING_FLAG) === true;
}

async function getMountedPairs(actor, scene = null) {
  if (!ridingEnabled(actor)) return [];
  const action = getMountedAction(actor);
  const config = action ? getConfig(action) : null;
  if (!config?.mountUuid) return [];
  const pairs = [];
  for (const rider of getRiderTokens(actor, scene)) {
    const mount = await resolveMountToken(config, rider.parent);
    if (mount && mount !== rider) pairs.push({ rider, mount });
  }
  return pairs;
}

function mountedPosition(rider, mount) {
  const gridSize = Number(mount.parent?.grid?.size) || Number(canvas?.grid?.size) || 100;
  const mountWidth = Math.max(1, Number(mount.width) || 1);
  const riderWidth = Math.max(1, Number(rider.width) || 1);
  return {
    x: Number(mount.x) + Math.max(0, mountWidth - riderWidth) * gridSize,
    y: Number(mount.y),
    elevation: (Number(mount.elevation) || 0) + 1,
  };
}

async function positionRider(rider, mount) {
  if (!isResponsibleUser(rider)) return;
  const position = mountedPosition(rider, mount);
  if (rider.x === position.x && rider.y === position.y && rider.elevation === position.elevation) return;
  await rider.update(position, { [UPDATE_OPTION]: true, animate: false });
}

function sourceUuid(item) {
  return item?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? "";
}

async function syncMountedEffect(actor, active) {
  if (!actor || !isResponsibleUser(actor) || !canUpdate(actor)) return;
  const marked = (actor.itemTypes?.effect ?? []).filter((item) => item.getFlag(MODULE_ID, EFFECT_FLAG) === true);
  if (!active) {
    if (marked.length) await actor.deleteEmbeddedDocuments("Item", marked.map((item) => item.id));
    return;
  }
  if ((actor.itemTypes?.effect ?? []).some((item) => sourceUuid(item) === MOUNTED_EFFECT_UUID)) return;
  const source = await resolveUuid(MOUNTED_EFFECT_UUID);
  if (!source) {
    ui.notifications.error(localize("MissingEffect"));
    return;
  }
  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${EFFECT_FLAG}`, true);
  await actor.createEmbeddedDocuments("Item", [data]);
}

const syncingActors = new WeakMap();
async function syncActor(actor, { scene = null, move = true } = {}) {
  if (!actor) return;
  const existing = syncingActors.get(actor);
  if (existing) return existing.then(() => syncActor(actor, { scene, move }));
  const promise = (async () => {
    const pairs = await getMountedPairs(actor, scene);
    if (move) await Promise.all(pairs.map(({ rider, mount }) => positionRider(rider, mount)));
    const activePairs = scene ? await getMountedPairs(actor) : pairs;
    await syncMountedEffect(actor, ridingEnabled(actor) && activePairs.length > 0);
    refreshMountedTokenCache();
  })().catch((error) => console.error(`${MODULE_ID} | Mounted combat synchronization failed`, error));
  syncingActors.set(actor, promise);
  try { await promise; }
  finally { syncingActors.delete(actor); }
}

function renderControls({ item }) {
  const config = getConfig(item);
  return `
    <div class="form-group" style="margin:0;">
      <label>${escapeHtml(localize("MountUuid"))}</label>
      <div class="form-fields"><input class="ts-mounted-combat-uuid" type="text" value="${escapeHtml(config.mountUuid)}" placeholder="Actor... / Scene....Token..."></div>
      <p class="hint">${escapeHtml(localize("MountUuidHint"))}</p>
    </div>
    <div class="ts-mounted-combat-drop" style="margin-top:5px;padding:7px;border:1px dashed var(--color-border-light-tertiary);border-radius:3px;text-align:center;">
      ${escapeHtml(config.mountName ? localize("SelectedMount").replace("{name}", config.mountName) : localize("DropHint"))}
    </div>`;
}

async function saveMount(item, mountUuid, mountName = "") {
  const config = normalizeConfig({ mountUuid, mountName });
  if (config.mountUuid) {
    const document = await resolveUuid(config.mountUuid);
    if (!document || !["Actor", "Token"].includes(document.documentName)) {
      ui.notifications.warn(localize("InvalidMount"));
      return false;
    }
    config.mountName = document.name ?? document.actor?.name ?? config.mountName;
  }
  await item.setFlag(MODULE_ID, FLAG_KEY, config);
  if (item.actor) void syncActor(item.actor);
  return true;
}

function activateListeners({ html, item, optionIndex }) {
  const panel = html.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;
  const input = panel.querySelector(".ts-mounted-combat-uuid");
  input?.addEventListener("change", async () => {
    input.disabled = true;
    try { await saveMount(item, input.value); }
    finally { input.disabled = false; }
  });
  const drop = panel.querySelector(".ts-mounted-combat-drop");
  drop?.addEventListener("dragover", (event) => event.preventDefault());
  drop?.addEventListener("drop", async (event) => {
    event.preventDefault();
    let data = null;
    try { data = JSON.parse(event.dataTransfer?.getData("text/plain") || "null"); }
    catch { /* Ignore malformed drag data. */ }
    const uuid = String(data?.uuid ?? "").trim();
    if (!uuid) return ui.notifications.warn(localize("InvalidMount"));
    await saveMount(item, uuid);
  });
}

async function cleanup({ item }) {
  await item.unsetFlag(MODULE_ID, FLAG_KEY);
  const actor = item.actor;
  if (!actor) return;
  await actor.unsetFlag(MODULE_ID, RIDING_FLAG);
  await syncMountedEffect(actor, false);
}

function mountDisplayName(actor, action) {
  const config = getConfig(action);
  return config.mountName || config.mountUuid || localize("UnknownMount");
}

function injectRidingToggle(app, html) {
  const actor = app?.document ?? app?.actor ?? app?.object ?? null;
  const action = getMountedAction(actor);
  const root = htmlElement(html);
  if (!actor || !action || !root || root.querySelector(".ts-mounted-combat-toggle")) return;
  if (!canUpdate(actor)) return;
  const checked = ridingEnabled(actor);
  const label = localize("RidingLabel").replace("{name}", mountDisplayName(actor, action));
  const togglesContainer = root.querySelector('.tab[data-tab="main"] .toggles')
    ?? root.querySelector('.tab.main .toggles');
  if (!togglesContainer) return;
  let toggles = togglesContainer.querySelector("ul[data-option-toggles]");
  if (!toggles) {
    togglesContainer.insertAdjacentHTML(
      "afterbegin",
      '<ul class="option-toggles section-body item-list" data-option-toggles></ul>',
    );
    toggles = togglesContainer.querySelector("ul[data-option-toggles]");
  }
  if (!toggles) return;
  toggles.insertAdjacentHTML("beforeend", `<li
    class="item ts-mounted-combat-toggle"
    data-item-id="${escapeHtml(action.id)}"
    data-option="mounted-combat"
    data-tooltip="${escapeHtml(label)}"
  ><label><input type="checkbox" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span></label></li>`);
  root.querySelector(".ts-mounted-combat-toggle input")?.addEventListener("change", async (event) => {
    // This row lives in PF2e's roll-option list for consistent placement, but
    // its value is an actor flag rather than a PF2e RollOption.
    event.stopPropagation();
    event.currentTarget.disabled = true;
    try {
      await actor.setFlag(MODULE_ID, RIDING_FLAG, event.currentTarget.checked);
      await syncActor(actor);
      if (event.currentTarget.checked && !(await getMountedPairs(actor)).length) ui.notifications.warn(localize("MountNotOnScene"));
    } finally {
      event.currentTarget.disabled = false;
    }
  });
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.MountedCombat.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup,
});

// PF2e commonly measures emanations, reach, and range with Token#distanceTo.
// For mounted riders, use the mount's larger footprint as the effective one.
let mountedTokenCache = new Map();
async function rebuildMountedTokenCache() {
  const next = new Map();
  if (canvas?.ready) {
    for (const token of canvas.tokens?.placeables ?? []) {
      const actor = token.actor;
      if (!actor || !ridingEnabled(actor) || !getMountedAction(actor)) continue;
      const pairs = await getMountedPairs(actor, canvas.scene);
      const pair = pairs.find(({ rider }) => rider === token.document);
      if (pair?.mount?.object) next.set(token, pair.mount.object);
    }
  }
  mountedTokenCache = next;
}

let cacheRefreshQueued = false;
function refreshMountedTokenCache() {
  if (cacheRefreshQueued) return;
  cacheRefreshQueued = true;
  queueMicrotask(async () => {
    cacheRefreshQueued = false;
    await rebuildMountedTokenCache();
  });
}

function installDistanceWrapper() {
  const prototype = CONFIG.Token?.objectClass?.prototype;
  if (!prototype?.distanceTo || prototype.distanceTo.__tsMountedCombat) return;
  const original = prototype.distanceTo;
  function distanceToMounted(other, ...args) {
    const origin = mountedTokenCache.get(this) ?? this;
    const target = mountedTokenCache.get(other) ?? other;
    return original.call(origin, target, ...args);
  }
  distanceToMounted.__tsMountedCombat = true;
  distanceToMounted.__tsOriginal = original;
  prototype.distanceTo = distanceToMounted;
}

function mountedRidersFor(mount) {
  return Array.from(mountedTokenCache.entries())
    .filter(([, cachedMount]) => cachedMount === mount)
    .map(([rider]) => rider);
}

function riderWaypoint(rider, mount, waypoint) {
  const riderDocument = rider.document;
  const mountDocument = mount.document;
  const gridSize = Number(mountDocument.parent?.grid?.size) || Number(canvas?.grid?.size) || 100;
  const mountWidth = Math.max(1, Number(waypoint.width ?? mountDocument.width) || 1);
  const riderWidth = Math.max(1, Number(riderDocument.width) || 1);
  return {
    ...waypoint,
    x: Number(waypoint.x) + Math.max(0, mountWidth - riderWidth) * gridSize,
    y: Number(waypoint.y),
    elevation: (Number(waypoint.elevation ?? mountDocument.elevation) || 0) + 1,
    width: riderDocument.width,
    height: riderDocument.height,
    depth: riderDocument.depth,
    shape: foundry.utils.deepClone(riderDocument.shape),
    level: riderDocument.level,
  };
}

function appendMountedMovement(result) {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return result;
  const [updates, options = {}] = result;
  const movement = options.movement;
  if (!movement || typeof movement !== "object") return result;
  const included = new Set(updates.map((update) => update._id));
  for (const [mountId, descriptor] of Object.entries({ ...movement })) {
    const mount = canvas.tokens?.get?.(mountId);
    if (!mount || !Array.isArray(descriptor?.waypoints)) continue;
    for (const rider of mountedRidersFor(mount)) {
      if (included.has(rider.id) || !canUpdate(rider.document)) continue;
      included.add(rider.id);
      updates.push({ _id: rider.id });
      movement[rider.id] = {
        ...descriptor,
        id: descriptor.id ? foundry.utils.randomID() : descriptor.id,
        planned: false,
        waypoints: descriptor.waypoints.map((waypoint) => riderWaypoint(rider, mount, waypoint)),
      };
    }
  }
  return result;
}

function wrapMovementPreparation(prototype, method) {
  const original = prototype?.[method];
  if (!(original instanceof Function) || original.__tsMountedCombat) return;
  function prepareMountedMovement(...args) {
    return appendMountedMovement(original.apply(this, args));
  }
  prepareMountedMovement.__tsMountedCombat = true;
  prepareMountedMovement.__tsOriginal = original;
  prototype[method] = prepareMountedMovement;
}

function installMovementWrappers() {
  wrapMovementPreparation(CONFIG.Token?.objectClass?.prototype, "_prepareDragLeftDropUpdates");
  wrapMovementPreparation(canvas.tokens?.constructor?.prototype, "_prepareKeyboardMovementUpdates");
}

function tokenCells(token) {
  const size = Number(token?.parent?.grid?.size) || 100;
  const left = Math.round(Number(token.x) / size);
  const top = Math.round(Number(token.y) / size);
  const width = Math.max(1, Math.round(Number(token.width) || 1));
  const height = Math.max(1, Math.round(Number(token.height) || 1));
  const cells = [];
  for (let x = left; x < left + width; x += 1) for (let y = top; y < top + height; y += 1) cells.push({ x, y });
  return cells;
}

function cellKey(cell) { return `${cell.x}:${cell.y}`; }

function cellsOnLine(from, to) {
  const cells = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let error = dx - dy;
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error;
    if (twice > -dy) { error -= dy; x += sx; }
    if (twice < dx) { error += dx; y += sy; }
    if (x !== to.x || y !== to.y) cells.push({ x, y });
  }
  return cells;
}

async function mountProvidesLesserCover(originToken, targetToken) {
  const rider = getSceneTokenDocument(targetToken);
  const origin = getSceneTokenDocument(originToken);
  if (!rider || !origin || rider.parent !== origin.parent || !ridingEnabled(rider.actor)) return false;
  const pairs = await getMountedPairs(rider.actor, rider.parent);
  const mount = pairs.find((pair) => pair.rider === rider)?.mount;
  if (!mount) return false;
  const mountCells = new Set(tokenCells(mount).map(cellKey));
  const riderCells = new Set(tokenCells(rider).map(cellKey));
  for (const from of tokenCells(origin)) {
    for (const to of tokenCells(rider)) {
      if (cellsOnLine(from, to).some((cell) => mountCells.has(cellKey(cell)) && !riderCells.has(cellKey(cell)))) return true;
    }
  }
  return false;
}

function installCoverWrapper() {
  const check = game.pf2e?.Check;
  if (!check?.roll || check.roll.__tsMountedCombat) return;
  const original = check.roll;
  async function rollWithMountedCover(modifier, context = {}, ...args) {
    const origin = context.origin?.token ?? context.token ?? null;
    const target = context.target?.token ?? null;
    const isAttack = context.type === "attack-roll" || context.domains?.some?.((domain) => String(domain).includes("attack"));
    if (isAttack && await mountProvidesLesserCover(origin, target)) {
      const alreadyApplied = modifier.modifiers?.some((entry) => entry.slug === "mounted-lesser-cover");
      if (!alreadyApplied) modifier.push(new game.pf2e.Modifier({
        slug: "mounted-lesser-cover",
        label: localize("LesserCover"),
        modifier: -1,
        type: "circumstance",
      }));
    }
    return original.call(this, modifier, context, ...args);
  }
  rollWithMountedCover.__tsMountedCombat = true;
  rollWithMountedCover.__tsOriginal = original;
  check.roll = rollWithMountedCover;
}

Hooks.once("ready", () => {
  installDistanceWrapper();
  installMovementWrappers();
  installCoverWrapper();
  refreshMountedTokenCache();
  for (const actor of game.actors?.contents ?? []) if (getMountedAction(actor)) void syncActor(actor);
});

async function syncSceneRiders(scene = canvas?.scene) {
  if (!scene) return;
  const actors = new Set(
    (scene.tokens?.contents ?? [])
      .map((token) => token.actor)
      .filter((actor) => actor && ridingEnabled(actor) && getMountedAction(actor)),
  );
  await Promise.all(Array.from(actors, (actor) => syncActor(actor, { scene })));
}

Hooks.on("canvasReady", (canvasInstance) => {
  refreshMountedTokenCache();
  void syncSceneRiders(canvasInstance?.scene ?? canvas?.scene);
});
Hooks.on("renderActorSheet", injectRidingToggle);

Hooks.on("updateActor", (actor, changed, options) => {
  if (options?.[UPDATE_OPTION]) return;
  if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${RIDING_FLAG}`)) void syncActor(actor);
});

Hooks.on("updateItem", (item, changed) => {
  if (!item.actor || item.type !== "action") return;
  if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) void syncActor(item.actor);
});

Hooks.on("createToken", (token) => {
  refreshMountedTokenCache();
  void syncSceneRiders(token.parent);
});

Hooks.on("deleteToken", (token) => {
  refreshMountedTokenCache();
  void syncSceneRiders(token.parent);
});

Hooks.on("createItem", (item) => {
  if (item.actor && item.type === "action") void syncActor(item.actor);
});

Hooks.on("deleteItem", (item) => {
  const actor = item.actor ?? item.parent ?? null;
  if (!actor || item.type !== "action") return;
  if (isActionPlusFeatureEnabled(item, FEATURE_ID) && isResponsibleUser(actor)) {
    void actor.unsetFlag(MODULE_ID, RIDING_FLAG).then(() => syncMountedEffect(actor, false));
  } else {
    void syncActor(actor);
  }
});

Hooks.on("updateToken", (token, changed, options) => {
  if (options?.[UPDATE_OPTION]) return;
  if (!["x", "y", "elevation", "width", "height"].some((key) => key in changed)) return;
  refreshMountedTokenCache();
  const scene = token.parent;
  for (const rider of scene?.tokens?.contents ?? []) {
    const actor = rider.actor;
    if (actor && ridingEnabled(actor) && getMountedAction(actor)) void syncActor(actor, { scene });
  }
});
