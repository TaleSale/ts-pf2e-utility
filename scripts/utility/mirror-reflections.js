import { MODULE_ID } from "../core.js";
import { TEXTURE_PRESET_CHANGE_HOOK } from "./texture-presets.js?v=20260829-warehouse-balance-v42";

const ASSET_FLAG = "sceneAsset";
const CONTAINER_NAME = "tsu-mirror-reflections";
const STATIC_REBUILD_DELAY = 80;
const MAX_RENDER_EDGE = 512;
const MIN_RENDER_EDGE = 16;

const entries = new Map();
let rebuildTimer = null;
let dynamicScanQueued = false;
let tickerActive = false;

function makeSprite(texture) {
  try { return new PIXI.Sprite(texture); }
  catch { return new PIXI.Sprite({ texture }); }
}

function tileCenter(document) {
  const center = document?.object?.center ?? document?.shape?.center;
  return {
    x: Number(center?.x ?? document?.x ?? 0),
    y: Number(center?.y ?? document?.y ?? 0),
  };
}

function mirrorFlag(document) {
  return document?.flags?.[MODULE_ID]?.[ASSET_FLAG]?.mirror ?? null;
}

function isOnCurrentLevel(document) {
  if (!document || document.hidden) return false;
  return document.includedInLevel?.(canvas?.level) !== false;
}

function getMirrorDocuments() {
  return Array.from(canvas?.scene?.tiles ?? []).filter((document) => mirrorFlag(document) && isOnCurrentLevel(document));
}

function localPoint(entry, point) {
  const dx = Number(point.x) - entry.center.x;
  const dy = Number(point.y) - entry.center.y;
  return {
    x: dx * entry.cos + dy * entry.sin,
    y: -dx * entry.sin + dy * entry.cos,
  };
}

function worldPoint(entry, point) {
  return {
    x: entry.center.x + point.x * entry.cos - point.y * entry.sin,
    y: entry.center.y + point.x * entry.sin + point.y * entry.cos,
  };
}

function mirrorGeometry(document) {
  const config = mirrorFlag(document);
  const width = Math.max(1, Math.abs(Number(document.width ?? 1)));
  const height = Math.max(1, Math.abs(Number(document.height ?? 1)));
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? canvas?.scene?.grid?.size ?? 100));
  const angle = Number(document.rotation ?? 0) * Math.PI / 180;
  const glass = config?.glass ?? {};
  const normalized = {
    x: Math.max(0, Math.min(1, Number(glass.x ?? 0.17))),
    y: Math.max(0, Math.min(1, Number(glass.y ?? 0.42))),
    width: Math.max(0.02, Math.min(1, Number(glass.width ?? 0.66))),
    height: Math.max(0.02, Math.min(1, Number(glass.height ?? 0.30))),
  };
  const glassRect = {
    x: (normalized.x - 0.5) * width,
    y: (normalized.y - 0.5) * height,
    width: Math.min(width, normalized.width * width),
    height: Math.min(height, normalized.height * height),
  };
  const depth = Math.max(0.1, Number(config?.depth ?? 1)) * grid;
  return {
    id: document.id,
    document,
    config,
    center: tileCenter(document),
    width,
    height,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    glassRect,
    glassShape: glass.shape === "ellipse" ? "ellipse" : "rect",
    sourceWidth: width,
    sourceStart: height / 2,
    sourceEnd: height / 2 + depth,
    sourceDepth: depth,
  };
}

function sourceBounds(entry) {
  const half = entry.sourceWidth / 2;
  const corners = [
    worldPoint(entry, { x: -half, y: entry.sourceStart }),
    worldPoint(entry, { x: half, y: entry.sourceStart }),
    worldPoint(entry, { x: half, y: entry.sourceEnd }),
    worldPoint(entry, { x: -half, y: entry.sourceEnd }),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function boundsOverlap(a, b) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x
    && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function clonePrimaryMesh(mesh) {
  if (!mesh?.texture || mesh.destroyed || mesh.visible === false || mesh.renderable === false) return null;
  const sprite = makeSprite(mesh.texture);
  const anchor = mesh.anchor ?? { x: 0.5, y: 0.5 };
  sprite.anchor.set(Number(anchor.x ?? 0.5), Number(anchor.y ?? 0.5));
  sprite.position.set(Number(mesh.position?.x ?? mesh.x ?? 0), Number(mesh.position?.y ?? mesh.y ?? 0));
  sprite.rotation = Number(mesh.rotation ?? 0);
  sprite.width = Math.max(1, Math.abs(Number(mesh.width ?? mesh.texture.width ?? 1)));
  sprite.height = Math.max(1, Math.abs(Number(mesh.height ?? mesh.texture.height ?? 1)));
  if (Number(mesh.scale?.x ?? 1) < 0) sprite.scale.x *= -1;
  if (Number(mesh.scale?.y ?? 1) < 0) sprite.scale.y *= -1;
  sprite.alpha = Number(mesh.alpha ?? 1);
  sprite.tint = Number(mesh.tint ?? 0xffffff);
  sprite.blendMode = mesh.blendMode;
  return sprite;
}

function staticSourceContainer(entry) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  const primary = canvas?.primary;
  for (const mesh of [primary?.background, ...(primary?.levelTextures ?? [])]) {
    const sprite = clonePrimaryMesh(mesh);
    if (sprite) container.addChild(sprite);
  }

  const zone = sourceBounds(entry);
  for (const tile of canvas?.tiles?.placeables ?? []) {
    const document = tile.document;
    if (!document || document.id === entry.id || mirrorFlag(document) || !isOnCurrentLevel(document) || tile.visible === false) continue;
    const bounds = tile.bounds ?? {
      x: Number(document.x) - Number(document.width) / 2,
      y: Number(document.y) - Number(document.height) / 2,
      width: Number(document.width),
      height: Number(document.height),
    };
    if (!boundsOverlap(zone, bounds)) continue;
    const sprite = clonePrimaryMesh(tile.mesh);
    if (sprite) container.addChild(sprite);
  }
  return container;
}

function renderStaticTexture(entry) {
  const renderer = canvas?.app?.renderer;
  if (!renderer) return null;
  const glass = entry.glassRect;
  const scale = Math.min(1, MAX_RENDER_EDGE / Math.max(glass.width, glass.height));
  const width = Math.max(MIN_RENDER_EDGE, Math.round(glass.width * scale));
  const height = Math.max(MIN_RENDER_EDGE, Math.round(glass.height * scale));
  const texture = PIXI.RenderTexture.create({ width, height, resolution: 1 });
  const sx = width / entry.sourceWidth;
  const sy = height / entry.sourceDepth;
  const transform = new PIXI.Matrix(
    entry.cos * sx,
    entry.sin * sy,
    entry.sin * sx,
    -entry.cos * sy,
    (-entry.cos * entry.center.x - entry.sin * entry.center.y + entry.sourceWidth / 2) * sx,
    (entry.sourceEnd - entry.sin * entry.center.x + entry.cos * entry.center.y) * sy,
  );
  const source = staticSourceContainer(entry);
  try {
    renderer.render(source, { renderTexture: texture, clear: true, transform });
  } catch (error) {
    console.warn(`${MODULE_ID} | Unable to build mirror static reflection`, error);
    texture.destroy(true);
    source.destroy({ children: true });
    return null;
  }
  source.destroy({ children: true });
  return texture;
}

function drawRectangle(graphics, rectangle, color, alpha = 1) {
  if (typeof graphics.rect === "function" && typeof graphics.fill === "function") {
    graphics.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height).fill({ color, alpha });
  } else {
    graphics.beginFill(color, alpha).drawRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height).endFill();
  }
}

function drawGlassShape(graphics, rectangle, shape, color, alpha = 1) {
  if (shape !== "ellipse") return drawRectangle(graphics, rectangle, color, alpha);
  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  if (typeof graphics.ellipse === "function" && typeof graphics.fill === "function") {
    graphics.ellipse(centerX, centerY, rectangle.width / 2, rectangle.height / 2).fill({ color, alpha });
  } else {
    graphics.beginFill(color, alpha)
      .drawEllipse(centerX, centerY, rectangle.width / 2, rectangle.height / 2)
      .endFill();
  }
}

function reflectionFilters() {
  const filters = [];
  const ColorMatrixFilter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
  if (ColorMatrixFilter) {
    const color = new ColorMatrixFilter();
    color.brightness(0.72, false);
    color.saturate(-0.42, true);
    filters.push(color);
  }
  const BlurFilter = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
  if (BlurFilter) filters.push(new BlurFilter(0.45, 2));
  return filters;
}

function createEntry(document) {
  const entry = mirrorGeometry(document);
  const root = new PIXI.Container();
  root.name = `${CONTAINER_NAME}-${document.id}`;
  root.eventMode = "none";
  root.interactive = false;
  root.position.set(entry.center.x, entry.center.y);
  root.rotation = entry.angle;
  root.elevation = Number(document.elevation ?? 0);
  root.sortLayer = Number(canvas?.primary?.constructor?.SORT_LAYERS?.TILES ?? 500);
  root.sort = Math.max(-1000, Number(document.sort ?? 1) - 1);

  const content = new PIXI.Container();
  content.eventMode = "none";
  content.filters = reflectionFilters();
  root.addChild(content);

  const staticTexture = renderStaticTexture(entry);
  if (staticTexture) {
    const sprite = makeSprite(staticTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(entry.glassRect.x + entry.glassRect.width / 2, entry.glassRect.y + entry.glassRect.height / 2);
    sprite.width = entry.glassRect.width;
    sprite.height = entry.glassRect.height;
    content.addChild(sprite);
    entry.staticTexture = staticTexture;
  }

  const dynamic = new PIXI.Container();
  dynamic.eventMode = "none";
  content.addChild(dynamic);

  const mask = new PIXI.Graphics();
  drawGlassShape(mask, entry.glassRect, entry.glassShape, 0xffffff, 1);
  root.addChild(mask);
  content.mask = mask;

  const glassTint = new PIXI.Graphics();
  drawGlassShape(glassTint, entry.glassRect, entry.glassShape, 0x8aa1ad, 0.12);
  root.addChild(glassTint);

  entry.root = root;
  entry.content = content;
  entry.dynamic = dynamic;
  entry.tokenSprites = new Map();
  return entry;
}

function destroyEntry(entry, { destroyRoot = true } = {}) {
  for (const reflection of entry.tokenSprites.values()) reflection.holder.destroy({ children: true });
  entry.tokenSprites.clear();
  entry.staticTexture?.destroy?.(true);
  if (destroyRoot) entry.root?.destroy?.({ children: true });
}

function clearReflections({ destroyRoots = true } = {}) {
  stopTicker();
  for (const entry of entries.values()) destroyEntry(entry, { destroyRoot: destroyRoots });
  entries.clear();
}

function rebuildReflections() {
  rebuildTimer = null;
  if (!canvas?.ready || !canvas?.primary) return clearReflections();
  clearReflections();
  const primary = canvas.primary;
  primary.sortableChildren = true;
  for (const document of getMirrorDocuments()) {
    const entry = createEntry(document);
    entries.set(document.id, entry);
    primary.addChild(entry.root);
  }
  primary.sortDirty = true;
  scanDynamicTokens();
}

function scheduleStaticRebuild() {
  if (rebuildTimer) window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(rebuildReflections, STATIC_REBUILD_DELAY);
}

function tokenCenter(token) {
  const mesh = token?.mesh;
  if (Number.isFinite(mesh?.position?.x) && Number.isFinite(mesh?.position?.y)) {
    return { x: Number(mesh.position.x), y: Number(mesh.position.y) };
  }
  const center = token?.center;
  return { x: Number(center?.x ?? 0), y: Number(center?.y ?? 0) };
}

function tokenIsVisible(token) {
  return Boolean(token?.document && !token.document.hidden && token.visible !== false
    && token.mesh?.visible !== false && isOnCurrentLevel(token.document));
}

function tokenInSource(entry, token) {
  if (!tokenIsVisible(token)) return false;
  const local = localPoint(entry, tokenCenter(token));
  return Math.abs(local.x) <= entry.sourceWidth / 2
    && local.y >= entry.sourceStart
    && local.y <= entry.sourceEnd;
}

function createTokenReflection(entry, token) {
  const texture = token.mesh?.texture;
  if (!texture) return null;
  const holder = new PIXI.Container();
  holder.eventMode = "none";
  const sprite = makeSprite(texture);
  const anchor = token.mesh?.anchor ?? { x: 0.5, y: 0.5 };
  sprite.anchor.set(Number(anchor.x ?? 0.5), Number(anchor.y ?? 0.5));
  holder.addChild(sprite);
  entry.dynamic.addChild(holder);
  const reflection = { holder, sprite, token };
  entry.tokenSprites.set(token.id, reflection);
  return reflection;
}

function removeTokenReflection(entry, tokenId) {
  const reflection = entry.tokenSprites.get(tokenId);
  if (!reflection) return;
  entry.tokenSprites.delete(tokenId);
  reflection.holder.destroy({ children: true });
}

function syncTokenReflection(entry, token) {
  if (!tokenInSource(entry, token)) {
    removeTokenReflection(entry, token.id);
    return false;
  }
  const reflection = entry.tokenSprites.get(token.id) ?? createTokenReflection(entry, token);
  if (!reflection) return false;
  const texture = token.mesh?.texture;
  if (texture && reflection.sprite.texture !== texture) reflection.sprite.texture = texture;
  const local = localPoint(entry, tokenCenter(token));
  const xRatio = (local.x + entry.sourceWidth / 2) / entry.sourceWidth;
  const yRatio = (entry.sourceEnd - local.y) / entry.sourceDepth;
  reflection.holder.position.set(
    entry.glassRect.x + xRatio * entry.glassRect.width,
    entry.glassRect.y + yRatio * entry.glassRect.height,
  );
  reflection.holder.rotation = Number(token.document.rotation ?? 0) * Math.PI / 180 - entry.angle;
  const tokenWidth = Math.max(1, Number(token.w ?? token.document.width * canvas.dimensions.size ?? 1));
  const tokenHeight = Math.max(1, Number(token.h ?? token.document.height * canvas.dimensions.size ?? 1));
  reflection.sprite.width = tokenWidth * entry.glassRect.width / entry.sourceWidth;
  reflection.sprite.height = tokenHeight * entry.glassRect.height / entry.sourceDepth;
  const scaleX = Number(token.document.texture?.scaleX ?? 1);
  const scaleY = Number(token.document.texture?.scaleY ?? 1);
  reflection.sprite.scale.x = Math.abs(reflection.sprite.scale.x) * (scaleX < 0 ? -1 : 1);
  reflection.sprite.scale.y = -Math.abs(reflection.sprite.scale.y) * (scaleY < 0 ? -1 : 1);
  reflection.sprite.alpha = Math.min(0.78, Number(token.mesh?.alpha ?? 1));
  reflection.sprite.tint = Number(token.mesh?.tint ?? 0xffffff);
  return true;
}

function hasActiveTokenReflections() {
  for (const entry of entries.values()) if (entry.tokenSprites.size) return true;
  return false;
}

function updateActiveReflections() {
  for (const entry of entries.values()) {
    for (const [tokenId, reflection] of Array.from(entry.tokenSprites.entries())) {
      const token = canvas?.tokens?.get?.(tokenId) ?? reflection.token;
      if (!token || !syncTokenReflection(entry, token)) removeTokenReflection(entry, tokenId);
    }
  }
  if (!hasActiveTokenReflections()) stopTicker();
}

function startTicker() {
  if (tickerActive || !canvas?.app?.ticker) return;
  canvas.app.ticker.add(updateActiveReflections);
  tickerActive = true;
}

function stopTicker() {
  if (!tickerActive) return;
  canvas?.app?.ticker?.remove?.(updateActiveReflections);
  tickerActive = false;
}

function scanDynamicTokens() {
  dynamicScanQueued = false;
  if (!canvas?.ready || !entries.size) return stopTicker();
  const tokens = canvas?.tokens?.placeables ?? [];
  const liveIds = new Set(tokens.map((token) => token.id));
  for (const entry of entries.values()) {
    for (const tokenId of Array.from(entry.tokenSprites.keys())) {
      if (!liveIds.has(tokenId)) removeTokenReflection(entry, tokenId);
    }
    for (const token of tokens) syncTokenReflection(entry, token);
  }
  if (hasActiveTokenReflections()) startTicker();
  else stopTicker();
}

function scheduleDynamicScan() {
  if (dynamicScanQueued) return;
  dynamicScanQueued = true;
  queueMicrotask(scanDynamicTokens);
}

Hooks.on("canvasReady", scheduleStaticRebuild);
Hooks.on("canvasTearDown", function tearDownMirrorReflections() {
  if (rebuildTimer) window.clearTimeout(rebuildTimer);
  rebuildTimer = null;
  dynamicScanQueued = false;
  // The PrimaryCanvasGroup owns and destroys its children during teardown.
  // Release our RenderTextures now, but let Foundry destroy the PIXI roots.
  clearReflections({ destroyRoots: false });
});
Hooks.on(TEXTURE_PRESET_CHANGE_HOOK, scheduleStaticRebuild);
Hooks.on("createTile", scheduleStaticRebuild);
Hooks.on("updateTile", scheduleStaticRebuild);
Hooks.on("deleteTile", scheduleStaticRebuild);
Hooks.on("updateScene", scheduleStaticRebuild);
Hooks.on("createToken", scheduleDynamicScan);
Hooks.on("deleteToken", scheduleDynamicScan);
Hooks.on("updateToken", scheduleDynamicScan);
Hooks.on("refreshToken", scheduleDynamicScan);
