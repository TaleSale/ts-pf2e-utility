import { I18N_PREFIX, MODULE_ID } from "../core.js";
import {
  getPendingActionPlusOptions,
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const FEATURE_ID = "damageAdjustments";
const SOURCE_ID = "damage-adjustments";
const FLAG_KEY = "damageAdjustments";
const RULE_SLUG_PREFIX = "tsu-da";

const ADJUSTMENT_TYPES = Object.freeze({
  weakness: "Weakness",
  resistance: "Resistance",
  immunity: "Immunity",
});

const VALUE_MODES = Object.freeze({
  flat: "flat",
  levelDiv: "levelDiv",
  level: "level",
  levelTimes: "levelTimes",
  levelPlus: "levelPlus",
  levelMinus: "levelMinus",
});

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.DamageAdjustments.FeatureLabel`,
  allowMultiple: true,
  render: renderDamageAdjustmentControls,
  activateListeners: activateDamageAdjustmentListeners,
  cleanup: cleanupDamageAdjustments,
});

Hooks.on("preUpdateItem", (item, changed) => {
  applyDamageAdjustmentRuleSyncToPendingUpdate(item, changed);
});

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function getDefaultAdjustment() {
  return {
    instanceId: "",
    adjustmentType: "",
    types: [],
    valueMode: VALUE_MODES.flat,
    flatValue: 0,
    modifier: 0,
  };
}

function generateInstanceId() {
  return foundry.utils.randomID();
}

function normalizeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function normalizeAdjustment(value) {
  const source = value;
  const normalized = {
    ...getDefaultAdjustment(),
    ...(source && typeof source === "object" ? source : {}),
  };

  normalized.adjustmentType = Object.values(ADJUSTMENT_TYPES).includes(normalized.adjustmentType)
    ? normalized.adjustmentType
    : "";
  normalized.instanceId = String(normalized.instanceId ?? "").trim() || generateInstanceId();
  normalized.types = Array.from(new Set(
    (Array.isArray(normalized.types) ? normalized.types : [normalized.types])
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  ));
  const originalValueMode = String(normalized.valueMode ?? "").trim();
  normalized.valueMode = normalizeValueMode(originalValueMode);
  normalized.flatValue = normalizeInteger(normalized.flatValue, 0);
  normalized.modifier = normalizeModifier(
    normalized.valueMode,
    getLegacyAwareModifier(originalValueMode, normalized.modifier),
  );

  return normalized;
}

function getLegacyAwareModifier(originalValueMode, modifier) {
  switch (originalValueMode) {
    case "levelDiv3":
      return 3;
    case "levelDiv2":
      return 2;
    case "levelTimes2":
      return 2;
    default:
      return modifier;
  }
}

function normalizeValueMode(value) {
  const mode = String(value ?? "").trim();
  switch (mode) {
    case "levelDiv3":
      return VALUE_MODES.levelDiv;
    case "levelDiv2":
      return VALUE_MODES.levelDiv;
    case "levelTimes2":
      return VALUE_MODES.levelTimes;
    default:
      return Object.values(VALUE_MODES).includes(mode) ? mode : VALUE_MODES.flat;
  }
}

function normalizeModifier(valueMode, value) {
  const numeric = Math.max(0, normalizeInteger(value, 0));

  switch (valueMode) {
    case VALUE_MODES.levelDiv:
      return numeric > 0 ? numeric : 2;
    case VALUE_MODES.levelTimes:
      return numeric > 0 ? numeric : 2;
    case VALUE_MODES.levelPlus:
    case VALUE_MODES.levelMinus:
      return numeric;
    default:
      return numeric;
  }
}

function normalizeAdjustmentCollection(value) {
  const entries = Array.isArray(value) ? value : [];
  return entries.map((entry) => normalizeAdjustment(entry));
}

function getPendingDamageAdjustmentCount(item, changed) {
  return getPendingActionPlusOptions(item, changed).filter((option) => option === FEATURE_ID).length;
}

function getPendingDamageAdjustmentCollection(item, changed) {
  const adjustments = normalizeAdjustmentCollection(
    foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`)
      ?? item.getFlag(MODULE_ID, FLAG_KEY)
      ?? [],
  );

  return adjustments.slice(0, getPendingDamageAdjustmentCount(item, changed));
}

function getAdjustmentTypeChoices() {
  const localizedTypes = new Map();
  const typeSources = [
    CONFIG.PF2E?.weaknessTypes ?? {},
    CONFIG.PF2E?.resistanceTypes ?? {},
    CONFIG.PF2E?.immunityTypes ?? {},
    CONFIG.PF2E?.damageTypes ?? {},
    CONFIG.PF2E?.materialDamageEffects ?? {},
  ];

  for (const source of typeSources) {
    for (const [slug, label] of Object.entries(source)) {
      if (!slug) continue;
      const localizedLabel = game.i18n.localize(String(label ?? slug));
      localizedTypes.set(slug, localizedLabel && localizedLabel !== String(label) ? localizedLabel : String(label ?? slug));
    }
  }

  return Array.from(localizedTypes.entries())
    .sort((left, right) => left[1].localeCompare(right[1], game.i18n.lang || "en", { sensitivity: "base" }));
}

function buildValueExpression(adjustment) {
  switch (adjustment.valueMode) {
    case VALUE_MODES.levelDiv:
      return `floor(@actor.level / ${Math.max(1, adjustment.modifier || 2)})`;
    case VALUE_MODES.level:
      return "@actor.level";
    case VALUE_MODES.levelTimes:
      return `(@actor.level * ${Math.max(1, adjustment.modifier || 2)})`;
    case VALUE_MODES.levelPlus:
      return adjustment.modifier > 0 ? `(@actor.level + ${adjustment.modifier})` : "@actor.level";
    case VALUE_MODES.levelMinus:
      return adjustment.modifier > 0 ? `(@actor.level - ${adjustment.modifier})` : "@actor.level";
    case VALUE_MODES.flat:
    default:
      return adjustment.flatValue;
  }
}

function isConfigured(adjustment) {
  return Boolean(adjustment.adjustmentType) && adjustment.types.length > 0;
}

function buildRulesFromAdjustment(adjustment) {
  if (!isConfigured(adjustment)) return [];

  const value = adjustment.adjustmentType === ADJUSTMENT_TYPES.immunity
    ? null
    : buildValueExpression(adjustment);

  return adjustment.types.map((type, index) => {
    const rule = {
      key: adjustment.adjustmentType,
      type,
      slug: `${RULE_SLUG_PREFIX}-${adjustment.instanceId}-${index}`,
    };

    if (value !== null) {
      rule.value = value;
    }

    return rule;
  });
}

function buildRulesFromAdjustments(adjustments) {
  return normalizeAdjustmentCollection(adjustments).flatMap((adjustment) => buildRulesFromAdjustment(adjustment));
}

function areRulesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectAdjustmentInstanceIds(adjustments) {
  return new Set(
    normalizeAdjustmentCollection(adjustments)
      .map((adjustment) => String(adjustment.instanceId ?? "").trim())
      .filter(Boolean),
  );
}

function removeGeneratedDamageAdjustmentRules(existingRules, previousAdjustments) {
  const removableInstanceIds = collectAdjustmentInstanceIds(previousAdjustments);
  if (!removableInstanceIds.size) return foundry.utils.deepClone(existingRules);

  return foundry.utils.deepClone(existingRules).filter((rule) => {
    const slug = String(rule?.slug ?? "").trim();
    if (!slug.startsWith(`${RULE_SLUG_PREFIX}-`)) return true;

    const instanceId = slug.slice(RULE_SLUG_PREFIX.length + 1).split("-")[0] ?? "";
    return instanceId ? !removableInstanceIds.has(instanceId) : false;
  });
}

function buildUpdatedDamageAdjustmentRules(existingRules, previousAdjustments, nextAdjustments) {
  const filteredRules = removeGeneratedDamageAdjustmentRules(existingRules, previousAdjustments);
  const generatedRules = buildRulesFromAdjustments(nextAdjustments);
  const rules = [...filteredRules, ...generatedRules];

  return {
    changed: !areRulesEqual(existingRules, rules),
    rules,
    generatedRules,
  };
}

function renderSelectedTypes(adjustment, typeChoices) {
  if (!adjustment.types.length) {
    return `<p class="notes" style="margin: 6px 0 0 0;">${localize("ActionPlus.DamageAdjustments.EmptyTypesHint")}</p>`;
  }

  const labels = new Map(typeChoices);
  return `
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      ${adjustment.types.map((type) => `
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="flex: 1 1 auto; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.08);">
            ${foundry.utils.escapeHTML(labels.get(type) ?? type)}
          </div>
          <button
            type="button"
            class="ts-damage-adjustment-remove-type"
            data-type="${foundry.utils.escapeHTML(type)}"
            style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
          >
            <i class="fas fa-minus"></i>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDamageAdjustmentControls({ flags, occurrenceIndex = 0 }) {
  const adjustments = normalizeAdjustmentCollection(flags?.[FLAG_KEY]);
  const adjustment = normalizeAdjustment(adjustments[occurrenceIndex] ?? null);
  const typeChoices = getAdjustmentTypeChoices();
  const adjustmentChoices = [
    ["", localize("ActionPlus.Options.Empty")],
    [ADJUSTMENT_TYPES.weakness, localize("ActionPlus.DamageAdjustments.AdjustmentTypes.Weakness")],
    [ADJUSTMENT_TYPES.resistance, localize("ActionPlus.DamageAdjustments.AdjustmentTypes.Resistance")],
    [ADJUSTMENT_TYPES.immunity, localize("ActionPlus.DamageAdjustments.AdjustmentTypes.Immunity")],
  ];
  const valueModeChoices = [
    [VALUE_MODES.flat, localize("ActionPlus.DamageAdjustments.ValueModes.Flat")],
    [VALUE_MODES.levelDiv, localize("ActionPlus.DamageAdjustments.ValueModes.LevelDiv")],
    [VALUE_MODES.level, localize("ActionPlus.DamageAdjustments.ValueModes.Level")],
    [VALUE_MODES.levelTimes, localize("ActionPlus.DamageAdjustments.ValueModes.LevelTimes")],
    [VALUE_MODES.levelPlus, localize("ActionPlus.DamageAdjustments.ValueModes.LevelPlus")],
    [VALUE_MODES.levelMinus, localize("ActionPlus.DamageAdjustments.ValueModes.LevelMinus")],
  ];
  const valueDisabled = !adjustment.adjustmentType || adjustment.adjustmentType === ADJUSTMENT_TYPES.immunity;
  const modifierLabel = adjustment.valueMode === VALUE_MODES.flat
    ? localize("ActionPlus.DamageAdjustments.FlatValueLabel")
    : localize("ActionPlus.DamageAdjustments.ModifierLabel");
  const numericValue = adjustment.valueMode === VALUE_MODES.flat ? adjustment.flatValue : adjustment.modifier;
  const numericDisabled = valueDisabled || ![
    VALUE_MODES.flat,
    VALUE_MODES.levelDiv,
    VALUE_MODES.levelTimes,
    VALUE_MODES.levelPlus,
    VALUE_MODES.levelMinus,
  ].includes(adjustment.valueMode);
  const addableTypeChoices = typeChoices.filter(([value]) => !adjustment.types.includes(value));

  return `
    <div style="margin-top: 10px;">
      <p class="notes" style="margin: 0 0 8px 0;">${localize("ActionPlus.DamageAdjustments.Hint")}</p>
      <div class="form-group">
        <label>${localize("ActionPlus.DamageAdjustments.AdjustmentLabel")}</label>
        <div class="form-fields">
          <select class="ts-damage-adjustment-input" data-field="adjustmentType">
            ${adjustmentChoices.map(([value, label]) => `<option value="${foundry.utils.escapeHTML(value)}" ${adjustment.adjustmentType === value ? "selected" : ""}>${foundry.utils.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>${localize("ActionPlus.DamageAdjustments.TypesLabel")}</label>
        <div class="form-fields" style="display: block;">
          <select class="ts-damage-adjustment-add-type" style="width: 100%;">
            <option value="">${foundry.utils.escapeHTML(localize("ActionPlus.DamageAdjustments.AddTypePlaceholder"))}</option>
            ${addableTypeChoices.map(([value, label]) => `<option value="${foundry.utils.escapeHTML(value)}">${foundry.utils.escapeHTML(label)}</option>`).join("")}
          </select>
          ${renderSelectedTypes(adjustment, typeChoices)}
        </div>
      </div>
      <div class="form-group">
        <label>${localize("ActionPlus.DamageAdjustments.ValueLabel")}</label>
        <div class="form-fields" style="gap: 6px; align-items: center;">
          <select class="ts-damage-adjustment-input" data-field="valueMode" ${valueDisabled ? "disabled" : ""}>
            ${valueModeChoices.map(([value, label]) => `<option value="${foundry.utils.escapeHTML(value)}" ${adjustment.valueMode === value ? "selected" : ""}>${foundry.utils.escapeHTML(label)}</option>`).join("")}
          </select>
          <input
            type="number"
            class="ts-damage-adjustment-input"
            data-field="${adjustment.valueMode === VALUE_MODES.flat ? "flatValue" : "modifier"}"
            value="${numericValue}"
            ${numericDisabled ? "disabled" : ""}
            style="max-width: 90px;"
          >
        </div>
        <p class="notes" style="margin: 4px 0 0 0;">${foundry.utils.escapeHTML(modifierLabel)}</p>
      </div>
    </div>
  `;
}
async function persistDamageAdjustment(item, adjustment, occurrenceIndex) {
  const nextAdjustments = normalizeAdjustmentCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  nextAdjustments[occurrenceIndex] = normalizeAdjustment(adjustment);
  await item.setFlag(MODULE_ID, FLAG_KEY, nextAdjustments);
}

function activateDamageAdjustmentListeners({ app, html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = getHtmlElement(html);
  if (!root) return;

  const panel = root.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  const currentAdjustments = normalizeAdjustmentCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  const currentAdjustment = normalizeAdjustment(currentAdjustments[occurrenceIndex] ?? null);

  for (const control of panel.querySelectorAll(".ts-damage-adjustment-input")) {
    control.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const field = String(target.dataset.field ?? "");
      if (!field) return;

      const nextAdjustment = normalizeAdjustment(currentAdjustment);
      if (field === "adjustmentType" || field === "valueMode") {
        nextAdjustment[field] = String(target.value ?? "");
      } else {
        nextAdjustment[field] = normalizeInteger(target.value, 0);
      }

      await persistDamageAdjustment(item, nextAdjustment, occurrenceIndex);
    });
  }

  const addTypeSelect = panel.querySelector(".ts-damage-adjustment-add-type");
  addTypeSelect?.addEventListener("change", async (event) => {
    const target = event.currentTarget;
    const nextType = String(target.value ?? "").trim();
    if (!nextType) return;

    const nextAdjustment = normalizeAdjustment(currentAdjustment);
    if (!nextAdjustment.types.includes(nextType)) {
      nextAdjustment.types = [...nextAdjustment.types, nextType];
    }

    await persistDamageAdjustment(item, nextAdjustment, occurrenceIndex);
  });

  for (const button of panel.querySelectorAll(".ts-damage-adjustment-remove-type")) {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      const type = String(target.dataset.type ?? "").trim();
      if (!type) return;

      const nextAdjustment = normalizeAdjustment(currentAdjustment);
      nextAdjustment.types = nextAdjustment.types.filter((entry) => entry !== type);
      await persistDamageAdjustment(item, nextAdjustment, occurrenceIndex);
    });
  }
}

async function cleanupDamageAdjustments({ item, occurrenceIndex = 0 }) {
  const nextAdjustments = normalizeAdjustmentCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  nextAdjustments.splice(occurrenceIndex, 1);

  if (nextAdjustments.length > 0) {
    await item.setFlag(MODULE_ID, FLAG_KEY, nextAdjustments);
  } else {
    await item.unsetFlag(MODULE_ID, FLAG_KEY);
  }
}

function applyDamageAdjustmentRuleSyncToPendingUpdate(item, changed) {
  if (!isSupportedActionPlusItem(item)) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;

  const existingRules = foundry.utils.deepClone(
    foundry.utils.getProperty(changed, "system.rules")
    ?? item._source?.system?.rules
    ?? [],
  );
  const previousAdjustments = normalizeAdjustmentCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  const nextAdjustments = getPendingDamageAdjustmentCollection(item, changed);
  const { changed: rulesChanged, rules } = buildUpdatedDamageAdjustmentRules(existingRules, previousAdjustments, nextAdjustments);

  if (!rulesChanged) return;
  foundry.utils.setProperty(changed, "system.rules", rules);
}
