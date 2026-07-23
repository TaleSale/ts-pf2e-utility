import { escapeHtml, MODULE_ID } from "../core.js";

export const CREATURE_CORRECTION_FLAG_KEY = "creatureCorrection";
export const ACTOR_CORRECTIONS_LABEL = "Корректировки";
const FLAG_KEY = CREATURE_CORRECTION_FLAG_KEY;
const CORRECTION_TRAIT_SLUG = "correction";
const CORRECTION_TRAIT_LABEL = "Корректировка";
const CORRECTION_TRAIT_SLUGS = new Set(["correction", "korrektirovka", "корректировка"]);
const AUTO_DESCRIPTION_START = "<!-- ts-pf2e-utility:creature-correction:auto:start -->";
const AUTO_DESCRIPTION_END = "<!-- ts-pf2e-utility:creature-correction:auto:end -->";
const AUTO_DESCRIPTION_CLASS = "tsu-correction-auto-description";
const AUTO_DESCRIPTION_ATTRIBUTE = "data-tsu-correction-auto-description";
const ACTION_PLUS_AUTO_DESCRIPTION_START = "<!-- ts-pf2e-utility:action-plus:auto:start -->";
const ACTION_PLUS_AUTO_DESCRIPTION_END = "<!-- ts-pf2e-utility:action-plus:auto:end -->";
const ACTION_PLUS_AUTO_DESCRIPTION_CLASS = "tsu-action-plus-auto-description";
const ACTION_PLUS_AUTO_DESCRIPTION_ATTRIBUTE = "data-tsu-action-plus-auto-description";
const actorCorrectionApplyTasks = new WeakMap();
const RANKS = ["high", "medium", "low"];
const RANK_LABELS = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};
const SECTION_LABELS = {
  abilities: "Характеристики",
  skills: "Навыки",
  dcs: "Защиты",
  equipment: "Снаряжение",
  classFeatures: "Общие способности",
  styleFeatures: "Способности",
};
const ABILITY_CHOICES = [
  ["str", "Сила"],
  ["dex", "Ловкость"],
  ["con", "Телосложение"],
  ["int", "Интеллект"],
  ["wis", "Мудрость"],
  ["cha", "Харизма"],
];
const SKILL_CHOICES = [
  ["acr", "Акробатика"],
  ["arc", "Аркана"],
  ["ath", "Атлетика"],
  ["cra", "Ремесло"],
  ["dec", "Обман"],
  ["dip", "Дипломатия"],
  ["itm", "Запугивание"],
  ["med", "Медицина"],
  ["nat", "Природа"],
  ["occ", "Оккультизм"],
  ["prf", "Выступление"],
  ["rel", "Религия"],
  ["soc", "Общество"],
  ["ste", "Скрытность"],
  ["sur", "Выживание"],
  ["thi", "Воровство"],
];
const DC_CHOICES = [
  ["fortitude", "Стойкость"],
  ["reflex", "Рефлексы"],
  ["will", "Воля"],
  ["ac", "КБ"],
  ["spell", "КС Закл. и атака закл."],
  ["perception", "Восприятие"],
  ["hp", "ОЗ"],
];
const SIZE_CHOICES = [
  ["", "Не изменять"],
  ["tiny", "Крошечный"],
  ["sm", "Маленький"],
  ["med", "Средний"],
  ["lg", "Большой"],
  ["huge", "Огромный"],
  ["grg", "Исполинский"],
];
const CREATURE_SIZES = new Set(SIZE_CHOICES.map(([value]) => value));
const SIZE_LABELS = new Map(SIZE_CHOICES);
const CHOICE_LABELS = new Map([...ABILITY_CHOICES, ...SKILL_CHOICES, ...DC_CHOICES]);
const MONSTER_LEVELS = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const OLD_RANKS = ["none", "terrible", "low", "moderate", "high", "extreme"];
const CORRECTION_TO_OLD_RANK = { high: "high", medium: "moderate", low: "low" };
const SKILL_SLUGS = {
  acr: "acrobatics",
  arc: "arcana",
  ath: "athletics",
  cra: "crafting",
  dec: "deception",
  dip: "diplomacy",
  itm: "intimidation",
  med: "medicine",
  nat: "nature",
  occ: "occultism",
  prf: "performance",
  rel: "religion",
  soc: "society",
  ste: "stealth",
  sur: "survival",
  thi: "thievery",
};
const DC_SLUGS = {
  fortitude: "fortitude",
  reflex: "reflex",
  will: "will",
  ac: "ac",
  spell: "spell",
  perception: "perception",
  hp: "hp",
};
const STAT_TABLES = buildStatTables();

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function buildRows(rows) {
  return Object.fromEntries(MONSTER_LEVELS.map((level, index) => [
    String(level),
    Object.fromEntries(Object.entries(rows).map(([rank, values]) => [rank, values[index]])),
  ]));
}

function buildStatTables() {
  return {
    abilityScores: buildRows({
      extreme: [4, 4, 5, 5, 5, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 11, 11, 13],
      high: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 12],
      moderate: [2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 8, 8, 9],
      low: [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 4, 5, 5, 6, 6, 6, 6, 7],
      terrible: Array(26).fill(-4),
    }),
    armorClass: buildRows({
      extreme: [18, 19, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51, 52, 54],
      high: [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48, 49, 51],
      moderate: [14, 15, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 42, 44, 45, 47, 48, 50],
      low: [12, 13, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 39, 40, 42, 43, 45, 46, 48],
    }),
    perceptionSaves: buildRows({
      extreme: [9, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 43, 44, 46],
      high: [8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 35, 36, 38, 39, 40, 42],
      moderate: [5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 28, 29, 30, 32, 33, 35, 36, 37, 38],
      low: [2, 3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36],
      terrible: [0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32],
    }),
    spellcasting: buildRows({
      extreme: [11, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 31, 32, 33, 35, 36, 38, 39, 40, 42, 43, 44],
      high: [8, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34, 36, 37, 38, 40],
      moderate: [5, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31, 33, 34, 35, 37],
    }),
    skills: buildRows({
      extreme: [8, 9, 10, 11, 13, 15, 16, 18, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40, 41, 43, 45, 46, 48],
      high: [5, 6, 7, 8, 10, 12, 13, 15, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37, 38, 40, 42, 43, 45],
      moderate: [4, 5, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37, 38, 40],
      low: [2, 3, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 26, 28, 29, 31, 32, 34, 35, 36, 38],
      terrible: [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 24, 25, 27, 28, 29, 31, 32, 33],
    }),
  };
}

function registerCorrectionTrait() {
  const pf2eConfig = CONFIG.PF2E;
  if (!pf2eConfig) return;

  for (const key of ["actionTraits", "traits"]) {
    const record = pf2eConfig[key];
    if (!record || typeof record !== "object") continue;
    record[CORRECTION_TRAIT_SLUG] ??= CORRECTION_TRAIT_LABEL;
  }
}

function sluggify(value) {
  const pf2eSluggify = game.pf2e?.system?.sluggify;
  if (typeof pf2eSluggify === "function") return pf2eSluggify(String(value ?? ""));
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function getTraitValues(item, changed = null) {
  const pending = changed
    ? foundry.utils.getProperty(changed, "system.traits.value")
    : undefined;
  const source = pending ?? item?.system?.traits?.value ?? [];
  const custom = changed
    ? foundry.utils.getProperty(changed, "system.traits.custom")
    : item?.system?.traits?.custom;
  const otherTags = changed
    ? foundry.utils.getProperty(changed, "system.traits.otherTags")
    : item?.system?.traits?.otherTags;

  return [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(otherTags) ? otherTags : []),
    ...(typeof custom === "string" ? custom.split(/[,;\n]/) : []),
  ].map((trait) => String(trait ?? "").trim()).filter(Boolean);
}

function traitLooksLikeCorrection(trait) {
  const raw = String(trait ?? "").trim().toLowerCase();
  const slug = sluggify(raw);
  return CORRECTION_TRAIT_SLUGS.has(raw)
    || CORRECTION_TRAIT_SLUGS.has(slug)
    || raw.includes("корректиров")
    || slug.includes("correction")
    || slug.includes("korrektirov");
}

export function isCreatureCorrectionAction(item, changed = null) {
  if (item?.type !== "action") return false;
  return getTraitValues(item, changed).some((trait) => traitLooksLikeCorrection(trait));
}

function emptyRanked() {
  return { high: [], medium: [], low: [] };
}

function normalizeChoiceEntry(entry) {
  if (entry && typeof entry === "object") {
    const slug = sluggify(entry.slug ?? entry.value ?? entry.label ?? entry.name ?? "");
    const label = String(entry.label ?? entry.name ?? entry.value ?? entry.slug ?? "").trim();
    return slug ? { slug, label: label || CHOICE_LABELS.get(slug) || slug } : null;
  }

  const slug = sluggify(entry);
  if (!slug) return null;
  return { slug, label: CHOICE_LABELS.get(slug) || String(entry ?? "").trim() || slug };
}

function normalizeRanked(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = emptyRanked();
  for (const rank of RANKS) {
    const seen = new Set();
    result[rank] = (Array.isArray(source[rank]) ? source[rank] : [])
      .map((entry) => normalizeChoiceEntry(entry))
      .filter((entry) => {
        if (!entry || seen.has(entry.slug)) return false;
        seen.add(entry.slug);
        return true;
      });
  }
  return result;
}

function normalizeFeature(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const uuid = String(source.uuid ?? "").trim();
  const name = String(source.name ?? "").trim();
  return {
    id: String(source.id ?? uuid ?? "").trim(),
    uuid,
    name,
    gainLevel: normalizeLevel(source.gainLevel),
    loseLevel: normalizeLevel(source.loseLevel),
    note: String(source.note ?? "").trim(),
    spellSetDescription: String(source.spellSetDescription ?? "").trim(),
    usesInternalLevels: source.usesInternalLevels === true,
  };
}

function normalizeLevel(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < -1) return "";
  return String(Math.min(25, Math.trunc(numeric)));
}

function normalizeStringList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeCorrection(value) {
  const source = value && typeof value === "object" ? value : {};
  const size = String(source.size ?? "").trim();
  return {
    size: CREATURE_SIZES.has(size) ? size : "",
    abilities: normalizeRanked(source.abilities),
    skills: normalizeRanked(source.skills),
    dcs: normalizeRanked(source.dcs),
    equipment: normalizeStringList(source.equipment),
    classFeaturesTitle: String(source.classFeaturesTitle ?? "").trim(),
    styleFeaturesTitle: String(source.styleFeaturesTitle ?? "").trim(),
    classFeatures: (Array.isArray(source.classFeatures) ? source.classFeatures : []).map((entry) => normalizeFeature(entry)),
    styleFeatures: (Array.isArray(source.styleFeatures) ? source.styleFeatures : []).map((entry) => normalizeFeature(entry)),
  };
}

export function getCreatureCorrectionData(item, changed = null) {
  const pending = changed
    ? foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`)
    : undefined;
  return normalizeCorrection(pending ?? item?.getFlag?.(MODULE_ID, FLAG_KEY) ?? {});
}

function isCorrectionAction(item, changed = null) {
  return isCreatureCorrectionAction(item, changed);
}

function getCorrection(item, changed = null) {
  return getCreatureCorrectionData(item, changed);
}

function getChoiceLabel(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return CHOICE_LABELS.get(sluggify(entry)) || entry;
  return entry.label || CHOICE_LABELS.get(entry.slug) || entry.slug || "";
}

function renderChips(entries) {
  const normalized = (Array.isArray(entries) ? entries : []).map((entry) => getChoiceLabel(entry)).filter(Boolean);
  if (!normalized.length) return `<span class="tsu-correction-empty">-</span>`;
  return normalized.map((label) => `<span class="tsu-correction-chip">${escapeHtml(label)}</span>`).join("");
}

function renderRankRows(section, ranked) {
  return RANKS.map((rank) => `
    <div class="tsu-correction-rank-row">
      <label>${escapeHtml(RANK_LABELS[rank])}</label>
      <button type="button" class="tsu-correction-edit-rank" data-section="${section}" data-rank="${rank}" data-tooltip="Выбрать">
        <i class="fas fa-edit"></i>
      </button>
      <div class="tsu-correction-chip-list">${renderChips(ranked[rank])}</div>
    </div>
  `).join("");
}

function renderFeatureRows(correction, key) {
  const rows = correction[key];
  const body = rows.length ? rows.map((feature, index) => `
    <div class="tsu-correction-feature-row" data-index="${index}">
      <span class="tsu-correction-feature-drag-handle" draggable="true" data-field="${key}" data-index="${index}" data-tooltip="Изменить порядок">
        <i class="fas fa-grip-vertical"></i>
      </span>
      <span class="tsu-correction-feature-name">${renderFeatureName(feature)}</span>
      <label>Получает <input type="number" min="-1" max="25" class="tsu-correction-feature-input" data-field="${key}" data-index="${index}" data-prop="gainLevel" value="${escapeHtml(feature.gainLevel)}"></label>
      <label>Пропадает <input type="number" min="-1" max="25" class="tsu-correction-feature-input" data-field="${key}" data-index="${index}" data-prop="loseLevel" value="${escapeHtml(feature.loseLevel)}"></label>
      <input type="text" class="tsu-correction-feature-input tsu-correction-feature-note" data-field="${key}" data-index="${index}" data-prop="note" value="${escapeHtml(feature.note)}" placeholder="заметка">
      <button type="button" class="tsu-correction-remove-feature" data-field="${key}" data-index="${index}" data-tooltip="Удалить"><i class="fas fa-times"></i></button>
    </div>
  `).join("") : `<div class="tsu-correction-drop-note">Перетащите способность сюда или добавьте строку вручную.</div>`;

  return `
    <div class="tsu-correction-feature-list" data-field="${key}">
      ${body}
      <div class="tsu-correction-feature-actions">
        <input type="text" class="tsu-correction-manual-feature" data-field="${key}" placeholder="Название способности">
        <button type="button" class="tsu-correction-add-feature" data-field="${key}"><i class="fas fa-plus"></i> Добавить</button>
      </div>
    </div>
  `;
}

function renderFeatureName(feature) {
  const name = escapeHtml(feature.name || feature.uuid || "Способность");
  return feature.uuid ? `<a class="content-link" draggable="true" data-link data-uuid="${escapeHtml(feature.uuid)}"><i class="fas fa-suitcase"></i> ${name}</a>` : name;
}

function renderCorrectionEditor(item) {
  const correction = getCorrection(item);
  return `
    <fieldset class="tsu-correction-editor">
      <legend>Корректировка конструктора существ</legend>
      <section>
        <label class="tsu-correction-title-row">
          <span>Размер существа</span>
          <select class="tsu-correction-size-input">
            ${SIZE_CHOICES.map(([value, label]) => `<option value="${value}" ${correction.size === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </section>
      <section>
        <h4>${SECTION_LABELS.abilities}</h4>
        ${renderRankRows("abilities", correction.abilities)}
      </section>
      <section>
        <h4>${SECTION_LABELS.skills}</h4>
        ${renderRankRows("skills", correction.skills)}
      </section>
      <section>
        <h4>${SECTION_LABELS.dcs}</h4>
        ${renderRankRows("dcs", correction.dcs)}
      </section>
      <section>
        <h4>${SECTION_LABELS.equipment}</h4>
        <div class="tsu-correction-equipment-list">
          ${correction.equipment.map((kit, index) => `
            <span class="tsu-correction-kit">
              <input type="text" class="tsu-correction-kit-input" data-index="${index}" value="${escapeHtml(kit)}">
              <button type="button" class="tsu-correction-remove-kit" data-index="${index}" data-tooltip="Удалить"><i class="fas fa-times"></i></button>
            </span>
          `).join("")}
        </div>
        <div class="tsu-correction-feature-actions">
          <input type="text" class="tsu-correction-new-kit" placeholder="Комплект снаряжения">
          <button type="button" class="tsu-correction-add-kit"><i class="fas fa-plus"></i> Добавить</button>
        </div>
      </section>
      <section>
        <h4>${SECTION_LABELS.classFeatures}</h4>
        <label class="tsu-correction-title-row">
          <span>Общие способности</span>
          <input type="text" class="tsu-correction-title-input" data-field="classFeaturesTitle" value="${escapeHtml(correction.classFeaturesTitle)}" placeholder="Воин, Гуль">
        </label>
        ${renderFeatureRows(correction, "classFeatures")}
      </section>
      <section>
        <h4>${SECTION_LABELS.styleFeatures}</h4>
        <label class="tsu-correction-title-row">
          <span>Способности</span>
          <input type="text" class="tsu-correction-title-input" data-field="styleFeaturesTitle" value="${escapeHtml(correction.styleFeaturesTitle)}" placeholder="Лучник">
        </label>
        ${renderFeatureRows(correction, "styleFeatures")}
      </section>
      <div class="tsu-correction-editor-actions">
        <button type="button" class="tsu-correction-refresh-description"><i class="fas fa-sync"></i> Обновить описание</button>
      </div>
    </fieldset>
  `;
}

function getChoicesForSection(section) {
  if (section === "abilities") return ABILITY_CHOICES;
  if (section === "skills") return SKILL_CHOICES;
  if (section === "dcs") return DC_CHOICES;
  return [];
}

async function openRankDialog(item, section, rank) {
  const correction = getCorrection(item);
  const current = new Map(correction[section][rank].map((entry) => [entry.slug, entry]));
  const choices = getChoicesForSection(section);
  const fixedSlugs = new Set(choices.map(([slug]) => slug));
  const occupiedByOtherRanks = getSectionOccupiedSlugs(correction, section, rank);
  const customEntries = section === "skills"
    ? correction[section][rank].filter((entry) => !fixedSlugs.has(entry.slug))
    : [];

  const content = `
    <form class="tsu-correction-choice-dialog">
      <div class="tsu-correction-choice-grid">
        ${choices.map(([slug, label]) => {
          const disabled = occupiedByOtherRanks.has(slug);
          return `
          <label class="${disabled ? "tsu-correction-choice-disabled" : ""}">
            <input type="checkbox" name="choice" value="${escapeHtml(slug)}" ${current.has(slug) ? "checked" : ""} ${disabled ? "disabled" : ""}>
            ${escapeHtml(label)}
          </label>
        `;
        }).join("")}
      </div>
      ${section === "skills" ? `
        <label class="tsu-correction-custom-skills">
          <span>Знания вручную</span>
          <textarea name="custom" rows="3" placeholder="devil-lore, warfare-lore">${escapeHtml(customEntries.map((entry) => entry.label).join(", "))}</textarea>
        </label>
      ` : ""}
    </form>
  `;

  return new Promise((resolve) => {
    new Dialog({
      title: `${SECTION_LABELS[section]}: ${RANK_LABELS[rank]}`,
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Сохранить",
          callback: async (html) => {
            const root = getHtmlElement(html);
            const selected = Array.from(root?.querySelectorAll('input[name="choice"]:checked') ?? [])
              .map((input) => normalizeChoiceEntry({
                slug: input.value,
                label: CHOICE_LABELS.get(input.value) || input.value,
              }))
              .filter(Boolean);
            const custom = section === "skills"
              ? String(root?.querySelector('textarea[name="custom"]')?.value ?? "")
                .split(/[,;\n]/)
                .map((value) => normalizeChoiceEntry(value))
                .filter(Boolean)
              : [];
            correction[section][rank] = dedupeEntries([...selected, ...custom]);
            removeSectionEntriesFromOtherRanks(correction, section, rank);
            await persistCorrection(item, correction);
            resolve(true);
          },
        },
        cancel: {
          label: "Отмена",
          callback: () => resolve(false),
        },
      },
      default: "save",
      close: () => resolve(false),
    }, { width: 420 }).render(true);
  });
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry?.slug || seen.has(entry.slug)) return false;
    seen.add(entry.slug);
    return true;
  });
}

function getSectionOccupiedSlugs(correction, section, currentRank) {
  const occupied = new Set();
  for (const rank of RANKS) {
    if (rank === currentRank) continue;
    for (const entry of correction[section]?.[rank] ?? []) {
      if (entry?.slug) occupied.add(entry.slug);
    }
  }
  return occupied;
}

function removeSectionEntriesFromOtherRanks(correction, section, sourceRank) {
  const selectedSlugs = new Set((correction[section]?.[sourceRank] ?? []).map((entry) => entry.slug).filter(Boolean));
  if (!selectedSlugs.size) return;

  for (const rank of RANKS) {
    if (rank === sourceRank) continue;
    correction[section][rank] = (correction[section][rank] ?? []).filter((entry) => !selectedSlugs.has(entry.slug));
  }
}

async function persistCorrection(item, correction) {
  const normalized = normalizeCorrection(correction);
  await hydrateCorrectionSpellSetDescriptions(normalized);
  const previousCorrection = getCorrection(item);
  const currentDescription = item.system?.description?.value ?? item._source?.system?.description?.value ?? "";
  await item.update({
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: normalized,
    "system.description.value": buildMergedCorrectionDescription(item, normalized, currentDescription, previousCorrection),
  });
}

function buildCorrectionDescription(item, correction = getCorrection(item), actionPlusSource = item) {
  const blocks = [];
  if (correction.size) {
    blocks.push(`<h2>Размер существа:</h2>\n<p>${escapeHtml(SIZE_LABELS.get(correction.size) ?? correction.size)}</p>`);
  }
  for (const [key, label] of Object.entries({
    abilities: SECTION_LABELS.abilities,
    skills: SECTION_LABELS.skills,
    dcs: SECTION_LABELS.dcs,
  })) {
    const lines = RANKS
      .map((rank) => {
        const text = correction[key][rank].map((entry) => getChoiceLabel(entry)).filter(Boolean).join(", ");
        return text ? `<p><strong>${escapeHtml(RANK_LABELS[rank])}:</strong> ${escapeHtml(text)}</p>` : "";
      })
      .filter(Boolean);
    if (lines.length) blocks.push(`<h2>${escapeHtml(label)}:</h2>\n${lines.join("\n")}`);
  }

  const extraFeatureLines = ["classFeatures", "styleFeatures"]
    .flatMap((key) => correction[key])
    .filter((feature) => String(feature.spellSetDescription ?? "").trim())
    .map((feature) => {
      const gain = feature.gainLevel !== "" ? `с ${escapeHtml(feature.gainLevel)}-го ур.` : "с любого уровня";
      const lose = feature.loseLevel !== "" ? `; пропадает на ${escapeHtml(feature.loseLevel)}-м ур.` : "";
      const name = escapeHtml(feature.name || "Способность");
      const featureLink = feature.uuid ? `@UUID[${feature.uuid}]{${name}}` : name;
      const levelNote = feature.gainLevel === "" && feature.loseLevel === "" ? "" : ` (${gain}${lose})`;
      return `<div class="tsu-correction-extra-feature"><h3>${featureLink}${levelNote}</h3><div class="tsu-correction-extra-feature-details">${feature.spellSetDescription}</div></div>`;
    });
  const ownActionPlusDescription = buildActionPlusCatalogDescription(actionPlusSource);
  if (ownActionPlusDescription) {
    const ownName = escapeHtml(actionPlusSource?.name || item.name || "Корректировка");
    const ownUuid = String(actionPlusSource?.uuid ?? item.uuid ?? "").trim();
    const ownLink = ownUuid ? `@UUID[${ownUuid}]{${ownName}}` : ownName;
    extraFeatureLines.unshift(`<div class="tsu-correction-extra-feature"><h3>${ownLink}</h3><div class="tsu-correction-extra-feature-details">${ownActionPlusDescription}</div></div>`);
  }
  if (extraFeatureLines.length) {
    blocks.push(`<h2>Дополнительные функции:</h2>\n${extraFeatureLines.join("\n")}`);
  }

  if (correction.equipment.length) {
    blocks.push(`<h2>${SECTION_LABELS.equipment}:</h2>\n${correction.equipment.map((kit) => `<p>${escapeHtml(kit)}</p>`).join("\n")}`);
  }

  for (const [key, label] of [
    ["classFeatures", buildFeatureSectionTitle("Общие способности", correction.classFeaturesTitle)],
    ["styleFeatures", buildFeatureSectionTitle("Способности", correction.styleFeaturesTitle)],
  ]) {
    const lines = correction[key]
      .filter((feature) => feature.name || feature.uuid)
      .map((feature) => formatFeatureDescriptionBlock(feature));
    if (lines.length) blocks.push(`<h2>${escapeHtml(label)}:</h2>\n${lines.join("\n")}`);
  }

  return blocks.join("\n\n");
}

function wrapAutoCorrectionDescription(autoDescription) {
  const trimmed = String(autoDescription ?? "").trim();
  return trimmed
    ? `<div class="${AUTO_DESCRIPTION_CLASS}" ${AUTO_DESCRIPTION_ATTRIBUTE}="true">\n${trimmed}\n</div>`
    : "";
}

function removeMarkedAutoCorrectionDescription(description) {
  let result = String(description ?? "");

  while (result.includes(AUTO_DESCRIPTION_START) && result.includes(AUTO_DESCRIPTION_END)) {
    const startIndex = result.indexOf(AUTO_DESCRIPTION_START);
    const endIndex = result.indexOf(AUTO_DESCRIPTION_END, startIndex);
    if (startIndex === -1 || endIndex === -1) break;
    result = `${result.slice(0, startIndex)}${result.slice(endIndex + AUTO_DESCRIPTION_END.length)}`;
  }

  return result;
}

function removeElementMarkedAutoCorrectionDescription(description) {
  const source = String(description ?? "");

  if (typeof document === "undefined") {
    return source.replace(
      new RegExp(`<(?:section|div)\\b[^>]*(?:class=["'][^"']*${AUTO_DESCRIPTION_CLASS}[^"']*["']|${AUTO_DESCRIPTION_ATTRIBUTE}(?:=["'][^"']*["'])?)[\\s\\S]*?<\\/(?:section|div)>`, "gi"),
      "",
    );
  }

  const template = document.createElement("template");
  template.innerHTML = source;
  for (const element of template.content.querySelectorAll(`.${AUTO_DESCRIPTION_CLASS}, [${AUTO_DESCRIPTION_ATTRIBUTE}]`)) {
    element.remove();
  }
  return template.innerHTML;
}

function getSignificantNodes(fragment) {
  return Array.from(fragment.childNodes)
    .filter((node) => node.nodeType !== 3 || String(node.textContent ?? "").trim());
}

function normalizeComparableHtml(html) {
  if (typeof document === "undefined") {
    return String(html ?? "")
      .replaceAll(/>\s+</g, "><")
      .replaceAll(/\s+/g, " ")
      .trim();
  }

  const template = document.createElement("template");
  template.innerHTML = String(html ?? "");
  return getSignificantNodes(template.content)
    .map((node) => node.outerHTML ?? node.textContent ?? "")
    .join("")
    .replaceAll(/>\s+</g, "><")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function removeLegacyAutoCorrectionDescription(description, previousAutoDescription) {
  const legacyAuto = String(previousAutoDescription ?? "").trim();
  if (!legacyAuto) return String(description ?? "");

  let source = String(description ?? "");
  while (source.includes(legacyAuto)) {
    source = source.replace(legacyAuto, "");
  }

  if (typeof document === "undefined") return source;

  const template = document.createElement("template");
  template.innerHTML = source;
  const legacyTemplate = document.createElement("template");
  legacyTemplate.innerHTML = legacyAuto;
  const legacyNodes = getSignificantNodes(legacyTemplate.content);
  if (!legacyNodes.length) return template.innerHTML;

  const legacyComparable = legacyNodes.map((node) => normalizeComparableHtml(node.outerHTML ?? node.textContent ?? ""));
  let removed = true;

  while (removed) {
    removed = false;
    const nodes = getSignificantNodes(template.content);
    for (let index = 0; index <= nodes.length - legacyNodes.length; index += 1) {
      const candidate = nodes.slice(index, index + legacyNodes.length)
        .map((node) => normalizeComparableHtml(node.outerHTML ?? node.textContent ?? ""));
      if (!candidate.every((value, offset) => value === legacyComparable[offset])) continue;

      for (const node of nodes.slice(index, index + legacyNodes.length)) node.remove();
      removed = true;
      break;
    }
  }

  return template.innerHTML;
}

function removeGeneratedCorrectionDescription(description, previousAutoDescription) {
  const withoutCommentMarkers = removeMarkedAutoCorrectionDescription(description);
  const withoutElementMarkers = removeElementMarkedAutoCorrectionDescription(withoutCommentMarkers);
  return removeLegacyAutoCorrectionDescription(withoutElementMarkers, previousAutoDescription).trim();
}

function buildMergedCorrectionDescription(item, correction, currentDescription, previousCorrection = getCorrection(item), nextActionPlusSource = item) {
  const previousAutoDescription = buildCorrectionDescription(item, previousCorrection);
  const nextRawAutoDescription = buildCorrectionDescription(item, correction, nextActionPlusSource);
  const manualDescription = removeGeneratedCorrectionDescription(
    removeGeneratedCorrectionDescription(currentDescription, previousAutoDescription),
    nextRawAutoDescription,
  );
  const nextAutoDescription = wrapAutoCorrectionDescription(nextRawAutoDescription);

  return [manualDescription, nextAutoDescription]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildFeatureSectionTitle(base, suffix) {
  const trimmed = String(suffix ?? "").trim();
  return trimmed ? `${base} ${trimmed}` : base;
}

function formatFeatureDescriptionLine(feature) {
  const gain = feature.gainLevel ? `${escapeHtml(feature.gainLevel)} ур - ` : "";
  const link = feature.uuid
    ? `@UUID[${feature.uuid}]{${escapeHtml(feature.name || "Способность")}}`
    : escapeHtml(feature.name || "Способность");
  const lose = feature.loseLevel ? ` <span class="tsu-correction-lost-note">(пропадает на ${escapeHtml(feature.loseLevel)} ур.)</span>` : "";
  const note = feature.note ? ` ${escapeHtml(feature.note)}` : "";
  return `${gain}${link}${lose}${note}`;
}

function formatFeatureDescriptionBlock(feature) {
  return `<p>${formatFeatureDescriptionLine(feature)}</p>`;
}

function formatStoredSpellLink(spell) {
  const uuid = String(spell?.uuid ?? spell?.source?._stats?.compendiumSource ?? spell?.source?.flags?.core?.sourceId ?? "").trim();
  const name = escapeHtml(spell?.name || "Заклинание");
  return uuid ? `@UUID[${uuid}]{${name}}` : name;
}

function formatStoredSpellModifiers(spell) {
  const labels = [spell?.atWill ? "По желанию" : "", spell?.constant ? "Постоянно" : "", spell?.self ? "На себя" : ""].filter(Boolean);
  return labels.length ? ` <span class="tsu-correction-spell-condition">(${labels.join(", ")})</span>` : "";
}

function formatStoredAlchemyLink(item) {
  const uuid = String(item?.uuid ?? item?.source?._stats?.compendiumSource ?? item?.source?.flags?.core?.sourceId ?? "").trim();
  const name = escapeHtml(item?.name || "Алхимический предмет");
  return uuid ? `@UUID[${uuid}]{${name}}` : name;
}

function getActionPlusSourceData(source) {
  const flags = source?.flags?.[MODULE_ID] ?? {};
  const options = Array.isArray(flags.actionOptions) ? flags.actionOptions : [flags.actionOption].filter(Boolean);
  const count = (featureId) => options.filter((option) => option === featureId).length;
  const collection = (flagKey, featureId) => {
    const value = flags[flagKey];
    const entries = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
    return entries.slice(0, count(featureId));
  };
  return { flags, options, count, collection };
}

function localizeConfigValue(record, slug) {
  const label = record?.[slug] ?? slug;
  const localized = game.i18n.localize(String(label ?? slug));
  return localized === String(label) ? String(label ?? slug) : localized;
}

function formatCatalogList(title, values) {
  const unique = Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
  return unique.length ? `<p><strong>${escapeHtml(title)}:</strong> ${unique.map((value) => escapeHtml(value)).join(", ")}</p>` : "";
}

function buildActorExtrasCatalogDescription(source) {
  const { collection } = getActionPlusSourceData(source);
  const languages = collection("actorLanguages", "actorLanguages")
    .flatMap((config) => Array.isArray(config?.values) ? config.values : [])
    .map((slug) => localizeConfigValue(CONFIG.PF2E?.languages, slug));
  const traits = collection("actorTraits", "actorTraits")
    .flatMap((config) => Array.isArray(config?.values) ? config.values : [])
    .map((slug) => localizeConfigValue(CONFIG.PF2E?.creatureTraits, slug));
  const senses = collection("actorSenses", "actorSenses")
    .flatMap((config) => Array.isArray(config?.senses) ? config.senses : [])
    .filter((sense) => String(sense?.type ?? "").trim())
    .map((sense) => {
      const type = localizeConfigValue(CONFIG.PF2E?.senses, sense?.type);
      const acuity = localizeConfigValue(CONFIG.PF2E?.senseAcuity ?? CONFIG.PF2E?.senseAcuities, sense?.acuity || "precise");
      const range = Math.max(0, Number.parseInt(sense?.range, 10) || 0);
      return range ? `${type} (${acuity}, ${range} фт.)` : `${type} (${acuity})`;
    });
  return [
    formatCatalogList("Признаки", traits),
    formatCatalogList("Чувства", senses),
    formatCatalogList("Языки", languages),
  ].filter(Boolean).join("");
}

function buildCreatureAttackCatalogDescription(source) {
  const { collection } = getActionPlusSourceData(source);
  const attacks = collection("creatureAttack", "creatureAttack").map((config) => {
    const name = String(config?.createName ?? "Strike").trim() || "Strike";
    const weaponType = config?.weaponType === "ranged" ? "дальняя" : "ближняя";
    const traits = (Array.isArray(config?.traits) ? config.traits : [])
      .map((slug) => localizeConfigValue(CONFIG.PF2E?.weaponTraits, slug));
    const rawRows = Array.isArray(config?.damageRows) && config.damageRows.length
      ? config.damageRows
      : [{ damageType: config?.damageType }];
    const damageTypes = rawRows.map((row) => localizeConfigValue(CONFIG.PF2E?.damageTypes, row?.damageType || "bludgeoning"));
    const details = [weaponType, traits.length ? `признаки: ${traits.join(", ")}` : "", `урон: ${Array.from(new Set(damageTypes)).join(", ")}`].filter(Boolean);
    return `${name} (${details.join("; ")})`;
  });
  return formatCatalogList("Атаки существа", attacks);
}

function buildCriticalSpecializationCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source);
  if (!options.includes("criticalSpecialization")) return "";
  const config = flags.criticalSpecialization && typeof flags.criticalSpecialization === "object"
    ? flags.criticalSpecialization
    : {};
  const filters = [
    ...(Array.isArray(config.categories) ? config.categories : []).map((slug) => localizeConfigValue(CONFIG.PF2E?.weaponCategories, slug)),
    ...(Array.isArray(config.groups) ? config.groups : []).map((slug) => localizeConfigValue(CONFIG.PF2E?.weaponGroups, slug)),
    ...(Array.isArray(config.traits) ? config.traits : []).map((slug) => localizeConfigValue(CONFIG.PF2E?.weaponTraits, slug)),
    ...(Array.isArray(config.bases) ? config.bases : []).map((slug) => localizeConfigValue(CONFIG.PF2E?.baseWeaponTypes, slug)),
  ];
  const level = config.level === null || config.level === undefined || config.level === "" ? null : Number(config.level);
  const levelText = Number.isInteger(level) && level >= 0 ? `с ${level}-го уровня` : "на всех уровнях";
  const scope = filters.length ? `; оружие: ${Array.from(new Set(filters)).join(", ")}` : "; всё подходящее оружие";
  return `<p><strong>Критическая специализация:</strong> ${escapeHtml(levelText + scope)}</p>`;
}

function buildActionPlusCatalogDescription(source) {
  return [
    buildActorExtrasCatalogDescription(source),
    buildCreatureAttackCatalogDescription(source),
    buildDamageAdjustmentsCatalogDescription(source),
    buildRegenerationCatalogDescription(source),
    buildBloodlineCatalogDescription(source),
    buildEnhancementCatalogDescription(source),
    buildDegreeOfSuccessCatalogDescription(source),
    buildSpellSetCatalogDescription(source),
    buildAlchemyCatalogDescription(source),
    buildCriticalSpecializationCatalogDescription(source),
    buildAppearancesCatalogDescription(source),
    buildShoulderToShoulderCatalogDescription(source),
  ].filter(Boolean).join("");
}

function removeStandaloneActionPlusDescription(description) {
  let result = String(description ?? "");
  while (result.includes(ACTION_PLUS_AUTO_DESCRIPTION_START) && result.includes(ACTION_PLUS_AUTO_DESCRIPTION_END)) {
    const startIndex = result.indexOf(ACTION_PLUS_AUTO_DESCRIPTION_START);
    const endIndex = result.indexOf(ACTION_PLUS_AUTO_DESCRIPTION_END, startIndex);
    if (endIndex < 0) break;
    result = `${result.slice(0, startIndex)}${result.slice(endIndex + ACTION_PLUS_AUTO_DESCRIPTION_END.length)}`;
  }

  if (typeof document !== "undefined") {
    const template = document.createElement("template");
    template.innerHTML = result;
    for (const element of template.content.querySelectorAll(`.${ACTION_PLUS_AUTO_DESCRIPTION_CLASS}, [${ACTION_PLUS_AUTO_DESCRIPTION_ATTRIBUTE}]`)) {
      element.remove();
    }
    result = template.innerHTML;
  }
  return result.trim();
}

function buildMergedStandaloneActionPlusDescription(source, currentDescription, level) {
  const generatedDescription = [
    buildSpellSetDescription(source, level),
    buildAlchemyDescription(source, level),
  ].filter(Boolean).join("");
  const manualDescription = removeStandaloneActionPlusDescription(currentDescription);
  const wrappedGenerated = generatedDescription
    ? `${ACTION_PLUS_AUTO_DESCRIPTION_START}\n<div class="${ACTION_PLUS_AUTO_DESCRIPTION_CLASS}" ${ACTION_PLUS_AUTO_DESCRIPTION_ATTRIBUTE}="true">\n${generatedDescription}\n</div>\n${ACTION_PLUS_AUTO_DESCRIPTION_END}`
    : "";
  return [manualDescription, wrappedGenerated].filter(Boolean).join("\n");
}

function actionPlusTypeLabel(slug) {
  for (const choices of [CONFIG.PF2E?.weaknessTypes, CONFIG.PF2E?.resistanceTypes, CONFIG.PF2E?.immunityTypes, CONFIG.PF2E?.damageTypes]) {
    const label = localizeConfigValue(choices, slug);
    if (label && label !== slug) return label;
  }
  return String(slug || "—");
}

function damageAdjustmentFormula(config) {
  const modifier = Math.max(0, Number(config?.modifier) || 0);
  switch (config?.valueMode) {
    case "levelDiv": return `уровень / ${modifier || 2}`;
    case "level": return "уровень";
    case "levelTimes": return `уровень × ${modifier || 2}`;
    case "levelPlus": return `уровень + ${modifier}`;
    case "levelMinus": return `уровень − ${modifier}`;
    default: return String(Number(config?.flatValue) || 0);
  }
}

function buildDamageAdjustmentsCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source);
  const count = options.filter((option) => option === "damageAdjustments").length;
  if (!count) return "";
  const labels = { Weakness: "Слабость", Resistance: "Сопротивление", Immunity: "Иммунитет" };
  return (Array.isArray(flags.damageAdjustments) ? flags.damageAdjustments.slice(0, count) : []).map((config) => {
    const types = (Array.isArray(config?.types) ? config.types : []).map(actionPlusTypeLabel).join(", ") || "тип не выбран";
    const value = config?.adjustmentType === "Immunity" ? "" : `: ${escapeHtml(damageAdjustmentFormula(config))}`;
    const exceptions = (Array.isArray(config?.exceptions) ? config.exceptions : []).map(actionPlusTypeLabel);
    const doubleVs = (Array.isArray(config?.doubleVs) ? config.doubleVs : []).map(actionPlusTypeLabel);
    const notes = [exceptions.length ? `исключения: ${exceptions.join(", ")}` : "", doubleVs.length ? `двойное против: ${doubleVs.join(", ")}` : ""].filter(Boolean);
    return `<p><strong>${labels[config?.adjustmentType] ?? "Корректировка"}:</strong> ${escapeHtml(types)}${value}${notes.length ? ` <span class="tsu-correction-spell-condition">(${escapeHtml(notes.join("; "))})</span>` : ""}</p>`;
  }).join("");
}

function buildRegenerationCatalogDescription(source) {
  const { options } = getActionPlusSourceData(source); if (!options.includes("regeneration")) return "";
  const rules = (source?.system?.rules ?? []).filter((rule) => rule?.key === "FastHealing" && rule?.type === "regeneration");
  return rules.map((rule) => `<p><strong>Регенерация:</strong> ${escapeHtml(String(rule.value ?? "—"))}${Array.isArray(rule.deactivatedBy) && rule.deactivatedBy.length ? `; отключается: ${escapeHtml(rule.deactivatedBy.join(", "))}` : ""}</p>`).join("") || "<p><strong>Регенерация:</strong> правило не настроено</p>";
}

function buildBloodlineCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source); if (!options.includes("bloodline")) return "";
  const spells = Array.isArray(flags.bloodlineSpells) ? flags.bloodlineSpells : [];
  return `<p><strong>Наследие крови:</strong> ${spells.length ? spells.map((spell) => escapeHtml(spell.name || spell.id)).join(", ") : "заклинания не выбраны"}</p>`;
}

function buildEnhancementCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source); const count = options.filter((option) => option === "enhancement").length; if (!count) return "";
  return (Array.isArray(flags.enhancements) ? flags.enhancements.slice(0, count) : []).map((config) => {
    const conditions = [config?.levelRequirement !== "" && config?.levelRequirement != null ? `уровень ${config.levelRequirement}+` : "", config?.actionSlug ? `действие: ${config.actionSlug}` : ""].filter(Boolean);
    return `<p><strong>Усиление${config?.name ? ` «${escapeHtml(config.name)}»` : ""}:</strong>${conditions.length ? ` ${escapeHtml(conditions.join(", "))}.` : ""} ${escapeHtml(config?.text || "текст не задан")}</p>`;
  }).join("");
}

function buildDegreeOfSuccessCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source); if (!options.includes("degreeOfSuccess")) return "";
  const labels = { criticalSuccess: "Критический успех", success: "Успех", failure: "Провал", criticalFailure: "Критический провал" };
  const recipients = { target: "цель", source: "источник" }; const rows = [];
  for (const [degree, degreeLabel] of Object.entries(labels)) for (const [recipient, recipientLabel] of Object.entries(recipients)) {
    const config = flags.degreeOfSuccess?.[degree]?.[recipient]; if (!config?.enabled) continue;
    const effects = (Array.isArray(config.effects) ? config.effects : []).map((effect) => effect.name || effect.uuid).filter(Boolean);
    const values = [config.damage ? `урон ${config.damage}` : "", effects.length ? `эффекты: ${effects.join(", ")}` : ""].filter(Boolean).join("; ") || "без последствий";
    rows.push(`<p><strong>${degreeLabel}, ${recipientLabel}:</strong> ${escapeHtml(values)}</p>`);
  }
  return rows.join("") || "<p><strong>Степени успеха:</strong> последствия не настроены</p>";
}

function buildAppearancesCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source); const count = options.filter((option) => option === "appearances").length; if (!count) return "";
  const values = (Array.isArray(flags.appearances) ? flags.appearances.slice(0, count) : []).map((config) => config?.name || config?.actorName).filter(Boolean);
  return `<p><strong>Облики:</strong> ${values.length ? values.map(escapeHtml).join(", ") : "не настроены"}</p>`;
}

function buildShoulderToShoulderCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source); if (!options.includes("shoulderToShoulder")) return "";
  return `<p><strong>Плечом к плечу:</strong> союзников рядом — ${Math.max(1, Number(flags.shoulderToShoulder?.requiredAllies ?? flags.shoulderToShoulder) || 1)}</p>`;
}

function actionPlusUsesInternalLevels(source) {
  const { options } = getActionPlusSourceData(source);
  return options.includes("spellSet") || options.includes("alchemy");
}

function buildAlchemyCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source);
  if (!options.includes("alchemy")) return "";
  const ranges = Array.isArray(flags.alchemyRanges) ? flags.alchemyRanges : [];
  const details = ranges.map((range) => {
    const start = Math.max(1, Number(range?.start) || 1); const end = Math.min(20, Number(range?.end) || 20);
    const items = (Array.isArray(range?.items) ? range.items : []).filter((item) => item?.name);
    return `<details><summary>Уровни ${start}-${end}</summary>${items.length ? `<p>${items.map((item) => `${formatStoredAlchemyLink(item)} ×${Math.max(1, Number(item.quantity) || 1)}`).join(", ")}</p>` : "<p>Предметы не настроены.</p>"}</details>`;
  }).join("");
  const content = details || "<p>Диапазоны не настроены.</p>";
  const sourceAlreadyNamesAlchemy = /алхими|alchemy/i.test(String(source?.name ?? ""));
  return `${sourceAlreadyNamesAlchemy ? "" : "<p><strong>Алхимия:</strong></p>"}${content}`;
}

function buildSpellSetCatalogDescription(source) {
  const { flags, options } = getActionPlusSourceData(source);
  if (!options.includes("spellSet")) return "";
  const count = options.filter((option) => option === "spellSet").length;
  const configs = Array.isArray(flags.spellSets) ? flags.spellSets.slice(0, count) : [];
  const typeLabels = { prepared: "Подготов.", spontaneous: "Спонтан.", innate: "Врождён.", focus: "Фокус." };
  const traditionLabels = { arcane: "Аркана.", divine: "Сакральная.", occult: "Оккультная.", primal: "Природная." };
  const abilityLabels = { int: "Интеллект.", wis: "Мудрость.", cha: "Харизма." };
  const groups = new Map();
  for (const config of configs) {
    if (!config) continue;
    const key = `${config.type || "prepared"}:${config.tradition || "arcane"}:${config.ability || "cha"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(config);
  }
  const sections = [];
  for (const groupConfigs of groups.values()) {
    const sample = groupConfigs[0];
    const heading = [typeLabels[sample.type] ?? sample.type, traditionLabels[sample.tradition] ?? sample.tradition, abilityLabels[sample.ability] ?? sample.ability].filter(Boolean).map((part) => escapeHtml(part)).join(" ");
    const details = groupConfigs.map((config) => {
    const rows = [];
    for (let rank = 0; rank <= 10; rank++) {
      const spells = (Array.isArray(config.spells) ? config.spells : []).filter((spell) => Number(spell.rank) === rank && spell.name);
      if (spells.length) rows.push(`<p><strong>${rank === 0 ? "Чары" : `Ранг ${rank}`}:</strong> ${spells.map((spell) => {
        const link = `${formatStoredSpellLink(spell)}${formatStoredSpellModifiers(spell)}`;
        if (config.type !== "innate") return link;
        const start = Math.max(1, Number(spell.start) || 1);
        const end = Math.min(20, Number(spell.end) || 20);
        const uses = Math.max(1, Number(spell.uses) || 1);
        const usesLabel = spell.atWill || spell.constant ? "" : `, ${uses} раз`;
        return `${link} <span class="tsu-correction-spell-condition">(уровни ${start}-${end}${usesLabel})</span>`;
      }).join(", ")}</p>`);
    }
      if (config.type === "innate") return rows.join("");
      const start = config.startLevel === "" || config.startLevel == null ? 1 : Math.max(1, Number(config.startLevel) || 1);
      const end = config.endLevel === "" || config.endLevel == null ? 20 : Math.min(20, Number(config.endLevel) || 20);
      return `<details><summary>Уровни ${start}-${end}</summary>${rows.join("")}</details>`;
    }).join("");
    sections.push(sample.type === "innate"
      ? `<p>${heading}</p><details class="tsu-correction-innate-spells"><summary>Врождённые заклинания</summary>${details}</details>`
      : `<p>${heading}</p>${details}`);
  }
  const content = sections.join("");
  if (!content) return "";
  const sourceAlreadyNamesSpellSet = /(?:спис|набор).*заклин|spell\s*set/i.test(String(source?.name ?? ""));
  return `${sourceAlreadyNamesSpellSet ? "" : "<p><strong>Списки заклинаний:</strong></p>"}${content}`;
}

async function hydrateCorrectionSpellSetDescriptions(correction) {
  for (const key of ["classFeatures", "styleFeatures"]) {
    for (const feature of correction[key]) {
      if (!feature.uuid) { feature.spellSetDescription = ""; continue; }
      const source = await fromUuid(feature.uuid).catch(() => null);
      feature.spellSetDescription = source ? buildActionPlusCatalogDescription(source) : feature.spellSetDescription;
      feature.usesInternalLevels = source ? actionPlusUsesInternalLevels(source) : feature.usesInternalLevels;
    }
  }
}

function getFeatureSourceFromItem(droppedItem) {
  const uuid = droppedItem?.uuid ?? "";
  return {
    id: droppedItem?.id ?? uuid,
    uuid,
    name: droppedItem?.name ?? "",
    gainLevel: String(droppedItem?.system?.level?.value ?? ""),
    loseLevel: "",
    note: "",
    spellSetDescription: buildActionPlusCatalogDescription(droppedItem),
    usesInternalLevels: actionPlusUsesInternalLevels(droppedItem),
  };
}

function getActorLevel(actor) {
  return Number(actor?.system?.details?.level?.value ?? actor?.level ?? 0) || 0;
}

function getTableValue(tableName, level, rank) {
  if (!rank || rank === "none") return null;
  return STAT_TABLES[tableName]?.[String(level)]?.[rank] ?? null;
}

function bestRank(left = "none", right = "none") {
  return OLD_RANKS.indexOf(right) > OLD_RANKS.indexOf(left) ? right : left;
}

function setBestRank(target, key, rank) {
  if (!key || !rank) return;
  target[key] = bestRank(target[key] ?? "none", rank);
}

function getCorrectionActions(actor) {
  return (actor?.itemTypes?.action ?? actor?.items?.contents ?? []).filter((item) => isCorrectionAction(item));
}

function addRankedCorrections(result, entries, rankKey, { skillMode = false, dcMode = false } = {}) {
  const rank = CORRECTION_TO_OLD_RANK[rankKey] ?? rankKey;
  for (const entry of entries ?? []) {
    const slug = String(entry.slug ?? "").trim();
    if (!slug) continue;

    if (dcMode) {
      setBestRank(result.stats, DC_SLUGS[slug] ?? slug, rank);
      continue;
    }

    if (skillMode) {
      const skillSlug = SKILL_SLUGS[slug];
      if (skillSlug) {
        setBestRank(result.skills, skillSlug, rank);
      } else {
        const current = result.lores.get(slug);
        result.lores.set(slug, {
          slug,
          label: entry.label || slug,
          rank: bestRank(current?.rank ?? "none", rank),
        });
      }
      continue;
    }

    setBestRank(result.stats, slug, rank);
  }
}

function collectCorrectionApplication(actor) {
  const result = {
    size: "",
    stats: {},
    skills: {},
    lores: new Map(),
    equipment: [],
    features: [],
    allFeatures: [],
    correctionIds: [],
  };
  const level = getActorLevel(actor);

  for (const item of getCorrectionActions(actor)) {
    const correction = getCorrection(item);
    result.correctionIds.push(item.id);
    if (correction.size) result.size = correction.size;

    for (const rank of RANKS) {
      addRankedCorrections(result, correction.abilities[rank], rank);
      addRankedCorrections(result, correction.skills[rank], rank, { skillMode: true });
      addRankedCorrections(result, correction.dcs[rank], rank, { dcMode: true });
    }

    result.equipment.push(...correction.equipment);
    const allFeatures = [...correction.classFeatures, ...correction.styleFeatures];
    result.allFeatures.push(...allFeatures);
    result.features.push(...getActiveCorrectionFeatures(allFeatures, level));
  }

  return result;
}

function getActiveCorrectionFeatures(features, level) {
  return features.filter((feature) => {
    const gainLevel = Number(feature.gainLevel || -1);
    const loseLevel = Number(feature.loseLevel || 0);
    return level >= gainLevel && (!loseLevel || level < loseLevel);
  });
}

function buildActorCorrectionUpdate(actor, application) {
  const level = getActorLevel(actor);
  const update = {};
  const abilityKeys = new Set(["str", "dex", "con", "int", "wis", "cha"]);

  if (application.size) update["system.traits.size.value"] = application.size;

  for (const [key, rank] of Object.entries(application.stats)) {
    if (abilityKeys.has(key)) {
      const value = getTableValue("abilityScores", level, rank);
      if (value !== null) update[`system.abilities.${key}.mod`] = Number(value);
      continue;
    }

    if (key === "ac") {
      const value = getTableValue("armorClass", level, rank);
      if (value !== null) update["system.attributes.ac.value"] = Number(value);
      continue;
    }

    if (["fortitude", "reflex", "will"].includes(key)) {
      const value = getTableValue("perceptionSaves", level, rank);
      if (value !== null) update[`system.saves.${key}.value`] = Number(value);
      continue;
    }

    if (key === "perception") {
      const value = getTableValue("perceptionSaves", level, rank);
      if (value !== null) update["system.perception.mod"] = Number(value);
      continue;
    }

    if (key === "hp") {
      const value = getTableValue("hitPoints", level, rank);
      if (value !== null) {
        update["system.attributes.hp.value"] = Number(value);
        update["system.attributes.hp.max"] = Number(value);
      }
    }
  }

  for (const [skill, rank] of Object.entries(application.skills)) {
    const value = getTableValue("skills", level, rank);
    if (value !== null) update[`system.skills.${skill}.base`] = Number(value);
  }

  update[`flags.${MODULE_ID}.creatureCorrectionApplication`] = {
    corrections: application.correctionIds,
    size: application.size,
    equipment: application.equipment,
    stats: application.stats,
    skills: application.skills,
    lores: Array.from(application.lores.values()),
    spellcasting: application.stats.spell ? (() => {
      const value = getTableValue("spellcasting", level, application.stats.spell);
      return value === null ? null : { dc: Number(value) + 8 };
    })() : null,
  };

  return update;
}

async function applySpellCorrection(actor, rank) {
  const value = getTableValue("spellcasting", getActorLevel(actor), rank);
  if (value === null) return;
  const dc = Number(value) + 8;

  const spellSetEntries = actor.itemTypes?.spellcastingEntry?.filter((item) => (
    item.getFlag(MODULE_ID, "spellSetGenerated")?.kind === "entry"
  )) ?? [];

  if (spellSetEntries.length) {
    await actor.updateEmbeddedDocuments("Item", spellSetEntries.map((entry) => ({
      _id: entry.id,
      "system.spelldc.dc": dc,
      "system.spelldc.value": dc - 8,
    })));
  }
}

async function removeLegacyCorrectionSpellcasting(actor) {
  const ids = actor.itemTypes?.spellcastingEntry?.filter((item) => item.getFlag(MODULE_ID, "creatureCorrectionSpellcasting")).map((item) => item.id) ?? [];
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

function loreDisplayName(lore) {
  const label = String(lore.label || lore.slug || "").replace(/-/g, " ").replace(/\blore\b/gi, "").trim();
  const capitalized = label ? label.charAt(0).toUpperCase() + label.slice(1) : "Lore";
  return /\bLore\b/i.test(capitalized) ? capitalized : `${capitalized} Lore`;
}

async function applyLoreCorrections(actor, lores) {
  const level = getActorLevel(actor);
  const creates = [];
  const updates = [];

  for (const lore of lores) {
    const value = getTableValue("skills", level, lore.rank);
    if (value === null) continue;

    const existing = actor.itemTypes?.lore?.find((item) => (
      item.getFlag(MODULE_ID, "creatureCorrectionLore") === lore.slug
      || String(item.slug ?? item.system?.slug ?? "").toLowerCase() === lore.slug
    ));

    if (existing) {
      // pf2e-ru's Lore preUpdateItem hook expects updateData.name to exist.
      updates.push({
        _id: existing.id,
        name: existing.name,
        "system.mod.value": Number(value),
        "system.proficient.value": 0,
      });
    } else {
      creates.push({
        name: loreDisplayName(lore),
        type: "lore",
        img: "systems/pf2e/icons/default-icons/lore.svg",
        system: { mod: { value: Number(value) }, proficient: { value: 0 } },
        flags: { [MODULE_ID]: { creatureCorrectionLore: lore.slug } },
      });
    }
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (creates.length) await actor.createEmbeddedDocuments("Item", creates);
}

function featureKey(feature) {
  return feature.uuid || `manual:${feature.name}`;
}

function actorHasFeature(actor, feature) {
  const key = featureKey(feature);
  return (actor.items?.contents ?? actor.items ?? []).some((item) => (
    item.getFlag?.(MODULE_ID, "creatureCorrectionFeature") === key
    || (feature.uuid && (
      item.uuid === feature.uuid
      || item.sourceId === feature.uuid
      || item.flags?.core?.sourceId === feature.uuid
      || item._stats?.compendiumSource === feature.uuid
    ))
    || (!feature.uuid && item.name === feature.name)
  ));
}

function buildSpellSetDescription(source, level) {
  const flags = source?.flags?.[MODULE_ID] ?? {};
  const options = Array.isArray(flags.actionOptions) ? flags.actionOptions : [flags.actionOption].filter(Boolean);
  if (!options.includes("spellSet")) return "";
  const count = options.filter((option) => option === "spellSet").length;
  const configs = Array.isArray(flags.spellSets) ? flags.spellSets.slice(0, count) : [];
  const maxRank = Math.min(10, Math.ceil(level / 2));
  const blocks = [];
  for (const config of configs) {
    if (!config || (["prepared", "spontaneous"].includes(config.type) && ((config.startLevel !== "" && config.startLevel != null && level < Number(config.startLevel)) || (config.endLevel !== "" && config.endLevel != null && level > Number(config.endLevel))))) continue;
    const active = (Array.isArray(config.spells) ? config.spells : []).filter((spell) => {
      if (["prepared", "spontaneous"].includes(config.type)) return Number(spell.rank) <= maxRank && (Number(spell.rank) === 0 || !spell.evenOnly || level % 2 === 0);
      const starts = level >= Number(spell.start || 1); const ends = config.type !== "innate" || level <= Number(spell.end || 20); return starts && ends;
    });
    const rows = [];
    for (let rank = 0; rank <= 10; rank++) {
      const spells = active.filter((spell) => Number(spell.rank) === rank && spell.name);
      if (spells.length) rows.push(`<p><strong>${rank === 0 ? "Чары" : `Ранг ${rank}`}:</strong> ${spells.map((spell) => `${formatStoredSpellLink(spell)}${formatStoredSpellModifiers(spell)}`).join(", ")}</p>`);
    }
    blocks.push(`<h3>${escapeHtml(config.name || source.name || "Набор заклинаний")}</h3>${rows.join("")}`);
  }
  return blocks.join("");
}

function buildAlchemyDescription(source, level) {
  const flags = source?.flags?.[MODULE_ID] ?? {};
  const options = Array.isArray(flags.actionOptions) ? flags.actionOptions : [flags.actionOption].filter(Boolean);
  if (!options.includes("alchemy")) return "";
  const range = (Array.isArray(flags.alchemyRanges) ? flags.alchemyRanges : []).find((entry) => level >= Number(entry?.start || 1) && level <= Number(entry?.end || 20));
  const items = (Array.isArray(range?.items) ? range.items : []).filter((item) => item?.name);
  if (!items.length) return "";
  return `<h3>Продвинутая алхимия</h3><p>${items.map((item) => `${formatStoredAlchemyLink(item)} ×${Math.max(1, Number(item.quantity) || 1)}`).join(", ")}</p>`;
}

async function applyFeatureCorrections(actor, activeFeatures, allFeatures = activeFeatures) {
  const managedKeys = new Set(allFeatures.map((feature) => featureKey(feature)));
  const activeKeys = new Set(activeFeatures.map((feature) => featureKey(feature)));
  const deleteIds = (actor.items?.contents ?? actor.items ?? [])
    .filter((item) => {
      const key = item.getFlag?.(MODULE_ID, "creatureCorrectionFeature");
      return key && managedKeys.has(key) && !activeKeys.has(key);
    })
    .map((item) => item.id);

  if (deleteIds.length) await actor.deleteEmbeddedDocuments("Item", deleteIds);

  const creates = [];
  const updates = [];
  for (const feature of activeFeatures) {
    if (!feature.name && !feature.uuid) continue;

    const sourceItem = feature.uuid ? await fromUuid(feature.uuid).catch(() => null) : null;
    const source = sourceItem?.toObject?.() ?? {
      name: feature.name || "Способность корректировки",
      type: "action",
      system: { description: { value: feature.note || "" }, traits: { value: [] } },
    };
    const generatedDescription = [buildSpellSetDescription(source, getActorLevel(actor)), buildAlchemyDescription(source, getActorLevel(actor))].filter(Boolean).join("");
    if (generatedDescription) {
      source.system ??= {};
      source.system.description ??= {};
      source.system.description.value = [source.system.description.value, generatedDescription]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join("\n");
    }
    const existing = (actor.items?.contents ?? actor.items ?? []).find((item) => item.getFlag?.(MODULE_ID, "creatureCorrectionFeature") === featureKey(feature));
    if (existing) {
      const updateSource = foundry.utils.deepClone(source);
      updateSource._id = existing.id;
      delete updateSource.folder; delete updateSource.sort; delete updateSource.ownership;
      updateSource.flags ??= {}; updateSource.flags[MODULE_ID] ??= {};
      updateSource.flags[MODULE_ID].creatureCorrectionFeature = featureKey(feature);
      if (existing.system?.frequency?.value != null && updateSource.system?.frequency) updateSource.system.frequency.value = existing.system.frequency.value;
      updates.push(updateSource);
      continue;
    }
    if (actorHasFeature(actor, feature)) continue;
    source.flags ??= {};
    source.flags[MODULE_ID] ??= {};
    source.flags[MODULE_ID].creatureCorrectionFeature = featureKey(feature);
    creates.push(source);
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (creates.length) await actor.createEmbeddedDocuments("Item", creates);
}

async function applyCreatureCorrectionToActor(actor) {
  if (!actor || actor.type !== "npc") return;
  const correctionItems = getCorrectionActions(actor);
  if (!correctionItems.length) return;

  const application = collectCorrectionApplication(actor);
  const update = buildActorCorrectionUpdate(actor, application);
  if (Object.keys(update).length) await actor.update(update);

  await removeLegacyCorrectionSpellcasting(actor);
  if (application.stats.spell) await applySpellCorrection(actor, application.stats.spell);
  await applyLoreCorrections(actor, Array.from(application.lores.values()));
  await applyFeatureCorrections(actor, application.features, application.allFeatures);
}

function scheduleActorCorrectionApply(actor) {
  if (!actor || actor.type !== "npc") return;

  const state = actorCorrectionApplyTasks.get(actor) ?? { timer: null, running: false, rerun: false };
  actorCorrectionApplyTasks.set(actor, state);

  if (state.running) {
    state.rerun = true;
    return;
  }

  if (state.timer) return;

  state.timer = window.setTimeout(() => {
    state.timer = null;
    void runScheduledActorCorrectionApply(actor, state);
  }, 0);
}

async function runScheduledActorCorrectionApply(actor, state) {
  if (state.running) {
    state.rerun = true;
    return;
  }

  state.running = true;

  try {
    do {
      state.rerun = false;
      await applyCreatureCorrectionToActor(actor);
    } while (state.rerun);
  } finally {
    state.running = false;
    if (!state.timer && !state.rerun) actorCorrectionApplyTasks.delete(actor);
  }
}

function activateCorrectionEditor(root, item) {
  const editor = root.querySelector(".tsu-correction-editor");
  if (!editor) return;
  let draggedFeature = null;

  editor.querySelector(".tsu-correction-size-input")?.addEventListener("change", async (event) => {
    const correction = getCorrection(item);
    correction.size = String(event.currentTarget.value ?? "").trim();
    await persistCorrection(item, correction);
  });

  for (const button of editor.querySelectorAll(".tsu-correction-edit-rank")) {
    button.addEventListener("click", async () => {
      await openRankDialog(item, button.dataset.section, button.dataset.rank);
    });
  }

  for (const input of editor.querySelectorAll(".tsu-correction-title-input")) {
    input.addEventListener("change", async () => {
      const correction = getCorrection(item);
      correction[input.dataset.field] = String(input.value ?? "").trim();
      await persistCorrection(item, correction);
    });
  }

  for (const input of editor.querySelectorAll(".tsu-correction-kit-input")) {
    input.addEventListener("change", async () => {
      const correction = getCorrection(item);
      correction.equipment[Number(input.dataset.index)] = String(input.value ?? "").trim();
      await persistCorrection(item, correction);
    });
  }

  editor.querySelector(".tsu-correction-add-kit")?.addEventListener("click", async () => {
    const input = editor.querySelector(".tsu-correction-new-kit");
    const value = String(input?.value ?? "").trim();
    if (!value) return;
    const correction = getCorrection(item);
    correction.equipment.push(value);
    await persistCorrection(item, correction);
  });

  for (const button of editor.querySelectorAll(".tsu-correction-remove-kit")) {
    button.addEventListener("click", async () => {
      const correction = getCorrection(item);
      correction.equipment.splice(Number(button.dataset.index), 1);
      await persistCorrection(item, correction);
    });
  }

  for (const input of editor.querySelectorAll(".tsu-correction-feature-input")) {
    input.addEventListener("change", async () => {
      const correction = getCorrection(item);
      const row = correction[input.dataset.field]?.[Number(input.dataset.index)];
      if (!row) return;
      row[input.dataset.prop] = input.dataset.prop?.endsWith("Level") ? normalizeLevel(input.value) : String(input.value ?? "").trim();
      await persistCorrection(item, correction);
    });
  }

  for (const button of editor.querySelectorAll(".tsu-correction-remove-feature")) {
    button.addEventListener("click", async () => {
      const correction = getCorrection(item);
      correction[button.dataset.field].splice(Number(button.dataset.index), 1);
      await persistCorrection(item, correction);
    });
  }

  for (const button of editor.querySelectorAll(".tsu-correction-add-feature")) {
    button.addEventListener("click", async () => {
      const field = button.dataset.field;
      const input = editor.querySelector(`.tsu-correction-manual-feature[data-field="${field}"]`);
      const value = String(input?.value ?? "").trim();
      if (!value) return;
      const correction = getCorrection(item);
      correction[field].push(normalizeFeature({ name: value, gainLevel: "" }));
      await persistCorrection(item, correction);
    });
  }

  for (const list of editor.querySelectorAll(".tsu-correction-feature-list")) {
    for (const handle of list.querySelectorAll(".tsu-correction-feature-drag-handle")) {
      handle.addEventListener("dragstart", (event) => {
        draggedFeature = {
          field: handle.dataset.field,
          index: Number(handle.dataset.index),
        };
        handle.closest(".tsu-correction-feature-row")?.classList.add("tsu-correction-feature-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `tsu-correction-feature:${draggedFeature.field}:${draggedFeature.index}`);
      });
      handle.addEventListener("dragend", () => {
        draggedFeature = null;
        editor.querySelectorAll(".tsu-correction-feature-row").forEach((row) => {
          row.classList.remove("tsu-correction-feature-dragging", "tsu-correction-feature-drop-before", "tsu-correction-feature-drop-after");
        });
      });
    }

    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedFeature?.field !== list.dataset.field) return;
      event.dataTransfer.dropEffect = "move";
      const targetRow = event.target.closest(".tsu-correction-feature-row");
      list.querySelectorAll(".tsu-correction-feature-row").forEach((row) => {
        row.classList.remove("tsu-correction-feature-drop-before", "tsu-correction-feature-drop-after");
      });
      if (!targetRow || Number(targetRow.dataset.index) === draggedFeature.index) return;
      const after = event.clientY > targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2;
      targetRow.classList.add(after ? "tsu-correction-feature-drop-after" : "tsu-correction-feature-drop-before");
    });
    list.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (draggedFeature?.field === list.dataset.field) {
        const targetRow = event.target.closest(".tsu-correction-feature-row");
        const correction = getCorrection(item);
        const features = correction[list.dataset.field];
        const sourceIndex = draggedFeature.index;
        let targetIndex = targetRow ? Number(targetRow.dataset.index) : features.length;
        if (targetRow && event.clientY > targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2) targetIndex += 1;
        if (sourceIndex < targetIndex) targetIndex -= 1;
        if (sourceIndex === targetIndex) return;
        const [feature] = features.splice(sourceIndex, 1);
        if (!feature) return;
        features.splice(targetIndex, 0, feature);
        draggedFeature = null;
        await persistCorrection(item, correction);
        return;
      }
      const data = TextEditor.getDragEventData(event);
      if (data?.type !== "Item" || !data.uuid) return;
      const droppedItem = await fromUuid(data.uuid).catch(() => null);
      if (!droppedItem) return;
      const correction = getCorrection(item);
      correction[list.dataset.field].push(normalizeFeature(getFeatureSourceFromItem(droppedItem)));
      await persistCorrection(item, correction);
    });
  }

  editor.querySelector(".tsu-correction-refresh-description")?.addEventListener("click", async () => {
    await persistCorrection(item, getCorrection(item));
  });
}

function getCorrectionItems(actor) {
  return (actor?.itemTypes?.action ?? actor?.items?.contents ?? [])
    .filter((item) => isCorrectionAction(item))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), game.i18n?.lang || "ru"));
}

function createActorCorrectionBlock(root, items) {
  const section = document.createElement("div");
  section.className = "adjustments-section section-container tsu-actor-corrections";
  section.innerHTML = `
    <div class="section-header tsu-actor-corrections-header">
      <h4>${ACTOR_CORRECTIONS_LABEL}</h4>
      <div class="actions-controls controls">
        <a class="tsu-actor-corrections-create" data-action="create-correction" data-tooltip="Создать корректировку"><i class="fas fa-plus"></i></a>
      </div>
    </div>
    <div class="section-body">
      <ol class="actions-list item-list items-list"></ol>
    </div>
  `;

  const list = section.querySelector(".item-list");
  for (const item of items) {
    const row = findOriginalItemRow(root, item);
    if (row) {
      row.classList.add("tsu-correction-native-row");
      list.append(row);
    } else {
      list.insertAdjacentHTML("beforeend", `
        <li class="item tsu-correction-fallback-row" data-item-id="${escapeHtml(item.id)}">
          <h4 class="item-name">√ ${escapeHtml(item.name)}</h4>
        </li>
      `);
    }
  }

  return section;
}

function findOriginalItemRow(root, item) {
  const selectors = [
    `[data-item-id="${cssEscape(item.id)}"]`,
    `[data-item-id="${cssEscape(item._id ?? item.id)}"]`,
    `[data-document-id="${cssEscape(item.id)}"]`,
  ];
  for (const element of root.querySelectorAll(selectors.join(","))) {
    if (element.closest(".tsu-actor-corrections, .tsu-character-corrections-list")) continue;
    const row = element.closest("li.item, .item") ?? element;
    if (row.closest(".tsu-actor-corrections, .tsu-character-corrections-list")) continue;
    return row;
  }
  return null;
}

function findOriginalItemRows(root, item) {
  const selectors = [
    `[data-item-id="${cssEscape(item.id)}"]`,
    `[data-item-id="${cssEscape(item._id ?? item.id)}"]`,
    `[data-document-id="${cssEscape(item.id)}"]`,
  ];
  return Array.from(root.querySelectorAll(selectors.join(",")))
    .map((element) => element.closest("li.item, .item") ?? element)
    .filter((row, index, rows) => (
      rows.indexOf(row) === index
      && !row.closest(".tsu-actor-corrections, .tsu-character-corrections-list")
    ));
}

function removeCharacterCorrectionBlock(root) {
  root.querySelector(".tsu-character-corrections-header")?.remove();
  root.querySelector(".tsu-character-corrections-list")?.remove();
}

function organizeCharacterCorrectionBlock(root, actor, items) {
  const panel = root.querySelector('.tab.actions[data-tab="actions"] .actions-panel[data-tab="encounter"]')
    ?? root.querySelector('.actions-panel[data-tab="encounter"]');
  if (!panel) return;

  let header = root.querySelector(".tsu-character-corrections-header");
  let list = root.querySelector(".tsu-character-corrections-list");
  if (!header || !list) {
    removeCharacterCorrectionBlock(root);
    header = document.createElement("header");
    header.className = "tsu-character-corrections-header";
    header.innerHTML = `${escapeHtml(ACTOR_CORRECTIONS_LABEL)}<div class="controls"><button type="button" class="tsu-actor-corrections-create" data-action="create-correction"><i class="fa-solid fa-fw fa-plus"></i></button></div>`;
    list = document.createElement("ol");
    list.className = "actions-list item-list directory-list tsu-character-corrections-list";
    panel.append(header, list);
    activateActorCorrectionBlock(root, actor);
  }

  for (const item of items) {
    const rows = findOriginalItemRows(root, item);
    const existing = list.querySelector(`[data-item-id="${cssEscape(item.id)}"], [data-document-id="${cssEscape(item.id)}"]`);
    if (existing) {
      rows.forEach((row) => row.remove());
    } else if (rows.length) {
      list.append(rows[0]);
      rows.slice(1).forEach((row) => row.remove());
    } else {
      const row = document.createElement("li");
      row.className = "action item";
      row.dataset.itemId = item.id;
      row.innerHTML = `<a class="icon item-image framed"><img src="${escapeHtml(item.img)}"></a><h4 class="name"><a>${escapeHtml(item.name)}</a></h4><div class="item-controls"><a data-action="edit-item"><i class="fa-solid fa-fw fa-edit"></i></a><a data-action="delete-item"><i class="fa-solid fa-fw fa-trash"></i></a></div>`;
      row.addEventListener("dblclick", () => item.sheet?.render(true));
      list.append(row);
    }
  }
}

function hideCorrectionItems(root, items) {
  root.querySelector(".tsu-actor-corrections")?.remove();
  removeCharacterCorrectionBlock(root);
  for (const item of items) findOriginalItemRows(root, item).forEach((row) => row.remove());
}

function cssEscape(value) {
  if (globalThis.CSS?.escape instanceof Function) return CSS.escape(String(value ?? ""));
  return String(value ?? "").replace(/["\\]/g, "\\$&");
}

function findActorBlockAnchor(root) {
  const headers = Array.from(root.querySelectorAll("h3, h4, header, .section-header, .items-header"));
  const passiveHeader = headers.find((element) => /пассив|passive/i.test(element.textContent ?? ""));
  if (passiveHeader) return passiveHeader.closest("section, .section-container, .actions-list, .item-container") ?? passiveHeader.parentElement;

  const actionHeader = headers.reverse().find((element) => /действ|action/i.test(element.textContent ?? ""));
  if (actionHeader) return actionHeader.closest("section, .section-container, .actions-list, .item-container") ?? actionHeader.parentElement;

  return root.querySelector(".tab.active") ?? root.querySelector("form") ?? root;
}

function activateActorCorrectionBlock(root, actor) {
  root.querySelector(".tsu-actor-corrections-create")?.addEventListener("click", async () => {
    await actor.createEmbeddedDocuments("Item", [{
      type: "action",
      name: "√ Корректировка",
      system: {
        traits: { value: [CORRECTION_TRAIT_SLUG] },
        description: { value: "" },
      },
      flags: {
        [MODULE_ID]: {
          [FLAG_KEY]: normalizeCorrection({}),
        },
      },
    }]);
  });
}

Hooks.once("init", registerCorrectionTrait);
Hooks.once("setup", registerCorrectionTrait);
Hooks.once("ready", registerCorrectionTrait);

Hooks.on("renderItemSheet", (app, html) => {
  const item = app.document ?? app.object;
  if (!isCorrectionAction(item)) return;

  const root = getHtmlElement(html);
  if (!root || root.querySelector(".tsu-correction-editor")) return;

  const detailsTab = root.querySelector('.tab[data-tab="details"]') ?? root.querySelector(".tab.active") ?? root;
  const publicationFieldset = detailsTab.querySelector("fieldset.publication");
  const insertTarget = publicationFieldset ?? detailsTab;
  insertTarget.insertAdjacentHTML(publicationFieldset ? "afterend" : "beforeend", renderCorrectionEditor(item));
  activateCorrectionEditor(root, item);
});

Hooks.on("preUpdateItem", (item, changed) => {
  if (item.type !== "action" || isCorrectionAction(item, changed) || isCorrectionAction(item)) return;
  const actionPlusChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOptions`)
    || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOption`)
    || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.spellSets`)
    || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.alchemyRanges`);
  if (!actionPlusChanged) return;

  const pendingSource = foundry.utils.mergeObject(
    foundry.utils.deepClone(item.toObject()),
    foundry.utils.expandObject(changed),
    { inplace: false, performDeletions: true },
  );
  const currentDescription = foundry.utils.getProperty(changed, "system.description.value")
    ?? item._source?.system?.description?.value
    ?? item.system?.description?.value
    ?? "";
  foundry.utils.setProperty(
    changed,
    "system.description.value",
    buildMergedStandaloneActionPlusDescription(pendingSource, currentDescription, getActorLevel(item.actor)),
  );
});

Hooks.on("preUpdateItem", (item, changed) => {
  if (!isCorrectionAction(item, changed)) return;
  const correctionChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`);
  const actionPlusChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)
    || foundry.utils.hasProperty(changed, "system.rules");
  if (!correctionChanged && !actionPlusChanged) return;

  const correction = getCorrection(item, changed);
  const pendingSource = foundry.utils.mergeObject(
    foundry.utils.deepClone(item.toObject()),
    foundry.utils.expandObject(changed),
    { inplace: false, performDeletions: true },
  );
  pendingSource.uuid = item.uuid;
  const currentDescription = foundry.utils.getProperty(changed, "system.description.value")
    ?? item._source?.system?.description?.value
    ?? item.system?.description?.value
    ?? "";
  foundry.utils.setProperty(
    changed,
    "system.description.value",
    buildMergedCorrectionDescription(item, correction, currentDescription, getCorrection(item), pendingSource),
  );
});

Hooks.on("createItem", (item) => {
  if (!isCorrectionAction(item)) return;
  scheduleActorCorrectionApply(item.actor);
});

Hooks.on("updateItem", (item, changed) => {
  if (!isCorrectionAction(item, changed) && !isCorrectionAction(item)) return;
  scheduleActorCorrectionApply(item.actor);
});

Hooks.on("updateActor", (actor, changed) => {
  if (!actor || actor.type !== "npc") return;
  const levelChanged = [
    "system.details.level.value",
    "system.details.level",
    "system.level.value",
    "level",
  ].some((path) => foundry.utils.hasProperty(changed, path));
  if (!levelChanged) return;
  scheduleActorCorrectionApply(actor);
});

Hooks.on("createActor", (actor) => {
  scheduleActorCorrectionApply(actor);
});

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app.document ?? app.object;
  if (!actor || !["npc", "character"].includes(actor.type)) return;

  const items = getCorrectionItems(actor);
  const root = getHtmlElement(html);
  if (!root) return;

  root.querySelector(".tsu-actor-corrections")?.remove();
  removeCharacterCorrectionBlock(root);
  if (!items.length) return;

  if (!game.user?.isGM) {
    const hide = () => {
      if (root.isConnected) hideCorrectionItems(root, items);
    };
    hideCorrectionItems(root, items);
    for (const delay of [0, 100, 500]) setTimeout(hide, delay);
    return;
  }

  if (actor.type === "character") {
    const organize = () => {
      if (root.isConnected) organizeCharacterCorrectionBlock(root, actor, items);
    };
    organizeCharacterCorrectionBlock(root, actor, items);
    for (const delay of [0, 100, 500]) setTimeout(organize, delay);
    return;
  }

  const anchor = findActorBlockAnchor(root);
  anchor.after(createActorCorrectionBlock(root, items));
  activateActorCorrectionBlock(root, actor);
});
