import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, isSupportedActionPlusItem, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "bloodline";
const SOURCE_ID = "bloodline";
const RULE_LABEL_KEY = `${I18N_PREFIX}.ActionPlus.BloodMagic.RuleLabel`;
const TARGET_ITEM_TYPE = "spell";
const SECONDARY_FLAG = "bloodlineSecondary";
const SPELL_SOURCE_FLAG = "bloodlineSpellSource";
const ACTIVE_FLAG = "bloodlineActive";
const RULE_SYNC_OPTION = "tsUtilityBloodlineRuleSync";
const LEGACY_RULE_LABELS = new Set(["Магия Крови", "Blood Magic"]);

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}


registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.BloodMagic.FeatureLabel`,
  render: renderBloodMagicControls,
  activateListeners: activateBloodMagicListeners,
  cleanup: cleanupBloodMagic,
});

Hooks.on("preUpdateItem", (item, changed, options) => {
  if (options?.[RULE_SYNC_OPTION]) return;
  applyBloodlineRuleSyncToPendingUpdate(item, changed);
});

Hooks.on("updateItem", (item, changed) => {
  if (foundry.utils.getProperty(changed, `flags.${MODULE_ID}.bloodlineSpells`) === undefined || !item.actor) return;
  const sourceUuid = item.uuid;
  void Promise.all(getActorBloodlines(item.actor)
    .filter((candidate) => candidate.getFlag(MODULE_ID, SPELL_SOURCE_FLAG)?.uuid === sourceUuid)
    .map((candidate) => candidate.setFlag(MODULE_ID, SPELL_SOURCE_FLAG, serializeSpellSource(item))));
});

Hooks.on("createItem", (item) => {
  if (!item.actor || !isActionPlusFeatureEnabled(item, FEATURE_ID)) return;
  void syncActorBloodlineRules(item.actor);
  item.actor.sheet?.render(false);
});

Hooks.on("deleteItem", (item) => {
  if (!item.actor || !isActionPlusFeatureEnabled(item, FEATURE_ID)) return;
  void syncActorBloodlineRules(item.actor);
  item.actor.sheet?.render(false);
});

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function renderBloodMagicControls({ flags, item }) {
  const spells = flags.bloodlineSpells ?? [];
  const isSecondary = Boolean(flags[SECONDARY_FLAG]);
  const selectedSource = flags[SPELL_SOURCE_FLAG] ?? null;
  const sources = getAvailableSpellSources(item);

  const spellsHtml = spells.length > 0
    ? spells.map((spell) => `
      <li style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.1); padding: 3px; margin-bottom: 2px; border-radius: 3px;">
        <span><i class="fa-solid fa-wand-magic-sparkles"></i> ${foundry.utils.escapeHTML(spell.name)}</span>
        <a class="ts-spell-delete" data-slug="${foundry.utils.escapeHTML(spell.slug)}" style="color: darkred; cursor: pointer;" data-tooltip="${localize("ActionPlus.BloodMagic.DeleteTooltip")}"><i class="fas fa-trash"></i></a>
      </li>
    `).join("")
    : `<p style="text-align: center; color: var(--color-text-dark-50); margin: 5px 0;">${localize("ActionPlus.BloodMagic.DropHint")}</p>`;

  return `
    <div class="form-group" style="margin: 6px 0;">
      <label><input type="checkbox" class="ts-bloodline-secondary" ${isSecondary ? "checked" : ""}> ${localize("ActionPlus.BloodMagic.SecondaryLabel")}</label>
      <p class="notes" style="margin: 3px 0 0;">${localize("ActionPlus.BloodMagic.SecondaryHint")}</p>
    </div>
    ${isSecondary ? `<div class="form-group" style="margin: 6px 0;">
      <label>${localize("ActionPlus.BloodMagic.SpellSourceLabel")}</label>
      <div class="form-fields"><select class="ts-bloodline-spell-source" style="width:100%;">
        <option value="">${localize("ActionPlus.BloodMagic.SpellSourceEmpty")}</option>
        ${sources.map((source) => `<option value="${foundry.utils.escapeHTML(source.id)}" ${source.uuid === selectedSource?.uuid ? "selected" : ""}>${foundry.utils.escapeHTML(source.name)}</option>`).join("")}
      </select></div>
      <p class="notes" style="margin: 3px 0 0;">${selectedSource?.name ? foundry.utils.escapeHTML(selectedSource.name) : localize("ActionPlus.BloodMagic.SharedSpellsHint")}</p>
      <div class="ts-bloodline-source-drop-zone" style="margin-top: 5px; padding: 5px; border: 1px dashed var(--color-border-light-tertiary); border-radius: 3px;">${localize("ActionPlus.BloodMagic.SpellSourceDropHint")}</div>
    </div>` : `<div class="ts-bloodline-drop-zone" style="margin-top: 10px; min-height: 60px; border: 2px dashed var(--color-border-light-tertiary); padding: 5px; border-radius: 5px; background: rgba(0,0,0,0.05);">
      <label style="font-weight: bold; display: block; margin-bottom: 5px;"><i class="fa-solid fa-droplet" style="color: darkred;"></i> ${localize("ActionPlus.BloodMagic.SpellsLabel")}</label>
      <ul style="list-style: none; padding: 0; margin: 0;">${spellsHtml}</ul>
    </div>`}
  `;
}

function activateBloodMagicListeners({ html, item }) {
  const root = getHtmlElement(html);
  if (!root) return;

  root.querySelector(".ts-bloodline-secondary")?.addEventListener("change", async (event) => {
    await item.setFlag(MODULE_ID, SECONDARY_FLAG, event.currentTarget.checked);
    item.actor?.sheet?.render(false);
  });

  const persistSpellSource = async (source) => {
    if (!source) await item.unsetFlag(MODULE_ID, SPELL_SOURCE_FLAG);
    else await item.setFlag(MODULE_ID, SPELL_SOURCE_FLAG, serializeSpellSource(source));
    item.actor?.sheet?.render(false);
  };
  root.querySelector(".ts-bloodline-spell-source")?.addEventListener("change", async (event) => {
    const source = getAvailableSpellSources(item).find((entry) => entry.id === event.currentTarget.value) ?? null;
    await persistSpellSource(source);
  });
  const sourceDropZone = root.querySelector(".ts-bloodline-source-drop-zone");
  sourceDropZone?.addEventListener("dragover", (event) => event.preventDefault());
  sourceDropZone?.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Item") return;
    const source = await fromUuid(data.uuid);
    if (!source || source.id === item.id || !isActionPlusFeatureEnabled(source, FEATURE_ID) || isSecondaryBloodline(source)) {
      ui.notifications.warn(localize("ActionPlus.BloodMagic.InvalidSpellSourceWarning"));
      return;
    }
    await persistSpellSource(source);
  });

  const dropZone = root.querySelector(".ts-bloodline-drop-zone");

  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const dragData = TextEditor.getDragEventData(event);
      if (dragData.type !== "Item") return;

      const droppedItem = await fromUuid(dragData.uuid);
      if (!droppedItem) return;

      if (droppedItem.type !== "spell") {
        ui.notifications.warn(localize("ActionPlus.BloodMagic.OnlySpellsWarning"));
        return;
      }

      const currentSpells = item.getFlag(MODULE_ID, "bloodlineSpells") ?? [];
      const slug = String(
        droppedItem.slug
        ?? droppedItem.system?.slug
        ?? game.pf2e?.system?.sluggify?.(droppedItem.name)
        ?? droppedItem.name.slugify?.()
        ?? droppedItem.name,
      ).trim().toLowerCase();
      if (!slug || currentSpells.some((spell) => String(spell.slug ?? "").trim().toLowerCase() === slug)) return;

      const updatedSpells = [
        ...currentSpells,
        {
          id: droppedItem.id,
          uuid: droppedItem.uuid,
          slug,
          name: droppedItem.name,
        },
      ];

      await item.setFlag(MODULE_ID, "bloodlineSpells", updatedSpells);
    });
  }

  for (const deleteButton of root.querySelectorAll(".ts-spell-delete")) {
    deleteButton.addEventListener("click", async (event) => {
      const slugToDelete = event.currentTarget.dataset.slug;
      const currentSpells = item.getFlag(MODULE_ID, "bloodlineSpells") ?? [];
      const updatedSpells = currentSpells.filter((spell) => spell.slug !== slugToDelete);

      await item.setFlag(MODULE_ID, "bloodlineSpells", updatedSpells);
    });
  }
}

async function cleanupBloodMagic({ item }) {
  await item.unsetFlag(MODULE_ID, "bloodlineSpells");
  await item.unsetFlag(MODULE_ID, SECONDARY_FLAG);
  await item.unsetFlag(MODULE_ID, SPELL_SOURCE_FLAG);
  await updateBloodlineRuleElement(item, []);
}


function buildBloodlinePredicate(spells) {
  const spellSlugs = Array.from(new Set(spells
    .map((spell) => String(spell.slug ?? "").trim().toLowerCase())
    .filter(Boolean)));
  if (spellSlugs.length === 0) return [];
  if (spellSlugs.length === 1) return [`item:slug:${spellSlugs[0]}`];

  return [
    {
      or: spellSlugs.map((slug) => `item:slug:${slug}`),
    },
  ];
}

function getPendingBloodlineSpells(item, changed) {
  return foundry.utils.getProperty(changed, `flags.${MODULE_ID}.bloodlineSpells`)
    ?? item.getFlag(MODULE_ID, "bloodlineSpells")
    ?? [];
}

function serializeSpellSource(item) {
  return {
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    spells: foundry.utils.deepClone(item.getFlag(MODULE_ID, "bloodlineSpells") ?? []),
  };
}

function isSecondaryBloodline(item, changed = null) {
  return foundry.utils.getProperty(changed ?? {}, `flags.${MODULE_ID}.${SECONDARY_FLAG}`)
    ?? Boolean(item.getFlag(MODULE_ID, SECONDARY_FLAG));
}

function getActorBloodlines(actor) {
  return (actor?.itemTypes?.action ?? []).filter((item) => (
    isActionPlusFeatureEnabled(item, FEATURE_ID)
  ));
}

function getAvailableSpellSources(item) {
  return getActorBloodlines(item.actor).filter((candidate) => (
    candidate.id !== item.id
    && !isSecondaryBloodline(candidate)
    && (candidate.getFlag(MODULE_ID, "bloodlineSpells") ?? []).length > 0
  ));
}

function getBloodlineSpells(item, changed = null) {
  if (!isSecondaryBloodline(item, changed)) return getPendingBloodlineSpells(item, changed ?? {});
  const source = foundry.utils.getProperty(changed ?? {}, `flags.${MODULE_ID}.${SPELL_SOURCE_FLAG}`)
    ?? item.getFlag(MODULE_ID, SPELL_SOURCE_FLAG);
  if (Array.isArray(source?.spells)) return source.spells;
  const fallback = getSpellSource(item.actor);
  return fallback ? getPendingBloodlineSpells(fallback, {}) : [];
}

function getSpellSource(actor, fallback = null) {
  return getActorBloodlines(actor).find((item) => !isSecondaryBloodline(item)
    && (item.getFlag(MODULE_ID, "bloodlineSpells") ?? []).length > 0)
    ?? fallback;
}

function normalizeActiveBloodlines(actor, bloodlines = getActorBloodlines(actor)) {
  const availableIds = new Set(bloodlines.map((item) => item.id));
  const saved = actor?.getFlag(MODULE_ID, ACTIVE_FLAG) ?? {};
  const primary = availableIds.has(saved.primary) ? saved.primary : bloodlines[0]?.id ?? "";
  const secondary = availableIds.has(saved.secondary) && saved.secondary !== primary ? saved.secondary : "";
  return { primary, secondary };
}

function getSelectableBloodlines(actor) {
  const bloodlines = getActorBloodlines(actor);
  const primary = getSpellSource(actor) ?? bloodlines.find((item) => !isSecondaryBloodline(item)) ?? null;
  return [
    ...(primary ? [primary] : []),
    ...bloodlines.filter((item) => item.id !== primary?.id && isSecondaryBloodline(item)),
  ];
}

function isBloodSovereign(actor) {
  return Array.from(actor?.items ?? []).some((item) => {
    const slug = String(item.slug ?? item.system?.slug ?? "").toLowerCase();
    const name = String(item.name ?? "").toLowerCase();
    return slug === "blood-sovereign" || name.includes("господство крови") || name.includes("blood sovereign");
  });
}

async function syncActorBloodlineRules(actor) {
  const bloodlines = getActorBloodlines(actor);
  const active = normalizeActiveBloodlines(actor, getSelectableBloodlines(actor));
  const activeIds = new Set([active.primary, active.secondary].filter(Boolean));
  await Promise.all(bloodlines.map((item) => updateBloodlineRuleElement(item, activeIds.has(item.id) ? getBloodlineSpells(item) : [])));
}

function getPendingActionDescription(item, changed) {
  return foundry.utils.getProperty(changed, "system.description.value")
    ?? item._source?.system?.description?.value
    ?? item.system.description?.value
    ?? "";
}

function buildUpdatedBloodlineRules(existingRules, finalText, spells) {
  let changed = false;
  let rules = foundry.utils.deepClone(existingRules);

  const filteredRules = rules.filter((rule) => !(
    rule?.key === "ItemAlteration"
    && (
      rule.tsUtilitySource === SOURCE_ID
      || rule.label === RULE_LABEL_KEY
      || LEGACY_RULE_LABELS.has(rule.label)
    )
  ));
  changed ||= filteredRules.length !== rules.length;
  rules = filteredRules;

  if (spells.length > 0) {
    rules.push({
      key: "ItemAlteration",
      itemType: TARGET_ITEM_TYPE,
      mode: "add",
      label: RULE_LABEL_KEY,
      predicate: buildBloodlinePredicate(spells),
      property: "description",
      value: [
        {
          text: finalText,
        },
      ],
      tsUtilitySource: SOURCE_ID,
    });
  }

  return { changed: changed || !areBloodlineRulesEqual(existingRules, rules), rules };
}

function areBloodlineRulesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyBloodlineRuleSyncToPendingUpdate(item, changed) {
  if (!isSupportedActionPlusItem(item)) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;

  const existingRules = foundry.utils.deepClone(
    foundry.utils.getProperty(changed, "system.rules")
    ?? item._source?.system?.rules
    ?? [],
  );
  const actor = item.actor;
  const active = actor ? normalizeActiveBloodlines(actor, getSelectableBloodlines(actor)) : null;
  const isActive = !actor || !active || item.id === active.primary || item.id === active.secondary;
  const spells = isActive ? getBloodlineSpells(item, changed) : [];
  const finalText = getLocalizedActionDescription(getPendingActionDescription(item, changed));
  const { changed: rulesChanged, rules } = buildUpdatedBloodlineRules(existingRules, finalText, spells);

  if (!rulesChanged) return;
  foundry.utils.setProperty(changed, "system.rules", rules);
}

function injectBloodlineSelector(app, html) {
  const actor = app?.document ?? app?.actor;
  if (!actor || actor.type !== "npc") return;
  const root = getHtmlElement(html);
  if (!root || root.querySelector(".ts-bloodline-selector")) return;
  const bloodlines = getSelectableBloodlines(actor);
  if (!bloodlines.length) return;

  const active = normalizeActiveBloodlines(actor, bloodlines);
  const options = (selected, exclude = "") => bloodlines
    .filter((item) => item.id !== exclude)
    .map((item) => `<option value="${foundry.utils.escapeHTML(item.id)}" ${item.id === selected ? "selected" : ""}>${foundry.utils.escapeHTML(item.name)}</option>`)
    .join("");
  const sovereign = isBloodSovereign(actor);
  const markup = `<div class="ts-bloodline-selector" style="display:flex; align-items:center; gap:6px; margin: 6px 0; padding: 4px; border: 1px solid var(--color-border-light-primary); border-radius:3px;">
    <label style="white-space:nowrap;">${foundry.utils.escapeHTML(localize("ActionPlus.BloodMagic.SelectorLabel"))}</label>
    <select class="ts-bloodline-primary" style="flex:1; min-width:0;">${options(active.primary, active.secondary)}</select>
    ${sovereign ? `<select class="ts-bloodline-secondary-select" style="flex:1; min-width:0;"><option value="">${foundry.utils.escapeHTML(localize("ActionPlus.BloodMagic.SecondSelectorEmpty"))}</option>${options(active.secondary, active.primary)}</select>` : ""}
  </div>`;
  const recallKnowledge = root.querySelector('.tab[data-tab="main"] .recall-knowledge, .recall-knowledge');
  if (recallKnowledge) recallKnowledge.insertAdjacentHTML("beforebegin", markup);
  else {
    const target = root.querySelector("header.sheet-header") ?? root;
    target.insertAdjacentHTML("afterend", markup);
  }

  const persist = async () => {
    const primary = root.querySelector(".ts-bloodline-primary")?.value ?? "";
    const secondary = root.querySelector(".ts-bloodline-secondary-select")?.value ?? "";
    await actor.setFlag(MODULE_ID, ACTIVE_FLAG, { primary, secondary: secondary === primary ? "" : secondary });
  };
  root.querySelector(".ts-bloodline-primary")?.addEventListener("change", persist);
  root.querySelector(".ts-bloodline-secondary-select")?.addEventListener("change", persist);
}

Hooks.on("renderActorSheet", injectBloodlineSelector);
Hooks.on("updateActor", (actor, changed) => {
  if (foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${ACTIVE_FLAG}`) !== undefined) void syncActorBloodlineRules(actor);
});

async function updateBloodlineRuleElement(item, spells) {
  const finalText = getLocalizedActionDescription(item.system.description?.value ?? "");
  const { rules } = buildUpdatedBloodlineRules(item.system.rules ?? [], finalText, spells);

  await item.update({ "system.rules": rules }, { [RULE_SYNC_OPTION]: true });
}

function getLocalizedActionDescription(fullText) {
  let finalText = fullText;
  const splitIndex = fullText.indexOf("<hr");

  if (splitIndex !== -1 && fullText.includes("Оригинал")) {
    const ruText = fullText.substring(0, splitIndex).trim();
    const detailMatch = fullText.match(/<summary>Оригинал<\/summary>(.*?)<\/details>/is);
    const enText = detailMatch?.[1]?.trim() || fullText;
    const currentLang = game.i18n.lang || game.settings.get("core", "language");

    finalText = currentLang === "ru" ? ruText : enText;
  }

  return finalText;
}
