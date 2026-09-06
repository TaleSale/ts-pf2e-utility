import { MODULE_ID, t } from "../core.js";
import { ASSET_GEOMETRY_VERSION, ASSETS, LIGHT_PRESETS, closeAssetLibrary, getAssetMirrorFlag, getAssetPlacementLevelData } from "./scene-assets.js?v=20260906-shadow-overlay-v66";

const SETTING_ENABLE = "enableSceneAssets";
const SETTING_PRESETS = "sceneDecoratorPresets";
const CONTROL = "tsu-scene-tools";
const DECORATOR_TOOL = "area-decorator";
const PANEL = "tsu-decorator-panel";
const PREVIEW = "tsu-decorator-preview";
const ASSET_MENU = "tsu-decorator-asset-menu";
const FLOOR_FLAG = "floorTextures";
const ASSET_FLAG = "sceneAsset";
const DENSITIES = Object.freeze({ sparse: 0.65, normal: 1, dense: 1.45 });
const AUTO_MIN_SIZE_CELLS = 0.2;
const TABLE_KEYS = Object.freeze(["table", "roundTable", "longTable", "banquetTable"]);
const WALL_ASSET_KEYS = Object.freeze(["cabinet", "cabinetNarrow", "bookshelf", "bookshelfNarrow"]);
const BED_ASSET_KEYS = Object.freeze(["bed", "bedOak", "bedBlue", "bedFur", "bedMessyBlue", "bedMessyBrown", "doubleBedRed", "doubleBedLinen"]);
const ASSET_OPAQUE_BOUNDS = Object.freeze({
  bed: [0.0595, 0.0303, 0.9405, 0.9697],
  bedOak: [0.0735, 0.0333, 0.9265, 0.9667],
  bedBlue: [0.0678, 0.0334, 0.9322, 0.9666],
  bedFur: [0.0678, 0.0330, 0.9322, 0.9670],
  bedMessyBlue: [0.0534, 0.0331, 0.9466, 0.9669],
  bedMessyBrown: [0.0616, 0.0334, 0.9384, 0.9666],
  doubleBedRed: [0.0455, 0.0321, 0.9545, 0.9679],
  doubleBedLinen: [0.0418, 0.0323, 0.9582, 0.9677],
});
function localize(key, fallback) { return t(`Settings.SceneDecorator.${key}`, fallback); }
function escapeHtml(value) { return foundry.utils.escapeHTML?.(String(value)) ?? String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

let activeMode = null;
let stageBound = null;
let draft = [];
let polygon = null;
let layout = [];
let layoutLevelId = null;
let presetKey = null;
let density = "normal";
let seed = Math.floor(Math.random() * 2147483647);
let lastGenerationId = null;
let panelRequested = false;
let applying = false;

Hooks.once("init", () => game.settings.register(MODULE_ID, SETTING_PRESETS, {
  name: "Scene decorator presets", scope: "world", config: false, type: Object,
  default: { version: 1, presets: [] }, onChange: () => renderPanel(),
}));

function getPresets() {
  const value = game.settings.get(MODULE_ID, SETTING_PRESETS);
  const saved = Array.isArray(value?.presets) ? foundry.utils.deepClone(value.presets) : [];
  const byId = new Map(saved.map((preset) => [preset.id, preset]));
  for (const preset of builtInPresets()) {
    const existing = byId.get(preset.id);
    if (!existing || (preset.builtinRevision && Number(existing.builtinRevision ?? 0) < preset.builtinRevision)) byId.set(preset.id, preset);
  }
  return [...byId.values()];
}
async function setPresets(presets) { await game.settings.set(MODULE_ID, SETTING_PRESETS, { version: 1, presets }); }
function currentPreset() { return getPresets().find((preset) => preset.id === presetKey) ?? null; }

function builtInPresets() {
  return [
    { id:"builtin-barracks", builtinRevision:2, category:localize("Categories.Rooms","Rooms"), name:localize("Presets.Barracks","Barracks"), environment:"barracks", rules:{uniformBedSize:true}, items:[
      {key:"bedOak",min:2,max:4,zone:"wall"},{key:"bedBlue",min:1,max:3,zone:"wall"},{key:"bedFur",min:1,max:2,zone:"wall"},
    ]},
    { id:"builtin-bedroom", category:localize("Categories.Rooms","Rooms"), name:localize("Presets.Bedroom","Bedroom"), environment:"indoor", items:[
      {key:"bedOak",min:1,max:1,zone:"wall"},{key:"cabinetNarrow",min:1,max:2,zone:"wall"},{key:"redRug",min:0,max:1,zone:"center"},
    ]},
    { id:"builtin-bathhouse", category:localize("Categories.Rooms","Rooms"), name:localize("Presets.Bathhouse","Bathhouse"), environment:"indoor", items:[
      {key:"bathtubWood",min:1,max:2,zone:"wall"},{key:"sinkWood",min:1,max:2,zone:"wall"},{key:"toiletBoardOak",min:0,max:2,zone:"wall"},
    ]},
    { id:"builtin-camp", category:localize("Categories.Outdoors","Outdoors"), name:localize("Presets.Camp","Camp"), environment:"outdoor", items:[
      {key:"bedrollGreen",min:2,max:5,zone:"free"},{key:"campfireStones",min:1,max:1,zone:"center"},{key:"logs",min:0,max:2,zone:"free"},
    ]},
    { id:"builtin-common-hall", category:localize("Categories.Rooms","Rooms"), name:localize("Presets.DiningHall","Dining hall"), environment:"indoor", items:[
      {key:"longTable",min:1,max:3,zone:"center",seats:{enabled:true,key:"chair",min:4,max:8}},{key:"fireplaceStone",min:1,max:1,zone:"wall"},
    ]},
  ];
}

function enabled() { return Boolean(game.user?.isGM && game.settings.get(MODULE_ID, SETTING_ENABLE)); }

Hooks.on("getSceneControlButtons", (controls) => {
  if (!enabled()) return;
  const group = controls[CONTROL];
  if (!group?.tools) return;
  group.tools ??= {};
  group.tools[DECORATOR_TOOL] = { name:DECORATOR_TOOL, order:2, title:localize("Control","Decorator"), icon:"fa-solid fa-wand-magic-sparkles", visible:true, onChange:(_event,value)=>{if(value!==false){document.dispatchEvent(new CustomEvent("tsu-scene-panel",{detail:"decorator"}));panelRequested=true;activate(activeMode??"room");renderPanel();}else deactivate();} };
});

document.addEventListener("pointerdown", (event) => {
  const controlButton = event.composedPath?.().find((node)=>node instanceof HTMLElement && node.dataset?.control===CONTROL);
  const toolButton = event.composedPath?.().find((node)=>node instanceof HTMLElement && node.dataset?.tool);
  if (!controlButton && (!toolButton || toolButton.dataset.tool===DECORATOR_TOOL)) return;
  deactivate();
}, true);

document.addEventListener("tsu-scene-panel", (event) => {
  if (event.detail !== "decorator") deactivate();
});

Hooks.on("renderSceneControls", (_app, element) => queueMicrotask(() => {
  const root = element instanceof HTMLElement ? element : element?.[0] ?? document.querySelector("#scene-controls");
  const decoratorButton = root?.querySelector?.(`[data-tool="${DECORATOR_TOOL}"]`);
  if (decoratorButton && !decoratorButton.dataset.tsuDecoratorOpenBound) {
    decoratorButton.dataset.tsuDecoratorOpenBound="true";
    decoratorButton.addEventListener("click",()=>queueMicrotask(()=>{panelRequested=true;activate(activeMode??"room");renderPanel();}));
  }
  if (panelRequested && ui.controls?.control?.name === CONTROL) activate(activeMode ?? "room"); else deactivate();
  renderPanel(element);
}));

function activate(mode) {
  if (!enabled() || ui.controls?.control?.name !== CONTROL) return;
  closeAssetLibrary();
  activeMode = ["room", "floor", "polygon"].includes(mode) ? mode : "room";
  bindStage();
  document.querySelector(`.${PANEL}`)?.classList.remove("hidden");
}

function deactivate() {
  panelRequested = false;
  activeMode = null; draft = []; polygon = null; layout = []; layoutLevelId = null;
  unbindStage();
  clearPreview();
  document.querySelector(`.${PANEL}`)?.classList.add("hidden");
}

function renderPanel() {
  document.querySelector(`.${PANEL}`)?.remove();
  if (!enabled() || !panelRequested || ui.controls?.control?.name !== CONTROL) return;
  const panel = document.createElement("section");
  panel.className = PANEL;
  const presets = getPresets();
  if (!presetKey || !presets.some((preset) => preset.id === presetKey)) presetKey = presets[0]?.id ?? null;
  const categories = presets.reduce((map, preset) => {
    const category = preset.category || localize("Uncategorized", "Uncategorized");
    map.set(category, [...(map.get(category) ?? []), preset]); return map;
  }, new Map());
  const options = [...categories].map(([category, entries]) => `<optgroup label="${escapeHtml(category)}">${entries.map((preset) => `<option value="${preset.id}" ${preset.id === presetKey ? "selected" : ""}>${escapeHtml(preset.name)}</option>`).join("")}</optgroup>`).join("");
  const emptyOption = presets.length ? "" : `<option value="" selected disabled>${localize("NoPresets", "No presets")}</option>`;
  panel.innerHTML = `<header><strong>${localize("Title", "Area decorator")}</strong></header>
    <div class="tsu-decorator-area-tools"><button type="button" data-mode="room" title="${localize("Room","Room")}"><i class="fa-solid fa-vector-square"></i></button><button type="button" data-mode="floor" title="${localize("Floor","Floor")}"><i class="fa-solid fa-fill-drip"></i></button><button type="button" data-mode="polygon" title="${localize("Polygon","Polygon")}"><i class="fa-solid fa-draw-polygon"></i></button><button type="button" data-action="undo" title="${localize("Undo","Undo last fill")}"><i class="fa-solid fa-rotate-left"></i></button></div>
    <label>${localize("Preset", "Preset")}<span class="tsu-decorator-preset-row"><select data-preset>${emptyOption}${options}</select><button type="button" data-action="manage" title="${localize("ManagePresets", "Manage presets")}"><i class="fa-solid fa-gear"></i></button></span></label>
    <label>${localize("Density", "Density")}<select data-density><option value="sparse">${localize("Sparse", "Sparse")}</option><option value="normal">${localize("Normal", "Normal")}</option><option value="dense">${localize("Dense", "Dense")}</option></select></label>
    <label>${localize("Seed", "Seed")}<input data-seed type="number" value="${seed}"></label>
    <div><button type="button" data-action="reroll"><i class="fa-solid fa-dice"></i> ${localize("Reroll", "Another")}</button><button type="button" data-action="apply"><i class="fa-solid fa-check"></i> ${localize("Apply", "Apply")}</button><button type="button" data-action="cancel"><i class="fa-solid fa-xmark"></i></button></div>
    <p>${localize("Help", "Choose an area, inspect the preview, then apply.")}</p>`;
  panel.querySelector("[data-preset]").value = presetKey ?? "";
  for (const button of panel.querySelectorAll("[data-mode]")) {
    button.classList.toggle("active", button.dataset.mode === activeMode);
    button.addEventListener("click", () => { clearSelection(); activeMode = button.dataset.mode; renderPanel(); });
  }
  panel.querySelector('[data-action="undo"]').addEventListener("click", undoLast);
  panel.querySelector("[data-density]").value = density;
  panel.querySelector("[data-preset]").addEventListener("change", (event) => { presetKey = event.target.value; regenerate(); });
  panel.querySelector("[data-density]").addEventListener("change", (event) => { density = event.target.value; regenerate(); });
  panel.querySelector("[data-seed]").addEventListener("change", (event) => { seed = Math.trunc(Number(event.target.value) || 1); regenerate(); });
  panel.querySelector('[data-action="reroll"]').addEventListener("click", () => { seed = (seed + 1) % 2147483647 || 1; panel.querySelector("[data-seed]").value = seed; regenerate(); });
  panel.querySelector('[data-action="apply"]').addEventListener("click", applyLayout);
  panel.querySelector('[data-action="cancel"]').addEventListener("click", clearSelection);
  panel.querySelector('[data-action="manage"]').addEventListener("click", openPresetManager);
  document.body.append(panel);
  requestAnimationFrame(positionPanel);
}

function openPresetManager() {
  closeDecoratorAssetMenu();
  document.querySelector(".tsu-decorator-manager")?.remove();
  const manager = document.createElement("section");
  manager.className = "tsu-decorator-manager";
  manager.innerHTML = `<header><strong>${localize("ManagePresets", "Decorator presets")}</strong><button type="button" data-close><i class="fa-solid fa-xmark"></i></button></header>
    <label>${localize("EditPreset", "Preset")}<select data-existing></select></label>
    <div class="tsu-decorator-meta">
      <label>${localize("Category", "Category")}<input type="text" data-category></label>
      <label>${localize("PresetName", "Name")}<input type="text" data-name></label>
      <label>${localize("Environment", "Environment")}<select data-environment><option value="indoor">${localize("Indoor", "Indoor")}</option><option value="outdoor">${localize("Outdoor", "Outdoor")}</option><option value="barracks">${localize("BarracksEnvironment", "Barracks")}</option></select></label>
    </div>
    <div class="tsu-decorator-rows"><div class="tsu-decorator-row-head"><span>${localize("Asset", "Asset")}</span><span>${localize("Minimum", "Min")}</span><span>${localize("Maximum", "Max")}</span><span>${localize("Placement", "Placement")}</span><span>${localize("Support", "On object")}</span><span title="${localize("RandomCount", "Amount from density")}"><i class="fa-solid fa-dice"></i></span><span></span></div><div data-rows></div></div>
    <footer><button type="button" data-add><i class="fa-solid fa-plus"></i> ${localize("AddObject", "Add object")}</button><span></span><button type="button" data-delete><i class="fa-solid fa-trash"></i></button><button type="button" data-save><i class="fa-solid fa-floppy-disk"></i> ${localize("SavePreset", "Save")}</button></footer>`;
  const existing = manager.querySelector("[data-existing]");
  const refreshExisting = (selected = "") => {
    existing.innerHTML = `<option value="">${localize("NewPreset", "New preset")}</option>${getPresets().map((preset) => `<option value="${preset.id}">${escapeHtml(preset.category ? `${preset.category} / ${preset.name}` : preset.name)}</option>`).join("")}`;
    existing.value = selected;
  };
  const rows = manager.querySelector("[data-rows]");
  const assetKeys = Object.keys(ASSETS).filter((key) => !["chair", "stool"].includes(key));
  const refreshSupportOptions=()=>{
    const allRows=[...rows.querySelectorAll(".tsu-decorator-object-row")];
    for(const row of allRows) {
      const select=row.querySelector("[data-target]"),previous=select.value,requested=select.dataset.initialTarget;
      const candidates=new Map();
      for(const other of allRows) {
        if(other===row||other.querySelector("[data-zone]").value==="on")continue;
        const key=other.querySelector("[data-key]").value,asset=ASSETS[key];if(asset)candidates.set(key,asset);
      }
      select.innerHTML=candidates.size?[...candidates].map(([key,asset])=>`<option value="${key}">${escapeHtml(t(asset.labelKey,asset.fallback))}</option>`).join(""):`<option value="">—</option>`;
      select.value=candidates.has(previous)?previous:candidates.has(requested)?requested:(candidates.keys().next().value??"");
      select.disabled=row.querySelector("[data-zone]").value!=="on"||!candidates.size;
    }
  };
  const addRow = (item = {}) => {
    const row = document.createElement("div"); row.className = "tsu-decorator-object-row";
    row.innerHTML = `<div class="tsu-decorator-asset-field"><input type="hidden" data-key><button type="button" data-key-picker><img alt=""><span></span><i class="fa-solid fa-chevron-down"></i></button></div><input data-min type="number" min="0" max="50" value="${Math.max(0, Number(item.min) || 0)}"><input data-max type="number" min="0" max="50" value="${Math.max(0, Number(item.max) || 1)}"><select data-zone><option value="wall">${localize("AtWall", "At wall")}</option><option value="center">${localize("AtCenter", "Center")}</option><option value="free">${localize("Free", "Free")}</option><option value="on">${localize("OnObject", "On object")}</option></select><select data-target></select><button type="button" data-random title="${localize("RandomCount", "Amount from density")}"><i class="fa-solid fa-dice"></i></button><button type="button" data-remove><i class="fa-solid fa-xmark"></i></button><div class="tsu-decorator-table-seats" data-table-seats><label class="tsu-decorator-seat-toggle"><input type="checkbox" data-seat-enabled><span>${localize("TableSeats", "Seats at table")}</span></label><label>${localize("SeatType", "Type")}<select data-seat-key><option value="chair">${escapeHtml(t(ASSETS.chair.labelKey,ASSETS.chair.fallback))}</option><option value="stool">${escapeHtml(t(ASSETS.stool.labelKey,ASSETS.stool.fallback))}</option></select></label><label>${localize("Minimum", "Min")}<input type="number" min="0" max="12" data-seat-min></label><label>${localize("Maximum", "Max")}<input type="number" min="0" max="12" data-seat-max></label></div>`;
    const keyInput = row.querySelector("[data-key]"); const keyPicker=row.querySelector("[data-key-picker]"); const zoneSelect = row.querySelector("[data-zone]"); const targetSelect = row.querySelector("[data-target]");
    setDecoratorRowAsset(row,ASSETS[item.key]?item.key:assetKeys[0]);
    zoneSelect.value = WALL_ASSET_KEYS.includes(keyInput.value) ? "wall" : (item.zone === "cluster" ? "free" : (item.zone ?? "free"));
    targetSelect.dataset.initialTarget=item.target??"";
    const seatPanel=row.querySelector("[data-table-seats]"),seatEnabled=row.querySelector("[data-seat-enabled]"),seatKey=row.querySelector("[data-seat-key]"),seatMin=row.querySelector("[data-seat-min]"),seatMax=row.querySelector("[data-seat-max]");
    const seatConfig=normalizeTableSeats(item.seats,keyInput.value);seatEnabled.checked=seatConfig.enabled;seatKey.value=seatConfig.key;seatMin.value=seatConfig.min;seatMax.value=seatConfig.max;
    const refreshSeats=()=>{seatPanel.hidden=!TABLE_KEYS.includes(keyInput.value);seatKey.disabled=seatMin.disabled=seatMax.disabled=!seatEnabled.checked;};
    refreshSeats();seatEnabled.addEventListener("change",refreshSeats);
    keyPicker.addEventListener("click",()=>openDecoratorAssetMenu(keyPicker,row,()=>{const becomingTable=seatPanel.hidden&&TABLE_KEYS.includes(keyInput.value);if(WALL_ASSET_KEYS.includes(keyInput.value))zoneSelect.value="wall";if(becomingTable)seatKey.value=keyInput.value==="roundTable"?"stool":"chair";refreshSeats();refreshSupportOptions();}));
    zoneSelect.addEventListener("change",refreshSupportOptions);
    const randomButton=row.querySelector("[data-random]"), minInput=row.querySelector("[data-min]"), maxInput=row.querySelector("[data-max]");
    const setRandom=(value)=>{randomButton.classList.toggle("active",value);randomButton.dataset.enabled=String(value);minInput.disabled=value;maxInput.disabled=value;};
    setRandom(Boolean(item.random)); randomButton.addEventListener("click",()=>setRandom(randomButton.dataset.enabled!=="true"));
    row.querySelector("[data-remove]").addEventListener("click", () => {closeDecoratorAssetMenu();row.remove();refreshSupportOptions();}); rows.append(row);refreshSupportOptions();
    if(item.target&&[...targetSelect.options].some((option)=>option.value===item.target))targetSelect.value=item.target;
  };
  const loadPreset = (id) => {
    closeDecoratorAssetMenu();
    const preset = getPresets().find((candidate) => candidate.id === id);
    manager.querySelector("[data-category]").value = preset?.category ?? "";
    manager.querySelector("[data-name]").value = preset?.name ?? "";
    manager.querySelector("[data-environment]").value = preset?.environment ?? "indoor";
    rows.replaceChildren(); for (const item of preset?.items ?? []) addRow(item);
    manager.querySelector("[data-delete]").disabled = !preset;
  };
  refreshExisting(); loadPreset("");
  existing.addEventListener("change", () => loadPreset(existing.value));
  manager.querySelector("[data-add]").addEventListener("click", () => addRow());
  manager.querySelector("[data-close]").addEventListener("click", () => {closeDecoratorAssetMenu();manager.remove();});
  manager.querySelector("[data-delete]").addEventListener("click", async () => {
    if (!existing.value) return;
    await setPresets(getPresets().filter((preset) => preset.id !== existing.value));
    if (presetKey === existing.value) presetKey = null;
    refreshExisting(); loadPreset(""); renderPanel();
  });
  manager.querySelector("[data-save]").addEventListener("click", async () => {
    const name = manager.querySelector("[data-name]").value.trim();
    const category = manager.querySelector("[data-category]").value.trim();
    const items = [...rows.querySelectorAll(".tsu-decorator-object-row")].map((row) => {
      const min = Math.max(0, Math.min(50, Number(row.querySelector("[data-min]").value) || 0));
      const max = Math.max(min, Math.min(50, Number(row.querySelector("[data-max]").value) || 0));
      const key=row.querySelector("[data-key]").value;
      const value={ key, min, max, zone: row.querySelector("[data-zone]").value, target: row.querySelector("[data-target]").value, random: row.querySelector("[data-random]").dataset.enabled === "true" };
      if(TABLE_KEYS.includes(key))value.seats=normalizeTableSeats({enabled:row.querySelector("[data-seat-enabled]").checked,key:row.querySelector("[data-seat-key]").value,min:row.querySelector("[data-seat-min]").value,max:row.querySelector("[data-seat-max]").value},key);
      return value;
    });
    if (!name || !items.length) return ui.notifications.warn(localize("PresetIncomplete", "Enter a name and add at least one object."));
    const presets = getPresets(); const id = existing.value || foundry.utils.randomID?.() || crypto.randomUUID();
    const previous=presets.find((preset)=>preset.id===id);
    const value = { id, category, name, environment: manager.querySelector("[data-environment]").value, items };
    if(previous?.builtinRevision)value.builtinRevision=previous.builtinRevision;
    const index = presets.findIndex((preset) => preset.id === id); if (index >= 0) presets[index] = value; else presets.push(value);
    await setPresets(presets); presetKey = id; closeDecoratorAssetMenu(); manager.remove(); renderPanel(); if (polygon) regenerate();
  });
  manager.addEventListener("pointerdown", (event) => event.stopPropagation());
  document.body.append(manager);
}

function setDecoratorRowAsset(row,key) {
  const asset=ASSETS[key];if(!asset)return;
  row.querySelector("[data-key]").value=key;
  const picker=row.querySelector("[data-key-picker]");
  picker.querySelector("img").src=asset.src;
  picker.querySelector("span").textContent=t(asset.labelKey,asset.fallback);
  picker.title=t(asset.labelKey,asset.fallback);
}

function normalizeTableSeats(value,tableKey) {
  const source=value&&typeof value==="object"?value:{};
  const fallbackKey=tableKey==="roundTable"?"stool":"chair";
  const key=["chair","stool"].includes(source.key)?source.key:fallbackKey;
  const min=Math.max(0,Math.min(12,Number(source.min??4)||0));
  const max=Math.max(min,Math.min(12,Number(source.max??source.min??4)||0));
  return {enabled:source.enabled!==false,key,min,max};
}

function openDecoratorAssetMenu(anchor,row,onChange) {
  const existing=document.querySelector(`.${ASSET_MENU}`);
  if(existing?._anchor===anchor)return closeDecoratorAssetMenu();
  closeDecoratorAssetMenu();
  const selected=row.querySelector("[data-key]").value;
  const allowed=Object.entries(ASSETS).filter(([key])=>!["chair","stool"].includes(key));
  const categories=[...new Set(allowed.map(([,asset])=>asset.category))];
  const menu=document.createElement("section");menu.className=ASSET_MENU;menu._anchor=anchor;
  for(const category of categories) {
    const entries=allowed.filter(([,asset])=>asset.category===category);
    const group=document.createElement("details");group.open=entries.some(([key])=>key===selected);
    const summary=document.createElement("summary");
    summary.innerHTML=`<span>${escapeHtml(t(`Settings.SceneAssets.Categories.${category}`,category))}</span><small>${entries.length}</small>`;
    const grid=document.createElement("div");grid.className="tsu-decorator-asset-grid";
    for(const [key,asset] of entries) {
      const button=document.createElement("button");button.type="button";button.classList.toggle("selected",key===selected);
      button.innerHTML=`<img src="${asset.src}" alt=""><span>${escapeHtml(t(asset.labelKey,asset.fallback))}</span>`;
      button.title=t(asset.labelKey,asset.fallback);
      button.addEventListener("click",()=>{setDecoratorRowAsset(row,key);onChange?.(key);closeDecoratorAssetMenu();});
      grid.append(button);
    }
    group.append(summary,grid);menu.append(group);
  }
  document.body.append(menu);
  const rect=anchor.getBoundingClientRect();const width=Math.min(430,innerWidth-16);
  menu.style.width=`${width}px`;menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`;
  const height=Math.min(menu.scrollHeight,Math.max(220,innerHeight-32));let top=rect.bottom+4;
  if(top+height>innerHeight-8)top=Math.max(8,rect.top-height-4);
  menu.style.top=`${top}px`;menu.style.maxHeight=`${Math.max(180,innerHeight-top-8)}px`;
  const outside=(event)=>{if(!menu.contains(event.target)&&!anchor.contains(event.target))closeDecoratorAssetMenu();};
  const keydown=(event)=>{if(event.key==="Escape")closeDecoratorAssetMenu();};
  menu._outside=outside;menu._keydown=keydown;
  setTimeout(()=>{document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",keydown,true);},0);
}

function closeDecoratorAssetMenu() {
  const menu=document.querySelector(`.${ASSET_MENU}`);if(!menu)return;
  if(menu._outside)document.removeEventListener("pointerdown",menu._outside,true);
  if(menu._keydown)document.removeEventListener("keydown",menu._keydown,true);
  menu.remove();
}

function positionPanel() {
  const panel = document.querySelector(`.${PANEL}`); if (!panel) return;
  const anchor = Array.from(document.querySelectorAll("#scene-controls-tools .tool")).at(-1); if (!anchor) return;
  const rect = anchor.getBoundingClientRect(); panel.style.left = `${Math.max(8, rect.left)}px`; panel.style.top = `${Math.min(innerHeight - panel.offsetHeight - 8, rect.bottom + 8)}px`;
}

function bindStage() {
  const stage = canvas?.stage; if (!stage || stageBound === stage) return;
  unbindStage();
  stageBound = stage; stage.eventMode = "static"; stage.on("pointerdowncapture", onPointerDown); stage.on("pointermove", onPointerMove);
}

function unbindStage() {
  if (!stageBound) return;
  stageBound.off("pointerdowncapture", onPointerDown);
  stageBound.off("pointermove", onPointerMove);
  stageBound = null;
}

function eventPoint(event) { const global = event?.global ?? event?.data?.global; return global && canvas?.stage?.worldTransform ? canvas.stage.worldTransform.applyInverse(global) : null; }

function onPointerDown(event) {
  if (!panelRequested || !activeMode || ui.controls?.control?.name !== CONTROL || event.button !== 0 || event.nativeEvent?.target?.closest?.(`.${PANEL}`)) return;
  const point = eventPoint(event); if (!point) return; event.stopPropagation?.();
  if (activeMode === "room") polygon = findWallFace(point);
  else if (activeMode === "floor") polygon = findFloor(point);
  else {
    const snapped = snap(point); const now = Date.now(); const previous = draft._last;
    const double = previous && now - previous.time < 350 && distance(previous.point, snapped) < 8;
    const closeToStart = draft.length >= 3 && distance(draft[0], snapped) <= Number(canvas?.dimensions?.size ?? 100) / 4;
    if (!double && !closeToStart) draft.push(snapped);
    draft._last = { time: now, point: snapped };
    if ((double || closeToStart) && draft.length >= 3) {
      polygon = [...draft]; draft = []; regenerate(); return;
    }
    drawBoundary(point); return;
  }
  if (!polygon) return ui.notifications.warn(localize("NoArea", "No suitable area was found."));
  regenerate();
}

function onPointerMove(event) { if (activeMode === "polygon" && draft.length) drawBoundary(eventPoint(event)); }
function snap(point) { const size = Number(canvas?.dimensions?.size ?? 100) / 4; return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size }; }

function clearSelection() { polygon = null; layout = []; layoutLevelId = null; draft = []; clearPreview(); }
function regenerate() {
  if (!polygon) return;
  const preset = currentPreset();
  if (!preset) { layout = []; drawPreview(); return ui.notifications.warn(localize("NoPresets", "Create a preset first.")); }
  layoutLevelId = canvas?.level?.id ?? null;
  layout = generateLayout(polygon, preset, seed, DENSITIES[density]); drawPreview();
}

export function generateLayout(area, presetData, seedValue, multiplier) {
  const random = mulberry32(hash(`${seedValue}:${presetData.id ?? presetData.name}`));
  const grid = Number(canvas?.dimensions?.size ?? 100); const bounds = polygonBounds(area);
  const roomAngle = dominantRoomAngle(area);
  const areaCells = Math.abs(polygonArea(area)) / (grid * grid); const placed = []; const obstacles = existingObstacles(grid, area, presetData.environment);
  const collisionIndex = new SpatialHash(grid * 2);
  for (const obstacle of obstacles) if (obstacle.blocks !== false) collisionIndex.add(obstacle);
  const barracksPreset = isBarracksPreset(presetData);
  let configured = Array.isArray(presetData.items) ? presetData.items.filter((item) => !["chair", "stool"].includes(item.key)).map((item) => ({
    zone: WALL_ASSET_KEYS.includes(item.key) || item.zone === "wall" || (barracksPreset && BED_ASSET_KEYS.includes(item.key)) ? "perimeter" : ["free", "cluster"].includes(item.zone) ? "scatter" : item.zone,
    assets: [item.key], target: item.target, random: Boolean(item.random), min: Math.max(0, Number(item.min) || 0), max: Math.max(Number(item.min) || 0, Number(item.max) || 0),
    uniformSize: null,
    seats: TABLE_KEYS.includes(item.key)?normalizeTableSeats(item.seats,item.key):null,
  })) : [];
  if (barracksPreset) configured = consolidateBarracksBeds(configured, random, presetData.rules, multiplier, areaCells);
  const rules = configured.filter((item) => item.zone !== "on").map((definition) => {
    if (definition.fixedAssets) return {...definition, desired:definition.fixedAssets.length};
    const roll = random(); const biased = multiplier < 1 ? roll * multiplier : multiplier > 1 ? 1 - (1 - roll) / multiplier : roll;
    const sampleAsset=ASSETS[definition.assets[0]], footprintCells=Math.max(.25,(sampleAsset?.size??1)**2);
    const desired = definition.random ? Math.min(50,Math.max(0,Math.round(areaCells*multiplier*(.75+roll*.5)/(footprintCells*3)))) : Math.min(50, definition.min + Math.floor(biased * (definition.max - definition.min + 1)));
    return {...definition,desired};
  });
  const fitScale=layoutFitScale(rules,areaCells);
  let barracksPlanCount = null;
  for (const definition of rules) {
    if (definition.barracksBed) {
      const barracksPlan = buildBarracksBedPlan(definition, area, grid, collisionIndex, fitScale);
      barracksPlanCount = barracksPlan.length;
      for (const item of barracksPlan) {
        placed.push(item);
        if (item.blocks !== false) collisionIndex.add(item);
      }
      continue;
    }
    const desired=definition.desired;
    for (let i = 0; i < desired; i += 1) {
      let accepted = null; const required=!definition.random||i<definition.min;
      for (let attempt = 0; attempt < (required ? 240 : 100) && !accepted; attempt += 1) {
        const key = definition.assets[Math.floor(random() * definition.assets.length)]; const asset = ASSETS[key]; if (!asset) continue;
        const size = definition.uniformSize ? Math.max(minimumAutoSize(key,definition.seats),definition.uniformSize*fitScale) : Math.max(minimumAutoSize(key,definition.seats),asset.size*fitScale*(0.9+random()*0.1)); const dims = assetDimensions(asset, size); const footprint = collisionDimensions(key, dims);
        expandTableFootprint(key,footprint,definition.seats,fitScale);
        const candidate = candidatePoint(definition.zone, area, bounds, random, grid, footprint);
        const rotation = TABLE_KEYS.includes(key) ? roomAngle
          : definition.zone === "perimeter" ? snapQuarterTurn(candidate.angle)
            : Math.floor(random() * 4) * 90;
        const box = orientedBox(candidate.x, candidate.y, footprint.width * grid, footprint.height * grid, rotation);
        if (!box.corners.every((corner) => pointInPolygon(corner, area))) continue;
        const padding=grid*0.08*Math.max(0.25,fitScale);
        if (asset.layer !== "ground" && collisionIndex.query(box, padding).some((other) => boxesOverlap(box, other.box, padding))) continue;
        accepted = { key, x: candidate.x, y: candidate.y, size, rotation, box, blocks: asset.layer !== "ground", seats: definition.seats };
      }
      if (!accepted && required) accepted = findRequiredPlacement(definition, area, bounds, grid, placed, obstacles, roomAngle, random, collisionIndex,fitScale);
      if (accepted) { placed.push(accepted); if (accepted.blocks !== false) collisionIndex.add(accepted); }
    }
  }
  for (const definition of configured.filter((item) => item.zone === "on")) {
    const supports = placed.filter((item) => item.key === definition.target); if (!supports.length) continue;
    const desired = definition.random ? Math.min(50,Math.max(0,Math.round(supports.length*multiplier*(.75+random()*.5)))) : Math.min(50, definition.min + Math.floor(random() * (definition.max - definition.min + 1)));
    for (let index = 0; index < desired; index += 1) {
      const key = definition.assets[index % definition.assets.length]; const asset = ASSETS[key]; const supportIndex = index % supports.length; const support = supports[supportIndex]; if (!asset || !support) continue;
      const size = asset.size * (0.85 + random() * 0.15); const dims = assetDimensions(asset, size); const radians = support.rotation * Math.PI / 180;
      const localIndex = Math.floor(index / supports.length); const count = Math.floor((desired - 1 - supportIndex) / supports.length) + 1;
      const supportDims = assetDimensions(ASSETS[support.key], support.size); const offset = surfaceOffset(localIndex, count, supportDims, grid);
      const x = support.x + offset.x * Math.cos(radians) - offset.y * Math.sin(radians); const y = support.y + offset.x * Math.sin(radians) + offset.y * Math.cos(radians);
      placed.push({ key, x, y, size, rotation: support.rotation, onObject: support.key, box: orientedBox(x, y, dims.width * grid, dims.height * grid, support.rotation) });
    }
  }
  enhanceComposition(placed, obstacles, area, grid,random);
  console.warn("[TSU DECORATOR] layout", {
    preset: { id:presetData?.id, name:presetData?.name, environment:presetData?.environment },
    recognizedBarracks: barracksPreset,
    level: getAssetPlacementLevelData(),
    densityMultiplier: multiplier,
    grid,
    area: { cells:Number(areaCells.toFixed(3)), bounds },
    configured: configured.map((definition) => ({
      assets:[...definition.assets],
      fixedAssets:definition.fixedAssets ? [...definition.fixedAssets] : null,
      min:definition.min,
      max:definition.max,
      zone:definition.zone,
      barracksBed:Boolean(definition.barracksBed),
    })),
    obstacles: obstacles.map((obstacle) => ({
      source:obstacle.source,
      id:obstacle.id,
      name:obstacle.name,
      key:obstacle.key,
      center:obstacle.center,
      box:obstacle.box ? { x:obstacle.box.x, y:obstacle.box.y, width:obstacle.box.width, height:obstacle.box.height, rotation:obstacle.box.rotation } : null,
    })),
    barracksPlanCount,
    resultCount: placed.length,
    result: placed.map((item, index) => ({
      index,
      key:item.key,
      x:Number(item.x.toFixed(2)),
      y:Number(item.y.toFixed(2)),
      rotation:item.rotation,
      size:Number(item.size.toFixed(4)),
    })),
  });
  return placed;
}

function isBarracksPreset(preset) {
  const environment = String(preset?.environment ?? "").trim().toLowerCase();
  const id = String(preset?.id ?? "").trim().toLowerCase();
  const bedItems = Array.isArray(preset?.items) ? preset.items.filter((item) => BED_ASSET_KEYS.includes(item.key)) : [];
  return environment === "barracks"
    || id === "builtin-barracks"
    || id.includes("barrack")
    || preset?.rules?.uniformBedSize === true
    || (bedItems.length >= 2 && bedItems.every((item) => item.zone === "wall"));
}

function enhanceComposition(placed, obstacles, area, grid,random) {
  {
    const tables = placed.filter((item) => TABLE_KEYS.includes(item.key));
    for (const table of tables) {
      const settings=normalizeTableSeats(table.seats,table.key);if(!settings.enabled||!settings.max)continue;
      const seatKey = settings.key;const seatCount=settings.min+Math.floor(random()*(settings.max-settings.min+1));if(!seatCount)continue;
      const chairAsset = ASSETS[seatKey]; const tableAsset = ASSETS[table.key];
      const tableDims = assetDimensions(tableAsset, table.size);const unitSeatWidth=assetDimensions(chairAsset,1).width;
      const availableSeatWidth=table.key==="roundTable"?Math.PI*Math.max(tableDims.width,tableDims.height)*0.9/seatCount:tableDims.width*0.92/Math.ceil(seatCount/2);
      const chairSize = Math.max(AUTO_MIN_SIZE_CELLS,Math.min(chairAsset.size*Math.min(1,table.size/tableAsset.size),availableSeatWidth/unitSeatWidth)); const chairDims = assetDimensions(chairAsset, chairSize);
      const radians = table.rotation * Math.PI / 180;
      for (const local of tableSeatPositions(table.key,tableDims,chairDims,seatCount,grid)) {
        const x = table.x + local.x * Math.cos(radians) - local.y * Math.sin(radians);
        const y = table.y + local.x * Math.sin(radians) + local.y * Math.cos(radians);
        const rotation = snapQuarterTurn(Math.atan2(table.y - y, table.x - x) * 180 / Math.PI - 90);
        const box = orientedBox(x, y, chairDims.width * grid, chairDims.height * grid, rotation);
        if (!box.corners.every((corner) => pointInPolygon(corner, area))) continue;
        if (obstacles.some((other) => boxesOverlap(box, other.box, grid * 0.02))) continue;
        const blockers = placed.filter((other) => other !== table && other.blocks!==false && boxesOverlap(box, other.box, grid * 0.02));
        if (blockers.length) continue;
        placed.push({ key: seatKey, x, y, size: chairSize, rotation, box });
      }
    }
  }
  {
    for (const desk of placed.filter((item) => item.key === "desk")) {
      const asset = ASSETS.chair; const chairSize=Math.max(AUTO_MIN_SIZE_CELLS,asset.size*Math.min(1,desk.size/ASSETS.desk.size)); const dims = assetDimensions(asset, chairSize); const radians = desk.rotation * Math.PI / 180;
      const deskDims = assetDimensions(ASSETS.desk, desk.size); const offset = (deskDims.height + dims.height) * grid / 2 + grid * 0.06;
      const x = desk.x - Math.sin(radians) * offset; const y = desk.y + Math.cos(radians) * offset;
      const rotation = snapQuarterTurn(Math.atan2(desk.y - y, desk.x - x) * 180 / Math.PI - 90);
      const box = orientedBox(x, y, dims.width * grid, dims.height * grid, rotation);
      if (box.corners.every((corner) => pointInPolygon(corner, area)) && ![...obstacles, ...placed].some((other) => boxesOverlap(box, other.box, grid * 0.04))) {
        placed.push({ key: "chair", x, y, size: chairSize, rotation, box });
      }
    }
  }
  {
    const altar = placed.find((item) => item.key === "altar");
    if (altar) for (const item of placed.filter((candidate) => candidate.key === "pew")) {
      item.rotation = snapQuarterTurn(Math.atan2(altar.y - item.y, altar.x - item.x) * 180 / Math.PI + 90);
      const dims = assetDimensions(ASSETS.pew, item.size); item.box = orientedBox(item.x, item.y, dims.width * grid, dims.height * grid, item.rotation);
    }
  }
}

function tableSeatPositions(tableKey,tableDims,seatDims,count,grid) {
  const result=[];
  if(tableKey==="roundTable") {
    const radiusX=(tableDims.width+seatDims.height)*grid/2+grid*0.04;
    const radiusY=(tableDims.height+seatDims.height)*grid/2+grid*0.04;
    for(let index=0;index<count;index+=1) {
      const angle=-Math.PI/2+index*Math.PI*2/count;
      result.push({x:Math.cos(angle)*radiusX,y:Math.sin(angle)*radiusY});
    }
    return result;
  }
  const counts=[Math.ceil(count/2),Math.floor(count/2)];
  for(let sideIndex=0;sideIndex<2;sideIndex+=1) {
    const sideCount=counts[sideIndex];if(!sideCount)continue;
    const usable=Math.max(0,(tableDims.width-seatDims.width*1.2)*grid);
    for(let index=0;index<sideCount;index+=1) {
      const x=sideCount===1?0:(index/(sideCount-1)-0.5)*usable;
      const y=(sideIndex?1:-1)*((tableDims.height+seatDims.height)*grid/2+grid*0.06);
      result.push({x,y});
    }
  }
  return result;
}

function candidatePoint(zone, area, bounds, random, grid, dims) {
  if (zone === "perimeter") {
    const edgeIndex = Math.floor(random() * area.length); const a = area[edgeIndex]; const b = area[(edgeIndex + 1) % area.length]; const tValue = 0.15 + random() * 0.7;
    const edge = { x: a.x + (b.x - a.x) * tValue, y: a.y + (b.y - a.y) * tValue }; const length = distance(a, b) || 1;
    const normals = [{ x: -(b.y - a.y) / length, y: (b.x - a.x) / length }, { x: (b.y - a.y) / length, y: -(b.x - a.x) / length }];
    const offset = (dims.height / 2 + 0.12) * grid; const normal = normals.find((n) => pointInPolygon({ x: edge.x + n.x * offset, y: edge.y + n.y * offset }, area)) ?? normals[0];
    return { x: edge.x + normal.x * offset, y: edge.y + normal.y * offset, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
  }
  if (zone === "center") { const c = polygonCentroid(area); return { x: c.x + (random() - 0.5) * bounds.width * 0.1, y: c.y + (random() - 0.5) * bounds.height * 0.1, angle: 0 }; }
  for (let i = 0; i < 100; i += 1) { const p = { x: bounds.x + random() * bounds.width, y: bounds.y + random() * bounds.height, angle: 0 }; if (pointInPolygon(p, area)) return p; }
  return { ...polygonCentroid(area), angle: 0 };
}

function consolidateBarracksBeds(configured, random, rules = {}, multiplier = 1, areaCells = 0) {
  const beds = configured.filter((definition) => BED_ASSET_KEYS.includes(definition.assets[0]));
  if (!beds.length) return configured;
  const counts = beds.map((definition) => {
    const roll = random();
    const biased = multiplier < 1 ? roll * multiplier : multiplier > 1 ? 1 - (1 - roll) / multiplier : roll;
    const asset = ASSETS[definition.assets[0]], footprintCells = Math.max(0.25, (asset?.size ?? 1) ** 2);
    const rolled = definition.random
      ? Math.round(areaCells * multiplier * (0.75 + roll * 0.5) / (footprintCells * 3))
      : definition.min + Math.floor(biased * (definition.max - definition.min + 1));
    return { definition, count: Math.min(50, Math.max(definition.min, rolled)) };
  });
  let total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total % 2) {
    const expandable = counts.find((entry) => entry.count < entry.definition.max);
    const reducible = [...counts].reverse().find((entry) => entry.count > entry.definition.min);
    if (expandable) { expandable.count += 1; total += 1; }
    else if (reducible) { reducible.count -= 1; total -= 1; }
    else { counts.at(-1).count += 1; total += 1; }
  }
  const fixedAssets = counts.flatMap(({ definition, count }) => Array.from({ length: count }, () => definition.assets[0]));
  const availableAssets = fixedAssets.map((key) => ASSETS[key]).filter(Boolean);
  if (!availableAssets.length) return configured;
  const merged = {
    zone: "perimeter",
    assets: fixedAssets,
    fixedAssets,
    target: null,
    random: false,
    min: Math.min(50, beds.reduce((sum, definition) => sum + definition.min, 0)),
    max: total,
    uniformSize: Math.min(...availableAssets.map((asset) => asset.size)),
    seats: null,
    barracksBed: true,
  };
  return [merged, ...configured.filter((definition) => !BED_ASSET_KEYS.includes(definition.assets[0]))];
}

function buildBarracksBedPlan(definition, area, grid, collisionIndex, fitScale) {
  const keys = definition.fixedAssets ?? definition.assets;
  if (!keys.length || keys.some((key) => !ASSETS[key])) return [];
  const roomSides = simplifyCollinearPolygon(area);
  const wallClearance = grid * 0.14, minimumGap = grid * 0.12, padding = grid * 0.025;
  const rectangularPlan = buildRectangularBarracksPlan(keys, definition, area, grid, collisionIndex, fitScale, wallClearance, minimumGap, padding);
  if (rectangularPlan.length === keys.length) return rectangularPlan;
  const rawWalls = [];
  for (let edgeIndex = 0; edgeIndex < roomSides.length; edgeIndex += 1) {
    const a = roomSides[edgeIndex], b = roomSides[(edgeIndex + 1) % roomSides.length], length = distance(a, b);
    if (!length) continue;
    const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    rawWalls.push({ edgeIndex, a, b, length, tangent, midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }
  const wallPairs = [];
  for (let leftIndex = 0; leftIndex < rawWalls.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rawWalls.length; rightIndex += 1) {
      const left = rawWalls[leftIndex], right = rawWalls[rightIndex];
      const parallel = Math.abs(left.tangent.x * right.tangent.x + left.tangent.y * right.tangent.y);
      const sharesCorner = [left.a, left.b].some((point) => [right.a, right.b].some((other) => distance(point, other) < wallClearance));
      if (parallel < 0.95 || sharesCorner) continue;
      const delta = { x: right.midpoint.x - left.midpoint.x, y: right.midpoint.y - left.midpoint.y };
      const separation = Math.abs(-left.tangent.y * delta.x + left.tangent.x * delta.y);
      wallPairs.push({ left, right, score: Math.min(left.length, right.length), separation });
    }
  }
  wallPairs.sort((left, right) => right.score - left.score);
  if (!wallPairs.length) return [];
  const unitGeometries = keys.map((assetKey) => assetOpaqueGeometry(assetKey, 1));
  const maximumUnitWidth = Math.max(...unitGeometries.map((geometry) => geometry.opaqueWidth));
  const maximumUnitDepth = Math.max(...unitGeometries.map((geometry) => geometry.opaqueHeight));
  const pairCount = Math.ceil(keys.length / 2);
  const preferredSize = Math.max(AUTO_MIN_SIZE_CELLS, (definition.uniformSize ?? Math.min(...keys.map((key) => ASSETS[key].size))) * fitScale);
  for (const pair of wallPairs) {
    const maximumDepth = (pair.separation - wallClearance * 2 - padding) / 2;
    const maximumWidth = (pair.score - wallClearance * 2 - Math.max(0, pairCount - 1) * minimumGap) / pairCount;
    const fittedSize = Math.min(preferredSize, maximumDepth / (maximumUnitDepth * grid), maximumWidth / (maximumUnitWidth * grid));
    for (let size = fittedSize; size >= 0.12; size *= 0.88) {
      const commonSlotWidth = maximumUnitWidth * size, axis = pair.left.tangent, plan = [], plannedBoxes = [];
      let valid = true;
      for (let bedIndex = 0; bedIndex < keys.length; bedIndex += 1) {
        const key = keys[bedIndex], geometry = assetOpaqueGeometry(key, size), slotIndex = Math.floor(bedIndex / 2), sideIndex = bedIndex % 2;
        const wallCandidates = [pair.left, pair.right].map((wall) => barracksWallSlots(wall, pairCount, commonSlotWidth, wallClearance, area, geometry, grid));
        if (wallCandidates.some((slots) => slots.length !== pairCount)) { valid = false; break; }
        wallCandidates[0].sort((a, b) => a.opaqueX * axis.x + a.opaqueY * axis.y - b.opaqueX * axis.x - b.opaqueY * axis.y);
        wallCandidates[1].sort((a, b) => a.opaqueX * axis.x + a.opaqueY * axis.y - b.opaqueX * axis.x - b.opaqueY * axis.y);
        const candidate = wallCandidates[sideIndex][slotIndex];
        if (!candidate) { valid = false; break; }
        const box = orientedBox(candidate.opaqueX, candidate.opaqueY, geometry.opaqueWidth * grid, geometry.opaqueHeight * grid, candidate.rotation);
        if (!box.corners.every((corner) => pointInPolygon(corner, area))) { valid = false; break; }
        if (collisionIndex.query(box, padding).some((other) => boxesOverlap(box, other.box, padding))) { valid = false; break; }
        if (plannedBoxes.some((other) => boxesOverlap(box, other, padding))) { valid = false; break; }
        plannedBoxes.push(box);
        plan.push({ key, x:candidate.x, y:candidate.y, size, rotation:candidate.rotation, box, blocks:true, seats:null });
      }
      if (valid && plan.length === keys.length) return plan;
      if (size <= 0.121) break;
    }
  }
  return [];
}

function buildRectangularBarracksPlan(keys, definition, area, grid, collisionIndex, fitScale, clearance, minimumGap, padding) {
  const bounds = polygonBounds(area), boundsArea = bounds.width * bounds.height;
  if (!boundsArea || Math.abs(polygonArea(area)) / boundsArea < 0.92) return [];
  const horizontal = bounds.width >= bounds.height;
  const wallLength = horizontal ? bounds.width : bounds.height;
  const separation = horizontal ? bounds.height : bounds.width;
  const pairCount = Math.ceil(keys.length / 2);
  const unitGeometries = keys.map((key) => assetOpaqueGeometry(key, 1));
  const maximumUnitWidth = Math.max(...unitGeometries.map((geometry) => geometry.opaqueWidth));
  const maximumUnitDepth = Math.max(...unitGeometries.map((geometry) => geometry.opaqueHeight));
  const preferredSize = Math.max(AUTO_MIN_SIZE_CELLS, (definition.uniformSize ?? Math.min(...keys.map((key) => ASSETS[key].size))) * fitScale);
  const maximumDepth = (separation - clearance * 2 - padding) / 2;
  const maximumWidth = (wallLength - clearance * 2 - Math.max(0, pairCount - 1) * minimumGap) / pairCount;
  const fittedSize = Math.min(preferredSize, maximumDepth / (maximumUnitDepth * grid), maximumWidth / (maximumUnitWidth * grid));
  for (let size = fittedSize; size >= 0.12; size *= 0.88) {
    const slotWidth = maximumUnitWidth * size * grid;
    const available = wallLength - clearance * 2;
    if (available < slotWidth * pairCount) continue;
    const spacing = pairCount > 1 ? (available - slotWidth * pairCount) / (pairCount - 1) : 0;
    const start = pairCount > 1 ? clearance + slotWidth / 2 : wallLength / 2;
    const plan = [], plannedBoxes = [];
    let valid = true;
    for (let bedIndex = 0; bedIndex < keys.length; bedIndex += 1) {
      const key = keys[bedIndex], geometry = assetOpaqueGeometry(key, size), slotIndex = Math.floor(bedIndex / 2), sideIndex = bedIndex % 2;
      const along = start + slotIndex * (slotWidth + spacing);
      const rotation = horizontal ? (sideIndex ? 180 : 0) : (sideIndex ? 270 : 90);
      const opaqueX = horizontal
        ? bounds.x + along
        : bounds.x + (sideIndex ? bounds.width - clearance - geometry.opaqueHeight * grid / 2 : clearance + geometry.opaqueHeight * grid / 2);
      const opaqueY = horizontal
        ? bounds.y + (sideIndex ? bounds.height - clearance - geometry.opaqueHeight * grid / 2 : clearance + geometry.opaqueHeight * grid / 2)
        : bounds.y + along;
      const candidate = spritePositionFromOpaqueCenter(opaqueX, opaqueY, geometry, rotation, grid);
      const box = orientedBox(opaqueX, opaqueY, geometry.opaqueWidth * grid, geometry.opaqueHeight * grid, rotation);
      if (!box.corners.every((corner) => pointInPolygon(corner, area))) { valid = false; break; }
      if (collisionIndex.query(box, padding).some((other) => boxesOverlap(box, other.box, padding))) { valid = false; break; }
      if (plannedBoxes.some((other) => boxesOverlap(box, other, padding))) { valid = false; break; }
      plannedBoxes.push(box);
      plan.push({ key, x:candidate.x, y:candidate.y, size, rotation, box, blocks:true, seats:null });
    }
    if (valid && plan.length === keys.length) return plan;
    if (size <= 0.121) break;
  }
  return [];
}

function barracksWallSlots(wall, count, slotWidthCells, clearance, area, geometry, grid) {
  const available = wall.length - clearance * 2, slotWidth = slotWidthCells * grid;
  if (count < 1 || available < slotWidth * count) return [];
  const spacing = count > 1 ? (available - slotWidth * count) / (count - 1) : 0;
  const start = count > 1 ? clearance + slotWidth / 2 : wall.length / 2;
  const normals = [{ x:-wall.tangent.y, y:wall.tangent.x }, { x:wall.tangent.y, y:-wall.tangent.x }];
  const testOffset = geometry.opaqueHeight * grid / 2 + clearance;
  const normal = normals.find((value) => pointInPolygon({ x:wall.midpoint.x + value.x * testOffset, y:wall.midpoint.y + value.y * testOffset }, area));
  if (!normal) return [];
  const rotation = snapQuarterTurn(Math.atan2(wall.tangent.y, wall.tangent.x) * 180 / Math.PI);
  const result = [];
  for (let slot = 0; slot < count; slot += 1) {
    const along = start + slot * (slotWidth + spacing);
    const edge = { x:wall.a.x + wall.tangent.x * along, y:wall.a.y + wall.tangent.y * along };
    const opaqueX = edge.x + normal.x * testOffset, opaqueY = edge.y + normal.y * testOffset;
    result.push({ opaqueX, opaqueY, ...spritePositionFromOpaqueCenter(opaqueX, opaqueY, geometry, rotation, grid), rotation });
  }
  return result;
}

function spritePositionFromOpaqueCenter(opaqueX, opaqueY, geometry, rotation, grid) {
  const radians = rotation * Math.PI / 180;
  const rotatedOffsetX = geometry.offsetX * grid * Math.cos(radians) - geometry.offsetY * grid * Math.sin(radians);
  const rotatedOffsetY = geometry.offsetX * grid * Math.sin(radians) + geometry.offsetY * grid * Math.cos(radians);
  return { x:opaqueX - rotatedOffsetX, y:opaqueY - rotatedOffsetY };
}

function assetOpaqueGeometry(key, size) {
  const asset = ASSETS[key], dimensions = assetDimensions(asset, size);
  const [left, top, right, bottom] = ASSET_OPAQUE_BOUNDS[key] ?? [0, 0, 1, 1];
  return {
    opaqueWidth: dimensions.width * (right - left),
    opaqueHeight: dimensions.height * (bottom - top),
    offsetX: dimensions.width * ((left + right) / 2 - 0.5),
    offsetY: dimensions.height * ((top + bottom) / 2 - 0.5),
  };
}

function simplifyCollinearPolygon(points) {
  const simplified = points.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  let changed = true;
  while (changed && simplified.length > 3) {
    changed = false;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      const first = { x: current.x - previous.x, y: current.y - previous.y };
      const second = { x: next.x - current.x, y: next.y - current.y };
      const firstLength = Math.hypot(first.x, first.y), secondLength = Math.hypot(second.x, second.y);
      if (!firstLength || !secondLength) {
        simplified.splice(index, 1); changed = true; break;
      }
      const cross = Math.abs(first.x * second.y - first.y * second.x) / (firstLength * secondLength);
      const direction = (first.x * second.x + first.y * second.y) / (firstLength * secondLength);
      if (cross <= 0.01 && direction > 0.99) {
        simplified.splice(index, 1); changed = true; break;
      }
    }
  }
  return simplified;
}

function findRequiredPlacement(definition, area, bounds, grid, placed, obstacles, roomAngle, random, collisionIndex=null,preferredScale=1) {
  const key = definition.assets[Math.floor(random() * definition.assets.length)]; const asset = ASSETS[key]; if (!asset) return null;
  const minimumSize=minimumAutoSize(key,definition.seats);const startSize=Math.max(minimumSize,(definition.uniformSize??asset.size)*preferredScale); const sizes=[startSize];
  while(!definition.uniformSize&&sizes.at(-1)>minimumSize) {
    const next=Math.max(minimumSize,sizes.at(-1)*0.82);
    if(Math.abs(next-sizes.at(-1))<0.001)break;
    sizes.push(next);
  }
  for(const size of sizes) {
    const dims = assetDimensions(asset, size); const footprint = collisionDimensions(key, dims);
    expandTableFootprint(key,footprint,definition.seats,size/asset.size);
    const candidates = [];
    if (definition.zone === "perimeter") {
      for (let edgeIndex = 0; edgeIndex < area.length; edgeIndex += 1) {
        const a = area[edgeIndex], b = area[(edgeIndex + 1) % area.length], length = distance(a, b) || 1;
        const normals = [{ x: -(b.y-a.y)/length, y:(b.x-a.x)/length }, { x:(b.y-a.y)/length, y:-(b.x-a.x)/length }];
        const offset = (footprint.height / 2 + 0.04) * grid;
        for (let step = 1; step < 24; step += 1) {
          const ratio = step / 24, edge = { x:a.x+(b.x-a.x)*ratio, y:a.y+(b.y-a.y)*ratio };
          for (const normal of normals) { const point={x:edge.x+normal.x*offset,y:edge.y+normal.y*offset}; if(pointInPolygon(point,area)) candidates.push({...point,rotation:snapQuarterTurn(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI)}); }
        }
      }
    } else {
      const center=polygonCentroid(area); candidates.push({x:center.x,y:center.y,rotation:TABLE_KEYS.includes(key)?roomAngle:0});
      for (let attempt=0;attempt<180;attempt+=1) {
        const x=bounds.x+random()*bounds.width,y=bounds.y+random()*bounds.height;
        if (!pointInPolygon({x,y},area)) continue;
        const base = TABLE_KEYS.includes(key) ? roomAngle : 0;
        for (const rotation of TABLE_KEYS.includes(key) ? [base] : [0,90,180,270]) candidates.push({x,y,rotation});
      }
    }
    for (const candidate of candidates) {
      const box = orientedBox(candidate.x,candidate.y,footprint.width*grid,footprint.height*grid,candidate.rotation);
      if (!box.corners.every((corner)=>pointInPolygon(corner,area))) continue;
      const nearby = collisionIndex ? collisionIndex.query(box) : [...obstacles,...placed].filter((other)=>other.blocks!==false);
      const collides = asset.layer !== "ground" && nearby.some((other)=>boxesOverlap(box,other.box,0));
      if (!collides) return {key,x:candidate.x,y:candidate.y,size,rotation:candidate.rotation,box,blocks:asset.layer!=="ground",seats:definition.seats};
    }
  }
  return null;
}

function layoutFitScale(rules,areaCells) {
  let requestedFootprint=0;
  for(const definition of rules) {
    const key=definition.assets[0],asset=ASSETS[key];
    if(!asset||asset.layer==="ground")continue;
    const dims=assetDimensions(asset,asset.size); const footprint=collisionDimensions(key,dims);
    expandTableFootprint(key,footprint,definition.seats,1);
    requestedFootprint+=definition.desired*(footprint.width+0.12)*(footprint.height+0.12);
  }
  if(!requestedFootprint)return 1;
  return Math.min(1,Math.sqrt(Math.max(0.04,areaCells*0.62)/requestedFootprint));
}
function expandTableFootprint(tableKey,footprint,seats,scale) {
  if(!TABLE_KEYS.includes(tableKey))return;
  const settings=normalizeTableSeats(seats,tableKey);if(!settings.enabled||!settings.max)return;
  const seat=ASSETS[settings.key];const seatSize=Math.max(AUTO_MIN_SIZE_CELLS,seat.size*Math.min(1,scale));const seatDims=assetDimensions(seat,seatSize);
  footprint.height+=2*seatDims.height+0.12;
  if(tableKey==="roundTable")footprint.width+=2*seatSize+0.12;
}
function minimumAutoSize(key,seats) {
  if(!TABLE_KEYS.includes(key))return AUTO_MIN_SIZE_CELLS;
  const settings=normalizeTableSeats(seats,key);if(!settings.enabled||!settings.max)return AUTO_MIN_SIZE_CELLS;
  const seat=ASSETS[settings.key],seatWidth=assetDimensions(seat,AUTO_MIN_SIZE_CELLS).width;
  const neededWidth=key==="roundTable"?settings.max*seatWidth/(Math.PI*0.9):Math.ceil(settings.max/2)*seatWidth/0.92;
  return Math.max(AUTO_MIN_SIZE_CELLS,neededWidth/assetDimensions(ASSETS[key],1).width);
}

function assetDimensions(asset, longest) { const aspect = asset.aspect || 1; return aspect >= 1 ? { width: longest, height: longest / aspect } : { width: longest * aspect, height: longest }; }
function collisionDimensions(key, dims) { return WALL_ASSET_KEYS.includes(key) ? { width: dims.width, height: Math.min(dims.height, 0.32) } : dims; }
function surfaceOffset(index, count, supportDims, grid) {
  if (count <= 1) return { x: 0, y: 0 };
  if (count === 2) return { x: (index ? 1 : -1) * Math.min(grid * 0.16, supportDims.width * grid * 0.22), y: 0 };
  if (count === 3) return { x: (index - 1) * Math.min(grid * 0.18, supportDims.width * grid * 0.24), y: 0 };
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), row = Math.floor(index / columns), rowCount = Math.min(columns, count - row * columns), column = index % columns;
  const stepX = Math.min(grid * 0.2, supportDims.width * grid * 0.55 / Math.max(1, columns - 1));
  const stepY = Math.min(grid * 0.16, supportDims.height * grid * 0.45 / Math.max(1, rows - 1));
  return { x: (column - (rowCount - 1) / 2) * stepX, y: (row - (rows - 1) / 2) * stepY };
}
function snapQuarterTurn(angle) { return (Math.round(Number(angle || 0) / 90) * 90 + 360) % 360; }
function dominantRoomAngle(area) {
  let longest = null;
  for (let index = 0; index < area.length; index += 1) {
    const a = area[index], b = area[(index + 1) % area.length], length = distance(a, b);
    if (!longest || length > longest.length) longest = { length, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
  }
  return snapQuarterTurn(longest?.angle ?? 0);
}
function orientedBox(x, y, width, height, rotation) { const r = rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); const corners = [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([dx,dy]) => ({ x:x+dx*c-dy*s, y:y+dx*s+dy*c })); return { x, y, width, height, corners, radius: Math.hypot(width,height)/2 }; }
function boxesOverlap(a, b, padding = 0) {
  if (distance(a, b) > a.radius + b.radius + padding) return false;
  const axes = [];
  for (const box of [a, b]) for (let index = 0; index < 2; index += 1) {
    const p = box.corners[index]; const q = box.corners[index + 1]; const length = distance(p, q) || 1;
    axes.push({ x: -(q.y - p.y) / length, y: (q.x - p.x) / length });
  }
  return axes.every((axis) => {
    const left = a.corners.map((p) => p.x * axis.x + p.y * axis.y);
    const right = b.corners.map((p) => p.x * axis.x + p.y * axis.y);
    return Math.max(...left) + padding >= Math.min(...right) && Math.max(...right) + padding >= Math.min(...left);
  });
}
class SpatialHash {
  constructor(cellSize) { this.cellSize=Math.max(1,Number(cellSize)||1); this.cells=new Map(); }
  keys(box,padding=0) {
    const xs=box.corners.map((point)=>point.x),ys=box.corners.map((point)=>point.y);
    const left=Math.floor((Math.min(...xs)-padding)/this.cellSize),right=Math.floor((Math.max(...xs)+padding)/this.cellSize);
    const top=Math.floor((Math.min(...ys)-padding)/this.cellSize),bottom=Math.floor((Math.max(...ys)+padding)/this.cellSize);
    const keys=[]; for(let y=top;y<=bottom;y+=1)for(let x=left;x<=right;x+=1)keys.push(`${x},${y}`); return keys;
  }
  add(item) { for(const key of this.keys(item.box)) { const bucket=this.cells.get(key)??new Set();bucket.add(item);this.cells.set(key,bucket); } }
  query(box,padding=0) { const found=new Set();for(const key of this.keys(box,padding))for(const item of this.cells.get(key)??[])found.add(item);return [...found]; }
}
function documentOnCurrentLevel(document) {
  const level = canvas?.level;
  if (!level) return true;
  if (typeof document?.includedInLevel === "function") return document.includedInLevel(level) !== false;
  const ids = document?.levels ? [...document.levels] : [];
  return !ids.length || ids.includes(level.id);
}

function existingObstacles(grid, area, environment) {
  const result = (canvas?.scene?.tiles ?? [])
    .filter((tile) => documentOnCurrentLevel(tile))
    .filter((tile) => !tile.hidden)
    .filter((tile) => {
      const assetFlag = tile.flags?.[MODULE_ID]?.[ASSET_FLAG];
      return assetFlag && assetFlag.layer !== "ground";
    })
    .map((tile) => {
      const center = tile.shape?.center ?? { x: Number(tile.x), y: Number(tile.y) };
      return { center: { x: Number(center.x), y: Number(center.y) }, tile };
    })
    .filter(({ center }) => pointInPolygon(center, area))
    .map(({ center, tile }) => ({
      source:"tile",
      id:tile.id,
      name:tile.name,
      key:tile.flags?.[MODULE_ID]?.[ASSET_FLAG]?.key,
      center,
      box:orientedBox(center.x, center.y, Number(tile.width), Number(tile.height), Number(tile.rotation ?? 0)),
    }));
  if (environment === "outdoor") return result;
  const center = polygonCentroid(area);
  for (const wall of (canvas?.scene?.walls ?? []).filter((candidate) => documentOnCurrentLevel(candidate))) {
    if (!Number(wall.door ?? wall.document?.door ?? 0)) continue;
    const c = wall.c ?? wall.document?.c; if (!Array.isArray(c)) continue;
    const door = { x: (Number(c[0]) + Number(c[2])) / 2, y: (Number(c[1]) + Number(c[3])) / 2 };
    const boundaryDistance = Math.min(...area.map((start, index) => pointSegmentDistance(door, start, area[(index + 1) % area.length])));
    if (boundaryDistance > grid * 0.15) continue;
    const length = distance(door, center); const midpoint = { x: (door.x + center.x) / 2, y: (door.y + center.y) / 2 };
    result.push({ source:"door", id:wall.id, name:wall.name, key:null, center:door, box: orientedBox(midpoint.x, midpoint.y, length, grid, Math.atan2(center.y - door.y, center.x - door.x) * 180 / Math.PI) });
  }
  return result;
}

function drawPreview() {
  clearPreview(); const container = previewContainer(); if (!container || !polygon) return;
  const graphics = new PIXI.Graphics();
  drawFilledPolygon(graphics, polygon, 0x35c9ff, 0.08, 3, 0.9);
  container.addChild(graphics); const grid = Number(canvas?.dimensions?.size ?? 100);
  const previewLimit=600,step=Math.max(1,layout.length/previewLimit);
  for(let cursor=0;cursor<layout.length;cursor+=step){const item=layout[Math.floor(cursor)];const asset=ASSETS[item.key];const dims=assetDimensions(asset,item.size);const sprite=PIXI.Sprite.from(asset.src);sprite.anchor.set(0.5);sprite.position.set(item.x,item.y);sprite.width=dims.width*grid;sprite.height=dims.height*grid;sprite.rotation=item.rotation*Math.PI/180;sprite.alpha=0.72;container.addChild(sprite);}
}

function drawBoundary(cursor) {
  clearPreview(); const container=previewContainer(); if(!container)return;
  const points=cursor?[...draft,snap(cursor)]:draft; const g=new PIXI.Graphics();
  if(points.length&&typeof g.moveTo==="function"){
    if(typeof g.stroke!=="function") g.lineStyle(3,0x35c9ff,.9);
    g.moveTo(points[0].x,points[0].y); for(const p of points.slice(1))g.lineTo(p.x,p.y);
    if(typeof g.stroke==="function") g.stroke({color:0x35c9ff,width:3,alpha:.9});
  }
  container.addChild(g);
}
function drawFilledPolygon(graphics, points, color, fillAlpha, width, lineAlpha) {
  const coordinates=points.flatMap((point)=>[point.x,point.y]);
  if(typeof graphics.poly==="function"&&typeof graphics.fill==="function"&&typeof graphics.stroke==="function") {
    graphics.poly(coordinates).fill({color,alpha:fillAlpha}).stroke({color,width,alpha:lineAlpha}); return;
  }
  graphics.lineStyle(width,color,lineAlpha); graphics.beginFill(color,fillAlpha); graphics.drawPolygon(coordinates); graphics.endFill();
}
function previewContainer(){ const parent=canvas?.interface??canvas?.stage;if(!parent)return null;let c=parent.children?.find((x)=>x.name===PREVIEW);if(!c){c=new PIXI.Container();c.name=PREVIEW;c.eventMode="none";c.zIndex=1900;parent.addChild(c);}return c;}
function clearPreview(){const c=previewContainer();if(c)c.removeChildren().forEach((x)=>x.destroy?.({children:true}));}

async function applyLayout() {
  if (!layout.length || !canvas?.scene) return ui.notifications.warn(localize("Empty", "Nothing could be placed in this area."));
  if (applying) return;
  if (layoutLevelId !== (canvas?.level?.id ?? null)) {
    clearSelection();
    return ui.notifications.warn(localize("LevelChanged", "The map level changed. Select the area again."));
  }
  applying = true;
  const generationId = foundry.utils.randomID?.() ?? crypto.randomUUID(); const grid=Number(canvas.dimensions.size??100);
  const placementLevel=getAssetPlacementLevelData();
  const data=layout.map((item)=>{const asset=ASSETS[item.key],dims=assetDimensions(asset,item.size);const layer=item.onObject?"overhead":asset.layer;const sort=layer==="ground"?-100:layer==="overhead"?100:0;return {name:t(asset.labelKey,asset.fallback),texture:{src:asset.src,anchorX:.5,anchorY:.5,scaleX:1,scaleY:1},x:Math.round(item.x),y:Math.round(item.y),width:Math.round(dims.width*grid),height:Math.round(dims.height*grid),rotation:snapQuarterTurn(item.rotation),elevation:placementLevel.elevation,levels:placementLevel.levels,sort,restrictions:{light:false,weather:false},flags:{[MODULE_ID]:{[ASSET_FLAG]:{key:item.key,layer,level:placementLevel.level,lightId:null,generationId,preset:presetKey,seed,onObject:item.onObject??null,geometryVersion:ASSET_GEOMETRY_VERSION,...(asset.mirror?{mirror:getAssetMirrorFlag(asset)}:{})}}}};});
  try {
    setApplyProgress(0, data.length);
    const created=await createDocumentsInChunks("Tile",data,(done)=>setApplyProgress(done,data.length));
    await createGeneratedLights(created,layout,generationId);
    lastGenerationId=generationId; clearSelection();
    ui.notifications.info(localize("Applied",`Placed ${created.length} assets.`).replace("{count}",created.length));
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply scene decoration`,error);
    ui.notifications.error(localize("ApplyFailed","Could not finish placing the decoration."));
  } finally {
    applying=false; setApplyProgress(null);
  }
}

async function createDocumentsInChunks(type,data,onProgress=null) {
  const created=[]; const batchSize=100;
  for(let offset=0;offset<data.length;offset+=batchSize) {
    const chunk=data.slice(offset,offset+batchSize);
    created.push(...await canvas.scene.createEmbeddedDocuments(type,chunk));
    onProgress?.(Math.min(offset+chunk.length,data.length));
    await yieldToBrowser();
  }
  return created;
}

async function updateDocumentsInChunks(type,data) {
  const batchSize=150;
  for(let offset=0;offset<data.length;offset+=batchSize) {
    await canvas.scene.updateEmbeddedDocuments(type,data.slice(offset,offset+batchSize));
    await yieldToBrowser();
  }
}

async function createGeneratedLights(tiles,items,generationId) {
  const entries=[];
  for(let index=0;index<tiles.length;index+=1) {
    const tile=tiles[index],asset=ASSETS[items[index]?.key],preset=asset?.light ? LIGHT_PRESETS[asset.light] : null;
    if(tile&&preset) entries.push({tile,presetKey:asset.light,preset});
  }
  if(!entries.length)return;
  const lightData=entries.map(({tile,presetKey,preset})=>{
    const center=tile.shape?.center;
    return {name:`${tile.name} — ${localize("Light","Light")}`,x:Math.round(Number(center?.x??tile.x)),y:Math.round(Number(center?.y??tile.y)),elevation:tile.elevation??0,levels:[...(tile.levels??[])],walls:true,vision:false,config:{...foundry.utils.deepClone(preset),darkness:{min:0,max:1}},flags:{[MODULE_ID]:{[ASSET_FLAG]:{tileId:tile.id,preset:presetKey,generationId}}}};
  });
  const lights=await createDocumentsInChunks("AmbientLight",lightData);
  const updates=entries.map(({tile},index)=>({_id:tile.id,[`flags.${MODULE_ID}.${ASSET_FLAG}.lightId`]:lights[index]?.id??null}));
  await updateDocumentsInChunks("Tile",updates);
}

function setApplyProgress(done,total=0) {
  const button=document.getElementById(PANEL)?.querySelector('[data-action="apply"]');
  if(!button)return;
  if(done===null) { button.disabled=false;button.innerHTML=`<i class="fa-solid fa-check"></i> ${localize("Apply","Apply")}`;return; }
  button.disabled=true;button.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> ${done}/${total}`;
}
function yieldToBrowser(){return new Promise((resolve)=>setTimeout(resolve,0));}

async function undoLast(){if(!lastGenerationId||!canvas?.scene)return ui.notifications.warn(localize("NothingToUndo","There is no recent fill to undo."));const ids=[...canvas.scene.tiles].filter((tile)=>tile.flags?.[MODULE_ID]?.[ASSET_FLAG]?.generationId===lastGenerationId).map((tile)=>tile.id);if(ids.length)await canvas.scene.deleteEmbeddedDocuments("Tile",ids);lastGenerationId=null;}

function getFloors(){const value=canvas?.scene?.getFlag?.(MODULE_ID,FLOOR_FLAG);return Array.isArray(value?.floors)?value.floors:[];}
function findFloor(point){const level=getAssetPlacementLevelData().level;return getFloors().filter((floor)=>Number(floor.level??0)===level&&pointInPolygon(point,floor.points)).sort((a,b)=>Math.abs(polygonArea(a.points))-Math.abs(polygonArea(b.points)))[0]?.points??null;}
function wallSegments(){return(canvas?.scene?.walls??[]).filter((wall)=>documentOnCurrentLevel(wall)).map((wall)=>wall.c).filter((c)=>Array.isArray(c)&&c.length>=4).map((c)=>({a:{x:+c[0],y:+c[1]},b:{x:+c[2],y:+c[3]}}));}
function findWallFace(point){const seg=wallSegments(),vertices=new Map(),directed=[];const key=(p)=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`;const vertex=(p)=>{const k=key(p);if(!vertices.has(k))vertices.set(k,{...p,out:[]});return vertices.get(k);};for(const s of seg){const a=vertex(s.a),b=vertex(s.b),ab={from:a,to:b,seen:false},ba={from:b,to:a,seen:false};ab.twin=ba;ba.twin=ab;a.out.push(ab);b.out.push(ba);directed.push(ab,ba);}for(const v of vertices.values())v.out.sort((a,b)=>Math.atan2(a.to.y-a.from.y,a.to.x-a.from.x)-Math.atan2(b.to.y-b.from.y,b.to.x-b.from.x));const faces=[];for(const start of directed){if(start.seen)continue;let edge=start,guard=0;const points=[];while(!edge.seen&&guard++<directed.length+1){edge.seen=true;points.push({x:edge.from.x,y:edge.from.y});const out=edge.to.out,index=out.indexOf(edge.twin);edge=out[(index-1+out.length)%out.length];if(edge===start)break;}if(edge===start&&points.length>=3&&polygonArea(points)>1)faces.push(points);}return faces.filter((p)=>pointInPolygon(point,p)).sort((a,b)=>polygonArea(a)-polygonArea(b))[0]??null;}
function polygonBounds(p){const xs=p.map((q)=>q.x),ys=p.map((q)=>q.y);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
function polygonArea(p){return p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0)/2;}
function polygonCentroid(p){const area=polygonArea(p)||1;let x=0,y=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],f=a.x*b.y-b.x*a.y;x+=(a.x+b.x)*f;y+=(a.y+b.y)*f;}return{x:x/(6*area),y:y/(6*area)};}
function pointInPolygon(point,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a.y>point.y)!==(b.y>point.y))&&point.x<((b.x-a.x)*(point.y-a.y))/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function pointSegmentDistance(point,start,end){const dx=end.x-start.x,dy=end.y-start.y,lengthSquared=dx*dx+dy*dy;if(!lengthSquared)return distance(point,start);const ratio=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared));return distance(point,{x:start.x+dx*ratio,y:start.y+dy*ratio});}
function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

document.addEventListener("keydown",(event)=>{if(activeMode&&event.key==="Escape")clearSelection();});
window.addEventListener("resize",()=>requestAnimationFrame(positionPanel));
Hooks.on("canvasReady",()=>{if(layoutLevelId!==null&&layoutLevelId!==(canvas?.level?.id??null))clearSelection();if(activeMode)bindStage();});
Hooks.on("canvasTearDown",()=>{clearPreview();stageBound=null;});
