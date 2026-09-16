import { registerCheckRollWrapper } from "./check-roll-wrapper.js";
import {
  buildMeasuredForestWaypoints,
  closestFootprintCenterPair,
  coverLevelForForestDistance,
  forestIntervals,
} from "./obstructing-forest-geometry.js";

const MODULE_ID = "ts-pf2e-utility";
const SETTING_KEY = "enableObstructingForest";
const FLOOR_FLAG = "floorTextures";
const FLOOR_LEVEL_FLAG = "floorLevelNumber";
const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";
const FOREST_STYLES = new Set(["forest-deciduous", "forest-pine", "forest-mixed"]);
const COVER_BONUSES = { lesser: 1, standard: 2, greater: 4, "greater-prone": 4 };

let coverSourcePromise = null;

let warnedAboutCoverSource = false;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    name: "TS_PF2E_UTILITY.Settings.ObstructingForest.Name",
    hint: "TS_PF2E_UTILITY.Settings.ObstructingForest.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });
});

Hooks.once("ready", installCheckRollWrapper);

function enabled() {
  return game.settings.get(MODULE_ID, SETTING_KEY) === true;
}

function isCreature(actor) {
  return actor?.isOfType?.("creature") === true;
}

function sourceId(item) {
  return item?.sourceId
    ?? item?._stats?.compendiumSource
    ?? item?.flags?.core?.sourceId
    ?? null;
}

function coverSelection(item) {
  if (sourceId(item) !== COVER_UUID) return null;
  const choice = item?.system?.rules?.find?.((rule) => rule?.key === "ChoiceSet" && rule?.flag === "cover")?.selection;
  if (!choice || typeof choice !== "object") return null;
  const level = String(choice.level ?? "");
  const bonus = Number(choice.bonus ?? COVER_BONUSES[level] ?? 0);
  return { level, bonus: Number.isFinite(bonus) ? bonus : 0 };
}

function actorItems(actor) {
  if (actor?.items?.contents) return actor.items.contents;
  if (actor?.items && Symbol.iterator in Object(actor.items)) return [...actor.items];
  return [];
}

function strongestExistingCover(actor) {
  return actorItems(actor).map(coverSelection).filter(Boolean).reduce((strongest, cover) => cover.bonus > strongest.bonus ? cover : strongest, { level: null, bonus: 0 });
}

function rawItemIsCover(item) {
  return sourceId(item) === COVER_UUID;
}

function coverRules(level) {
  const bonus = COVER_BONUSES[level];
  const rules = [
    { choices: [], flag: "cover", key: "ChoiceSet", prompt: "PF2E.SpecificRule.Cover.Prompt", selection: { bonus, level } },
    { key: "RollOption", option: `self:cover-bonus:${bonus}` },
    { key: "RollOption", option: `self:cover-level:${level}` },
    { key: "FlatModifier", selector: "ac", type: "circumstance", value: bonus },
  ];
  if (level !== "lesser") {
    rules.push(
      { key: "FlatModifier", predicate: ["area-effect"], selector: "reflex", type: "circumstance", value: bonus },
      { key: "FlatModifier", predicate: [{ or: ["action:hide", "action:sneak", "avoid-detection"] }], selector: "stealth", type: "circumstance", value: bonus },
      { key: "FlatModifier", predicate: ["action:avoid-notice"], selector: "initiative", type: "circumstance", value: bonus },
    );
  }
  return rules;
}

async function getCoverSource() {
  coverSourcePromise ??= fromUuid(COVER_UUID).then((item) => item?.toObject?.() ?? null).catch(() => null);
  return coverSourcePromise;
}

async function applyAttackCover(context, level) {
  const targetActor = context.target?.actor;
  if (!targetActor) return;
  const bonus = COVER_BONUSES[level];
  if (strongestExistingCover(targetActor).bonus >= bonus) return;
  const sourceData = await getCoverSource();
  if (!sourceData) {
    if (!warnedAboutCoverSource) {
      warnedAboutCoverSource = true;
      console.warn(`${MODULE_ID} | The PF2e Cover effect could not be loaded; obstructing forest cover was skipped.`);
    }
    return;
  }
  const source = foundry.utils.deepClone(sourceData);
  const items = foundry.utils.deepClone(targetActor._source?.items ?? []).filter((item) => !rawItemIsCover(item));
  source.name = game.i18n.localize("TS_PF2E_UTILITY.Settings.ObstructingForest.CoverLabel");
  source.system.rules = coverRules(level);
  items.push(source);
  context.target.actor = targetActor.clone({ items }, { keepId: true });
  if (context.dc?.slug) {
    const dc = context.target.actor.getStatistic(context.dc.slug)?.dc;
    if (dc) {
      context.dc.value = dc.value;
      context.dc.statistic = dc;
    }
  }
}

function optionSet(context) {
  const options = context.options;
  return options instanceof Set ? options : new Set(Array.isArray(options) ? options : []);
}

function receivesCoverCheckBonus(check, context) {
  const options = optionSet(context);
  const slug = String(check?.slug ?? "");
  const domains = Array.isArray(context.domains) ? context.domains : [];
  const reflexArea = context.type === "saving-throw"
    && (slug === "reflex" || domains.includes("reflex"))
    && options.has("area-effect");
  const stealthAction = (slug === "stealth" || domains.includes("stealth"))
    && ["action:hide", "action:sneak", "avoid-detection"].some((option) => options.has(option));
  const avoidNotice = context.type === "initiative" && options.has("action:avoid-notice");
  return reflexArea || stealthAction || avoidNotice;
}

function applyCheckBonus(check, context, level) {
  if (level === "lesser" || !receivesCoverCheckBonus(check, context) || typeof check?.push !== "function") return;
  const bonus = COVER_BONUSES[level];
  const label = game.i18n.localize("TS_PF2E_UTILITY.Settings.ObstructingForest.CoverLabel");
  check.push(new game.pf2e.Modifier({
    slug: "obstructing-forest-cover",
    label,
    modifier: bonus,
    type: "circumstance",
  }));
  check.calculateTotal?.(optionSet(context));
}

async function resolveToken(reference, actor) {
  let resolved = reference;
  if (typeof resolved === "string") resolved = await fromUuid(resolved).catch(() => null);
  const directObject = resolved?.document ? resolved : resolved?.object;
  if (directObject?.document) return directObject;
  const document = resolved?.documentName === "Token" ? resolved : resolved?.document;
  if (document?.object) return document.object;
  return actor?.getActiveTokens?.(true, true)?.find((token) => token.scene === canvas.scene || token.document?.parent === canvas.scene) ?? null;
}

function tokenLevelId(token) {
  return token?.document?.level ?? token?.level ?? null;
}

function floorNumberForLevel(scene, levelId) {
  if (levelId == null) return 0;
  const levels = scene?.levels?.contents ?? scene?.levels ?? [];
  const level = scene?.levels?.get?.(levelId) ?? [...levels].find((entry) => entry.id === levelId);
  if (!level) return null;
  const stored = Number(level.flags?.[MODULE_ID]?.[FLOOR_LEVEL_FLAG]);
  return Number.isFinite(stored) ? stored : Number(level.index ?? 0);
}

function closestFootprintCenters(source, target) {
  const centers = (token) => {
    const footprint = Array.isArray(token?.footprint) ? token.footprint : [...(token?.footprint ?? [])];
    return footprint.length ? footprint.map((offset) => canvas.grid.getCenterPoint(offset)) : [token.center];
  };
  return closestFootprintCenterPair(centers(source), centers(target), source.center, target.center);
}

function forestPolygons(scene, floorNumber) {
  const data = scene?.getFlag?.(MODULE_ID, FLOOR_FLAG);
  return (Array.isArray(data?.floors) ? data.floors : [])
    .filter((floor) => FOREST_STYLES.has(floor?.style) && Number(floor.level ?? 0) === floorNumber)
    .map((floor) => floor.points)
    .filter((points) => Array.isArray(points) && points.length >= 3);
}

async function calculateForestCover(context) {
  const originActor = context.origin?.actor ?? context.actor;
  const targetActor = context.target?.actor;
  if (!isCreature(originActor) || !isCreature(targetActor)) return null;
  const originToken = await resolveToken(context.origin?.token ?? context.token, originActor);
  const targetToken = await resolveToken(context.target?.token, targetActor);
  const scene = canvas?.scene;
  if (!scene || !originToken || !targetToken || originToken === targetToken) return null;
  if (originToken.document?.parent !== scene || targetToken.document?.parent !== scene) return null;
  const originLevel = tokenLevelId(originToken);
  const targetLevel = tokenLevelId(targetToken);
  if (originLevel !== targetLevel) return null;
  const floorNumber = floorNumberForLevel(scene, originLevel);
  if (!Number.isFinite(floorNumber)) return null;
  const polygons = forestPolygons(scene, floorNumber);
  if (!polygons.length) return null;
  const { origin, destination } = closestFootprintCenters(originToken, targetToken);
  const intervals = forestIntervals(origin, destination, polygons);
  const waypoints = buildMeasuredForestWaypoints(origin, destination, intervals);
  if (waypoints.length < 2) return null;
  const distance = Number(canvas.grid.measurePath(waypoints).distance ?? 0);
  const level = coverLevelForForestDistance(distance);
  return level ? { distance, level } : null;
}

async function prepareRoll(check, context) {
  if (!enabled() || !context || context.isReroll) return;
  const cover = await calculateForestCover(context);
  if (!cover) return;
  if (context.type === "attack-roll") await applyAttackCover(context, cover.level);
  else applyCheckBonus(check, context, cover.level);
}

function installCheckRollWrapper() {
  registerCheckRollWrapper("obstructing-forest", async function obstructingForestWrapper(wrapped, check, context, ...args) {
    try {
      await prepareRoll(check, context);
    } catch (error) {
      console.warn(`${MODULE_ID} | Obstructing forest cover calculation failed`, error);
    }
    return wrapped(check, context, ...args);
  });
}
