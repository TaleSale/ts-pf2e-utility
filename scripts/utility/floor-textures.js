import { MODULE_ID, i18nKey, t } from "../core.js";

const SETTING_ENABLE = "enableFloorTextures";
const FLAG_ROOT = "floorTextures";
const CONTROL_NAME = "tsu-floors";
const FLOOR_CONTAINER = "tsu-floor-textures";
const EDIT_CONTAINER = "tsu-floor-edit";
const DEFAULT_STYLE = "uneven-limestone";
const EPSILON = 0.01;
const FLOOR_EDGE_WIDTH = 15;
const LEVEL_NUMBER_FLAG = "floorLevelNumber";
const FLOOR_STYLES = Object.freeze({
  [DEFAULT_STYLE]: Object.freeze({
    labelKey: "Settings.FloorTextures.Choices.UnevenLimestone",
    fallback: "Uneven limestone",
    src: `modules/${MODULE_ID}/images/scene-floors/uneven-limestone-floor.png`,
  }),
  "cave-brown": floorStyle("CaveBrown", "Brown cave floor", "cave-brown-floor.png"),
  "cave-grey-pebbles": floorStyle("CaveGreyPebbles", "Grey cave pebbles", "cave-grey-pebbles-floor-v2.webp"),
  "flagstone-grey": floorStyle("FlagstoneGrey", "Grey flagstone", "flagstone-grey-floor.png"),
  "brick-red": floorStyle("BrickRed", "Red brick", "brick-red-floor.png"),
  "wood-walnut": floorStyle("WoodWalnut", "Walnut boards", "wood-walnut-floor.png"),
  "wood-alder": floorStyle("WoodAlder", "Alder boards", "wood-alder-floor.png"),
  "wood-outdoor": floorStyle("WoodOutdoor", "Outdoor boards", "wood-outdoor-brown-v3.png", null, 1.25),
  "grass-meadow": floorStyle("GrassMeadow", "Meadow grass", "grass-meadow-floor.png"),
  "path-dirt": floorStyle("PathDirt", "Dirt path", "path-dirt-floor.png", { kind: "cut", jitter: 4 }),
  "path-cobblestone": floorStyle("PathCobblestone", "Cobblestone path", "path-cobblestone-floor.png", { kind: "stone", jitter: 7, feather: 4 }),
  "carpet-red": floorStyle("CarpetRed", "Red carpet", "carpet-red-floor.png", carpetEdge("red")),
  "carpet-blue": floorStyle("CarpetBlue", "Blue carpet", "carpet-blue-floor.png", carpetEdge("blue")),
  "carpet-red-ornate": floorStyle("CarpetRedOrnate", "Ornate red carpet", "carpet-red-ornate-floor.webp", carpetEdge("red"), 0.5),
  "carpet-blue-heraldic": floorStyle("CarpetBlueHeraldic", "Ornate blue carpet", "carpet-blue-ornate-floor-v2.webp", carpetEdge("blue"), 0.5),
  "carpet-green-gold": floorStyle("CarpetGreenGold", "Green and gold carpet", "carpet-green-gold-floor.webp", carpetEdge("green"), 0.5),
  "garden-cabbage": floorStyle("GardenCabbage", "Cabbage beds", "garden-cabbage-floor.webp", { kind: "garden", color: 0x493522, width: FLOOR_EDGE_WIDTH, jitter: 4 }),
  "garden-carrot": floorStyle("GardenCarrot", "Carrot beds", "garden-carrot-floor.webp", { kind: "garden", color: 0x493522, width: FLOOR_EDGE_WIDTH, jitter: 4 }),
  "garden-herbs": floorStyle("GardenHerbs", "Herb beds", "garden-herbs-floor.webp", { kind: "garden", color: 0x493522, width: FLOOR_EDGE_WIDTH, jitter: 4 }),
  "forest-deciduous": forestStyle("ForestDeciduous", "Deciduous forest", [
    forestAsset("forest-deciduous-simple.webp", 1, 0.48, 0.76, 1, 0.16, 0x73845f),
  ]),
  "forest-pine": forestStyle("ForestPine", "Pine forest", [
    forestAsset("forest-pine-simple.webp", 1, 0.42, 0.7, 1, 0.16, 0xc6d0b8),
  ]),
  "forest-mixed": forestStyle("ForestMixed", "Mixed forest", [
    forestAsset("forest-pine-simple.webp", 0.68, 0.42, 0.72, 1, 0.16, 0xc6d0b8),
    forestAsset("forest-deciduous-simple.webp", 0.32, 0.48, 0.76, 1, 0.16, 0x73845f),
  ]),
  "sea-shallow": floorStyle("SeaShallow", "Shallow sea", "sea-shallow-floor.webp"),
  "sea-deep": floorStyle("SeaDeep", "Deep sea", "sea-deep-floor.webp"),
  "sea-stormy": floorStyle("SeaStormy", "Stormy sea", "sea-stormy-floor.webp"),
  "roof-thatch": floorStyle("RoofThatch", "Thatched roof", "roof-thatch-floor.webp", null, 1.28),
  "roof-shingles": floorStyle("RoofShingles", "Shingle roof", "roof-shingles-floor.webp", null, 1.28),
  "roof-tiles": floorStyle("RoofTiles", "Tile roof", "roof-tiles-floor.webp", null, 1.28),
  ...stairStyles("stairs-uneven-limestone", "UnevenLimestone", "Uneven limestone", "stairs-uneven-limestone.png"),
  ...stairStyles("stairs-flagstone-grey", "FlagstoneGrey", "Grey flagstone", "stairs-flagstone-grey.png"),
  ...stairStyles("stairs-brick-red", "BrickRed", "Red brick", "stairs-brick-red.png"),
  ...stairStyles("stairs-wood-walnut", "WoodWalnut", "Walnut boards", "stairs-wood-walnut.png"),
  ...stairStyles("stairs-wood-alder", "WoodAlder", "Alder boards", "stairs-wood-alder.png"),
  ...stairStyles("stairs-wood-outdoor", "WoodOutdoor", "Outdoor boards", "stairs-wood-outdoor-brown.png"),
});
const FLOOR_STYLE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "Stone", fallback: "Stone", styles: ["uneven-limestone", "flagstone-grey", "brick-red"] }),
  Object.freeze({ key: "Caves", fallback: "Caves", styles: ["cave-brown", "cave-grey-pebbles"] }),
  Object.freeze({ key: "Wood", fallback: "Wood", styles: ["wood-walnut", "wood-alder", "wood-outdoor"] }),
  Object.freeze({ key: "Stairs", fallback: "Stairs", styles: [
    ...stairStyleKeys("stairs-uneven-limestone"),
    ...stairStyleKeys("stairs-flagstone-grey"),
    ...stairStyleKeys("stairs-brick-red"),
    ...stairStyleKeys("stairs-wood-walnut"),
    ...stairStyleKeys("stairs-wood-alder"),
    ...stairStyleKeys("stairs-wood-outdoor"),
  ] }),
  Object.freeze({ key: "Nature", fallback: "Nature", styles: ["grass-meadow", "forest-deciduous", "forest-pine", "forest-mixed"] }),
  Object.freeze({ key: "Seas", fallback: "Seas", styles: ["sea-shallow", "sea-deep", "sea-stormy"] }),
  Object.freeze({ key: "Roofs", fallback: "Roofs", styles: ["roof-thatch", "roof-shingles", "roof-tiles"] }),
  Object.freeze({ key: "Gardens", fallback: "Gardens", styles: ["garden-cabbage", "garden-carrot", "garden-herbs"] }),
  Object.freeze({ key: "Paths", fallback: "Paths", styles: ["path-dirt", "path-cobblestone"] }),
  Object.freeze({ key: "Carpets", fallback: "Carpets", styles: ["carpet-red", "carpet-blue", "carpet-red-ornate", "carpet-blue-heraldic", "carpet-green-gold"] }),
]);

function floorStyle(label, fallback, filename, edge = null, scale = 1) {
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    src: `modules/${MODULE_ID}/images/scene-floors/${filename}`,
    edge,
    scale,
  });
}

function forestStyle(label, fallback, assets) {
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    previewSrc: assets[0]?.src,
    forest: Object.freeze({
      assets: Object.freeze(assets),
      density: 8,
      minimumSpacing: 0.08,
      clusterSize: 2.2,
      maxTrees: 1200,
    }),
  });
}

function forestAsset(filename, weight, minSize, maxSize, aspect, edgeMinSize, tint) {
  return Object.freeze({
    src: `modules/${MODULE_ID}/images/scene-assets/${filename}`,
    weight,
    minSize,
    maxSize,
    aspect,
    edgeMinSize,
    tint,
  });
}

function stairStyleKeys(prefix) {
  return ["vertical-up", "vertical-down", "horizontal-right", "horizontal-left"].map((direction) => `${prefix}-${direction}`);
}

function stairStyles(prefix, materialLabel, materialFallback, filename) {
  const directions = [
    { key: "vertical-up", label: "VerticalUp", fallback: "Stairs vertical ↑", rotation: 0 },
    { key: "vertical-down", label: "VerticalDown", fallback: "Stairs vertical ↓", rotation: 180 },
    { key: "horizontal-right", label: "HorizontalRight", fallback: "Stairs horizontal →", rotation: 90 },
    { key: "horizontal-left", label: "HorizontalLeft", fallback: "Stairs horizontal ←", rotation: -90 },
  ];
  return Object.fromEntries(directions.map((direction) => [`${prefix}-${direction.key}`, Object.freeze({
    materialLabelKey: `Settings.FloorTextures.Choices.${materialLabel}`,
    materialFallback,
    directionKey: `Directions.${direction.label}`,
    directionFallback: direction.fallback,
    src: `modules/${MODULE_ID}/images/scene-floors/${filename}`,
    cellSized: true,
    sourceSize: 200,
    rotation: direction.rotation,
  })]));
}

function carpetEdge(color) {
  const palettes = {
    red: { outer: 0x321712, band: 0xb98a46, inner: 0x792c23 },
    blue: { outer: 0x101a2a, band: 0xb5a06a, inner: 0x263d5c },
    green: { outer: 0x142319, band: 0xb69a50, inner: 0x304c32 },
  };
  return Object.freeze({
    kind: "carpet",
    width: FLOOR_EDGE_WIDTH,
    sourceHeight: 32,
    texture: `modules/${MODULE_ID}/images/scene-floors/carpet-edge-${color}-v2.webp`,
    corner: `modules/${MODULE_ID}/images/scene-floors/carpet-corner-${color}-v2.webp`,
    palette: palettes[color] ?? palettes.red,
  });
}

let activeTool = null;
let selectedStyle = DEFAULT_STYLE;
let selectedLevel = 0;
let currentLevel = 0;
let draftPoints = [];
let selectedEdge = null;
let redrawTimer = null;
let stageBound = null;
let lastClick = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey("Settings.FloorTextures.Name"),
    hint: i18nKey("Settings.FloorTextures.Hint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      refreshControls();
      scheduleRedraw();
    },
  });
});

function enabled() {
  return Boolean(game.user?.isGM && game.settings.get(MODULE_ID, SETTING_ENABLE));
}

function localize(key, fallback) {
  return t(`Settings.FloorTextures.${key}`, fallback);
}

function styleLabel(style) {
  if (style.materialLabelKey && style.directionKey) {
    return `${t(style.materialLabelKey, style.materialFallback)} — ${localize(style.directionKey, style.directionFallback)}`;
  }
  return t(style.labelKey, style.fallback);
}

function rotateStylePreview(image, style) {
  const rotation = Number(style.rotation ?? 0);
  if (rotation) image.style.transform = `rotate(${rotation}deg)`;
}

function toolDefinition(name, title, icon) {
  const orders = { fill: 0, draw: 1, level: 2, erase: 3 };
  return {
    name,
    order: orders[name] ?? 99,
    title: localize(title, title),
    icon,
    visible: true,
    onChange: (_event, active) => {
      if (active !== false) activateTool(name);
    },
  };
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!enabled()) return;
  const tools = [
    toolDefinition("fill", "FillRoom", "fa-solid fa-fill-drip"),
    toolDefinition("draw", "DrawBoundary", "fa-solid fa-draw-polygon"),
    toolDefinition("level", "ChangeFloorLevel", "fa-solid fa-layer-group"),
    toolDefinition("erase", "EraseFloor", "fa-solid fa-eraser"),
    {
      name: "base",
      order: 4,
      title: localize("BaseFloor", "Base floor"),
      icon: "fa-solid fa-expand",
      visible: true,
      button: true,
      onChange: () => setBaseFloor(),
    },
  ];
  const group = {
    name: CONTROL_NAME,
    order: 75,
    title: localize("Control", "Floors"),
    icon: "fa-solid fa-border-all",
    layer: "controls",
    layerName: "controls",
    activeTool: "fill",
    onChange: (_event, active) => {
      if (active) activateTool(ui.controls?.tool?.name ?? "fill");
      else deactivateTool();
      renderStyleSelect(ui.controls?.element);
    },
  };

  controls[CONTROL_NAME] = { ...group, tools: Object.fromEntries(tools.map((tool) => [tool.name, tool])) };
});

Hooks.on("renderSceneControls", (_app, element) => {
  queueMicrotask(() => {
    syncActiveControl();
    renderStyleSelect(element);
  });
});

function refreshControls() {
  ui.controls?.render?.({ reset: true });
}

function currentControlName() {
  return ui.controls?.control?.name ?? null;
}

function currentToolName() {
  return ui.controls?.tool?.name ?? null;
}

function syncActiveControl() {
  if (currentControlName() !== CONTROL_NAME) {
    deactivateTool();
    return;
  }
  activateTool(currentToolName() || activeTool || "fill");
}

function activateTool(name) {
  if (!enabled()) return;
  canvas?.activeLayer?.deactivate?.();
  activeTool = ["fill", "draw", "level", "erase"].includes(name) ? name : "fill";
  if (activeTool !== "draw") draftPoints = [];
  selectedEdge = null;
  bindStageEvents();
  redrawEditor();
  document.querySelector(".tsu-floor-style-picker")?.classList.remove("hidden");
}

function deactivateTool() {
  activeTool = null;
  draftPoints = [];
  selectedEdge = null;
  redrawEditor();
  document.querySelector(".tsu-floor-style-picker")?.classList.add("hidden");
}

function getRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return document.querySelector("#scene-controls");
}

function renderStyleSelect(element) {
  document.querySelector(".tsu-floor-style-picker")?.remove();
  if (!enabled() || currentControlName() !== CONTROL_NAME) return;
  const root = getRoot(element) ?? document.querySelector("#scene-controls");
  if (!root) return;
  const wrapper = document.createElement("div");
  wrapper.className = "tsu-floor-style-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "tsu-floor-style-trigger";
  const updateTrigger = () => {
    const style = FLOOR_STYLES[selectedStyle] ?? FLOOR_STYLES[DEFAULT_STYLE];
    trigger.replaceChildren();
    const preview = document.createElement("img");
    preview.src = style.previewSrc ?? style.src;
    preview.alt = "";
    rotateStylePreview(preview, style);
    const label = document.createElement("span");
    label.textContent = styleLabel(style);
    trigger.append(preview, label, icon);
  };
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";
  updateTrigger();
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    wrapper.classList.toggle("open");
  });

  const menu = document.createElement("div");
  menu.className = "tsu-floor-style-menu";
  for (const category of FLOOR_STYLE_CATEGORIES) {
    const categoryRow = document.createElement("div");
    categoryRow.className = "tsu-floor-style-category";
    categoryRow.tabIndex = 0;
    const categoryLabel = document.createElement("span");
    categoryLabel.textContent = localize(`Categories.${category.key}`, category.fallback);
    const arrow = document.createElement("i");
    arrow.className = "fa-solid fa-chevron-right";
    const submenu = document.createElement("div");
    submenu.className = "tsu-floor-style-submenu";
    for (const styleKey of category.styles) {
      const style = FLOOR_STYLES[styleKey];
      if (!style) continue;
      const choice = document.createElement("button");
      choice.type = "button";
      choice.dataset.style = styleKey;
      choice.title = styleLabel(style);
      const preview = document.createElement("img");
      preview.src = style.previewSrc ?? style.src;
      preview.alt = "";
      rotateStylePreview(preview, style);
      const label = document.createElement("span");
      label.textContent = styleLabel(style);
      choice.append(preview, label);
      choice.classList.toggle("selected", styleKey === selectedStyle);
      choice.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedStyle = styleKey;
        wrapper.querySelectorAll("[data-style]").forEach((item) => item.classList.toggle("selected", item.dataset.style === styleKey));
        updateTrigger();
        wrapper.classList.remove("open");
      });
      submenu.append(choice);
    }
    categoryRow.append(categoryLabel, arrow, submenu);
    menu.append(categoryRow);
  }
  wrapper.append(trigger, menu);
  const levelLabel = document.createElement("label");
  levelLabel.className = "tsu-floor-level";
  levelLabel.textContent = localize("CurrentLevel", "Current map level");
  const levelInput = document.createElement("input");
  levelInput.type = "number";
  levelInput.step = "1";
  levelInput.value = String(currentLevel);
  levelInput.title = localize("CurrentLevelHint", "This level and uncovered lower floors are visible.");
  levelInput.addEventListener("change", async () => {
    currentLevel = Number(levelInput.value) || 0;
    scheduleRedraw();
    const nativeLevel = await ensureNativeLevel(currentLevel);
    if (nativeLevel && canvas?.level?.id !== nativeLevel.id) await canvas.scene.view({ level: nativeLevel.id });
  });
  levelLabel.append(levelInput);
  wrapper.append(levelLabel);
  const targetLevelLabel = document.createElement("label");
  targetLevelLabel.className = "tsu-floor-level";
  targetLevelLabel.textContent = localize("FloorLevel", "Floor level");
  const targetLevelInput = document.createElement("input");
  targetLevelInput.type = "number";
  targetLevelInput.step = "1";
  targetLevelInput.value = String(selectedLevel);
  targetLevelInput.title = localize("FloorLevelHint", "New floors and the change-level tool use this value.");
  targetLevelInput.addEventListener("change", () => { selectedLevel = Number(targetLevelInput.value) || 0; });
  targetLevelLabel.append(targetLevelInput);
  wrapper.append(targetLevelLabel);
  document.body.append(wrapper);
  requestAnimationFrame(positionStyleSelect);
}

function positionStyleSelect() {
  const picker = document.querySelector(".tsu-floor-style-picker");
  if (!(picker instanceof HTMLElement) || currentControlName() !== CONTROL_NAME) return;
  const tools = Array.from(document.querySelectorAll("#scene-controls-tools .tool"));
  const anchor = tools.at(-1);
  if (!(anchor instanceof HTMLElement)) return;

  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const maxLeft = Math.max(gap, window.innerWidth - picker.offsetWidth - gap);
  const maxTop = Math.max(gap, window.innerHeight - picker.offsetHeight - gap);
  picker.style.left = `${Math.min(Math.max(gap, rect.left), maxLeft)}px`;
  picker.style.top = `${Math.min(Math.max(gap, rect.bottom + gap), maxTop)}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(positionStyleSelect));
document.addEventListener("pointerdown", (event) => {
  const picker = document.querySelector(".tsu-floor-style-picker");
  if (picker && !picker.contains(event.target)) picker.classList.remove("open");
});

function getSceneData() {
  const raw = canvas?.scene?.getFlag?.(MODULE_ID, FLAG_ROOT);
  const floors = Array.isArray(raw?.floors) ? foundry.utils.deepClone(raw.floors) : [];
  return { version: 1, floors };
}

export function getCurrentFloorLevel() {
  return Number(currentLevel) || 0;
}

export function getFloorNumberForNativeLevel(level) {
  const stored = Number(level?.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG]);
  return Number.isFinite(stored) ? stored : Number(level?.index ?? 0);
}

function findNativeLevel(floorNumber) {
  const levels = canvas?.scene?.levels?.sorted ?? [];
  return levels.find((level) => Number(level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG]) === Number(floorNumber))
    ?? levels.find((level) => level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG] == null && Number(level.index) === Number(floorNumber));
}

async function persistNativeLevelNumbers(scene) {
  const updates = (scene?.levels?.sorted ?? [])
    .filter((level) => level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG] == null)
    .map((level) => ({
      _id: level.id,
      [`flags.${MODULE_ID}.${LEVEL_NUMBER_FLAG}`]: Number(level.index),
    }));
  if (updates.length) await scene.updateEmbeddedDocuments("Level", updates);
}

async function ensureNativeLevel(floorNumber) {
  const scene = canvas?.scene;
  if (!scene || !game.user?.isGM) return findNativeLevel(floorNumber);
  await persistNativeLevelNumbers(scene);
  const existing = findNativeLevel(floorNumber);
  if (existing) return existing;
  const levels = scene.levels?.sorted ?? [];
  const reference = findNativeLevel(0) ?? levels[0];
  const referenceNumber = getFloorNumberForNativeLevel(reference);
  const referenceBottom = Number.isFinite(Number(reference?.elevation?.bottom)) ? Number(reference.elevation.bottom) : 0;
  const rawHeight = Number(reference?.elevation?.top) - Number(reference?.elevation?.bottom);
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 10;
  const bottom = referenceBottom + (Number(floorNumber) - referenceNumber) * height;
  const [created] = await scene.createEmbeddedDocuments("Level", [{
    name: localize("NativeLevelName", `Map level ${floorNumber}`).replace("{level}", String(floorNumber)),
    elevation: { bottom, top: bottom + height },
    sort: Number(floorNumber) * (CONST.SORT_INTEGER_DENSITY ?? 100000),
    flags: { [MODULE_ID]: { [LEVEL_NUMBER_FLAG]: Number(floorNumber) } },
  }]);
  if (created) ui.notifications.info(localize("NativeLevelCreated", `Created Foundry map level ${floorNumber}.`).replace("{level}", String(floorNumber)));
  return created ?? null;
}

async function setSceneData(data) {
  if (!canvas?.scene || !game.user?.isGM) return;
  await canvas.scene.setFlag(MODULE_ID, FLAG_ROOT, data);
}

function randomId() {
  return foundry.utils.randomID?.() ?? crypto.randomUUID();
}

function storedFloor(source, points) {
  const normalized = normalizePolygon(points);
  return {
    id: randomId(),
    source,
    style: selectedStyle,
    level: selectedLevel,
    points: normalized,
    lines: source === "manual" ? normalized.map((point, index) => ({
      id: randomId(),
      a: point,
      b: normalized[(index + 1) % normalized.length],
    })) : [],
  };
}

async function addFloor(source, points, { replaceAt = null } = {}) {
  const data = getSceneData();
  const polygon = normalizePolygon(points);
  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) < 1) {
    return ui.notifications.warn(localize("InvalidPolygon", "The floor boundary is invalid."));
  }
  if (polygonSelfIntersects(polygon)) {
    return ui.notifications.warn(localize("SelfIntersection", "The floor boundary crosses itself."));
  }
  if (replaceAt) {
    const existing = data.floors
      .filter((floor) => floor.source !== "base" && pointInPolygon(replaceAt, floor.points))
      .filter((floor) => Number(floor.level ?? 0) === currentLevel)
      .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
    if (existing) {
      existing.style = selectedStyle;
      existing.level = selectedLevel;
      if (existing.source === "walls") {
        existing.points = polygon;
        existing.lines = [];
      }
      await setSceneData(data);
      return;
    }
  }
  const duplicate = data.floors.find((floor) => Number(floor.level ?? 0) === selectedLevel && polygonsEquivalent(floor.points, polygon));
  if (duplicate) {
    duplicate.style = selectedStyle;
    duplicate.level = selectedLevel;
    await setSceneData(data);
    return;
  }
  data.floors.push(storedFloor(source, polygon));
  await setSceneData(data);
}

async function setBaseFloor() {
  const rect = canvas?.dimensions?.sceneRect;
  if (!rect) return ui.notifications.warn(localize("NoScene", "The scene is not ready."));
  const points = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  const data = getSceneData();
  const existing = data.floors.find((floor) => floor.source === "base" && Number(floor.level ?? 0) === selectedLevel);
  const base = existing
    ? { ...existing, style: selectedStyle, level: selectedLevel, points, lines: [] }
    : storedFloor("base", points);
  data.floors = [base, ...data.floors.filter((floor) => floor !== existing)];
  await setSceneData(data);
  ui.notifications.info(localize("BaseFloorCreated", "The base floor covers the whole scene."));
}

async function removeFloorAt(point) {
  const data = getSceneData();
  const matches = data.floors
    .map((floor, index) => ({ floor, index, area: Math.abs(polygonArea(floor.points)) }))
    .filter(({ floor }) => pointInPolygon(point, floor.points))
    .filter(({ floor }) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => a.area - b.area);
  if (!matches.length) return ui.notifications.warn(localize("NoFloor", "No floor was found here."));
  data.floors.splice(matches[0].index, 1);
  await setSceneData(data);
}

async function replaceFloorStyleAt(point) {
  const data = getSceneData();
  const existing = data.floors
    .filter((floor) => floor.source !== "base" && pointInPolygon(point, floor.points))
    .filter((floor) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (!existing) return false;
  existing.style = selectedStyle;
  existing.level = selectedLevel;
  await setSceneData(data);
  return true;
}

async function changeFloorLevelAt(point) {
  const data = getSceneData();
  const existing = data.floors
    .filter((floor) => pointInPolygon(point, floor.points))
    .filter((floor) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (!existing) return ui.notifications.warn(localize("NoFloor", "No floor was found here."));
  existing.level = selectedLevel;
  await setSceneData(data);
  ui.notifications.info(localize("FloorLevelChanged", "Floor level changed."));
}

function bindStageEvents() {
  const element = document.getElementById("board")
    ?? canvas?.app?.canvas
    ?? canvas?.app?.renderer?.canvas
    ?? canvas?.app?.view;
  if (!(element instanceof HTMLElement) || stageBound === element) return;
  unbindStageEvents();
  stageBound = element;
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
}

function unbindStageEvents() {
  if (stageBound) {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
  }
  stageBound = null;
}

function eventPoint(event) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
    const element = stageBound
      ?? document.getElementById("board")
      ?? canvas?.app?.canvas
      ?? canvas?.app?.renderer?.canvas
      ?? canvas?.app?.view;
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

function eventOnCanvas(event) {
  const element = stageBound ?? document.getElementById("board");
  return Boolean(element && (event.target === element || element.contains?.(event.target)));
}

function snapPoint(point) {
  const snapped = canvas?.grid?.getSnappedPoint?.(point, { mode: CONST.GRID_SNAPPING_MODES?.VERTEX ?? 0 });
  return snapped && Number.isFinite(snapped.x) ? { x: snapped.x, y: snapped.y } : point;
}

async function onPointerDown(event) {
  if (!activeTool || currentControlName() !== CONTROL_NAME || event.button !== 0 || !eventOnCanvas(event)) return;
  const rawPoint = eventPoint(event);
  if (!rawPoint) return;
  event.stopPropagation?.();

  if (activeTool === "erase") return removeFloorAt(rawPoint);
  if (activeTool === "level") return changeFloorLevelAt(rawPoint);
  if (activeTool === "fill") {
    if (await replaceFloorStyleAt(rawPoint)) return;
    const polygon = findWallFace(rawPoint);
    if (!polygon) return ui.notifications.warn(localize("OpenRoom", "No closed room was found here."));
    return addFloor("walls", polygon, { replaceAt: rawPoint });
  }

  const hit = findManualEdge(rawPoint);
  if (hit && draftPoints.length === 0) {
    selectedEdge = hit;
    redrawEditor();
    return;
  }

  const point = snapPoint(rawPoint);
  const now = Date.now();
  const doubleClick = lastClick && now - lastClick.time < 350 && distance(lastClick.point, point) < 8;
  if (!doubleClick) draftPoints.push(point);
  lastClick = { time: now, point };
  if (doubleClick) await finishDraft();
  redrawEditor(point);
}

function onPointerMove(event) {
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  if (!eventOnCanvas(event)) return;
  const point = eventPoint(event);
  if (!point) return;
  redrawEditor(point);
}

async function finishDraft() {
  const points = normalizePolygon(draftPoints);
  draftPoints = [];
  lastClick = null;
  if (points.length < 3) {
    ui.notifications.warn(localize("NeedThreePoints", "A floor needs at least three points."));
    return;
  }
  await addFloor("manual", points);
}

function findManualEdge(point) {
  const threshold = Math.max(8, Number(canvas?.dimensions?.size ?? 100) * 0.08);
  let best = null;
  for (const floor of getSceneData().floors) {
    if (Number(floor.level ?? 0) !== currentLevel) continue;
    if (floor.source !== "manual") continue;
    floor.points.forEach((a, index) => {
      const b = floor.points[(index + 1) % floor.points.length];
      const d = pointSegmentDistance(point, a, b);
      if (d <= threshold && (!best || d < best.distance)) best = { floorId: floor.id, edgeIndex: index, distance: d };
    });
  }
  return best;
}

document.addEventListener("keydown", async (event) => {
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  if (event.key === "Escape") {
    draftPoints = [];
    selectedEdge = null;
    redrawEditor();
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedEdge) {
    event.preventDefault();
    const data = getSceneData();
    data.floors = data.floors.filter((floor) => floor.id !== selectedEdge.floorId);
    selectedEdge = null;
    await setSceneData(data);
  }
});

function getFloorContainer(create = true) {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return null;
  let container = parent.children?.find((child) => child.name === FLOOR_CONTAINER);
  if (!container && create) {
    container = new PIXI.Container();
    container.name = FLOOR_CONTAINER;
    container.eventMode = "none";
    container.sortableChildren = true;
    parent.sortableChildren = true;
    parent.addChild(container);
  }
  if (parent === canvas?.primary) {
    // Render above the viewed level's background, but below tiles, drawings,
    // tokens, and the level foreground.
    container.elevation = Number(canvas?.level?.elevation?.base ?? 0);
    container.sortLayer = canvas.primary.constructor?.SORT_LAYERS?.SCENE ?? 0;
    container.sort = 0;
    container.zIndex = 1;
    parent.sortDirty = true;
  }
  else container.zIndex = -10000;
  return container;
}

function getEditorContainer(create = true) {
  const parent = canvas?.controls ?? canvas?.stage;
  if (!parent) return null;
  let container = parent.children?.find((child) => child.name === EDIT_CONTAINER);
  if (!container && create) {
    container = new PIXI.Container();
    container.name = EDIT_CONTAINER;
    container.eventMode = "none";
    container.zIndex = 1000;
    parent.addChild(container);
  }
  return container;
}

function clearContainer(container) {
  if (!container) return;
  for (const child of container.removeChildren()) {
    const ownedTextures = new Set();
    const collect = (displayObject) => {
      if (displayObject?._tsuOwnedTexture) ownedTextures.add(displayObject._tsuOwnedTexture);
      for (const nested of displayObject?.children ?? []) collect(nested);
    };
    collect(child);
    child.destroy?.({ children: true });
    for (const texture of ownedTextures) texture.destroy?.(true);
  }
}

function newGraphics() {
  return new PIXI.Graphics();
}

function drawPolygon(graphics, points, color, alpha = 1) {
  if (!points.length) return;
  if (typeof graphics.poly === "function") graphics.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
  else {
    graphics.beginFill(color, alpha);
    graphics.drawPolygon(points.flatMap((p) => [p.x, p.y]));
    graphics.endFill();
  }
}

function drawLine(graphics, a, b, color, width, alpha = 1) {
  if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
    graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha });
  } else {
    graphics.lineStyle(width, color, alpha).moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
}

function drawClosedStroke(graphics, points, color, width, alpha = 1, join = "round", cap = "round") {
  if (!points.length) return;
  if (typeof graphics.stroke === "function") {
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.lineTo(points[0].x, points[0].y);
    graphics.stroke({ color, width, alpha, join, cap });
    return;
  }
  graphics.lineStyle(width, color, alpha);
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.lineTo(points[0].x, points[0].y);
}

function redrawFloors() {
  const container = getFloorContainer();
  clearContainer(container);
  if (!canvas?.ready || !game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  for (const floor of getSceneData().floors) {
    if (Number(floor.level ?? 0) > currentLevel) continue;
    const points = normalizePolygon(floor.points);
    if (points.length < 3) continue;
    const style = FLOOR_STYLES[floor.style] ?? FLOOR_STYLES[DEFAULT_STYLE];
    const floorLayer = new PIXI.Container();
    floorLayer.eventMode = "none";
    floorLayer.zIndex = Number(floor.level ?? 0);
    container.addChild(floorLayer);
    if (style.forest) {
      const forest = createForestFill(points, style.forest, `${floor.id}:${floor.style}`);
      if (forest) floorLayer.addChild(forest);
      continue;
    }
    const renderPoints = style.edge?.texture ? points : style.edge ? createNaturalBoundary(points, `${floor.id}:${floor.style}`, style.edge) : points;
    const bounds = polygonBounds(renderPoints);
    const texture = PIXI.Texture.from(style.src);
    const rotationDegrees = Number(style.rotation ?? 0);
    const swapsAxes = Math.abs(rotationDegrees) % 180 === 90;
    const spriteWidth = swapsAxes ? bounds.height : bounds.width;
    const spriteHeight = swapsAxes ? bounds.width : bounds.height;
    let sprite;
    try { sprite = new PIXI.TilingSprite({ texture, width: spriteWidth, height: spriteHeight }); }
    catch { sprite = new PIXI.TilingSprite(texture, spriteWidth, spriteHeight); }
    sprite.pivot.set(spriteWidth / 2, spriteHeight / 2);
    sprite.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    sprite.rotation = rotationDegrees * Math.PI / 180;
    const tileScale = style.cellSized
      ? Number(canvas?.dimensions?.size ?? 100) / Number(style.sourceSize ?? 200)
      : Number(style.scale ?? 1);
    sprite.tileScale?.set?.(tileScale);
    const mask = isNaturalPathEdge(style.edge)
      ? createFeatheredFloorMask(renderPoints, bounds, style.edge)
      : newGraphics();
    if (!isNaturalPathEdge(style.edge)) drawPolygon(mask, renderPoints, 0xffffff);
    sprite.mask = mask;
    floorLayer.addChild(sprite, mask);
    const edgeGraphic = style.edge ? createFloorEdge(renderPoints, style.edge, `${floor.id}:${floor.style}`) : null;
    if (edgeGraphic) floorLayer.addChild(edgeGraphic);
  }
}

function isNaturalPathEdge(edge) {
  return edge?.kind === "dirt" || edge?.kind === "stone";
}

function createForestFill(points, forest, seed) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.sortableChildren = true;

  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const bounds = polygonBounds(points);
  const areaCells = Math.abs(polygonArea(points)) / (grid * grid);
  const wanted = Math.min(Number(forest.maxTrees ?? 800), Math.max(1, Math.round(areaCells * Number(forest.density ?? 0.5))));
  const spacing = grid * Number(forest.minimumSpacing ?? 0.62);
  const random = seededRandom(seed);
  const placements = [];
  const buckets = new Map();
  const bucketKey = (point) => `${Math.floor(point.x / spacing)}:${Math.floor(point.y / spacing)}`;
  const hasNearbyTree = (point, personalSpacing) => {
    const cellX = Math.floor(point.x / spacing), cellY = Math.floor(point.y / spacing);
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      for (const other of buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
        if (distance(point, other) < Math.min(personalSpacing, other.spacing)) return true;
      }
    }
    return false;
  };
  const attempts = Math.min(60000, Math.max(180, wanted * 90));

  for (let attempt = 0; attempt < attempts && placements.length < wanted; attempt += 1) {
    const asset = weightedForestAsset(forest.assets, random());
    if (!asset) break;
    const point = {
      x: bounds.x + random() * bounds.width,
      y: bounds.y + random() * bounds.height,
    };
    if (!pointInPolygon(point, points)) continue;

    const edgeDistance = distanceToPolygon(point, points);
    const aspect = Math.max(0.1, Number(asset.aspect ?? 1));
    const naturalSizeCells = lerp(Number(asset.minSize ?? 1), Number(asset.maxSize ?? 1.5), random());
    // Shrink crowns near the contour instead of rejecting the position. This
    // lets narrow polygon branches fill while keeping most of each crown inside.
    const footprintRadiusPerCell = 0.38 * Math.max(1, 1 / aspect);
    const fittedSizeCells = edgeDistance / (grid * footprintRadiusPerCell);
    const sizeCells = Math.min(naturalSizeCells, fittedSizeCells);
    if (sizeCells < Number(asset.edgeMinSize ?? 0.55)) continue;
    const width = grid * sizeCells;
    const height = width / aspect;

    const clusterNoise = smoothValueNoise(
      (point.x - bounds.x) / (grid * Number(forest.clusterSize ?? 3.8)),
      (point.y - bounds.y) / (grid * Number(forest.clusterSize ?? 3.8)),
      `${seed}:clusters`,
    );
    const edgeBoost = Math.max(0, 1 - edgeDistance / (grid * 1.35));
    const presence = 0.28 + clusterNoise * 0.54 + edgeBoost * 0.24;
    if (random() > Math.min(0.96, presence)) continue;

    const edgeScale = Math.max(0.55, Math.min(1, sizeCells / naturalSizeCells));
    const personalSpacing = spacing * lerp(0.82, 1.2, random()) * edgeScale;
    if (hasNearbyTree(point, personalSpacing)) continue;
    const placement = { ...point, asset, width, height, spacing: personalSpacing, rotation: random() * Math.PI * 2, shade: random() };
    placements.push(placement);
    const key = bucketKey(placement);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(placement);
  }

  placements.sort((a, b) => a.y - b.y);
  placements.forEach((placement, index) => {
    const texture = PIXI.Texture.from(placement.asset.src);
    let tree;
    try { tree = new PIXI.Sprite({ texture }); }
    catch { tree = new PIXI.Sprite(texture); }
    tree.anchor?.set?.(0.5);
    tree.position.set(placement.x, placement.y);
    tree.width = placement.width;
    tree.height = placement.height;
    tree.rotation = placement.rotation;
    tree.alpha = 1;
    tree.tint = Number(placement.asset.tint ?? forestTint());
    tree.zIndex = index;
    tree.eventMode = "none";
    tree.interactive = false;
    container.addChild(tree);
  });
  return container;
}

function weightedForestAsset(assets, roll) {
  const choices = Array.isArray(assets) ? assets : [];
  const total = choices.reduce((sum, asset) => sum + Math.max(0, Number(asset.weight ?? 1)), 0);
  if (!choices.length || total <= 0) return null;
  let cursor = roll * total;
  for (const asset of choices) {
    cursor -= Math.max(0, Number(asset.weight ?? 1));
    if (cursor <= 0) return asset;
  }
  return choices.at(-1);
}

function seededRandom(seed) {
  let state = Math.floor(stableNoise(seed) * 4294967295) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function smoothValueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smoothStep(x - x0), ty = smoothStep(y - y0);
  const top = lerp(stableNoise(`${seed}:${x0}:${y0}`), stableNoise(`${seed}:${x0 + 1}:${y0}`), tx);
  const bottom = lerp(stableNoise(`${seed}:${x0}:${y0 + 1}`), stableNoise(`${seed}:${x0 + 1}:${y0 + 1}`), tx);
  return lerp(top, bottom, ty);
}

function smoothStep(value) { return value * value * (3 - 2 * value); }
function lerp(from, to, ratio) { return from + (to - from) * ratio; }

function forestTint() {
  return 0xc6d0b8;
}

function createFeatheredFloorMask(points, bounds, edge) {
  const feather = Math.max(1, Number(edge.feather ?? 5));
  const padding = feather * 2.5;
  const fullWidth = Math.max(1, bounds.width + padding * 2);
  const fullHeight = Math.max(1, bounds.height + padding * 2);
  const resolution = Math.max(0.125, Math.min(0.5, 4096 / Math.max(fullWidth, fullHeight)));
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.ceil(fullWidth * resolution));
  element.height = Math.max(1, Math.ceil(fullHeight * resolution));
  const context = element.getContext("2d");
  if (!context) {
    const fallback = newGraphics();
    drawPolygon(fallback, points, 0xffffff);
    return fallback;
  }
  context.filter = `blur(${Math.max(0.75, feather * resolution)}px)`;
  context.fillStyle = "#ffffff";
  context.beginPath();
  points.forEach((point, index) => {
    const x = (point.x - bounds.x + padding) * resolution;
    const y = (point.y - bounds.y + padding) * resolution;
    if (!index) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  context.filter = "none";

  const texture = PIXI.Texture.from(element);
  const mask = new PIXI.Sprite(texture);
  mask.position.set(bounds.x - padding, bounds.y - padding);
  mask.scale.set(1 / resolution);
  mask.eventMode = "none";
  mask.interactive = false;
  mask._tsuOwnedTexture = texture;
  return mask;
}

function stableNoise(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash += hash << 13; hash ^= hash >>> 7; hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
  return (hash >>> 0) / 4294967295;
}

function createNaturalBoundary(points, seed, edge) {
  if (!(Number(edge.jitter) > 0)) return points;
  const result = [];
  const spacing = edge.kind === "dirt" ? 11 : 13;
  points.forEach((from, edgeIndex) => {
    const to = points[(edgeIndex + 1) % points.length];
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    const divisions = Math.max(1, Math.ceil(length / spacing));
    const normal = { x: -dy / length, y: dx / length };
    for (let step = 0; step < divisions; step += 1) {
      const ratio = step / divisions;
      const taper = step === 0 ? 0 : Math.sin(Math.PI * ratio);
      const jitter = (stableNoise(`${seed}:${edgeIndex}:${step}`) * 2 - 1) * Number(edge.jitter ?? 0) * taper;
      result.push({ x: from.x + dx * ratio + normal.x * jitter, y: from.y + dy * ratio + normal.y * jitter });
    }
  });
  return result;
}

function createFloorEdge(points, edge, seed) {
  if (edge.kind === "carpet" && edge.texture) return createTexturedFloorEdge(points, edge);
  if (edge.kind === "cut") return null;
  if (isNaturalPathEdge(edge)) return null;
  if (edge.texture) return createTexturedFloorEdge(points, edge);
  const graphics = newGraphics();
  const alpha = edge.kind === "garden" ? 0.58 : 0.72;
  const edgeWidth = Number(edge.width ?? FLOOR_EDGE_WIDTH);
  points.forEach((point, index) => drawLine(graphics, point, points[(index + 1) % points.length], edge.color, edgeWidth, alpha));
  if (edge.kind === "carpet") {
    points.forEach((point, index) => {
      if (index % 2) return;
      const next = points[(index + 1) % points.length];
      const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy) || 1;
      const side = stableNoise(`${seed}:fiber:${index}`) > 0.5 ? 1 : -1;
      const fiber = 1.5 + stableNoise(`${seed}:fiber-length:${index}`) * 2;
      drawLine(graphics, point, { x: point.x - dy / length * fiber * side, y: point.y + dx / length * fiber * side }, edge.color, 1, 0.5);
    });
  }
  graphics.eventMode = "none";
  graphics.interactive = false;
  return graphics;
}

function createTexturedFloorEdge(points, edge) {
  const container = new PIXI.Container();
  const texture = PIXI.Texture.from(edge.texture);
  const edgeWidth = Number(edge.width ?? FLOOR_EDGE_WIDTH);
  const halfWidth = edgeWidth / 2;
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const inwardNormal = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    let x = -dy / length, y = dx / length;
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if ((center.x - midpoint.x) * x + (center.y - midpoint.y) * y < 0) { x = -x; y = -y; }
    return { x, y };
  };
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy);
    const visibleLength = length - halfWidth * 2;
    if (visibleLength <= 0) return;
    const ux = dx / length, uy = dy / length;
    const inward = inwardNormal(point, next);
    let strip;
    try { strip = new PIXI.TilingSprite({ texture, width: visibleLength, height: edgeWidth }); }
    catch { strip = new PIXI.TilingSprite(texture, visibleLength, edgeWidth); }
    strip.position.set(point.x + ux * halfWidth + inward.x * halfWidth, point.y + uy * halfWidth + inward.y * halfWidth);
    strip.pivot.set(0, edgeWidth / 2);
    strip.rotation = Math.atan2(dy, dx);
    strip.tileScale?.set?.(0.2, edgeWidth / Number(edge.sourceHeight ?? 16));
    container.addChild(strip);
  });
  if (edge.corner) {
    const cornerTexture = PIXI.Texture.from(edge.corner);
    points.forEach((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const incoming = inwardNormal(previous, point);
      const outgoing = inwardNormal(point, next);
      const corner = new PIXI.Sprite(cornerTexture);
      corner.anchor.set(0.5);
      corner.position.set(
        point.x + (incoming.x + outgoing.x) * halfWidth,
        point.y + (incoming.y + outgoing.y) * halfWidth,
      );
      corner.width = edgeWidth;
      corner.height = edgeWidth;
      container.addChild(corner);
    });
  }
  container.eventMode = "none";
  container.interactive = false;
  return container;
}

function redrawEditor(cursor = null) {
  drawEditorData(getSceneData(), cursor);
}

function drawEditorData(data, cursor = null) {
  const container = getEditorContainer();
  if (!container) return;
  clearContainer(container);
  container._previewData = data;
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  const graphics = newGraphics();
  for (const floor of data.floors) {
    if (Number(floor.level ?? 0) !== currentLevel) continue;
    if (floor.source !== "manual") continue;
    floor.points.forEach((point, index) => {
      const next = floor.points[(index + 1) % floor.points.length];
      const chosen = selectedEdge?.floorId === floor.id && selectedEdge.edgeIndex === index;
      drawLine(graphics, point, next, chosen ? 0xffaa00 : 0x35c9ff, chosen ? 5 : 3, 0.95);
    });
  }
  draftPoints.forEach((point, index) => {
    if (index) drawLine(graphics, draftPoints[index - 1], point, 0x35c9ff, 3, 0.95);
  });
  if (draftPoints.length && cursor) drawLine(graphics, draftPoints.at(-1), snapPoint(cursor), 0xffffff, 2, 0.7);
  container.addChild(graphics);
}

function scheduleRedraw() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => {
    redrawFloors();
    redrawEditor();
  }, 25);
}

Hooks.on("canvasReady", () => {
  currentLevel = canvas?.level ? getFloorNumberForNativeLevel(canvas.level) : 0;
  selectedLevel = currentLevel;
  bindStageEvents();
  scheduleRedraw();
});
Hooks.on("canvasTearDown", () => {
  clearContainer(getFloorContainer(false));
  clearContainer(getEditorContainer(false));
  draftPoints = [];
  selectedEdge = null;
  lastClick = null;
  unbindStageEvents();
});
Hooks.on("updateScene", (_scene, change) => {
  if (foundry.utils.hasProperty(change, `flags.${MODULE_ID}.${FLAG_ROOT}`)
      || foundry.utils.hasProperty(change, "grid")
      || foundry.utils.hasProperty(change, "width")
      || foundry.utils.hasProperty(change, "height")) scheduleRedraw();
});

function wallSegments() {
  return (canvas?.scene?.walls ?? []).map((wall) => wall.c).filter((c) => Array.isArray(c) && c.length >= 4)
    .map((c) => ({ a: { x: Number(c[0]), y: Number(c[1]) }, b: { x: Number(c[2]), y: Number(c[3]) } }))
    .filter(({ a, b }) => distance(a, b) > EPSILON);
}

function splitSegments(segments) {
  const cuts = segments.map(() => [0, 1]);
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const hit = segmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (!hit) continue;
      cuts[i].push(hit.t);
      cuts[j].push(hit.u);
    }
  }
  const result = [];
  segments.forEach((segment, index) => {
    const values = [...new Set(cuts[index].filter((n) => n >= -EPSILON && n <= 1 + EPSILON).map((n) => Math.round(n * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let i = 1; i < values.length; i += 1) {
      const a = interpolate(segment.a, segment.b, values[i - 1]);
      const b = interpolate(segment.a, segment.b, values[i]);
      if (distance(a, b) > EPSILON) result.push({ a, b });
    }
  });
  return result;
}

function findWallFaces() {
  const segments = splitSegments(wallSegments());
  const vertices = new Map();
  const key = (p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
  const vertex = (p) => {
    const k = key(p);
    if (!vertices.has(k)) vertices.set(k, { ...p, key: k, outgoing: [] });
    return vertices.get(k);
  };
  const directed = [];
  for (const segment of segments) {
    const a = vertex(segment.a);
    const b = vertex(segment.b);
    const ab = { from: a, to: b, visited: false };
    const ba = { from: b, to: a, visited: false };
    ab.twin = ba; ba.twin = ab;
    a.outgoing.push(ab); b.outgoing.push(ba);
    directed.push(ab, ba);
  }
  for (const v of vertices.values()) v.outgoing.sort((x, y) => edgeAngle(x) - edgeAngle(y));
  const faces = [];
  for (const start of directed) {
    if (start.visited) continue;
    const points = [];
    let edge = start;
    let guard = 0;
    while (!edge.visited && guard++ < directed.length + 1) {
      edge.visited = true;
      points.push({ x: edge.from.x, y: edge.from.y });
      const outgoing = edge.to.outgoing;
      const twinIndex = outgoing.indexOf(edge.twin);
      edge = outgoing[(twinIndex - 1 + outgoing.length) % outgoing.length];
      if (edge === start) break;
    }
    const polygon = normalizePolygon(points);
    // Canvas Y coordinates grow downwards. With the clockwise successor used
    // above, bounded faces have positive area and the unbounded exterior is
    // traced with negative area.
    if (edge === start && polygon.length >= 3 && polygonArea(polygon) > 1) faces.push(polygon);
  }
  return faces;
}

function findWallFace(point) {
  return findWallFaces().filter((polygon) => pointInPolygon(point, polygon))
    .sort((a, b) => Math.abs(polygonArea(a)) - Math.abs(polygonArea(b)))[0] ?? null;
}

function edgeAngle(edge) { return Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x); }
function interpolate(a, b, tValue) { return { x: a.x + (b.x - a.x) * tValue, y: a.y + (b.y - a.y) * tValue }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function polygonArea(points) { return points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2; }
function normalizePolygon(points) {
  const clean = (Array.isArray(points) ? points : []).map((p) => ({ x: Number(p.x), y: Number(p.y) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length > 1 && distance(clean[0], clean.at(-1)) < EPSILON) clean.pop();
  return clean.filter((point, index) => index === 0 || distance(point, clean[index - 1]) >= EPSILON);
}
function polygonBounds(points) {
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function orientation(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function segmentsCross(a, b, c, d) {
  const o1 = orientation(a, b, c); const o2 = orientation(a, b, d); const o3 = orientation(c, d, a); const o4 = orientation(c, d, b);
  return o1 * o2 < -EPSILON && o3 * o4 < -EPSILON;
}
function polygonSelfIntersects(points) {
  for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1)) continue;
    if (segmentsCross(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return true;
  }
  return false;
}
function segmentIntersection(a, b, c, d) {
  const rx = b.x - a.x; const ry = b.y - a.y; const sx = d.x - c.x; const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < EPSILON) return null;
  const qx = c.x - a.x; const qy = c.y - a.y;
  const tValue = (qx * sy - qy * sx) / denominator;
  const uValue = (qx * ry - qy * rx) / denominator;
  if (tValue < -EPSILON || tValue > 1 + EPSILON || uValue < -EPSILON || uValue > 1 + EPSILON) return null;
  return { t: tValue, u: uValue };
}
function pointSegmentDistance(p, a, b) {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!length2) return distance(p, a);
  const tValue = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2));
  return distance(p, interpolate(a, b, tValue));
}
function distanceToPolygon(point, polygon) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    minimum = Math.min(minimum, pointSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return minimum;
}
function polygonsEquivalent(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  const keys = (points) => points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  const left = keys(a); const right = keys(b); const doubled = `${right.join("|")}|${right.join("|")}`;
  const reversed = [...right].reverse(); const doubledReverse = `${reversed.join("|")}|${reversed.join("|")}`;
  return doubled.includes(left.join("|")) || doubledReverse.includes(left.join("|"));
}
