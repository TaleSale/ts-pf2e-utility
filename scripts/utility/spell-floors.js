import { MODULE_ID } from "../core.js";
import { registerActionPlusFeature, getItemActionPlusOptions } from "../actionplus/actionplus.js";

export const SPELL_FLOOR_FLAG = "spellFloor";
const STYLES = {
  blizzard: ["weather-blizzard", "Метель", "Blizzard"],
  smoke: ["weather-smoke", "Дым", "Smoke"],
  fire: ["hazard-fire", "Огонь", "Fire"],
  acid: ["hazard-acid", "Кислота", "Acid"],
  mist: ["weather-fog", "Туман", "Fog"],
  snow: ["weather-snow", "Снег — Сложная местность", "Snow — Difficult terrain"],
  darkness: ["weather-darkness", "Тьма", "Darkness"],
  void: ["weather-deep-darkness", "Сильная тьма", "Greater darkness"],
  forest: ["forest-deciduous", "Лиственный лес — Сложная местность", "Deciduous forest — Difficult terrain"],
  pine: ["forest-pine", "Хвойный лес — Сложная местность", "Pine forest — Difficult terrain"],
  mixed: ["forest-mixed", "Смешанный лес — Сложная местность", "Mixed forest — Difficult terrain"],
  bushes: ["flowering-shrubs-dense", "Кусты — Сложная местность", "Shrubs — Difficult terrain"],
};
const label = (ru, en) => game.i18n.lang === "ru" ? ru : en;
export function normalizeSpellFloor(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (["devil", "devil-trails"].includes(key)) return "hazard-fire";
  return STYLES[key]?.[0] ?? Object.values(STYLES).find(([style]) => style === key)?.[0] ?? null;
}
const EFFECTS = {
  concealment: ["Плохая видимость", "Poor visibility", ["mist", "blizzard", "smoke"]],
  darkness: ["Тьма", "Darkness", ["darkness"]],
  greaterDarkness: ["Сильная тьма", "Greater darkness", ["void"]],
  difficult: ["Сложная местность", "Difficult terrain", ["bushes", "forest", "pine", "mixed", "snow"]],
  greaterDifficult: ["Особо сложная местность", "Greater difficult terrain", ["bushes", "forest", "pine", "mixed", "snow"]],
  hazardous: ["Опасная местность", "Hazardous terrain", ["fire", "acid"]],
};
export function spellFloorEffect(config = {}) {
  if (EFFECTS[config.effect]) return config.effect;
  const style = normalizeSpellFloor(config.style);
  if (style === "weather-darkness") return "darkness";
  if (style === "weather-deep-darkness") return "greaterDarkness";
  if (["hazard-fire", "hazard-acid"].includes(style)) return "hazardous";
  return ["weather-fog", "weather-smoke", "weather-blizzard"].includes(style) || !style ? "concealment" : "difficult";
}
export function spellFloorBehaviors(style, effect = spellFloorEffect({ style })) {
  if (["darkness", "greaterDarkness"].includes(effect)) return [{
    name: "", type: "adjustDarknessLevel", disabled: false,
    system: { mode: 0, modifier: effect === "darkness" ? 0.85 : 1 },
  }];
  if (["difficult", "greaterDifficult"].includes(effect)) return [{
    name: "", type: "modifyMovementCost", disabled: false,
    system: { difficulties: { walk: effect === "difficult" ? 2 : 3, travel: effect === "difficult" ? 2 : 3 } },
  }];
  return [];
}
const escapeAttribute = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function styleOptions(effect, style) {
  return EFFECTS[effect][2].map(key => `<option value="${key}" ${normalizeSpellFloor(style) === STYLES[key][0] ? "selected" : ""}>${label(STYLES[key][1], STYLES[key][2]).split(" — ")[0]}</option>`).join("");
}

// Region geometry remains authoritative: nothing is copied into Scene floor flags.
export function regionFloorOverlays(scene, level, nativeLevelId) {
  return [...(scene?.regions ?? [])].flatMap((region) => {
    if (region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.placement || region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.managedFloor) return [];
    const style = normalizeSpellFloor(region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.style);
    const levels = Array.from(region._source?.levels ?? region.levels ?? [], (entry) => entry.id ?? entry);
    if (!style || (levels.length && !levels.includes(nativeLevelId))) return [];
    // Each outer contour gets a fill, clipped against the complete tree (including holes).
    return [...(region.polygonTree ?? [])].filter((node) => !node.isHole && node.points?.length >= 6).map((node, index) => ({
      id: `spell-${region.id}-${index}`, source: "spell", style, level, lines: [], region,
      points: Array.from({ length: node.points.length / 2 }, (_, i) => ({ x: node.points[i * 2], y: node.points[i * 2 + 1] })),
    }));
  });
}

export function tokenInsideSpellFog(token, scene) {
  const bounds = token?.mechanicalBounds ?? token?.bounds;
  if (!bounds) return false;
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return [...(scene?.regions ?? [])].some((region) => {
    if (region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.placement) return false;
    const config = region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG];
    if (!config || spellFloorEffect(config) !== "concealment") return false;
    const levels = Array.from(region._source?.levels ?? region.levels ?? [], (entry) => entry.id ?? entry);
    if (levels.length && !levels.includes(token.level?.id ?? token.level)) return false;
    const { bottom = null, top = null, topInclusive = false } = region.elevation ?? {};
    const elevation = Number(token.elevation ?? 0);
    return (bottom === null || elevation >= bottom)
      && (top === null || (topInclusive ? elevation <= top : elevation < top))
      && region.polygonTree.testPoint(point);
  });
}

registerActionPlusFeature({
  id: "floors", label: "TS_PF2E_UTILITY.SpellFloorsLabel", itemTypes: ["spell", "action", "feat"],
  render: ({ flags }) => {
    const config = flags[SPELL_FLOOR_FLAG] ?? {};
    const effect = spellFloorEffect(config);
    return `<div class="tsu-spell-floor-form">
      <label class="tsu-spell-floor-toggle"><input type="checkbox" data-spell-floor-enabled ${config.enabled !== false ? "checked" : ""}> <span>${label("Включить полы", "Enable floors")}</span></label>
      <label class="tsu-spell-floor-row"><span>${label("Эффект", "Effect")}</span><select data-spell-floor-effect>${Object.entries(EFFECTS).map(([key, [ru, en]]) => `<option value="${key}" ${effect === key ? "selected" : ""}>${label(ru, en)}</option>`).join("")}</select></label>
      <label class="tsu-spell-floor-row"><span>${label("Визуал", "Visual")}</span><select data-spell-floor-style>${styleOptions(effect, config.style ?? "mist")}</select></label>
      <div class="tsu-spell-floor-hazard" data-spell-floor-hazard ${effect !== "hazardous" ? "hidden" : ""}>
        <label class="tsu-spell-floor-row"><span>${label("Урон", "Damage")}</span><input data-spell-floor-damage placeholder="${label("Введите формулу", "Enter a formula")}" value="${escapeAttribute(config.damage)}"><small>${label("Обязательно: например, 2d6[fire] или 2d6[acid]. Пустое поле не наносит урон.", "Required, e.g. 2d6[fire] or 2d6[acid]. An empty field deals no damage.")}</small></label>
        <label class="tsu-spell-floor-row"><span>${label("Спасбросок", "Saving throw")}</span><select data-spell-floor-save>${[["", "Без спасброска", "None"], ["fortitude", "Стойкость", "Fortitude"], ["reflex", "Рефлекс", "Reflex"], ["will", "Воля", "Will"]].map(([key, ru, en]) => `<option value="${key}" ${config.save === key ? "selected" : ""}>${label(ru, en)}</option>`).join("")}</select></label>
        <label class="tsu-spell-floor-row" data-spell-floor-dc-label ${!config.save ? "hidden" : ""}><span>${label("КС спасброска", "Save DC")}</span><input type="number" min="1" step="1" data-spell-floor-dc value="${Number(config.dc) || 20}"><small>${label("Простой спасбросок: при успехе — половина урона.", "Basic save: half damage on a success.")}</small></label>
      </div>
      <label class="tsu-spell-floor-row"><span>${label("Высота области", "Area height")}</span><input type="number" min="0" step="any" data-spell-floor-height placeholder="${label("По региону", "Region height")}" value="${Number.isFinite(config.height) ? config.height : ""}"><small>${label("В футах. Оставьте пустым, чтобы использовать высоту региона.", "In feet. Leave blank to use the region height.")}</small></label>
    </div>`;
  },
  activateListeners: ({ html, item }) => {
    const panel = html.querySelector('[data-feature-id="floors"]');
    for (const input of panel?.querySelectorAll("input, select") ?? []) input.addEventListener("change", async (event) => {
      const effect = panel.querySelector("[data-spell-floor-effect]").value;
      if (event.target.matches("[data-spell-floor-effect]")) panel.querySelector("[data-spell-floor-style]").innerHTML = styleOptions(effect);
      panel.querySelector("[data-spell-floor-hazard]").hidden = effect !== "hazardous";
      const save = panel.querySelector("[data-spell-floor-save]").value;
      panel.querySelector("[data-spell-floor-dc-label]").hidden = !save;
      const damage = panel.querySelector("[data-spell-floor-damage]").value.trim();
      if (effect === "hazardous" && damage && !(game.pf2e?.DamageRoll ?? Roll).validate(damage)) {
        ui.notifications.warn(label("Некорректная формула урона", "Invalid damage formula"));
        return;
      }
      const height = panel.querySelector("[data-spell-floor-height]").value;
      await item.setFlag(MODULE_ID, SPELL_FLOOR_FLAG, {
        effect, damage, save, dc: Math.max(1, Number(panel.querySelector("[data-spell-floor-dc]").value) || 20),
        enabled: panel.querySelector("[data-spell-floor-enabled]").checked,
        style: panel.querySelector("[data-spell-floor-style]").value,
        height: height !== "" && Number.isFinite(Number(height)) ? Math.max(0, Number(height)) : null,
      });
    });
  },
});

let inlineContext = null;
Hooks.once("ready", () => {
  // Delegate enrichment to PF2e, adding only our extra attributes.
  for (const enricher of CONFIG.TextEditor.enrichers) {
    if (!enricher.pattern.source.includes("Template")) continue;
    const original = enricher.enricher;
    enricher.enricher = async function(match, options) {
      const element = await original.call(this, match, options);
      if (match[1] === "Template" && element) {
        const params = Object.fromEntries(match[2].split("|").map((entry) => {
          const colon = entry.indexOf(":");
          return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
        }));
        if (normalizeSpellFloor(params.floors)) {
          element.dataset.tsuFloor = params.floors;
          if (params.height !== undefined) element.dataset.tsuFloorHeight = params.height;
        }
      }
      return element;
    };
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("[data-effect-area][data-tsu-floor]");
    inlineContext = link ? { style: link.dataset.tsuFloor, height: link.dataset.tsuFloorHeight } : null;
    queueMicrotask(() => { inlineContext = null; });
  }, true);
  const prototype = CONFIG.Canvas.layers.regions.layerClass.prototype;
  const original = prototype.placeRegion;
  prototype.placeRegion = function(data, ...args) {
    if (inlineContext) {
      data = foundry.utils.deepClone(data);
      foundry.utils.setProperty(data, `flags.${MODULE_ID}.${SPELL_FLOOR_FLAG}`, { ...inlineContext });
    }
    return original.call(this, data, ...args);
  };
});

Hooks.on("preCreateRegion", (region, data) => {
  if (data.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.persistent) return;
  const item = data.flags?.pf2e?.origin?.uuid ? fromUuidSync(data.flags.pf2e.origin.uuid) : null;
  const inline = data.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG];
  const config = inline ?? (getItemActionPlusOptions(item).includes("floors") ? item.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG] ?? { style: "mist" } : null);
  if (!config || config.enabled === false) return;
  const style = normalizeSpellFloor(config.style);
  if (!style) return;
  if (spellFloorEffect(config) === "hazardous" && !String(config.damage ?? "").trim()) {
    ui.notifications.warn(label("Опасная местность не создана: в настройках «Полы» нужно ввести формулу урона.", "Hazardous floor not created: enter a damage formula in Floors settings."));
    return;
  }
  const update = {
    [`flags.${MODULE_ID}.${SPELL_FLOOR_FLAG}`]: { ...config, effect: spellFloorEffect(config), style, placement: true },
  };
  if (config.height !== null && config.height !== undefined && config.height !== "" && Number.isFinite(Number(config.height))) {
    const bottom = data.elevation?.bottom ?? item?.actor?.getActiveTokens?.()[0]?.document?.elevation ?? 0;
    update.elevation = { bottom, top: bottom + Math.max(0, Number(config.height)), topInclusive: false };
  }
  region.updateSource(update);
});

export function persistentSpellFloorData(region) {
  const source = region.toObject();
  const config = source.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG];
  if (!config?.placement || !normalizeSpellFloor(config.style)) return null;
  // Copy only geometry and presentation. PF2e areaShape/messageId trigger targeting
  // helpers, so the durable floor is deliberately not another targeting template.
  const data = {};
  for (const key of ["name", "shapes", "elevation", "levels", "ownership", "color", "hidden", "locked", "_shapeConstraints", "attachment"]) {
    if (source[key] !== undefined) data[key] = source[key];
  }
  data.name = `${source.name ?? ""} — ${label("Полы", "Floors")}`;
  data.visibility = CONST.REGION_VISIBILITY.LAYER_UNLOCKED;
  data.displayMeasurements = false;
  data.behaviors = spellFloorBehaviors(config.style, spellFloorEffect(config));
  data.flags = {
    [MODULE_ID]: { [SPELL_FLOOR_FLAG]: { ...config, placement: false, persistent: true, sourceRegionId: region.id } },
    "pf2e-toolbelt": { targetHelper: { skip: true } },
  };
  return data;
}

Hooks.on("createRegion", (region, _options, userId) => {
  if (userId !== game.user.id) return;
  const data = persistentSpellFloorData(region);
  if (!data) return;
  return region.parent.createEmbeddedDocuments("Region", [data]).catch((error) => {
    console.error(`${MODULE_ID} | Could not create persistent spell floor`, error);
    ui.notifications.error(label("Не удалось создать регион покрытия заклинания.", "Could not create the spell floor region."));
  });
});

// One active GM resolves hazards for every client; serialize rolls and HP updates.
let hazardQueue = Promise.resolve();
function queueHazard(work) {
  hazardQueue = hazardQueue.then(work).catch(error => {
    console.error(`${MODULE_ID} | Hazardous floor`, error);
    ui.notifications.error(label("Не удалось применить урон опасной местности. Проверьте формулу и журнал.", "Could not apply hazardous terrain damage. Check the formula and console."));
  });
  return hazardQueue;
}
function handlesHazards() { return game.user?.isGM && game.users?.activeGM?.id === game.user.id; }
function hazardousRegions(scene) {
  return [...(scene?.regions ?? [])].filter(region => {
    const config = region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG];
    return config && !config.placement && spellFloorEffect(config) === "hazardous" && config.damage;
  });
}
export function spellFloorContains(region, point) {
  const levels = Array.from(region._source?.levels ?? region.levels ?? [], entry => entry.id ?? entry);
  if (levels.length && !levels.includes(point.level?.id ?? point.level)) return false;
  const { bottom = null, top = null, topInclusive = false } = region.elevation ?? {};
  const elevation = Number(point.elevation ?? 0);
  return (bottom === null || elevation >= bottom) && (top === null || (topInclusive ? elevation <= top : elevation < top))
    && !!region.polygonTree?.testPoint(point);
}
function waypointCenter(token, waypoint, grid) {
  return { ...waypoint, x: waypoint.x + (waypoint.width ?? token.width ?? 1) * grid.sizeX / 2,
    y: waypoint.y + (waypoint.height ?? token.height ?? 1) * grid.sizeY / 2,
    elevation: waypoint.elevation ?? token.elevation, level: waypoint.level ?? token.level };
}
// getDirectPath uses Foundry's own square/hex stepping, preserving intermediate
// waypoints and repeated entries while excluding the starting cell of each leg.
export function hazardousFloorEntries(token, movement, region, grid) {
  if (movement.method === "undo") return 0;
  const waypoints = [movement.origin, ...(movement.passed?.waypoints ?? []), movement.destination].filter(Boolean);
  let count = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypointCenter(token, waypoints[i - 1], grid);
    const to = waypointCenter(token, waypoints[i], grid);
    if (globalThis.CONFIG?.Token?.movement?.actions?.[waypoints[i].action]?.teleport) {
      const sameCell = Math.floor(from.x / grid.sizeX) === Math.floor(to.x / grid.sizeX) && Math.floor(from.y / grid.sizeY) === Math.floor(to.y / grid.sizeY);
      if ((!sameCell || !spellFloorContains(region, from)) && spellFloorContains(region, to)) count++;
      continue;
    }
    const path = grid.getDirectPath([{ x: from.x, y: from.y }, { x: to.x, y: to.y }]);
    for (let j = 1; j < path.length; j++) {
      const center = grid.getCenterPoint(path[j]);
      const point = { ...to, ...center, elevation: from.elevation + (to.elevation - from.elevation) * j / (path.length - 1) };
      if (spellFloorContains(region, point)) count++;
    }
    // Vertical movement / changing floors can enter a region without changing cells.
    if (path.length === 1 && !spellFloorContains(region, from) && spellFloorContains(region, to)) count++;
  }
  return count;
}
export async function applySpellFloorHazard(token, config, name) {
  const actor = token.actor;
  if (!actor?.applyDamage) return;
  if (config.save) return postSpellFloorSave(token, config, name);
  const multiplier = 1;
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice.rolls.find(cls => cls.name === "DamageRoll");
  const roll = await new DamageRoll(config.damage).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token }), flavor: escapeAttribute(name) });
  if (multiplier) await actor.applyDamage({ damage: multiplier === 1 ? roll : roll.alter(multiplier), token,
    rollOptions: new Set(["terrain", "damaging-effect"]) });
}
Hooks.on("moveToken", (token, movement) => {
  if (!handlesHazards() || !token.actor) return;
  const hits = hazardousRegions(token.parent).map(region => ({ region,
    count: hazardousFloorEntries(token, movement, region, token.parent.grid) }));
  return queueHazard(async () => {
    for (const { region, count } of hits) for (let i = 0; i < count; i++) {
      await applySpellFloorHazard(token, region.flags[MODULE_ID][SPELL_FLOOR_FLAG], region.name);
    }
  });
});
const hazardTurns = new Map();
Hooks.on("updateCombat", (combat, change) => {
  if (!handlesHazards() || !("turn" in change || "round" in change) || !combat.started) return;
  const key = `${combat.round}:${combat.turn}:${combat.combatant?.id}`;
  if (hazardTurns.get(combat.id) === key) return;
  hazardTurns.set(combat.id, key);
  const token = combat.combatant?.token;
  if (!token?.actor) return;
  const point = waypointCenter(token, token, token.parent.grid);
  const regions = hazardousRegions(token.parent).filter(region => spellFloorContains(region, point));
  return queueHazard(async () => {
    for (const region of regions) await applySpellFloorHazard(token, region.flags[MODULE_ID][SPELL_FLOOR_FLAG], region.name);
  });
});
Hooks.on("deleteCombat", combat => hazardTurns.delete(combat.id));

const FLOOR_SAVE_FLAG = "spellFloorSave";
const FLOOR_SAVE_OPTION = "tsu-floor-save:";
export function floorSaveMultiplier(outcome) {
  return { criticalFailure: 2, failure: 1, success: 0.5, criticalSuccess: 0 }[outcome];
}
export async function postSpellFloorSave(token, config, name) {
  const cycle = foundry.utils.randomID();
  const option = `${FLOOR_SAVE_OPTION}${cycle}`;
  const dc = Number(config.dc) || 20;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: token.actor, token }),
    flavor: escapeAttribute(name),
    content: `<p>${escapeAttribute(token.name)} · ${escapeAttribute(config.damage)}</p>@Check[${config.save}|dc:${dc}|basic:true|immutable:true|options:${option},damaging-effect,terrain]{${label("Спасбросок", "Saving throw")}}`,
    flags: {
      [MODULE_ID]: { [FLOOR_SAVE_FLAG]: { cycle, tokenUuid: token.uuid, damage: config.damage, name } },
      ...(game.toolbelt?.targetHelper ? { "pf2e-toolbelt": { targetHelper: {
        type: "check", author: token.actor.uuid, options: [option, "damaging-effect", "terrain"],
        saveVariants: { null: { basic: true, dc, statistic: config.save, saves: {} } }, targets: [token.uuid],
      } } } : {}),
    },
  });
}
export async function resolveSpellFloorSave(card, outcome, reroll = false) {
  outcome = Number.isInteger(outcome) ? ["criticalFailure", "failure", "success", "criticalSuccess"][outcome] : outcome;
  const multiplier = floorSaveMultiplier(outcome);
  if (multiplier === undefined) return;
  const state = card.flags?.[MODULE_ID]?.[FLOOR_SAVE_FLAG];
  if (!state || (state.resolved && !reroll) || (state.resolved?.outcome === outcome && state.resolved?.reroll === reroll)) return;
  const token = await fromUuid(state.tokenUuid);
  const actor = token?.actor;
  if (!actor?.applyDamage) return;
  // Undo exactly the PF2e recorded deltas, preserving unrelated damage/healing.
  const previous = state.resolved?.appliedMessageId ? game.messages.get(state.resolved.appliedMessageId) : null;
  const applied = previous?.flags?.pf2e?.appliedDamage;
  if (applied && !applied.isReverted) {
    const changes = {};
    for (const { path, value } of applied.updates ?? []) {
      const current = foundry.utils.getProperty(actor, path);
      if (typeof current === "number") changes[path] = current + value;
    }
    const shield = applied.shield && actor.items.get(applied.shield.id);
    if (shield) changes.items = [{ _id: shield.id, "system.hp.value": shield.hitPoints.value + applied.shield.damage }];
    const persistent = (applied.persistent ?? []).filter(id => actor.items.has(id));
    if (persistent.length) await actor.deleteEmbeddedDocuments("Item", persistent);
    if (Object.keys(changes).length) await actor.update(changes, { damageUndo: true,
      damageTaken: typeof changes["system.attributes.hp.value"] === "number" ? actor.hitPoints.value - changes["system.attributes.hp.value"] : 0 });
    await previous.setFlag("pf2e", "appliedDamage.isReverted", true);
  }
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice.rolls.find(cls => cls.name === "DamageRoll");
  const roll = state.roll ? DamageRoll.fromData(state.roll) : await new DamageRoll(state.damage).evaluate();
  // Keep the original damage dice when the save is rerolled.
  if (!state.roll) {
    await card.setFlag(MODULE_ID, `${FLOOR_SAVE_FLAG}.roll`, roll.toJSON());
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token }), flavor: escapeAttribute(state.name) });
  }
  let appliedMessageId = null;
  const option = `${FLOOR_SAVE_OPTION}${state.cycle}:damage`;
  const hook = Hooks.on("createChatMessage", message => {
    if (message.flags?.pf2e?.context?.options?.includes(option) && message.flags?.pf2e?.appliedDamage?.uuid === actor.uuid) appliedMessageId = message.id;
  });
  try {
    if (multiplier) await actor.applyDamage({ damage: multiplier === 1 ? roll : roll.alter(multiplier), token,
      rollOptions: new Set([option, "terrain", "damaging-effect"]) });
  } finally { Hooks.off("createChatMessage", hook); }
  await card.setFlag(MODULE_ID, `${FLOOR_SAVE_FLAG}.resolved`, { outcome, reroll, appliedMessageId });
}
function processFloorSaveMessage(message) {
  if (!handlesHazards()) return;
  const state = message.flags?.[MODULE_ID]?.[FLOOR_SAVE_FLAG];
  if (state) {
    const tokenId = state.tokenUuid.split(".").at(-1);
    const variants = message.flags?.["pf2e-toolbelt"]?.targetHelper?.saveVariants ?? {};
    for (const variant of Object.values(variants)) {
      const result = variant?.saves?.[tokenId];
      if (result?.success !== undefined && result?.success !== null) return queueHazard(() => resolveSpellFloorSave(message, result.success, Boolean(result.rerolled)));
    }
    return;
  }
  const context = message.flags?.pf2e?.context;
  const cycle = context?.options?.find(option => option.startsWith(FLOOR_SAVE_OPTION))?.slice(FLOOR_SAVE_OPTION.length);
  if (!cycle || context.type !== "saving-throw") return;
  const card = [...game.messages].find(entry => entry.flags?.[MODULE_ID]?.[FLOOR_SAVE_FLAG]?.cycle === cycle);
  const token = card && fromUuidSync(card.flags[MODULE_ID][FLOOR_SAVE_FLAG].tokenUuid);
  if (!token || token.actor?.id !== message.speaker?.actor) return;
  return queueHazard(() => resolveSpellFloorSave(card, context.outcome, Boolean(context.isReroll)));
}
Hooks.on("createChatMessage", processFloorSaveMessage);
Hooks.on("updateChatMessage", processFloorSaveMessage);
