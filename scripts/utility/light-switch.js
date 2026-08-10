const MODULE_ID = "ts-pf2e-utility";
const FLAG_KEY = "lightSwitch";
const STATE_FLAG_KEY = "lightSwitchState";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const SOCKET_TYPE = "toggleLightSwitch";
const BUTTON_ID = "tsu-light-switch";
const REBELLION_SLOT_ID = "rebellion-extra-hotbar-slot-11";
let positionGeneration = 0;
let primaryControlledTokenId = null;
let refreshFrame = null;
let refreshTimer = null;

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
  };
  return labels[key];
}

function isSwitch(light) {
  const value = light?.getFlag?.(MODULE_ID, FLAG_KEY);
  return value === true || value === "true" || value === 1;
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
  if (user?.id === game.user?.id && canvas?.scene === scene) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length) {
      const primary = controlled.find((token) => token.id === primaryControlledTokenId)
        ?? controlled.at(-1);
      return primary ? [primary.document] : [];
    }
  }

  const tokens = scene?.tokens?.contents ?? [];
  if (user?.character) {
    const characterTokens = tokens.filter((token) => token.actorId === user.character.id);
    if (characterTokens.length) return characterTokens;
  }
  if (user?.isGM) return [];
  return tokens.filter((token) => token.actor?.testUserPermission?.(user, "OWNER"));
}

function userMayUseLight(user, light) {
  if (!user || !light?.parent || !isSwitch(light)) return false;
  const cell = gridCell(light.parent, light);
  return relevantTokens(user, light.parent).some((token) => tokenOccupiesCell(token, cell));
}

function tokenUsingLight(user, light) {
  if (!user || !light?.parent || !isSwitch(light)) return null;
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

function localBox(element, ancestor) {
  let left = 0;
  let top = 0;
  let current = element;
  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent;
  }
  if (current === ancestor) return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };

  const elementRect = element.getBoundingClientRect();
  const ancestorRect = ancestor.getBoundingClientRect();
  const scaleX = ancestorRect.width > 0 && ancestor.offsetWidth > 0
    ? ancestorRect.width / ancestor.offsetWidth
    : 1;
  const scaleY = ancestorRect.height > 0 && ancestor.offsetHeight > 0
    ? ancestorRect.height / ancestor.offsetHeight
    : 1;
  return {
    left: (elementRect.left - ancestorRect.left) / scaleX,
    top: (elementRect.top - ancestorRect.top) / scaleY,
    width: elementRect.width / scaleX,
    height: elementRect.height / scaleY,
  };
}

function positionButton(button) {
  const hotbar = document.getElementById("hotbar");
  const actionBar = hotbar?.querySelector("#action-bar");
  if (!(hotbar instanceof HTMLElement) || !(actionBar instanceof HTMLElement)) return;

  const normalSlots = [...hotbar.querySelectorAll("li[data-slot]")]
    .filter((slot) => slot.id !== REBELLION_SLOT_ID);
  const rebellionSlot = hotbar.querySelector(`#${REBELLION_SLOT_ID}`);
  const anchor = rebellionSlot
    ?? normalSlots.reduce((last, slot) => (
      Number(slot.dataset.slot) > Number(last?.dataset.slot ?? 0) ? slot : last
    ), null);
  if (!(anchor instanceof HTMLElement)) return;

  if (button.parentElement !== actionBar) actionBar.append(button);
  actionBar.style.position ||= "relative";
  actionBar.style.overflow = "visible";
  const box = localBox(anchor, actionBar);
  if (!box || box.width < 1 || box.height < 1) return;
  let left = box.left + box.width + 4;
  const controls = [...hotbar.querySelectorAll("button, li[data-slot], [role=button]")]
    .filter((element) => element instanceof HTMLElement && element !== button)
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
  for (const control of controls) {
    const controlBox = localBox(control, actionBar);
    if (controlBox) left = Math.max(left, controlBox.left + controlBox.width + 4);
  }
  button.style.left = `${Math.round(left + (game.user?.isGM ? 0 : 10))}px`;
  button.style.top = `${Math.round(box.top)}px`;
  button.style.width = `${Math.round(box.width)}px`;
  button.style.height = `${Math.round(box.height)}px`;
}

function scheduleButtonPosition(button) {
  const generation = ++positionGeneration;
  const place = () => {
    if (generation === positionGeneration && button.isConnected) positionButton(button);
  };
  requestAnimationFrame(place);
  for (const delay of [80, 250, 650, 1250, 2600]) window.setTimeout(place, delay);
}

function refreshButton() {
  const existing = document.getElementById(BUTTON_ID);
  const lights = availableLights();
  if (!lights.length) {
    existing?.remove();
    return;
  }

  const light = lights[0];
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
  if (!existing) {
    button.addEventListener("click", requestToggle);
  }
  positionButton(button);
  scheduleButtonPosition(button);
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
  if (message?.type !== SOCKET_TYPE || !game.user.isGM || message.gmId !== game.user.id) return;
  const user = game.users?.get(message.userId);
  const scene = game.scenes?.get(message.sceneId);
  const light = scene?.lights?.get(message.lightId);
  const token = scene?.tokens?.get(message.tokenId);
  const ownsToken = token?.actor?.testUserPermission?.(user, "OWNER")
    || token?.actorId === user?.character?.id;
  const lightCell = light ? gridCell(scene, light) : null;
  if (!user?.active || !light || !token || !ownsToken || !isSwitch(light)
    || !tokenOccupiesCell(token, lightCell)) return;
  try {
    await toggleLight(light);
  } catch (error) {
    console.error(`${MODULE_ID} | Не удалось переключить свет по запросу игрока`, error);
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
      <input type="checkbox" name="flags.${MODULE_ID}.${FLAG_KEY}" value="true" ${isSwitch(app.document) ? "checked" : ""}>
    </div>
    <p class="hint">${label("hint")}</p>`;
  basicTab.append(group);
  app.setPosition?.({ height: "auto" });
});

Hooks.once("ready", () => {
  game.socket?.on(SOCKET_CHANNEL, handleSocket);
  void recoverPreviouslyHiddenSwitches();
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
Hooks.on("updateAmbientLight", refreshButton);
