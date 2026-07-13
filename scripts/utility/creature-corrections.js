import { escapeHtml, MODULE_ID } from "../core.js";

export const CREATURE_CORRECTION_FLAG_KEY = "creatureCorrection";
const FLAG_KEY = CREATURE_CORRECTION_FLAG_KEY;
const CORRECTION_TRAIT_SLUG = "correction";
const CORRECTION_TRAIT_LABEL = "Корректировка";
const CORRECTION_TRAIT_SLUGS = new Set(["correction", "korrektirovka", "корректировка"]);
const AUTO_DESCRIPTION_START = "<!-- ts-pf2e-utility:creature-correction:auto:start -->";
const AUTO_DESCRIPTION_END = "<!-- ts-pf2e-utility:creature-correction:auto:end -->";
const AUTO_DESCRIPTION_CLASS = "tsu-correction-auto-description";
const AUTO_DESCRIPTION_ATTRIBUTE = "data-tsu-correction-auto-description";
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
  return {
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
  const previousCorrection = getCorrection(item);
  const currentDescription = item.system?.description?.value ?? item._source?.system?.description?.value ?? "";
  await item.update({
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: normalized,
    "system.description.value": buildMergedCorrectionDescription(item, normalized, currentDescription, previousCorrection),
  });
}

function buildCorrectionDescription(item, correction = getCorrection(item)) {
  const blocks = [];
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

  if (correction.equipment.length) {
    blocks.push(`<h2>${SECTION_LABELS.equipment}:</h2>\n${correction.equipment.map((kit) => `<p>${escapeHtml(kit)}</p>`).join("\n")}`);
  }

  for (const [key, label] of [
    ["classFeatures", buildFeatureSectionTitle("Общие способности", correction.classFeaturesTitle)],
    ["styleFeatures", buildFeatureSectionTitle("Способности", correction.styleFeaturesTitle)],
  ]) {
    const lines = correction[key]
      .filter((feature) => feature.name || feature.uuid)
      .map((feature) => `<p>${formatFeatureDescriptionLine(feature)}</p>`);
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

function buildMergedCorrectionDescription(item, correction, currentDescription, previousCorrection = getCorrection(item)) {
  const previousAutoDescription = buildCorrectionDescription(item, previousCorrection);
  const nextRawAutoDescription = buildCorrectionDescription(item, correction);
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

function getFeatureSourceFromItem(droppedItem) {
  const uuid = droppedItem?.uuid ?? "";
  return {
    id: droppedItem?.id ?? uuid,
    uuid,
    name: droppedItem?.name ?? "",
    gainLevel: String(droppedItem?.system?.level?.value ?? ""),
    loseLevel: "",
    note: "",
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
    equipment: application.equipment,
    stats: application.stats,
    skills: application.skills,
    lores: Array.from(application.lores.values()),
  };

  return update;
}

function findCorrectionSpellcastingEntry(actor) {
  return actor?.itemTypes?.spellcastingEntry?.find((item) => item.getFlag(MODULE_ID, "creatureCorrectionSpellcasting")) ?? null;
}

async function applySpellCorrection(actor, rank) {
  const value = getTableValue("spellcasting", getActorLevel(actor), rank);
  if (value === null) return;

  const existing = findCorrectionSpellcastingEntry(actor);
  const source = {
    name: "Заклинания корректировки",
    type: "spellcastingEntry",
    system: {
      spelldc: { value: Number(value), dc: Number(value) + 10 },
      tradition: "arcane",
      prepared: { value: "innate" },
    },
    flags: { [MODULE_ID]: { creatureCorrectionSpellcasting: true } },
  };

  if (existing) {
    await existing.update({
      "system.spelldc.value": Number(value),
      "system.spelldc.dc": Number(value) + 10,
    });
  } else {
    await actor.createEmbeddedDocuments("Item", [source]);
  }
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
      updates.push({ _id: existing.id, "system.mod.value": Number(value), "system.proficient.value": 0 });
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
  for (const feature of activeFeatures) {
    if (!feature.name && !feature.uuid) continue;
    if (actorHasFeature(actor, feature)) continue;

    const sourceItem = feature.uuid ? await fromUuid(feature.uuid).catch(() => null) : null;
    const source = sourceItem?.toObject?.() ?? {
      name: feature.name || "Способность корректировки",
      type: "action",
      system: { description: { value: feature.note || "" }, traits: { value: [] } },
    };
    source.flags ??= {};
    source.flags[MODULE_ID] ??= {};
    source.flags[MODULE_ID].creatureCorrectionFeature = featureKey(feature);
    creates.push(source);
  }

  if (creates.length) await actor.createEmbeddedDocuments("Item", creates);
}

async function applyCreatureCorrectionToActor(actor) {
  if (!actor || actor.type !== "npc") return;
  const correctionItems = getCorrectionActions(actor);
  if (!correctionItems.length) return;

  const application = collectCorrectionApplication(actor);
  const update = buildActorCorrectionUpdate(actor, application);
  if (Object.keys(update).length) await actor.update(update);

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
    list.addEventListener("dragover", (event) => event.preventDefault());
    list.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
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
      <h4>КОРРЕКТИРОВКИ</h4>
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
    if (element.closest(".tsu-actor-corrections")) continue;
    const row = element.closest("li.item, .item") ?? element;
    if (row.closest(".tsu-actor-corrections")) continue;
    return row;
  }
  return null;
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
  if (!isCorrectionAction(item, changed)) return;
  if (!foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`)) return;

  const correction = getCorrection(item, changed);
  const currentDescription = foundry.utils.getProperty(changed, "system.description.value")
    ?? item._source?.system?.description?.value
    ?? item.system?.description?.value
    ?? "";
  foundry.utils.setProperty(
    changed,
    "system.description.value",
    buildMergedCorrectionDescription(item, correction, currentDescription, getCorrection(item)),
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
  if (!actor || actor.type !== "npc") return;

  const items = getCorrectionItems(actor);
  const root = getHtmlElement(html);
  if (!root) return;

  root.querySelector(".tsu-actor-corrections")?.remove();
  if (!items.length) return;

  const anchor = findActorBlockAnchor(root);
  anchor.after(createActorCorrectionBlock(root, items));
  activateActorCorrectionBlock(root, actor);
});
