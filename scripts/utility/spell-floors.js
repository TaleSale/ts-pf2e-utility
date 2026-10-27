import { MODULE_ID } from "../core.js";
import { registerActionPlusFeature, getItemActionPlusOptions } from "../actionplus/actionplus.js";

export const SPELL_FLOOR_FLAG = "spellFloor";
const STYLES = {
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
  return STYLES[key]?.[0] ?? Object.values(STYLES).find(([style]) => style === key)?.[0] ?? null;
}
export function spellFloorBehaviors(style) {
  if (style === "weather-darkness" || style === "weather-deep-darkness") return [{
    name: "", type: "adjustDarknessLevel", disabled: false,
    system: { mode: 0, modifier: style === "weather-darkness" ? 0.85 : 1 },
  }];
  if (style?.startsWith("forest-") || style === "flowering-shrubs-dense" || style === "weather-snow") return [{
    name: "", type: "modifyMovementCost", disabled: false,
    system: { difficulties: { walk: 2, travel: 2 } },
  }];
  return [];
}

// Region geometry remains authoritative: nothing is copied into Scene floor flags.
export function regionFloorOverlays(scene, level, nativeLevelId) {
  return [...(scene?.regions ?? [])].flatMap((region) => {
    if (region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.placement) return [];
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
    if (normalizeSpellFloor(region.flags?.[MODULE_ID]?.[SPELL_FLOOR_FLAG]?.style) !== "weather-fog") return false;
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
    return `<label><input type="checkbox" data-spell-floor-enabled ${config.enabled !== false ? "checked" : ""}> ${label("Полы", "Floors")}</label>
      <select data-spell-floor-style>${Object.entries(STYLES).map(([key, [style, ru, en]]) => `<option value="${key}" ${normalizeSpellFloor(config.style ?? "mist") === style ? "selected" : ""}>${label(ru, en)}</option>`).join("")}</select>
      <label>${label("Высота области (футы; пусто — высота региона)", "Area height (feet; blank uses region height)")}<input type="number" min="0" step="any" data-spell-floor-height value="${Number.isFinite(config.height) ? config.height : ""}"></label>`;
  },
  activateListeners: ({ html, item }) => {
    const panel = html.querySelector('[data-feature-id="floors"]');
    for (const input of panel?.querySelectorAll("input, select") ?? []) input.addEventListener("change", async () => {
      const height = panel.querySelector("[data-spell-floor-height]").value;
      await item.setFlag(MODULE_ID, SPELL_FLOOR_FLAG, {
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
  const update = {
    [`flags.${MODULE_ID}.${SPELL_FLOOR_FLAG}`]: { style, placement: true },
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
  data.behaviors = spellFloorBehaviors(config.style);
  data.flags = {
    [MODULE_ID]: { [SPELL_FLOOR_FLAG]: { style: config.style, persistent: true, sourceRegionId: region.id } },
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
