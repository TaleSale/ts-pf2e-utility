import { MODULE_ID, i18nKey, t } from "../core.js";

const SETTING_ENABLE = "enableWallTextures";
const I18N_ROOT = "Settings.WallTextures";
const FLAG_ROOT = "wallTexture";
const DEFAULT_STYLE = "grey-brick";
const WALL_TEXTURE_CONTAINER = "tsu-wall-textures";
const TEXTURE_ASSET_BASE = `modules/${MODULE_ID}/images/scene-walls`;
const SOURCE_TEXTURE_SIZE = 200;
const SOURCE_WALL_WIDTH = 60;
const WALL_WIDTH_GRID_RATIO = 0.2;
const ENDPOINT_MASK_REACH_RATIO = 3;
const SEGMENT_OVERLAY_TRIM_RATIO = 1;
const SHORT_SEGMENT_OVERLAY_ONLY_GRID_RATIO = 1.25;
const RIBBON_MITER_LIMIT_RATIO = 2.5;
const WALL_RIBBON_V_TOP = 70 / SOURCE_TEXTURE_SIZE;
const WALL_RIBBON_V_BOTTOM = 130 / SOURCE_TEXTURE_SIZE;
const SEGMENT_SOURCE_FRAMES = Object.freeze({
  straight: Object.freeze({ x: 0, y: 70, width: 100, height: 60 }),
  straightLong: Object.freeze({ x: 0, y: 70, width: 200, height: 60 }),
});
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
    labelKey: `${I18N_ROOT}.Choices.GreyBrick`,
    fallback: "Grey brick",
    assets: Object.freeze({
      straight: `${TEXTURE_ASSET_BASE}/grey-brick.webp`,
      straightLong: `${TEXTURE_ASSET_BASE}/grey-brick.webp`,
      diag: `${TEXTURE_ASSET_BASE}/grey-brick.webp`,
      corner: `${TEXTURE_ASSET_BASE}/grey-brick.webp`,
      joint: `${TEXTURE_ASSET_BASE}/grey-brick.webp`,
    }),
  },
});

let redrawTimeout = null;
const propagatingWalls = new Set();

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey(`${I18N_ROOT}.Name`),
    hint: i18nKey(`${I18N_ROOT}.Hint`),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => scheduleWallTextureRedraw(),
  });
});

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function getFlagData(wall) {
  return wall?.getFlag?.(MODULE_ID, FLAG_ROOT) ?? wall?.flags?.[MODULE_ID]?.[FLAG_ROOT] ?? {};
}

function isEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isNormalWall(wall) {
  const noDoor = globalThis.CONST?.WALL_DOOR_TYPES?.NONE ?? 0;
  return Number(wall?.door ?? noDoor) === noDoor;
}

function getStyleDefinition(style) {
  return WALL_TEXTURE_STYLES[style] ?? WALL_TEXTURE_STYLES[DEFAULT_STYLE];
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
  const selectedStyle = typeof flags.style === "string" && flags.style ? flags.style : DEFAULT_STYLE;

  const fieldset = document.createElement("fieldset");
  fieldset.className = "tsu-wall-texture-config";

  const legend = document.createElement("legend");
  legend.textContent = t(`${I18N_ROOT}.Fieldset`, "Wall texture");

  const enabledGroup = document.createElement("div");
  enabledGroup.className = "form-group";

  const enabledLabel = document.createElement("label");
  enabledLabel.textContent = t(`${I18N_ROOT}.EnableLabel`, "Wall texture");

  const enabledFields = document.createElement("div");
  enabledFields.className = "form-fields";

  const enabledInput = document.createElement("input");
  enabledInput.type = "checkbox";
  enabledInput.name = `flags.${MODULE_ID}.${FLAG_ROOT}.enabled`;
  enabledInput.checked = enabled;

  enabledFields.append(enabledInput);
  enabledGroup.append(enabledLabel, enabledFields);

  const styleGroup = document.createElement("div");
  styleGroup.className = "form-group tsu-wall-texture-style";

  const styleLabel = document.createElement("label");
  styleLabel.textContent = t(`${I18N_ROOT}.StyleLabel`, "Wall style");

  const styleFields = document.createElement("div");
  styleFields.className = "form-fields";

  const styleSelect = document.createElement("select");
  styleSelect.name = `flags.${MODULE_ID}.${FLAG_ROOT}.style`;

  for (const [value, definition] of Object.entries(WALL_TEXTURE_STYLES)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t(definition.labelKey, definition.fallback);
    option.selected = value === selectedStyle;
    styleSelect.append(option);
  }

  styleFields.append(styleSelect);
  styleGroup.append(styleLabel, styleFields);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t(`${I18N_ROOT}.FieldHint`, "Draws the selected texture along this wall segment.");

  const updateStyleVisibility = () => {
    styleGroup.hidden = !enabledInput.checked;
  };
  enabledInput.addEventListener("change", updateStyleVisibility);
  updateStyleVisibility();

  fieldset.append(legend, enabledGroup, styleGroup, hint);
  return fieldset;
}

Hooks.on("renderWallConfig", (app, element) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  if (!isNormalWall(app.document)) return;

  const root = getElement(element);
  if (!root || root.querySelector(".tsu-wall-texture-config")) return;

  const fieldset = createWallTextureFieldset(app.document);
  const doorFieldset = root.querySelector('[name="door"]')?.closest("fieldset");
  if (doorFieldset instanceof HTMLElement) {
    doorFieldset.after(fieldset);
  } else {
    root.querySelector("form")?.append(fieldset);
  }

  app.setPosition?.({ height: "auto" });
});

function findConnectedWallTextureFlags(coords) {
  const walls = canvas?.scene?.walls ?? [];
  for (const wall of walls) {
    if (!isNormalWall(wall)) continue;
    const flags = getFlagData(wall);
    if (!isEnabled(flags.enabled)) continue;

    const wallCoords = getWallCoords(wall);
    if (!wallCoords) continue;

    const connects =
      pointsMatch(coords.x1, coords.y1, wallCoords.x1, wallCoords.y1)
      || pointsMatch(coords.x1, coords.y1, wallCoords.x2, wallCoords.y2)
      || pointsMatch(coords.x2, coords.y2, wallCoords.x1, wallCoords.y1)
      || pointsMatch(coords.x2, coords.y2, wallCoords.x2, wallCoords.y2);

    if (connects) return foundry.utils.deepClone(flags);
  }

  return null;
}

function getConnectedNormalWalls(sourceWall) {
  const sourceCoords = getWallCoords(sourceWall);
  if (!sourceCoords) return [];

  const walls = canvas?.scene?.walls ?? [];
  const connected = [];
  for (const wall of walls) {
    if (wall.id === sourceWall.id || !isNormalWall(wall)) continue;

    const coords = getWallCoords(wall);
    if (!coords) continue;

    const connects =
      pointsMatch(sourceCoords.x1, sourceCoords.y1, coords.x1, coords.y1)
      || pointsMatch(sourceCoords.x1, sourceCoords.y1, coords.x2, coords.y2)
      || pointsMatch(sourceCoords.x2, sourceCoords.y2, coords.x1, coords.y1)
      || pointsMatch(sourceCoords.x2, sourceCoords.y2, coords.x2, coords.y2);

    if (connects) connected.push(wall);
  }
  return connected;
}

function hasTextureFlags(wall) {
  const flags = getFlagData(wall);
  return Object.keys(flags).length > 0;
}

async function copyTextureToConnectedWalls(sourceWall) {
  if (propagatingWalls.has(sourceWall.id)) return;

  const flags = getFlagData(sourceWall);
  if (!hasTextureFlags(sourceWall)) return;
  const serializedFlags = JSON.stringify(flags);

  const updates = [];
  for (const wall of getConnectedNormalWalls(sourceWall)) {
    if (JSON.stringify(getFlagData(wall)) === serializedFlags) continue;
    updates.push({
      _id: wall.id,
      flags: {
        [MODULE_ID]: {
          [FLAG_ROOT]: foundry.utils.deepClone(flags),
        },
      },
    });
  }

  if (!updates.length) return;

  propagatingWalls.add(sourceWall.id);
  try {
    await canvas.scene.updateEmbeddedDocuments("Wall", updates);
  } finally {
    propagatingWalls.delete(sourceWall.id);
  }
}

Hooks.on("preCreateWall", (wall, data) => {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE)) return;
  if (!isNormalWall(data)) return;

  const existingFlags = foundry.utils.getProperty(data, `flags.${MODULE_ID}.${FLAG_ROOT}`)
    ?? wall.getFlag?.(MODULE_ID, FLAG_ROOT);
  if (existingFlags) return;

  const coords = getWallCoords(data);
  if (!coords) return;

  const connectedFlags = findConnectedWallTextureFlags(coords);
  if (!connectedFlags) return;

  wall.updateSource({
    flags: {
      [MODULE_ID]: {
        [FLAG_ROOT]: connectedFlags,
      },
    },
  });
});

function getTextureContainer() {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return null;

  let container = parent.children?.find((child) => child?.name === WALL_TEXTURE_CONTAINER);
  if (!container) {
    container = new PIXI.Container();
    container.name = WALL_TEXTURE_CONTAINER;
    container.eventMode = "none";
    container.interactive = false;
    parent.addChild(container);
  }
  return container;
}

function clearWallTextureContainer() {
  const parent = canvas?.primary ?? canvas?.stage;
  const container = parent?.children?.find((child) => child?.name === WALL_TEXTURE_CONTAINER);
  if (container) container.destroy({ children: true });
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
  if (!isNormalWall(wall)) return null;

  const flags = getFlagData(wall);
  if (!isEnabled(flags.enabled)) return null;

  const style = getStyleDefinition(flags.style);
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

  return sprite;
}

function getTexturedWalls() {
  return (canvas.walls?.placeables ?? [])
    .map((placeable) => placeable.document)
    .filter((wall) => {
      const flags = getFlagData(wall);
      return isNormalWall(wall) && isEnabled(flags.enabled) && getWallCoords(wall);
    });
}

function buildWallEndpointMap(walls) {
  const endpoints = new Map();
  for (const wall of walls) {
    const coords = getWallCoords(wall);
    if (!coords) continue;
    const points = [
      { x: coords.x1, y: coords.y1, otherX: coords.x2, otherY: coords.y2 },
      { x: coords.x2, y: coords.y2, otherX: coords.x1, otherY: coords.y1 },
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
  if (endpointKey === startKey) return { key: endKey, point: points.end };
  if (endpointKey === endKey) return { key: startKey, point: points.start };
  return null;
}

function getNextChainWall(endpointMap, endpointKey, visitedWalls) {
  const entries = endpointMap.get(endpointKey) ?? [];
  return entries.find((entry) => !visitedWalls.has(entry.wall.id))?.wall ?? null;
}

function getWallTextureStyleKey(wall) {
  const flags = getFlagData(wall);
  return typeof flags.style === "string" && flags.style ? flags.style : DEFAULT_STYLE;
}

function buildWallTextureChains(walls, endpointMap) {
  const chains = [];
  const visitedWalls = new Set();

  for (const wall of walls) {
    if (visitedWalls.has(wall.id)) continue;

    const points = getWallEndpointPoints(wall);
    if (!points) continue;

    const styleKey = getWallTextureStyleKey(wall);
    const chainPoints = [points.start, points.end];
    visitedWalls.add(wall.id);

    const extend = (atStart) => {
      while (true) {
        const currentPoint = atStart ? chainPoints[0] : chainPoints[chainPoints.length - 1];
        const currentKey = pointKey(currentPoint.x, currentPoint.y);
        const nextWall = getNextChainWall(endpointMap, currentKey, visitedWalls);
        if (!nextWall || getWallTextureStyleKey(nextWall) !== styleKey) return;

        const other = getOtherEndpoint(nextWall, currentKey);
        if (!other) return;

        visitedWalls.add(nextWall.id);
        if (atStart) chainPoints.unshift(other.point);
        else chainPoints.push(other.point);
      }
    };

    extend(true);
    extend(false);
    chains.push({ styleKey, points: chainPoints });
  }

  return chains;
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0) return null;
  return { x: x / length, y: y / length, length };
}

function createWallRibbonMesh(style, points) {
  const cleanPoints = points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0;
  });
  if (cleanPoints.length < 2) return null;

  const texture = PIXI.Texture.from(style.assets.straightLong);
  setNearestScaleMode(texture);
  setRepeatWrapMode(texture);

  const halfWidth = getTargetWallWidth() / 2;
  const period = SOURCE_TEXTURE_SIZE * getTextureScale();
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
    const previousDirection = segmentDirections[Math.max(0, index - 1)];
    const nextDirection = segmentDirections[Math.min(segmentDirections.length - 1, index)];
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
    const u = cumulativeLengths[index] / period;

    positions.push(point.x + offsetX, point.y + offsetY, point.x - offsetX, point.y - offsetY);
    uvs.push(u, WALL_RIBBON_V_TOP, u, WALL_RIBBON_V_BOTTOM);

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
  return getStyleDefinition(flags.style);
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
  if (!canvas?.ready || !game.settings.get(MODULE_ID, SETTING_ENABLE)) {
    clearWallTextureContainer();
    return;
  }

  const container = getTextureContainer();
  if (!container) return;

  container.removeChildren().forEach((child) => child.destroy());
  const texturedWalls = getTexturedWalls();
  const endpointMap = buildWallEndpointMap(texturedWalls);
  const chains = buildWallTextureChains(texturedWalls, endpointMap);

  for (const chain of chains) {
    const style = getStyleDefinition(chain.styleKey);
    const mesh = createWallRibbonMesh(style, chain.points);
    if (mesh) container.addChild(mesh);
  }
}

function scheduleWallTextureRedraw() {
  if (redrawTimeout) window.clearTimeout(redrawTimeout);
  redrawTimeout = window.setTimeout(redrawWallTextures, 50);
}

Hooks.on("canvasReady", scheduleWallTextureRedraw);
Hooks.on("canvasTearDown", clearWallTextureContainer);
Hooks.on("createWall", scheduleWallTextureRedraw);
Hooks.on("updateWall", (wall, change) => {
  if (foundry.utils.hasProperty(change, `flags.${MODULE_ID}.${FLAG_ROOT}`)) {
    void copyTextureToConnectedWalls(wall);
  }
  scheduleWallTextureRedraw();
});
Hooks.on("deleteWall", scheduleWallTextureRedraw);
Hooks.on("updateScene", (_scene, change) => {
  if (change.walls || change.grid || change.dimensions) scheduleWallTextureRedraw();
});
