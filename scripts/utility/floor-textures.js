import { MODULE_ID, i18nKey, t } from "../core.js";

const SETTING_ENABLE = "enableFloorTextures";
const FLAG_ROOT = "floorTextures";
const CONTROL_NAME = "tsu-floors";
const FLOOR_CONTAINER = "tsu-floor-textures";
const EDIT_CONTAINER = "tsu-floor-edit";
const DEFAULT_STYLE = "uneven-limestone";
const EPSILON = 0.01;
const FLOOR_STYLES = Object.freeze({
  [DEFAULT_STYLE]: Object.freeze({
    labelKey: "Settings.FloorTextures.Choices.UnevenLimestone",
    fallback: "Uneven limestone",
    src: `modules/${MODULE_ID}/images/scene-floors/uneven-limestone-floor.png`,
  }),
  "cave-brown": floorStyle("CaveBrown", "Brown cave floor", "cave-brown-floor.png"),
  "cave-grey-pebbles": floorStyle("CaveGreyPebbles", "Grey cave pebbles", "cave-grey-pebbles-floor.png"),
  "flagstone-grey": floorStyle("FlagstoneGrey", "Grey flagstone", "flagstone-grey-floor.png"),
  "brick-red": floorStyle("BrickRed", "Red brick", "brick-red-floor.png"),
  "wood-walnut": floorStyle("WoodWalnut", "Walnut boards", "wood-walnut-floor.png"),
  "wood-alder": floorStyle("WoodAlder", "Alder boards", "wood-alder-floor.png"),
  "grass-meadow": floorStyle("GrassMeadow", "Meadow grass", "grass-meadow-floor.png"),
  "path-dirt": floorStyle("PathDirt", "Dirt path", "path-dirt-floor.png"),
  "path-cobblestone": floorStyle("PathCobblestone", "Cobblestone path", "path-cobblestone-floor.png"),
  "carpet-red": floorStyle("CarpetRed", "Red carpet", "carpet-red-floor.png"),
  "carpet-blue": floorStyle("CarpetBlue", "Blue carpet", "carpet-blue-floor.png"),
});
const FLOOR_STYLE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "Stone", fallback: "Stone", styles: ["uneven-limestone", "flagstone-grey", "brick-red"] }),
  Object.freeze({ key: "Caves", fallback: "Caves", styles: ["cave-brown", "cave-grey-pebbles"] }),
  Object.freeze({ key: "Wood", fallback: "Wood", styles: ["wood-walnut", "wood-alder"] }),
  Object.freeze({ key: "Nature", fallback: "Nature", styles: ["grass-meadow"] }),
  Object.freeze({ key: "Paths", fallback: "Paths", styles: ["path-dirt", "path-cobblestone"] }),
  Object.freeze({ key: "Carpets", fallback: "Carpets", styles: ["carpet-red", "carpet-blue"] }),
]);

function floorStyle(label, fallback, filename) {
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    src: `modules/${MODULE_ID}/images/scene-floors/${filename}`,
  });
}

let activeTool = null;
let selectedStyle = DEFAULT_STYLE;
let draftPoints = [];
let selectedEdge = null;
let dragState = null;
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

function toolDefinition(name, title, icon) {
  return {
    name,
    order: name === "fill" ? 0 : name === "draw" ? 1 : 2,
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
    toolDefinition("erase", "EraseFloor", "fa-solid fa-eraser"),
    {
      name: "base",
      order: 3,
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
  activeTool = ["fill", "draw", "erase"].includes(name) ? name : "fill";
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
  dragState = null;
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
    preview.src = style.src;
    preview.alt = "";
    const label = document.createElement("span");
    label.textContent = t(style.labelKey, style.fallback);
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
      choice.title = t(style.labelKey, style.fallback);
      const preview = document.createElement("img");
      preview.src = style.src;
      preview.alt = "";
      const label = document.createElement("span");
      label.textContent = t(style.labelKey, style.fallback);
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
      .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
    if (existing) {
      existing.style = selectedStyle;
      if (existing.source === "walls") {
        existing.points = polygon;
        existing.lines = [];
      }
      await setSceneData(data);
      return;
    }
  }
  const duplicate = data.floors.find((floor) => polygonsEquivalent(floor.points, polygon));
  if (duplicate) {
    duplicate.style = selectedStyle;
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
  const existing = data.floors.find((floor) => floor.source === "base");
  const base = existing
    ? { ...existing, style: selectedStyle, points, lines: [] }
    : storedFloor("base", points);
  data.floors = [base, ...data.floors.filter((floor) => floor.source !== "base")];
  await setSceneData(data);
  ui.notifications.info(localize("BaseFloorCreated", "The base floor covers the whole scene."));
}

async function removeFloorAt(point) {
  const data = getSceneData();
  const matches = data.floors
    .map((floor, index) => ({ floor, index, area: Math.abs(polygonArea(floor.points)) }))
    .filter(({ floor }) => pointInPolygon(point, floor.points))
    .sort((a, b) => a.area - b.area);
  if (!matches.length) return ui.notifications.warn(localize("NoFloor", "No floor was found here."));
  data.floors.splice(matches[0].index, 1);
  await setSceneData(data);
}

async function replaceFloorStyleAt(point) {
  const data = getSceneData();
  const existing = data.floors
    .filter((floor) => floor.source !== "base" && pointInPolygon(point, floor.points))
    .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (!existing) return false;
  existing.style = selectedStyle;
  await setSceneData(data);
  return true;
}

function bindStageEvents() {
  const stage = canvas?.stage;
  if (!stage || stageBound === stage) return;
  if (stageBound) {
    stageBound.off("pointerdown", onPointerDown);
    stageBound.off("pointermove", onPointerMove);
    stageBound.off("pointerup", onPointerUp);
    stageBound.off("pointerupoutside", onPointerUp);
  }
  stageBound = stage;
  stage.eventMode = "static";
  stage.on("pointerdown", onPointerDown);
  stage.on("pointermove", onPointerMove);
  stage.on("pointerup", onPointerUp);
  stage.on("pointerupoutside", onPointerUp);
}

function eventPoint(event) {
  const global = event?.global ?? event?.data?.global;
  if (!global || !canvas?.stage?.worldTransform) return null;
  const local = canvas.stage.worldTransform.applyInverse(global);
  return { x: Number(local.x), y: Number(local.y) };
}

function snapPoint(point) {
  const snapped = canvas?.grid?.getSnappedPoint?.(point, { mode: CONST.GRID_SNAPPING_MODES?.VERTEX ?? 0 });
  return snapped && Number.isFinite(snapped.x) ? { x: snapped.x, y: snapped.y } : point;
}

async function onPointerDown(event) {
  if (!activeTool || currentControlName() !== CONTROL_NAME || event.button !== 0) return;
  const rawPoint = eventPoint(event);
  if (!rawPoint) return;
  event.stopPropagation?.();

  if (activeTool === "erase") return removeFloorAt(rawPoint);
  if (activeTool === "fill") {
    if (await replaceFloorStyleAt(rawPoint)) return;
    const polygon = findWallFace(rawPoint);
    if (!polygon) return ui.notifications.warn(localize("OpenRoom", "No closed room was found here."));
    return addFloor("walls", polygon, { replaceAt: rawPoint });
  }

  const hit = findManualEdge(rawPoint);
  if (hit && draftPoints.length === 0) {
    selectedEdge = hit;
    dragState = { start: rawPoint, original: getSceneData() };
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
  const point = eventPoint(event);
  if (!point) return;
  if (dragState && selectedEdge) {
    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;
    const data = foundry.utils.deepClone(dragState.original);
    const floor = data.floors.find((candidate) => candidate.id === selectedEdge.floorId);
    if (floor) {
      const count = floor.points.length;
      const index = selectedEdge.edgeIndex;
      floor.points[index] = { x: floor.points[index].x + dx, y: floor.points[index].y + dy };
      const next = (index + 1) % count;
      floor.points[next] = { x: floor.points[next].x + dx, y: floor.points[next].y + dy };
      syncFloorLines(floor);
      drawEditorData(data, point);
    }
    return;
  }
  redrawEditor(point);
}

async function onPointerUp() {
  if (!dragState || !selectedEdge) return;
  const container = getEditorContainer(false);
  const pending = container?._previewData;
  dragState = null;
  if (pending) await setSceneData(pending);
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

function syncFloorLines(floor) {
  floor.lines = floor.points.map((point, index) => ({
    id: floor.lines?.[index]?.id ?? randomId(),
    a: point,
    b: floor.points[(index + 1) % floor.points.length],
  }));
}

function findManualEdge(point) {
  const threshold = Math.max(8, Number(canvas?.dimensions?.size ?? 100) * 0.08);
  let best = null;
  for (const floor of getSceneData().floors) {
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
    dragState = null;
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
    container.zIndex = 0;
    parent.addChild(container);
  }
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
  for (const child of container.removeChildren()) child.destroy?.({ children: true });
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

function redrawFloors() {
  const container = getFloorContainer();
  clearContainer(container);
  if (!canvas?.ready || !game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  for (const floor of getSceneData().floors) {
    const points = normalizePolygon(floor.points);
    if (points.length < 3) continue;
    const style = FLOOR_STYLES[floor.style] ?? FLOOR_STYLES[DEFAULT_STYLE];
    const bounds = polygonBounds(points);
    const texture = PIXI.Texture.from(style.src);
    let sprite;
    try { sprite = new PIXI.TilingSprite({ texture, width: bounds.width, height: bounds.height }); }
    catch { sprite = new PIXI.TilingSprite(texture, bounds.width, bounds.height); }
    sprite.position.set(bounds.x, bounds.y);
    const mask = newGraphics();
    drawPolygon(mask, points, 0xffffff);
    sprite.mask = mask;
    container.addChild(sprite, mask);
  }
}

function redrawEditor(cursor = null) {
  drawEditorData(getSceneData(), cursor);
}

function drawEditorData(data, cursor = null) {
  const container = getEditorContainer();
  clearContainer(container);
  container._previewData = data;
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  const graphics = newGraphics();
  for (const floor of data.floors) {
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

Hooks.on("canvasReady", () => { bindStageEvents(); scheduleRedraw(); });
Hooks.on("canvasTearDown", () => {
  clearContainer(getFloorContainer(false));
  clearContainer(getEditorContainer(false));
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
function polygonsEquivalent(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  const keys = (points) => points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  const left = keys(a); const right = keys(b); const doubled = `${right.join("|")}|${right.join("|")}`;
  const reversed = [...right].reverse(); const doubledReverse = `${reversed.join("|")}|${reversed.join("|")}`;
  return doubled.includes(left.join("|")) || doubledReverse.includes(left.join("|"));
}
