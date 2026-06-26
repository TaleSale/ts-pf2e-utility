import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import {
  getPendingActionPlusOptions,
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const FEATURE_ID = "enhancement";
const SOURCE_ID = "enhancement";
const FLAG_KEY = "enhancements";
const RULE_PRIORITY = 121;
const DISABLED_PREDICATE = "tsu:enhancement:disabled";

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.Enhancement.FeatureLabel`,
  allowMultiple: true,
  render: renderEnhancementControls,
  activateListeners: activateEnhancementListeners,
  cleanup: cleanupEnhancement,
});

Hooks.on("preUpdateItem", (item, changed) => {
  applyEnhancementRuleSyncToPendingUpdate(item, changed);
});

Hooks.on("createItem", (item) => {
  void refreshActorEnhancementRules(item.actor);
});

Hooks.on("updateItem", (item) => {
  void refreshActorEnhancementRules(item.actor);
});

Hooks.on("deleteItem", (item) => {
  void refreshActorEnhancementRules(item.actor);
});

Hooks.on("updateActor", (actor, changed) => {
  if (!foundry.utils.hasProperty(changed, "system.details.level.value")
    && !foundry.utils.hasProperty(changed, "level")) {
    return;
  }

  void refreshActorEnhancementRules(actor);
});

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function getDefaultEnhancement() {
  return {
    levelRequirement: "",
    actionSlug: "",
    text: "",
  };
}

function normalizeLevelRequirement(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric >= 0 ? String(Math.trunc(numeric)) : "";
}

function normalizeEnhancement(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    levelRequirement: normalizeLevelRequirement(source.levelRequirement),
    actionSlug: String(source.actionSlug ?? "").trim().toLowerCase(),
    text: String(source.text ?? "").trim(),
  };
}

function normalizeEnhancementCollection(value) {
  const entries = Array.isArray(value) ? value : [];
  return entries.map((entry) => normalizeEnhancement(entry));
}

function getPendingEnhancementCount(item, changed) {
  return getPendingActionPlusOptions(item, changed).filter((option) => option === FEATURE_ID).length;
}

function getPendingEnhancementCollection(item, changed) {
  const enhancements = normalizeEnhancementCollection(
    foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`)
      ?? item.getFlag(MODULE_ID, FLAG_KEY)
      ?? [],
  );

  return enhancements.slice(0, getPendingEnhancementCount(item, changed));
}

function getOtherActorActionBySlug(item, slug) {
  if (!slug) return null;
  return item?.actor?.itemTypes?.action?.find((action) => (
    action?.id !== item?.id
    && String(action.system?.slug ?? action.slug ?? "").trim().toLowerCase() === slug
  )) ?? null;
}

function getActorLevel(item) {
  return Number(item?.actor?.level ?? item?.actor?.system?.details?.level?.value ?? 0) || 0;
}

function meetsLevelRequirement(item, enhancement) {
  if (!enhancement.levelRequirement) return true;
  return getActorLevel(item) >= Number(enhancement.levelRequirement);
}

function meetsActionRequirement(item, enhancement) {
  if (!enhancement.actionSlug) return true;
  return Boolean(getOtherActorActionBySlug(item, enhancement.actionSlug));
}

function buildEnhancementLabel(item, enhancement) {
  const action = getOtherActorActionBySlug(item, enhancement.actionSlug);
  if (action?.name) return action.name;
  if (enhancement.levelRequirement) return localize("ActionPlus.Enhancement.HeaderLevel").replace("{level}", enhancement.levelRequirement);
  if (enhancement.actionSlug) return enhancement.actionSlug;
  return localize("ActionPlus.Enhancement.HeaderDefault");
}

function buildEnhancementHeader(item, enhancement) {
  const action = getOtherActorActionBySlug(item, enhancement.actionSlug);
  if (enhancement.levelRequirement && action?.name) {
    return localize("ActionPlus.Enhancement.HeaderLevelAction")
      .replace("{level}", enhancement.levelRequirement)
      .replace("{action}", action.name);
  }
  if (action?.name) return action.name;
  if (enhancement.levelRequirement) return localize("ActionPlus.Enhancement.HeaderLevel").replace("{level}", enhancement.levelRequirement);
  return localize("ActionPlus.Enhancement.HeaderDefault");
}

function buildEnhancementPredicate(item, enhancement) {
  const predicate = [];

  if (enhancement.levelRequirement) {
    predicate.push({ gte: ["self:level", Number(enhancement.levelRequirement)] });
  }

  if (enhancement.actionSlug && !meetsActionRequirement(item, enhancement)) {
    predicate.push(DISABLED_PREDICATE);
  }

  return predicate;
}

function buildEnhancementText(item, enhancement) {
  const body = escapeHtml(enhancement.text).replaceAll("\n", "<br>");
  return `<p>${body}</p>`;
}

function isEnhancementConfigured(enhancement) {
  return Boolean(enhancement.text) && (Boolean(enhancement.levelRequirement) || Boolean(enhancement.actionSlug));
}

function buildRulesFromEnhancements(item, enhancements) {
  return normalizeEnhancementCollection(enhancements)
    .filter((enhancement) => isEnhancementConfigured(enhancement))
    .map((enhancement) => ({
      key: "ItemAlteration",
      itemId: "{item|id}",
      mode: "add",
      label: buildEnhancementLabel(item, enhancement),
      predicate: buildEnhancementPredicate(item, enhancement),
      property: "description",
      value: [{ text: buildEnhancementText(item, enhancement) }],
      priority: RULE_PRIORITY,
      tsUtilitySource: SOURCE_ID,
    }));
}

function createRuleSignature(rule) {
  if (!rule || typeof rule !== "object") return "";
  const normalized = foundry.utils.deepClone(rule);
  delete normalized.tsUtilitySource;
  return JSON.stringify(normalized);
}

function removeGeneratedEnhancementRules(existingRules, previousEnhancements, item) {
  const removableSignatures = buildRulesFromEnhancements(item, previousEnhancements).map((rule) => createRuleSignature(rule));
  const remainingRules = [];
  for (const rule of foundry.utils.deepClone(existingRules)) {
    const directSourceMatch = rule?.tsUtilitySource === SOURCE_ID;
    const signature = createRuleSignature(rule);
    const signatureIndex = removableSignatures.indexOf(signature);

    if (directSourceMatch) continue;
    if (signatureIndex !== -1) {
      removableSignatures.splice(signatureIndex, 1);
      continue;
    }

    remainingRules.push(rule);
  }

  return remainingRules;
}

function getEnhancementRulesFromItem(item) {
  return foundry.utils.deepClone(item._source?.system?.rules ?? item.system?.rules ?? []);
}

async function refreshEnhancementRules(item) {
  if (!isSupportedActionPlusItem(item) || !item.actor) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID)) return;

  const existingRules = getEnhancementRulesFromItem(item);
  const enhancements = normalizeEnhancementCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  const { changed, rules } = buildUpdatedEnhancementRules(item, existingRules, enhancements, enhancements);
  if (!changed) return;

  await item.update({ "system.rules": rules });
}

async function refreshActorEnhancementRules(actor) {
  if (!actor?.itemTypes?.action?.length) return;

  for (const item of actor.itemTypes.action) {
    await refreshEnhancementRules(item);
  }
}

function areRulesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildUpdatedEnhancementRules(item, existingRules, previousEnhancements, nextEnhancements) {
  const filteredRules = removeGeneratedEnhancementRules(existingRules, previousEnhancements, item);
  const generatedRules = buildRulesFromEnhancements(item, nextEnhancements);
  const rules = [...filteredRules, ...generatedRules];

  return {
    changed: !areRulesEqual(existingRules, rules),
    rules,
  };
}

function renderEnhancementControls({ item, flags, occurrenceIndex = 0 }) {
  const enhancements = normalizeEnhancementCollection(flags?.[FLAG_KEY]);
  const enhancement = normalizeEnhancement(enhancements[occurrenceIndex] ?? null);

  return `
    <div style="margin-top: 10px;">
      <div class="form-group">
        <label>${localize("ActionPlus.Enhancement.LevelRequirementLabel")}</label>
        <div class="form-fields">
          <input type="number" min="0" class="ts-enhancement-input" data-field="levelRequirement" value="${escapeHtml(enhancement.levelRequirement)}" placeholder="${escapeHtml(localize("ActionPlus.Enhancement.EmptyPlaceholder"))}">
        </div>
      </div>
      <div class="form-group">
        <label>${localize("ActionPlus.Enhancement.ActionSlugLabel")}</label>
        <div class="form-fields">
          <input type="text" class="ts-enhancement-input" data-field="actionSlug" value="${escapeHtml(enhancement.actionSlug)}" placeholder="${escapeHtml(localize("ActionPlus.Enhancement.EmptyPlaceholder"))}">
        </div>
      </div>
      <div class="form-group">
        <label>${localize("ActionPlus.Enhancement.TextLabel")}</label>
        <div class="form-fields">
          <textarea class="ts-enhancement-input" data-field="text" rows="4" placeholder="${escapeHtml(localize("ActionPlus.Enhancement.TextPlaceholder"))}">${escapeHtml(enhancement.text)}</textarea>
        </div>
      </div>
    </div>
  `;
}

async function persistEnhancement(item, enhancement, occurrenceIndex) {
  const nextEnhancements = normalizeEnhancementCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  nextEnhancements[occurrenceIndex] = normalizeEnhancement(enhancement);
  await item.setFlag(MODULE_ID, FLAG_KEY, nextEnhancements);
}

function activateEnhancementListeners({ html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = getHtmlElement(html);
  if (!root) return;

  const panel = root.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  const currentEnhancements = normalizeEnhancementCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  const currentEnhancement = normalizeEnhancement(currentEnhancements[occurrenceIndex] ?? null);

  for (const control of panel.querySelectorAll(".ts-enhancement-input")) {
    control.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const field = String(target.dataset.field ?? "");
      if (!field) return;

      const nextEnhancement = normalizeEnhancement(currentEnhancement);
      nextEnhancement[field] = String(target.value ?? "");
      await persistEnhancement(item, nextEnhancement, occurrenceIndex);
    });
  }
}

async function cleanupEnhancement({ item, occurrenceIndex = 0 }) {
  const nextEnhancements = normalizeEnhancementCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  nextEnhancements.splice(occurrenceIndex, 1);

  if (nextEnhancements.length > 0) {
    await item.setFlag(MODULE_ID, FLAG_KEY, nextEnhancements);
  } else {
    await item.unsetFlag(MODULE_ID, FLAG_KEY);
  }
}

function applyEnhancementRuleSyncToPendingUpdate(item, changed) {
  if (!isSupportedActionPlusItem(item)) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;

  const existingRules = foundry.utils.deepClone(
    foundry.utils.getProperty(changed, "system.rules")
    ?? item._source?.system?.rules
    ?? [],
  );
  const previousEnhancements = normalizeEnhancementCollection(item.getFlag(MODULE_ID, FLAG_KEY) ?? []);
  const nextEnhancements = getPendingEnhancementCollection(item, changed);
  const { changed: rulesChanged, rules } = buildUpdatedEnhancementRules(item, existingRules, previousEnhancements, nextEnhancements);

  if (!rulesChanged) return;
  foundry.utils.setProperty(changed, "system.rules", rules);
}
