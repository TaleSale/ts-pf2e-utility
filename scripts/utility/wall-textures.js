import { MODULE_ID, i18nKey, t } from "../core.js";
import { resolvePresetTexture, TEXTURE_PRESET_CHANGE_HOOK } from "./texture-presets.js?v=20260829-warehouse-balance-v42";

const SETTING_ENABLE = "enableWallTextures";
const SETTING_DOOR_PRESETS = "enableDoorTexturePresets";
const I18N_ROOT = "Settings.WallTextures";
const DOOR_I18N_ROOT = "Settings.DoorTexturePresets";
const FLAG_ROOT = "wallTexture";
const DEFAULT_STYLE = "brick-grey-dense";
const DEFAULT_WINDOW_STYLE = "window-wood";
const DEFAULT_BORDER_STYLE = "border-wood-stone";
const WALL_TEXTURE_STYLE_ALIASES = Object.freeze({
  "grey-brick": DEFAULT_STYLE,
});
const WALL_TEXTURE_CONTAINER = "tsu-wall-textures";
const BORDER_TEXTURE_CONTAINER = "tsu-border-textures";
const DOOR_SWING_INDICATOR_CONTAINER = "tsu-door-swing-indicators";
const DOOR_SWING_INDICATOR_COLOR = 0xffffff;
const DOOR_SWING_INDICATOR_ALPHA = 0.2;
const DOOR_SWING_INDICATOR_OUTLINE_ALPHA = 0.75;
const DOOR_SWING_INDICATOR_LENGTH_RATIO = 0.4;
const TEXTURE_ASSET_BASE = `modules/${MODULE_ID}/images/scene-walls`;
const WALL_CONTROL_NAME = "walls";
const WALL_TEXTURE_TOOL = "tsu-wall-texture";
const BULK_PICKER_CLASS = "tsu-wall-texture-bulk-picker";
const BULK_SELECTION_DRAG_CLASS = "tsu-wall-texture-selection-drag";
const BULK_SELECTION_CONTAINER = "tsu-wall-texture-selection";
const SOURCE_TEXTURE_SIZE = 200;
const SOURCE_WALL_WIDTH = 60;
const WALL_WIDTH_GRID_RATIO = 0.2;
const ENDPOINT_MASK_REACH_RATIO = 3;
const SEGMENT_OVERLAY_TRIM_RATIO = 1;
const SHORT_SEGMENT_OVERLAY_ONLY_GRID_RATIO = 1.25;
const RIBBON_MITER_LIMIT_RATIO = 2.5;
const DEFAULT_RIBBON_BOUNDS = Object.freeze({ top: 70, bottom: 130 });
const DOOR_TEXTURE_ROOT = "canvas/doors";
// The server-side FilePicker browse API compares against path.extname(), so leading dots are required.
const DOOR_IMAGE_EXTENSIONS = Object.freeze([".avif", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);
let doorTextureFilesPromise = null;
const SEGMENT_SOURCE_FRAMES = Object.freeze({
  straight: Object.freeze({ x: 0, y: 70, width: 100, height: 60 }),
  straightLong: Object.freeze({ x: 0, y: 70, width: 200, height: 60 }),
});
const WINDOW_FRAME_HORIZONTAL_INSET = 5;
const OVERLAY_SOURCE_FRAMES = Object.freeze({
  corner: Object.freeze({
    frame: Object.freeze({ x: 69, y: 70, width: 131, height: 130 }),
    pivot: Object.freeze({ x: 31, y: 30 }),
  }),
  diag: Object.freeze({
    frame: Object.freeze({ x: 18, y: 70, width: 154, height: 113 }),
    pivot: Object.freeze({ x: 82, y: 30 }),
  }),
  joint: Object.freeze({
    frame: Object.freeze({ x: 32, y: 70, width: 137, height: 99 }),
    pivot: Object.freeze({ x: 68, y: 30 }),
  }),
});
const WALL_TEXTURE_STYLES = Object.freeze({
  [DEFAULT_STYLE]: {
    labelKey: `${I18N_ROOT}.Choices.BrickGreyDense`,
    fallback: "Brick - Dense grey",
    assets: Object.freeze({
      get straight() { return resolvePresetTexture(`${TEXTURE_ASSET_BASE}/brick-grey-dense.webp`); },
      get straightLong() { return resolvePresetTexture(`${TEXTURE_ASSET_BASE}/brick-grey-dense.webp`); },
      get diag() { return resolvePresetTexture(`${TEXTURE_ASSET_BASE}/brick-grey-dense.webp`); },
      get corner() { return resolvePresetTexture(`${TEXTURE_ASSET_BASE}/brick-grey-dense.webp`); },
      get joint() { return resolvePresetTexture(`${TEXTURE_ASSET_BASE}/brick-grey-dense.webp`); },
    }),
    ribbonBounds: DEFAULT_RIBBON_BOUNDS,
  },
  "brick-grey": createWallTextureStyle("BrickGrey", "Brick - Grey", "brick-grey.webp", 80, 116),
  "brick-red": createWallTextureStyle("BrickRed", "Brick - Red", "brick-red.webp", 84, 116),
  "metal-iron": createWallTextureStyle("MetalIron", "Metal - Iron", "metal-iron.png", 80, 121),
  "wood-nut": createWallTextureStyle("WoodNut", "Wood - Walnut", "wood-nut.png", 78, 122),
  "wood-alder": createWallTextureStyle("WoodAlder", "Wood - Alder", "wood-alder.png", 78, 122),
  "border-wood-stone": createWallTextureStyle("BorderWoodStone", "Border - Wood and stone", "border-wood-stone-v2.webp", 80, 120, I18N_ROOT, { borderOnly: true, widthRatio: 0.12 }),
  "border-green-fog": createWallTextureStyle("BorderGreenFog", "Border - Green fog", "border-green-fog-v7.webp", 30, 170, I18N_ROOT, { borderOnly: true, widthRatio: 0.96, smooth: true }),
  "border-curtain-red": createWallTextureStyle("BorderCurtainRed", "Curtain - dark red", "border-curtain-red.webp", 5, 195, I18N_ROOT, { borderOnly: true, widthRatio: 0.18, periodScale: 1.28, smooth: true, textureSize: 256 }),
  "border-curtain-blue": createWallTextureStyle("BorderCurtainBlue", "Curtain - muted blue", "border-curtain-blue.webp", 5, 195, I18N_ROOT, { borderOnly: true, widthRatio: 0.18, periodScale: 1.28, smooth: true, textureSize: 256 }),
  "border-curtain-gold": createWallTextureStyle("BorderCurtainGold", "Curtain - ochre", "border-curtain-gold.webp", 5, 195, I18N_ROOT, { borderOnly: true, widthRatio: 0.18, periodScale: 1.28, smooth: true, textureSize: 256 }),
  "hedge-maze": createWallTextureStyle("HedgeMaze", "Maze hedge", "hedge-maze.webp", 72, 128),
  "cliff-coastal": createWallTextureStyle("CliffCoastal", "Uneven coastal cliff", "cliff-coastal-stone-v3.webp", 63, 138, I18N_ROOT, { borderOnly: true, widthRatio: 0.14, periodScale: 1.5, smooth: true, textureSize: 200 }),
  "cliff-limestone": createWallTextureStyle("CliffLimestone", "Limestone coast cliff", "cliff-limestone.webp", 78, 122, I18N_ROOT, { borderOnly: true, widthRatio: 0.06, smooth: true }),
  "cliff-sandy": createWallTextureStyle("CliffSandy", "Sandy coast cliff", "cliff-sandy-v2.webp", 63, 138, I18N_ROOT, { borderOnly: true, widthRatio: 0.12, periodScale: 1.5, smooth: true, textureSize: 200 }),
  "cliff-volcanic": createWallTextureStyle("CliffVolcanic", "Volcanic coast cliff", "cliff-volcanic-v3.webp", 63, 138, I18N_ROOT, { borderOnly: true, widthRatio: 0.09, periodScale: 1, smooth: true, textureSize: 200 }),
});
const WINDOW_TEXTURE_STYLES = Object.freeze({
  "window-wood": createWallTextureStyle("WindowWood", "Window - Walnut", "window-wood.webp", 70, 130, "Settings.WindowTextures"),
  "window-iron": createWallTextureStyle("WindowIron", "Window - Iron", "window-iron.webp", 70, 130, "Settings.WindowTextures"),
  "window-stained": createWallTextureStyle("WindowStained", "Window - Stained glass", "window-stained.webp", 70, 130, "Settings.WindowTextures"),
  "arrow-slit-straight": createWallTextureStyle("ArrowSlitStraight", "Arrow slit - straight", "arrow-slit-straight-v4.svg", 82, 118, "Settings.WindowTextures", { arrowSlit: "straight" }),
  "arrow-slit-cross": createWallTextureStyle("ArrowSlitCross", "Arrow slit - splayed", "arrow-slit-splayed-v4.svg", 82, 118, "Settings.WindowTextures", { arrowSlit: "splayed" }),
});

function createWallTextureStyle(label, fallback, filename, ribbonTop, ribbonBottom, i18nRoot = I18N_ROOT, options = {}) {
  const asset = `${TEXTURE_ASSET_BASE}/${filename}`;
  return Object.freeze({
    labelKey: `${i18nRoot}.Choices.${label}`,
    fallback,
    assets: Object.freeze({
      get straight() { return resolvePresetTexture(asset); },
      get straightLong() { return resolvePresetTexture(asset); },
      get diag() { return resolvePresetTexture(asset); },
      get corner() { return resolvePresetTexture(asset); },
      get joint() { return resolvePresetTexture(asset); },
    }),
    ribbonBounds: Object.freeze({ top: ribbonTop, bottom: ribbonBottom }),
    ...options,
  });
}

let redrawTimeout = null;
let doorSwingIndicatorRedrawTimeout = null;
let bulkToolActive = false;
let bulkStageBound = null;
let bulkSelectionDrag = null;
const bulkSelectedWallIds = new Set();

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey(`${I18N_ROOT}.Name`),
    hint: i18nKey(`${I18N_ROOT}.Hint`),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      ui.controls?.render?.({ reset: true });
    },
  });

  game.settings.register(MODULE_ID, SETTING_DOOR_PRESETS, {
    name: i18nKey(`${DOOR_I18N_ROOT}.Name`),
    hint: i18nKey(`${DOOR_I18N_ROOT}.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });
});

Hooks.on(TEXTURE_PRESET_CHANGE_HOOK, () => {
  scheduleWallTextureRedraw();
  ui.controls?.render?.({ reset: true });
  renderBulkWallPicker(ui.controls?.element);
});

function bulkToolEnabled() {
  return Boolean(game.user?.isGM && game.settings.get(MODULE_ID, SETTING_ENABLE));
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!bulkToolEnabled()) return;
  const walls = controls.walls
    ?? Object.values(controls).find((group) => group?.layer === WALL_CONTROL_NAME || group?.layerName === WALL_CONTROL_NAME);
  if (!walls?.tools) return;
  walls.tools[WALL_TEXTURE_TOOL] = {
    name: WALL_TEXTURE_TOOL,
    order: 99,
    title: t("Settings.WallTextures.BulkTool", "Массовая текстура стен"),
    icon: "fa-solid fa-paint-roller",
    visible: true,
    onChange: (_event, active) => {
      if (active === false) deactivateBulkWallTool();
      else activateBulkWallTool();
    },
  };
});

Hooks.on("renderSceneControls", (_app, element) => {
  queueMicrotask(() => {
    const active = bulkToolEnabled()
      && isBulkWallControlActive()
      && isBulkWallToolSelected();
    if (active) activateBulkWallTool();
    else deactivateBulkWallTool();
    renderBulkWallPicker(element);
  });
});

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function scheduleApplicationAutoHeight(app) {
  if (typeof app?.setPosition !== "function") return;
  requestAnimationFrame(() => {
    const element = getElement(app?.element);
    if (!element?.isConnected) return;
    try {
      app.setPosition({ height: "auto" });
    } catch (_error) {
      // Foundry WallPalette can detach its position element during a render hook.
    }
  });
}

function bulkToolSelected() {
  return bulkToolActive
    && isBulkWallControlActive()
    && isBulkWallToolSelected();
}

function isBulkWallToolSelected() {
  return ui.controls?.tool?.name === WALL_TEXTURE_TOOL
    || document.querySelector(`#scene-controls [data-tool="${WALL_TEXTURE_TOOL}"]`)?.classList.contains("active");
}

function isBulkWallControlActive() {
  const control = ui.controls?.control;
  return control === WALL_CONTROL_NAME
    || control?.name === WALL_CONTROL_NAME
    || control?.layer === WALL_CONTROL_NAME
    || control?.layerName === WALL_CONTROL_NAME;
}

function activateBulkWallTool() {
  if (!bulkToolEnabled()) return;
  bulkToolActive = true;
  bindBulkStage();
  syncBulkWallSelection();
  renderBulkWallPicker(ui.controls?.element);
}

function deactivateBulkWallTool() {
  bulkToolActive = false;
  bulkSelectionDrag = null;
  clearBulkSelectionDrag();
  unbindBulkStage();
  drawBulkWallSelection();
  document.querySelector(`.${BULK_PICKER_CLASS}`)?.remove();
}

function bulkControlRoot(element) {
  return getElement(element) ?? document.querySelector("#scene-controls");
}

function bulkStyleEntries(mode) {
  const borderMode = mode === "border";
  return Object.entries(WALL_TEXTURE_STYLES)
    .filter(([, style]) => Boolean(style.borderOnly) === borderMode);
}

function bulkStyleLabel(style) {
  return t(style.labelKey, style.fallback);
}

function renderBulkWallPicker(element) {
  document.querySelector(`.${BULK_PICKER_CLASS}`)?.remove();
  if (!bulkToolSelected()) return;
  const root = bulkControlRoot(element);
  if (!root) return;

  const picker = document.createElement("section");
  picker.className = BULK_PICKER_CLASS;
  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = t("Settings.WallTextures.BulkTitle", "Текстура выбранных стен");
  const count = document.createElement("span");
  count.dataset.wallSelectionCount = "true";
  header.append(title, count);
  picker.append(header);

  const hint = document.createElement("p");
  hint.textContent = t("Settings.WallTextures.BulkHint", "Выделите стены кликом, Ctrl/Cmd или рамкой, затем выберите текстуру.");
  picker.append(hint);

  for (const [mode, labelKey, fallback] of [
    ["wall", "BulkWallMode", "Текстуры стен"],
    ["border", "BulkBorderMode", "Текстуры бордюров"],
  ]) {
    const details = document.createElement("details");
    details.className = "tsu-wall-bulk-group";
    details.open = mode === "wall";
    const summary = document.createElement("summary");
    summary.textContent = t(`Settings.WallTextures.${labelKey}`, fallback);
    const grid = document.createElement("div");
    grid.className = "tsu-wall-bulk-grid";
    for (const [styleKey, style] of bulkStyleEntries(mode)) {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "tsu-wall-bulk-choice";
      choice.dataset.style = styleKey;
      choice.dataset.mode = mode;
      choice.title = bulkStyleLabel(style);
      const preview = document.createElement("img");
      preview.src = style.assets.straightLong;
      preview.alt = "";
      const caption = document.createElement("span");
      caption.textContent = bulkStyleLabel(style);
      choice.append(preview, caption);
      choice.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void applyBulkWallTexture(mode, styleKey);
      });
      grid.append(choice);
    }
    details.append(summary, grid);
    picker.append(details);
  }

  const footer = document.createElement("footer");
  const disable = document.createElement("button");
  disable.type = "button";
  disable.className = "tsu-wall-bulk-disable";
  disable.title = t("Settings.WallTextures.BulkDisable", "Убрать текстуру с выбранных стен");
  disable.innerHTML = `<i class="fa-solid fa-eye-slash"></i><span>${t("Settings.WallTextures.BulkDisableShort", "Без текстуры")}</span>`;
  disable.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void applyBulkWallTexture(null, null, false);
  });
  footer.append(disable);
  picker.append(footer);
  document.body.append(picker);
  updateBulkWallPickerSummary();
  requestAnimationFrame(positionBulkWallPicker);
}

function updateBulkWallPickerSummary() {
  const count = document.querySelector(`.${BULK_PICKER_CLASS} [data-wall-selection-count]`);
  if (!count) return;
  count.textContent = t("Settings.WallTextures.BulkSelected", "Выбрано стен: {count}").replace("{count}", String(selectedBulkWallDocuments().length));
}

function positionBulkWallPicker() {
  const picker = document.querySelector(`.${BULK_PICKER_CLASS}`);
  if (!(picker instanceof HTMLElement) || !bulkToolSelected()) return;
  const anchor = document.querySelector(`#scene-controls [data-tool="${WALL_TEXTURE_TOOL}"]`)
    ?? Array.from(document.querySelectorAll("#scene-controls-tools .tool")).at(-1);
  if (!(anchor instanceof HTMLElement)) return;
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const maxLeft = Math.max(gap, window.innerWidth - picker.offsetWidth - gap);
  const maxTop = Math.max(gap, window.innerHeight - picker.offsetHeight - gap);
  picker.style.left = `${Math.min(Math.max(gap, rect.left), maxLeft)}px`;
  picker.style.top = `${Math.min(Math.max(gap, rect.bottom + gap), maxTop)}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(positionBulkWallPicker));

function bulkCanvasElement() {
  return document.getElementById("board")
    ?? canvas?.app?.canvas
    ?? canvas?.app?.renderer?.canvas
    ?? canvas?.app?.view;
}

function bindBulkStage() {
  const element = bulkCanvasElement();
  if (!(element instanceof HTMLElement) || bulkStageBound === element) return;
  unbindBulkStage();
  bulkStageBound = element;
  document.addEventListener("pointerdown", onBulkPointerDown, true);
  document.addEventListener("pointermove", onBulkPointerMove, true);
  document.addEventListener("pointerup", onBulkPointerUp, true);
  document.addEventListener("pointercancel", onBulkPointerUp, true);
}

function unbindBulkStage() {
  if (!bulkStageBound) return;
  document.removeEventListener("pointerdown", onBulkPointerDown, true);
  document.removeEventListener("pointermove", onBulkPointerMove, true);
  document.removeEventListener("pointerup", onBulkPointerUp, true);
  document.removeEventListener("pointercancel", onBulkPointerUp, true);
  bulkStageBound = null;
}

function bulkEventOnCanvas(event) {
  const element = bulkStageBound ?? bulkCanvasElement();
  return Boolean(element && (event.target === element || element.contains?.(event.target)));
}

function bulkEventPoint(event) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
    const element = bulkStageBound ?? bulkCanvasElement();
    const rectangle = element?.getBoundingClientRect?.();
    const screen = canvas?.app?.renderer?.screen;
    if (rectangle?.width && rectangle?.height && screen && canvas?.stage?.worldTransform) {
      const global = {
        x: (event.clientX - rectangle.left) * Number(screen.width) / rectangle.width,
        y: (event.clientY - rectangle.top) * Number(screen.height) / rectangle.height,
      };
      const local = canvas.stage.worldTransform.applyInverse(global);
      return { x: Number(local.x), y: Number(local.y) };
    }
  }
  const global = event?.global ?? event?.data?.global;
  if (!global || !canvas?.stage?.worldTransform) return null;
  const local = canvas.stage.worldTransform.applyInverse(global);
  return { x: Number(local.x), y: Number(local.y) };
}

function bulkWallPlaceables() {
  return (canvas?.walls?.placeables ?? []).filter((wall) => wall?.document);
}

function bulkWallDocument(placeable) {
  return placeable?.document ?? placeable;
}

function selectedBulkWallDocuments() {
  const stored = [...bulkSelectedWallIds]
    .map((id) => canvas?.scene?.walls?.get?.(id))
    .filter(Boolean);
  if (stored.length) return stored;
  const controlled = Array.from(canvas?.walls?.controlled ?? [])
    .map(bulkWallDocument)
    .filter((wall) => wall?.id);
  if (controlled.length) return controlled;
  return [];
}

function syncBulkWallSelection() {
  if (!bulkSelectedWallIds.size) {
    for (const placeable of canvas?.walls?.controlled ?? []) {
      const wall = bulkWallDocument(placeable);
      if (wall?.id) bulkSelectedWallIds.add(wall.id);
    }
  } else {
    for (const id of bulkSelectedWallIds) {
      if (!canvas?.scene?.walls?.get?.(id)) bulkSelectedWallIds.delete(id);
    }
  }
  drawBulkWallSelection();
  updateBulkWallPickerSummary();
}

function releaseBulkWalls() {
  if (canvas?.walls?.releaseAll) canvas.walls.releaseAll();
  else for (const wall of canvas?.walls?.controlled ?? []) wall.release?.();
  bulkSelectedWallIds.clear();
  drawBulkWallSelection();
  updateBulkWallPickerSummary();
}

function bulkWallDistance(point, wall) {
  const coords = getWallCoords(bulkWallDocument(wall));
  if (!coords) return Infinity;
  const dx = coords.x2 - coords.x1;
  const dy = coords.y2 - coords.y1;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared ? Math.clamp(((point.x - coords.x1) * dx + (point.y - coords.y1) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - (coords.x1 + ratio * dx), point.y - (coords.y1 + ratio * dy));
}

function bulkPointInRectangle(point, rectangle) {
  return point.x >= rectangle.left && point.x <= rectangle.right
    && point.y >= rectangle.top && point.y <= rectangle.bottom;
}

function bulkOrientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function bulkOnSegment(a, b, c) {
  return Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x)
    && Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y);
}

function bulkSegmentsIntersect(a, b, c, d) {
  const first = bulkOrientation(a, b, c);
  const second = bulkOrientation(a, b, d);
  const third = bulkOrientation(c, d, a);
  const fourth = bulkOrientation(c, d, b);
  const epsilon = 0.001;
  if (Math.abs(first) < epsilon && bulkOnSegment(a, c, b)) return true;
  if (Math.abs(second) < epsilon && bulkOnSegment(a, d, b)) return true;
  if (Math.abs(third) < epsilon && bulkOnSegment(c, a, d)) return true;
  if (Math.abs(fourth) < epsilon && bulkOnSegment(c, b, d)) return true;
  return ((first > 0) !== (second > 0)) && ((third > 0) !== (fourth > 0));
}

function bulkWallIntersectsRectangle(wall, rectangle) {
  const coords = getWallCoords(bulkWallDocument(wall));
  if (!coords) return false;
  const start = { x: coords.x1, y: coords.y1 };
  const end = { x: coords.x2, y: coords.y2 };
  if (bulkPointInRectangle(start, rectangle) || bulkPointInRectangle(end, rectangle)) return true;
  const corners = [
    { x: rectangle.left, y: rectangle.top },
    { x: rectangle.right, y: rectangle.top },
    { x: rectangle.right, y: rectangle.bottom },
    { x: rectangle.left, y: rectangle.bottom },
  ];
  return corners.some((corner, index) => bulkSegmentsIntersect(start, end, corner, corners[(index + 1) % corners.length]));
}

function onBulkPointerDown(event) {
  if (!bulkToolSelected() || event.button !== 0 || !bulkEventOnCanvas(event)) return;
  const point = bulkEventPoint(event);
  if (!point) return;
  event.preventDefault();
  event.stopPropagation();
  bulkSelectionDrag = {
    start: point,
    current: point,
    startClient: { x: event.clientX, y: event.clientY },
    currentClient: { x: event.clientX, y: event.clientY },
    additive: Boolean(event.ctrlKey || event.metaKey),
  };
  drawBulkSelectionDrag();
}

function onBulkPointerMove(event) {
  if (!bulkToolSelected() || !bulkSelectionDrag) return;
  const point = bulkEventPoint(event);
  if (!point) return;
  bulkSelectionDrag.current = point;
  bulkSelectionDrag.currentClient = { x: event.clientX, y: event.clientY };
  drawBulkSelectionDrag();
}

function onBulkPointerUp(event) {
  if (!bulkToolSelected() || !bulkSelectionDrag) return;
  const drag = bulkSelectionDrag;
  drag.current = bulkEventPoint(event) ?? drag.current;
  drag.currentClient = { x: event.clientX, y: event.clientY };
  bulkSelectionDrag = null;
  clearBulkSelectionDrag();
  event.preventDefault();
  event.stopPropagation();
  const distance = Math.hypot(drag.startClient.x - drag.currentClient.x, drag.startClient.y - drag.currentClient.y);
  if (distance < 5) selectBulkWallAt(drag.current, drag.additive);
  else selectBulkWallsInRectangle(drag.start, drag.current, drag.additive);
}

function selectBulkWallAt(point, additive) {
  const threshold = Math.max(8, Number(canvas?.dimensions?.size ?? 100) * 0.08);
  const hit = bulkWallPlaceables()
    .map((wall) => ({ wall, distance: bulkWallDistance(point, wall) }))
    .filter((entry) => entry.distance <= threshold)
    .sort((left, right) => left.distance - right.distance)[0]?.wall;
  if (!hit) {
    if (!additive) releaseBulkWalls();
    return;
  }
  const wall = bulkWallDocument(hit);
  if (!wall?.id) return;
  if (additive && bulkSelectedWallIds.has(wall.id)) {
    bulkSelectedWallIds.delete(wall.id);
    hit.release?.();
  } else {
    if (!additive) releaseBulkWalls();
    bulkSelectedWallIds.add(wall.id);
    hit.control?.({ releaseOthers: false });
  }
  syncBulkWallSelection();
}

function selectBulkWallsInRectangle(start, end, additive) {
  const rectangle = {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
  const hits = bulkWallPlaceables().filter((wall) => bulkWallIntersectsRectangle(wall, rectangle));
  if (!additive) releaseBulkWalls();
  for (const wall of hits) {
    const document = bulkWallDocument(wall);
    if (!document?.id) continue;
    if (additive && bulkSelectedWallIds.has(document.id)) {
      bulkSelectedWallIds.delete(document.id);
      wall.release?.();
    } else {
      bulkSelectedWallIds.add(document.id);
      wall.control?.({ releaseOthers: false });
    }
  }
  syncBulkWallSelection();
}

function drawBulkSelectionDrag() {
  if (!bulkSelectionDrag) return;
  let marquee = document.querySelector(`.${BULK_SELECTION_DRAG_CLASS}`);
  if (!marquee) {
    marquee = document.createElement("div");
    marquee.className = BULK_SELECTION_DRAG_CLASS;
    document.body.append(marquee);
  }
  const { startClient, currentClient } = bulkSelectionDrag;
  marquee.style.left = `${Math.min(startClient.x, currentClient.x)}px`;
  marquee.style.top = `${Math.min(startClient.y, currentClient.y)}px`;
  marquee.style.width = `${Math.abs(currentClient.x - startClient.x)}px`;
  marquee.style.height = `${Math.abs(currentClient.y - startClient.y)}px`;
}

function clearBulkSelectionDrag() {
  document.querySelector(`.${BULK_SELECTION_DRAG_CLASS}`)?.remove();
}

function drawBulkWallSelection() {
  const parent = canvas?.interface ?? canvas?.controls ?? canvas?.stage;
  if (!parent) return;
  const existing = parent.children?.find((child) => child.name === BULK_SELECTION_CONTAINER);
  if (!bulkToolSelected()) {
    (existing?.removeChildren?.() ?? []).forEach((child) => child.destroy?.({ children: true }));
    return;
  }
  let container = existing;
  if (!container) {
    container = new PIXI.Container();
    container.name = BULK_SELECTION_CONTAINER;
    container.eventMode = "none";
    container.zIndex = 10000;
    parent.addChild(container);
  }
  container.removeChildren().forEach((child) => child.destroy?.({ children: true }));
  for (const wall of selectedBulkWallDocuments()) {
    const coords = getWallCoords(wall);
    if (!coords) continue;
    const graphics = new PIXI.Graphics();
    if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
      graphics.moveTo(coords.x1, coords.y1).lineTo(coords.x2, coords.y2).stroke({ color: 0xd8a7ff, width: 5, alpha: 0.95 });
    } else {
      graphics.lineStyle(5, 0xd8a7ff, 0.95).moveTo(coords.x1, coords.y1).lineTo(coords.x2, coords.y2);
    }
    container.addChild(graphics);
  }
}

async function applyBulkWallTexture(mode, style, enabled = true) {
  const selected = selectedBulkWallDocuments();
  if (!selected.length) {
    ui.notifications?.warn?.(t("Settings.WallTextures.BulkNoSelection", "Сначала выделите хотя бы одну стену."));
    return;
  }
  const compatible = enabled ? selected.filter((wall) => !isWindowWall(wall)) : selected;
  if (!compatible.length) {
    ui.notifications?.warn?.(t("Settings.WallTextures.BulkNoCompatible", "Выбранные стены являются окнами и не поддерживают эту текстуру."));
    return;
  }
  const updates = compatible.map((wall) => {
    const current = getFlagData(wall);
    const next = { ...current, enabled };
    if (enabled) {
      next.mode = mode;
      next.style = style;
    }
    if (current.originalRestrictions !== undefined) next["-=originalRestrictions"] = null;
    return {
      _id: wall.id,
      [`flags.${MODULE_ID}.${FLAG_ROOT}`]: next,
    };
  });
  try {
    await canvas.scene.updateEmbeddedDocuments("Wall", updates);
    syncBulkWallSelection();
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply wall texture to selected walls`, error);
    ui.notifications?.error?.(t("Settings.WallTextures.BulkFailed", "Не удалось применить текстуру к выбранным стенам."));
  }
}

function getFlagData(wall) {
  return wall?.getFlag?.(MODULE_ID, FLAG_ROOT) ?? wall?.flags?.[MODULE_ID]?.[FLAG_ROOT] ?? {};
}

function isEnabled(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function isWindowWall(wall) {
  const noDoor = globalThis.CONST?.WALL_DOOR_TYPES?.NONE ?? 0;
  const proximity = globalThis.CONST?.EDGE_SENSE_TYPES?.PROXIMITY
    ?? globalThis.CONST?.WALL_SENSE_TYPES?.PROXIMITY
    ?? 30;
  return Number(wall?.door ?? noDoor) === noDoor
    && Number(wall?.light) === proximity
    && Number(wall?.sight) === proximity;
}

function supportsWallTexture(wall) {
  return Boolean(wall);
}

function getStyleDefinitions(wall, mode = getTextureMode(wall)) {
  if (isWindowWall(wall)) return WINDOW_TEXTURE_STYLES;
  const borderMode = mode === "border";
  return Object.fromEntries(Object.entries(WALL_TEXTURE_STYLES)
    .filter(([, style]) => Boolean(style.borderOnly) === borderMode));
}

function getDefaultStyle(wall, mode = getTextureMode(wall)) {
  if (isWindowWall(wall)) return DEFAULT_WINDOW_STYLE;
  return mode === "border" ? DEFAULT_BORDER_STYLE : DEFAULT_STYLE;
}

function getTextureMode(wall) {
  const flags = getFlagData(wall);
  if (isWindowWall(wall)) return "window";
  if (flags.mode === "wall" || flags.mode === "border") return flags.mode;
  const legacyStyle = WALL_TEXTURE_STYLES[WALL_TEXTURE_STYLE_ALIASES[flags.style] ?? flags.style];
  return legacyStyle?.borderOnly ? "border" : "wall";
}

function getStyleDefinition(style, wall = null, mode = getTextureMode(wall)) {
  const styles = getStyleDefinitions(wall, mode);
  return styles[normalizeStyleKey(style, wall, mode)] ?? styles[getDefaultStyle(wall, mode)];
}

function normalizeStyleKey(style, wall = null, mode = getTextureMode(wall)) {
  const normalized = WALL_TEXTURE_STYLE_ALIASES[style] ?? style;
  return getStyleDefinitions(wall, mode)[normalized] ? normalized : getDefaultStyle(wall, mode);
}

function getWallCoords(wall) {
  const coords = wall?.c;
  if (!Array.isArray(coords) || coords.length < 4) return null;
  const [x1, y1, x2, y2] = coords.map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return { x1, y1, x2, y2 };
}

function getGridSize() {
  return Number(canvas?.scene?.grid?.size ?? canvas?.dimensions?.size ?? 100);
}

function getTargetWallWidth() {
  return Math.max(5, getGridSize() * WALL_WIDTH_GRID_RATIO);
}

function getTextureScale() {
  return getTargetWallWidth() / SOURCE_WALL_WIDTH;
}

function getStyleTargetWidth(style) {
  const widthRatio = Number(style?.widthRatio ?? WALL_WIDTH_GRID_RATIO);
  return Math.max(2, getGridSize() * widthRatio);
}

function pointKey(x, y) {
  return `${Math.round(x)},${Math.round(y)}`;
}

function pointsMatch(ax, ay, bx, by) {
  const tolerance = Math.max(1, getGridSize() * 0.02);
  return Math.abs(ax - bx) <= tolerance && Math.abs(ay - by) <= tolerance;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function angleDistance(a, b) {
  return Math.abs(normalizeAngle(a - b));
}

function isDiagonalSegment(dx, dy) {
  const angle = Math.abs(Math.atan2(dy, dx));
  const normalized = Math.min(angle, Math.PI - angle);
  return Math.abs(normalized - Math.PI / 4) <= Math.PI / 10;
}

function getWallSegmentDefinition(style, dx, dy) {
  if (isDiagonalSegment(dx, dy)) {
    return { src: style.assets.straightLong, frame: SEGMENT_SOURCE_FRAMES.straightLong };
  }
  return { src: style.assets.straight, frame: SEGMENT_SOURCE_FRAMES.straight };
}

function getWallSegmentPeriod(definition) {
  return definition.frame.width * getTextureScale();
}

function getWallSegmentTileHeight(definition) {
  return definition.frame.height * getTextureScale();
}

function setNearestScaleMode(texture) {
  try {
    const scaleMode = PIXI.SCALE_MODES?.NEAREST;
    if (scaleMode == null) return;
    if (texture.baseTexture) texture.baseTexture.scaleMode = scaleMode;
    if (texture.source?.style) texture.source.style.scaleMode = "nearest";
  } catch (_error) {
    // PIXI 7 and 8 expose texture scale mode differently.
  }
}

function setLinearScaleMode(texture) {
  try {
    const scaleMode = PIXI.SCALE_MODES?.LINEAR;
    if (scaleMode != null && texture.baseTexture) texture.baseTexture.scaleMode = scaleMode;
    if (texture.source?.style) texture.source.style.scaleMode = "linear";
  } catch (_error) {
    // PIXI 7 and 8 expose texture scale mode differently.
  }
}

function setRepeatWrapMode(texture) {
  try {
    const wrapMode = PIXI.WRAP_MODES?.REPEAT;
    if (wrapMode != null && texture.baseTexture) texture.baseTexture.wrapMode = wrapMode;
    if (texture.source) {
      texture.source.addressMode = "repeat";
      if (texture.source.style) texture.source.style.addressMode = "repeat";
    }
  } catch (_error) {
    // PIXI 7 and 8 expose wrap mode differently.
  }
}

function createTexture(src, frame = null) {
  const texture = PIXI.Texture.from(src);
  setNearestScaleMode(texture);
  if (!frame) return texture;

  const rectangle = new PIXI.Rectangle(frame.x, frame.y, frame.width, frame.height);
  try {
    return new PIXI.Texture({ source: texture.source, frame: rectangle });
  } catch (_error) {
    try {
      return new PIXI.Texture(texture.baseTexture, rectangle);
    } catch (_innerError) {
      return texture;
    }
  }
}

function createSprite(src, width, height, frame = null) {
  const texture = createTexture(src, frame);

  const sprite = new PIXI.Sprite(texture);
  centerDisplayObject(sprite, width, height);
  sprite.width = width;
  sprite.height = height;
  sprite.eventMode = "none";
  sprite.interactive = false;
  return sprite;
}

function createPivotSprite(src, frame, pivot, scale) {
  const texture = createTexture(src, frame);
  const sprite = new PIXI.Sprite(texture);
  sprite.pivot.set(pivot.x, pivot.y);
  sprite.scale.set(scale, scale);
  sprite.eventMode = "none";
  sprite.interactive = false;
  return sprite;
}

function createSegmentMask(width, height, startCut = null, endCut = null) {
  const mask = new PIXI.Graphics();
  const points = [
    -width / 2 + (startCut?.top ?? 0), -height / 2,
    width / 2 + (endCut?.top ?? 0), -height / 2,
    width / 2 + (endCut?.bottom ?? 0), height / 2,
    -width / 2 + (startCut?.bottom ?? 0), height / 2,
  ];

  if (typeof mask.poly === "function" && typeof mask.fill === "function") {
    mask.poly(points).fill({ color: 0xffffff, alpha: 1 });
  } else {
    mask.beginFill(0xffffff, 1);
    mask.drawPolygon(points);
    mask.endFill();
  }
  mask.eventMode = "none";
  mask.interactive = false;
  mask.renderable = false;
  return mask;
}

function drawFilledPolygon(graphics, points) {
  if (typeof graphics.poly === "function" && typeof graphics.fill === "function") {
    graphics.poly(points).fill({ color: 0xffffff, alpha: 1 });
    return;
  }

  graphics.beginFill(0xffffff, 1);
  graphics.drawPolygon(points);
  graphics.endFill();
}

function createEndpointMask(entries) {
  const mask = new PIXI.Graphics();
  const wallWidth = getTargetWallWidth();
  const reach = wallWidth * ENDPOINT_MASK_REACH_RATIO;

  for (const entry of entries) {
    const angle = Math.atan2(entry.otherY - entry.y, entry.otherX - entry.x);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy * wallWidth / 2;
    const py = ux * wallWidth / 2;

    drawFilledPolygon(mask, [
      px, py,
      -px, -py,
      ux * reach - px, uy * reach - py,
      ux * reach + px, uy * reach + py,
    ]);
  }

  mask.eventMode = "none";
  mask.interactive = false;
  mask.renderable = false;
  return mask;
}

function createRepeatedWallSegment(definition, length, startCut = null, endCut = null) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;

  const scale = getTextureScale();
  const period = getWallSegmentPeriod(definition);
  const tileHeight = getWallSegmentTileHeight(definition);
  const mask = createSegmentMask(length, tileHeight, startCut, endCut);
  container.addChild(mask);
  container.mask = mask;

  const tileCount = Math.max(1, Math.ceil(length / period) + 1);
  const startX = -length / 2 + period / 2;
  for (let index = 0; index < tileCount; index += 1) {
    const tile = createSprite(
      definition.src,
      definition.frame.width * scale,
      definition.frame.height * scale,
      definition.frame,
    );
    tile.position.set(startX + index * period, 0);
    container.addChild(tile);
  }

  return container;
}

function centerDisplayObject(displayObject, width, height) {
  if (displayObject.anchor?.set) {
    displayObject.anchor.set(0.5, 0.5);
  } else if (displayObject.pivot?.set) {
    displayObject.pivot.set(width / 2, height / 2);
  }
}

function createWallTextureFieldset(wall) {
  const flags = getFlagData(wall);
  const enabled = isEnabled(flags.enabled);
  const windowWall = isWindowWall(wall);
  const flipped = isEnabled(flags.flipX);
  const flippedVertical = isEnabled(flags.flipY);

  const fieldset = document.createElement("fieldset");
  fieldset.className = "tsu-wall-texture-config";

  const legend = document.createElement("legend");
  legend.textContent = windowWall
    ? t("Settings.WindowTextures.Fieldset", "Window texture")
    : t(`${I18N_ROOT}.ModeFieldset`, "Wall and border textures");

  const createToggleGroup = (flag, labelKey, fallback, checked) => {
    const group = document.createElement("div");
    group.className = "form-group tsu-wall-texture-edge";
    const label = document.createElement("label");
    label.textContent = t(`${I18N_ROOT}.${labelKey}`, fallback);
    const fields = document.createElement("div");
    fields.className = "form-fields";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = `flags.${MODULE_ID}.${FLAG_ROOT}.${flag}`;
    input.checked = checked;
    fields.append(input);
    group.append(label, fields);
    return group;
  };

  const flipGroup = createToggleGroup("flipX", "FlipHorizontalLabel", "Flip horizontally", flipped);
  const flipVerticalGroup = createToggleGroup("flipY", "FlipVerticalLabel", "Flip vertically", flippedVertical);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = windowWall
    ? t("Settings.WindowTextures.FieldHint", "Draws the selected texture along this window segment.")
    : t(`${I18N_ROOT}.ModeFieldHint`, "Choose either a border texture or a wall texture. Wall restrictions are not changed.");

  const createStylePicker = (styles, selectedStyle, onSelect) => {
    const picker = document.createElement("div");
    picker.className = "tsu-wall-texture-picker";
    for (const [value, definition] of Object.entries(styles)) {
      const label = t(definition.labelKey, definition.fallback);
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "tsu-wall-texture-choice";
      choice.dataset.style = value;
      choice.title = label;
      choice.classList.toggle("selected", value === selectedStyle);
      const preview = document.createElement("img");
      preview.src = definition.assets.straightLong;
      preview.alt = "";
      const caption = document.createElement("span");
      caption.textContent = label;
      choice.append(preview, caption);
      choice.addEventListener("click", () => {
        picker.querySelectorAll("[data-style]").forEach((item) => {
          item.classList.toggle("selected", item.dataset.style === value);
        });
        onSelect(value);
      });
      picker.append(choice);
    }
    return picker;
  };

  if (windowWall) {
    const selectedStyle = normalizeStyleKey(flags.style || DEFAULT_WINDOW_STYLE, wall, "window");
    const enabledGroup = document.createElement("div");
    enabledGroup.className = "form-group";
    const enabledLabel = document.createElement("label");
    enabledLabel.textContent = t("Settings.WindowTextures.EnableLabel", "Window texture");
    const enabledFields = document.createElement("div");
    enabledFields.className = "form-fields";
    const enabledInput = document.createElement("input");
    enabledInput.type = "checkbox";
    enabledInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.enabled`;
    enabledInput.checked = enabled;
    enabledFields.append(enabledInput);
    enabledGroup.append(enabledLabel, enabledFields);

    const styleInput = document.createElement("input");
    styleInput.type = "hidden";
    styleInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.style`;
    styleInput.value = selectedStyle;
    const styleGroup = document.createElement("div");
    styleGroup.className = "form-group tsu-wall-texture-style";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = t("Settings.WindowTextures.StyleLabel", "Window style");
    const styleFields = document.createElement("div");
    styleFields.className = "form-fields";
    styleFields.append(createStylePicker(getStyleDefinitions(wall, "window"), selectedStyle, (value) => {
      styleInput.value = value;
    }));
    styleGroup.append(styleLabel, styleFields);

    const updateVisibility = () => {
      styleGroup.hidden = !enabledInput.checked;
      flipGroup.hidden = !enabledInput.checked;
      flipVerticalGroup.hidden = !enabledInput.checked;
    };
    enabledInput.addEventListener("change", updateVisibility);
    updateVisibility();
    fieldset.append(legend, enabledGroup, styleInput, styleGroup, flipGroup, flipVerticalGroup, hint);
    return fieldset;
  }

  let activeMode = getTextureMode(wall);
  const rawStyle = WALL_TEXTURE_STYLE_ALIASES[flags.style] ?? flags.style;
  const selectedStyles = {
    wall: normalizeStyleKey(activeMode === "wall" ? rawStyle : DEFAULT_STYLE, wall, "wall"),
    border: normalizeStyleKey(activeMode === "border" ? rawStyle : DEFAULT_BORDER_STYLE, wall, "border"),
  };
  const enabledInput = document.createElement("input");
  enabledInput.type = "hidden";
  enabledInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.enabled`;
  enabledInput.dataset.dtype = "Boolean";
  enabledInput.value = enabled ? "true" : "false";
  const modeInput = document.createElement("input");
  modeInput.type = "hidden";
  modeInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.mode`;
  modeInput.value = activeMode;
  const styleInput = document.createElement("input");
  styleInput.type = "hidden";
  styleInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.style`;
  styleInput.value = selectedStyles[activeMode];

  const modeControls = {};
  const setMode = (mode, checked = true) => {
    if (checked) {
      activeMode = mode;
      enabledInput.value = "true";
      modeInput.value = mode;
      styleInput.value = selectedStyles[mode];
    } else if (activeMode === mode) {
      enabledInput.value = "false";
    }
    for (const [key, control] of Object.entries(modeControls)) {
      control.checkbox.checked = enabledInput.value === "true" && key === activeMode;
      control.styleGroup.hidden = !control.checkbox.checked;
    }
    const textureEnabled = enabledInput.value === "true";
    flipGroup.hidden = !textureEnabled;
    flipVerticalGroup.hidden = !textureEnabled;
  };

  const createModeControls = (mode, labelKey, fallback) => {
    const group = document.createElement("div");
    group.className = "form-group tsu-wall-texture-mode";
    const label = document.createElement("label");
    label.textContent = t(`${I18N_ROOT}.${labelKey}`, fallback);
    const fields = document.createElement("div");
    fields.className = "form-fields";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = enabled && activeMode === mode;
    checkbox.addEventListener("change", () => setMode(mode, checkbox.checked));
    fields.append(checkbox);
    group.append(label, fields);

    const styleGroup = document.createElement("div");
    styleGroup.className = "form-group tsu-wall-texture-style tsu-wall-texture-mode-styles";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = mode === "border"
      ? t(`${I18N_ROOT}.BorderStyleLabel`, "Border style")
      : t(`${I18N_ROOT}.StyleLabel`, "Wall style");
    const styleFields = document.createElement("div");
    styleFields.className = "form-fields";
    styleFields.append(createStylePicker(getStyleDefinitions(wall, mode), selectedStyles[mode], (value) => {
      selectedStyles[mode] = value;
      setMode(mode, true);
    }));
    styleGroup.append(styleLabel, styleFields);
    modeControls[mode] = { checkbox, styleGroup };
    return [group, styleGroup];
  };

  const wallControls = createModeControls("wall", "WallModeLabel", "Wall texture");
  const borderControls = createModeControls("border", "BorderModeLabel", "Border texture");
  setMode(activeMode, enabled);

  fieldset.append(
    legend,
    enabledInput,
    modeInput,
    styleInput,
    ...wallControls,
    ...borderControls,
    flipGroup,
    flipVerticalGroup,
    hint,
  );
  return fieldset;
}

Hooks.on("renderWallConfig", (app, element) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  if (!supportsWallTexture(app.document)) return;

  const root = getElement(element);
  if (!root || root.querySelector(".tsu-wall-texture-config")) return;

  const fieldset = createWallTextureFieldset(app.document);
  const doorFieldset = root.querySelector('[name="door"]')?.closest("fieldset");
  if (doorFieldset instanceof HTMLElement) {
    doorFieldset.after(fieldset);
  } else {
    root.querySelector("form")?.append(fieldset);
  }

  scheduleApplicationAutoHeight(app);
});

function getFilePickerClass() {
  return globalThis.CONFIG?.ux?.FilePicker ?? globalThis.FilePicker;
}

async function browseDoorTextureDirectory(directory) {
  const FilePickerClass = getFilePickerClass();
  if (!FilePickerClass?.browse) return [];

  const result = await FilePickerClass.browse("public", directory, {
    extensions: [...DOOR_IMAGE_EXTENSIONS],
  });
  const files = Array.isArray(result?.files) ? result.files : [];
  const directories = Array.isArray(result?.dirs) ? result.dirs : [];
  const nestedFiles = await Promise.all(directories.map((path) => browseDoorTextureDirectory(path)));
  return [...files, ...nestedFiles.flat()];
}

function getDoorTextureFiles() {
  doorTextureFilesPromise ??= browseDoorTextureDirectory(DOOR_TEXTURE_ROOT)
    .then((files) => [...new Set(files)].sort((left, right) => left.localeCompare(right)))
    .catch((error) => {
      doorTextureFilesPromise = null;
      console.warn(`${MODULE_ID} | Failed to browse Foundry door textures`, error);
      return [];
    });
  return doorTextureFilesPromise;
}

function getDoorTextureName(path) {
  const filename = String(path ?? "").split("/").pop() ?? "";
  return decodeURIComponent(filename).replace(/\.[^.]+$/, "").replaceAll("_", " ");
}

function updateDoorPresetSummary(summary, path) {
  summary.replaceChildren();
  if (path) {
    const image = document.createElement("img");
    image.src = path;
    image.alt = "";
    summary.append(image);
  }
  const label = document.createElement("span");
  label.textContent = path
    ? getDoorTextureName(path)
    : t(`${DOOR_I18N_ROOT}.Placeholder`, "Choose a Foundry preset");
  summary.append(label);
}

async function createDoorTexturePresetGroup(textureControl) {
  const group = document.createElement("div");
  group.className = "form-group tsu-door-texture-presets";

  const label = document.createElement("label");
  label.textContent = t(`${DOOR_I18N_ROOT}.Label`, "Door preset");

  const fields = document.createElement("div");
  fields.className = "form-fields";
  const picker = document.createElement("details");
  picker.className = "tsu-door-preset-picker";
  const summary = document.createElement("summary");
  updateDoorPresetSummary(summary, textureControl.value);
  const grid = document.createElement("div");
  grid.className = "tsu-door-preset-grid";
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", label.textContent);

  const files = await getDoorTextureFiles();
  for (const path of files) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.path = path;
    button.title = getDoorTextureName(path);
    button.classList.toggle("selected", textureControl.value === path);
    const image = document.createElement("img");
    image.src = path;
    image.alt = button.title;
    image.loading = "lazy";
    button.append(image);
    button.addEventListener("click", () => {
      textureControl.value = path;
      // Foundry v14's <file-picker> setter emits both events itself. Keep the fallback for older plain inputs.
      if (textureControl instanceof HTMLInputElement) {
        textureControl.dispatchEvent(new Event("input", { bubbles: true }));
        textureControl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      grid.querySelector(".selected")?.classList.remove("selected");
      button.classList.add("selected");
      updateDoorPresetSummary(summary, path);
      picker.open = false;
    });
    grid.append(button);
  }

  if (!files.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = t(`${DOOR_I18N_ROOT}.Empty`, "Foundry door presets were not found.");
    grid.append(empty);
  }

  textureControl.addEventListener("change", () => updateDoorPresetSummary(summary, textureControl.value));
  picker.append(summary, grid);
  fields.append(picker);
  group.append(label, fields);
  return group;
}

Hooks.on("renderWallConfig", async (app, element) => {
  if (!game.settings.get(MODULE_ID, SETTING_DOOR_PRESETS)) return;

  const root = getElement(element);
  if (!root || root.querySelector(".tsu-door-texture-presets")) return;
  const textureControl = root.querySelector('[name="animation.texture"]');
  if (!(textureControl instanceof HTMLElement) || !("value" in textureControl)) return;

  const placeholder = document.createElement("div");
  placeholder.className = "form-group tsu-door-texture-presets";
  const loadingLabel = document.createElement("label");
  loadingLabel.textContent = t(`${DOOR_I18N_ROOT}.Label`, "Door preset");
  const loading = document.createElement("p");
  loading.className = "hint";
  loading.textContent = t(`${DOOR_I18N_ROOT}.Loading`, "Loading Foundry presets...");
  placeholder.append(loadingLabel, loading);
  textureControl.closest(".form-group")?.after(placeholder);
  scheduleApplicationAutoHeight(app);

  const group = await createDoorTexturePresetGroup(textureControl);
  if (!textureControl.isConnected || !placeholder.isConnected) return;
  placeholder.replaceWith(group);
  scheduleApplicationAutoHeight(app);
});

function getTextureContainer(border = false) {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return null;
  const name = border ? BORDER_TEXTURE_CONTAINER : WALL_TEXTURE_CONTAINER;

  let container = parent.children?.find((child) => child?.name === name);
  if (!container) {
    container = new PIXI.Container();
    container.name = name;
    container.eventMode = "none";
    container.interactive = false;
    parent.sortableChildren = true;
    parent.addChild(container);
  }
  if (parent === canvas?.primary) {
    const sortLayers = canvas.primary.constructor?.SORT_LAYERS ?? {};
    // PrimaryCanvasGroup compares elevation and sortLayer before zIndex.
    // Decorative borders sit below forest canopies; blocking walls sit above them.
    container.elevation = Number(canvas?.level?.elevation?.base ?? 0);
    container.sortLayer = Number(sortLayers.TILES ?? 500) + (border ? 1 : 3);
    container.sort = 0;
    container.zIndex = 0;
    parent.sortDirty = true;
  } else {
    container.zIndex = border ? 10000 : 10002;
  }
  return container;
}

function clearWallTextureContainer() {
  const parent = canvas?.primary ?? canvas?.stage;
  for (const name of [WALL_TEXTURE_CONTAINER, BORDER_TEXTURE_CONTAINER]) {
    const container = parent?.children?.find((child) => child?.name === name);
    if (container) container.destroy({ children: true });
  }
}

function getDoorSwingIndicatorContainer() {
  const layer = canvas?.walls;
  if (!layer?.objects || layer.destroyed) return null;

  let container = layer.children?.find((child) => child?.name === DOOR_SWING_INDICATOR_CONTAINER);
  if (!container) {
    container = new PIXI.Container();
    container.name = DOOR_SWING_INDICATOR_CONTAINER;
    container.eventMode = "none";
    container.interactive = false;

    // Keep the indicators behind Foundry's wall lines, endpoints, and door controls.
    const wallObjectsIndex = layer.getChildIndex?.(layer.objects) ?? -1;
    if ((wallObjectsIndex >= 0) && (typeof layer.addChildAt === "function")) {
      layer.addChildAt(container, wallObjectsIndex);
    } else {
      layer.addChild(container);
    }
  }
  return container;
}

function clearDoorSwingIndicatorContainer() {
  doorSwingIndicatorRedrawTimeout = null;
  const layer = canvas?.walls;
  const container = layer?.children?.find((child) => child?.name === DOOR_SWING_INDICATOR_CONTAINER);
  if (container && !container.destroyed) container.destroy({ children: true });
}

function isSwingDoor(wall) {
  const noDoor = globalThis.CONST?.WALL_DOOR_TYPES?.NONE ?? 0;
  return Number(wall?.door ?? noDoor) > noDoor && wall?.animation?.type === "swing";
}

function rotateVector(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function getDoorSwingTriangles(wall) {
  const coords = getWallCoords(wall);
  if (!coords || !isSwingDoor(wall)) return [];

  const direction = Number(wall.animation?.direction) === -1 ? -1 : 1;
  const configuredStrength = Number(wall.animation?.strength ?? 1);
  const strength = Number.isFinite(configuredStrength) ? Math.max(0, Math.min(2, configuredStrength)) : 1;
  const angle = Math.PI * direction * strength / 2;
  if (Math.abs(angle) < 0.001) return [];

  const start = { x: coords.x1, y: coords.y1 };
  const end = { x: coords.x2, y: coords.y2 };
  const midpoint = { x: (coords.x1 + coords.x2) / 2, y: (coords.y1 + coords.y2) / 2 };
  const leaves = wall.animation?.double
    ? [
      { hinge: start, closed: midpoint, angle },
      { hinge: end, closed: midpoint, angle: -angle },
    ]
    : [{ hinge: start, closed: end, angle }];

  return leaves.map(({ hinge, closed, angle: leafAngle }) => {
    const closedVector = {
      x: (closed.x - hinge.x) * DOOR_SWING_INDICATOR_LENGTH_RATIO,
      y: (closed.y - hinge.y) * DOOR_SWING_INDICATOR_LENGTH_RATIO,
    };
    const openVector = rotateVector(closedVector.x, closedVector.y, leafAngle);
    return [
      hinge.x, hinge.y,
      hinge.x + closedVector.x, hinge.y + closedVector.y,
      hinge.x + openVector.x, hinge.y + openVector.y,
    ];
  });
}

function drawDoorSwingTriangle(graphics, points) {
  const lineWidth = Math.max(2, Number(canvas?.dimensions?.uiScale ?? 1) * 2);
  if (typeof graphics.poly === "function" && typeof graphics.fill === "function") {
    graphics.poly(points).fill({ color: DOOR_SWING_INDICATOR_COLOR, alpha: DOOR_SWING_INDICATOR_ALPHA });
    graphics.poly(points).stroke({
      color: DOOR_SWING_INDICATOR_COLOR,
      alpha: DOOR_SWING_INDICATOR_OUTLINE_ALPHA,
      width: lineWidth,
      join: "round",
    });
    return;
  }

  graphics.lineStyle(lineWidth, DOOR_SWING_INDICATOR_COLOR, DOOR_SWING_INDICATOR_OUTLINE_ALPHA);
  graphics.beginFill(DOOR_SWING_INDICATOR_COLOR, DOOR_SWING_INDICATOR_ALPHA);
  graphics.drawPolygon(points);
  graphics.endFill();
}

function redrawDoorSwingIndicators() {
  doorSwingIndicatorRedrawTimeout = null;
  const container = getDoorSwingIndicatorContainer();
  if (!container) return;

  container.removeChildren().forEach((child) => child.destroy());
  container.visible = Boolean(canvas?.walls?.active);
  if (!container.visible) return;

  for (const placeable of canvas.walls?.placeables ?? []) {
    const wall = placeable.document;
    for (const points of getDoorSwingTriangles(wall)) {
      const graphics = new PIXI.Graphics();
      graphics.name = `${DOOR_SWING_INDICATOR_CONTAINER}-${wall.id}`;
      graphics.eventMode = "none";
      graphics.interactive = false;
      drawDoorSwingTriangle(graphics, points);
      container.addChild(graphics);
    }
  }
}

function scheduleDoorSwingIndicatorRedraw() {
  if (doorSwingIndicatorRedrawTimeout) window.clearTimeout(doorSwingIndicatorRedrawTimeout);
  doorSwingIndicatorRedrawTimeout = window.setTimeout(redrawDoorSwingIndicators, 50);
}

function getWallEndpointDirection(wall, isStart) {
  const coords = getWallCoords(wall);
  if (!coords) return null;

  const dx = coords.x2 - coords.x1;
  const dy = coords.y2 - coords.y1;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return null;

  return isStart
    ? { x: dx / length, y: dy / length }
    : { x: -dx / length, y: -dy / length };
}

function getOverlayCoverageAlongDirection(overlay, direction) {
  if (!overlay || !direction) return 0;

  const scale = getTextureScale();
  const cos = Math.cos(overlay.rotation);
  const sin = Math.sin(overlay.rotation);
  const corners = [
    { x: -overlay.pivot.x, y: -overlay.pivot.y },
    { x: overlay.frame.width - overlay.pivot.x, y: -overlay.pivot.y },
    { x: overlay.frame.width - overlay.pivot.x, y: overlay.frame.height - overlay.pivot.y },
    { x: -overlay.pivot.x, y: overlay.frame.height - overlay.pivot.y },
  ];

  return Math.max(0, ...corners.map((corner) => {
    const x = (corner.x * cos - corner.y * sin) * scale;
    const y = (corner.x * sin + corner.y * cos) * scale;
    return x * direction.x + y * direction.y;
  }));
}

function getSegmentEndpointTrim(endpointEntries, wall, isStart) {
  if (!endpointEntries || endpointEntries.length < 2) return 0;

  const overlay = getEndpointOverlay(endpointEntries);
  if (!overlay) return 0;

  const direction = getWallEndpointDirection(wall, isStart);
  const coverage = getOverlayCoverageAlongDirection(overlay, direction);
  return coverage * SEGMENT_OVERLAY_TRIM_RATIO;
}

function endpointHasOverlay(endpointEntries) {
  return Boolean(getEndpointOverlay(endpointEntries));
}

function createWallSprite(wall, endpointMap = null) {
  if (!supportsWallTexture(wall)) return null;

  const flags = getFlagData(wall);
  if (!isEnabled(flags.enabled)) return null;

  const style = getStyleDefinition(flags.style, wall);
  const coords = getWallCoords(wall);
  if (!coords) return null;

  const { x1, y1, x2, y2 } = coords;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return null;

  const startEndpoint = endpointMap?.get(pointKey(x1, y1));
  const endEndpoint = endpointMap?.get(pointKey(x2, y2));
  const startHasOverlay = endpointHasOverlay(startEndpoint);
  const endHasOverlay = endpointHasOverlay(endEndpoint);
  const shortBetweenOverlays = startHasOverlay && endHasOverlay && length <= getGridSize() * SHORT_SEGMENT_OVERLAY_ONLY_GRID_RATIO;
  if (shortBetweenOverlays) return null;

  const startTrim = Math.min(length / 2, getSegmentEndpointTrim(startEndpoint, wall, true));
  const endTrim = Math.min(length / 2, getSegmentEndpointTrim(endEndpoint, wall, false));
  const hiddenByEndpointOverlays = startHasOverlay && endHasOverlay && startTrim + endTrim >= length - getTargetWallWidth();
  if (hiddenByEndpointOverlays) return null;

  const ux = dx / length;
  const uy = dy / length;
  const visibleLength = length - startTrim - endTrim;
  const visibleX1 = x1 + ux * startTrim;
  const visibleY1 = y1 + uy * startTrim;
  const visibleX2 = x2 - ux * endTrim;
  const visibleY2 = y2 - uy * endTrim;

  const sprite = createRepeatedWallSegment(getWallSegmentDefinition(style, dx, dy), visibleLength);
  sprite.name = `${WALL_TEXTURE_CONTAINER}-${wall.id ?? ""}`;
  sprite.position.set((visibleX1 + visibleX2) / 2, (visibleY1 + visibleY2) / 2);
  sprite.rotation = Math.atan2(dy, dx);
  if (isEnabled(flags.flipX)) sprite.scale.x *= -1;
  if (isEnabled(flags.flipY)) sprite.scale.y *= -1;
  const targetWidth = getStyleTargetWidth(style);
  if (targetWidth !== getTargetWallWidth()) sprite.scale.y *= targetWidth / getTargetWallWidth();

  return sprite;
}

function createWindowSprite(wall) {
  if (!isWindowWall(wall)) return null;

  const flags = getFlagData(wall);
  if (!isEnabled(flags.enabled)) return null;

  const coords = getWallCoords(wall);
  if (!coords) return null;

  const { x1, y1, x2, y2 } = coords;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return null;

  const style = getStyleDefinition(flags.style, wall);
  if (style.arrowSlit) return createArrowSlitWindow(wall, style, { x1, y1, x2, y2, dx, dy, length, flipped: flags.flipX, flippedVertical: flags.flipY });
  const frame = SEGMENT_SOURCE_FRAMES.straightLong;
  const visibleSourceWidth = frame.width - WINDOW_FRAME_HORIZONTAL_INSET * 2;
  const renderedLength = length * frame.width / visibleSourceWidth;
  const sprite = createSprite(
    style.assets.straightLong,
    renderedLength,
    getTargetWallWidth(),
    frame,
  );
  sprite.name = `${WALL_TEXTURE_CONTAINER}-window-${wall.id ?? ""}`;
  sprite.position.set((x1 + x2) / 2, (y1 + y2) / 2);
  sprite.rotation = Math.atan2(dy, dx);
  if (isEnabled(flags.flipX)) sprite.scale.x *= -1;
  if (isEnabled(flags.flipY)) sprite.scale.y *= -1;
  return sprite;
}

function createArrowSlitWindow(wall, style, geometry) {
  const { x1, y1, x2, y2, dx, dy, length, flipped, flippedVertical } = geometry;
  const wallWidth = getTargetWallWidth();
  const overlap = Math.max(2, wallWidth * 0.12);
  const renderedLength = length + overlap * 2;
  const inheritedStyle = getAdjacentWallStyle(wall) ?? WALL_TEXTURE_STYLES[DEFAULT_STYLE];
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.name = `${WALL_TEXTURE_CONTAINER}-arrow-slit-${wall.id ?? ""}`;
  container.position.set((x1 + x2) / 2, (y1 + y2) / 2);
  container.rotation = Math.atan2(dy, dx);

  const inheritedWall = createWallRibbonMesh(inheritedStyle, [
    { x: -renderedLength / 2, y: 0 },
    { x: renderedLength / 2, y: 0 },
  ]);
  if (inheritedWall) container.addChild(inheritedWall);

  const opening = createSprite(style.assets.straightLong, renderedLength, wallWidth);
  opening.position.set(0, 0);
  container.addChild(opening);

  if (isEnabled(flipped)) container.scale.x *= -1;
  if (isEnabled(flippedVertical)) container.scale.y *= -1;
  return container;
}

function getAdjacentWallStyle(windowWall) {
  const windowCoords = getWallCoords(windowWall);
  if (!windowCoords) return null;
  const endpoints = [
    { x: windowCoords.x1, y: windowCoords.y1 },
    { x: windowCoords.x2, y: windowCoords.y2 },
  ];
  const candidates = Array.from(canvas?.scene?.walls ?? []).filter((candidate) => {
    if (candidate.id === windowWall.id || isWindowWall(candidate)) return false;
    const coords = getWallCoords(candidate);
    if (!coords) return false;
    return endpoints.some((endpoint) => (
      pointsMatch(endpoint.x, endpoint.y, coords.x1, coords.y1)
      || pointsMatch(endpoint.x, endpoint.y, coords.x2, coords.y2)
    ));
  });
  const textured = candidates.find((candidate) => isEnabled(getFlagData(candidate).enabled)) ?? candidates[0];
  if (!textured) return null;
  const flags = getFlagData(textured);
  return getStyleDefinition(flags.style || DEFAULT_STYLE, textured);
}

function getTexturedWalls() {
  return (canvas.walls?.placeables ?? [])
    .map((placeable) => placeable.document)
    .filter((wall) => {
      const flags = getFlagData(wall);
      return supportsWallTexture(wall) && isEnabled(flags.enabled) && getWallCoords(wall);
    });
}

function buildWallEndpointMap(walls) {
  const endpoints = new Map();
  for (const wall of walls) {
    const coords = getWallCoords(wall);
    if (!coords) continue;
    const points = [
      { x: coords.x1, y: coords.y1, otherX: coords.x2, otherY: coords.y2, endpoint: "start" },
      { x: coords.x2, y: coords.y2, otherX: coords.x1, otherY: coords.y1, endpoint: "end" },
    ];

    for (const point of points) {
      const key = pointKey(point.x, point.y);
      const entries = endpoints.get(key) ?? [];
      entries.push({ wall, ...point });
      endpoints.set(key, entries);
    }
  }
  return endpoints;
}

function getWallEndpointPoints(wall) {
  const coords = getWallCoords(wall);
  if (!coords) return null;
  return {
    start: { x: coords.x1, y: coords.y1 },
    end: { x: coords.x2, y: coords.y2 },
  };
}

function getOtherEndpoint(wall, endpointKey) {
  const points = getWallEndpointPoints(wall);
  if (!points) return null;

  const startKey = pointKey(points.start.x, points.start.y);
  const endKey = pointKey(points.end.x, points.end.y);
  if (endpointKey === startKey) return { key: endKey, point: points.end, endpoint: "end" };
  if (endpointKey === endKey) return { key: startKey, point: points.start, endpoint: "start" };
  return null;
}

function getNextChainWall(endpointMap, endpointKey, visitedWalls, chainKey) {
  const entries = endpointMap.get(endpointKey) ?? [];
  // A chain may pass only through an unambiguous 2-segment endpoint. At T/cross
  // junctions, or where a wall and a border share an endpoint, split the meshes so
  // one segment cannot inherit UV phase/geometry from an arbitrary neighbor.
  if (entries.length !== 2) return null;
  const candidate = entries.find((entry) => !visitedWalls.has(entry.wall.id));
  if (!candidate || getWallTextureChainKey(candidate.wall) !== chainKey) return null;
  return candidate.wall;
}

function getWallTextureStyleKey(wall) {
  const flags = getFlagData(wall);
  const mode = getTextureMode(wall);
  return normalizeStyleKey(typeof flags.style === "string" && flags.style ? flags.style : getDefaultStyle(wall, mode), wall, mode);
}

function getWallTextureChainKey(wall) {
  const flags = getFlagData(wall);
  const mode = getTextureMode(wall);
  return `${mode}:${getWallTextureStyleKey(wall)}:${isEnabled(flags.flipX) ? "flip-x" : "normal-x"}:${isEnabled(flags.flipY) ? "flip-y" : "normal-y"}`;
}

function buildWallTextureChains(walls, endpointMap) {
  const chains = [];
  const visitedWalls = new Set();

  for (const wall of walls) {
    if (visitedWalls.has(wall.id)) continue;

    const points = getWallEndpointPoints(wall);
    if (!points) continue;

    const styleKey = getWallTextureStyleKey(wall);
    const chainKey = getWallTextureChainKey(wall);
    const chainPoints = [points.start, points.end];
    visitedWalls.add(wall.id);

    const extend = (atStart) => {
      while (true) {
        const currentPoint = atStart ? chainPoints[0] : chainPoints[chainPoints.length - 1];
        const currentKey = pointKey(currentPoint.x, currentPoint.y);
        const nextWall = getNextChainWall(endpointMap, currentKey, visitedWalls, chainKey);
        if (!nextWall) return;

        const other = getOtherEndpoint(nextWall, currentKey);
        if (!other) return;

        visitedWalls.add(nextWall.id);
        if (atStart) chainPoints.unshift(other.point);
        else chainPoints.push(other.point);
      }
    };

    extend(true);
    extend(false);
    chains.push({ styleKey, wall, points: chainPoints });
  }

  return chains;
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0) return null;
  return { x: x / length, y: y / length, length };
}

function createWallRibbonMesh(style, points, flags = {}) {
  const cleanPoints = points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0;
  });
  if (cleanPoints.length < 2) return null;

  const firstPoint = cleanPoints[0];
  const lastPoint = cleanPoints[cleanPoints.length - 1];
  const isClosed = cleanPoints.length > 2
    && pointsMatch(firstPoint.x, firstPoint.y, lastPoint.x, lastPoint.y);

  const texture = PIXI.Texture.from(style.assets.straightLong);
  if (style.smooth) setLinearScaleMode(texture);
  else setNearestScaleMode(texture);
  setRepeatWrapMode(texture);

  const halfWidth = getStyleTargetWidth(style) / 2;
  const periodScale = Math.max(0.1, Number(style.periodScale ?? 1));
  const period = SOURCE_TEXTURE_SIZE * getTextureScale() * periodScale;
  const ribbonBounds = style.ribbonBounds ?? DEFAULT_RIBBON_BOUNDS;
  const textureSize = Math.max(1, Number(style.textureSize ?? SOURCE_TEXTURE_SIZE));
  const normalVTop = ribbonBounds.top / textureSize;
  const normalVBottom = ribbonBounds.bottom / textureSize;
  const ribbonVTop = isEnabled(flags.flipY) ? normalVBottom : normalVTop;
  const ribbonVBottom = isEnabled(flags.flipY) ? normalVTop : normalVBottom;
  const segmentDirections = [];
  const cumulativeLengths = [0];

  for (let index = 0; index < cleanPoints.length - 1; index += 1) {
    const from = cleanPoints[index];
    const to = cleanPoints[index + 1];
    const direction = normalizeVector(to.x - from.x, to.y - from.y);
    if (!direction) return null;
    segmentDirections.push(direction);
    cumulativeLengths.push(cumulativeLengths[index] + direction.length);
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let index = 0; index < cleanPoints.length; index += 1) {
    const point = cleanPoints[index];
    const atFirstPoint = index === 0;
    const atClosingPoint = isClosed && index === cleanPoints.length - 1;
    const previousDirection = atFirstPoint && isClosed
      ? segmentDirections[segmentDirections.length - 1]
      : segmentDirections[Math.max(0, index - 1)];
    const nextDirection = atClosingPoint
      ? segmentDirections[0]
      : segmentDirections[Math.min(segmentDirections.length - 1, index)];
    const previousNormal = { x: -previousDirection.y, y: previousDirection.x };
    const nextNormal = { x: -nextDirection.y, y: nextDirection.x };

    let miter = normalizeVector(previousNormal.x + nextNormal.x, previousNormal.y + nextNormal.y);
    if (!miter) miter = nextNormal;

    const denominator = miter.x * nextNormal.x + miter.y * nextNormal.y;
    const miterLength = Math.min(
      halfWidth * RIBBON_MITER_LIMIT_RATIO,
      Math.abs(denominator) > 0.05 ? halfWidth / denominator : halfWidth,
    );
    const offsetX = miter.x * miterLength;
    const offsetY = miter.y * miterLength;
    const u = cumulativeLengths[index] / period * (isEnabled(flags.flipX) ? -1 : 1);

    positions.push(point.x + offsetX, point.y + offsetY, point.x - offsetX, point.y - offsetY);
    uvs.push(u, ribbonVTop, u, ribbonVBottom);

    if (index < cleanPoints.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }

  const vertices = new Float32Array(positions);
  const textureUvs = new Float32Array(uvs);
  const meshIndices = new Uint16Array(indices);

  let mesh = null;
  try {
    if (typeof PIXI.SimpleMesh === "function") {
      mesh = new PIXI.SimpleMesh(texture, vertices, textureUvs, meshIndices);
    } else {
      const geometry = new PIXI.Geometry()
        .addAttribute("aVertexPosition", vertices, 2)
        .addAttribute("aTextureCoord", textureUvs, 2)
        .addIndex(meshIndices);
      try {
        mesh = new PIXI.Mesh(geometry, texture);
      } catch (_error) {
        mesh = new PIXI.Mesh({ geometry, texture });
      }
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to create wall texture mesh`, error);
    return null;
  }

  mesh.name = `${WALL_TEXTURE_CONTAINER}-ribbon`;
  mesh.eventMode = "none";
  mesh.interactive = false;
  return mesh;
}

function getEndpointAngles(entries) {
  return entries.map((entry) => Math.atan2(entry.otherY - entry.y, entry.otherX - entry.x));
}

function getEndpointStyle(entries) {
  const flags = getFlagData(entries[0]?.wall);
  return getStyleDefinition(flags.style, entries[0]?.wall);
}

function getEndpointOverlayCandidates(style, entries) {
  const candidates = [
    {
      src: style.assets.corner,
      ...OVERLAY_SOURCE_FRAMES.corner,
      canonicalAngles: [0, Math.PI / 2],
      maxScore: 0.9,
    },
    {
      src: style.assets.diag,
      ...OVERLAY_SOURCE_FRAMES.diag,
      canonicalAngles: [0, Math.PI * 0.75],
      maxScore: 0.9,
    },
  ];

  if (entries.length > 2) {
    candidates.push({
      src: style.assets.joint,
      ...OVERLAY_SOURCE_FRAMES.joint,
      canonicalAngles: [0, Math.PI, Math.PI / 2],
      maxScore: 0.95,
    });
  }

  return candidates;
}

function getEndpointOverlay(entries) {
  if (entries.length < 2) return null;

  const style = getEndpointStyle(entries);
  const angles = getEndpointAngles(entries);
  const delta = entries.length === 2 ? angleDistance(angles[0], angles[1]) : null;

  if (entries.length === 2 && (Math.abs(delta - Math.PI) < 0.35 || delta < 0.35)) return null;

  let best = null;
  for (const candidate of getEndpointOverlayCandidates(style, entries)) {
    const rotation = getOverlayRotation(angles, candidate.canonicalAngles);
    const score = scoreOverlayRotation(rotation, angles, candidate.canonicalAngles);
    if (score > candidate.maxScore) continue;
    if (!best || score < best.score) best = { ...candidate, rotation, score };
  }

  return best;
}

function scoreOverlayRotation(rotation, observedAngles, canonicalAngles) {
  const available = observedAngles.slice();
  let score = 0;

  for (const canonical of canonicalAngles) {
    if (!available.length) break;

    let bestIndex = 0;
    let bestDistance = Infinity;
    const target = normalizeAngle(canonical + rotation);

    for (let index = 0; index < available.length; index += 1) {
      const distance = angleDistance(target, available[index]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    score += bestDistance;
    available.splice(bestIndex, 1);
  }

  return score;
}

function getOverlayRotation(observedAngles, canonicalAngles) {
  const candidates = [];
  for (const observed of observedAngles) {
    for (const canonical of canonicalAngles) {
      candidates.push(normalizeAngle(observed - canonical));
    }
  }

  return candidates.reduce((best, candidate) => {
    const score = scoreOverlayRotation(candidate, observedAngles, canonicalAngles);
    return score < best.score ? { rotation: candidate, score } : best;
  }, { rotation: 0, score: Infinity }).rotation;
}

function createEndpointSprite(key, entries) {
  const overlay = getEndpointOverlay(entries);
  if (!overlay) return null;

  const [x, y] = key.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const container = new PIXI.Container();
  container.name = `${WALL_TEXTURE_CONTAINER}-endpoint-${key}`;
  container.position.set(x, y);
  container.eventMode = "none";
  container.interactive = false;

  const sprite = createPivotSprite(overlay.src, overlay.frame, overlay.pivot, getTextureScale());
  const flags = getFlagData(entries[0]?.wall);
  if (isEnabled(flags.flipX)) sprite.scale.x *= -1;
  if (isEnabled(flags.flipY)) sprite.scale.y *= -1;
  sprite.rotation = overlay.rotation;

  container.addChild(sprite);

  if (entries.length > 2) {
    const mask = createEndpointMask(entries);
    container.addChild(mask);
    container.mask = mask;
  }

  return container;
}

function redrawWallTextures() {
  redrawTimeout = null;
  // The setting gates configuration and bulk-editing controls, not rendering
  // of wall flags already stored on this scene.
  if (!canvas?.ready) {
    clearWallTextureContainer();
    return;
  }

  const wallContainer = getTextureContainer(false);
  const borderContainer = getTextureContainer(true);
  if (!wallContainer || !borderContainer) return;

  wallContainer.removeChildren().forEach((child) => child.destroy());
  borderContainer.removeChildren().forEach((child) => child.destroy());
  const texturedWalls = getTexturedWalls();
  const windows = texturedWalls.filter(isWindowWall);
  const walls = texturedWalls.filter((wall) => !isWindowWall(wall));
  const endpointMap = buildWallEndpointMap(walls);
  const chains = buildWallTextureChains(walls, endpointMap);

  for (const chain of chains) {
    const style = getStyleDefinition(chain.styleKey, chain.wall);
    const mesh = createWallRibbonMesh(style, chain.points, getFlagData(chain.wall));
    if (mesh) (style.borderOnly ? borderContainer : wallContainer).addChild(mesh);
  }

  for (const wall of windows) {
    const sprite = createWindowSprite(wall);
    if (sprite) wallContainer.addChild(sprite);
  }
}

function scheduleWallTextureRedraw() {
  if (redrawTimeout) window.clearTimeout(redrawTimeout);
  redrawTimeout = window.setTimeout(redrawWallTextures, 50);
  scheduleDoorSwingIndicatorRedraw();
}

Hooks.on("canvasReady", scheduleWallTextureRedraw);
Hooks.on("canvasTearDown", () => {
  deactivateBulkWallTool();
  bulkSelectedWallIds.clear();
  clearDoorSwingIndicatorContainer();
  clearWallTextureContainer();
});
Hooks.on("createWall", scheduleWallTextureRedraw);
Hooks.on("updateWall", () => {
  scheduleWallTextureRedraw();
  syncBulkWallSelection();
});
Hooks.on("deleteWall", (wall) => {
  bulkSelectedWallIds.delete(wall?.id);
  scheduleWallTextureRedraw();
  syncBulkWallSelection();
});
Hooks.on("controlWall", syncBulkWallSelection);
Hooks.on("releaseWall", syncBulkWallSelection);
Hooks.on("updateScene", (_scene, change) => {
  if (change.walls || change.grid || change.dimensions) scheduleWallTextureRedraw();
});
Hooks.on("activateCanvasLayer", scheduleDoorSwingIndicatorRedraw);
Hooks.on("deactivateWallsLayer", scheduleDoorSwingIndicatorRedraw);
