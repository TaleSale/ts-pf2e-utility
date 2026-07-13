import { I18N_PREFIX, MODULE_ID } from "../core.js";

const ACTION_PLUS_CONFIG_KEY = "TS_PF2E_UTILITY";
const FLAG_SCOPE = MODULE_ID;
const FLAG_ACTION_OPTION = "actionOption";
const FLAG_ACTION_OPTIONS = "actionOptions";
const SETTINGS_ROOT = "Settings.ActionPlus";

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function i18nKey(key) {
  return `${I18N_PREFIX}.${key}`;
}

function ensureActionPlusConfig() {
  CONFIG[ACTION_PLUS_CONFIG_KEY] ??= {};
  CONFIG[ACTION_PLUS_CONFIG_KEY].actionOptions ??= { "": `${I18N_PREFIX}.ActionPlus.Options.Empty` };
  CONFIG[ACTION_PLUS_CONFIG_KEY].actionPlusFeatures ??= new Map();
  CONFIG[ACTION_PLUS_CONFIG_KEY].registerActionPlusFeature ??= registerActionPlusFeature;
  return CONFIG[ACTION_PLUS_CONFIG_KEY];
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function localizeConfigLabel(label) {
  return typeof label === "string" && label.startsWith(`${I18N_PREFIX}.`)
    ? game.i18n.localize(label)
    : String(label ?? "");
}

export function isSupportedActionPlusItem(item) {
  return item?.type === "action";
}

export function normalizeActionOptions(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

export function getActionPlusOptionsFromFlags(flags = {}) {
  if (Array.isArray(flags?.[FLAG_ACTION_OPTIONS])) {
    return normalizeActionOptions(flags[FLAG_ACTION_OPTIONS]);
  }

  return normalizeActionOptions(flags?.[FLAG_ACTION_OPTION] ?? "");
}

export function getItemActionPlusOptions(item) {
  return getActionPlusOptionsFromFlags(item?.flags?.[FLAG_SCOPE] ?? {});
}

export function getPendingActionPlusOptions(item, changed) {
  const optionsPath = `flags.${FLAG_SCOPE}.${FLAG_ACTION_OPTIONS}`;
  const optionPath = `flags.${FLAG_SCOPE}.${FLAG_ACTION_OPTION}`;

  if (foundry.utils.hasProperty(changed, optionsPath)) {
    return normalizeActionOptions(foundry.utils.getProperty(changed, optionsPath));
  }

  if (foundry.utils.hasProperty(changed, optionPath)) {
    return normalizeActionOptions(foundry.utils.getProperty(changed, optionPath));
  }

  return getItemActionPlusOptions(item);
}

export function isActionPlusFeatureEnabled(item, featureId, changed) {
  return getPendingActionPlusOptions(item, changed).includes(featureId);
}

async function persistActionPlusOptions(item, nextOptions) {
  const normalizedOptions = normalizeActionOptions(nextOptions);

  await item.setFlag(FLAG_SCOPE, FLAG_ACTION_OPTIONS, normalizedOptions);

  if (normalizedOptions.length > 0) {
    await item.setFlag(FLAG_SCOPE, FLAG_ACTION_OPTION, normalizedOptions[0]);
  } else {
    await item.unsetFlag(FLAG_SCOPE, FLAG_ACTION_OPTION);
  }
}

export function registerActionPlusFeature(feature) {
  const config = ensureActionPlusConfig();

  if (!feature?.id) {
    console.warn(`${MODULE_ID} | ActionPlus feature skipped: missing id`, feature);
    return;
  }

  config.actionOptions[feature.id] = feature.label ?? feature.id;
  config.actionPlusFeatures.set(feature.id, feature);
}

function featureAllowsMultiple(featureId) {
  const feature = ensureActionPlusConfig().actionPlusFeatures.get(featureId);
  return feature?.allowMultiple === true;
}

function getOccurrenceIndex(options, optionIndex) {
  const featureId = options[optionIndex];
  if (!featureId) return -1;

  let occurrenceIndex = -1;
  for (let index = 0; index <= optionIndex; index += 1) {
    if (options[index] !== featureId) continue;
    occurrenceIndex += 1;
  }

  return occurrenceIndex;
}

function getFeatureVisibilitySettingKey(featureId) {
  return `actionPlusShow${String(featureId ?? "").charAt(0).toUpperCase()}${String(featureId ?? "").slice(1)}`;
}

function isFeatureVisible(featureId) {
  if (!featureId) return true;
  const settingKey = getFeatureVisibilitySettingKey(featureId);
  try {
    return game.settings.get(MODULE_ID, settingKey) !== false;
  } catch {
    return true;
  }
}

function rerenderOpenActionSheets() {
  for (const app of Object.values(ui.windows ?? {})) {
    const item = app?.document ?? app?.object ?? null;
    if (!isSupportedActionPlusItem(item)) continue;
    app.render(false);
  }
}

globalThis.TS_PF2E_UTILITY ??= {};
globalThis.TS_PF2E_UTILITY.registerActionPlusFeature = registerActionPlusFeature;

Hooks.once("init", () => {
  ensureActionPlusConfig();

  game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey("regeneration"), {
    name: i18nKey(`${SETTINGS_ROOT}.Regeneration.Name`),
    hint: i18nKey(`${SETTINGS_ROOT}.Regeneration.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      rerenderOpenActionSheets();
    },
  });

  game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey("bloodline"), {
    name: i18nKey(`${SETTINGS_ROOT}.BloodMagic.Name`),
    hint: i18nKey(`${SETTINGS_ROOT}.BloodMagic.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      rerenderOpenActionSheets();
    },
  });

  game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey("creatureAttack"), {
    name: i18nKey(`${SETTINGS_ROOT}.CreatureAttack.Name`),
    hint: i18nKey(`${SETTINGS_ROOT}.CreatureAttack.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      rerenderOpenActionSheets();
    },
  });

  game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey("damageAdjustments"), {
    name: i18nKey(`${SETTINGS_ROOT}.DamageAdjustments.Name`),
    hint: i18nKey(`${SETTINGS_ROOT}.DamageAdjustments.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      rerenderOpenActionSheets();
    },
  });

  game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey("enhancement"), {
    name: i18nKey(`${SETTINGS_ROOT}.Enhancement.Name`),
    hint: i18nKey(`${SETTINGS_ROOT}.Enhancement.Hint`),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      rerenderOpenActionSheets();
    },
  });

  for (const [featureId, i18nRoot] of [
    ["actorLanguages", "ActorLanguages"],
    ["actorSenses", "ActorSenses"],
    ["actorTraits", "ActorTraits"],
  ]) {
    game.settings.register(MODULE_ID, getFeatureVisibilitySettingKey(featureId), {
      name: i18nKey(`${SETTINGS_ROOT}.${i18nRoot}.Name`),
      hint: i18nKey(`${SETTINGS_ROOT}.${i18nRoot}.Hint`),
      scope: "world",
      config: true,
      default: true,
      type: Boolean,
      onChange: () => {
        rerenderOpenActionSheets();
      },
    });
  }
});

Hooks.on("renderItemSheet", (app, html) => {

  const item = app.document ?? app.object;
  if (!isSupportedActionPlusItem(item)) return;

  const root = getHtmlElement(html);
  if (!root) return;

  const config = ensureActionPlusConfig();
  const flags = item.flags?.[FLAG_SCOPE] ?? {};
  const currentOptions = getActionPlusOptionsFromFlags(flags);
  const selectableOptions = currentOptions.length > 0 ? currentOptions : [""];
  const visibleFeatureEntries = Object.entries(config.actionOptions).filter(([value]) => value && isFeatureVisible(value));
  const featureEntries = Object.entries(config.actionOptions).filter(([value]) => value);
  const canAddFeature = visibleFeatureEntries.some(([value]) => featureAllowsMultiple(value) || !currentOptions.includes(value));

  const buildOptionsHtml = (selectedValue, index) => {
    const usedByOthers = new Set(
      selectableOptions.filter((value, valueIndex) => valueIndex !== index && value),
    );

    const selectedEntry = selectedValue
      ? featureEntries.find(([value]) => value === selectedValue) ?? null
      : null;

    return [
      ["", config.actionOptions[""]],
      ...(selectedEntry && !isFeatureVisible(selectedValue) ? [selectedEntry] : []),
      ...visibleFeatureEntries.filter(([value]) => (
        value === selectedValue || featureAllowsMultiple(value) || !usedByOthers.has(value)
      )),
    ]
      .map(([value, label]) => {
        const optionLabel = localizeConfigLabel(label);
        return `<option value="${foundry.utils.escapeHTML(value)}" ${value === selectedValue ? "selected" : ""}>${foundry.utils.escapeHTML(optionLabel)}</option>`;
      })
      .join("");
  };

  const featureBlocksHtml = selectableOptions.map((selectedValue, index) => {
    const feature = selectedValue ? config.actionPlusFeatures.get(selectedValue) : null;
    const occurrenceIndex = selectedValue ? getOccurrenceIndex(selectableOptions, index) : -1;
    const featureLabel = selectedValue
      ? localizeConfigLabel(config.actionOptions[selectedValue] ?? selectedValue)
      : localize("ActionPlus.Labels.ExtraFunctions");
    const panelHtml = selectedValue && feature?.render instanceof Function
      ? `
        <div
          class="ts-utility-feature-panel"
          data-feature-id="${foundry.utils.escapeHTML(selectedValue)}"
          data-option-index="${index}"
          data-occurrence-index="${occurrenceIndex}"
          style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border-light-primary);"
        >
          <div style="font-weight: 600; margin-bottom: 6px;">${foundry.utils.escapeHTML(featureLabel)}</div>
          ${feature.render({ app, html: root, item, flags, optionIndex: index, occurrenceIndex }) ?? ""}
        </div>
      `
      : "";

    return `
      <div
        class="ts-utility-feature-block"
        data-index="${index}"
        style="margin-top: ${index === 0 ? "0" : "10px"}; padding: 8px; border: 1px solid var(--color-border-light-primary); border-radius: 3px;"
      >
        <div class="form-group" style="margin: 0;">
          <label>${localize("ActionPlus.Labels.ExtraFunctions")}</label>
          <div class="form-fields" style="gap: 6px; align-items: center;">
            <select class="ts-utility-select" data-index="${index}" style="flex: 1 1 auto;">
              ${buildOptionsHtml(selectedValue, index)}
            </select>
            ${selectedValue ? `
              <button
                type="button"
                class="ts-utility-remove-feature"
                data-index="${index}"
                data-tooltip="${foundry.utils.escapeHTML(localize("ActionPlus.Labels.RemoveFeature"))}"
                style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
              >
                <i class="fas fa-minus"></i>
              </button>
            ` : ""}
          </div>
        </div>
        ${panelHtml}
      </div>
    `;
  }).join("");

  let injectHtml = `
    <fieldset class="ts-utility-fieldset" style="margin-top: 10px; border: 1px solid var(--color-border-light-primary); padding: 5px; border-radius: 3px;">
      <div class="ts-utility-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
        <div style="font-weight: 600;">TS-PF2E-UTILITY</div>
        <button
          type="button"
          class="ts-utility-add-feature"
          ${canAddFeature ? "" : "disabled"}
          data-tooltip="${foundry.utils.escapeHTML(localize("ActionPlus.Labels.AddFeature"))}"
          style="flex: 0 0 24px; width: 24px; min-width: 24px; max-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;"
        >
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="ts-utility-feature-blocks">
        ${featureBlocksHtml}
      </div>
  `;

  injectHtml += "</fieldset>";

  const detailsTab = root.querySelector('.tab[data-tab="details"]') ?? root;
  const publicationFieldset = detailsTab.querySelector("fieldset.publication");

  if (publicationFieldset) {
    publicationFieldset.insertAdjacentHTML("afterend", injectHtml);
  } else {
    detailsTab.insertAdjacentHTML("beforeend", injectHtml);
  }

  const fieldset = root.querySelector(".ts-utility-fieldset:last-of-type");
  const selects = Array.from(fieldset?.querySelectorAll(".ts-utility-select") ?? []);
  const addButton = fieldset?.querySelector(".ts-utility-add-feature");
  const removeButtons = Array.from(fieldset?.querySelectorAll(".ts-utility-remove-feature") ?? []);

  addButton?.addEventListener("click", async () => {
    const nextFeature = visibleFeatureEntries
      .map(([value]) => value)
      .find((value) => featureAllowsMultiple(value) || !currentOptions.includes(value));
    if (!nextFeature) return;

    const nextOptions = [...currentOptions, nextFeature];
    await persistActionPlusOptions(item, nextOptions);
  });

  for (const select of selects) {
    select.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const optionIndex = Number(target.dataset.index);
      if (!Number.isInteger(optionIndex)) return;

      const nextOption = String(target.value ?? "").trim();
      const nextOptions = [...selectableOptions];
      const previousOption = nextOptions[optionIndex] ?? "";
      const previousOccurrenceIndex = getOccurrenceIndex(nextOptions, optionIndex);
      nextOptions[optionIndex] = nextOption;
      const shouldCleanupPrevious = previousOption && previousOption !== nextOption && (
        featureAllowsMultiple(previousOption) || !nextOptions.includes(previousOption)
      );

      if (shouldCleanupPrevious) {
        const previousFeature = config.actionPlusFeatures.get(previousOption);
        if (previousFeature?.cleanup instanceof Function) {
          await previousFeature.cleanup({ app, item, previousOption, nextOption, optionIndex, occurrenceIndex: previousOccurrenceIndex });
        }
      }

      await persistActionPlusOptions(item, nextOptions);
    });
  }

  for (const button of removeButtons) {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      const optionIndex = Number(target.dataset.index);
      if (!Number.isInteger(optionIndex)) return;

      const nextOptions = [...selectableOptions];
      const [removedOption = ""] = nextOptions.splice(optionIndex, 1);
      const removedOccurrenceIndex = getOccurrenceIndex(selectableOptions, optionIndex);
      const previousFeature = config.actionPlusFeatures.get(removedOption);
      const shouldCleanupRemoved = removedOption && (
        featureAllowsMultiple(removedOption) || !nextOptions.includes(removedOption)
      );

      if (shouldCleanupRemoved && previousFeature?.cleanup instanceof Function) {
        await previousFeature.cleanup({
          app,
          item,
          previousOption: removedOption,
          nextOption: "",
          optionIndex,
          occurrenceIndex: removedOccurrenceIndex,
        });
      }

      await persistActionPlusOptions(item, nextOptions);
    });
  }

  for (let optionIndex = 0; optionIndex < currentOptions.length; optionIndex += 1) {
    const option = currentOptions[optionIndex];
    const feature = config.actionPlusFeatures.get(option);
    if (feature?.activateListeners instanceof Function) {
      feature.activateListeners({
        app,
        html: root,
        item,
        flags,
        optionIndex,
        occurrenceIndex: getOccurrenceIndex(currentOptions, optionIndex),
      });
    }
  }
});
