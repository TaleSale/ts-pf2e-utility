import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";
import { STRIKE_DAMAGE_TABLE } from "./creature-attack.js";

const FEATURE_ID = "troopDamage";
const FLAG_KEY = "troopDamage";
const GENERATED_FLAG = "troopDamageGenerated";
const DESCRIPTION_START = "<!-- ts-pf2e-utility:troop-damage:auto:start -->";
const DESCRIPTION_END = "<!-- ts-pf2e-utility:troop-damage:auto:end -->";
const APPLYING_ITEMS = new WeakSet();
const PHYSICAL_TYPES = ["piercing", "slashing", "bludgeoning"];
const PHYSICAL_RULE_LABELS = {
  piercing: "PF2E.TraitPiercing",
  slashing: "PF2E.TraitSlashing",
  bludgeoning: "PF2E.TraitBludgeoning",
};
const SPELL_DC_TABLE = {
  extreme: [19, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36, 37, 39, 40, 41, 43, 44, 46, 47, 48, 50, 51, 52],
  high: [16, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40, 41, 42, 44, 45, 46, 48],
  moderate: [13, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 45],
};

const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.TroopDamage.${key}`);

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function getDefaultConfig() {
  return {
    mode: "variable",
    fixedAreaType: "burst",
    save: "reflex",
    dcQuality: "moderate",
    emanation: 10,
    burstLarge: 10,
    burstSmall: 5,
    range: 60,
    damageReduction: 0,
    damageTypes: [...PHYSICAL_TYPES],
  };
}

function normalizeConfig(value) {
  const config = { ...getDefaultConfig(), ...(value && typeof value === "object" ? value : {}) };
  config.mode = config.mode === "fixed" ? "fixed" : "variable";
  config.fixedAreaType = ["burst", "line", "cone", "emanation"].includes(config.fixedAreaType) ? config.fixedAreaType : "burst";
  config.save = ["fortitude", "reflex", "will"].includes(config.save) ? config.save : "reflex";
  config.dcQuality = ["extreme", "high", "moderate", "low"].includes(config.dcQuality) ? config.dcQuality : "moderate";
  for (const field of ["emanation", "burstLarge", "burstSmall", "range"]) {
    config[field] = Math.max(5, Math.trunc(Number(config[field]) || 5));
  }
  config.damageReduction = Math.max(0, Math.trunc(Number(config.damageReduction) || 0));
  config.damageTypes = Array.from(new Set((Array.isArray(config.damageTypes) ? config.damageTypes : PHYSICAL_TYPES)
    .map((type) => String(type ?? "").trim()).filter(Boolean)));
  if (!config.damageTypes.length) config.damageTypes = [...PHYSICAL_TYPES];
  return config;
}

function getConfig(item) {
  return normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
}

function getActorLevel(actor) {
  const raw = actor?.system?.details?.level?.value ?? actor?.system?.details?.level ?? actor?.level ?? 0;
  return Math.max(-1, Math.min(24, Math.trunc(Number(raw) || 0)));
}

function getDc(actor, quality) {
  const index = getActorLevel(actor) + 1;
  if (quality === "low") return Math.max(0, SPELL_DC_TABLE.moderate[index] - 2);
  return SPELL_DC_TABLE[quality]?.[index] ?? SPELL_DC_TABLE.moderate[index] ?? 13;
}

function getDamageTypeChoices() {
  const entries = Object.entries(CONFIG.PF2E?.damageTypes ?? {});
  return entries.length ? entries : PHYSICAL_TYPES.map((type) => [type, `PF2E.Trait${type.charAt(0).toUpperCase()}${type.slice(1)}`]);
}

function renderOptions(entries, selected, localizeLabels = false) {
  return entries.map(([value, label]) => {
    const text = localizeLabels ? game.i18n.localize(String(label ?? value)) : String(label ?? value);
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`;
  }).join("");
}

function getLocalizedDamageTypeLabel(label, value) {
  return game.i18n.localize(String(label ?? value));
}

function renderDamageTypeSummary(config, choices) {
  const labels = new Map(choices.map(([value, label]) => [value, getLocalizedDamageTypeLabel(label, value)]));
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${config.damageTypes
    .map((value) => `<span class="tag" style="margin:0">${escapeHtml(labels.get(value) ?? value)}</span>`)
    .join("")}</div>`;
}

function renderDamageTypeCheckboxes(selectedTypes, choices) {
  const selected = new Set(selectedTypes);
  return `
    <div class="ts-troop-damage-type-picker" style="display:flex;flex-direction:column;gap:6px">
      <input type="search" class="ts-troop-damage-type-search" placeholder="${escapeHtml(localize("SearchPlaceholder"))}" style="width:100%">
      <div class="ts-troop-damage-type-list" style="max-height:460px;overflow-y:auto;border:1px solid var(--color-border-light-tertiary);background:rgba(0,0,0,.04)">
        ${choices.map(([value, label]) => {
          const text = getLocalizedDamageTypeLabel(label, value);
          return `<label class="ts-troop-damage-type-row" data-search="${escapeHtml(text.toLocaleLowerCase(game.i18n.lang || undefined))}" style="display:flex;align-items:center;gap:8px;min-height:28px;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,.08);cursor:pointer">
            <input type="checkbox" name="damageType" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""} style="flex:0 0 auto">
            <span style="min-width:0;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(text)}</span>
          </label>`;
        }).join("")}
      </div>
    </div>`;
}

function openDamageTypeDialog(selectedTypes) {
  const choices = getDamageTypeChoices();
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    new Dialog({
      title: localize("DamageTypesDialogTitle"),
      content: `<form>${renderDamageTypeCheckboxes(selectedTypes, choices)}</form>`,
      buttons: {
        update: {
          icon: '<i class="fas fa-save"></i>',
          label: localize("UpdateTypesButton"),
          callback: (html) => {
            const root = getHtmlElement(html);
            finish(Array.from(root?.querySelectorAll('input[name="damageType"]:checked') ?? []).map((input) => input.value));
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: localize("CancelButton"),
          callback: () => finish(null),
        },
      },
      default: "update",
      render: (html) => {
        const root = getHtmlElement(html);
        root?.querySelector(".ts-troop-damage-type-search")?.addEventListener("input", (event) => {
          const term = String(event.currentTarget.value ?? "").trim().toLocaleLowerCase(game.i18n.lang || undefined);
          for (const row of root.querySelectorAll(".ts-troop-damage-type-row")) row.hidden = Boolean(term) && !String(row.dataset.search ?? "").includes(term);
        });
      },
      close: () => finish(null),
    }).render(true);
  });
}

function renderControls({ item, flags }) {
  const config = normalizeConfig(flags?.[FLAG_KEY]);
  const allTypes = getDamageTypeChoices();
  return `
    <p class="notes" style="margin:0 0 8px">${escapeHtml(localize("Hint"))}</p>
    <div class="form-group"><label>${escapeHtml(localize("ModeLabel"))}</label><div class="form-fields">
      <select class="ts-troop-damage-input" data-field="mode">
        ${renderOptions([["variable", localize("VariableMode")], ["fixed", localize("FixedMode")]], config.mode)}
      </select>
    </div></div>
    <div class="form-group"><label>${escapeHtml(localize("SaveLabel"))}</label><div class="form-fields">
      <select class="ts-troop-damage-input" data-field="save">${renderOptions([["fortitude", localize("Fortitude")], ["reflex", localize("Reflex")], ["will", localize("Will")]], config.save)}</select>
      <select class="ts-troop-damage-input" data-field="dcQuality">${renderOptions([["extreme", localize("Extreme")], ["high", localize("High")], ["moderate", localize("Moderate")], ["low", localize("Low")]], config.dcQuality)}</select>
      <span class="notes">${escapeHtml(localize("CurrentDc").replace("{dc}", getDc(item.actor, config.dcQuality)))}</span>
    </div></div>
    <div class="form-group ts-troop-variable" style="${config.mode === "variable" ? "" : "display:none"}"><label>${escapeHtml(localize("EmanationLabel"))}</label><div class="form-fields"><input type="number" min="5" step="5" class="ts-troop-damage-input" data-field="emanation" value="${config.emanation}"></div></div>
    <div class="ts-troop-fixed" style="${config.mode === "fixed" ? "" : "display:none"}">
      <div class="form-group"><label>${escapeHtml(localize("AreaTypeLabel"))}</label><div class="form-fields"><select class="ts-troop-damage-input" data-field="fixedAreaType">${renderOptions([
        ["burst", localize("AreaBurst")], ["line", localize("AreaLine")], ["cone", localize("AreaCone")], ["emanation", localize("AreaEmanation")],
      ], config.fixedAreaType)}</select></div></div>
      <div class="form-group"><label>${escapeHtml(localize("AreaLargeLabel"))}</label><div class="form-fields"><input type="number" min="5" step="5" class="ts-troop-damage-input" data-field="burstLarge" value="${config.burstLarge}"></div></div>
      <div class="form-group"><label>${escapeHtml(localize("AreaSmallLabel"))}</label><div class="form-fields"><input type="number" min="5" step="5" class="ts-troop-damage-input" data-field="burstSmall" value="${config.burstSmall}"></div></div>
      <div class="form-group" style="${config.fixedAreaType === "burst" ? "" : "display:none"}"><label>${escapeHtml(localize("RangeLabel"))}</label><div class="form-fields"><input type="number" min="5" step="5" class="ts-troop-damage-input" data-field="range" value="${config.range}"></div></div>
    </div>
    <div class="form-group"><label>${escapeHtml(localize("ReductionLabel"))}</label><div class="form-fields"><input type="number" min="0" step="1" class="ts-troop-damage-input" data-field="damageReduction" value="${config.damageReduction}"></div></div>
    <div class="form-group"><label>${escapeHtml(localize("DamageTypesLabel"))}</label><div class="form-fields" style="display:block">
      <input type="hidden" class="ts-troop-damage-types" value="${escapeHtml(config.damageTypes.join(","))}">
      <button type="button" class="ts-troop-damage-open-types" style="width:auto;min-width:32px;padding:2px 8px"><i class="fas fa-tags"></i> ${escapeHtml(localize("ChooseDamageTypesButton"))}</button>
      ${renderDamageTypeSummary(config, allTypes)}
    </div></div>
  `;
}

function readConfig(panel) {
  const config = getDefaultConfig();
  for (const input of panel.querySelectorAll(".ts-troop-damage-input")) config[input.dataset.field] = input.value;
  config.damageTypes = String(panel.querySelector(".ts-troop-damage-types")?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return normalizeConfig(config);
}

function scaleDamage(formula, numerator, denominator, reduction) {
  const match = String(formula).replaceAll(" ", "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return String(formula);

  const dice = Number(match[1]);
  const faces = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  const factor = numerator / denominator;
  const scaledDice = numerator === denominator ? dice : Math.max(0, Math.round(dice * factor));
  const targetAverage = (dice * (faces + 1) / 2 + modifier) * factor - reduction;
  if (targetAverage <= 0) return "0";

  const scaledModifier = Math.round(targetAverage - scaledDice * (faces + 1) / 2);
  if (scaledDice === 0) return String(Math.max(1, Math.round(targetAverage)));
  return `${scaledDice}d${faces}${scaledModifier > 0 ? `+${scaledModifier}` : scaledModifier < 0 ? scaledModifier : ""}`;
}

function damageButton(formula, numerator, denominator, reduction, mode) {
  const selection = mode === "fixed" ? "troopsShoots" : "troopsStrikes";
  return `@Damage[${scaleDamage(formula, numerator, denominator, reduction)}[@item.flags.pf2e.rulesSelections.${selection}]|options:area-damage]`;
}

function qualityFormula(actor, quality) {
  return STRIKE_DAMAGE_TABLE[String(getActorLevel(actor))]?.[quality] ?? "1d4";
}

function templateButton(type, distance) {
  return `@Template[type:${type}|distance:${distance}]`;
}

function buildDescription(item, config) {
  const dc = getDc(item.actor, config.dcQuality);
  const check = `@Check[${config.save}|dc:${dc}|basic|options:area-effect]`;
  const high = qualityFormula(item.actor, "high");
  const moderate = qualityFormula(item.actor, "moderate");
  const low = qualityFormula(item.actor, "low");
  if (config.mode === "fixed") {
    const area = templateButton(config.fixedAreaType, config.burstLarge);
    const smallArea = templateButton(config.fixedAreaType, config.burstSmall);
    const introKey = config.fixedAreaType === "burst" ? "FixedIntroBurst" : "FixedIntroArea";
    return `<p>${localize(introKey).replace("{area}", area).replace("{range}", config.range).replace("{check}", check).replace("{small}", smallArea)}</p>`
      + `<p>${escapeHtml(localize("FixedEnding"))}</p>`
      + `<p><strong>${escapeHtml(localize("FourSegments"))}</strong> ${damageButton(high, 3, 4, config.damageReduction, config.mode)}<br>`
      + `<strong>${escapeHtml(localize("ThreeSegments"))}</strong> ${damageButton(moderate, 3, 4, config.damageReduction, config.mode)}<br>`
      + `<strong>${escapeHtml(localize("TwoSegments"))}</strong> ${damageButton(low, 3, 4, config.damageReduction, config.mode)}</p>`;
  }
  const rows = [
    [localize("FourSegments"), high], [localize("ThreeSegments"), moderate], [localize("TwoSegments"), low],
  ].map(([label, formula]) => `<strong>${escapeHtml(label)}</strong><br>◆ ${damageButton(formula, 1, 3, config.damageReduction, config.mode)}<br>◆◆ ${damageButton(formula, 2, 3, config.damageReduction, config.mode)}<br>◆◆◆ ${damageButton(formula, 1, 1, config.damageReduction, config.mode)}`).join("<br>");
  return `<p><strong>${escapeHtml(localize("FrequencyLabel"))}</strong> ${escapeHtml(localize("OncePerRound"))}</p><p>${localize("VariableIntro").replace("{template}", templateButton("emanation", config.emanation)).replace("{check}", check)}</p><p>${escapeHtml(localize("VariableEnding"))}</p><p>${rows}</p>`;
}

function wrapGeneratedDescription(description) {
  return `${DESCRIPTION_START}<div class="tsu-troop-damage-auto-description">${description}</div>${DESCRIPTION_END}`;
}

function mergeDescription(item, generatedDescription) {
  const current = String(item.system?.description?.value ?? "");
  const startIndex = current.indexOf(DESCRIPTION_START);
  const endIndex = current.indexOf(DESCRIPTION_END);
  const wrapped = wrapGeneratedDescription(generatedDescription);

  if (startIndex >= 0 && endIndex >= startIndex) {
    return `${current.slice(0, startIndex)}${wrapped}${current.slice(endIndex + DESCRIPTION_END.length)}`;
  }

  if (item.getFlag(MODULE_ID, GENERATED_FLAG)) {
    const legacyBlock = current.match(/<p>[^<]*@Template\[(?:emanation|burst)\|distance:[\s\S]*$/i);
    const manualPrefix = legacyBlock ? current.slice(0, legacyBlock.index).trimEnd() : "";
    return manualPrefix ? `${manualPrefix}\n${wrapped}` : wrapped;
  }

  const manualDescription = current.trimEnd();
  return manualDescription ? `${manualDescription}\n${wrapped}` : wrapped;
}

function removeGeneratedDescription(item) {
  const current = String(item.system?.description?.value ?? "");
  const startIndex = current.indexOf(DESCRIPTION_START);
  const endIndex = current.indexOf(DESCRIPTION_END);
  if (startIndex < 0 || endIndex < startIndex) return current;
  return `${current.slice(0, startIndex)}${current.slice(endIndex + DESCRIPTION_END.length)}`.trim();
}

function removeGeneratedRules(item) {
  const existing = Array.isArray(item.system?.rules) ? foundry.utils.deepClone(item.system.rules) : [];
  return existing.filter((rule) => {
    if (rule?.key === "RollOption" && ["troops-strikes", "troops-shoots"].includes(rule.option)) return false;
    return !(rule?.key === "DamageAlteration" && rule?.property === "damage-type" && rule?.selectors?.includes("{item|id}-inline-damage"));
  });
}

function buildRules(item, config) {
  const camel = config.mode === "fixed" ? "troopsShoots" : "troopsStrikes";
  const option = config.mode === "fixed" ? "troops-shoots" : "troops-strikes";
  const labels = new Map(getDamageTypeChoices());
  return [{
    alwaysActive: true, key: "RollOption", option,
    suboptions: config.damageTypes.map((value) => ({ label: PHYSICAL_RULE_LABELS[value] ?? labels.get(value) ?? value, value })),
    toggleable: true, value: true,
  }, {
    key: "DamageAlteration", mode: "override", property: "damage-type",
    selectors: ["{item|id}-inline-damage"], value: `{item|flags.pf2e.rulesSelections.${camel}}`,
  }];
}

async function apply(item, config) {
  if (APPLYING_ITEMS.has(item)) return;
  APPLYING_ITEMS.add(item);
  try {
  const existing = Array.isArray(item.system?.rules) ? foundry.utils.deepClone(item.system.rules) : [];
  const generated = item.getFlag(MODULE_ID, GENERATED_FLAG);
  const oldOptions = new Set([generated?.option, "troops-strikes", "troops-shoots"].filter(Boolean));
  const rules = existing.filter((rule) => {
    if (rule?.key === "RollOption" && oldOptions.has(rule.option)) return false;
    return !(rule?.key === "DamageAlteration" && rule?.property === "damage-type" && rule?.selectors?.includes("{item|id}-inline-damage"));
  });
  const nextRules = buildRules(item, config);
  await item.update({
    "system.description.value": mergeDescription(item, buildDescription(item, config)),
    "system.rules": [...rules, ...nextRules],
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: config,
    [`flags.${MODULE_ID}.${GENERATED_FLAG}`]: { option: nextRules[0].option, version: 4 },
  });
  } finally {
    APPLYING_ITEMS.delete(item);
  }
}

function activateListeners({ html, item, optionIndex }) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;
  if (item.getFlag(MODULE_ID, GENERATED_FLAG)?.version !== 4) {
    void apply(item, getConfig(item));
  }
  for (const input of panel.querySelectorAll(".ts-troop-damage-input")) {
    input.addEventListener("change", async () => {
      await apply(item, readConfig(panel));
      if (["mode", "fixedAreaType"].includes(input.dataset.field)) item.sheet?.render(false);
    });
  }
  panel.querySelector(".ts-troop-damage-open-types")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const selected = await openDamageTypeDialog(readConfig(panel).damageTypes);
    if (!selected?.length) return;
    const input = panel.querySelector(".ts-troop-damage-types");
    if (input) input.value = selected.join(",");
    await apply(item, readConfig(panel));
    item.sheet?.render(false);
  });
}

async function cleanup({ item }) {
  await item.update({
    "system.description.value": removeGeneratedDescription(item),
    "system.rules": removeGeneratedRules(item),
  });
  await item.unsetFlag(MODULE_ID, FLAG_KEY);
  await item.unsetFlag(MODULE_ID, GENERATED_FLAG);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.TroopDamage.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup,
});

Hooks.on("updateItem", (item, changed) => {
  if (item.type !== "action" || !isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;
  const optionsChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOptions`)
    || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOption`);
  if (optionsChanged) {
    void apply(item, getConfig(item));
  }
});

Hooks.on("updateActor", (actor, changed) => {
  const levelChanged = foundry.utils.hasProperty(changed, "system.details.level.value")
    || foundry.utils.hasProperty(changed, "system.details.level")
    || foundry.utils.hasProperty(changed, "level");
  if (!levelChanged) return;
  for (const item of actor.itemTypes?.action ?? []) {
    if (isActionPlusFeatureEnabled(item, FEATURE_ID)) void apply(item, getConfig(item));
  }
});

Hooks.on("createItem", (item) => {
  if (item.actor && item.type === "action" && isActionPlusFeatureEnabled(item, FEATURE_ID)) {
    void apply(item, getConfig(item));
  }
});

Hooks.on("createActor", (actor) => {
  for (const item of actor.itemTypes?.action ?? []) {
    if (isActionPlusFeatureEnabled(item, FEATURE_ID)) void apply(item, getConfig(item));
  }
});
