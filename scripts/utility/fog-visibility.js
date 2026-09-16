import { MODULE_ID } from "../core.js";

const CONDITION_FLAG = "weatherFogConcealed";
const CONDITION_OWNER = "weather-fog";
const synchronization = new WeakMap();

export const FOG_VISION_SLUGS = Object.freeze(new Set(["cloud-gazer", "smoke-sight", "smoke-vision"]));

function normalizedSlug(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function actorHasFogVision(actor) {
  return Boolean(actor && [...(actor.items ?? [])].some((item) => (
    FOG_VISION_SLUGS.has(normalizedSlug(item?.slug ?? item?.system?.slug ?? item?.name))
  )));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y))
        && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function orientation(a, b, c) {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

function pointOnSegment(point, start, end) {
  const epsilon = 0.01;
  return Math.abs((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)) <= epsilon
    && point.x >= Math.min(start.x, end.x) - epsilon && point.x <= Math.max(start.x, end.x) + epsilon
    && point.y >= Math.min(start.y, end.y) - epsilon && point.y <= Math.max(start.y, end.y) + epsilon;
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (abC === 0 && pointOnSegment(c, a, b)) || (abD === 0 && pointOnSegment(d, a, b))
    || (cdA === 0 && pointOnSegment(a, c, d)) || (cdB === 0 && pointOnSegment(b, c, d));
}

function polygonsOverlap(left, right) {
  if (left.some((point) => pointInPolygon(point, right))) return true;
  if (right.some((point) => pointInPolygon(point, left))) return true;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (segmentsIntersect(left[leftIndex], left[(leftIndex + 1) % left.length], right[rightIndex], right[(rightIndex + 1) % right.length])) return true;
    }
  }
  return false;
}

export function tokenOverlapsFog(token, fogPolygons) {
  const bounds = token?.document?.mechanicalBounds ?? token?.document?.bounds ?? token?.bounds;
  if (!bounds || !(Number(bounds.width) > 0) || !(Number(bounds.height) > 0)) return false;
  const center = {
    x: Number(bounds.x ?? 0) + Number(bounds.width) / 2,
    y: Number(bounds.y ?? 0) + Number(bounds.height) / 2,
  };
  return (fogPolygons ?? []).some((polygon) => Array.isArray(polygon)
    && polygon.length >= 3 && pointInPolygon(center, polygon));
}

function creatureActor(actor) {
  return Boolean(actor && (typeof actor.isOfType === "function"
    ? actor.isOfType("creature") : ["character", "familiar", "npc"].includes(actor.type)));
}

function ownedConditions(actor) {
  return (actor?.itemTypes?.condition ?? []).filter((condition) => condition.slug === "concealed"
    && condition.getFlag?.(MODULE_ID, CONDITION_FLAG) === CONDITION_OWNER);
}

const FOG_ROLL_OPTION = "tsu:weather-fog-only";
const FOG_RULE_SLUG = "tsu-weather-fog-vision";

function hasOnlyFogConcealed(actor) {
  const concealed = (actor?.itemTypes?.condition ?? []).filter((item) => item.slug === "concealed");
  return concealed.length > 0 && concealed.every((item) => (
    item.getFlag?.(MODULE_ID, CONDITION_FLAG) === CONDITION_OWNER
  ));
}

function installFogRulePreparation() {
  if (!game.modules.get("pf2e-flatcheck-helper")?.active) return;
  const itemPrototype = CONFIG.Item.documentClass.prototype;
  const actorPrototype = CONFIG.Actor.documentClass.prototype;
  const prepareRules = itemPrototype.prepareRuleElements;
  const selfOptions = actorPrototype.getSelfRollOptions;

  // Prepared data only: ability sources and the external module stay untouched.
  itemPrototype.prepareRuleElements = function prepareFogVisionRules(...args) {
    const rules = prepareRules.apply(this, args);
    if (!this.actor?.canHostRuleElements
        || !FOG_VISION_SLUGS.has(normalizedSlug(this.slug ?? this.system?.slug))
        || rules.some((rule) => rule.slug === FOG_RULE_SLUG)) return rules;
    const RuleElement = game.pf2e.RuleElements.custom["fc-TreatAs"];
    if (!RuleElement) return rules;
    try {
      const rule = new RuleElement({
        key: "fc-TreatAs", slug: FOG_RULE_SLUG, label: this.name,
        condition: "concealed", treatAs: "observed", mode: "downgrade", affects: "self",
        predicate: [`target:${FOG_ROLL_OPTION}`],
      }, { parent: this, sourceIndex: null, suppressWarnings: true });
      const getData = rule.getData;
      rule.getData = function getFogTreatAsData(options) {
        // Light, dazzled, and other separate check sources must retain their DC.
        const separateSource = options.some((option) => option.startsWith("fc:origin:"));
        return separateSource ? null : getData.call(this, options);
      };
      if (!rule.ignored) rules.push(rule);
    } catch (error) {
      console.error(`${MODULE_ID} | Fog rule preparation failed`, error);
    }
    return rules;
  };

  // PF2e puts these options into attack contexts; Utility Buttons also reads
  // them directly for token checks. Evaluate ownership separately for each target.
  actorPrototype.getSelfRollOptions = function getFogSelfRollOptions(prefix = "self") {
    const options = selfOptions.call(this, prefix);
    if (hasOnlyFogConcealed(this)) options.push(`${prefix}:${FOG_ROLL_OPTION}`);
    return options;
  };
}
async function addFogConcealed(actor) {
  if (actor.itemTypes?.condition?.some((condition) => condition.slug === "concealed")) return;
  const source = game.pf2e?.ConditionManager?.getCondition?.("concealed")?.toObject?.();
  if (!source) return;
  source.flags = foundry.utils.mergeObject(source.flags ?? {}, { [MODULE_ID]: { [CONDITION_FLAG]: CONDITION_OWNER } });
  await actor.createEmbeddedDocuments("Item", [source]);
}

async function removeFogConcealed(actor) {
  const ids = ownedConditions(actor).map((condition) => condition.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

async function syncActor(actor, { getFogPolygons, getFloorNumber }) {
  if (!creatureActor(actor) || game.user !== actor.primaryUpdater) return;
  const pending = synchronization.get(actor);
  if (pending) return pending;
  const task = (async () => {
    const tokens = (canvas?.tokens?.placeables ?? []).filter((token) => token.actor === actor);
    const inFog = tokens.some((token) => {
      const scene = token.document?.parent ?? canvas?.scene;
      return tokenOverlapsFog(token, getFogPolygons(scene, getFloorNumber(token.document, scene)));
    });
    if (inFog) await addFogConcealed(actor);
    else await removeFogConcealed(actor);
  })().catch((error) => console.error(`${MODULE_ID} | Fog concealment synchronization failed`, error));
  synchronization.set(actor, task);
  try { await task; } finally { synchronization.delete(actor); }
}

export function installFogConcealment({ getFogPolygons, getFloorNumber }) {
  installFogRulePreparation();
  const syncAll = () => {
    if (!canvas?.ready) return;
    const actors = new Set((canvas.tokens?.placeables ?? []).map((token) => token.actor).filter(Boolean));
    for (const actor of actors) void syncActor(actor, { getFogPolygons, getFloorNumber });
  };
  Hooks.on("canvasReady", syncAll);
  const syncTokenActor = (token) => {
    const actor = token?.actor;
    if (actor) setTimeout(() => void syncActor(actor, { getFogPolygons, getFloorNumber }), 0);
  };
  Hooks.on("createToken", syncTokenActor);
  Hooks.on("deleteToken", syncTokenActor);
  Hooks.on("updateToken", (token, changed) => {
    if (["x", "y", "width", "height", "elevation", "level"].some((key) => key in changed)) syncTokenActor(token);
  });

  return syncAll;
}
