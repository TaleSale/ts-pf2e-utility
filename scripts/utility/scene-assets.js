import { MODULE_ID, i18nKey, t } from "../core.js";

const SETTING_ENABLE = "enableSceneAssets";
const SETTING_SETS = "sceneAssetSets";
const CONTROL_NAME = "tsu-scene-tools";
const ASSET_TOOL_NAME = "asset-library";
const PICKER_CLASS = "tsu-asset-picker";
const PREVIEW_NAME = "tsu-asset-preview";
const SELECTION_NAME = "tsu-asset-selection";
const SELECTION_DRAG_NAME = "tsu-asset-selection-drag";
const FLAG_ROOT = "sceneAsset";
const DEFAULT_ASSET = "table";
const ROTATION_STEP = 15;
const MOVEMENT_STEP_RATIO = 0.1;
const SIZE_STEP_CELLS = 0.1;
const MIN_SIZE_CELLS = 0.2;
const MAX_SIZE_CELLS = 6;

export const LIGHT_PRESETS = Object.freeze({
  torch: Object.freeze({ bright: 20, dim: 40, color: "#ff9b45", alpha: 0.38, angle: 360, negative: false, animation: { type: "torch", speed: 5, intensity: 5 } }),
  brazier: Object.freeze({ bright: 20, dim: 40, color: "#ff8a32", alpha: 0.42, angle: 360, negative: false, animation: { type: "flame", speed: 4, intensity: 6 } }),
  candle: Object.freeze({ bright: 0, dim: 10, color: "#ffd08a", alpha: 0.28, angle: 360, negative: false, animation: { type: "flame", speed: 2, intensity: 2 } }),
  lantern: Object.freeze({ bright: 20, dim: 40, color: "#ffc56d", alpha: 0.32, angle: 360, negative: false, animation: { type: "flame", speed: 1, intensity: 2 } }),
});

export const ASSETS = Object.freeze({
  table: asset("Furniture", "Table", "table.webp", 1.6, "object", 1024 / 677),
  chair: asset("Furniture", "Chair", "chair.webp", 0.5, "object", 437 / 512),
  bed: asset("Furniture", "Bed", "bed.webp", 1.8, "object", 521 / 1024),
  cabinet: asset("Furniture", "Cabinet", "cabinet.webp", 1.25, "object", 1024 / 362),
  cabinetNarrow: asset("Furniture", "CabinetNarrow", "cabinet-narrow.webp", 0.44, "object", 658 / 693, null, 0, "CabinetSide"),
  tree: asset("Nature", "Tree", "tree.webp", 2, "overhead", 1142 / 1140),
  ruins: asset("Ruins", "Ruins", "ruins.webp", 1.8, "object", 1100 / 1127),
  corpse: asset("Remains", "Corpse", "corpse.webp", 1.5, "object", 863 / 1024),
  blood: asset("Traces", "Blood", "blood.webp", 1, "ground", 1024 / 775),
  torch: asset("Lighting", "Torch", "torch.webp", 0.3, "object", 512 / 462, "torch"),
  brazier: asset("Lighting", "Brazier", "brazier.webp", 0.7, "object", 998 / 1017, "brazier"),
  roundTable: asset("Furniture", "RoundTable", "round-table.webp", 1, "object", 968 / 1024),
  stool: asset("Furniture", "Stool", "stool.webp", 0.4, "object", 436 / 512),
  chest: asset("Furniture", "Chest", "chest.webp", 0.8, "object", 1024 / 728),
  bookshelf: asset("Furniture", "Bookshelf", "bookshelf.webp", 1.2, "object", 1024 / 378),
  bookshelfNarrow: asset("Furniture", "BookshelfNarrow", "bookshelf-narrow.webp", 0.44, "object", 687 / 789, null, 0, "BookshelfSide"),
  barrel: asset("Household", "Barrel", "barrel.webp", 0.6, "object", 644 / 768),
  crate: asset("Household", "Crate", "crate.webp", 0.6, "object", 747 / 768),
  sacks: asset("Household", "Sacks", "sacks.webp", 0.9, "object", 1024 / 995),
  tub: asset("Household", "Tub", "tub.webp", 1.1, "object", 1024 / 666),
  cauldron: asset("Household", "Cauldron", "cauldron.webp", 0.7, "object", 741 / 768),
  candle: asset("Lighting", "Candle", "candle.webp", 0.2, "object", 512 / 445, "candle"),
  lantern: asset("Lighting", "Lantern", "lantern.webp", 0.3, "object", 315 / 512, "lantern"),
  pineTree: asset("Nature", "PineTree", "pine-tree.webp", 2, "overhead", 817 / 1232),
  deadTree: asset("Nature", "DeadTree", "dead-tree.webp", 2, "overhead", 1157 / 1226),
  bush: asset("Nature", "Bush", "bush.webp", 1, "overhead", 1024 / 1003),
  stump: asset("Nature", "Stump", "stump.webp", 0.8, "object", 768 / 738),
  rocks: asset("Nature", "Rocks", "rocks.webp", 1.1, "object", 1024 / 915),
  logs: asset("Nature", "Logs", "logs.webp", 1.4, "object", 1015 / 863),
  bridge: asset("Outdoors", "Bridge", "bridge.webp", 3, "object", 1536 / 534),
  well: asset("Outdoors", "Well", "well.webp", 1.5, "object", 952 / 1144),
  pond: asset("Water", "Pond", "pond.webp", 3, "ground", 1110 / 954),
  lake: asset("Water", "Lake", "lake.webp", 5, "ground", 1536 / 817),
  brokenBoards: asset("Ruins", "BrokenBoards", "broken-boards.webp", 1.4, "object", 1024 / 822),
  fallenColumn: asset("Ruins", "FallenColumn", "fallen-column.webp", 1.8, "object", 1024 / 965),
  skeleton: asset("Remains", "Skeleton", "skeleton.webp", 1.5, "object", 775 / 1024),
  redRug: asset("Decor", "RedRug", "rug-red.webp", 1.8, "ground", 491 / 1024),
  booksScrolls: asset("Decor", "BooksScrolls", "books-scrolls.webp", 0.8, "object", 768 / 576),
  goldPile: asset("Decor", "GoldPile", "gold-pile.webp", 0.8, "object", 953 / 917, null, 0, "GoldPile"),
  mud: asset("Traces", "Mud", "mud.webp", 1.5, "ground", 1024 / 799),
  waterPuddle: asset("Traces", "WaterPuddle", "water-puddle.webp", 1.2, "ground", 1020 / 772),
  ash: asset("Traces", "Ash", "ash.webp", 1.3, "ground", 1024 / 930),
  footprints: asset("Traces", "Footprints", "footprints.webp", 1.5, "ground", 657 / 1024),
  longTable: asset("Furniture", "LongTable", "long-table.webp", 2, "object", 1024 / 399),
  banquetTable: asset("Furniture", "BanquetTable", "banquet-table.webp", 2, "object", 1024 / 425),
  bench: asset("Furniture", "Bench", "bench.webp", 1.5, "object", 1024 / 388),
  pew: asset("TempleStage", "Pew", "pew.webp", 2, "object", 1024 / 453),
  desk: asset("Furniture", "Desk", "desk.webp", 1.3, "object", 1024 / 684),
  throne: asset("TempleStage", "Throne", "throne.webp", 1, "object", 615 / 1024),
  altar: asset("TempleStage", "Altar", "altar.webp", 1.5, "object", 1024 / 598),
  lectern: asset("TempleStage", "Lectern", "lectern.webp", 0.8, "object", 574 / 768),
  statue: asset("TempleStage", "Statue", "statue.webp", 1.3, "overhead", 629 / 1024),
  standingColumn: asset("TempleStage", "StandingColumn", "standing-column.webp", 1, "overhead", 655 / 817),
  ritualCircle: asset("TempleStage", "RitualCircle", "ritual-circle.webp", 1.8, "ground", 1024 / 1016),
  ladder: asset("Transitions", "Ladder", "ladder.webp", 1.5, "ground", 1024 / 271),
  ladderVertical: asset("Transitions", "LadderVertical", "ladder-vertical.webp", 1.5, "ground", 234 / 1024),
  trapdoor: asset("Transitions", "Trapdoor", "trapdoor.webp", 0.8, "ground", 744 / 768),
  stairsUp: asset("Transitions", "StairsUp", "stairs-up.webp", 2, "ground", 444 / 1024),
  stairsDown: asset("Transitions", "StairsDown", "stairs-down.webp", 2, "ground", 410 / 1024),
  shortStairsUp: asset("Transitions", "ShortStairsUp", "short-stairs-up.webp", 1.2, "ground", 596 / 1024, null, 0, "ShortStairsUp"),
  shortStairsDown: asset("Transitions", "ShortStairsDown", "short-stairs-down.webp", 1.2, "ground", 577 / 968, null, 0, "ShortStairsDown"),
  dockStraight: asset("Dock", "DockStraight", "dock-straight.webp", 3, "ground", 1536 / 397),
  dockCorner: asset("Dock", "DockCorner", "dock-corner.webp", 3, "ground", 817 / 1192),
  rowboat: asset("Dock", "Rowboat", "rowboat.webp", 2.2, "object", 516 / 1440),
  fountain: asset("Outdoors", "Fountain", "fountain.webp", 1.5, "object", 980 / 996),
  mooringPosts: asset("Dock", "MooringPosts", "mooring-posts.webp", 0.7, "object", 768 / 288),
});

const CATEGORIES = Object.freeze(["Furniture", "Household", "TempleStage", "Lighting", "Nature", "Outdoors", "Dock", "Water", "Transitions", "Ruins", "Decor", "Traces", "Remains"]);
const LAYERS = Object.freeze({ ground: -100, object: 0, overhead: 100 });

function asset(category, label, filename, size, layer, aspect, light = null, defaultRotation = 0, labelPath = null) {
  return Object.freeze({
    category,
    labelKey: `Settings.SceneAssets.${labelPath ?? `Choices.${label}`}`,
    fallback: label,
    src: `modules/${MODULE_ID}/images/scene-assets/${filename}`,
    size,
    aspect,
    layer,
    light,
    defaultRotation,
  });
}

let active = false;
let activeTool = "place";
let selectedKey = null;
let selectedSetId = null;
let selectedLayer = ASSETS[DEFAULT_ASSET].layer;
let scale = 1;
let rotation = 0;
let flipped = false;
let cursor = null;
let stageBound = null;
let canvasElementBound = null;
let placing = false;
let lightSettings = null;
let libraryRequested = false;
const selectedTileIds = new Set();
let selectionDrag = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey("Settings.SceneAssets.Name"),
    hint: i18nKey("Settings.SceneAssets.Hint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => ui.controls?.render?.({ reset: true }),
  });
  game.settings.register(MODULE_ID, SETTING_SETS, {
    name: "Scene asset sets",
    scope: "world",
    config: false,
    default: { version: 1, sets: [] },
    type: Object,
    onChange: () => rerenderPicker(),
  });
});

function getSets() {
  const value = game.settings.get(MODULE_ID, SETTING_SETS);
  return Array.isArray(value?.sets) ? foundry.utils.deepClone(value.sets) : [];
}

async function setSets(sets) {
  await game.settings.set(MODULE_ID, SETTING_SETS, { version: 1, sets });
}

function rerenderPicker() {
  const root = document.querySelector("#scene-controls");
  if (root && active) renderPicker(root);
}

function forceOpenAssetLibrary(tool = "place") {
  if (!enabled()) return;
  document.dispatchEvent(new CustomEvent("tsu-scene-panel", { detail: "assets" }));
  libraryRequested = true;
  const desiredTool = ["select", "erase", "place"].includes(tool) ? tool : "place";
  active = true;
  activate(desiredTool);
  active = true;
  activeTool = desiredTool;
  const root = document.querySelector("#scene-controls");
  if (root) renderPicker(root);
}

function enabled() {
  return Boolean(game.user?.isGM && game.settings.get(MODULE_ID, SETTING_ENABLE));
}

function localize(key, fallback) {
  return t(`Settings.SceneAssets.${key}`, fallback);
}

function htmlEscape(value) {
  return foundry.utils.escapeHTML?.(String(value)) ?? String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!enabled()) return;
  const nativeTiles = controls.tiles;
  if (!nativeTiles?.tools?.select) return;
  const group = {
    name: CONTROL_NAME,
    order: 76,
    title: localize("Control", "Scene tools"),
    icon: "fa-solid fa-toolbox",
    layer: "tiles",
    layerName: "tiles",
    activeTool: ASSET_TOOL_NAME,
    tools: { select: { ...nativeTiles.tools.select, order:0 } },
  };
  group.tools[ASSET_TOOL_NAME] = { name:ASSET_TOOL_NAME, order:1, title:localize("Library","Asset library"), icon:"fa-solid fa-couch", visible:true, onChange:(_event,value)=>{if(value!==false)forceOpenAssetLibrary(activeTool);else if(ui.controls?.tool?.name!=="select")deactivate({releaseSelection:false});} };
  controls[CONTROL_NAME] = group;
});

document.addEventListener("pointerdown", (event) => {
  const controlButton = event.composedPath?.().find((node)=>node instanceof HTMLElement && node.dataset?.control===CONTROL_NAME);
  const toolButton = event.composedPath?.().find((node)=>node instanceof HTMLElement && node.dataset?.tool);
  if (!controlButton && (!toolButton || toolButton.dataset.tool===ASSET_TOOL_NAME)) return;
  deactivate({releaseSelection:false});
}, true);

document.addEventListener("tsu-scene-panel", (event) => {
  if (event.detail !== "assets") deactivate({releaseSelection:false});
});

Hooks.on("renderSceneControls", (_app, element) => queueMicrotask(() => {
  const root = getRoot(element);
  const nativeSelectButton = root?.querySelector?.('[data-tool="select"]');
  if (nativeSelectButton && ui.controls?.control?.name === CONTROL_NAME) nativeSelectButton.style.display = "none";
  const assetButton = root?.querySelector?.(`[data-tool="${ASSET_TOOL_NAME}"]`);
  if (assetButton && !assetButton.dataset.tsuAssetOpenBound) {
    assetButton.dataset.tsuAssetOpenBound = "true";
    assetButton.addEventListener("click", () => queueMicrotask(() => forceOpenAssetLibrary(activeTool)));
  }
  if (libraryRequested && ui.controls?.control?.name === CONTROL_NAME && [ASSET_TOOL_NAME,"select"].includes(ui.controls?.tool?.name)) activate(activeTool);
  else deactivate({releaseSelection:ui.controls?.control?.name !== CONTROL_NAME});
  renderPicker(element);
}));

function activate(tool = "place") {
  if (!enabled()) return;
  active = true;
  activeTool = ["erase", "select"].includes(tool) ? tool : "place";
  if (activeTool === "select") {
    unbindStage();
    document.querySelector(`.${PICKER_CLASS}`)?.classList.remove("hidden");
    clearPreview();
    updateEraseButton();
    return;
  }
  if (activeTool === "erase") selectAsset(null);
  bindStage();
  document.querySelector(`.${PICKER_CLASS}`)?.classList.remove("hidden");
  redrawPreview();
}

function activateNativeSelection() {
  if (!enabled()) return;
  active = true;
  activeTool = "select";
  selectedKey = null;
  selectedSetId = null;
  unbindStage();
  clearPreview();
  document.querySelector(`.${PICKER_CLASS}`)?.classList.remove("hidden");
  syncNativeSelection();
  updateEraseButton();
}

function deactivate({releaseSelection=true}={}) {
  active = false;
  libraryRequested = false;
  unbindStage();
  cursor = null;
  selectedKey = null;
  selectedSetId = null;
  resetTransform();
  clearPreview();
  if (releaseSelection) releaseNativeTiles();
  selectedTileIds.clear(); drawSelection();
  document.querySelector(`.${PICKER_CLASS}`)?.classList.add("hidden");
}

export function closeAssetLibrary() { deactivate(); }

function resetTransform() {
  scale = 1;
  rotation = 0;
  flipped = false;
  redrawPreview();
  updatePickerState();
}

function resetOrientation() {
  rotation = 0;
  flipped = false;
  redrawPreview();
  updatePickerState();
}

function getRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return document.querySelector("#scene-controls");
}

function renderPicker(element) {
  document.querySelector(`.${PICKER_CLASS}`)?.remove();
  if (!enabled() || !active) return;
  const root = getRoot(element) ?? document.querySelector("#scene-controls");
  if (!root) return;

  const picker = document.createElement("section");
  picker.className = PICKER_CLASS;
  const header = document.createElement("header");
  header.innerHTML = `<strong>${localize("Library", "Asset library")}</strong><span data-transform></span>`;
  const categories = document.createElement("div");
  categories.className = "tsu-asset-categories";

  for (const category of CATEGORIES) {
    const entries = Object.entries(ASSETS).filter(([, definition]) => definition.category === category);
    if (!entries.length) continue;
    const group = document.createElement("details");
    group.open = entries.some(([key]) => key === selectedKey);
    const summary = document.createElement("summary");
    summary.textContent = localize(`Categories.${category}`, category);
    const grid = document.createElement("div");
    grid.className = "tsu-asset-grid";
    for (const [key, definition] of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.asset = key;
      button.title = t(definition.labelKey, definition.fallback);
      button.innerHTML = `<img src="${definition.src}" alt=""><span>${t(definition.labelKey, definition.fallback)}</span>`;
      button.classList.toggle("selected", key === selectedKey);
      button.addEventListener("click", () => selectAsset(selectedKey === key ? null : key));
      grid.append(button);
    }
    group.append(summary, grid);
    categories.append(group);
  }

  const sets = getSets();
  if (sets.length) {
    const group = document.createElement("details");
    group.open = Boolean(selectedSetId);
    const summary = document.createElement("summary");
    summary.textContent = localize("Sets", "Sets");
    const grid = document.createElement("div");
    grid.className = "tsu-asset-grid tsu-asset-set-grid";
    for (const set of sets) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.setId = set.id;
      button.title = set.name;
      button.classList.toggle("selected", set.id === selectedSetId);
      const thumbs = set.items.slice(0, 4).map((item) => `<img src="${htmlEscape(item.texture?.src ?? "")}" alt="">`).join("");
      button.innerHTML = `<span class="tsu-set-thumbs">${thumbs}</span><span>${htmlEscape(set.name)}</span><i class="fa-solid fa-trash" data-delete-set title="${localize("DeleteSet", "Delete set")}"></i>`;
      button.addEventListener("click", (event) => {
        if (event.target.closest("[data-delete-set]")) return deleteSet(set.id, set.name);
        selectSet(selectedSetId === set.id ? null : set.id);
      });
      grid.append(button);
    }
    group.append(summary, grid);
    categories.append(group);
  }

  const footer = document.createElement("footer");
  footer.innerHTML = `
    <label>${localize("Layer", "Layer")}
      <select data-layer>
        <option value="ground">${localize("Layers.Ground", "Ground")}</option>
        <option value="object">${localize("Layers.Object", "Object")}</option>
        <option value="overhead">${localize("Layers.Overhead", "Overhead")}</option>
      </select>
    </label>
    <button type="button" data-action="place" title="${localize("Place", "Place asset")}"><i class="fa-solid fa-stamp"></i></button>
    <button type="button" data-action="select" title="${localize("Select", "Select and transform tiles")}"><i class="fa-solid fa-expand"></i></button>
    <button type="button" data-action="erase" title="${localize("Erase", "Erase asset")}"><i class="fa-solid fa-eraser"></i></button>
    <button type="button" data-action="save" title="${localize("SaveSet", "Save selected tiles as set")}"><i class="fa-solid fa-layer-group"></i></button>`;
  footer.querySelector("[data-layer]").value = selectedLayer;
  footer.querySelector("[data-layer]").addEventListener("change", (event) => {
    selectedLayer = event.currentTarget.value;
    redrawPreview();
  });
  footer.querySelector('[data-action="place"]').addEventListener("click", () => {
    activeTool="place"; libraryRequested=true;
    ui.controls?.activate?.({control:CONTROL_NAME,tool:ASSET_TOOL_NAME});
    updateEraseButton(); drawSelection();
  });
  footer.querySelector('[data-action="select"]').addEventListener("click", () => {
    activeTool="select"; libraryRequested=true; unbindStage(); clearPreview();
    canvas?.tiles?.activate?.({tool:"select"});
    libraryRequested=true;
    queueMicrotask(() => {
      ui.controls?.activate?.({control:CONTROL_NAME,tool:"select"});
      libraryRequested=true;
      const root=document.querySelector("#scene-controls"); if(root)renderPicker(root);
    });
    updateEraseButton(); drawSelection();
  });
  footer.querySelector('[data-action="erase"]').addEventListener("click", () => {
    activeTool = activeTool === "erase" ? "place" : "erase";
    if (activeTool === "erase") selectAsset(null);
    redrawPreview();
    updateEraseButton();
  });
  footer.querySelector('[data-action="save"]').addEventListener("click", saveSelectedTilesAsSet);

  const lightPanel = document.createElement("div");
  lightPanel.className = "tsu-asset-light-settings";
  lightPanel.innerHTML = `
    <label>${localize("LightColor", "Color")}<input type="color" data-light="color"></label>
    <label>${localize("BrightRadius", "Bright (ft)")}<input type="number" min="0" step="1" data-light="bright"></label>
    <label>${localize("DimRadius", "Dim (ft)")}<input type="number" min="0" step="1" data-light="dim"></label>
    <label>${localize("LightAngle", "Angle")}<select data-light="angle"><option value="360">360°</option><option value="180">180°</option><option value="90">90°</option><option value="45">45°</option></select></label>
    <label>${localize("LightKind", "Kind")}<select data-light="negative"><option value="false">${localize("PositiveLight", "Light")}</option><option value="true">${localize("NegativeLight", "Darkness")}</option></select></label>`;
  lightPanel.querySelectorAll("[data-light]").forEach((input) => input.addEventListener("change", () => {
    if (!lightSettings) return;
    const field = input.dataset.light;
    lightSettings[field] = field === "color" ? input.value : field === "negative" ? input.value === "true" : Math.max(0, Number(input.value) || 0);
  }));

  const help = document.createElement("p");
  help.className = "tsu-asset-help";
  help.textContent = localize("Help", "Move: 0.1 grid · Ctrl+wheel: size · Shift+wheel: rotate 15° · Select mode: transform selected tiles, Delete removes them");
  picker.append(header, footer, lightPanel, help, categories);
  document.body.append(picker);
  updatePickerState();
  updateLightPanel();
  updateEraseButton();
  requestAnimationFrame(positionPicker);
}

function selectAsset(key) {
  if (key !== null && !ASSETS[key]) return;
  const changed = selectedKey !== key;
  selectedKey = key;
  selectedSetId = null;
  if (key) {
    selectedLayer = ASSETS[key].layer;
    activeTool = "place";
  }
  if (changed) {
    resetTransform();
    rotation = Number(key ? ASSETS[key].defaultRotation : 0) || 0;
    updatePickerState();
    const preset = key ? LIGHT_PRESETS[ASSETS[key].light] : null;
    lightSettings = preset ? foundry.utils.deepClone(preset) : null;
  }
  document.querySelectorAll(`.${PICKER_CLASS} [data-asset]`).forEach((button) => button.classList.toggle("selected", button.dataset.asset === key));
  const layer = document.querySelector(`.${PICKER_CLASS} [data-layer]`);
  if (layer) layer.value = selectedLayer;
  updateLightPanel();
  updateEraseButton();
  redrawPreview();
  if (key) switchToPlacementMode();
}

function selectSet(id) {
  selectedSetId = id;
  selectedKey = null;
  activeTool = "place";
  lightSettings = null;
  resetTransform();
  document.querySelectorAll(`.${PICKER_CLASS} [data-set-id]`).forEach((button) => button.classList.toggle("selected", button.dataset.setId === id));
  document.querySelectorAll(`.${PICKER_CLASS} [data-asset]`).forEach((button) => button.classList.remove("selected"));
  updateLightPanel();
  updateEraseButton();
  redrawPreview();
  if (id) switchToPlacementMode();
}

function switchToPlacementMode() {
  activeTool = "place";
  libraryRequested = true;
  ui.controls?.activate?.({control:CONTROL_NAME,tool:ASSET_TOOL_NAME});
  forceOpenAssetLibrary("place");
  queueMicrotask(() => {
    if (!selectedKey && !selectedSetId) return;
    libraryRequested = true;
    activate("place");
  });
}

function updateEraseButton() {
  document.querySelector(`.${PICKER_CLASS} [data-action="erase"]`)?.classList.toggle("active", activeTool === "erase");
  document.querySelector(`.${PICKER_CLASS} [data-action="select"]`)?.classList.toggle("active", activeTool === "select");
  document.querySelector(`.${PICKER_CLASS} [data-action="place"]`)?.classList.toggle("active", activeTool === "place");
}

function nativeSelectionMode() {
  return active && ui.controls?.control?.name === CONTROL_NAME && ui.controls?.tool?.name === "select";
}

function updateLightPanel() {
  const panel = document.querySelector(`.${PICKER_CLASS} .tsu-asset-light-settings`);
  if (!panel) return;
  panel.classList.toggle("visible", Boolean(lightSettings));
  if (!lightSettings) return;
  for (const input of panel.querySelectorAll("[data-light]")) input.value = String(lightSettings[input.dataset.light] ?? "");
}

function updatePickerState() {
  const display = document.querySelector(`.${PICKER_CLASS} [data-transform]`);
  if (!display) return;
  const set = selectedSetId ? getSets().find((candidate) => candidate.id === selectedSetId) : null;
  const cells = selectedKey ? Math.round(ASSETS[selectedKey].size * scale * 100) / 100
    : set ? Math.round(Math.max(set.width, set.height) * scale * 100) / 100 : null;
  display.textContent = cells === null ? "" : `${cells}□ · ${rotation}°${flipped ? " · ↔" : ""}`;
}

function positionPicker() {
  const picker = document.querySelector(`.${PICKER_CLASS}`);
  if (!(picker instanceof HTMLElement)) return;
  const tools = Array.from(document.querySelectorAll("#scene-controls-tools .tool"));
  const anchor = tools.at(-1) ?? document.querySelector(`[data-control="${CONTROL_NAME}"]`);
  if (!(anchor instanceof HTMLElement)) return;
  const rect = anchor.getBoundingClientRect();
  picker.style.left = `${Math.max(8, rect.left)}px`;
  picker.style.top = `${Math.min(window.innerHeight - picker.offsetHeight - 8, rect.bottom + 8)}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(positionPicker));

function bindStage() {
  const element = document.getElementById("board") ?? canvas?.app?.canvas ?? canvas?.app?.renderer?.canvas ?? canvas?.app?.view;
  if (!(element instanceof HTMLElement) || canvasElementBound === element) return;
  unbindStage();
  canvasElementBound = element;
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerUp, true);
}

function unbindStage() {
  if (canvasElementBound) {
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerUp, true);
  }
  canvasElementBound = null;
  stageBound = null;
  selectionDrag = null;
  clearSelectionDrag();
}

function eventPoint(event) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
    const element = canvasElementBound ?? document.getElementById("board") ?? canvas?.app?.canvas ?? canvas?.app?.renderer?.canvas ?? canvas?.app?.view;
    const rectangle = element?.getBoundingClientRect?.();
    const screen = canvas?.app?.renderer?.screen;
    if (rectangle?.width && rectangle?.height && screen && canvas?.stage?.worldTransform) {
      const global = {
        x: (event.clientX - rectangle.left) * Number(screen.width) / rectangle.width,
        y: (event.clientY - rectangle.top) * Number(screen.height) / rectangle.height,
      };
      const local = canvas.stage.worldTransform.applyInverse(global);
      return { x:Number(local.x), y:Number(local.y) };
    }
  }
  const global = event?.global ?? event?.data?.global;
  if (!global || !canvas?.stage?.worldTransform) return null;
  const local = canvas.stage.worldTransform.applyInverse(global);
  return { x: Number(local.x), y: Number(local.y) };
}

function eventOnCanvas(event) {
  const element = canvasElementBound ?? document.getElementById("board");
  return Boolean(element && (event.target === element || element.contains?.(event.target)));
}

function snapPlacementPoint(point, free = false) {
  if (free || !point) return point;
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const step = Math.max(1, grid * MOVEMENT_STEP_RATIO);
  const rect = canvas?.dimensions?.sceneRect ?? { x: 0, y: 0 };
  return {
    x: Number(rect.x ?? 0) + Math.round((point.x - Number(rect.x ?? 0)) / step) * step,
    y: Number(rect.y ?? 0) + Math.round((point.y - Number(rect.y ?? 0)) / step) * step,
  };
}

function freeTransform(event = null) {
  return Boolean(event?.altKey || event?.nativeEvent?.altKey || game.keyboard?.isModifierActive?.("ALT"));
}

function onPointerMove(event) {
  if (!active) return;
  if (activeTool === "select" && selectionDrag) {
    selectionDrag.current = eventPoint(event) ?? selectionDrag.current;
    selectionDrag.currentClient = { x:event.clientX, y:event.clientY };
    drawSelectionDrag();
    return;
  }
  if (!eventOnCanvas(event)) return;
  cursor = snapPlacementPoint(eventPoint(event), freeTransform(event));
  redrawPreview();
}

async function onPointerDown(event) {
  if (!active || placing || !eventOnCanvas(event)) return;
  if (activeTool === "select") {
    if (event.button !== 0) return;
    const point = eventPoint(event); if (!point) return;
    event.stopPropagation?.();
    selectionDrag = {
      start: point,
      current: point,
      startClient: { x:event.clientX, y:event.clientY },
      currentClient: { x:event.clientX, y:event.clientY },
      additive: Boolean(event.ctrlKey || event.metaKey || event.nativeEvent?.ctrlKey || event.nativeEvent?.metaKey),
    };
    drawSelectionDrag();
    return;
  }
  if (event.button === 2) {
    if (activeTool === "place" && !selectedKey && !selectedSetId) return;
    event.stopPropagation?.();
    selectAsset(null);
    return;
  }
  if (event.button !== 0) return;
  if (event.nativeEvent?.target?.closest?.(`.${PICKER_CLASS}`)) return;
  const point = snapPlacementPoint(eventPoint(event), freeTransform(event));
  if (!point) return;
  event.stopPropagation?.();
  if (activeTool === "erase") return eraseAssetAt(point);
  if (!selectedKey && !selectedSetId) return;
  placing = true;
  try {
    if (selectedSetId) await placeSet(point);
    else await placeAsset(point);
  }
  finally { placing = false; }
}

function onPointerUp(event) {
  if (!active || activeTool !== "select" || !selectionDrag) return;
  const drag = selectionDrag;
  drag.current = eventPoint(event) ?? drag.current;
  selectionDrag = null;
  clearSelectionDrag();
  event.stopPropagation?.();
  if (distanceBetween(drag.start, drag.current) < 5) return selectTileAt(drag.current, { ...event, ctrlKey: drag.additive });
  selectTilesInRectangle(drag.start, drag.current, drag.additive);
}

function distanceBetween(a, b) { return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)); }

function selectTilesInRectangle(start, end, additive) {
  const rectangle = {
    left: Math.min(start.x, end.x), right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y), bottom: Math.max(start.y, end.y),
  };
  const hits = [...(canvas?.tiles?.placeables ?? [])].filter((tile) => {
    if (tile.document?.hidden) return false;
    const bounds = tile.bounds;
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
      const right = Number(bounds.right ?? (bounds.x + bounds.width));
      const bottom = Number(bounds.bottom ?? (bounds.y + bounds.height));
      return right >= rectangle.left && Number(bounds.x) <= rectangle.right
        && bottom >= rectangle.top && Number(bounds.y) <= rectangle.bottom;
    }
    const box = tileSelectionBox(tile);
    const xs = box.map((point) => point.x), ys = box.map((point) => point.y);
    return Math.max(...xs) >= rectangle.left && Math.min(...xs) <= rectangle.right
      && Math.max(...ys) >= rectangle.top && Math.min(...ys) <= rectangle.bottom;
  });
  if (!additive) releaseNativeTiles();
  for (const tile of hits) {
    if (additive && tile.controlled) tile.release?.();
    else tile.control?.({ releaseOthers:false });
  }
  syncNativeSelection();
}

function tileSelectionBox(tile) {
  const document = tile.document;
  const bounds = tile.bounds;
  if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    const right = Number(bounds.right ?? (bounds.x + bounds.width));
    const bottom = Number(bounds.bottom ?? (bounds.y + bounds.height));
    return [{x:Number(bounds.x),y:Number(bounds.y)},{x:right,y:Number(bounds.y)},{x:right,y:bottom},{x:Number(bounds.x),y:bottom}];
  }
  const center = tile.center ?? document.shape?.center ?? { x:Number(document.x), y:Number(document.y) };
  return orientedSelectionBox(Number(center.x), Number(center.y), Number(document.width), Number(document.height), Number(document.rotation ?? 0));
}

function drawSelectionDrag() {
  if (!selectionDrag) return;
  let marquee = document.querySelector(`.${SELECTION_DRAG_NAME}`);
  if (!marquee) { marquee = document.createElement("div"); marquee.className = SELECTION_DRAG_NAME; document.body.append(marquee); }
  const { startClient, currentClient } = selectionDrag;
  marquee.style.left = `${Math.min(startClient.x,currentClient.x)}px`;
  marquee.style.top = `${Math.min(startClient.y,currentClient.y)}px`;
  marquee.style.width = `${Math.abs(currentClient.x-startClient.x)}px`;
  marquee.style.height = `${Math.abs(currentClient.y-startClient.y)}px`;
}

function clearSelectionDrag() {
  document.querySelector(`.${SELECTION_DRAG_NAME}`)?.remove();
}

function selectTileAt(point, event) {
  if (!point || !canvas?.tiles) return;
  const additive = Boolean(event?.ctrlKey || event?.metaKey || event?.nativeEvent?.ctrlKey || event?.nativeEvent?.metaKey);
  const hit = [...(canvas.tiles.placeables ?? [])]
    .filter((tile) => !tile.document?.hidden && tileContainsPoint(tile, point))
    .sort((a,b) => Number(b.document?.sort ?? 0) - Number(a.document?.sort ?? 0))[0];
  event.stopPropagation?.();
  if (!hit) {
    if (!additive) releaseNativeTiles();
    syncNativeSelection();
    return;
  }
  if (additive && hit.controlled) hit.release?.();
  else hit.control?.({ releaseOthers:!additive });
  syncNativeSelection();
}

function tileContainsPoint(tile, point) {
  const document = tile?.document;
  if (!document) return false;
  try { if (tile.containsCanvasPoint?.(point)) return true; } catch {}
  try { if (tile.bounds?.contains?.(point.x, point.y)) return true; } catch {}
  const shapeCenter = document.shape?.center;
  const placeableCenter = tile.center;
  const center = {
    x: Number(placeableCenter?.x ?? shapeCenter?.x ?? document.x),
    y: Number(placeableCenter?.y ?? shapeCenter?.y ?? document.y),
  };
  const radians = -Number(document.rotation ?? 0) * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= Number(document.width ?? 0) / 2
    && Math.abs(localY) <= Number(document.height ?? 0) / 2;
}

function releaseNativeTiles() { canvas?.tiles?.releaseAll?.(); }
function syncNativeSelection() {
  selectedTileIds.clear();
  for (const tile of canvas?.tiles?.controlled ?? []) if (tile.document?.id) selectedTileIds.add(tile.document.id);
  drawSelection();
}
function selectedTiles() {
  const controlled = (canvas?.tiles?.controlled ?? []).map((tile)=>tile.document).filter(Boolean);
  return controlled.length ? controlled : [...selectedTileIds].map((id)=>canvas?.scene?.tiles?.get(id)).filter(Boolean);
}
function overlayParent() { return canvas?.interface ?? canvas?.stage; }
function drawSelection() {
  const parent=overlayParent(); if(!parent)return;
  let container=parent.children?.find((child)=>child.name===SELECTION_NAME);
  if(!container){container=new PIXI.Container();container.name=SELECTION_NAME;container.eventMode="none";container.zIndex=2100;parent.addChild(container);}
  container.removeChildren().forEach((child)=>child.destroy?.({children:true}));
  if(!active||activeTool!=="select")return;
  for(const tile of selectedTiles()){
    const box=tileSelectionBox(tile.object ?? canvas?.tiles?.get?.(tile.id) ?? {document:tile,center:tile.shape?.center});
    const graphics=new PIXI.Graphics();
    const coordinates=box.flatMap((p)=>[p.x,p.y]);
    if(typeof graphics.poly==="function"&&typeof graphics.stroke==="function") graphics.poly(coordinates).stroke({color:0xd8a7ff,width:3,alpha:.95});
    else { graphics.lineStyle(3,0xd8a7ff,.95); graphics.drawPolygon(coordinates); }
    container.addChild(graphics);
  }
}
function orientedSelectionBox(x,y,width,height,rotation){const r=rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([dx,dy])=>({x:x+dx*c-dy*s,y:y+dx*s+dy*c}));}

function getPreviewContainer(create = true) {
  const parent = overlayParent();
  if (!parent) return null;
  let container = parent.children?.find((child) => child.name === PREVIEW_NAME);
  if (!container && create) {
    container = new PIXI.Container();
    container.name = PREVIEW_NAME;
    container.eventMode = "none";
    container.zIndex = 2000;
    parent.addChild(container);
  }
  return container;
}

function clearPreview() {
  const container = getPreviewContainer(false);
  if (!container) return;
  container.removeChildren().forEach((child) => child.destroy?.({ children: true }));
}

function dimensions(definition) {
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const maximum = grid * definition.size * scale;
  const aspect = Number(definition.aspect) || 1;
  const width = aspect >= 1 ? maximum : maximum * aspect;
  const height = aspect >= 1 ? maximum / aspect : maximum;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

function redrawPreview() {
  clearPreview();
  if (!active || activeTool !== "place" || !cursor || (!selectedKey && !selectedSetId)) return;
  if (selectedSetId) return redrawSetPreview();
  const definition = ASSETS[selectedKey];
  const container = getPreviewContainer();
  const size = dimensions(definition);
  const sprite = PIXI.Sprite.from(definition.src);
  sprite.anchor.set(0.5);
  sprite.position.set(cursor.x, cursor.y);
  sprite.width = size.width * (flipped ? -1 : 1);
  sprite.height = size.height;
  sprite.rotation = rotation * Math.PI / 180;
  sprite.alpha = 0.72;
  container.addChild(sprite);
  const guide = new PIXI.Graphics();
  if (typeof guide.circle === "function" && typeof guide.stroke === "function") {
    guide.circle(cursor.x, cursor.y, 5).stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
  } else {
    guide.lineStyle(2, 0xffffff, 0.9).drawCircle(cursor.x, cursor.y, 5);
  }
  container.addChild(guide);
}

function transformOffset(x, y) {
  const reflectedX = flipped ? -x : x;
  const radians = rotation * Math.PI / 180;
  return {
    x: (reflectedX * Math.cos(radians) - y * Math.sin(radians)) * scale,
    y: (reflectedX * Math.sin(radians) + y * Math.cos(radians)) * scale,
  };
}

function redrawSetPreview() {
  const set = getSets().find((candidate) => candidate.id === selectedSetId);
  if (!set) return;
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const container = getPreviewContainer();
  for (const item of set.items) {
    const offset = transformOffset(item.cx * grid, item.cy * grid);
    const sprite = PIXI.Sprite.from(item.texture.src);
    sprite.anchor.set(Number(item.texture.anchorX ?? 0.5), Number(item.texture.anchorY ?? 0.5));
    sprite.position.set(cursor.x + offset.x, cursor.y + offset.y);
    sprite.width = item.width * grid * scale * ((Number(item.texture.scaleX ?? 1) < 0) !== flipped ? -1 : 1);
    sprite.height = item.height * grid * scale * (Number(item.texture.scaleY ?? 1) < 0 ? -1 : 1);
    sprite.rotation = (rotation + (flipped ? -Number(item.rotation ?? 0) : Number(item.rotation ?? 0))) * Math.PI / 180;
    sprite.alpha = 0.72 * Number(item.alpha ?? 1);
    container.addChild(sprite);
  }
}

function rotateBy(amount) {
  rotation = (rotation + amount + 360) % 360;
  redrawPreview();
  updatePickerState();
}

function toggleFlip() {
  flipped = !flipped;
  redrawPreview();
  updatePickerState();
}

document.addEventListener("wheel", (event) => {
  if (!active || event.target?.closest?.(`.${PICKER_CLASS}`)) return;
  if (!event.ctrlKey && !event.shiftKey) return;
  if (nativeSelectionMode()) {
    event.preventDefault();
    void transformSelectedTiles(event.shiftKey ? "rotate" : "scale", event.deltaY > 0 ? -1 : 1);
    return;
  }
  if (!selectedKey && !selectedSetId) return;
  event.preventDefault();
  if (event.shiftKey) rotateBy(event.deltaY > 0 ? ROTATION_STEP : -ROTATION_STEP);
  else if (event.ctrlKey) {
    const set = selectedSetId ? getSets().find((candidate) => candidate.id === selectedSetId) : null;
    const definition = selectedKey ? ASSETS[selectedKey] : null;
    const baseCells = definition?.size ?? Math.max(set?.width ?? 1, set?.height ?? 1);
    const currentCells = baseCells * scale;
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextCells = Math.max(MIN_SIZE_CELLS, Math.min(MAX_SIZE_CELLS,
      Math.round((currentCells + direction * SIZE_STEP_CELLS) / SIZE_STEP_CELLS) * SIZE_STEP_CELLS));
    scale = nextCells / baseCells;
    redrawPreview();
    updatePickerState();
  }
}, { passive: false });

async function transformSelectedTiles(mode, direction) {
  const tiles = selectedTiles();
  if (!tiles.length || !canvas?.scene) return;
  const center = {
    x: tiles.reduce((sum, tile) => sum + Number(tile.x), 0) / tiles.length,
    y: tiles.reduce((sum, tile) => sum + Number(tile.y), 0) / tiles.length,
  };
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const angle = direction * ROTATION_STEP;
  const radians = angle * Math.PI / 180;
  const factor = direction > 0 ? 1.1 : 0.9;
  const updates = tiles.map((tile) => {
    const dx = Number(tile.x) - center.x; const dy = Number(tile.y) - center.y;
    if (mode === "rotate") return {
      _id: tile.id,
      x: Math.round(center.x + dx * Math.cos(radians) - dy * Math.sin(radians)),
      y: Math.round(center.y + dx * Math.sin(radians) + dy * Math.cos(radians)),
      rotation: (Number(tile.rotation ?? 0) + angle + 360) % 360,
    };
    if (mode === "flip") return { _id: tile.id, "texture.scaleX": -(Number(tile.texture?.scaleX ?? 1) || 1) };
    return {
      _id: tile.id,
      x: Math.round(center.x + dx * factor), y: Math.round(center.y + dy * factor),
      width: Math.max(grid * MIN_SIZE_CELLS, Math.round(Number(tile.width) * factor)),
      height: Math.max(grid * MIN_SIZE_CELLS, Math.round(Number(tile.height) * factor)),
    };
  });
  await canvas.scene.updateEmbeddedDocuments("Tile", updates); drawSelection();
}

async function moveControlledTiles(dx, dy) {
  const tiles = selectedTiles();
  if (!tiles.length || !canvas?.scene) return;
  await canvas.scene.updateEmbeddedDocuments("Tile", tiles.map((tile) => ({ _id: tile.id, x: Number(tile.x) + dx, y: Number(tile.y) + dy }))); drawSelection();
}

document.addEventListener("keydown", (event) => {
  if (!active || /input|select|textarea/i.test(event.target?.tagName ?? "")) return;
  const selectionMode = nativeSelectionMode();
  if (selectionMode && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault(); event.stopImmediatePropagation();
    const ids = selectedTiles().map((tile)=>tile.id);
    releaseNativeTiles(); selectedTileIds.clear(); drawSelection();
    if (ids.length) void canvas.scene?.deleteEmbeddedDocuments("Tile", ids);
    return;
  }
  if (selectionMode && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault(); event.stopImmediatePropagation();
    const step = Number(canvas?.dimensions?.size ?? 100) * MOVEMENT_STEP_RATIO;
    const movement = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[event.key];
    void moveControlledTiles(...movement); return;
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault(); event.stopImmediatePropagation();
    selectionMode ? void transformSelectedTiles("rotate", 6) : rotateBy(90);
  }
  if (event.key.toLowerCase() === "f") {
    event.preventDefault(); event.stopImmediatePropagation();
    selectionMode ? void transformSelectedTiles("flip", 1) : toggleFlip();
  }
  if (event.key === "Escape") selectAsset(null);
}, true);

document.addEventListener("contextmenu", (event) => {
  if (!active || event.target?.closest?.(`.${PICKER_CLASS}`)) return;
  if (activeTool === "place" && !selectedKey && !selectedSetId) return;
  event.preventDefault();
  selectAsset(null);
});

async function eraseAssetAt(point) {
  const scene = canvas?.scene;
  if (!scene) return;
  const hit = [...scene.tiles]
    .filter((tile) => tile.flags?.[MODULE_ID]?.[FLAG_ROOT] && tile.shape?.testPoint?.(point))
    .sort((a, b) => Number(b.sort ?? 0) - Number(a.sort ?? 0))[0];
  if (!hit) return ui.notifications.warn(localize("NothingToErase", "No asset was found here."));
  await scene.deleteEmbeddedDocuments("Tile", [hit.id]);
}

async function placeAsset(point) {
  const scene = canvas?.scene;
  const definition = ASSETS[selectedKey];
  if (!scene || !definition) return;
  const size = dimensions(definition);
  const tileData = {
    name: t(definition.labelKey, definition.fallback),
    texture: { src: definition.src, anchorX: 0.5, anchorY: 0.5, scaleX: flipped ? -1 : 1, scaleY: 1 },
    x: Math.round(point.x),
    y: Math.round(point.y),
    width: size.width,
    height: size.height,
    rotation,
    elevation: 0,
    sort: LAYERS[selectedLayer] ?? 0,
    restrictions: { light: false, weather: false },
    flags: { [MODULE_ID]: { [FLAG_ROOT]: { key: selectedKey, layer: selectedLayer, lightId: null } } },
  };
  const [tile] = await scene.createEmbeddedDocuments("Tile", [tileData]);
  if (tile && definition.light) await createLinkedLight(tile, definition.light);
}

async function placeSet(point) {
  const scene = canvas?.scene;
  const set = getSets().find((candidate) => candidate.id === selectedSetId);
  if (!scene || !set) return;
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const batchId = foundry.utils.randomID?.() ?? crypto.randomUUID();
  const data = set.items.map((item) => {
    const offset = transformOffset(item.cx * grid, item.cy * grid);
    const flags = foundry.utils.deepClone(item.flags ?? {});
    flags[MODULE_ID] ??= {};
    flags[MODULE_ID][FLAG_ROOT] = { ...(flags[MODULE_ID][FLAG_ROOT] ?? {}), lightId: null, setId: set.id, batchId };
    return {
      name: item.name,
      texture: {
        ...foundry.utils.deepClone(item.texture),
        scaleX: Math.abs(Number(item.texture.scaleX ?? 1)) * ((Number(item.texture.scaleX ?? 1) < 0) !== flipped ? -1 : 1),
      },
      x: Math.round(point.x + offset.x),
      y: Math.round(point.y + offset.y),
      width: Math.max(1, Math.round(item.width * grid * scale)),
      height: Math.max(1, Math.round(item.height * grid * scale)),
      rotation: (rotation + (flipped ? -Number(item.rotation ?? 0) : Number(item.rotation ?? 0)) + 360) % 360,
      elevation: item.elevation ?? 0,
      sort: item.sort ?? 0,
      alpha: item.alpha ?? 1,
      hidden: Boolean(item.hidden),
      restrictions: foundry.utils.deepClone(item.restrictions ?? { light: false, weather: false }),
      flags,
    };
  });
  const created = await scene.createEmbeddedDocuments("Tile", data);
  for (let index = 0; index < created.length; index += 1) {
    const light = set.items[index]?.light;
    if (light) await createLinkedLight(created[index], light.preset ?? "set", light.config);
  }
}

async function saveSelectedTilesAsSet() {
  const tiles = selectedTiles();
  if (!tiles.length) return ui.notifications.warn(localize("NoTilesSelected", "Select one or more tiles first."));
  const name = await promptSetName();
  if (!name) return;
  const grid = Number(canvas?.dimensions?.size ?? 100);
  const centers = tiles.map((tile) => ({ x: Number(tile.x), y: Number(tile.y) }));
  const minX = Math.min(...tiles.map((tile) => Number(tile.x) - Number(tile.width) / 2));
  const maxX = Math.max(...tiles.map((tile) => Number(tile.x) + Number(tile.width) / 2));
  const minY = Math.min(...tiles.map((tile) => Number(tile.y) - Number(tile.height) / 2));
  const maxY = Math.max(...tiles.map((tile) => Number(tile.y) + Number(tile.height) / 2));
  const origin = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const items = tiles.map((tile, index) => {
    const raw = tile.toObject();
    const lightId = tile.flags?.[MODULE_ID]?.[FLAG_ROOT]?.lightId;
    const light = lightId ? tile.parent?.lights?.get(lightId) : null;
    const flags = foundry.utils.deepClone(raw.flags ?? {});
    if (flags[MODULE_ID]?.[FLAG_ROOT]) flags[MODULE_ID][FLAG_ROOT].lightId = null;
    return {
      name: tile.name,
      texture: foundry.utils.deepClone(raw.texture),
      cx: (centers[index].x - origin.x) / grid,
      cy: (centers[index].y - origin.y) / grid,
      width: Number(tile.width) / grid,
      height: Number(tile.height) / grid,
      rotation: Number(tile.rotation ?? 0), elevation: tile.elevation ?? 0, sort: tile.sort ?? 0,
      alpha: tile.alpha ?? 1, hidden: Boolean(tile.hidden), restrictions: foundry.utils.deepClone(raw.restrictions ?? {}), flags,
      light: light ? { preset: light.flags?.[MODULE_ID]?.[FLAG_ROOT]?.preset ?? "set", config: foundry.utils.deepClone(light.config?.toObject?.() ?? light.config) } : null,
    };
  });
  const sets = getSets();
  sets.push({ id: foundry.utils.randomID?.() ?? crypto.randomUUID(), name, width: (maxX - minX) / grid, height: (maxY - minY) / grid, items });
  await setSets(sets);
  ui.notifications.info(localize("SetSaved", "Asset set saved."));
}

async function promptSetName() {
  const fallback = `${localize("Set", "Set")} ${getSets().length + 1}`;
  if (foundry.applications?.api?.DialogV2?.prompt) return foundry.applications.api.DialogV2.prompt({
    window: { title: localize("SaveSet", "Save selected tiles as set") },
    content: `<label>${localize("SetName", "Name")}<input type="text" name="name" value="${htmlEscape(fallback)}"></label>`,
    ok: { callback: (_event, button) => button.form.elements.name.value.trim() },
  });
  return window.prompt(localize("SetName", "Name"), fallback)?.trim();
}

async function deleteSet(id, name) {
  const confirmed = foundry.applications?.api?.DialogV2?.confirm
    ? await foundry.applications.api.DialogV2.confirm({ window: { title: localize("DeleteSet", "Delete set") }, content: `<p>${htmlEscape(name)}</p>` })
    : window.confirm(`${localize("DeleteSet", "Delete set")}: ${name}?`);
  if (!confirmed) return;
  if (selectedSetId === id) selectSet(null);
  await setSets(getSets().filter((set) => set.id !== id));
}

export async function createLinkedLight(tile, presetKey, override = null) {
  const preset = override ?? lightSettings ?? LIGHT_PRESETS[presetKey];
  if (!preset || !tile?.parent) return;
  const center = tileCenter(tile);
  const [light] = await tile.parent.createEmbeddedDocuments("AmbientLight", [{
    name: `${tile.name} — ${localize("Light", "Light")}`,
    x: center.x,
    y: center.y,
    elevation: tile.elevation ?? 0,
    walls: true,
    vision: false,
    config: { ...preset, darkness: { min: 0, max: 1 } },
    flags: { [MODULE_ID]: { [FLAG_ROOT]: { tileId: tile.id, preset: presetKey } } },
  }]);
  if (light) await tile.update({ [`flags.${MODULE_ID}.${FLAG_ROOT}.lightId`]: light.id });
}

function tileCenter(tile) {
  const center = tile.shape?.center;
  return {
    x: Math.round(Number(center?.x ?? tile.x)),
    y: Math.round(Number(center?.y ?? tile.y)),
  };
}

Hooks.on("updateTile", (tile, change) => {
  const flag = tile.flags?.[MODULE_ID]?.[FLAG_ROOT];
  if (!flag?.lightId || !tile.parent || !["x", "y", "width", "height", "elevation", "hidden"].some((key) => key in change)) return;
  const light = tile.parent.lights?.get(flag.lightId);
  if (!light) return;
  const center = tileCenter(tile);
  void light.update({ x: center.x, y: center.y, elevation: tile.elevation ?? 0, hidden: Boolean(tile.hidden) });
});

Hooks.on("preUpdateTile", (tile, change) => {
  const flag = tile.flags?.[MODULE_ID]?.[FLAG_ROOT];
  if (!flag || game.keyboard?.isModifierActive?.("ALT")) return;
  if ("x" in change || "y" in change) {
    const snapped = snapPlacementPoint({ x: Number(change.x ?? tile.x), y: Number(change.y ?? tile.y) });
    if ("x" in change) change.x = Math.round(snapped.x);
    if ("y" in change) change.y = Math.round(snapped.y);
  }
  if ("rotation" in change) change.rotation = (Math.round(Number(change.rotation) / ROTATION_STEP) * ROTATION_STEP + 360) % 360;
  if ("width" in change || "height" in change) {
    const definition = ASSETS[flag.key];
    if (definition) {
      const grid = Number(canvas?.dimensions?.size ?? 100);
      const requested = Math.max(Number(change.width ?? tile.width), Number(change.height ?? tile.height));
      const cells = Math.max(MIN_SIZE_CELLS, Math.min(MAX_SIZE_CELLS,
        Math.round((requested / grid) / SIZE_STEP_CELLS) * SIZE_STEP_CELLS));
      const maximum = cells * grid;
      change.width = Math.round(definition.aspect >= 1 ? maximum : maximum * definition.aspect);
      change.height = Math.round(definition.aspect >= 1 ? maximum / definition.aspect : maximum);
    }
  }
});

Hooks.on("deleteTile", (tile) => {
  selectedTileIds.delete(tile.id); drawSelection();
  const lightId = tile.flags?.[MODULE_ID]?.[FLAG_ROOT]?.lightId;
  if (lightId && tile.parent?.lights?.get(lightId)) void tile.parent.deleteEmbeddedDocuments("AmbientLight", [lightId]);
  if (active) {
    queueMicrotask(rerenderPicker);
    setTimeout(() => forceOpenAssetLibrary(activeTool), 60);
  }
});

Hooks.on("deleteAmbientLight", (light) => {
  const tileId = light.flags?.[MODULE_ID]?.[FLAG_ROOT]?.tileId;
  const tile = tileId ? light.parent?.tiles?.get(tileId) : null;
  if (tile) void tile.update({ [`flags.${MODULE_ID}.${FLAG_ROOT}.lightId`]: null });
});

Hooks.on("canvasReady", () => { if (active) bindStage(); void normalizeTrapdoorLayer(); });
Hooks.on("canvasTearDown", () => { clearPreview(); selectedTileIds.clear(); drawSelection(); unbindStage(); });

async function normalizeTrapdoorLayer() {
  const scene=canvas?.scene;if(!scene||!game.user?.isGM)return;
  const updates=[...scene.tiles].filter((tile)=>{
    const flag=tile.flags?.[MODULE_ID]?.[FLAG_ROOT];
    return flag?.key==="trapdoor"&&(flag.layer!=="ground"||Number(tile.sort)!==LAYERS.ground);
  }).map((tile)=>({_id:tile.id,sort:LAYERS.ground,[`flags.${MODULE_ID}.${FLAG_ROOT}.layer`]:"ground"}));
  if(updates.length)await scene.updateEmbeddedDocuments("Tile",updates);
}
