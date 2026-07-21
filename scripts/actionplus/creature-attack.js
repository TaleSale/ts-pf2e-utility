import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import {
  getItemActionPlusOptions,
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const FEATURE_ID = "creatureAttack";
const FLAG_KEY = "creatureAttack";
const QUALITY_KEYS = ["extreme", "high", "moderate", "low"];
const CREATE_TARGET_ID = "__create__";

const STRIKE_BONUS_TABLE = {
  "-1": { low: 4, moderate: 6, high: 8, extreme: 10 },
  "0": { low: 4, moderate: 6, high: 8, extreme: 10 },
  "1": { low: 5, moderate: 7, high: 9, extreme: 11 },
  "2": { low: 7, moderate: 9, high: 11, extreme: 13 },
  "3": { low: 8, moderate: 10, high: 12, extreme: 14 },
  "4": { low: 9, moderate: 12, high: 14, extreme: 16 },
  "5": { low: 11, moderate: 13, high: 15, extreme: 17 },
  "6": { low: 12, moderate: 15, high: 17, extreme: 19 },
  "7": { low: 13, moderate: 16, high: 18, extreme: 20 },
  "8": { low: 15, moderate: 18, high: 20, extreme: 22 },
  "9": { low: 16, moderate: 19, high: 21, extreme: 23 },
  "10": { low: 17, moderate: 21, high: 23, extreme: 25 },
  "11": { low: 19, moderate: 22, high: 24, extreme: 27 },
  "12": { low: 20, moderate: 24, high: 26, extreme: 28 },
  "13": { low: 21, moderate: 25, high: 27, extreme: 29 },
  "14": { low: 23, moderate: 27, high: 29, extreme: 31 },
  "15": { low: 24, moderate: 28, high: 30, extreme: 32 },
  "16": { low: 25, moderate: 30, high: 32, extreme: 34 },
  "17": { low: 27, moderate: 31, high: 33, extreme: 35 },
  "18": { low: 28, moderate: 33, high: 35, extreme: 37 },
  "19": { low: 29, moderate: 34, high: 36, extreme: 38 },
  "20": { low: 31, moderate: 36, high: 38, extreme: 40 },
  "21": { low: 32, moderate: 37, high: 39, extreme: 41 },
  "22": { low: 33, moderate: 39, high: 41, extreme: 43 },
  "23": { low: 35, moderate: 40, high: 42, extreme: 44 },
  "24": { low: 36, moderate: 42, high: 44, extreme: 46 },
};

const STRIKE_DAMAGE_TABLE = {
  "-1": { low: "1d4", moderate: "1d4", high: "1d4+1", extreme: "1d6+1" },
  "0": { low: "1d4+1", moderate: "1d4+2", high: "1d6+2", extreme: "1d6+3" },
  "1": { low: "1d4+2", moderate: "1d6+2", high: "1d6+3", extreme: "1d8+4" },
  "2": { low: "1d6+3", moderate: "1d8+4", high: "1d10+4", extreme: "1d12+4" },
  "3": { low: "1d6+5", moderate: "1d8+6", high: "1d10+6", extreme: "1d12+8" },
  "4": { low: "2d4+4", moderate: "2d6+5", high: "2d8+5", extreme: "2d10+7" },
  "5": { low: "2d4+6", moderate: "2d6+6", high: "2d8+7", extreme: "2d12+7" },
  "6": { low: "2d4+7", moderate: "2d6+8", high: "2d8+9", extreme: "2d12+10" },
  "7": { low: "2d6+6", moderate: "2d8+8", high: "2d10+9", extreme: "2d12+12" },
  "8": { low: "2d6+8", moderate: "2d8+9", high: "2d10+11", extreme: "2d12+15" },
  "9": { low: "2d6+9", moderate: "2d8+11", high: "2d10+13", extreme: "2d12+17" },
  "10": { low: "2d6+10", moderate: "2d10+11", high: "2d12+13", extreme: "2d12+20" },
  "11": { low: "2d8+10", moderate: "2d10+12", high: "2d12+15", extreme: "2d12+22" },
  "12": { low: "3d6+10", moderate: "3d8+12", high: "3d10+14", extreme: "3d12+19" },
  "13": { low: "3d6+11", moderate: "3d8+14", high: "3d10+16", extreme: "3d12+21" },
  "14": { low: "3d6+13", moderate: "3d8+15", high: "3d10+18", extreme: "3d12+24" },
  "15": { low: "3d6+14", moderate: "3d10+14", high: "3d12+17", extreme: "3d12+26" },
  "16": { low: "3d6+15", moderate: "3d10+15", high: "3d12+18", extreme: "3d12+29" },
  "17": { low: "3d6+16", moderate: "3d10+16", high: "3d12+19", extreme: "3d12+31" },
  "18": { low: "3d6+17", moderate: "3d10+17", high: "3d12+20", extreme: "3d12+34" },
  "19": { low: "4d6+14", moderate: "4d8+17", high: "4d10+20", extreme: "4d12+29" },
  "20": { low: "4d6+15", moderate: "4d8+19", high: "4d10+22", extreme: "4d12+32" },
  "21": { low: "4d6+17", moderate: "4d8+20", high: "4d10+24", extreme: "4d12+34" },
  "22": { low: "4d6+18", moderate: "4d8+22", high: "4d10+26", extreme: "4d12+37" },
  "23": { low: "4d6+19", moderate: "4d10+20", high: "4d12+24", extreme: "4d12+39" },
  "24": { low: "4d6+21", moderate: "4d10+22", high: "4d12+26", extreme: "4d12+42" },
};

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function localizeWithFallback(key, fallback) {
  const localized = game.i18n.localize(key);
  return localized === key ? fallback : localized;
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.CreatureAttack.FeatureLabel`,
  allowMultiple: true,
  render: renderCreatureAttackControls,
  activateListeners: activateCreatureAttackListeners,
  cleanup: cleanupCreatureAttack,
});

Hooks.on("updateActor", (actor, changed) => {
  if (!foundry.utils.hasProperty(changed, "system.details.level.value")
    && !foundry.utils.hasProperty(changed, "level")) {
    return;
  }

  void refreshActorCreatureAttacks(actor);
});

Hooks.on("createItem", (item) => {
  if (item.actor && isSupportedActionPlusItem(item)) void refreshCreatureAttack(item, null, null, { allowCreate: true });
});

Hooks.on("updateItem", (item, changed) => {
  if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) return;
  if (item.actor && isSupportedActionPlusItem(item)) void refreshCreatureAttack(item);
});

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function getDefaultConfig() {
  return {
    targetId: "",
    createName: "Strike",
    createSlug: "",
    createDescription: "",
    weaponType: "melee",
    rangeMode: "increment",
    rangeIncrement: 10,
    maxRange: 60,
    damageType: "bludgeoning",
    damageRows: [],
    traits: [],
    attackEffects: [],
    customActions: [],
    useAttackQuality: true,
    attackQuality: "moderate",
    attackValue: 0,
    useDamageQuality: true,
    damageQuality: "moderate",
    damageFormula: "1d4",
  };
}

function normalizeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function normalizeRangeDistance(value, fallback) {
  const distance = normalizeInteger(value, fallback);
  return Math.min(500, Math.max(5, Math.round(distance / 5) * 5));
}

function normalizeQuality(value, fallback = "moderate") {
  const quality = String(value ?? "").trim();
  return QUALITY_KEYS.includes(quality) ? quality : fallback;
}

function normalizeSlugList(value) {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(",");
  return Array.from(new Set(
    entries
      .map((entry) => String(entry ?? "").trim().toLowerCase())
      .filter(Boolean),
  ));
}

function getDefaultDamageRow() {
  return {
    id: foundry.utils.randomID(),
    damageType: "bludgeoning",
    useDamageQuality: true,
    damageQuality: "moderate",
    damageFormula: "1d4",
  };
}

function normalizeDamageRow(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...getDefaultDamageRow(),
    ...source,
    id: String(source.id ?? "").trim() || foundry.utils.randomID(),
    damageType: String(source.damageType ?? "").trim() || "bludgeoning",
    useDamageQuality: Boolean(source.useDamageQuality ?? true),
    damageQuality: normalizeQuality(source.damageQuality),
    damageFormula: String(source.damageFormula ?? "").trim() || "1d4",
  };
}

function normalizeDamageRows(source) {
  let rawRows = source.damageRows;
  if (typeof rawRows === "string") {
    try {
      rawRows = JSON.parse(rawRows);
    } catch {
      rawRows = [];
    }
  }

  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (rows.length) return rows.map((row) => normalizeDamageRow(row));

  return [normalizeDamageRow({
    damageType: source.damageType,
    useDamageQuality: source.useDamageQuality,
    damageQuality: source.damageQuality,
    damageFormula: source.damageFormula,
  })];
}

function normalizeCustomActions(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch {
      entries = [];
    }
  }

  const normalized = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      uuid: String(entry?.uuid ?? "").trim(),
      slug: String(entry?.slug ?? "").trim().toLowerCase(),
      name: String(entry?.name ?? "").trim(),
    }))
    .filter((entry) => entry.uuid && (entry.slug || entry.name));

  return Array.from(new Map(normalized.map((entry) => [entry.uuid || entry.slug || entry.name, entry])).values());
}

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const config = {
    ...getDefaultConfig(),
    ...source,
  };

  config.targetId = String(config.targetId ?? "").trim();
  config.createName = String(config.createName ?? "").trim() || getDefaultConfig().createName;
  config.createSlug = String(config.createSlug ?? "").trim();
  config.createDescription = String(config.createDescription ?? "").trim();
  config.weaponType = ["melee", "ranged"].includes(String(config.weaponType ?? "").trim()) ? config.weaponType : "melee";
  config.rangeMode = ["increment", "max"].includes(String(config.rangeMode ?? "").trim()) ? config.rangeMode : "increment";
  config.rangeIncrement = normalizeRangeDistance(config.rangeIncrement, 10);
  config.maxRange = normalizeRangeDistance(config.maxRange, 60);
  config.damageType = String(config.damageType ?? "").trim() || "bludgeoning";
  config.damageRows = normalizeDamageRows(config);
  config.traits = normalizeSlugList(config.traits);
  config.attackEffects = normalizeSlugList(config.attackEffects);
  config.customActions = normalizeCustomActions(config.customActions);
  config.useAttackQuality = Boolean(config.useAttackQuality);
  config.attackQuality = normalizeQuality(config.attackQuality);
  config.attackValue = normalizeInteger(config.attackValue, 0);
  config.useDamageQuality = Boolean(config.useDamageQuality);
  config.damageQuality = normalizeQuality(config.damageQuality);
  config.damageFormula = String(config.damageFormula ?? "").trim() || "1d4";

  return config;
}

function normalizeConfigCollection(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeConfig(entry));
  if (value && typeof value === "object") return [normalizeConfig(value)];
  return [];
}

function getCreatureAttackCount(item) {
  return getItemActionPlusOptions(item).filter((option) => option === FEATURE_ID).length;
}

function getCreatureAttackConfigs(item) {
  const count = getCreatureAttackCount(item);
  if (count <= 0) return [];

  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, FLAG_KEY));
  while (configs.length < count) {
    configs.push(normalizeConfig(null));
  }

  return configs.slice(0, count);
}

async function setCreatureAttackConfig(item, config, occurrenceIndex = 0) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, FLAG_KEY));
  while (configs.length <= occurrenceIndex) {
    configs.push(normalizeConfig(null));
  }

  configs[occurrenceIndex] = normalizeConfig(config);
  await item.setFlag(MODULE_ID, FLAG_KEY, configs);
}

function getActorLevel(actor) {
  const level = actor?.system?.details?.level?.value ?? actor?.system?.details?.level ?? actor?.level ?? actor?.system?.level?.value;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function getQualityValue(table, actor, quality) {
  const level = getActorLevel(actor);
  if (level === null) return null;
  return table[String(level)]?.[quality] ?? null;
}

function getAttackItems(actor) {
  return (actor?.items?.contents ?? actor?.items ?? []).filter((item) => item?.type === "melee" || item?.type === "weapon");
}

function findTargetAttack(item, config) {
  if (config.targetId === CREATE_TARGET_ID) return null;
  const actor = item?.actor;
  if (!actor) return null;
  const attacks = getAttackItems(actor);
  return attacks.find((attack) => attack.id === config.targetId)
    ?? attacks.find((attack) => attack.name === config.createName)
    ?? attacks[0]
    ?? null;
}

function getDamageTypeChoices() {
  const entries = Object.entries(CONFIG.PF2E?.damageTypes ?? {});
  return entries.length ? entries : [
    ["bludgeoning", "Bludgeoning"],
    ["piercing", "Piercing"],
    ["slashing", "Slashing"],
  ];
}

function getTraitChoices() {
  const sources = [
    CONFIG.PF2E?.npcAttackTraits,
    CONFIG.PF2E?.weaponTraits,
    CONFIG.PF2E?.actionTraits,
    CONFIG.PF2E?.traits,
  ];
  const choices = new Map();
  for (const source of sources) {
    for (const [slug, label] of Object.entries(source ?? {})) {
      if (!slug || choices.has(slug)) continue;
      choices.set(slug, label);
    }
  }
  return Array.from(choices.entries())
    .sort((left, right) => game.i18n.localize(String(left[1])).localeCompare(game.i18n.localize(String(right[1])), game.i18n.lang || "en", { sensitivity: "base" }));
}

function getQualityChoices() {
  return [
    ["extreme", localize("ActionPlus.CreatureAttack.Qualities.Extreme")],
    ["high", localize("ActionPlus.CreatureAttack.Qualities.High")],
    ["moderate", localize("ActionPlus.CreatureAttack.Qualities.Moderate")],
    ["low", localize("ActionPlus.CreatureAttack.Qualities.Low")],
  ];
}

function renderSelectOptions(entries, selectedValue, { localizeLabels = false } = {}) {
  return entries.map(([value, label]) => {
    const optionLabel = localizeLabels ? game.i18n.localize(String(label ?? value)) : String(label ?? value);
    return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
  }).join("");
}

function renderSelectedSlugList(values, choices, removeClass, emptyKey) {
  if (!values.length) {
    return `<p class="notes" style="margin: 6px 0 0 0;">${escapeHtml(localize(emptyKey))}</p>`;
  }

  const labels = new Map(choices);
  return `
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      ${values.map((value) => `
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="flex: 1 1 auto; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.08);">
            ${escapeHtml(game.i18n.localize(String(labels.get(value) ?? value)))}
          </div>
          <button
            type="button"
            class="${removeClass}"
            data-value="${escapeHtml(value)}"
            style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
          >
            <i class="fas fa-minus"></i>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDamageRows(config) {
  const qualityChoices = getQualityChoices();
  const damageTypeChoices = getDamageTypeChoices();

  return config.damageRows.map((row, index) => `
    <div class="ts-creature-attack-damage-row" data-index="${index}" style="display: grid; grid-template-columns: auto minmax(95px, 1fr) minmax(95px, 1fr) minmax(90px, 1fr) 24px; gap: 6px; align-items: center; margin-bottom: 6px;">
      <label style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
        <input type="checkbox" class="ts-creature-attack-damage-input" data-index="${index}" data-field="useDamageQuality" ${row.useDamageQuality ? "checked" : ""} data-tooltip="${escapeHtml(localize("ActionPlus.CreatureAttack.QualityLabel"))}">
      </label>
      <select class="ts-creature-attack-damage-input" data-index="${index}" data-field="damageQuality" ${row.useDamageQuality ? "" : "disabled"}>
        ${renderSelectOptions(qualityChoices, row.damageQuality)}
      </select>
      <input type="text" class="ts-creature-attack-damage-input" data-index="${index}" data-field="damageFormula" value="${escapeHtml(row.damageFormula)}" ${row.useDamageQuality ? "disabled" : ""}>
      <select class="ts-creature-attack-damage-input" data-index="${index}" data-field="damageType">
        ${renderSelectOptions(damageTypeChoices, row.damageType, { localizeLabels: true })}
      </select>
      <button
        type="button"
        class="ts-creature-attack-remove-damage"
        data-index="${index}"
        ${config.damageRows.length <= 1 ? "disabled" : ""}
        style="width: 24px; min-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
      >
        <i class="fas fa-minus"></i>
      </button>
    </div>
  `).join("");
}

function renderTraitCheckboxes(selectedTraits, traitChoices) {
  const selected = new Set(normalizeSlugList(selectedTraits));
  const searchPlaceholder = localizeWithFallback("PF2E.Search", "Search");
  return `
    <div class="ts-creature-attack-trait-picker" style="display: flex; flex-direction: column; gap: 6px;">
      <input type="search" class="ts-creature-attack-trait-search" placeholder="${escapeHtml(searchPlaceholder)}" style="width: 100%;">
      <div class="ts-creature-attack-trait-list" style="max-height: 460px; overflow-y: auto; border: 1px solid var(--color-border-light-tertiary); background: rgba(0, 0, 0, 0.04);">
        ${traitChoices.map(([value, label]) => {
          const localizedLabel = game.i18n.localize(String(label ?? value));
          return `
            <label class="ts-creature-attack-trait-row" data-search="${escapeHtml(localizedLabel.toLocaleLowerCase(game.i18n.lang || undefined))}" style="display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 6px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); cursor: pointer;">
              <input
                type="checkbox"
                name="trait"
                value="${escapeHtml(value)}"
                ${selected.has(value) ? "checked" : ""}
                style="flex: 0 0 auto;"
              >
              <span style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(localizedLabel)}</span>
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTraitSummary(config, traitChoices) {
  const labels = new Map(traitChoices.map(([value, label]) => [value, game.i18n.localize(String(label ?? value))]));
  if (!config.traits.length) {
    return `<p class="notes" style="margin: 4px 0 0;">${escapeHtml(localize("ActionPlus.CreatureAttack.EmptyTraitsHint"))}</p>`;
  }

  return `
    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
      ${config.traits.map((trait) => `
        <span class="tag" style="margin: 0;">${escapeHtml(labels.get(trait) ?? trait)}</span>
      `).join("")}
    </div>
  `;
}

function openTraitSelectionDialog(selectedTraits = []) {
  const traitChoices = getTraitChoices();
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    new Dialog({
      title: localize("ActionPlus.CreatureAttack.TraitsDialogTitle"),
      content: `
        <form>
          ${renderTraitCheckboxes(selectedTraits, traitChoices)}
        </form>
      `,
      buttons: {
        update: {
          icon: '<i class="fas fa-save"></i>',
          label: localize("ActionPlus.CreatureAttack.UpdateItemButton"),
          callback: (html) => {
            const root = getHtmlElement(html);
            const traits = Array.from(root?.querySelectorAll('input[name="trait"]:checked') ?? [])
              .map((input) => input.value);
            finish(normalizeSlugList(traits));
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localizeWithFallback("Cancel", "Cancel"),
          callback: () => finish(null),
        },
      },
      default: "update",
      render: (html) => {
        const root = getHtmlElement(html);
        root?.querySelector(".ts-creature-attack-trait-search")?.addEventListener("input", (event) => {
          const term = String(event.currentTarget.value ?? "").trim().toLocaleLowerCase(game.i18n.lang || undefined);
          for (const row of root.querySelectorAll(".ts-creature-attack-trait-row")) {
            const haystack = String(row.dataset.search ?? "");
            row.hidden = Boolean(term) && !haystack.includes(term);
          }
        });
      },
      close: () => finish(null),
    }).render(true);
  });
}

function getItemSlug(item) {
  const directSlug = String(item?.slug ?? item?.system?.slug ?? "").trim();
  if (directSlug) return directSlug;
  return game.pf2e?.system?.sluggify?.(item?.name ?? "")
    ?? item?.name?.slugify?.()
    ?? String(item?.name ?? "").trim().toLowerCase().replaceAll(/\s+/g, "-");
}

function getCustomActionSourceFromItem(item) {
  const slug = getItemSlug(item);
  return {
    uuid: item?.uuid ?? "",
    slug,
    name: item?.name ?? slug,
  };
}

function getAttackEffectChoices(actor, customActions = []) {
  const choices = new Map(Object.entries(CONFIG.PF2E?.attackEffects ?? {}));

  for (const action of actor?.itemTypes?.action ?? []) {
    const slug = getItemSlug(action);
    if (!slug) continue;
    choices.set(slug, action.name ?? slug);
  }

  for (const action of customActions) {
    if (!action.slug) continue;
    choices.set(action.slug, action.name || action.slug);
  }

  return Array.from(choices.entries())
    .sort((left, right) => game.i18n.localize(String(left[1])).localeCompare(game.i18n.localize(String(right[1])), game.i18n.lang || "en", { sensitivity: "base" }));
}

function renderCreatureAttackControls({ item, flags, occurrenceIndex = 0 }) {
  const configs = normalizeConfigCollection(flags?.[FLAG_KEY]);
  const config = normalizeConfig(configs[occurrenceIndex] ?? null);
  const attackChoices = getAttackItems(item.actor).map((attack) => [attack.id, attack.name]);
  const selectedTargetId = config.targetId === CREATE_TARGET_ID || attackChoices.some(([id]) => id === config.targetId)
    ? config.targetId
    : "";
  const traitChoices = getTraitChoices();
  const attackEffectChoices = getAttackEffectChoices(item.actor, config.customActions);
  const addableAttackEffectChoices = attackEffectChoices.filter(([value]) => !config.attackEffects.includes(value));
  const showCreateName = selectedTargetId === CREATE_TARGET_ID;

  return `
    <div style="margin-top: 10px;">
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.TargetLabel"))}</label>
        <div class="form-fields">
          <select class="ts-creature-attack-input" data-field="targetId">
            <option value="">${escapeHtml(localize("ActionPlus.CreatureAttack.AutoTarget"))}</option>
            <option value="${CREATE_TARGET_ID}" ${selectedTargetId === CREATE_TARGET_ID ? "selected" : ""}>${escapeHtml(localize("ActionPlus.CreatureAttack.CreateOption"))}</option>
            ${renderSelectOptions(attackChoices, selectedTargetId)}
          </select>
        </div>
      </div>
      <div class="form-group" style="${showCreateName ? "" : "display: none;"}">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.NameLabel"))}</label>
        <div class="form-fields">
          <input type="text" class="ts-creature-attack-input" data-field="createName" value="${escapeHtml(config.createName)}">
        </div>
      </div>
      <div class="form-group" style="${showCreateName ? "" : "display: none;"}">
        <label>Slug</label>
        <div class="form-fields">
          <input type="text" class="ts-creature-attack-input" data-field="createSlug" value="${escapeHtml(config.createSlug)}">
        </div>
      </div>
      <div class="form-group" style="${showCreateName ? "" : "display: none;"}">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.DescriptionLabel"))}</label>
        <div class="form-fields">
          <textarea class="ts-creature-attack-input" data-field="createDescription" rows="3" style="resize: vertical;">${escapeHtml(config.createDescription)}</textarea>
        </div>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.WeaponTypeLabel"))}</label>
        <div class="form-fields">
          <select class="ts-creature-attack-input" data-field="weaponType">
            ${renderSelectOptions([
              ["melee", localize("ActionPlus.CreatureAttack.WeaponTypes.Melee")],
              ["ranged", localize("ActionPlus.CreatureAttack.WeaponTypes.Ranged")],
            ], config.weaponType)}
          </select>
        </div>
      </div>
      <div class="form-group" style="${config.weaponType === "ranged" ? "" : "display: none;"}">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.RangeModeLabel"))}</label>
        <div class="form-fields">
          <select class="ts-creature-attack-input" data-field="rangeMode">
            ${renderSelectOptions([
              ["increment", localize("ActionPlus.CreatureAttack.RangeModes.Increment")],
              ["max", localize("ActionPlus.CreatureAttack.RangeModes.Maximum")],
            ], config.rangeMode)}
          </select>
        </div>
      </div>
      <div class="form-group" style="${config.weaponType === "ranged" && config.rangeMode === "increment" ? "" : "display: none;"}">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.RangeIncrementLabel"))}</label>
        <div class="form-fields">
          <input type="number" class="ts-creature-attack-input" data-field="rangeIncrement" value="${config.rangeIncrement}" min="5" max="500" step="5">
        </div>
      </div>
      <div class="form-group" style="${config.weaponType === "ranged" && config.rangeMode === "max" ? "" : "display: none;"}">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.MaxRangeLabel"))}</label>
        <div class="form-fields">
          <input type="number" class="ts-creature-attack-input" data-field="maxRange" value="${config.maxRange}" min="5" max="500" step="5">
        </div>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.AttackLabel"))}</label>
        <div class="form-fields" style="gap: 6px; align-items: center;">
          <label style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <input type="checkbox" class="ts-creature-attack-input" data-field="useAttackQuality" ${config.useAttackQuality ? "checked" : ""} data-tooltip="${escapeHtml(localize("ActionPlus.CreatureAttack.QualityLabel"))}">
          </label>
          <select class="ts-creature-attack-input" data-field="attackQuality" ${config.useAttackQuality ? "" : "disabled"}>
            ${renderSelectOptions(getQualityChoices(), config.attackQuality)}
          </select>
          <input type="number" class="ts-creature-attack-input" data-field="attackValue" value="${config.attackValue}" ${config.useAttackQuality ? "disabled" : ""} style="max-width: 90px;">
        </div>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.DamageLabel"))}</label>
        <div class="form-fields" style="display: block;">
          <input type="hidden" class="ts-creature-attack-input" data-field="damageRows" value="${escapeHtml(JSON.stringify(config.damageRows))}">
          ${renderDamageRows(config)}
          <button type="button" class="ts-creature-attack-add-damage" style="width: auto; min-width: 32px; padding: 2px 8px;">
            <i class="fas fa-plus"></i> ${escapeHtml(localize("ActionPlus.CreatureAttack.AddDamageButton"))}
          </button>
        </div>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.TraitsLabel"))}</label>
        <div class="form-fields" style="display: block;">
          <input type="hidden" class="ts-creature-attack-input" data-field="traits" value="${escapeHtml(config.traits.join(","))}">
          <button type="button" class="ts-creature-attack-open-traits" style="width: auto; min-width: 32px; padding: 2px 8px;">
            <i class="fas fa-tags"></i> ${escapeHtml(localize("ActionPlus.CreatureAttack.TraitsButton"))}
          </button>
          ${renderTraitSummary(config, traitChoices)}
        </div>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.CreatureAttack.AttackEffectsLabel"))}</label>
        <div class="form-fields" style="display: block;">
          <select class="ts-creature-attack-add-effect" style="width: 100%;">
            <option value="">${escapeHtml(localize("ActionPlus.CreatureAttack.AddEffectPlaceholder"))}</option>
            ${renderSelectOptions(addableAttackEffectChoices, "", { localizeLabels: true })}
          </select>
          <input type="hidden" class="ts-creature-attack-input" data-field="attackEffects" value="${escapeHtml(config.attackEffects.join(","))}">
          <input type="hidden" class="ts-creature-attack-input" data-field="customActions" value="${escapeHtml(JSON.stringify(config.customActions))}">
          ${renderSelectedSlugList(config.attackEffects, attackEffectChoices, "ts-creature-attack-remove-effect", "ActionPlus.CreatureAttack.EmptyEffectsHint")}
          <div
            class="ts-creature-attack-effect-drop"
            style="margin-top: 6px; min-height: 42px; border: 2px dashed var(--color-border-light-tertiary); border-radius: 5px; padding: 8px; text-align: center; background: rgba(0,0,0,0.04);"
          >
            ${escapeHtml(localize("ActionPlus.CreatureAttack.DropEffectHint"))}
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 6px;">
        <button type="button" class="ts-creature-attack-apply" style="flex: 0 0 auto; width: auto; padding: 2px 8px;">
          <i class="fas fa-save"></i> ${escapeHtml(localize("ActionPlus.CreatureAttack.ApplyButton"))}
        </button>
      </div>
    </div>
  `;
}

function readConfigFromPanel(panel) {
  const config = getDefaultConfig();
  for (const control of panel.querySelectorAll(".ts-creature-attack-input")) {
    const field = String(control.dataset.field ?? "");
    if (!field) continue;

    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      config[field] = control.checked;
    } else {
      config[field] = control.value;
    }
  }
  return normalizeConfig(config);
}

function writeListField(panel, field, values) {
  const input = panel.querySelector(`.ts-creature-attack-input[data-field="${field}"]`);
  if (input instanceof HTMLInputElement) {
    input.value = normalizeSlugList(values).join(",");
  }
}

function writeJsonField(panel, field, value) {
  const input = panel.querySelector(`.ts-creature-attack-input[data-field="${field}"]`);
  if (input instanceof HTMLInputElement) {
    input.value = JSON.stringify(value);
  }
}

function readDamageRowsFromPanel(panel) {
  const config = readConfigFromPanel(panel);
  const rows = config.damageRows.map((row) => ({ ...row }));

  for (const control of panel.querySelectorAll(".ts-creature-attack-damage-input")) {
    const index = Number(control.dataset.index);
    const field = String(control.dataset.field ?? "");
    if (!Number.isInteger(index) || !rows[index] || !field) continue;

    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      rows[index][field] = control.checked;
    } else {
      rows[index][field] = control.value;
    }
  }

  return rows.map((row) => normalizeDamageRow(row));
}

async function persistConfig(item, config, occurrenceIndex = 0, { apply = false } = {}) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, FLAG_KEY));
  const previousConfig = normalizeConfig(configs[occurrenceIndex] ?? null);
  await setCreatureAttackConfig(item, config, occurrenceIndex);
  if (apply) {
    await refreshCreatureAttack(item, previousConfig, occurrenceIndex, { allowCreate: true });
  }
}

function activateCreatureAttackListeners({ app, html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = getHtmlElement(html);
  if (!root) return;

  const panel = root.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  const savePanelState = async () => {
    await persistConfig(item, readConfigFromPanel(panel), occurrenceIndex);
  };

  const savePanelStateAndRender = async () => {
    await savePanelState();
    app?.render?.(false);
  };

  for (const control of panel.querySelectorAll(".ts-creature-attack-input")) {
    control.addEventListener("change", async () => {
      await savePanelState();
    });
  }

  panel.querySelector('.ts-creature-attack-input[data-field="weaponType"]')?.addEventListener("change", async () => {
    app?.render?.(false);
  });

  panel.querySelector('.ts-creature-attack-input[data-field="rangeIncrement"]')?.addEventListener("change", async () => {
    app?.render?.(false);
  });

  panel.querySelector('.ts-creature-attack-input[data-field="rangeMode"]')?.addEventListener("change", async () => {
    app?.render?.(false);
  });

  panel.querySelector(".ts-creature-attack-apply")?.addEventListener("click", async (event) => {
    event.preventDefault();
    await persistConfig(item, readConfigFromPanel(panel), occurrenceIndex, { apply: true });
  });

  for (const control of panel.querySelectorAll(".ts-creature-attack-damage-input")) {
    control.addEventListener("change", async () => {
      writeJsonField(panel, "damageRows", readDamageRowsFromPanel(panel));
      await savePanelStateAndRender();
    });
  }

  panel.querySelector(".ts-creature-attack-add-damage")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const rows = readDamageRowsFromPanel(panel);
    writeJsonField(panel, "damageRows", [...rows, getDefaultDamageRow()]);
    await savePanelStateAndRender();
  });

  for (const button of panel.querySelectorAll(".ts-creature-attack-remove-damage")) {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);
      if (!Number.isInteger(index)) return;
      const rows = readDamageRowsFromPanel(panel);
      if (rows.length <= 1) return;
      rows.splice(index, 1);
      writeJsonField(panel, "damageRows", rows);
      await savePanelStateAndRender();
    });
  }

  panel.querySelector(".ts-creature-attack-open-traits")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const selectedTraits = await openTraitSelectionDialog(readConfigFromPanel(panel).traits);
    if (!selectedTraits) return;
    writeListField(panel, "traits", selectedTraits);
    await savePanelStateAndRender();
  });

  panel.querySelector(".ts-creature-attack-add-effect")?.addEventListener("change", async (event) => {
    const target = event.currentTarget;
    const nextEffect = String(target.value ?? "").trim();
    if (!nextEffect) return;
    const config = readConfigFromPanel(panel);
    writeListField(panel, "attackEffects", [...config.attackEffects, nextEffect]);
    await savePanelState();
  });

  for (const button of panel.querySelectorAll(".ts-creature-attack-remove-effect")) {
    button.addEventListener("click", async () => {
      const config = readConfigFromPanel(panel);
      const value = String(button.dataset.value ?? "").trim();
      writeListField(panel, "attackEffects", config.attackEffects.filter((entry) => entry !== value));
      writeJsonField(panel, "customActions", config.customActions.filter((entry) => entry.slug !== value));
      await savePanelState();
    });
  }

  const effectDropZone = panel.querySelector(".ts-creature-attack-effect-drop");
  effectDropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  effectDropZone?.addEventListener("drop", async (event) => {
    event.preventDefault();
    const dragData = TextEditor.getDragEventData(event);
    const droppedItem = dragData?.uuid ? await fromUuid(dragData.uuid).catch(() => null) : null;
    if (!droppedItem) return;

    const slug = getItemSlug(droppedItem);
    if (!slug) return;

    const config = readConfigFromPanel(panel);
    const customAction = getCustomActionSourceFromItem(droppedItem);
    const nextConfig = normalizeConfig({
      ...config,
      attackEffects: [...config.attackEffects, slug],
      customActions: [...config.customActions, customAction],
    });
    writeListField(panel, "attackEffects", nextConfig.attackEffects);
    writeJsonField(panel, "customActions", nextConfig.customActions);
    await persistConfig(item, nextConfig, occurrenceIndex);
  });
}

function mergeSlugLists(existing, next) {
  return Array.from(new Set([...normalizeSlugList(existing), ...normalizeSlugList(next)]));
}

function shouldCreateTarget(config) {
  return config.targetId === CREATE_TARGET_ID;
}

async function ensureCreatedTarget(item, config, occurrenceIndex = 0) {
  if (!shouldCreateTarget(config)) return null;
  const target = await createCreatureAttackItem(item, config);
  if (!target) return null;
  config.targetId = target.id;
  await setCreatureAttackConfig(item, config, occurrenceIndex);
  return target;
}

function updateGeneratedSlugList(existing, previous, next) {
  const previousSet = new Set(normalizeSlugList(previous));
  const preserved = normalizeSlugList(existing).filter((value) => !previousSet.has(value));
  return mergeSlugLists(preserved, next);
}

function addAttackExtras(update, target, config, previousConfig = config) {
  if (config.traits.length || previousConfig.traits.length) {
    update["system.traits.value"] = updateGeneratedSlugList(target.system?.traits?.value, previousConfig.traits, config.traits);
  }

  if (config.attackEffects.length || previousConfig.attackEffects.length) {
    update["system.attackEffects.value"] = updateGeneratedSlugList(
      target.system?.attackEffects?.value,
      previousConfig.attackEffects,
      config.attackEffects,
    );
  }
}

function getAttackExtrasSystem(config) {
  return {
    traits: { value: config.traits },
    attackEffects: { value: config.attackEffects },
  };
}

function getDamageFormula(row, actor) {
  return row.useDamageQuality
    ? getQualityValue(STRIKE_DAMAGE_TABLE, actor, row.damageQuality) ?? row.damageFormula
    : row.damageFormula;
}

function getDamageRollKey(index) {
  return String(index);
}

function addDamageRollUpdates(update, config, actor, previousConfig = config) {
  for (let index = 0; index < previousConfig.damageRows.length; index += 1) {
    if (index >= config.damageRows.length) {
      update[`system.damageRolls.-=${getDamageRollKey(index)}`] = null;
    }
  }

  for (const [index, row] of config.damageRows.entries()) {
    const rollKey = getDamageRollKey(index);
    const formula = getDamageFormula(row, actor);
    if (!formula) continue;
    update[`system.damageRolls.${rollKey}.damage`] = String(formula);
    update[`system.damageRolls.${rollKey}.damageType`] = row.damageType;
  }
}

function buildDamageRolls(config, actor) {
  return Object.fromEntries(config.damageRows.map((row, index) => [getDamageRollKey(index), {
    damage: String(getDamageFormula(row, actor) || "1d4"),
    damageType: row.damageType,
  }]));
}

async function ensureCustomActionItems(item, config) {
  const actor = item?.actor;
  if (!actor || !config.customActions.length) return;

  for (const source of config.customActions) {
    const existing = actor.itemTypes?.action?.find((candidate) => {
      const candidateSlug = String(candidate?.slug ?? candidate?.system?.slug ?? "").trim().toLowerCase();
      return (source.slug && candidateSlug === source.slug) || (source.name && candidate.name === source.name);
    });
    if (existing) continue;

    const sourceItem = await fromUuid(source.uuid).catch(() => null);
    if (!sourceItem) continue;

    const data = sourceItem.toObject();
    delete data._id;
    data.system ??= {};
    data.system.slug = source.slug || data.system.slug || getItemSlug(sourceItem);

    await actor.createEmbeddedDocuments("Item", [data]);
  }
}

async function cleanupCreatureAttack({ item, occurrenceIndex = 0 }) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, FLAG_KEY));
  configs.splice(occurrenceIndex, 1);

  if (configs.length > 0) {
    await item.setFlag(MODULE_ID, FLAG_KEY, configs);
  } else {
    await item.unsetFlag(MODULE_ID, FLAG_KEY);
  }
}

function buildAttackUpdate(target, config, actor, sourceItem, previousConfig = config) {
  const attackValue = config.useAttackQuality
    ? getQualityValue(STRIKE_BONUS_TABLE, actor, config.attackQuality)
    : config.attackValue;

  const update = {};

  if (attackValue !== null && attackValue !== undefined) {
    if (foundry.utils.hasProperty(target._source ?? target, "system.bonus.value") || target.type === "melee") {
      update["system.bonus.value"] = Number(attackValue);
    }
    if (foundry.utils.hasProperty(target._source ?? target, "system.toHit.value") || target.type === "weapon") {
      update["system.toHit.value"] = Number(attackValue);
    }
  }

  addDamageRollUpdates(update, config, actor, previousConfig);

  if (target.type === "melee") {
    update["system.weaponType.value"] = config.weaponType;
    update["system.range"] = config.weaponType === "ranged"
      ? config.rangeMode === "max"
        ? { increment: null, max: config.maxRange }
        : { increment: config.rangeIncrement, max: null }
      : null;
  }

  addAttackExtras(update, target, config, previousConfig);

  const sourceDescription = String(sourceItem?.system?.description?.value ?? "").trim();
  const targetDescription = String(target.system?.description?.value ?? target._source?.system?.description?.value ?? "").trim();
  if (sourceDescription && targetDescription === sourceDescription) {
    update["system.description.value"] = "";
  }

  return update;
}

async function createCreatureAttackItem(item, config) {
  const actor = item?.actor;
  if (!actor) return null;

  const attackValue = config.useAttackQuality
    ? getQualityValue(STRIKE_BONUS_TABLE, actor, config.attackQuality) ?? 0
    : config.attackValue;
  const [created] = await actor.createEmbeddedDocuments("Item", [{
    name: config.createName,
    type: "melee",
    img: "systems/pf2e/icons/default-icons/melee.svg",
    system: {
      description: { value: config.createDescription },
      ...(config.createSlug ? { slug: config.createSlug } : {}),
      bonus: { value: Number(attackValue) || 0 },
      damageRolls: buildDamageRolls(config, actor),
      weaponType: { value: config.weaponType },
      range: config.weaponType === "ranged"
        ? config.rangeMode === "max"
          ? { increment: null, max: config.maxRange }
          : { increment: config.rangeIncrement, max: null }
        : null,
      ...getAttackExtrasSystem(config),
    },
  }]);

  return created ?? null;
}

async function refreshCreatureAttack(item, previousConfig = null, occurrenceIndex = null, { allowCreate = false } = {}) {
  if (!isSupportedActionPlusItem(item) || !item.actor) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID)) return;

  if (occurrenceIndex === null) {
    const configs = getCreatureAttackConfigs(item);
    for (const [index, config] of configs.entries()) {
      await refreshCreatureAttackInstance(item, config, null, index, { allowCreate });
    }
    return;
  }

  const configs = getCreatureAttackConfigs(item);
  const config = configs[occurrenceIndex];
  if (!config) return;

  await refreshCreatureAttackInstance(item, config, previousConfig, occurrenceIndex, { allowCreate });
}

async function refreshCreatureAttackInstance(item, config, previousConfig = null, occurrenceIndex = 0, { allowCreate = false } = {}) {
  await ensureCustomActionItems(item, config);
  if (!allowCreate && shouldCreateTarget(config)) return;

  let target = allowCreate
    ? await ensureCreatedTarget(item, config, occurrenceIndex) ?? findTargetAttack(item, config)
    : findTargetAttack(item, config);

  if (!target) {
    if (!allowCreate) return;
    target = await createCreatureAttackItem(item, config);
    if (!target) return;
    config.targetId = target.id;
    await setCreatureAttackConfig(item, config, occurrenceIndex);
  }

  const update = buildAttackUpdate(target, config, item.actor, item, previousConfig ? normalizeConfig(previousConfig) : config);
  if (!Object.keys(update).length) return;

  await target.update(update);
}

async function refreshActorCreatureAttacks(actor) {
  if (!actor?.itemTypes?.action?.length) return;

  for (const item of actor.itemTypes.action) {
    await refreshCreatureAttack(item);
  }
}
