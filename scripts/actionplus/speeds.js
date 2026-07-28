import { MODULE_ID } from "../core.js";
import { registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "speeds";
const FLAG_KEY = "speeds";
const RULE_SLUG_PREFIX = "tsu-speed-";
const LAND_SPEED_REFERENCE = "@actor.system.movement.speeds.land.value";

const SPEED_TYPES = [
  ["land", "Наземная"],
  ["swim", "Плавание"],
  ["climb", "Карабканье"],
  ["fly", "Полёт"],
  ["burrow", "Рытьё"],
  ["all", "Все скорости"],
];
const MODIFIER_TYPES = [
  ["circumstance", "Обстоятельства"],
  ["status", "Состояние"],
  ["item", "Предмет"],
  ["untyped", "Без типа"],
];
const MODES = [
  ["modifier", "Изменить на"],
  ["base", "Задать скорость"],
  ["land", "Равна наземной"],
  ["half-land", "Половина наземной"],
];

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function optionsHtml(options, selected) {
  return options.map(([value, label]) => (
    `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function getDefaultConfig() {
  return { type: "land", mode: "modifier", modifierType: "status", sign: "+", value: 5 };
}

function normalizeConfig(value) {
  const config = { ...getDefaultConfig(), ...(value && typeof value === "object" ? value : {}) };
  config.type = SPEED_TYPES.some(([type]) => type === config.type) ? config.type : "land";
  config.mode = MODES.some(([mode]) => mode === config.mode) ? config.mode : "modifier";
  if (config.type === "land" && (config.mode === "land" || config.mode === "half-land")) config.mode = "modifier";
  config.modifierType = MODIFIER_TYPES.some(([type]) => type === config.modifierType) ? config.modifierType : "status";
  config.sign = config.sign === "-" ? "-" : "+";
  config.value = Math.max(0, Math.trunc(Number(config.value) || 0));
  return config;
}

function getConfigs(item) {
  const stored = item.getFlag(MODULE_ID, FLAG_KEY);
  return Array.isArray(stored) ? stored.map(normalizeConfig) : [];
}

function getAdjustment(config) {
  return config.sign === "-" ? -config.value : config.value;
}

function getBaseValue(config) {
  const adjustment = getAdjustment(config);
  if (config.mode === "base") return Math.max(1, config.value || 1);
  const expression = config.mode === "half-land" ? `${LAND_SPEED_REFERENCE} / 2` : LAND_SPEED_REFERENCE;
  return adjustment ? `${expression} ${adjustment > 0 ? "+" : "-"} ${Math.abs(adjustment)}` : expression;
}

function getSpeedTypes(type, mode) {
  if (type !== "all") return [type];
  return mode === "modifier" ? ["all"] : ["land", "swim", "climb", "fly", "burrow"];
}

function buildRules(configs) {
  return configs.flatMap((config, index) => getSpeedTypes(config.type, config.mode).flatMap((speedType) => {
    if ((config.mode === "land" || config.mode === "half-land") && speedType === "land") return [];
    const slug = `${RULE_SLUG_PREFIX}${index}-${speedType}`;
    if (config.mode === "modifier") {
      const rule = {
        key: "FlatModifier",
        label: `Скорость ${config.sign}${config.value}`,
        selector: speedType === "all" ? "all-speeds" : `${speedType}-speed`,
        slug,
        value: getAdjustment(config),
      };
      if (config.modifierType !== "untyped") rule.type = config.modifierType;
      return [rule];
    }
    const rules = [{
      key: "BaseSpeed",
      label: "Скорость",
      selector: speedType,
      slug,
      value: getBaseValue(config),
    }];
    // References to land speed are resolved while PF2e prepares movement. Make an
    // exact land speed visible at that stage, not only in the final trace.
    if (config.mode === "base" && speedType === "land") {
      for (const property of ["base", "value"]) rules.push({
        key: "ActiveEffectLike",
        mode: "override",
        phase: "beforeDerived",
        path: `system.movement.speeds.land.${property}`,
        slug: `${slug}-early-${property}`,
        value: getBaseValue(config),
      });
    }
    // BaseSpeed can only raise a speed because PF2e selects the highest source.
    // Override the final trace as well so "set" is an exact value, even when a
    // different item grants a higher speed.
    if (config.mode === "base") {
      for (const property of ["base", "value"]) rules.push({
        key: "ActiveEffectLike",
        mode: "override",
        phase: "afterDerived",
        path: `system.movement.speeds.${speedType}.${property}`,
        slug: `${slug}-override-${property}`,
        value: getBaseValue(config),
      });
    }
    return rules;
  }));
}

function getUpdatedRules(item, configs) {
  const existing = foundry.utils.deepClone(item._source?.system?.rules ?? item.system?.rules ?? []);
  const retained = existing.filter((rule) => !String(rule?.slug ?? "").startsWith(RULE_SLUG_PREFIX));
  return [...retained, ...buildRules(configs)];
}

async function persistConfigsAndRules(item, configs) {
  await item.update({
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: configs,
    "system.rules": getUpdatedRules(item, configs),
  });
}

async function ensureRules(item, configs) {
  const existing = item._source?.system?.rules ?? item.system?.rules ?? [];
  const rules = getUpdatedRules(item, configs);
  if (JSON.stringify(existing) !== JSON.stringify(rules)) await item.update({ "system.rules": rules });
}

function renderSpeedControls({ item, occurrenceIndex }) {
  const config = getConfigs(item)[occurrenceIndex] ?? getDefaultConfig();
  const isBase = config.mode === "base";
  const isReference = config.mode === "land" || config.mode === "half-land";
  return `
    <div class="tsu-speeds-panel" style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px;">
      <select data-field="type">${optionsHtml(SPEED_TYPES, config.type)}</select>
      <select data-field="mode">${optionsHtml(config.type === "land" ? MODES.slice(0, 2) : MODES, config.mode)}</select>
      <select data-field="modifierType" class="tsu-speed-modifier-type" ${isBase || isReference ? "hidden" : ""}>${optionsHtml(MODIFIER_TYPES, config.modifierType)}</select>
      <select data-field="sign" class="tsu-speed-sign" ${isBase ? "hidden" : ""}><option value="+" ${config.sign === "+" ? "selected" : ""}>+</option><option value="-" ${config.sign === "-" ? "selected" : ""}>-</option></select>
      <input type="number" min="0" step="5" value="${config.value}" data-field="value">
      <span class="tsu-speed-hint" ${isReference ? "" : "hidden"} style="align-self:center; color:var(--color-text-dark-secondary);">Знак и число — необязательная поправка.</span>
    </div>
  `;
}

async function activateSpeedListeners({ html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? html?.element;
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .tsu-speeds-panel`);
  if (!panel) return;
  const initialConfigs = getConfigs(item);
  if (initialConfigs.length <= occurrenceIndex) {
    while (initialConfigs.length <= occurrenceIndex) initialConfigs.push(getDefaultConfig());
    await persistConfigsAndRules(item, initialConfigs);
  } else {
    await ensureRules(item, initialConfigs);
  }
  const persist = async () => {
    const configs = getConfigs(item);
    while (configs.length <= occurrenceIndex) configs.push(getDefaultConfig());
    const raw = Object.fromEntries(Array.from(panel.querySelectorAll("[data-field]")).map((input) => [input.dataset.field, input.value]));
    configs[occurrenceIndex] = normalizeConfig(raw);
    await persistConfigsAndRules(item, configs);
  };
  const typeSelect = panel.querySelector('[data-field="type"]');
  const modeSelect = panel.querySelector('[data-field="mode"]');
  const valueInput = panel.querySelector('[data-field="value"]');
  const modifierTypeSelect = panel.querySelector('.tsu-speed-modifier-type');
  const signSelect = panel.querySelector('.tsu-speed-sign');
  const hint = panel.querySelector('.tsu-speed-hint');
  const syncControls = () => {
    const mode = modeSelect?.value;
    const isBase = mode === "base";
    const isReference = mode === "land" || mode === "half-land";
    if (modifierTypeSelect) modifierTypeSelect.hidden = isBase || isReference;
    if (signSelect) signSelect.hidden = isBase;
    if (hint) hint.hidden = !isReference;
  };
  typeSelect?.addEventListener("change", () => {
    if (!(modeSelect instanceof HTMLSelectElement)) return;
    const selected = modeSelect.value;
    modeSelect.innerHTML = optionsHtml(typeSelect.value === "land" ? MODES.slice(0, 2) : MODES, selected);
    if (!modeSelect.value) modeSelect.value = "modifier";
    syncControls();
  });
  modeSelect?.addEventListener("change", () => {
    const isReference = modeSelect.value === "land" || modeSelect.value === "half-land";
    if (isReference && modeSelect.dataset.previousMode !== modeSelect.value && valueInput instanceof HTMLInputElement) valueInput.value = "0";
    modeSelect.dataset.previousMode = modeSelect.value;
    syncControls();
  });
  if (modeSelect) modeSelect.dataset.previousMode = modeSelect.value;
  for (const input of panel.querySelectorAll("[data-field]")) input.addEventListener("change", persist);
}

async function cleanupSpeeds({ item, occurrenceIndex = 0 }) {
  const configs = getConfigs(item);
  configs.splice(occurrenceIndex, 1);
  const update = {
    "system.rules": getUpdatedRules(item, configs),
  };
  if (configs.length) update[`flags.${MODULE_ID}.${FLAG_KEY}`] = configs;
  else update[`flags.${MODULE_ID}.-=${FLAG_KEY}`] = null;
  await item.update(update);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: "Скорости",
  allowMultiple: true,
  render: renderSpeedControls,
  activateListeners: activateSpeedListeners,
  cleanup: cleanupSpeeds,
});
