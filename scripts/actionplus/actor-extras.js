import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import {
  getItemActionPlusOptions,
  getPendingActionPlusOptions,
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const LANGUAGE_FEATURE_ID = "actorLanguages";
const SENSE_FEATURE_ID = "actorSenses";
const TRAIT_FEATURE_ID = "actorTraits";
const LANGUAGE_FLAG_KEY = "actorLanguages";
const SENSE_FLAG_KEY = "actorSenses";
const TRAIT_FLAG_KEY = "actorTraits";
const ACTOR_EXTRAS_FLAG_KEY = "actorExtrasGenerated";
const RULE_SLUG_PREFIX = "tsu-actor-trait";

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function localizeWithFallback(key, fallback) {
  const value = game.i18n.localize(key);
  return value && value !== key ? value : fallback;
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function normalizeSlugList(value) {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(",");
  return Array.from(new Set(entries.map((entry) => String(entry ?? "").trim().toLowerCase()).filter(Boolean)));
}

function normalizeConfig(value) {
  return { values: normalizeSlugList(value?.values ?? value) };
}

function normalizeConfigCollection(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeConfig(entry));
  if (value && typeof value === "object") return [normalizeConfig(value)];
  return [];
}

function normalizeSense(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    type: String(source.type ?? "").trim(),
    acuity: String(source.acuity ?? "precise").trim() || "precise",
    range: Math.max(0, Number.parseInt(source.range, 10) || 0),
  };
}

function normalizeSenses(value) {
  let entries = value;
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      entries = [];
    }
  }

  const seen = new Set();
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeSense(entry))
    .filter((sense) => {
      if (!sense.type) return false;
      const key = `${sense.type}:${sense.acuity}:${sense.range}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeSenseConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    senses: normalizeSenses(source.senses),
    nextType: String(source.nextType ?? "").trim(),
    nextAcuity: String(source.nextAcuity ?? "precise").trim() || "precise",
    nextRange: Math.max(0, Number.parseInt(source.nextRange, 10) || 0),
  };
}

function normalizeSenseConfigCollection(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeSenseConfig(entry));
  if (value && typeof value === "object") return [normalizeSenseConfig(value)];
  return [];
}

function getSenseKey(sense) {
  const normalized = normalizeSense(sense);
  return `${normalized.type}:${normalized.acuity}:${normalized.range}`;
}

function normalizeStoredActorExtras(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    languages: normalizeSlugList(source.languages),
    senses: normalizeSenses(source.senses),
  };
}

function getFeatureCount(item, featureId, changed = null) {
  const options = changed ? getPendingActionPlusOptions(item, changed) : getItemActionPlusOptions(item);
  return options.filter((option) => option === featureId).length;
}

function getLanguageConfigs(item) {
  return normalizeConfigCollection(item.getFlag(MODULE_ID, LANGUAGE_FLAG_KEY)).slice(0, getFeatureCount(item, LANGUAGE_FEATURE_ID));
}

function getSenseConfigs(item) {
  return normalizeSenseConfigCollection(item.getFlag(MODULE_ID, SENSE_FLAG_KEY)).slice(0, getFeatureCount(item, SENSE_FEATURE_ID));
}

function getTraitConfigs(item, changed = null) {
  const source = foundry.utils.getProperty(changed ?? {}, `flags.${MODULE_ID}.${TRAIT_FLAG_KEY}`)
    ?? item.getFlag(MODULE_ID, TRAIT_FLAG_KEY);
  return normalizeConfigCollection(source).slice(0, getFeatureCount(item, TRAIT_FEATURE_ID, changed));
}

function getChoiceEntries(source) {
  return Object.entries(source ?? {})
    .filter(([value]) => value)
    .sort((left, right) => {
      const leftLabel = game.i18n.localize(String(left[1] ?? left[0]));
      const rightLabel = game.i18n.localize(String(right[1] ?? right[0]));
      return leftLabel.localeCompare(rightLabel, game.i18n.lang || "en", { sensitivity: "base" });
    });
}

function getSenseAcuityChoices() {
  return getChoiceEntries(CONFIG.PF2E?.senseAcuity ?? CONFIG.PF2E?.senseAcuities ?? {
    precise: "PF2E.SenseAcuity.Precise",
    imprecise: "PF2E.SenseAcuity.Imprecise",
    vague: "PF2E.SenseAcuity.Vague",
  });
}

function renderSelectOptions(entries, selectedValue) {
  return entries.map(([value, label]) => {
    const optionLabel = game.i18n.localize(String(label ?? value));
    return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
  }).join("");
}

function renderSelectedSlugList(values, choices, removeClass, emptyKey) {
  if (!values.length) return `<p class="notes" style="margin: 6px 0 0 0;">${escapeHtml(localize(emptyKey))}</p>`;

  const labels = new Map(choices);
  return `
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      ${values.map((value) => `
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="flex: 1 1 auto; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.08);">
            ${escapeHtml(game.i18n.localize(String(labels.get(value) ?? value)))}
          </div>
          <button type="button" class="${removeClass}" data-value="${escapeHtml(value)}" style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
            <i class="fas fa-minus"></i>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function getLanguageRarity(slug) {
  try {
    const rarities = game.settings.get("pf2e", "homebrew.languageRarities");
    for (const rarity of ["unavailable", "secret", "rare", "uncommon"]) {
      const values = rarities?.[rarity];
      if (values instanceof Set ? values.has(slug) : Array.isArray(values) && values.includes(slug)) return rarity;
    }
  } catch {
    return "common";
  }

  return "common";
}

function getChoiceRarity(value, labels) {
  return labels.withRarity ? getLanguageRarity(value) : "";
}

function renderRarityBadge(rarity) {
  if (!rarity) return "";
  const label = game.i18n.localize(String(CONFIG.PF2E?.rarityTraits?.[rarity] ?? rarity));
  const colors = {
    common: ["#5c5c5c", "#ffffff"],
    uncommon: ["#98513d", "#ffffff"],
    rare: ["#173f7a", "#ffffff"],
    unique: ["#54166f", "#ffffff"],
    secret: ["#333333", "#ffffff"],
    unavailable: ["#6f1d1b", "#ffffff"],
  };
  const [background, color] = colors[rarity] ?? colors.common;

  return `
    <span style="margin-left: auto; flex: 0 0 auto; min-width: 74px; padding: 2px 5px; background: ${background}; color: ${color}; border-left: 3px solid #d6b85a; font-size: 10px; font-weight: 700; text-align: center; text-transform: uppercase;">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderSelectedSummary(values, choices, emptyKey) {
  if (!values.length) return `<p class="notes" style="margin: 6px 0 0 0;">${escapeHtml(localize(emptyKey))}</p>`;

  const labels = new Map(choices);
  return `
    <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
      ${values.map((value) => `
        <span class="tag" data-value="${escapeHtml(value)}" style="padding: 2px 6px; border-radius: 3px; background: rgba(0, 0, 0, 0.08);">
          ${escapeHtml(game.i18n.localize(String(labels.get(value) ?? value)))}
        </span>
      `).join("")}
    </div>
  `;
}

function renderListControls({ flags, occurrenceIndex = 0, flagKey, choices, labels }) {
  const configs = normalizeConfigCollection(flags?.[flagKey]);
  const config = normalizeConfig(configs[occurrenceIndex] ?? null);

  return `
    <div style="margin-top: 10px;">
      <p class="notes" style="margin: 0 0 8px 0;">${escapeHtml(localize(labels.hint))}</p>
      <div class="form-group">
        <label>${escapeHtml(localize(labels.label))}</label>
        <div class="form-fields" style="display: block;">
          <input type="hidden" class="${labels.inputClass}" data-field="values" value="${escapeHtml(config.values.join(","))}">
          <button type="button" class="${labels.openClass}" style="width: auto; min-width: 32px; padding: 2px 8px;">
            <i class="fas fa-list-check"></i> ${escapeHtml(localize(labels.placeholder))}
          </button>
          <div class="${labels.summaryClass}">
            ${renderSelectedSummary(config.values, choices, labels.empty)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLanguageControls(context) {
  return renderListControls({
    ...context,
    flagKey: LANGUAGE_FLAG_KEY,
    choices: getChoiceEntries(CONFIG.PF2E?.languages),
    labels: {
      hint: "ActionPlus.ActorLanguages.Hint",
      label: "ActionPlus.ActorLanguages.Label",
      placeholder: "ActionPlus.ActorLanguages.AddPlaceholder",
      empty: "ActionPlus.ActorLanguages.EmptyHint",
      addClass: "ts-actor-languages-add",
      inputClass: "ts-actor-languages-input",
      removeClass: "ts-actor-languages-remove",
      searchClass: "ts-actor-languages-search",
      listClass: "ts-actor-languages-list",
      rowClass: "ts-actor-languages-row",
      checkboxClass: "ts-actor-languages-checkbox",
      openClass: "ts-actor-languages-open",
      summaryClass: "ts-actor-languages-summary",
      withRarity: true,
    },
  });
}

function renderTraitControls(context) {
  return renderListControls({
    ...context,
    flagKey: TRAIT_FLAG_KEY,
    choices: getChoiceEntries(CONFIG.PF2E?.creatureTraits),
    labels: {
      hint: "ActionPlus.ActorTraits.Hint",
      label: "ActionPlus.ActorTraits.Label",
      placeholder: "ActionPlus.ActorTraits.AddPlaceholder",
      empty: "ActionPlus.ActorTraits.EmptyHint",
      addClass: "ts-actor-traits-add",
      inputClass: "ts-actor-traits-input",
      removeClass: "ts-actor-traits-remove",
      searchClass: "ts-actor-traits-search",
      listClass: "ts-actor-traits-list",
      rowClass: "ts-actor-traits-row",
      checkboxClass: "ts-actor-traits-checkbox",
      openClass: "ts-actor-traits-open",
      summaryClass: "ts-actor-traits-summary",
      withRarity: false,
    },
  });
}

function getSenseLabel(sense) {
  const type = game.i18n.localize(String(CONFIG.PF2E?.senses?.[sense.type] ?? sense.type));
  const acuity = game.i18n.localize(String(
    CONFIG.PF2E?.senseAcuity?.[sense.acuity]
      ?? CONFIG.PF2E?.senseAcuities?.[sense.acuity]
      ?? sense.acuity,
  ));
  return sense.range > 0 ? `${type} (${acuity}, ${sense.range} ft.)` : `${type} (${acuity})`;
}

function renderSelectedSenses(config) {
  if (!config.senses.length) return `<p class="notes" style="margin: 6px 0 0 0;">${escapeHtml(localize("ActionPlus.ActorSenses.EmptyHint"))}</p>`;

  return `
    <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      ${config.senses.map((sense, index) => `
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="flex: 1 1 auto; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.08);">
            ${escapeHtml(getSenseLabel(sense))}
          </div>
          <button type="button" class="ts-actor-senses-remove" data-index="${index}" style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
            <i class="fas fa-minus"></i>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSenseControls({ flags, occurrenceIndex = 0 }) {
  const configs = normalizeSenseConfigCollection(flags?.[SENSE_FLAG_KEY]);
  const config = normalizeSenseConfig(configs[occurrenceIndex] ?? null);

  return `
    <div style="margin-top: 10px;">
      <p class="notes" style="margin: 0 0 8px 0;">${escapeHtml(localize("ActionPlus.ActorSenses.Hint"))}</p>
      <input type="hidden" class="ts-actor-senses-input" data-field="senses" value="${escapeHtml(JSON.stringify(config.senses))}">
      <div class="form-group">
        <label>${escapeHtml(localize("ActionPlus.ActorSenses.Label"))}</label>
        <div class="form-fields" style="display: grid; grid-template-columns: minmax(90px, 1fr) minmax(80px, 1fr) 70px 24px; gap: 6px;">
          <select class="ts-actor-senses-input" data-field="nextType">
            <option value="">${escapeHtml(localize("ActionPlus.ActorSenses.AddPlaceholder"))}</option>
            ${renderSelectOptions(getChoiceEntries(CONFIG.PF2E?.senses), config.nextType)}
          </select>
          <select class="ts-actor-senses-input" data-field="nextAcuity">
            ${renderSelectOptions(getSenseAcuityChoices(), config.nextAcuity)}
          </select>
          <input type="number" class="ts-actor-senses-input" data-field="nextRange" value="${config.nextRange}" min="0" step="5" data-tooltip="${escapeHtml(localize("ActionPlus.ActorSenses.RangeLabel"))}">
          <button type="button" class="ts-actor-senses-add" style="width: 24px; min-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
      ${renderSelectedSenses(config)}
    </div>
  `;
}

function readListValues(panel, inputClass) {
  const input = panel.querySelector(`.${inputClass}[data-field="values"]`);
  return normalizeSlugList(input instanceof HTMLInputElement ? input.value : "");
}

function writeListValues(panel, inputClass, values) {
  const input = panel.querySelector(`.${inputClass}[data-field="values"]`);
  if (input instanceof HTMLInputElement) input.value = normalizeSlugList(values).join(",");
}

function buildCheckboxDialogContent({ values, choices, labels }) {
  const selected = new Set(values);
  const searchPlaceholder = localizeWithFallback("PF2E.Search", "Search");

  return `
    <div class="ts-actor-extra-picker" style="display: flex; flex-direction: column; gap: 6px;">
      <input type="search" class="${labels.searchClass}" placeholder="${escapeHtml(searchPlaceholder)}" style="width: 100%;">
      <div class="${labels.listClass}" style="max-height: 460px; overflow-y: auto; border: 1px solid var(--color-border-light-tertiary); background: rgba(0, 0, 0, 0.04);">
        ${choices.map(([value, label]) => {
          const localizedLabel = game.i18n.localize(String(label ?? value));
          const rarity = getChoiceRarity(value, labels);
          return `
            <label class="${labels.rowClass}" data-search="${escapeHtml(localizedLabel.toLocaleLowerCase(game.i18n.lang || undefined))}" style="display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 6px; border-bottom: 1px solid rgba(0, 0, 0, 0.08); cursor: pointer;">
              <input type="checkbox" class="${labels.checkboxClass}" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""} style="flex: 0 0 auto;">
              <span style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(localizedLabel)}</span>
              ${renderRarityBadge(rarity)}
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function updateSummary(panel, summaryClass, values, choices, emptyKey) {
  const summary = panel.querySelector(`.${summaryClass}`);
  if (summary instanceof HTMLElement) {
    summary.innerHTML = renderSelectedSummary(values, choices, emptyKey);
  }
}

async function persistConfigCollection(item, flagKey, config, occurrenceIndex = 0) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, flagKey));
  while (configs.length <= occurrenceIndex) configs.push(normalizeConfig(null));
  configs[occurrenceIndex] = normalizeConfig(config);
  await item.setFlag(MODULE_ID, flagKey, configs);
  if (flagKey === LANGUAGE_FLAG_KEY) await syncActorExtras(item.actor);
}

async function persistSenseConfig(item, config, occurrenceIndex = 0) {
  const configs = normalizeSenseConfigCollection(item.getFlag(MODULE_ID, SENSE_FLAG_KEY));
  while (configs.length <= occurrenceIndex) configs.push(normalizeSenseConfig(null));
  configs[occurrenceIndex] = normalizeSenseConfig(config);
  await item.setFlag(MODULE_ID, SENSE_FLAG_KEY, configs);
  await syncActorExtras(item.actor);
}

function activateListListeners({
  html,
  item,
  optionIndex,
  occurrenceIndex = 0,
  featureId,
  flagKey,
  inputClass,
  searchClass,
  rowClass,
  checkboxClass,
  openClass,
  summaryClass,
  choices,
  labels,
}) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${featureId}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  const persist = async () => {
    await persistConfigCollection(item, flagKey, { values: readListValues(panel, inputClass) }, occurrenceIndex);
  };

  panel.querySelector(`.${openClass}`)?.addEventListener("click", () => {
    const content = buildCheckboxDialogContent({ values: readListValues(panel, inputClass), choices, labels });
    const title = localize(labels.label);
    const dialog = new Dialog({
      title,
      content,
      buttons: {
        update: {
          icon: '<i class="fas fa-save"></i>',
          label: localizeWithFallback("TS_PF2E_UTILITY.ActionPlus.Labels.Update", "Update"),
          callback: async (dialogHtml) => {
            const dialogRoot = getHtmlElement(dialogHtml);
            const values = normalizeSlugList(
              Array.from(dialogRoot?.querySelectorAll(`.${checkboxClass}:checked`) ?? []).map((checkbox) => checkbox.value),
            );
            writeListValues(panel, inputClass, values);
            updateSummary(panel, summaryClass, values, choices, labels.empty);
            await persist();
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localizeWithFallback("Cancel", "Cancel"),
        },
      },
      default: "update",
      render: (dialogHtml) => {
        const dialogRoot = getHtmlElement(dialogHtml);
        dialogRoot?.querySelector(`.${searchClass}`)?.addEventListener("input", (event) => {
          const term = String(event.currentTarget.value ?? "").trim().toLocaleLowerCase(game.i18n.lang || undefined);
          for (const row of dialogRoot.querySelectorAll(`.${rowClass}`)) {
            const haystack = String(row.dataset.search ?? "");
            row.hidden = Boolean(term) && !haystack.includes(term);
          }
        });
      },
    });

    dialog.render(true);
  });
}

function readSenseConfig(panel) {
  const config = normalizeSenseConfig(null);
  for (const control of panel.querySelectorAll(".ts-actor-senses-input")) {
    const field = String(control.dataset.field ?? "");
    if (!field) continue;
    config[field] = control.value;
  }
  return normalizeSenseConfig(config);
}

function writeSenses(panel, senses) {
  const input = panel.querySelector('.ts-actor-senses-input[data-field="senses"]');
  if (input instanceof HTMLInputElement) input.value = JSON.stringify(normalizeSenses(senses));
}

function activateSenseListeners({ app, html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${SENSE_FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  const persistAndRender = async () => {
    await persistSenseConfig(item, readSenseConfig(panel), occurrenceIndex);
    app?.render?.(false);
  };

  for (const control of panel.querySelectorAll(".ts-actor-senses-input")) {
    control.addEventListener("change", async () => {
      await persistSenseConfig(item, readSenseConfig(panel), occurrenceIndex);
    });
  }

  panel.querySelector(".ts-actor-senses-add")?.addEventListener("click", async () => {
    const config = readSenseConfig(panel);
    if (!config.nextType) return;
    writeSenses(panel, [...config.senses, { type: config.nextType, acuity: config.nextAcuity, range: config.nextRange }]);
    await persistAndRender();
  });

  for (const button of panel.querySelectorAll(".ts-actor-senses-remove")) {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);
      if (!Number.isInteger(index)) return;
      const config = readSenseConfig(panel);
      config.senses.splice(index, 1);
      writeSenses(panel, config.senses);
      await persistAndRender();
    });
  }
}

async function cleanupConfigCollection({ item, occurrenceIndex = 0 }, flagKey) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, flagKey));
  configs.splice(occurrenceIndex, 1);
  if (configs.length) {
    await item.setFlag(MODULE_ID, flagKey, configs);
  } else {
    await item.unsetFlag(MODULE_ID, flagKey);
  }
  if (flagKey === LANGUAGE_FLAG_KEY) await syncActorExtras(item.actor);
}

async function cleanupSenseConfig({ item, occurrenceIndex = 0 }) {
  const configs = normalizeSenseConfigCollection(item.getFlag(MODULE_ID, SENSE_FLAG_KEY));
  configs.splice(occurrenceIndex, 1);
  if (configs.length) {
    await item.setFlag(MODULE_ID, SENSE_FLAG_KEY, configs);
  } else {
    await item.unsetFlag(MODULE_ID, SENSE_FLAG_KEY);
  }
  await syncActorExtras(item.actor);
}

async function cleanupTraitConfig({ item, occurrenceIndex = 0 }) {
  const configs = normalizeConfigCollection(item.getFlag(MODULE_ID, TRAIT_FLAG_KEY));
  configs.splice(occurrenceIndex, 1);

  if (configs.length) {
    await item.setFlag(MODULE_ID, TRAIT_FLAG_KEY, configs);
  } else {
    await item.unsetFlag(MODULE_ID, TRAIT_FLAG_KEY);
  }

  const existingRules = foundry.utils.deepClone(item._source?.system?.rules ?? item.system?.rules ?? []);
  const rules = [
    ...existingRules.filter((rule) => !(rule?.key === "ActorTraits" && String(rule?.slug ?? "").startsWith(`${RULE_SLUG_PREFIX}-`))),
    ...configs.flatMap((config, index) => (
      config.values.length ? [{ key: "ActorTraits", add: config.values, slug: `${RULE_SLUG_PREFIX}-${index}` }] : []
    )),
  ];
  if (JSON.stringify(existingRules) !== JSON.stringify(rules)) {
    await item.update({ "system.rules": rules });
  }
}

function applyTraitRuleSyncToPendingUpdate(item, changed) {
  if (!isSupportedActionPlusItem(item)) return;
  if (!isActionPlusFeatureEnabled(item, TRAIT_FEATURE_ID, changed)) return;

  const existingRules = foundry.utils.deepClone(foundry.utils.getProperty(changed, "system.rules") ?? item._source?.system?.rules ?? []);
  const generatedRules = getTraitConfigs(item, changed).flatMap((config, index) => (
    config.values.length ? [{ key: "ActorTraits", add: config.values, slug: `${RULE_SLUG_PREFIX}-${index}` }] : []
  ));
  const rules = [
    ...existingRules.filter((rule) => !(rule?.key === "ActorTraits" && String(rule?.slug ?? "").startsWith(`${RULE_SLUG_PREFIX}-`))),
    ...generatedRules,
  ];

  if (JSON.stringify(existingRules) !== JSON.stringify(rules)) {
    foundry.utils.setProperty(changed, "system.rules", rules);
  }
}

function getActorActionExtras(actor) {
  const languages = new Set();
  const senses = [];
  const seenSenses = new Set();

  for (const item of actor?.itemTypes?.action ?? []) {
    if (!isSupportedActionPlusItem(item)) continue;
    if (isActionPlusFeatureEnabled(item, LANGUAGE_FEATURE_ID)) {
      for (const config of getLanguageConfigs(item)) {
        for (const value of config.values) languages.add(value);
      }
    }
    if (isActionPlusFeatureEnabled(item, SENSE_FEATURE_ID)) {
      for (const config of getSenseConfigs(item)) {
        for (const sense of config.senses) {
          const key = `${sense.type}:${sense.acuity}:${sense.range}`;
          if (seenSenses.has(key)) continue;
          seenSenses.add(key);
          senses.push(sense);
        }
      }
    }
  }

  return { languages: Array.from(languages), senses };
}

function getActorStoredExtras(actor) {
  return normalizeStoredActorExtras(actor?.getFlag?.(MODULE_ID, ACTOR_EXTRAS_FLAG_KEY));
}

function getActorSourceLanguages(actor) {
  return normalizeSlugList(
    actor?._source?.system?.details?.languages?.value
      ?? actor?.system?.details?.languages?.value
      ?? [],
  );
}

function getActorSourceSenses(actor) {
  const source = actor?._source?.system?.perception?.senses
    ?? actor?.system?.perception?.senses
    ?? [];
  return Array.isArray(source) ? foundry.utils.deepClone(source) : [];
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function syncActorExtras(actor) {
  if (!actor || typeof actor.update !== "function") return;
  if (!["character", "npc"].includes(actor.type)) return;

  const previous = getActorStoredExtras(actor);
  const next = normalizeStoredActorExtras(getActorActionExtras(actor));
  const previousLanguages = new Set(previous.languages);
  const currentLanguages = getActorSourceLanguages(actor);
  const baseLanguages = currentLanguages.filter((language) => !previousLanguages.has(language));
  const mergedLanguages = Array.from(new Set([...baseLanguages, ...next.languages]));

  const previousSenseKeys = new Set(previous.senses.map((sense) => getSenseKey(sense)));
  const currentSenses = getActorSourceSenses(actor);
  const baseSenses = currentSenses.filter((sense) => !previousSenseKeys.has(getSenseKey(sense)));
  const mergedSenses = [...baseSenses, ...next.senses];

  const update = {};
  if (!arraysEqual(currentLanguages, mergedLanguages)) {
    update["system.details.languages.value"] = mergedLanguages;
  }
  if (!arraysEqual(currentSenses.map((sense) => normalizeSense(sense)), mergedSenses.map((sense) => normalizeSense(sense)))) {
    update["system.perception.senses"] = mergedSenses;
  }
  if (!arraysEqual(previous, next)) {
    update[`flags.${MODULE_ID}.${ACTOR_EXTRAS_FLAG_KEY}`] = next;
  }

  if (Object.keys(update).length) await actor.update(update);
}

function appendActorLanguageTags(root, actor, languages) {
  const list = root.querySelector('.subsection.languages ul.tags.light');
  if (!(list instanceof HTMLElement)) return;

  const existing = new Set([
    ...Array.from(list.querySelectorAll("[data-slug]")).map((entry) => String(entry.dataset.slug ?? "")),
    ...(actor.system?.details?.languages?.value ?? []),
  ]);

  for (const language of languages) {
    if (existing.has(language)) continue;
    const li = document.createElement("li");
    li.className = "tag";
    li.dataset.slug = language;
    li.textContent = game.i18n.localize(String(CONFIG.PF2E?.languages?.[language] ?? language));
    list.append(li);
  }
}

function appendActorSenseTags(root, actor, senses) {
  const perception = root.querySelector("section.perception");
  if (!(perception instanceof HTMLElement)) return;

  let list = perception.querySelector("ol.tags.senses");
  if (!(list instanceof HTMLElement)) {
    list = document.createElement("ol");
    list.className = "tags senses";
    perception.append(list);
  }

  if (!(list instanceof HTMLElement)) return;

  const existing = new Set((actor.system?.perception?.senses ?? []).map((sense) => `${sense.type}:${sense.acuity}:${sense.range ?? 0}`));
  for (const sense of senses) {
    if (existing.has(`${sense.type}:${sense.acuity}:${sense.range}`)) continue;
    const li = document.createElement("li");
    li.className = "tag tag_secondary";
    li.dataset.slug = sense.type;
    li.textContent = getSenseLabel(sense);
    list.append(li);
  }
}

registerActionPlusFeature({
  id: LANGUAGE_FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.ActorLanguages.FeatureLabel`,
  allowMultiple: true,
  render: renderLanguageControls,
  activateListeners: (context) => activateListListeners({
    ...context,
    featureId: LANGUAGE_FEATURE_ID,
    flagKey: LANGUAGE_FLAG_KEY,
    inputClass: "ts-actor-languages-input",
    searchClass: "ts-actor-languages-search",
    rowClass: "ts-actor-languages-row",
    checkboxClass: "ts-actor-languages-checkbox",
    openClass: "ts-actor-languages-open",
    summaryClass: "ts-actor-languages-summary",
    choices: getChoiceEntries(CONFIG.PF2E?.languages),
    labels: {
      label: "ActionPlus.ActorLanguages.Label",
      empty: "ActionPlus.ActorLanguages.EmptyHint",
      searchClass: "ts-actor-languages-search",
      listClass: "ts-actor-languages-list",
      rowClass: "ts-actor-languages-row",
      checkboxClass: "ts-actor-languages-checkbox",
      withRarity: true,
    },
  }),
  cleanup: (context) => cleanupConfigCollection(context, LANGUAGE_FLAG_KEY),
});

registerActionPlusFeature({
  id: SENSE_FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.ActorSenses.FeatureLabel`,
  allowMultiple: true,
  render: renderSenseControls,
  activateListeners: activateSenseListeners,
  cleanup: cleanupSenseConfig,
});

registerActionPlusFeature({
  id: TRAIT_FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.ActorTraits.FeatureLabel`,
  allowMultiple: true,
  render: renderTraitControls,
  activateListeners: (context) => activateListListeners({
    ...context,
    featureId: TRAIT_FEATURE_ID,
    flagKey: TRAIT_FLAG_KEY,
    inputClass: "ts-actor-traits-input",
    searchClass: "ts-actor-traits-search",
    rowClass: "ts-actor-traits-row",
    checkboxClass: "ts-actor-traits-checkbox",
    openClass: "ts-actor-traits-open",
    summaryClass: "ts-actor-traits-summary",
    choices: getChoiceEntries(CONFIG.PF2E?.creatureTraits),
    labels: {
      label: "ActionPlus.ActorTraits.Label",
      empty: "ActionPlus.ActorTraits.EmptyHint",
      searchClass: "ts-actor-traits-search",
      listClass: "ts-actor-traits-list",
      rowClass: "ts-actor-traits-row",
      checkboxClass: "ts-actor-traits-checkbox",
      withRarity: false,
    },
  }),
  cleanup: cleanupTraitConfig,
});

Hooks.on("preUpdateItem", (item, changed) => {
  applyTraitRuleSyncToPendingUpdate(item, changed);
});

Hooks.on("createItem", (item) => {
  if (item.actor && isSupportedActionPlusItem(item)) void syncActorExtras(item.actor);
});

Hooks.on("updateItem", (item) => {
  if (item.actor && isSupportedActionPlusItem(item)) void syncActorExtras(item.actor);
});

Hooks.on("deleteItem", (item) => {
  const actor = item.actor ?? item.parent ?? null;
  if (actor && isSupportedActionPlusItem(item)) void syncActorExtras(actor);
});

Hooks.once("ready", () => {
  for (const actor of game.actors?.contents ?? []) {
    if (actor?.itemTypes?.action?.length) void syncActorExtras(actor);
  }
});

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.document ?? app?.actor ?? null;
  if (!actor?.itemTypes?.action?.length) return;

  const root = getHtmlElement(html);
  if (!root) return;

  const extras = getActorActionExtras(actor);
  appendActorLanguageTags(root, actor, extras.languages);
  appendActorSenseTags(root, actor, extras.senses);
});
