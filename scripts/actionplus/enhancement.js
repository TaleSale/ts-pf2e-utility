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
const BLOCKED_HTML_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"]);
const HTML_SYNTAX_PATTERN = /<[^>]+>|&(?:#\d+|#x[\da-f]+|[a-z][a-z0-9]+);/i;
const ENHANCEMENT_EDITOR_TOOLS = [
  {
    id: "strong",
    label: "B",
    titleKey: "ActionPlus.Enhancement.EditorStrong",
    prefix: "**",
    suffix: "**",
    placeholderKey: "ActionPlus.Enhancement.EditorPlaceholderText",
  },
  {
    id: "em",
    label: "I",
    titleKey: "ActionPlus.Enhancement.EditorEmphasis",
    prefix: "*",
    suffix: "*",
    placeholderKey: "ActionPlus.Enhancement.EditorPlaceholderText",
  },
  {
    id: "list",
    label: "UL",
    titleKey: "ActionPlus.Enhancement.EditorList",
    prefix: "- ",
    suffix: "",
    placeholderKey: "ActionPlus.Enhancement.EditorPlaceholderItem",
  },
];

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
    name: "",
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
    name: String(source.name ?? "").trim(),
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
  if (enhancement.name) return buildEnhancementHeader(item, enhancement);
  const action = getOtherActorActionBySlug(item, enhancement.actionSlug);
  if (action?.name) return action.name;
  if (enhancement.levelRequirement) return localize("ActionPlus.Enhancement.HeaderLevel").replace("{level}", enhancement.levelRequirement);
  if (enhancement.actionSlug) return enhancement.actionSlug;
  return localize("ActionPlus.Enhancement.HeaderDefault");
}

function buildEnhancementHeader(item, enhancement) {
  const action = getOtherActorActionBySlug(item, enhancement.actionSlug);
  if (enhancement.name && enhancement.levelRequirement && action?.name) {
    return localize("ActionPlus.Enhancement.HeaderNamedLevelAction")
      .replace("{name}", enhancement.name)
      .replace("{level}", enhancement.levelRequirement)
      .replace("{action}", action.name);
  }
  if (enhancement.name && enhancement.levelRequirement) {
    return localize("ActionPlus.Enhancement.HeaderNamedLevel")
      .replace("{name}", enhancement.name)
      .replace("{level}", enhancement.levelRequirement);
  }
  if (enhancement.name) return enhancement.name;
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

function buildEnhancementLines(item, enhancement) {
  const body = formatEnhancementText(enhancement.text);
  const lines = splitEnhancementLines(body);
  return lines.some((line) => line !== "<br>") ? lines : [buildEnhancementHeader(item, enhancement)];
}

function formatEnhancementText(value) {
  const normalized = String(value ?? "").replaceAll("\r\n", "\n");
  if (!normalized.trim()) return "";

  if (!HTML_SYNTAX_PATTERN.test(normalized)) {
    return normalized;
  }

  const template = document.createElement("template");
  template.innerHTML = normalized.replaceAll("\n", "<br>");

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    elements.push(node);
  }

  for (const element of elements) {
    if (BLOCKED_HTML_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = String(attribute.value ?? "").trim().toLowerCase();
      if (attributeName === "style" || attributeName.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((attributeName === "href" || attributeName === "src") && attributeValue.startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return htmlFragmentToMarkdown(template.content)
    .replaceAll("\u00A0", " ")
    .trim();
}

function splitEnhancementLines(text) {
  return String(text ?? "")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => normalizeEnhancementLine(line))
    .filter((line) => line !== null);
}

function normalizeEnhancementLine(line) {
  const source = String(line ?? "");
  const trimmed = source.trim();
  if (!trimmed) return "&nbsp;";
  if (/^- /.test(trimmed)) {
    return `• ${trimmed.slice(2).trim()}`;
  }
  return trimmed;
}

function htmlFragmentToMarkdown(fragment) {
  return Array.from(fragment.childNodes).map((node) => htmlNodeToMarkdown(node)).join("");
}

function htmlNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return String(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tagName = node.tagName.toUpperCase();
  const inner = htmlFragmentToMarkdown(node);

  switch (tagName) {
    case "STRONG":
    case "B":
      return `**${inner.trim()}**`;
    case "EM":
    case "I":
      return `*${inner.trim()}*`;
    case "BR":
      return "\n";
    case "P":
    case "DIV":
    case "SECTION":
    case "ARTICLE":
      return `${inner}\n\n`;
    case "UL":
    case "OL":
      return `${Array.from(node.children).map((child) => htmlNodeToMarkdown(child)).join("")}\n`;
    case "LI":
      return `- ${inner.trim()}\n`;
    default:
      return inner;
  }
}

function isEnhancementConfigured(enhancement) {
  return Boolean(enhancement.text) && (Boolean(enhancement.levelRequirement) || Boolean(enhancement.actionSlug));
}

function buildRulesFromEnhancements(item, enhancements) {
  return normalizeEnhancementCollection(enhancements)
    .filter((enhancement) => isEnhancementConfigured(enhancement))
    .map((enhancement) => {
      const value = buildEnhancementLines(item, enhancement).map((text) => ({ text }));
      return {
        key: "ItemAlteration",
        itemId: "{item|id}",
        mode: "add",
        label: buildEnhancementLabel(item, enhancement),
        predicate: buildEnhancementPredicate(item, enhancement),
        property: "description",
        value,
        priority: RULE_PRIORITY,
        tsUtilitySource: SOURCE_ID,
      };
    });
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
  const toolbarButtonsHtml = ENHANCEMENT_EDITOR_TOOLS.map((tool) => `
    <button
      type="button"
      class="ts-enhancement-tool"
      data-prefix="${escapeHtml(tool.prefix)}"
      data-suffix="${escapeHtml(tool.suffix)}"
      data-placeholder="${escapeHtml(tool.placeholderKey ? localize(tool.placeholderKey) : "")}"
      data-tooltip="${escapeHtml(localize(tool.titleKey))}"
      style="flex: 0 0 auto; width: auto; min-width: 38px; padding: 2px 8px; line-height: 1.4;"
    >${escapeHtml(tool.label)}</button>
  `).join("");
  const saveButtonHtml = `
    <button
      type="button"
      class="ts-enhancement-save-text"
      data-tooltip="${escapeHtml(localize("ActionPlus.Enhancement.SaveTextButton"))}"
      style="flex: 0 0 auto; width: 32px; min-width: 32px; padding: 2px 0; line-height: 1.4;"
    ><i class="fas fa-save"></i></button>
  `;

  return `
    <div style="margin-top: 10px;">
      <div class="form-group">
        <label>${localize("ActionPlus.Enhancement.NameLabel")}</label>
        <div class="form-fields">
          <input type="text" class="ts-enhancement-input" data-field="name" value="${escapeHtml(enhancement.name)}" placeholder="${escapeHtml(localize("ActionPlus.Enhancement.NamePlaceholder"))}">
        </div>
      </div>
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
        <div class="form-fields" style="display: block;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 4px; margin-bottom: 6px;">
            ${toolbarButtonsHtml}
            ${saveButtonHtml}
          </div>
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

  const readEnhancementFromPanel = () => {
    const nextEnhancement = getDefaultEnhancement();
    for (const control of panel.querySelectorAll(".ts-enhancement-input")) {
      const field = String(control.dataset.field ?? "");
      if (!field) continue;
      nextEnhancement[field] = String(control.value ?? "");
    }
    return normalizeEnhancement(nextEnhancement);
  };

  const savePanelState = async () => {
    await persistEnhancement(item, readEnhancementFromPanel(), occurrenceIndex);
  };

  for (const control of panel.querySelectorAll(".ts-enhancement-input")) {
    control.addEventListener("change", async (event) => {
      const target = event.currentTarget;
      const field = String(target.dataset.field ?? "");
      if (!field || field === "text") return;
      await savePanelState();
    });
  }

  const textArea = panel.querySelector('.ts-enhancement-input[data-field="text"]');
  for (const button of panel.querySelectorAll(".ts-enhancement-tool")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (!(textArea instanceof HTMLTextAreaElement)) return;

      insertIntoTextarea(textArea, {
        prefix: String(button.dataset.prefix ?? ""),
        suffix: String(button.dataset.suffix ?? ""),
        placeholder: String(button.dataset.placeholder ?? ""),
      });
    });
  }

  const saveTextButton = panel.querySelector(".ts-enhancement-save-text");
  saveTextButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    await savePanelState();
  });
}

function insertIntoTextarea(textarea, { prefix = "", suffix = "", placeholder = "" } = {}) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const selectedText = textarea.value.slice(start, end);
  const middle = selectedText || placeholder;
  const insertion = buildMarkdownInsertion({ prefix, suffix, middle });

  textarea.setRangeText(insertion, start, end, "end");

  const selectionStart = start;
  const selectionEnd = start + insertion.length;
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);
}

function buildMarkdownInsertion({ prefix = "", suffix = "", middle = "" } = {}) {
  const text = String(middle ?? "");

  if (prefix === "- " && suffix === "") {
    return applyListMarkdown(text);
  }

  if ((prefix === "**" && suffix === "**") || (prefix === "*" && suffix === "*")) {
    return applyInlineMarkdownToLines(text, prefix, suffix);
  }

  return `${prefix}${text}${suffix}`;
}

function applyListMarkdown(text) {
  const source = String(text ?? "").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("- ") ? trimmed : `- ${trimmed}`;
  }).join("\n");
}

function applyInlineMarkdownToLines(text, prefix, suffix) {
  const source = String(text ?? "").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  return lines.map((line) => wrapMarkdownLine(line, prefix, suffix)).join("\n");
}

function wrapMarkdownLine(line, prefix, suffix) {
  const source = String(line ?? "");
  const trimmed = source.trim();
  if (!trimmed) return source;

  const listMatch = trimmed.match(/^(-\s+)(.*)$/);
  if (listMatch) {
    const [, marker, content] = listMatch;
    return `${marker}${prefix}${content}${suffix}`;
  }

  return `${prefix}${trimmed}${suffix}`;
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
