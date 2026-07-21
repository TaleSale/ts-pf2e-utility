import { I18N_PREFIX, MODULE_ID } from "../core.js";
import {
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const FEATURE_ID = "criticalSpecialization";
const FLAG_KEY = "criticalSpecialization";

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function normalizeList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [value])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)));
}

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const numericLevel = Number(source.level);
  return {
    level: Number.isInteger(numericLevel) && numericLevel >= 0 ? numericLevel : null,
    categories: normalizeList(source.categories),
    groups: normalizeList(source.groups),
    traits: normalizeList(source.traits),
    bases: normalizeList(source.bases),
  };
}

function configChoices(source) {
  return Object.entries(source ?? {}).map(([slug, label]) => {
    const localized = game.i18n.localize(String(label ?? slug));
    return [slug, localized === String(label) ? String(label ?? slug) : localized];
  }).sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang || "en", { sensitivity: "base" }));
}

function buildPredicate(configValue) {
  const config = normalizeConfig(configValue);
  const predicate = [];
  if (config.level !== null) predicate.push({ gte: ["self:level", config.level] });

  const filters = [
    ...config.categories.map((slug) => `item:category:${slug}`),
    ...config.groups.map((slug) => `item:group:${slug}`),
    ...config.traits.map((slug) => `item:trait:${slug}`),
    ...config.bases.map((slug) => `item:base:${slug}`),
  ];
  if (filters.length === 1) predicate.push(filters[0]);
  if (filters.length > 1) predicate.push({ or: filters });
  return predicate;
}

function buildRule(config) {
  const rule = { key: "CriticalSpecialization" };
  const predicate = buildPredicate(config);
  if (predicate.length) rule.predicate = predicate;
  return rule;
}

function renderCheckboxSection(title, field, choices, selected) {
  return `
    <details style="margin-top: 6px;">
      <summary style="cursor: pointer; font-weight: 600;">${foundry.utils.escapeHTML(title)} (${selected.length})</summary>
      <div style="max-height: 210px; overflow-y: auto; padding: 6px 4px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 3px 10px;">
        ${choices.map(([slug, label]) => `
          <label class="checkbox" style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="ts-critical-specialization-filter" data-field="${field}" value="${foundry.utils.escapeHTML(slug)}" ${selected.includes(slug) ? "checked" : ""}>
            <span>${foundry.utils.escapeHTML(label)}</span>
          </label>
        `).join("")}
      </div>
    </details>
  `;
}

function renderControls({ flags }) {
  const config = normalizeConfig(flags?.[FLAG_KEY]);
  const categoryChoices = configChoices(CONFIG.PF2E?.weaponCategories);
  const groupChoices = configChoices(CONFIG.PF2E?.weaponGroups);
  const traitChoices = configChoices(CONFIG.PF2E?.weaponTraits);
  const baseLabels = CONFIG.PF2E?.baseWeaponTypes ?? {};

  return `
    <p class="notes" style="margin: 0 0 8px;">${localize("ActionPlus.CriticalSpecialization.Hint")}</p>
    <div class="form-group">
      <label>${localize("ActionPlus.CriticalSpecialization.LevelLabel")}</label>
      <div class="form-fields"><input type="number" min="0" step="1" class="ts-critical-specialization-level" value="${config.level ?? ""}" placeholder="${localize("ActionPlus.CriticalSpecialization.AnyLevel")}"></div>
    </div>
    ${renderCheckboxSection(localize("ActionPlus.CriticalSpecialization.CategoriesLabel"), "categories", categoryChoices, config.categories)}
    ${renderCheckboxSection(localize("ActionPlus.CriticalSpecialization.GroupsLabel"), "groups", groupChoices, config.groups)}
    ${renderCheckboxSection(localize("ActionPlus.CriticalSpecialization.TraitsLabel"), "traits", traitChoices, config.traits)}
    <div class="ts-critical-specialization-drop" style="margin-top: 8px; padding: 10px; border: 1px dashed var(--color-border-light-primary); border-radius: 4px; text-align: center;">
      ${localize("ActionPlus.CriticalSpecialization.DropHint")}
    </div>
    <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
      ${config.bases.map((slug) => `<button type="button" class="ts-critical-specialization-remove-base" data-base="${foundry.utils.escapeHTML(slug)}" style="width: auto;"><i class="fas fa-times"></i> ${foundry.utils.escapeHTML(game.i18n.localize(baseLabels[slug] ?? slug))}</button>`).join("") || `<span class="notes">${localize("ActionPlus.CriticalSpecialization.EmptyBases")}</span>`}
    </div>
  `;
}

async function persist(item, config) {
  await item.setFlag(MODULE_ID, FLAG_KEY, normalizeConfig(config));
}

async function documentFromDrop(event) {
  const data = TextEditor.getDragEventData(event);
  if (data?.uuid) return fromUuid(data.uuid);
  if (data?.type === "Item" && data?.id) return game.items.get(data.id) ?? null;
  return null;
}

function activateListeners({ html, item, optionIndex }) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;

  panel.querySelector(".ts-critical-specialization-level")?.addEventListener("change", async (event) => {
    const config = normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
    const raw = String(event.currentTarget.value ?? "").trim();
    config.level = raw === "" ? null : Math.max(0, Math.trunc(Number(raw) || 0));
    await persist(item, config);
  });

  for (const checkbox of panel.querySelectorAll(".ts-critical-specialization-filter")) {
    checkbox.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const field = String(target.dataset.field ?? "");
      if (!["categories", "groups", "traits"].includes(field)) return;
      const config = normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
      config[field] = target.checked
        ? normalizeList([...config[field], target.value])
        : config[field].filter((slug) => slug !== target.value);
      await persist(item, config);
    });
  }

  const dropZone = panel.querySelector(".ts-critical-specialization-drop");
  dropZone?.addEventListener("dragover", (event) => event.preventDefault());
  dropZone?.addEventListener("drop", async (event) => {
    event.preventDefault();
    const dropped = await documentFromDrop(event);
    if (dropped?.type !== "weapon") {
      ui.notifications.warn(localize("ActionPlus.CriticalSpecialization.WeaponOnly"));
      return;
    }
    const base = String(dropped.baseType ?? dropped.system?.baseItem ?? dropped.system?.base?.value ?? "").trim();
    if (!base) {
      ui.notifications.warn(localize("ActionPlus.CriticalSpecialization.MissingBase"));
      return;
    }
    const config = normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
    config.bases = normalizeList([...config.bases, base]);
    await persist(item, config);
  });

  for (const button of panel.querySelectorAll(".ts-critical-specialization-remove-base")) {
    button.addEventListener("click", async (event) => {
      const config = normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
      config.bases = config.bases.filter((slug) => slug !== event.currentTarget.dataset.base);
      await persist(item, config);
    });
  }
}

async function cleanup({ item }) {
  const previousRule = buildRule(item.getFlag(MODULE_ID, FLAG_KEY));
  const existing = foundry.utils.deepClone(item._source?.system?.rules ?? []);
  await item.update({
    [`flags.${MODULE_ID}.-=${FLAG_KEY}`]: null,
    "system.rules": existing.filter((rule) => !sameRule(rule, previousRule)),
  });
}

function sameRule(left, right) {
  return left?.key === "CriticalSpecialization" && JSON.stringify(left?.predicate ?? []) === JSON.stringify(right?.predicate ?? []);
}

Hooks.on("preUpdateItem", (item, changed) => {
  if (!isSupportedActionPlusItem(item) || !isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;
  const existing = foundry.utils.deepClone(foundry.utils.getProperty(changed, "system.rules") ?? item._source?.system?.rules ?? []);
  const previousRule = buildRule(item.getFlag(MODULE_ID, FLAG_KEY));
  const nextConfig = foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`) ?? item.getFlag(MODULE_ID, FLAG_KEY);
  const rules = [...existing.filter((rule) => !sameRule(rule, previousRule)), buildRule(nextConfig)];
  if (JSON.stringify(existing) !== JSON.stringify(rules)) foundry.utils.setProperty(changed, "system.rules", rules);
});

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.CriticalSpecialization.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup,
});
