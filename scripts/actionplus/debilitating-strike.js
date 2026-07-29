import { MODULE_ID } from "../core.js";
import {
  isActionPlusFeatureEnabled,
  isSupportedActionPlusItem,
  registerActionPlusFeature,
} from "./actionplus.js";

const FEATURE_ID = "debilitatingStrike";
const FLAG_KEY = "debilitatingStrike";
const SOURCE_ID = "debilitating-strike";
const DESCRIPTION_START = "<!-- tsu-debilitating-strike:start -->";
const DESCRIPTION_END = "<!-- tsu-debilitating-strike:end -->";
const CLEANING_ITEMS = new Set();
const STANDARD_NOTE_KEYS = Object.freeze({
  "speed-penalty": "SpeedPenalty",
  enfeebled: "Enfeebled",
  weakness: "Weakness",
  clumsy: "Clumsy",
  "prevent-flanking": "PreventFlanking",
  "reduce-cover": "ReduceCover",
  stupefied: "Stupefied",
  "prevent-step": "PreventStep",
  "prevent-reactions": "PreventReactions",
  "precision-damage": "PrecisionDamage",
  "off-guard": "OffGuard",
  frightened: "Frightened",
  "weakness-heartless": "WeaknessHeartless",
  bloody: "Bloody",
  critical: "Critical",
});

// These values are the roll options used by PF2e's existing Debilitating Strike
// notes. Keeping this table in one place also makes new racket options trivial
// to add later.
const OPTIONS = Object.freeze([
  { value: "speed-penalty", label: "Скорость −10 футов", summary: "Штраф состояния −10 футов ко всем Скоростям", level: 9, base: true },
  { value: "enfeebled", label: "Ослаблен 1", summary: "Состояние «Ослаблен 1»", level: 9, base: true },
  { value: "weakness", label: "Слабость 5 к Д/К/Р", summary: "Слабость 5 к дробящему, колющему или рубящему урону на выбор", level: 10, group: "Жестокие" },
  { value: "clumsy", label: "Неуклюжесть 1", summary: "Состояние «Неуклюжесть 1»", level: 10, group: "Жестокие" },
  { value: "prevent-flanking", label: "Не участвует в тисках", summary: "Не может брать в тиски или помогать союзникам брать в тиски", level: 10, group: "Методичные" },
  { value: "reduce-cover", label: "Ослабленное укрытие", summary: "Не получает бонус КБ от поднятого щита, небольшого или стандартного укрытия; получает только +2 от большого укрытия или действия «Укрыться»", level: 10, group: "Методичные" },
  { value: "stupefied", label: "Одурманен 1", summary: "Состояние «Одурманен 1»", level: 10, group: "Таинственные" },
  { value: "prevent-step", label: "Не может сделать Шаг", summary: "Не может использовать действие «Шаг»", level: 10, group: "Таинственные" },
  { value: "prevent-reactions", label: "Не может использовать реакции", summary: "Не может использовать реакции", level: 10, group: "Тактические" },
  { value: "precision-damage", label: "+2d6 точного урона", summary: "Получает дополнительные 2d6 точного урона от ваших атак", level: 10, group: "Точные" },
  { value: "off-guard", label: "Застигнут врасплох", summary: "Состояние «Застигнут врасплох»", level: 10, group: "Точные" },
  { value: "frightened", label: "Напуган 1", summary: "Состояние «Напуган 1»", level: 10, group: "Бессердечные" },
  { value: "weakness-heartless", label: "Слабость 5 к крови и яду", summary: "Слабость 5 к урону кровотечением и ядом", level: 10, group: "Бессердечные" },
  { value: "persistent-poison", label: "3d6 продолжительного яда", summary: "3d6 продолжительного урона ядом", level: 10, group: "Отравленные" },
  { value: "sickened", label: "Тошнота 1", summary: "Состояние «Тошнота 1»", level: 10, group: "Отравленные" },
  { value: "bloody", label: "3d6 кровотечения", summary: "3d6 урона кровотечением", level: 12, group: "Дополнительные" },
  { value: "critical", label: "Критическое ослабление", summary: "Спасбросок Стойкости: критический успех — без эффекта; успех — Замедлен 1; провал — Замедлен 2; критический провал — Парализован (до конца вашего следующего хода)", level: 12, group: "Дополнительные" },
]);

function getHtmlElement(html) {
  return html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : html?.element instanceof HTMLElement ? html.element : null);
}

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const selected = Array.isArray(source.selected) ? source.selected : [];
  return {
    selected: Array.from(new Set(selected.map((entry) => String(entry ?? "").trim()).filter((entry) => OPTIONS.some((option) => option.value === entry)))),
    applyToSpellAttackDamage: source.applyToSpellAttackDamage === true,
  };
}

function optionEnabled(config, option) {
  return option.base || config.selected.includes(option.value);
}

function optionRule(optionName, suboptions, level, label) {
  return {
    key: "RollOption",
    domain: "all",
    option: optionName,
    label,
    alwaysActive: true,
    mergeable: true,
    toggleable: true,
    predicate: [{ gte: ["self:level", level] }],
    suboptions,
    tsUtilitySource: SOURCE_ID,
  };
}

function optionNoteText(option) {
  const noteKey = STANDARD_NOTE_KEYS[option.value];
  if (noteKey) return `@Localize[PF2E.SpecificRule.Rogue.Debilitation.${noteKey}.Note]`;
  if (option.value === "persistent-poison") return "Цель получает @Damage[(3d6)[persistent,poison]].";
  if (option.value === "sickened") return "Цель получает @UUID[Compendium.pf2e.conditionitems.Item.fesd1n5eVhpCSS18]{Тошнота 1}.";
  return option.summary ?? option.label;
}

function noteRule(option, { second = false, applyToSpellAttackDamage = false } = {}) {
  const prefix = second ? "second-debilitation" : "debilitation";
  const text = optionNoteText(option);
  return {
    key: "Note",
    selector: applyToSpellAttackDamage ? ["strike-damage", "spell-damage"] : "strike-damage",
    predicate: [
      `${prefix}:${option.value}`,
      "target:condition:off-guard",
      ...(applyToSpellAttackDamage ? [{ or: [{ not: "item:type:spell" }, "item:trait:attack"] }] : []),
    ],
    text: second
      ? text
      : `<p>@Localize[PF2E.SpecificRule.Rogue.Debilitation.Trigger]</p><p>${text}</p>`,
    ...(second ? {} : { title: "PF2E.SpecificRule.Rogue.Debilitation.Title" }),
    tsUtilitySource: SOURCE_ID,
  };
}

function masterStrikeNoteRule() {
  return {
    key: "Note",
    selector: "strike-damage",
    predicate: ["debilitation:master-strike", "target:condition:off-guard", { gte: ["self:level", 20] }],
    title: "Мастерский удар <span class=\"action-glyph\">f</span>",
    text: `<p><strong>Триггер</strong> Ваш «Удар» попадает по застигнутой врасплох цели и наносит урон.</p>
      <p>Цель совершает спасбросок @Check[fortitude|against:rogue] против вашего КС класса, после чего получает временный иммунитет к вашему Мастерскому удару на 1 день.</p>
      <hr>
      <p><strong>Критический успех</strong> Цель невредима.</p>
      <p><strong>Успех</strong> Цель получает @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Ослаблен 2} до конца вашего следующего хода.</p>
      <p><strong>Провал</strong> Цель получает @UUID[Compendium.pf2e.conditionitems.Item.6uEgoh53GbXuHpTF]{Парализован} на 4 раунда.</p>
      <p><strong>Критический провал</strong> Цель парализована на 4 раунда, теряет сознание на 2 часа или погибает (на ваш выбор).</p>`,
    tsUtilitySource: SOURCE_ID,
  };
}

function buildGeneratedRules(config) {
  const enabled = Array.from(new Map(
    OPTIONS.filter((option) => optionEnabled(config, option)).map((option) => [option.value, option]),
  ).values());
  const firstEnabled = [...enabled, { value: "master-strike", label: "Мастерский удар", level: 20 }];
  const suboptions = firstEnabled.map((option) => ({
    value: option.value,
    label: option.label,
    predicate: [{ gte: ["self:level", option.level] }],
  }));
  const secondSuboptions = enabled.map((option) => ({
    value: option.value,
    label: option.label,
    predicate: [
      { not: "debilitation:master-strike" },
      { not: `debilitation:${option.value}` },
      { gte: ["self:level", option.level] },
    ],
  }));
  const rules = [
    optionRule("debilitation", suboptions, 9, "Ослабление"),
    optionRule("second-debilitation", secondSuboptions, 15, "Второе ослабление"),
  ];
  rules.push(...enabled.map((option) => noteRule(option, { applyToSpellAttackDamage: config.applyToSpellAttackDamage })));
  rules.push(...enabled.map((option) => noteRule(option, { second: true, applyToSpellAttackDamage: config.applyToSpellAttackDamage })));
  rules.push(masterStrikeNoteRule());
  return rules;
}

function buildDescriptionHtml(config) {
  const byLevel = [9, 10, 12].map((level) => OPTIONS.filter((option) => option.level === level && optionEnabled(config, option)));
  const sections = [
    "<h3>Ослабляющий удар</h3>",
    "<p><strong>Триггер</strong> Ваш «Удар» попадает по застигнутой врасплох цели и наносит урон.</p>",
  ];
  for (const options of byLevel.filter((entries) => entries.length)) {
    sections.push(`<h4>${options[0].level} уровень</h4>`);
    sections.push(`<ul>${options.map((option) => `<li>${option.summary ?? option.label}.</li>`).join("")}</ul>`);
  }
  sections.push("<h4>15 уровень — Двойное ослабление</h4>");
  sections.push("<p>Выберите второе ослабление, отличное от первого.</p>");
  sections.push("<h4>20 уровень — Мастерский удар</h4>");
  sections.push("<p>За два ослабления вы можете выдать своему ослабляющему удару эффект @UUID[Compendium.pf2e.actionspf2e.Item.Rlp7ND33yYfxiEWi]{Мастерский удар / Master Strike}.</p>");
  return `${DESCRIPTION_START}<section data-tsu-debilitating-strike>${sections.join("")}</section>${DESCRIPTION_END}`;
}

function stripGeneratedDescription(value) {
  return String(value ?? "")
    .replace(/<!-- tsu-debilitating-strike:start -->[\s\S]*?<!-- tsu-debilitating-strike:end -->/g, "")
    .replace(/<section\b[^>]*data-tsu-debilitating-strike(?:="[^"]*")?[^>]*>[\s\S]*?<\/section>/gi, "")
    .trim();
}

function mergeGeneratedDescription(value, config) {
  const original = stripGeneratedDescription(value);
  return `${original}${original ? "\n" : ""}${buildDescriptionHtml(config)}`;
}

function isGeneratedRule(rule) {
  return rule?.tsUtilitySource === SOURCE_ID;
}

function noteSignature(rule) {
  if (rule?.key !== "Note") return "";
  const selectors = Array.isArray(rule.selector) ? rule.selector : [rule.selector];
  if (!selectors.includes("strike-damage")) return "";
  return (Array.isArray(rule.predicate) ? rule.predicate : [])
    .find((entry) => typeof entry === "string" && /^(?:second-)?debilitation:/.test(entry)) ?? "";
}

function preserveRollOptionState(generatedRules, existingRules) {
  for (const generated of generatedRules) {
    if (generated?.key !== "RollOption") continue;
    const previous = existingRules.find((rule) => (
      rule?.key === "RollOption"
      && rule?.tsUtilitySource === SOURCE_ID
      && rule.option === generated.option
      && rule.domain === generated.domain
    ));
    if (!previous) continue;

    const availableSelections = new Set((generated.suboptions ?? []).map((suboption) => suboption.value));
    if (typeof previous.selection === "string" && availableSelections.has(previous.selection)) {
      generated.selection = previous.selection;
    }
    if (Object.hasOwn(previous, "value")) generated.value = previous.value;
  }
  return generatedRules;
}

function getPendingConfig(item, changed) {
  return normalizeConfig(foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`) ?? item.getFlag(MODULE_ID, FLAG_KEY));
}

function syncGeneratedData(item, changed) {
  const config = getPendingConfig(item, changed);
  const existingRules = foundry.utils.deepClone(foundry.utils.getProperty(changed, "system.rules") ?? item._source?.system?.rules ?? []);
  const preservedRules = existingRules.filter((rule) => !isGeneratedRule(rule));
  const existingNoteSignatures = new Set(preservedRules.map(noteSignature).filter(Boolean));
  const generatedRules = preserveRollOptionState(buildGeneratedRules(config), existingRules).filter((rule) => {
    const signature = noteSignature(rule);
    return !signature || !existingNoteSignatures.has(signature);
  });
  const rules = [...preservedRules, ...generatedRules];
  const description = foundry.utils.getProperty(changed, "system.description.value")
    ?? item._source?.system?.description?.value
    ?? "";
  foundry.utils.setProperty(changed, "system.rules", rules);
  foundry.utils.setProperty(changed, "system.description.value", mergeGeneratedDescription(description, config));
}

function renderControls({ flags }) {
  const config = normalizeConfig(flags?.[FLAG_KEY]);
  const groups = new Map();
  for (const option of OPTIONS) {
    if (option.base) continue;
    const optionGroups = [option.group, ...(option.value === "prevent-flanking" ? ["Тактические"] : [])];
    for (const optionGroup of optionGroups) {
      const group = `${optionGroup} (${option.level} уровень)`;
      groups.set(group, [...(groups.get(group) ?? []), option]);
    }
  }
  return `
    <p class="notes" style="margin: 0 0 8px;">Настраивает штатные PF2e-переключатели ослаблений. Эффекты и заметки в чате берёт из системы.</p>
    ${Array.from(groups.entries()).map(([group, options]) => `
      <div style="margin: 7px 0;"><strong>${foundry.utils.escapeHTML(group)}</strong>
      ${options.map((option) => `<label class="checkbox" style="display:block; margin:3px 0 0 8px;"><input class="ts-debilitating-strike-option" type="checkbox" value="${option.value}" ${optionEnabled(config, option) ? "checked" : ""}> ${foundry.utils.escapeHTML(option.label)}</label>`).join("")}
      </div>`).join("")}
    <label class="checkbox" style="display:block; margin:10px 0 0;"><input class="ts-debilitating-strike-spell-attack" type="checkbox" ${config.applyToSpellAttackDamage ? "checked" : ""}> Распространять на урон заклинаний с признаком «Атака»</label>
    <p class="notes" style="margin:8px 0 0;">Ослабляющий удар, Двойное ослабление и Мастерский удар включаются автоматически на 9-м, 15-м и 20-м уровнях.</p>`;
}

function activateListeners({ html, item, optionIndex }) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;
  const save = async () => {
    const config = normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
    config.selected = Array.from(panel.querySelectorAll(".ts-debilitating-strike-option:checked"))
      .map((input) => input.value);
    config.applyToSpellAttackDamage = panel.querySelector(".ts-debilitating-strike-spell-attack")?.checked === true;
    await item.setFlag(MODULE_ID, FLAG_KEY, config);
  };
  panel.querySelectorAll(".ts-debilitating-strike-option, .ts-debilitating-strike-spell-attack").forEach((input) => input.addEventListener("change", save));
}

async function cleanup({ item }) {
  const rules = foundry.utils.deepClone(item._source?.system?.rules ?? []).filter((rule) => !isGeneratedRule(rule));
  CLEANING_ITEMS.add(item.uuid);
  try {
    await item.update({
      [`flags.${MODULE_ID}.-=${FLAG_KEY}`]: null,
      "system.rules": rules,
      "system.description.value": stripGeneratedDescription(item._source?.system?.description?.value),
    });
  } finally {
    CLEANING_ITEMS.delete(item.uuid);
  }
}

Hooks.on("preUpdateItem", (item, changed) => {
  if (CLEANING_ITEMS.has(item.uuid)) return;
  if (!isSupportedActionPlusItem(item) || !isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;
  syncGeneratedData(item, changed);
});

// Master Strike is selected as the first debilitation and consumes both slots.
Hooks.on("preUpdateActor", (actor, changed) => {
  const usesFeature = actor?.itemTypes?.action?.some((item) => isActionPlusFeatureEnabled(item, FEATURE_ID));
  if (!usesFeature) return;
  const current = foundry.utils.deepClone(actor.flags?.pf2e?.rollOptions?.all ?? {});
  const pending = foundry.utils.getProperty(changed, "flags.pf2e.rollOptions.all");
  if (!pending || typeof pending !== "object") return;
  const next = foundry.utils.mergeObject(current, foundry.utils.deepClone(pending), { inplace: false });
  if (next.debilitation === "master-strike") pending["second-debilitation"] = false;
});

registerActionPlusFeature({
  id: FEATURE_ID,
  label: "Ослабляющий удар",
  render: renderControls,
  activateListeners,
  cleanup,
});
