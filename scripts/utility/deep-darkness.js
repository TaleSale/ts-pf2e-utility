import { MODULE_ID } from "../core.js";

const STYLE = "weather-deep-darkness";
const SLUG = "magical-darkness";
const TOKEN_OPTION = "target:tsu-darkness-token:";

export function hasGreaterDarkvision(actor) {
  return Boolean(actor?.perception?.senses?.has?.("greater-darkvision"));
}

export function containsPoint(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function crossesDarkness(start, end, polygons) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return polygons.some(polygon => {
    if (containsPoint(start, polygon) || containsPoint(end, polygon)) return true;
    return polygon.some((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return cross(start, end, a) * cross(start, end, b) < 0 && cross(a, b, start) * cross(a, b, end) < 0;
    });
  });
}

function polygonsForToken(token) {
  const scene = token?.parent;
  const level = scene?.levels?.get?.(token.level);
  const floorLevel = Number(level?.flags?.[MODULE_ID]?.floorLevelNumber ?? level?.index ?? 0);
  return (scene?.getFlag?.(MODULE_ID, "floorTextures")?.floors ?? [])
    .filter(f => f.style === STYLE && Number(f.level ?? 0) === floorLevel && f.points?.length >= 3)
    .map(f => f.points);
}

function darknessVolumes(token) {
  const volumes = polygonsForToken(token).map(points => ({
    contours: [points], contains: point => containsPoint(point, points), bottom: null, top: null,
  }));
  for (const region of token?.parent?.regions ?? []) {
    const flag = region.flags?.[MODULE_ID]?.spellFloor;
    if (flag?.style !== STYLE || flag.placement) continue;
    const levels = Array.from(region._source?.levels ?? region.levels ?? [], entry => entry.id ?? entry);
    if (levels.length && !levels.includes(token.level?.id ?? token.level)) continue;
    const contours = [...region.polygonTree].filter(node => node.points?.length >= 6).map(node =>
      Array.from({ length: node.points.length / 2 }, (_, i) => ({ x: node.points[i * 2], y: node.points[i * 2 + 1] })));
    volumes.push({ contours, contains: point => region.polygonTree.testPoint(point),
      bottom: region.elevation?.bottom ?? null, top: region.elevation?.top ?? null,
      topInclusive: region.elevation?.topInclusive ?? false });
  }
  return volumes;
}

function withinHeight(volume, elevation) {
  return (volume.bottom === null || elevation >= volume.bottom)
    && (volume.top === null || (volume.topInclusive ? elevation <= volume.top : elevation < volume.top));
}

// Split the sight ray at contour and height boundaries, then test each interval.
// This preserves holes and allows sight above or below a finite region.
export function crossesDarknessVolume(start, end, fromHeight, toHeight, volume) {
  const dx = end.x - start.x, dy = end.y - start.y, dz = toHeight - fromHeight;
  const cuts = [0, 1];
  for (const contour of volume.contours) for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const ex = b.x - a.x, ey = b.y - a.y, denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const ax = a.x - start.x, ay = a.y - start.y;
    const t = (ax * ey - ay * ex) / denominator, u = (ax * dy - ay * dx) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  if (dz) for (const height of [volume.bottom, volume.top]) {
    if (height === null) continue;
    const t = (height - fromHeight) / dz;
    if (t > 0 && t < 1) cuts.push(t);
  }
  cuts.sort((a, b) => a - b);
  const inside = t => withinHeight(volume, fromHeight + t * dz)
    && volume.contains({ x: start.x + t * dx, y: start.y + t * dy });
  return inside(0) || inside(1) || cuts.some((t, i) => i && inside((cuts[i - 1] + t) / 2));
}

export function blockedByDeepDarkness(observer, target, point = target?.object?.center) {
  if (!observer || !target || !point || hasGreaterDarkvision(observer.actor)) return false;
  if (observer.parent?.id !== target.parent?.id || observer.level !== target.level) return false;
  const origin = observer.object?.center;
  return Boolean(origin && darknessVolumes(observer).some(volume => crossesDarknessVolume(
    origin, point, Number(observer.elevation ?? 0), Number(point.elevation ?? target.elevation ?? 0), volume,
  )));
}

export function darknessVisionBoundary(origin, volumes, radius) {
  if (volumes.some(volume => volume.contains(origin))) return [];
  const angles = Array.from({ length: 64 }, (_, i) => i * Math.PI / 32 - Math.PI);
  const edges = [];
  for (const volume of volumes) for (const contour of volume.contours) for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    edges.push([a, b]);
    const angle = Math.atan2(a.y - origin.y, a.x - origin.x);
    for (const offset of [-1e-7, 0, 1e-7]) angles.push(Math.atan2(Math.sin(angle + offset), Math.cos(angle + offset)));
  }
  return angles.sort((a, b) => a - b).flatMap(angle => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = radius;
    for (const [a, b] of edges) {
      const ex = b.x - a.x, ey = b.y - a.y, denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-9) continue;
      const ax = a.x - origin.x, ay = a.y - origin.y;
      const t = (ax * ey - ay * ex) / denominator, u = (ax * dy - ay * dx) / denominator;
      if (t >= 0 && u >= 0 && u <= 1) distance = Math.min(distance, t);
    }
    return [origin.x + dx * distance, origin.y + dy * distance];
  });
}

function installDarknessVisionBoundary() {
  const prototype = CONFIG.Canvas.visionSourceClass.prototype;
  const createShapes = prototype._createShapes;
  prototype._createShapes = function(...args) {
    const result = createShapes.apply(this, args);
    const token = this.object?.document;
    if (!token || hasGreaterDarkvision(token.actor)) return result;
    const volumes = darknessVolumes(token).filter(volume => withinHeight(volume, Number(this.elevation ?? token.elevation ?? 0)));
    if (!volumes.length) return result;
    const radius = Math.max(canvas.dimensions.maxR ?? 0, Math.hypot(canvas.dimensions.width, canvas.dimensions.height)) * 2;
    const boundary = new PIXI.Polygon(darknessVisionBoundary({ x: this.x, y: this.y }, volumes, radius));
    const restricted = new Map();
    for (const key of ["los", "shape", "light"]) {
      const polygon = this[key];
      if (!polygon) continue;
      if (!restricted.has(polygon)) restricted.set(polygon, polygon.applyConstraint(boundary));
      this[key] = restricted.get(polygon);
    }
    return result;
  };
}

function actorTokens(actor) {
  return (canvas?.tokens?.placeables ?? []).filter(t => t.actor === actor || t.actor?.uuid === actor?.uuid);
}

function targetTokens(actor) {
  const tokens = actorTokens(actor);
  if (tokens.length <= 1) return tokens;
  const targeted = tokens.filter(t => game.user.targets.has(t));
  return targeted.length === 1 ? targeted : tokens;
}

function createFlatCheckRule(actor) {
  const Rule = game.pf2e?.RuleElements?.custom?.["fc-TreatAs"];
  const parent = actor.items?.contents?.[0];
  if (!Rule || !parent) return null;
  const rule = new Rule({
    key: "fc-TreatAs", slug: SLUG, label: "Сильная тьма", condition: "observed",
    treatAs: "hidden", mode: "upgrade", affects: "self",
  }, { parent, sourceIndex: null, suppressWarnings: true });
  rule._tsuDeepDarkness = true;
  rule.getData = function(options) {
    if (hasGreaterDarkvision(actor)) return null;
    const ids = options.filter(o => o.startsWith(TOKEN_OPTION)).map(o => o.slice(TOKEN_OPTION.length));
    const targets = ids.map(id => canvas.tokens.get(id)?.document).filter(Boolean);
    const tokens = actorTokens(actor);
    const controlled = tokens.filter(t => t.controlled);
    const observers = (controlled.length === 1 ? controlled : tokens).map(t => t.document);
    // Ambiguous linked copies must not give a check caused by a different copy.
    if (!targets.length || !observers.length || !targets.every(t => observers.every(o => blockedByDeepDarkness(o, t)))) return null;
    return { slug: SLUG, label: this.label, affects: "self", mode: "upgrade", condition: "observed", treatAs: "hidden", priority: 2 };
  };
  return rule;
}

export function installDeepDarkness() {
  const prototype = CONFIG.Actor.documentClass.prototype;
  if (prototype._tsuDeepDarknessInstalled) return;
  Object.defineProperty(prototype, "_tsuDeepDarknessInstalled", { value: true });
  installDarknessVisionBoundary();
  const selfOptions = prototype.getSelfRollOptions;
  prototype.getSelfRollOptions = function(prefix = "self") {
    const options = selfOptions.call(this, prefix);
    if (prefix === "target") for (const token of targetTokens(this)) options.push(`${TOKEN_OPTION}${token.id}`);
    return options;
  };
  const prepare = prototype.prepareRuleElements;
  prototype.prepareRuleElements = function(...args) {
    const rules = prepare.apply(this, args);
    if (game.modules.get("pf2e-flatcheck-helper")?.active) {
      const rule = createFlatCheckRule(this);
      if (rule) rules.push(rule);
    }
    return rules;
  };
  for (const actor of new Set([...game.actors, ...canvas.tokens?.placeables?.map(t => t.actor) ?? []].filter(Boolean))) {
    if (!actor.rules || actor.rules.some(r => r._tsuDeepDarkness)) continue;
    const rule = createFlatCheckRule(actor);
    if (rule) actor.rules.push(rule);
  }
  for (const mode of Object.values(CONFIG.Canvas.detectionModes)) {
    if (mode.type !== foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT) continue;
    const testPoint = mode._testPoint;
    mode._testPoint = function(source, config, target, test) {
      const observer = source.object?.document;
      const targetDocument = target?.document ?? observer;
      if (blockedByDeepDarkness(observer, targetDocument, test.point)) return false;
      return testPoint.call(this, source, config, target, test);
    };
  }
  const refresh = () => {
    if (canvas.ready) canvas.perception.update({ initializeVision: true, refreshVision: true, refreshLighting: true });
  };
  Hooks.on("updateScene", (scene, changed) => {
    if (scene.id === canvas.scene?.id && changed.flags?.[MODULE_ID]?.floorTextures) refresh();
  });
  for (const event of ["createRegion", "updateRegion", "deleteRegion"]) Hooks.on(event, region => {
    if (region.parent?.id === canvas.scene?.id) refresh();
  });
  Hooks.on("updateActor", refresh);
  refresh();
}

Hooks.once("ready", installDeepDarkness);
