export const MODULE_ID = "ts-pf2e-utility";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
export const I18N_PREFIX = "TS_PF2E_UTILITY";

const SOCKET_ACTIONS = Object.freeze({
  playerAction: "player-action",
});
const MODULE_COMPENDIUM_ID = `${MODULE_ID}.games`;
const MODULE_COMPENDIUM_ROOT_FOLDER = "99.TS-PF2E-UTILITY";
const MODULE_MACRO_ICON_UPDATES = Object.freeze({
  uK8pV4mX2rQ7nHs5: "icons/skills/trades/gaming-gambling-dice-gray.webp",
  YwNQfY3G4kP1mL2a: "icons/magic/death/skull-horned-goat-pentagram-red.webp",
});

const gameRegistry = new Map();
const openApps = new Map();
const seenOpenSignals = new Map();
const PARTIAL_REFRESH_SCROLL_SELECTORS = [
  ".tsu-rule-list",
  ".tsu-player-list",
  ".tsu-log-list",
  ".kb-log-list",
].join(", ");

function gameFlagKey(gameId) {
  return `gameState-${gameId}`;
}

function clone(value) {
  return foundry.utils.deepClone(value);
}

export function i18nKey(key) {
  return key.startsWith(`${I18N_PREFIX}.`) ? key : `${I18N_PREFIX}.${key}`;
}

export function t(key, fallback = "") {
  const fullKey = i18nKey(key);
  const value = game?.i18n?.localize?.(fullKey);
  return value && value !== fullKey ? value : fallback;
}

export function tf(key, data = {}, fallback = null) {
  const fullKey = i18nKey(key);
  const value = game?.i18n?.format?.(fullKey, data);
  if (value && value !== fullKey) return value;
  if (typeof fallback === "function") return fallback(data);
  return fallback ?? fullKey;
}

export function getTranslationObject(key, fallback = null) {
  const fullKey = i18nKey(key);
  return foundry.utils.getProperty(game?.i18n?.translations ?? {}, fullKey)
    ?? foundry.utils.getProperty(game?.i18n?._fallback ?? {}, fullKey)
    ?? fallback;
}

export function gt(definition, key, fallback = "") {
  return t(`${definition.i18nRoot}.${key}`, fallback);
}

export function gtf(definition, key, data = {}, fallback = null) {
  return tf(`${definition.i18nRoot}.${key}`, data, fallback);
}

export function gobj(definition, key, fallback = null) {
  return getTranslationObject(`${definition.i18nRoot}.${key}`, fallback);
}

export function notify(type, key, data = {}, fallback = null) {
  const hasData = data && Object.keys(data).length > 0;
  const text = hasData
    ? tf(`Notifications.${key}`, data, fallback)
    : t(`Notifications.${key}`, fallback ?? key);
  ui.notifications?.[type]?.(text);
  return text;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function randomChoice(values, fallback = "") {
  if (!Array.isArray(values) || !values.length) return fallback;
  return values[Math.floor(Math.random() * values.length)] ?? fallback;
}

export function formatSignedNumber(value) {
  const numeric = Number(value) || 0;
  return numeric >= 0 ? `+${numeric}` : `${numeric}`;
}

function actorHasUntrainedImprovisation(actor) {
  if (!actor || actor.type !== "character") return false;
  return actor.items.some((item) => {
    if (item.type !== "feat") return false;
    const slug = String(item.slug ?? item.system?.slug ?? "").toLowerCase();
    const sourceId = String(item.sourceId ?? item.flags?.core?.sourceId ?? "").toLowerCase();
    const name = String(item.name ?? "").toLowerCase();
    return slug === "untrained-improvisation"
      || sourceId.includes(".item.untrained-improvisation")
      || name.includes("untrained improvisation");
  });
}

function matchesLoreSelector(item, loreSelector) {
  if (item?.type !== "lore") return false;
  if (!loreSelector) return true;
  if (typeof loreSelector === "function") return loreSelector(item);

  const selectors = Array.isArray(loreSelector) ? loreSelector : [loreSelector];
  const name = String(item.name ?? "").toLowerCase();
  const slug = String(item.slug ?? item.system?.slug ?? "").toLowerCase();

  return selectors.some((selector) => {
    const value = String(selector ?? "").toLowerCase();
    return value && (name.includes(value) || slug.includes(value));
  });
}

export function getActorLoreModifier(actor, loreSelector = null) {
  if (!actor) return 0;

  const isNpc = actor.type === "npc";
  const system = actor.system ?? {};
  const level = system.details?.level?.value || 0;
  const intelligence = system.abilities?.int?.mod || 0;
  const untrainedModifier = intelligence + (actorHasUntrainedImprovisation(actor) ? Math.max(level - 2, 0) : 0);
  const lore = actor.items.find((item) => matchesLoreSelector(item, loreSelector));

  if (!lore) return untrainedModifier;
  if (isNpc) return lore.system.mod?.value || intelligence;

  const rank = lore.system.proficient?.value || 0;
  return rank > 0 ? (rank * 2 + level + intelligence) : untrainedModifier;
}

export function registerGame(definition) {
  if (!definition?.id) throw new Error(`${MODULE_ID} | game definition requires an id`);
  if (gameRegistry.has(definition.id)) throw new Error(`${MODULE_ID} | duplicate game id ${definition.id}`);
  gameRegistry.set(definition.id, definition);
}

export function getGameDefinition(gameId) {
  return gameRegistry.get(gameId) ?? null;
}

export function getRegisteredGames() {
  return Array.from(gameRegistry.values());
}

export function getCurrentScene() {
  return canvas?.scene ?? null;
}

export function requireCurrentScene() {
  const scene = getCurrentScene();
  if (!scene) {
    notify("warn", "SceneRequired", {}, "An active scene is required.");
    return null;
  }
  return scene;
}

export function getGameState(gameId, scene = getCurrentScene()) {
  if (!scene) return null;
  return scene.getFlag(MODULE_ID, gameFlagKey(gameId)) ?? null;
}

export async function saveGameState(gameId, state, scene = getCurrentScene()) {
  if (!scene) return;
  state.syncToken = Date.now();
  const flagKey = gameFlagKey(gameId);
  const snapshot = clone(state);
  await scene.unsetFlag(MODULE_ID, flagKey);
  await scene.setFlag(MODULE_ID, flagKey, snapshot);
}

export async function unsetGameState(gameId, scene = getCurrentScene()) {
  if (!scene) return;
  await scene.unsetFlag(MODULE_ID, gameFlagKey(gameId));
}

export function userCanControlActor(actor, user = game.user) {
  if (!actor || !user) return false;
  if (user.isGM) return true;
  if (actor.testUserPermission(user, "OWNER")) return true;
  return user.character?.id === actor.id;
}

function canUserControlActor(actorId, userId) {
  const actor = game.actors?.get(actorId);
  const user = game.users?.get(userId);
  return userCanControlActor(actor, user);
}

function resolveActorLikeMember(member) {
  if (!member) return null;
  if (member.documentName === "Actor" || typeof member.testUserPermission === "function") return member;
  if (member.actor) return member.actor;

  const actorId = member.actorId ?? member.id ?? member._id ?? null;
  if (actorId) return game.actors?.get(actorId) ?? null;

  return null;
}

export function getPartyCharacterMembers(party) {
  if (!party || party.type !== "party") return [];

  const members = [
    ...(Array.isArray(party.members) ? party.members : []),
    ...(Array.isArray(party.system?.details?.members) ? party.system.details.members : []),
    ...(Array.isArray(party.system?.members) ? party.system.members : []),
  ]
    .map((member) => resolveActorLikeMember(member))
    .filter((member) => member?.type === "character");

  return Array.from(new Map(members.map((member) => [member.id, member])).values());
}

export function getActorUuidFromDropData(data) {
  if (!data || typeof data !== "object") return null;

  const directUuid = data.uuid ?? data.actorUuid ?? data.documentUuid ?? null;
  if (typeof directUuid === "string" && directUuid.length) return directUuid;

  const actorId = data.type === "Token"
    ? data.actorId ?? data.actorData?._id ?? null
    : data.actorId ?? data.id ?? null;

  if (!actorId) return null;
  return game.actors?.get(actorId)?.uuid ?? null;
}

export async function getDroppedActors(dropDataOrUuid) {
  const uuid = typeof dropDataOrUuid === "string"
    ? dropDataOrUuid
    : getActorUuidFromDropData(dropDataOrUuid);

  if (!uuid) return [];

  const dropped = await fromUuid(uuid);
  if (!dropped) return [];
  if (dropped.type === "party") return getPartyCharacterMembers(dropped);
  if (dropped.documentName === "Actor" || dropped.type) return [dropped];
  return dropped.actor ? [dropped.actor] : [];
}

export function getNonGmCharacters() {
  const allPlayerUsers = (game.users?.contents ?? []).filter((user) => !user.isGM);
  const onlineUsers = allPlayerUsers.filter((user) => user.active);
  const effectiveUsers = onlineUsers;
  const characters = new Map();

  const parties = (game.actors?.contents ?? []).filter((actor) => actor?.type === "party");
  const rankedParties = parties
    .map((party) => {
      const members = getPartyCharacterMembers(party);
      const matchedUsers = effectiveUsers.filter((user) => {
        if (user.character && members.some((member) => member.id === user.character.id)) return true;
        const ownedMembers = members.filter((member) => member.testUserPermission(user, "OWNER"));
        return ownedMembers.length === 1;
      });
      return { party, members, matchedUsers };
    })
    .sort((left, right) => right.matchedUsers.length - left.matchedUsers.length || right.members.length - left.members.length);

  const activeParty = rankedParties[0]?.members ?? [];
  for (const user of effectiveUsers) {
    const assignedCharacter = user.character;
    if (assignedCharacter?.type === "character") {
      characters.set(assignedCharacter.id, assignedCharacter);
      continue;
    }

    const ownedMembers = activeParty.filter((member) => member.testUserPermission(user, "OWNER"));
    if (ownedMembers.length === 1) {
      characters.set(ownedMembers[0].id, ownedMembers[0]);
      continue;
    }

    const limitedMembers = activeParty.filter((member) => member.testUserPermission(user, "LIMITED"));
    if (limitedMembers.length === 1) {
      characters.set(limitedMembers[0].id, limitedMembers[0]);
    }
  }

  if (!characters.size) {
    for (const user of effectiveUsers) {
      if (!user.character) continue;
      characters.set(user.character.id, user.character);
    }
  }

  const selectedCharacters = Array.from(characters.values());
  console.groupCollapsed(`${MODULE_ID} | player discovery`);
  if (!onlineUsers.length) {
    console.warn(`${MODULE_ID} | no active non-GM users found, auto player discovery is empty`);
  }
  console.table(allPlayerUsers.map((user) => ({
    id: user.id,
    name: user.name,
    active: Boolean(user.active),
    characterId: user.character?.id ?? "",
    characterName: user.character?.name ?? "",
  })));
  console.table(rankedParties.map(({ party, members, matchedUsers }) => ({
    partyId: party.id,
    partyName: party.name,
    members: members.map((member) => member.name).join(", "),
    matchedUsers: matchedUsers.map((user) => user.name).join(", "),
  })));
  console.table(selectedCharacters.map((actor) => ({
    actorId: actor.id,
    actorName: actor.name,
  })));
  console.groupEnd();

  return selectedCharacters;
}

function attachAppLifecycle(gameId, app) {
  const originalClose = app.close.bind(app);
  app.close = async (...args) => {
    openApps.delete(gameId);
    return originalClose(...args);
  };
  return app;
}

function getScrollableElements(root) {
  if (!(root instanceof HTMLElement)) return [];
  const elements = [root, ...Array.from(root.querySelectorAll(PARTIAL_REFRESH_SCROLL_SELECTORS))];
  return elements.filter((element, index, list) => list.indexOf(element) === index);
}

function captureScrollState(root) {
  return getScrollableElements(root).map((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }));
}

function restoreScrollState(root, scrollState) {
  const elements = getScrollableElements(root);
  for (let index = 0; index < elements.length; index += 1) {
    const state = scrollState[index];
    if (!state) continue;
    elements[index].scrollLeft = state.left;
    elements[index].scrollTop = state.top;
  }
}

export function patchApplicationRegions(app, rootSelector, regionSelectors, nextRendered) {
  const appElement = app?.element?.[0];
  const nextRoot = nextRendered?.[0] ?? nextRendered;
  if (!(appElement instanceof HTMLElement) || !(nextRoot instanceof HTMLElement)) return false;

  const currentRoot = appElement.querySelector(rootSelector);
  const replacementRoot = nextRoot.matches?.(rootSelector) ? nextRoot : nextRoot.querySelector(rootSelector);
  if (!(currentRoot instanceof HTMLElement) || !(replacementRoot instanceof HTMLElement)) return false;

  for (const selector of regionSelectors) {
    const currentRegion = currentRoot.querySelector(selector);
    const nextRegion = replacementRoot.querySelector(selector);
    if (!(currentRegion instanceof HTMLElement) || !(nextRegion instanceof HTMLElement)) continue;
    if (currentRegion.outerHTML === nextRegion.outerHTML) continue;

    const scrollState = captureScrollState(currentRegion);
    const replacement = nextRegion.cloneNode(true);
    currentRegion.replaceWith(replacement);
    restoreScrollState(replacement, scrollState);
  }

  return true;
}

export async function refreshApplication(app) {
  if (!app?.rendered) return;
  if (typeof app.refresh === "function") {
    await app.refresh();
    return;
  }
  app.render(false);
}

export function getOpenGameWindow(gameId) {
  return openApps.get(gameId) ?? null;
}

export async function ensureGameWindow(gameId, { bringToTop = true } = {}) {
  const definition = getGameDefinition(gameId);
  if (!definition) return null;

  let app = getOpenGameWindow(gameId);
  if (app) {
    if (!app.rendered) {
      app.render(true);
      return app;
    }
    if (bringToTop && app.element?.length) app.bringToTop();
    return app;
  }

  app = attachAppLifecycle(gameId, definition.createApplication());
  openApps.set(gameId, app);
  app.render(true);
  return app;
}

export async function openGameForEveryone(gameId) {
  if (!game.user?.isGM) {
    notify("warn", "OnlyGM", {}, "Only the GM can open this game.");
    return;
  }

  const scene = requireCurrentScene();
  if (!scene) return;

  const definition = getGameDefinition(gameId);
  if (!definition) {
    console.warn(`${MODULE_ID} | unknown game id ${gameId}`);
    return;
  }

  let state = clone(getGameState(gameId, scene) ?? definition.createInitialState());
  if (typeof definition.syncDefaultPlayers === "function") {
    await definition.syncDefaultPlayers(state);
  } else {
    await definition.ensureDefaultPlayers?.(state);
  }

  const visiblePlayers = Object.entries(state.players ?? {}).filter(([actorId]) => !state.excludedPlayers?.[actorId]);
  if (!visiblePlayers.length && typeof definition.ensureDefaultPlayers === "function") {
    console.warn(`${MODULE_ID} | no visible players after sync for ${gameId}, clearing exclusions and rebuilding defaults`);
    state.excludedPlayers = {};
    state.players = {};
    await definition.ensureDefaultPlayers(state);
  }

  console.groupCollapsed(`${MODULE_ID} | openGameForEveryone ${gameId}`);
  console.table(Object.entries(state.players ?? {}).map(([actorId, playerData]) => ({
    actorId,
    name: playerData.name,
    source: playerData.source ?? "",
    excluded: Boolean(state.excludedPlayers?.[actorId]),
    participating: Boolean(playerData.isParticipating),
  })));
  console.groupEnd();

  state.openSignal = Date.now();
  await saveGameState(gameId, state, scene);
  seenOpenSignals.set(gameId, state.openSignal);
  const app = await ensureGameWindow(gameId);
  await refreshApplication(app);
}

export async function requestGameAction(gameId, action, data = {}) {
  const payload = {
    moduleId: MODULE_ID,
    action: SOCKET_ACTIONS.playerAction,
    senderId: game.user?.id ?? null,
    payload: {
      gameId,
      action,
      data,
    },
  };

  if (game.user?.isGM) {
    await processGameAction(payload);
    return;
  }

  game.socket?.emit(SOCKET_CHANNEL, payload);
}

async function processGameAction(message) {
  if (!game.user?.isGM) return;
  if (message?.action !== SOCKET_ACTIONS.playerAction) return;

  const payload = message.payload ?? {};
  const definition = getGameDefinition(payload.gameId);
  const scene = requireCurrentScene();
  if (!definition || !scene) return;

  const state = clone(getGameState(payload.gameId, scene) ?? definition.createInitialState());
  const changed = await definition.handleAction({
    action: payload.action,
    data: payload.data ?? {},
    scene,
    senderId: message.senderId ?? null,
    state,
    canUserControlActor,
  });

  if (changed) {
    await saveGameState(payload.gameId, state, scene);
    const app = getOpenGameWindow(payload.gameId);
    await refreshApplication(app);
  }
}

function handleSceneUpdate(scene, change) {
  for (const definition of getRegisteredGames()) {
    const path = `flags.${MODULE_ID}.${gameFlagKey(definition.id)}`;
    if (!foundry.utils.hasProperty(change, path)) continue;

    const state = scene.getFlag(MODULE_ID, gameFlagKey(definition.id)) ?? null;
    const openSignal = state?.openSignal ?? null;
    const app = getOpenGameWindow(definition.id);

    if (app?.rendered) {
      void refreshApplication(app);
    }

    if (openSignal && seenOpenSignals.get(definition.id) !== openSignal) {
      seenOpenSignals.set(definition.id, openSignal);
      if (!app?.rendered) void ensureGameWindow(definition.id, { bringToTop: false });
    }
  }
}

function registerSocket() {
  if (!game.socket) return;
  game.socket.on(SOCKET_CHANNEL, (message) => {
    if (!message || message.moduleId !== MODULE_ID) return;
    if (message.senderId && message.senderId === game.user?.id) return;
    void processGameAction(message);
  });
}

function getCompendiumFolderParentId(folder) {
  return folder?.parent?.id ?? folder?.folder ?? null;
}

function isCompendiumFolder(folder) {
  return folder?.type === "Compendium";
}

async function ensureModuleCompendiumFolderStructure() {
  if (!game.user?.isGM) return;

  try {
    const pack = game.packs?.get(MODULE_COMPENDIUM_ID);
    const folders = game.packs?.folders;
    if (!pack || !folders) return;

    let rootFolder = folders.find((folder) => (
      isCompendiumFolder(folder)
      && folder.name === MODULE_COMPENDIUM_ROOT_FOLDER
      && !getCompendiumFolderParentId(folder)
    ));

    if (!rootFolder) {
      rootFolder = await Folder.create({
        name: MODULE_COMPENDIUM_ROOT_FOLDER,
        type: "Compendium",
        folder: null,
        sorting: "m",
        color: null,
      });
    }

    const previousFolder = pack.folder;
    if (pack.folder?.id !== rootFolder.id) {
      await pack.setFolder(rootFolder);
    }

    const previousFolderWasLegacyChild = previousFolder
      && previousFolder.id !== rootFolder.id
      && isCompendiumFolder(previousFolder)
      && getCompendiumFolderParentId(previousFolder) === rootFolder.id;

    const shouldDeletePreviousFolder = previousFolderWasLegacyChild
      && !previousFolder.contents?.length
      && !previousFolder.getSubfolders?.(false)?.length;

    if (shouldDeletePreviousFolder) {
      await previousFolder.delete();
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | failed to ensure compendium folder structure`, error);
  }
}

async function syncModuleMacroCompendiumMetadata() {
  if (!game.user?.isGM) return;

  const pack = game.packs?.get(MODULE_COMPENDIUM_ID);
  if (!pack) return;

  const index = await pack.getIndex({ fields: ["img"] });
  const updates = [];

  for (const [id, img] of Object.entries(MODULE_MACRO_ICON_UPDATES)) {
    const entry = index.get(id);
    if (!entry || entry.img === img) continue;
    updates.push({ _id: id, img });
  }

  if (!updates.length) return;

  const wasLocked = Boolean(pack.locked);

  try {
    if (wasLocked) await pack.configure({ locked: false });
    await pack.documentClass.updateDocuments(updates, { pack: pack.collection });
    console.log(`${MODULE_ID} | updated macro icons in ${MODULE_COMPENDIUM_ID}`, updates);
  } catch (error) {
    console.warn(`${MODULE_ID} | failed to update macro icons in ${MODULE_COMPENDIUM_ID}`, error);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

export function buildModuleApi() {
  return {
    openGame: openGameForEveryone,
    getGameState,
    requestGameAction,
    games: Object.fromEntries(getRegisteredGames().map((definition) => [definition.id, definition])),
  };
}

function installModuleApi() {
  const mod = game.modules?.get(MODULE_ID);
  if (!mod) return null;
  mod.api = buildModuleApi();
  return mod.api;
}

export function initializeModuleRuntime() {
  installModuleApi();
  Hooks.once("init", installModuleApi);
  Hooks.once("setup", installModuleApi);

  Hooks.once("ready", () => {
    installModuleApi();
    registerSocket();
    void ensureModuleCompendiumFolderStructure();
    void syncModuleMacroCompendiumMetadata();
    Hooks.on("updateScene", handleSceneUpdate);
    for (const definition of getRegisteredGames()) {
      seenOpenSignals.set(definition.id, getGameState(definition.id)?.openSignal ?? null);
    }
  });
}
