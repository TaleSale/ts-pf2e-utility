import { positionButton, positionInteractionButtons } from "./hotbar-interactions.js?v=20261006-instruments-v2";
import { createLinkedLight, IMMERSIVE_TORCH_HOLDER_FLAG_KEY, LIGHT_PRESETS } from "./scene-assets.js?v=20261006-fog-soft-boundary-v104";
import { resolvePresetTexture } from "./texture-presets.js?v=20261006-fog-soft-boundary-v104";

const MODULE_ID = "ts-pf2e-utility";
const FLAG_KEY = "lightSwitch";
const STATE_FLAG_KEY = "lightSwitchState";
const SCENE_ASSET_FLAG_KEY = "sceneAsset";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const SOCKET_TYPE = "toggleLightSwitch";
const HOLDER_SOCKET_TYPE = "immersiveTorchHolder";
const BUTTON_ID = "tsu-light-switch";
const HOLDER_BUTTON_ID = "tsu-light-holder-action";
const HOLDER_ITEM_UUIDS = Object.freeze({
  torch: "Compendium.pf2e.equipment-srd.Item.8Jdw4yAzWYylGePS",
  "everlight-crystal": "Compendium.pf2e.equipment-srd.Item.mRz8Jmk4Q06SsZpC",
  "evercursed-crystal": "Compendium.pf2e.equipment-srd.Item.lfrhhbTG1nf0fNAQ",
});
const HOLDER_ASSETS = Object.freeze({
  empty: Object.freeze({ key: "sideWallTorchHolderEmpty", path: "scene-assets/side-wall-torch-holder-empty-topdown-v1.webp", preset: "torch" }),
  torch: Object.freeze({ key: "sideWallTorch", path: "scene-assets/side-wall-torch-holder-torch-topdown-v1.webp", preset: "torch" }),
  "everlight-crystal": Object.freeze({ key: "sideWallTorchHolderCrystal", path: "scene-assets/side-wall-torch-holder-crystal-topdown-v1.webp", preset: "everlight" }),
  "evercursed-crystal": Object.freeze({ key: "sideWallTorchHolderCursedCrystal", path: "scene-assets/side-wall-torch-holder-crystal-topdown-v1.webp", preset: "everlight" }),
});
let positionGeneration = 0;
let primaryControlledTokenId = null;
let refreshFrame = null;
let refreshTimer = null;

const HOLDER_KIND_BY_ASSET_KEY = Object.freeze({
  sideWallTorch: "torch",
  sideWallTorchHolderTorch: "torch",
  sideWallTorchHolderEmpty: null,
  sideWallTorchHolderCrystal: "everlight-crystal",
  sideWallTorchHolderCursedCrystal: "evercursed-crystal",
});

function htmlRoot(element) {
  return element instanceof HTMLElement ? element : element?.[0] ?? null;
}

function label(key) {
  const russian = String(game.i18n?.lang ?? "").toLowerCase().startsWith("ru");
  const labels = {
    config: russian ? "Включатель света" : "Light switch",
    hint: russian
      ? "Персонажи могут включать и выключать этот свет, находясь в его клетке."
      : "Characters can toggle this light while standing in its grid space.",
    on: russian ? "Включить свет" : "Turn light on",
    off: russian ? "Выключить свет" : "Turn light off",
    insert: russian ? "Вставить предмет" : "Insert item",
    take: russian ? "Забрать предмет" : "Take item",
    holderSlot: russian ? "Слот подставки" : "Holder slot",
    empty: russian ? "Пусто" : "Empty",
    torch: russian ? "Факел" : "Torch",
    crystal: russian ? "Кристалл вечного света" : "Everlight Crystal",
    cursedCrystal: russian ? "Вечнопроклятый кристалл ⚠" : "Evercursed Crystal ⚠",
  };
  return labels[key];
}

function isSwitch(light) {
  const value = light?.getFlag?.(MODULE_ID, FLAG_KEY);
  return value === true || value === "true" || value === 1;
}

function holderState(light) {
  return light?.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY]?.[IMMERSIVE_TORCH_HOLDER_FLAG_KEY] ?? null;
}

function isHolder(light) {
  return holderState(light) !== null;
}

function sceneGrid(scene) {
  return canvas?.scene === scene && canvas?.grid ? canvas.grid : scene?.grid;
}

function gridCell(scene, point) {
  const grid = sceneGrid(scene);
  if (typeof grid?.getOffset === "function") return grid.getOffset({
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
  });
  const size = Number(scene?.grid?.size) || 100;
  return {i: Math.floor(Number(point?.y ?? 0) / size), j: Math.floor(Number(point?.x ?? 0) / size)};
}

function tokenOccupiesCell(token, cell) {
  const scene = token?.parent;
  if (!scene || token.hidden) return false;
  const grid = sceneGrid(scene);
  const pixelSize = token.getSize?.() ?? {
    width: (Number(token.width) || 1) * (Number(scene.grid?.size) || 100),
    height: (Number(token.height) || 1) * (Number(scene.grid?.size) || 100),
  };
  if (typeof grid?.getOffsetRange === "function") {
    const [i0, j0, i1, j1] = grid.getOffsetRange({
      x: Number(token.x ?? 0),
      y: Number(token.y ?? 0),
      width: pixelSize.width,
      height: pixelSize.height,
    });
    return cell.i >= i0 && cell.i < i1 && cell.j >= j0 && cell.j < j1;
  }

  const topLeft = gridCell(scene, token);
  const width = Math.max(1, Math.ceil(pixelSize.width / (Number(scene.grid?.size) || 100)));
  const height = Math.max(1, Math.ceil(pixelSize.height / (Number(scene.grid?.size) || 100)));
  return cell.i >= topLeft.i && cell.i < topLeft.i + height
    && cell.j >= topLeft.j && cell.j < topLeft.j + width;
}

function relevantTokens(user, scene) {
  if (user?.id !== game.user?.id || canvas?.scene !== scene) return [];
  const controlled = canvas.tokens?.controlled ?? [];
  const primary = controlled.find((token) => token.id === primaryControlledTokenId);
  const ordered = primary
    ? [primary, ...controlled.filter((token) => token !== primary)]
    : controlled;
  return ordered.map((token) => token.document);
}

function userMayUseLight(user, light) {
  if (!user || !light?.parent || (!isSwitch(light) && !isHolder(light))) return false;
  const cell = gridCell(light.parent, light);
  return relevantTokens(user, light.parent).some((token) => tokenOccupiesCell(token, cell));
}

function tokenUsingLight(user, light) {
  if (!user || !light?.parent || (!isSwitch(light) && !isHolder(light))) return null;
  const cell = gridCell(light.parent, light);
  return relevantTokens(user, light.parent).find((token) => tokenOccupiesCell(token, cell)) ?? null;
}

function availableLights(user = game.user) {
  const scene = canvas?.scene;
  if (!scene || !canvas?.ready) return [];
  return (scene.lights?.contents ?? []).filter((light) => userMayUseLight(user, light));
}

function lightIsOff(light) {
  return light?.getFlag?.(MODULE_ID, STATE_FLAG_KEY)?.off === true;
}

async function toggleLight(light) {
  const state = light.getFlag(MODULE_ID, STATE_FLAG_KEY) ?? {};
  if (state.off === true) {
    await light.update({
      "config.dim": Math.max(0, Number(state.dim) || 0),
      "config.bright": Math.max(0, Number(state.bright) || 0),
      [`flags.${MODULE_ID}.${STATE_FLAG_KEY}`]: {...state, off: false},
    });
    return;
  }
  await light.update({
    hidden: false,
    "config.dim": 0,
    "config.bright": 0,
    [`flags.${MODULE_ID}.${STATE_FLAG_KEY}`]: {
      off: true,
      dim: Math.max(0, Number(light.config?.dim) || 0),
      bright: Math.max(0, Number(light.config?.bright) || 0),
    },
  });
}

async function recoverPreviouslyHiddenSwitches() {
  if (!game.user?.isGM) return;
  for (const scene of game.scenes ?? []) {
    for (const light of scene.lights?.contents ?? []) {
      if (!isSwitch(light) || !light.hidden) continue;
      const state = light.getFlag(MODULE_ID, STATE_FLAG_KEY) ?? {};
      await light.update({
        hidden: false,
        "config.dim": 0,
        "config.bright": 0,
        [`flags.${MODULE_ID}.${STATE_FLAG_KEY}`]: {
          ...state,
          off: true,
          dim: Number(state.dim ?? light.config?.dim) || 0,
          bright: Number(state.bright ?? light.config?.bright) || 0,
        },
      });
    }
  }
}

function scheduleButtonPosition(button) {
  const generation = ++positionGeneration;
  const place = () => {
    if (generation === positionGeneration && button.isConnected) positionInteractionButtons();
  };
  requestAnimationFrame(place);
  for (const delay of [80, 250, 650, 1250, 2600]) window.setTimeout(place, delay);
}

function refreshButton() {
  const existing = document.getElementById(BUTTON_ID);
  const existingHolder = document.getElementById(HOLDER_BUTTON_ID);
  const lights = availableLights();
  if (!lights.length) {
    existing?.remove();
    existingHolder?.remove();
    positionInteractionButtons();
    return;
  }

  const light = lights.find(isHolder) ?? lights[0];
  let positionAnchor = null;
  if (isSwitch(light)) {
    const off = lightIsOff(light);
    const title = label(off ? "on" : "off");
    const button = existing ?? document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = off ? "off" : "on";
    button.dataset.lightId = light.id;
    button.disabled = false;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<i class="${off ? "fa-regular" : "fa-solid"} fa-lightbulb"></i>`;
    if (!existing) button.addEventListener("click", requestToggle);
    positionButton(button);
    positionAnchor = button;
  } else {
    existing?.remove();
  }

  if (isHolder(light)) {
    const occupied = Boolean(holderState(light)?.kind);
    const title = label(occupied ? "take" : "insert");
    const button = existingHolder ?? document.createElement("button");
    button.id = HOLDER_BUTTON_ID;
    button.type = "button";
    button.className = occupied ? "occupied" : "empty";
    button.dataset.lightId = light.id;
    button.disabled = false;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<i class="fa-solid ${occupied ? "fa-hand" : "fa-arrow-right-to-bracket"}"></i>`;
    if (!existingHolder) button.addEventListener("click", requestHolderAction);
    positionButton(button);
    positionAnchor ??= button;
  } else {
    existingHolder?.remove();
  }
  positionInteractionButtons();
  if (positionAnchor) scheduleButtonPosition(positionAnchor);
}

function queueButtonRefresh() {
  if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = null;
    refreshButton();
  });
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    refreshButton();
  }, 80);
}

function activeGmId() {
  return game.users?.find((user) => user.active && user.isGM)?.id ?? null;
}

async function migrateSideWallTorchHolders() {
  if (!game.user?.isGM || activeGmId() !== game.user.id) return;
  for (const scene of game.scenes ?? []) {
    for (const tile of scene.tiles?.contents ?? []) {
      const assetState = tile.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY];
      if (!assetState || !Object.hasOwn(HOLDER_KIND_BY_ASSET_KEY, assetState.key)) continue;
      const kind = HOLDER_KIND_BY_ASSET_KEY[assetState.key];
      const savedHolder = assetState[IMMERSIVE_TORCH_HOLDER_FLAG_KEY];
      let light = (assetState.lightId ? scene.lights?.get(assetState.lightId) : null)
        ?? scene.lights?.contents?.find((candidate) => (
          candidate.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY]?.tileId === tile.id
        ))
        ?? null;
      const desiredKey = HOLDER_ASSETS[kind ?? "empty"].key;
      const needsMigration = savedHolder === undefined
        || assetState.key !== desiredKey
        || !light
        || holderState(light) === null;
      if (!needsMigration) continue;

      if (savedHolder === undefined) {
        await tile.update({
          [`flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}`]: { kind, itemSource: null },
        });
      }
      if (!light) {
        await createLinkedLight(tile, HOLDER_ASSETS[kind ?? "empty"].preset);
        const lightId = tile.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY]?.lightId;
        light = lightId ? scene.lights?.get(lightId) : null;
      }
      if (!light) continue;
      await configureHolder(tile, light, kind, savedHolder?.itemSource ?? null, {
        torchLit: kind === "torch" ? !lightIsOff(light) : true,
      });
    }
  }
}

function holderTile(light) {
  const tileId = light?.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY]?.tileId;
  return tileId ? light.parent?.tiles?.get(tileId) ?? null : null;
}

function inventoryItemKind(item) {
  const slug = String(item?.slug ?? item?.system?.slug ?? "").toLowerCase();
  if (slug === "torch") return "torch";
  if (slug === "everlight-crystal") return "everlight-crystal";
  if (slug === "evercursed-crystal") return "evercursed-crystal";
  return null;
}

function eligibleHolderItems(actor) {
  return [...(actor?.items ?? [])]
    .filter((item) => inventoryItemKind(item) && Math.max(0, Number(item.system?.quantity ?? 1)) > 0)
    .sort((left, right) => Number(right.system?.equipped?.carryType === "held") - Number(left.system?.equipped?.carryType === "held"));
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

async function chooseHolderItemKind(actor) {
  const kinds = [...new Set(eligibleHolderItems(actor).map(inventoryItemKind))];
  if (!kinds.length) return null;
  if (kinds.length === 1) return kinds[0];
  const names = {
    torch: label("torch"),
    "everlight-crystal": label("crystal"),
    "evercursed-crystal": label("cursedCrystal"),
  };
  const content = `<label>${escapeHtml(label("holderSlot"))}<select name="kind">${kinds.map((kind) => `<option value="${kind}">${escapeHtml(names[kind])}</option>`).join("")}</select></label>`;
  if (foundry.applications?.api?.DialogV2?.prompt) return foundry.applications.api.DialogV2.prompt({
    window: { title: label("insert") },
    content,
    ok: { callback: (_event, button) => button.form.elements.kind.value },
  });
  return kinds[Number(window.prompt(kinds.map((kind, index) => `${index + 1}. ${names[kind]}`).join("\n"), "1")) - 1] ?? null;
}

function torchIsLit(itemOrSource) {
  return (itemOrSource?.system?.rules ?? []).some((rule) => rule.key === "RollOption" && rule.option === "lit-torch" && rule.value === true);
}

function setTorchLit(source, lit) {
  const rule = (source?.system?.rules ?? []).find((candidate) => candidate.key === "RollOption" && candidate.option === "lit-torch");
  if (rule) rule.value = Boolean(lit);
}

function oneItemSource(item) {
  const source = foundry.utils.deepClone(item.toObject());
  delete source._id;
  source.system ??= {};
  source.system.quantity = 1;
  return source;
}

async function consumeOneItem(item) {
  const quantity = Math.max(1, Math.trunc(Number(item.system?.quantity ?? 1) || 1));
  if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
  else await item.delete();
}

async function defaultItemSource(kind) {
  const item = await fromUuid(HOLDER_ITEM_UUIDS[kind]);
  if (!item) throw new Error(`Не найден предмет для ${kind}.`);
  return oneItemSource(item);
}

function holderDocumentState(tile) {
  return tile?.flags?.[MODULE_ID]?.[SCENE_ASSET_FLAG_KEY]?.[IMMERSIVE_TORCH_HOLDER_FLAG_KEY] ?? null;
}

async function configureHolder(tile, light, kind, itemSource = null, { torchLit = true } = {}) {
  const asset = HOLDER_ASSETS[kind ?? "empty"];
  const preset = LIGHT_PRESETS[asset.preset];
  const off = kind === null || (kind === "torch" && !torchLit);
  const source = `modules/${MODULE_ID}/images/${asset.path}`;
  await tile.update({
    "texture.src": resolvePresetTexture(source, null, tile.parent),
    [`flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.key`]: asset.key,
    [`flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}`]: { kind, itemSource },
  });
  await light.update({
    "config.color": preset.color,
    "config.alpha": preset.alpha,
    "config.angle": preset.angle,
    "config.negative": preset.negative,
    "config.animation": foundry.utils.deepClone(preset.animation),
    "config.bright": off ? 0 : preset.bright,
    "config.dim": off ? 0 : preset.dim,
    [`flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.preset`]: asset.preset,
    [`flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}`]: { kind },
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: kind === "torch",
    ...(off ? {
      [`flags.${MODULE_ID}.${STATE_FLAG_KEY}`]: { off: true, bright: preset.bright, dim: preset.dim },
    } : {
      [`flags.${MODULE_ID}.-=${STATE_FLAG_KEY}`]: null,
    }),
  });
}

async function insertIntoHolder(light, token, kind) {
  const actor = token.actor;
  const tile = holderTile(light);
  if (!actor || !tile || holderDocumentState(tile)?.kind) return;
  const item = eligibleHolderItems(actor).find((candidate) => inventoryItemKind(candidate) === kind);
  if (!item) throw new Error("Подходящий предмет больше не найден в инвентаре.");
  const source = oneItemSource(item);
  const lit = kind === "torch" ? torchIsLit(item) : true;
  await consumeOneItem(item);
  try {
    await configureHolder(tile, light, kind, source, { torchLit: lit });
  } catch (error) {
    await actor.createEmbeddedDocuments("Item", [source]);
    throw error;
  }
}

async function takeFromHolder(light, token) {
  const actor = token.actor;
  const tile = holderTile(light);
  const state = holderDocumentState(tile);
  const kind = state?.kind;
  if (!actor || !tile || !kind) return;
  const source = foundry.utils.deepClone(state.itemSource ?? await defaultItemSource(kind));
  delete source._id;
  source.system ??= {};
  source.system.quantity = 1;
  source.system.containerId = null;
  source.system.equipped = { ...(source.system.equipped ?? {}), carryType: "held", handsHeld: 1 };
  if (kind === "torch") setTorchLit(source, !lightIsOff(light));
  const [created] = await actor.createEmbeddedDocuments("Item", [source]);
  try {
    await configureHolder(tile, light, null, null, { torchLit: false });
  } catch (error) {
    if (created) await actor.deleteEmbeddedDocuments("Item", [created.id]);
    throw error;
  }
}

async function requestHolderAction(event) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const light = canvas?.scene?.lights?.get(button.dataset.lightId);
  const token = light ? tokenUsingLight(game.user, light) : null;
  if (!light || !token || !isHolder(light)) return refreshButton();
  const occupied = Boolean(holderState(light)?.kind);
  const kind = occupied ? null : await chooseHolderItemKind(token.actor);
  if (!occupied && !kind) {
    ui.notifications?.warn("В инвентаре нет факела или кристалла вечного света.");
    return refreshButton();
  }
  button.disabled = true;
  try {
    if (game.user.isGM) {
      if (occupied) await takeFromHolder(light, token);
      else await insertIntoHolder(light, token, kind);
    } else {
      const gmId = activeGmId();
      if (!gmId) ui.notifications?.warn("Для взаимодействия с подставкой нужен активный Мастер.");
      else game.socket?.emit(SOCKET_CHANNEL, {
        type: HOLDER_SOCKET_TYPE, gmId, userId: game.user.id,
        sceneId: light.parent.id, lightId: light.id, tokenId: token.id,
        action: occupied ? "take" : "insert", kind,
      });
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Не удалось взаимодействовать с подставкой`, error);
    ui.notifications?.error(`Не удалось взаимодействовать с подставкой: ${error.message}`);
  }
  window.setTimeout(refreshButton, 250);
}

async function requestToggle(event) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const light = canvas?.scene?.lights?.get(button.dataset.lightId);
  const token = light ? tokenUsingLight(game.user, light) : null;
  if (!light || !token) {
    return refreshButton();
  }

  button.disabled = true;
  try {
    if (game.user.isGM) {
      await toggleLight(light);
    } else {
      const gmId = activeGmId();
      if (!gmId) ui.notifications?.warn("Для переключения света нужен активный Мастер.");
      else game.socket?.emit(SOCKET_CHANNEL, {
        type: SOCKET_TYPE,
        gmId,
        userId: game.user.id,
        sceneId: light.parent.id,
        lightId: light.id,
        tokenId: token.id,
      });
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Не удалось переключить свет`, error);
    ui.notifications?.error(`Не удалось переключить свет: ${error.message}`);
  }
  window.setTimeout(refreshButton, 250);
}

async function handleSocket(message) {
  if (![SOCKET_TYPE, HOLDER_SOCKET_TYPE].includes(message?.type) || !game.user.isGM || message.gmId !== game.user.id) return;
  const user = game.users?.get(message.userId);
  const scene = game.scenes?.get(message.sceneId);
  const light = scene?.lights?.get(message.lightId);
  const token = scene?.tokens?.get(message.tokenId);
  const ownsToken = token?.actor?.testUserPermission?.(user, "OWNER")
    || token?.actorId === user?.character?.id;
  const lightCell = light ? gridCell(scene, light) : null;
  const validTarget = message.type === SOCKET_TYPE ? isSwitch(light) : isHolder(light);
  if (!user?.active || !light || !token || !ownsToken || !validTarget || !tokenOccupiesCell(token, lightCell)) return;
  try {
    if (message.type === SOCKET_TYPE) {
      await toggleLight(light);
    } else if (message.action === "take" && holderState(light)?.kind) {
      await takeFromHolder(light, token);
    } else if (message.action === "insert" && !holderState(light)?.kind && Object.hasOwn(HOLDER_ITEM_UUIDS, message.kind)) {
      await insertIntoHolder(light, token, message.kind);
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Не удалось выполнить запрос игрока для источника света`, error);
  }
}

Hooks.on("renderAmbientLightConfig", (app, element) => {
  if (!game.user.isGM) return;
  const root = htmlRoot(app.element) ?? htmlRoot(element);
  const basicTab = root?.matches?.('section.tab[data-tab="basic"]')
    ? root
    : root?.querySelector?.('section.tab[data-tab="basic"]');
  if (!basicTab || basicTab.querySelector(".tsu-light-switch-config")) return;

  const group = document.createElement("div");
  group.className = "form-group tsu-light-switch-config";
  group.innerHTML = `
    <label>${label("config")}</label>
    <div class="form-fields">
      <input type="checkbox" name="flags.${MODULE_ID}.${FLAG_KEY}" value="true" ${isSwitch(app.document) ? "checked" : ""} ${isHolder(app.document) && holderState(app.document)?.kind !== "torch" ? "disabled" : ""}>
    </div>
    <p class="hint">${label("hint")}</p>`;
  basicTab.append(group);
  if (isHolder(app.document)) {
    const kind = holderState(app.document)?.kind ?? "";
    const slot = document.createElement("div");
    slot.className = "form-group tsu-light-holder-slot-config";
    slot.innerHTML = `
      <label>${label("holderSlot")}</label>
      <div class="form-fields">
        <select name="flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}.kind">
          <option value="" ${kind === "" ? "selected" : ""}>${label("empty")}</option>
          <option value="torch" ${kind === "torch" ? "selected" : ""}>${label("torch")}</option>
          <option value="everlight-crystal" ${kind === "everlight-crystal" ? "selected" : ""}>${label("crystal")}</option>
          <option value="evercursed-crystal" ${kind === "evercursed-crystal" ? "selected" : ""}>${label("cursedCrystal")}</option>
        </select>
      </div>`;
    group.after(slot);
  }
  app.setPosition?.({ height: "auto" });
});

Hooks.once("ready", () => {
  game.socket?.on(SOCKET_CHANNEL, handleSocket);
  void recoverPreviouslyHiddenSwitches();
  void migrateSideWallTorchHolders().catch((error) => {
    console.error(`${MODULE_ID} | Не удалось обновить боковые настенные факелы`, error);
  });
});
Hooks.on("canvasReady", refreshButton);
Hooks.on("renderHotbar", refreshButton);
Hooks.on("controlToken", (token, controlled) => {
  if (controlled) primaryControlledTokenId = token.id;
  else if (primaryControlledTokenId === token.id) primaryControlledTokenId = null;
  queueButtonRefresh();
});
Hooks.on("createToken", queueButtonRefresh);
Hooks.on("deleteToken", queueButtonRefresh);
Hooks.on("refreshToken", queueButtonRefresh);
Hooks.on("updateToken", (_token, changed) => {
  if (["x", "y", "width", "height", "hidden", "actorId"].some((key) => key in changed)) queueButtonRefresh();
});
Hooks.on("createAmbientLight", refreshButton);
Hooks.on("deleteAmbientLight", refreshButton);
Hooks.on("updateAmbientLight", (light, changed) => {
  refreshButton();
  if (!game.user?.isGM || !isHolder(light)) return;
  const path = `flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}.kind`;
  const requested = foundry.utils.getProperty(changed, path) ?? changed[path];
  if (requested === undefined) return;
  const kind = String(requested || "") || null;
  const tile = holderTile(light);
  if (!tile || holderDocumentState(tile)?.kind === kind) return;
  void configureHolder(tile, light, kind, null, { torchLit: kind === "torch" }).catch((error) => {
    console.error(`${MODULE_ID} | Не удалось применить слот подставки`, error);
  });
});
Hooks.on("updateTile", (tile, changed) => {
  if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.${IMMERSIVE_TORCH_HOLDER_FLAG_KEY}`)
      || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${SCENE_ASSET_FLAG_KEY}.lightId`)) queueButtonRefresh();
});
