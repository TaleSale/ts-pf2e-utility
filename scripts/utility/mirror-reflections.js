import { MODULE_ID } from "../core.js";
import { TEXTURE_PRESET_CHANGE_HOOK } from "./texture-presets.js?v=20260915-prison-topdown-v100";

const ASSET_FLAG = "sceneAsset";
const CONTAINER_NAME = "tsu-mirror-reflections";
const REFLECTED_PRIMARY_CONTAINER_NAMES = new Set(["tsu-wall-textures", "tsu-border-textures"]);
const STATIC_REBUILD_DELAY = 80;
const DOOR_ANIMATION_SNAPSHOT_PADDING = 60;
const MAX_RENDER_EDGE = 512;
const MIN_RENDER_EDGE = 16;
const REFLECTION_PLANE_WIDTH_RATIO = 0.80;
const TOKEN_PERSPECTIVE_ASPECT = 0.16;
const DYNAMIC_SUBJECT_VISIBLE_HEIGHT_RATIO = 0.60;
const NON_REFLECTING_ITEM_SLUGS = new Set(["mirror-risen"]);
const NON_REFLECTING_TRAITS = new Set(["vampire", "вампир"]);

const entries = new Map();
const actorReflectionEligibility = new WeakMap();
let rebuildTimer = null;
let dynamicScanQueued = false;
let tickerActive = false;
let wallCollisionWarningShown = false;

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

function normalizedSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

function actorTraitSlugs(actor) {
  const values = actor?.system?.traits?.value;
  const traits = values instanceof Set ? Array.from(values) : Array.isArray(values) ? values : [];
  return traits.map((trait) => normalizedSlug(trait?.slug ?? trait?.value ?? trait));
}

function actorItemSlugs(actor) {
  const items = actor?.items?.contents ?? actor?.items ?? [];
  return Array.from(items).map((item) => normalizedSlug(item?.slug ?? item?.system?.slug));
}

function tokenCanReflect(token) {
  const actor = token?.actor ?? token?.document?.actor;
  if (!actor) return true;
  if (actorReflectionEligibility.has(actor)) return actorReflectionEligibility.get(actor);
  const canReflect = !actorTraitSlugs(actor).some((trait) => NON_REFLECTING_TRAITS.has(trait))
    && !actorItemSlugs(actor).some((slug) => NON_REFLECTING_ITEM_SLUGS.has(slug))
    && !actor?.rollOptions?.all?.["self:trait:vampire"];
  actorReflectionEligibility.set(actor, canReflect);
  return canReflect;
}

function invalidateActorReflectionEligibility(document) {
  const actor = document?.documentName === "Actor"
    ? document
    : document?.actor ?? document?.parent;
  if (actor) actorReflectionEligibility.delete(actor);
  scheduleDynamicScan();
}

function wallBlocksReflection(entry, token) {
  const backend = CONFIG?.Canvas?.polygonBackends?.sight;
  const level = canvas?.level;
  if (!backend?.testCollision || !level) return false;

  const destinationCenter = tokenCenter(token);
  const local = localPoint(entry, destinationCenter);
  const halfWidth = entry.sourceWidth / 2;
  const origin = worldPoint(entry, {
    x: Math.max(-halfWidth, Math.min(halfWidth, local.x)),
    y: entry.sourceStart + Math.max(2, Number(canvas?.dimensions?.size ?? 100) * 0.02),
  });
  origin.elevation = Number(entry.document?.elevation ?? level.elevation?.base ?? 0);
  const destination = {
    ...destinationCenter,
    elevation: Number(token.document?.elevation ?? origin.elevation),
  };
  const key = [
    Math.round(destination.x / 4),
    Math.round(destination.y / 4),
    destination.elevation,
    Math.round(origin.x),
    Math.round(origin.y),
    origin.elevation,
  ].join(":");
  const cached = entry.wallOcclusion.get(token.id);
  if (cached?.key === key) return cached.blocked;

  let blocked = false;
  try {
    blocked = Boolean(backend.testCollision(origin, destination, {
      type: "sight",
      mode: "any",
      level,
      tMin: 0.001,
      tMax: 0.999,
    }));
  } catch (error) {
    if (!wallCollisionWarningShown) {
      wallCollisionWarningShown = true;
      console.warn(`${MODULE_ID} | Unable to test mirror wall occlusion`, error);
    }
  }
  entry.wallOcclusion.set(token.id, { key, blocked });
  return blocked;
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
  // Keep the readable projection inside the actual opening rather than the
  // transparent bounds of the whole tile. The shallow height produces the
  // strong top-down perspective while the width still carries token identity.
  const reflectionWidth = glassRect.width * REFLECTION_PLANE_WIDTH_RATIO;
  const reflectionRect = {
    x: glassRect.x + (glassRect.width - reflectionWidth) / 2,
    y: glassRect.y,
    width: reflectionWidth,
    height: glassRect.height,
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
    reflectionRect,
    glassShape: glass.shape === "ellipse" ? "ellipse" : "rect",
    sourceWidth: width,
    sourceStart: height / 2,
    sourceEnd: height / 2 + depth,
    sourceDepth: depth,
  };
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

function staticSceneContainer() {
  const container = new PIXI.Container();
  container.eventMode = "none";
  const primary = canvas?.primary;
  for (const mesh of [primary?.background, ...(primary?.levelTextures ?? [])]) {
    const sprite = clonePrimaryMesh(mesh);
    if (sprite) container.addChild(sprite);
  }

  for (const tile of canvas?.tiles?.placeables ?? []) {
    const document = tile.document;
    if (!document || mirrorFlag(document) || !isOnCurrentLevel(document) || tile.visible === false) continue;
    const sprite = clonePrimaryMesh(tile.mesh);
    if (sprite) container.addChild(sprite);
  }
  return container;
}

function staticDoorContainer() {
  const container = new PIXI.Container();
  container.eventMode = "none";
  for (const mesh of canvas?.primary?.children ?? []) {
    if (!String(mesh?.name ?? "").startsWith("Door.")) continue;
    const sprite = clonePrimaryMesh(mesh);
    if (sprite) container.addChild(sprite);
  }
  return container;
}

function copyDisplayTransform(source, target) {
  target.position?.copyFrom?.(source.position);
  target.scale?.copyFrom?.(source.scale);
  target.pivot?.copyFrom?.(source.pivot);
  target.skew?.copyFrom?.(source.skew);
  target.rotation = Number(source.rotation ?? 0);
  target.alpha = Number(source.alpha ?? 1);
  target.visible = source.visible !== false;
  target.renderable = source.renderable !== false;
  if ("tint" in source && "tint" in target) target.tint = Number(source.tint ?? 0xffffff);
  if ("blendMode" in source && "blendMode" in target) target.blendMode = source.blendMode;
  return target;
}

function cloneWallDisplayObject(display) {
  if (!display || display.destroyed || display.visible === false || display.renderable === false) return null;
  const SimpleMesh = PIXI.SimpleMesh;
  if (typeof SimpleMesh === "function" && display instanceof SimpleMesh) {
    try {
      const clone = new SimpleMesh(display.texture, display.vertices, display.uvs, display.indices, display.drawMode);
      return copyDisplayTransform(display, clone);
    } catch (_error) {
      return null;
    }
  }
  if (display.texture) return clonePrimaryMesh(display);
  if (!Array.isArray(display.children)) return null;
  const clone = copyDisplayTransform(display, new PIXI.Container());
  clone.eventMode = "none";
  for (const child of display.children) {
    const childClone = cloneWallDisplayObject(child);
    if (childClone) clone.addChild(childClone);
  }
  return clone;
}

function staticWallContainer() {
  const container = new PIXI.Container();
  container.eventMode = "none";
  for (const layer of canvas?.primary?.children ?? []) {
    if (!REFLECTED_PRIMARY_CONTAINER_NAMES.has(layer?.name)) continue;
    const clone = cloneWallDisplayObject(layer);
    if (clone) container.addChild(clone);
  }
  return container;
}

function renderStaticTexture(entry, staticLayers) {
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
  const { scene, walls, doors } = staticLayers;
  try {
    renderer.render(scene, { renderTexture: texture, clear: true, transform });
    renderer.render(walls, { renderTexture: texture, clear: false, transform });
    renderer.render(doors, { renderTexture: texture, clear: false, transform });
  } catch (error) {
    console.warn(`${MODULE_ID} | Unable to build mirror static reflection`, error);
    texture.destroy(true);
    return null;
  }
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

function reflectionFilters({ token = false } = {}) {
  const filters = [];
  const ColorMatrixFilter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
  if (ColorMatrixFilter) {
    const color = new ColorMatrixFilter();
    color.brightness(token ? 1.04 : 0.82, false);
    color.contrast(token ? 0.22 : 0.04, true);
    color.saturate(token ? -0.04 : -0.30, true);
    filters.push(color);
  }
  const BlurFilter = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
  if (BlurFilter && !token) filters.push(new BlurFilter(0.25, 2));
  return filters;
}

function tokenUsesDynamicRing(token) {
  return Boolean(token?.document?.ring?.enabled && token.document.ring.subject?.texture);
}

function tokenReflectionTexture(token) {
  if (tokenUsesDynamicRing(token)) {
    const source = token.document.ring.subject.texture;
    const subject = globalThis.getTexture?.(source) ?? PIXI.Assets?.cache?.get?.(source);
    if (subject && subject.valid !== false) return subject;
  }
  return token?.mesh?.texture ?? null;
}

function updateDynamicTokenMask(reflection, width, height) {
  const mask = reflection.subjectMask;
  if (!mask) return;
  mask.clear();
  width = Math.max(1, Math.abs(Number(width ?? 1)));
  height = Math.max(1, Math.abs(Number(height ?? 1)));
  const anchor = reflection.sprite.anchor ?? { x: 0.5, y: 0.5 };
  drawGlassShape(mask, {
    x: -width * Number(anchor.x ?? 0.5),
    y: -height * Number(anchor.y ?? 0.5),
    width,
    height,
  }, "ellipse", 0xffffff, 1);
}

function createEntry(document, staticLayers) {
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
  root.addChild(content);

  const staticTexture = renderStaticTexture(entry, staticLayers);
  if (staticTexture) {
    const sprite = makeSprite(staticTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(entry.glassRect.x + entry.glassRect.width / 2, entry.glassRect.y + entry.glassRect.height / 2);
    sprite.width = entry.glassRect.width;
    sprite.height = entry.glassRect.height;
    sprite.filters = reflectionFilters();
    content.addChild(sprite);
    entry.staticTexture = staticTexture;
  }

  const dynamic = new PIXI.Container();
  dynamic.eventMode = "none";
  dynamic.filters = reflectionFilters({ token: true });
  root.addChild(dynamic);

  const mask = new PIXI.Graphics();
  drawGlassShape(mask, entry.glassRect, entry.glassShape, 0xffffff, 1);
  root.addChild(mask);
  content.mask = mask;

  const dynamicMask = new PIXI.Graphics();
  drawGlassShape(dynamicMask, entry.reflectionRect, entry.glassShape, 0xffffff, 1);
  root.addChild(dynamicMask);
  dynamic.mask = dynamicMask;

  const glassTint = new PIXI.Graphics();
  drawGlassShape(glassTint, entry.glassRect, entry.glassShape, 0x8aa1ad, 0.06);
  root.addChild(glassTint);

  entry.root = root;
  entry.content = content;
  entry.dynamic = dynamic;
  entry.tokenSprites = new Map();
  entry.wallOcclusion = new Map();
  return entry;
}

function destroyEntry(entry, { destroyRoot = true } = {}) {
  for (const reflection of entry.tokenSprites.values()) reflection.holder.destroy({ children: true });
  entry.tokenSprites.clear();
  entry.wallOcclusion.clear();
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
  const documents = getMirrorDocuments();
  if (!documents.length) return scanDynamicTokens();
  const staticLayers = {
    scene: staticSceneContainer(),
    walls: staticWallContainer(),
    doors: staticDoorContainer(),
  };
  try {
    for (const document of documents) {
      const entry = createEntry(document, staticLayers);
      entries.set(document.id, entry);
      primary.addChild(entry.root);
    }
  } finally {
    staticLayers.scene.destroy({ children: true });
    staticLayers.walls.destroy({ children: true });
    staticLayers.doors.destroy({ children: true });
  }
  primary.sortDirty = true;
  scanDynamicTokens();
}

function scheduleStaticRebuildAfter(delay) {
  if (rebuildTimer) window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(rebuildReflections, Math.max(0, Number(delay) || 0));
}

function scheduleStaticRebuild() {
  scheduleStaticRebuildAfter(STATIC_REBUILD_DELAY);
}

function invalidateWallOcclusion() {
  for (const entry of entries.values()) entry.wallOcclusion.clear();
  scheduleDynamicScan();
}

function scheduleWallStructureRebuild() {
  invalidateWallOcclusion();
  scheduleStaticRebuild();
}

function scheduleWallUpdateRebuild(wall, changed = {}) {
  invalidateWallOcclusion();
  const animatedDoorStateChanged = "ds" in changed
    && wall?.animation?.type
    && wall.animation.texture;
  if (!animatedDoorStateChanged) return scheduleStaticRebuild();
  const duration = Math.max(0, Number(wall.animation.duration ?? 500));
  scheduleStaticRebuildAfter(duration + DOOR_ANIMATION_SNAPSHOT_PADDING);
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
  if (!tokenIsVisible(token) || !tokenCanReflect(token)) return false;
  const local = localPoint(entry, tokenCenter(token));
  const inside = Math.abs(local.x) <= entry.sourceWidth / 2
    && local.y >= entry.sourceStart
    && local.y <= entry.sourceEnd;
  return inside && !wallBlocksReflection(entry, token);
}

function createTokenReflection(entry, token) {
  const texture = tokenReflectionTexture(token);
  if (!texture) return null;
  const holder = new PIXI.Container();
  holder.eventMode = "none";
  const sprite = makeSprite(texture);
  const anchor = token.mesh?.anchor ?? { x: 0.5, y: 0.5 };
  sprite.anchor.set(Number(anchor.x ?? 0.5), Number(anchor.y ?? 0.5));
  holder.addChild(sprite);
  let subjectMask = null;
  if (tokenUsesDynamicRing(token)) {
    subjectMask = new PIXI.Graphics();
    holder.addChild(subjectMask);
    sprite.mask = subjectMask;
  }
  entry.dynamic.addChild(holder);
  const reflection = { holder, sprite, subjectMask, dynamicRing: tokenUsesDynamicRing(token), token };
  entry.tokenSprites.set(token.id, reflection);
  return reflection;
}

function removeTokenReflection(entry, tokenId) {
  const reflection = entry.tokenSprites.get(tokenId);
  if (!reflection) return;
  entry.tokenSprites.delete(tokenId);
  entry.wallOcclusion.delete(tokenId);
  reflection.holder.destroy({ children: true });
}

function syncTokenReflection(entry, token) {
  if (!tokenInSource(entry, token)) {
    removeTokenReflection(entry, token.id);
    return false;
  }
  let reflection = entry.tokenSprites.get(token.id);
  if (reflection && reflection.dynamicRing !== tokenUsesDynamicRing(token)) {
    removeTokenReflection(entry, token.id);
    reflection = null;
  }
  reflection ??= createTokenReflection(entry, token);
  if (!reflection) return false;
  const texture = tokenReflectionTexture(token);
  if (texture && reflection.sprite.texture !== texture) reflection.sprite.texture = texture;
  const local = localPoint(entry, tokenCenter(token));
  const xRatio = (local.x + entry.sourceWidth / 2) / entry.sourceWidth;
  const yRatio = (entry.sourceEnd - local.y) / entry.sourceDepth;
  reflection.holder.position.set(
    entry.reflectionRect.x + xRatio * entry.reflectionRect.width,
    entry.reflectionRect.y + yRatio * entry.reflectionRect.height,
  );
  reflection.holder.rotation = Number(token.document.rotation ?? 0) * Math.PI / 180 - entry.angle;
  const tokenWidth = Math.max(1, Number(token.w ?? token.document.width * canvas.dimensions.size ?? 1));
  const tokenHeight = Math.max(1, Number(token.h ?? token.document.height * canvas.dimensions.size ?? 1));
  const reflectedWidth = tokenWidth * entry.reflectionRect.width / entry.sourceWidth;
  const projectedHeight = tokenHeight * entry.reflectionRect.height / entry.sourceDepth;
  const readableHeight = Math.min(
    entry.reflectionRect.height,
    Math.max(projectedHeight, reflectedWidth * TOKEN_PERSPECTIVE_ASPECT),
  );
  // The real glass is too shallow to keep a full-height subject recognizable.
  // Show the upper 60% for dynamic subjects: head, shoulders, and torso remain
  // legible while the glass mask still provides the strong perspective.
  reflection.sprite.width = reflectedWidth;
  reflection.sprite.height = reflection.dynamicRing
    ? readableHeight / DYNAMIC_SUBJECT_VISIBLE_HEIGHT_RATIO
    : readableHeight;
  reflection.sprite.position.set(
    0,
    reflection.dynamicRing ? (reflection.sprite.height - readableHeight) / 2 : 0,
  );
  const scaleX = Number(token.document.texture?.scaleX ?? 1);
  const scaleY = Number(token.document.texture?.scaleY ?? 1);
  reflection.sprite.scale.x = Math.abs(reflection.sprite.scale.x) * (scaleX < 0 ? -1 : 1);
  reflection.sprite.scale.y = Math.abs(reflection.sprite.scale.y) * (scaleY < 0 ? -1 : 1);
  updateDynamicTokenMask(reflection, reflectedWidth, readableHeight);
  reflection.sprite.alpha = Math.min(0.97, Number(token.mesh?.alpha ?? 1));
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
    for (const tokenId of entry.wallOcclusion.keys()) {
      if (!liveIds.has(tokenId)) entry.wallOcclusion.delete(tokenId);
    }
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
Hooks.on("createWall", scheduleWallStructureRebuild);
Hooks.on("updateWall", scheduleWallUpdateRebuild);
Hooks.on("deleteWall", scheduleWallStructureRebuild);
Hooks.on("createToken", scheduleDynamicScan);
Hooks.on("deleteToken", scheduleDynamicScan);
Hooks.on("updateToken", scheduleDynamicScan);
Hooks.on("refreshToken", scheduleDynamicScan);
Hooks.on("createItem", invalidateActorReflectionEligibility);
Hooks.on("updateItem", invalidateActorReflectionEligibility);
Hooks.on("deleteItem", invalidateActorReflectionEligibility);
Hooks.on("updateActor", invalidateActorReflectionEligibility);
