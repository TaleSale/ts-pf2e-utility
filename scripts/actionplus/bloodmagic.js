import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, isSupportedActionPlusItem, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "bloodline";
const SOURCE_ID = "bloodline";
const RULE_LABEL_KEY = `${I18N_PREFIX}.ActionPlus.BloodMagic.RuleLabel`;
const TARGET_ITEM_TYPE = "spell";
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

Hooks.on("preUpdateItem", (item, changed) => {
  applyBloodlineRuleSyncToPendingUpdate(item, changed);
});

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function renderBloodMagicControls({ flags }) {
  const spells = flags.bloodlineSpells ?? [];

  const spellsHtml = spells.length > 0
    ? spells.map((spell) => `
      <li style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.1); padding: 3px; margin-bottom: 2px; border-radius: 3px;">
        <span><i class="fa-solid fa-wand-magic-sparkles"></i> ${foundry.utils.escapeHTML(spell.name)}</span>
        <a class="ts-spell-delete" data-id="${foundry.utils.escapeHTML(spell.id)}" style="color: darkred; cursor: pointer;" data-tooltip="${localize("ActionPlus.BloodMagic.DeleteTooltip")}"><i class="fas fa-trash"></i></a>
      </li>
    `).join("")
    : `<p style="text-align: center; color: var(--color-text-dark-50); margin: 5px 0;">${localize("ActionPlus.BloodMagic.DropHint")}</p>`;

  return `
    <div class="ts-bloodline-drop-zone" style="margin-top: 10px; min-height: 60px; border: 2px dashed var(--color-border-light-tertiary); padding: 5px; border-radius: 5px; background: rgba(0,0,0,0.05);">
      <label style="font-weight: bold; display: block; margin-bottom: 5px;"><i class="fa-solid fa-droplet" style="color: darkred;"></i> ${localize("ActionPlus.BloodMagic.SpellsLabel")}</label>
      <ul style="list-style: none; padding: 0; margin: 0;">${spellsHtml}</ul>
    </div>
  `;
}

function activateBloodMagicListeners({ html, item }) {
  const root = getHtmlElement(html);
  if (!root) return;

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

      if (droppedItem.actor?.id !== item.actor.id) {
        ui.notifications.warn(localize("ActionPlus.BloodMagic.SameActorWarning"));
        return;
      }

      const currentSpells = item.getFlag(MODULE_ID, "bloodlineSpells") ?? [];
      if (currentSpells.some((spell) => spell.id === droppedItem.id)) return;

      const updatedSpells = [
        ...currentSpells,
        {
          id: droppedItem.id,
          uuid: droppedItem.uuid,
          slug: droppedItem.slug ?? droppedItem.system?.slug ?? game.pf2e?.system?.sluggify?.(droppedItem.name) ?? droppedItem.name.slugify?.() ?? droppedItem.name,
          name: droppedItem.name,
        },
      ];

      await item.setFlag(MODULE_ID, "bloodlineSpells", updatedSpells);
    });
  }

  for (const deleteButton of root.querySelectorAll(".ts-spell-delete")) {
    deleteButton.addEventListener("click", async (event) => {
      const idToDelete = event.currentTarget.dataset.id;
      const currentSpells = item.getFlag(MODULE_ID, "bloodlineSpells") ?? [];
      const updatedSpells = currentSpells.filter((spell) => spell.id !== idToDelete);

      await item.setFlag(MODULE_ID, "bloodlineSpells", updatedSpells);
    });
  }
}

async function cleanupBloodMagic({ item }) {
  await item.unsetFlag(MODULE_ID, "bloodlineSpells");
  await updateBloodlineRuleElement(item, []);
}


function buildBloodlinePredicate(spells) {
  const spellIds = Array.from(new Set(spells.map((spell) => spell.id).filter(Boolean)));
  if (spellIds.length === 0) return [];
  if (spellIds.length === 1) return [`item:id:${spellIds[0]}`];

  return [
    {
      or: spellIds.map((spellId) => `item:id:${spellId}`),
    },
  ];
}

function getPendingBloodlineSpells(item, changed) {
  return foundry.utils.getProperty(changed, `flags.${MODULE_ID}.bloodlineSpells`)
    ?? item.getFlag(MODULE_ID, "bloodlineSpells")
    ?? [];
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
    && (rule.tsUtilitySource === SOURCE_ID || LEGACY_RULE_LABELS.has(rule.label))
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
  const spells = getPendingBloodlineSpells(item, changed);
  const finalText = getLocalizedActionDescription(getPendingActionDescription(item, changed));
  const { changed: rulesChanged, rules } = buildUpdatedBloodlineRules(existingRules, finalText, spells);

  if (!rulesChanged) return;
  foundry.utils.setProperty(changed, "system.rules", rules);
}

async function updateBloodlineRuleElement(item, spells) {
  const finalText = getLocalizedActionDescription(item.system.description?.value ?? "");
  const { rules } = buildUpdatedBloodlineRules(item.system.rules ?? [], finalText, spells);

  await item.update({ "system.rules": rules });
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
