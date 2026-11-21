import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { getPendingActionPlusOptions, isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "alchemy";
const FLAG_KEY = "alchemyRanges";
const DC_FLAG_KEY = "alchemyCreatureDC";
// Moderate creature DCs, indexed by level + 1 (-1 through 24).
const MODERATE_DCS = [13, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 45];
const USE_OPTION = "tsPf2eUtilityAlchemyUse";
const DESCRIPTION_MARKER = "<!-- ts-pf2e-utility:alchemy -->";
const DESCRIPTION_CLASS = "ts-alchemy-generated-description";
const creatingDailyItems = new Set();

const uid = () => foundry.utils.randomID();
const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
const actorLevel = (actor) => Math.max(1, Math.min(20, Number(actor?.level ?? actor?.system?.details?.level?.value) || 1));

function normalizeFormula(value) {
  const source = value && typeof value === "object" ? value : {};
  const itemSource = foundry.utils.deepClone(source.source ?? {});
  const uuid = String(source.uuid ?? itemSource?._stats?.compendiumSource ?? itemSource?.flags?.core?.sourceId ?? "");
  return {
    id: String(source.id || uid()), uuid, name: String(source.name || "Алхимический предмет"),
    img: String(source.img || "icons/consumables/potions/potion-jar-corked-labeled-poison-skull-green.webp"),
    quantity: Math.max(1, Math.trunc(Number(source.quantity) || 1)), source: itemSource,
    useCreatureDC: source.useCreatureDC === true,
  };
}

function normalizeRange(value) {
  const source = value && typeof value === "object" ? value : {};
  const start = Math.max(1, Math.min(20, Math.trunc(Number(source.start) || 1)));
  const end = Math.max(start, Math.min(20, Math.trunc(Number(source.end) || 20)));
  return { id: String(source.id || uid()), start, end, items: Array.isArray(source.items) ? source.items.map(normalizeFormula) : [] };
}

export function getAlchemyRanges(item) {
  const values = item?.getFlag?.(MODULE_ID, FLAG_KEY) ?? item?.flags?.[MODULE_ID]?.[FLAG_KEY];
  return Array.isArray(values) ? values.map(normalizeRange) : [];
}

function renderFormula(formula) {
  return `<li class="ts-alchemy-row" data-formula-id="${formula.id}"><img src="${escapeHtml(formula.img)}"><span>${escapeHtml(formula.name)}</span><label title="КС предмета не ниже КС существа"><input class="ts-alchemy-use-creature-dc" type="checkbox" ${formula.useCreatureDC ? "checked" : ""}>КС ≥ существа</label><label>Кол-во <input class="ts-alchemy-quantity" type="number" min="1" max="999" value="${formula.quantity}"></label><button type="button" class="ts-alchemy-remove-formula" title="Удалить"><i class="fas fa-trash"></i></button></li>`;
}

function renderRange(range) {
  return `<section class="ts-alchemy-range" data-range-id="${range.id}">
    <header><strong>Уровень</strong><label>от <input class="ts-alchemy-level" data-field="start" type="number" min="1" max="20" value="${range.start}"></label><label>до <input class="ts-alchemy-level" data-field="end" type="number" min="1" max="20" value="${range.end}"></label><button type="button" class="ts-alchemy-remove-range" title="Удалить диапазон"><i class="fas fa-trash"></i></button></header>
    <ol>${range.items.map(renderFormula).join("") || '<li class="ts-alchemy-empty">Перетащите сюда алхимические расходные предметы</li>'}</ol>
  </section>`;
}

function renderControls({ flags }) {
  const ranges = Array.isArray(flags?.[FLAG_KEY]) ? flags[FLAG_KEY].map(normalizeRange) : [];
  return `<div class="ts-alchemy-editor"><p class="hint">При использовании действия создаются насыщенные расходники из подходящего диапазона уровня. Частота действия автоматически устанавливается на 1 раз в день.</p><label class="ts-alchemy-dc-setting">КС существа <input class="ts-alchemy-creature-dc" type="number" min="1" step="1" value="${normalizeDC(flags?.[DC_FLAG_KEY]) ?? ""}" placeholder="Авто"><span class="hint">если отличается от среднего по уровню</span></label><div class="ts-alchemy-ranges">${ranges.map(renderRange).join("") || '<p class="ts-alchemy-no-ranges">Диапазоны пока не настроены.</p>'}</div><button type="button" class="ts-alchemy-add-range"><i class="fas fa-plus"></i> Добавить диапазон уровней</button></div>`;
}

function normalizeDC(value) {
  const dc = Number(value);
  return Number.isFinite(dc) && dc >= 1 ? Math.trunc(dc) : null;
}

function getCreatureDC(action) {
  const override = normalizeDC(action.getFlag?.(MODULE_ID, DC_FLAG_KEY) ?? action.flags?.[MODULE_ID]?.[DC_FLAG_KEY]);
  const level = Math.max(-1, Math.min(24, Math.trunc(Number(action.actor?.level ?? action.actor?.system?.details?.level?.value) || 0)));
  return override ?? MODERATE_DCS[level + 1];
}

function applyCreatureDC(source, dc) {
  // Change only explicit save DCs; leave other checks and dynamic formulas intact.
  const description = source.system?.description;
  if (typeof description?.value === "string") {
    description.value = description.value.replace(/@Check\[([^\]]+)\]/giu, (match, parameters) => {
      if (!/(?:^|\|)(?:type:)?(?:fortitude|reflex|will)(?:\||$)/iu.test(parameters)) return match;
      return `@Check[${parameters.replace(/(^|\|)dc:(\d+)(?=\||$)/giu, (_match, prefix, value) => `${prefix}dc:${Math.max(Number(value), dc)}`)}]`;
    });
  }
  const save = source.system?.savingThrow;
  if (normalizeDC(save?.dc)) save.dc = Math.max(Number(save.dc), dc);
}

function formatFormulaLink(formula) {
  const name = escapeHtml(formula.name || "Алхимический предмет");
  const uuid = String(formula.uuid ?? formula.source?._stats?.compendiumSource ?? formula.source?.flags?.core?.sourceId ?? "").trim();
  return uuid ? `@UUID[${uuid}]{${name}}` : name;
}

function generatedDescription(ranges) {
  const rows = ranges.map(normalizeRange)
    .filter((range) => range.items.length)
    .map((range) => `<p><strong>${range.start}–${range.end} уровень:</strong> ${range.items.map((formula) => `${formatFormulaLink(formula)} ×${formula.quantity}`).join(", ")}</p>`);
  return rows.length ? `<div class="${DESCRIPTION_CLASS}" data-ts-alchemy-generated="true"><h3>Продвинутая алхимия</h3>${rows.join("")}</div>` : "";
}

function removeGeneratedAlchemy(description) {
  // HTML comments may be stripped on save. Use a persistent wrapper instead,
  // and recognize the old heading + level rows to repair existing duplicates.
  return String(description ?? "")
    .replace(/<div\b[^>]*(?:class=["'][^"']*\bts-alchemy-generated-description\b[^"']*["']|data-ts-alchemy-generated=["']true["'])[^>]*>[\s\S]*?<\/div>/giu, "")
    .split(DESCRIPTION_MARKER).join("")
    .replace(/<h3\b[^>]*>\s*Продвинутая алхимия\s*<\/h3>(?:\s*<p\b[^>]*>\s*<strong\b[^>]*>\s*\d+\s*[–-]\s*\d+\s+уровень:\s*<\/strong>(?:(?!<\/p>)[\s\S])*?×\s*\d+\s*<\/p>)+/giu, "")
    .trim();
}

function descriptionWithGeneratedAlchemy(item, ranges) {
  const current = String(item.system?.description?.value ?? "");
  const manual = removeGeneratedAlchemy(current);
  return [manual, generatedDescription(ranges)].filter(Boolean).join("\n");
}

function readEditor(editor, previous) {
  const ranges = (Array.isArray(previous) ? previous : []).map(normalizeRange);
  for (const section of editor.querySelectorAll(".ts-alchemy-range")) {
    const range = ranges.find((entry) => entry.id === section.dataset.rangeId); if (!range) continue;
    for (const input of section.querySelectorAll(".ts-alchemy-level")) range[input.dataset.field] = Number(input.value);
    for (const row of section.querySelectorAll("[data-formula-id]")) {
      const formula = range.items.find((entry) => entry.id === row.dataset.formulaId);
      if (formula) {
        formula.quantity = Number(row.querySelector(".ts-alchemy-quantity")?.value);
        formula.useCreatureDC = row.querySelector(".ts-alchemy-use-creature-dc")?.checked === true;
      }
    }
  }
  return ranges.map(normalizeRange);
}

async function persist(item, ranges) {
  const normalized = ranges.map(normalizeRange);
  await item.update({
    [`flags.${MODULE_ID}.${FLAG_KEY}`]: normalized,
    "system.description.value": descriptionWithGeneratedAlchemy(item, normalized),
  }, { render: false });
}

function activateListeners({ app, html, item, optionIndex }) {
  const root = htmlElement(html);
  const editor = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .ts-alchemy-editor`);
  if (!editor) return;
  const currentRanges = getAlchemyRanges(item);
  const expectedDescription = descriptionWithGeneratedAlchemy(item, currentRanges);
  if (String(item.system?.description?.value ?? "") !== expectedDescription) {
    void item.update({ "system.description.value": expectedDescription }, { render: false });
  }
  const save = async () => {
    await item.update({ [`flags.${MODULE_ID}.${DC_FLAG_KEY}`]: normalizeDC(editor.querySelector(".ts-alchemy-creature-dc")?.value) }, { render: false });
    await persist(item, readEditor(editor, getAlchemyRanges(item)));
    app.render(false);
  };
  editor.addEventListener("change", (event) => { if (event.target.closest("input")) void save(); });
  editor.addEventListener("dragover", (event) => event.preventDefault());
  editor.addEventListener("drop", async (event) => {
    event.preventDefault();
    const section = event.target.closest(".ts-alchemy-range"); if (!section) return;
    let data; try { data = TextEditor.getDragEventData(event); } catch { return; }
    const dropped = data?.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    const traits = dropped?.system?.traits?.value ?? [];
    if (!traits.includes("alchemical")) return ui.notifications.warn("Можно добавить только предмет с признаком «алхимический».");
    const ranges = readEditor(editor, getAlchemyRanges(item)); const range = ranges.find((entry) => entry.id === section.dataset.rangeId); if (!range) return;
    const source = dropped.toObject(); delete source._id; delete source.folder; delete source.sort; delete source.ownership;
    range.items.push(normalizeFormula({ uuid: dropped.uuid, name: dropped.name, img: dropped.img, quantity: 1, source }));
    await persist(item, ranges); app.render(false);
  });
  editor.addEventListener("click", async (event) => {
    const add = event.target.closest(".ts-alchemy-add-range");
    if (add) { const ranges = readEditor(editor, getAlchemyRanges(item)); const last = ranges.at(-1); const start = last ? Math.min(20, last.end + 1) : 1; ranges.push(normalizeRange({ start, end: 20 })); await persist(item, ranges); return app.render(false); }
    const removeRange = event.target.closest(".ts-alchemy-remove-range");
    if (removeRange) { const id = removeRange.closest(".ts-alchemy-range")?.dataset.rangeId; await persist(item, readEditor(editor, getAlchemyRanges(item)).filter((range) => range.id !== id)); return app.render(false); }
    const removeFormula = event.target.closest(".ts-alchemy-remove-formula");
    if (removeFormula) { const section = removeFormula.closest(".ts-alchemy-range"); const id = removeFormula.closest("[data-formula-id]")?.dataset.formulaId; const ranges = readEditor(editor, getAlchemyRanges(item)); const range = ranges.find((entry) => entry.id === section?.dataset.rangeId); if (range) range.items = range.items.filter((entry) => entry.id !== id); await persist(item, ranges); app.render(false); }
  });
}

async function cleanup({ item }) {
  const current = String(item.system?.description?.value ?? "");
  const manual = removeGeneratedAlchemy(current);
  await item.update({ "system.description.value": manual }, { render: false });
  await item.unsetFlag(MODULE_ID, FLAG_KEY);
  await item.unsetFlag(MODULE_ID, DC_FLAG_KEY);
}

function dailyFrequencyUpdate(item, changed) {
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;
  const pendingMax = foundry.utils.getProperty(changed, "system.frequency.max");
  const pendingPer = foundry.utils.getProperty(changed, "system.frequency.per");
  const currentMax = pendingMax ?? item.system?.frequency?.max;
  const currentPer = pendingPer ?? item.system?.frequency?.per;
  if (Number(currentMax) !== 1) foundry.utils.setProperty(changed, "system.frequency.max", 1);
  if (currentPer !== "day") foundry.utils.setProperty(changed, "system.frequency.per", "day");
  if (!item.system?.frequency && foundry.utils.getProperty(changed, "system.frequency.value") === undefined) foundry.utils.setProperty(changed, "system.frequency.value", 1);
}

async function createDailyItems(action) {
  const actor = action.actor; if (!actor) return;
  const key = action.uuid ?? `${actor.uuid}.${action.id}`;
  if (creatingDailyItems.has(key)) return;
  creatingDailyItems.add(key);
  try {
  const level = actorLevel(actor);
  const range = getAlchemyRanges(action).find((entry) => level >= entry.start && level <= entry.end);
  if (!range?.items.length) return ui.notifications.warn(`Для ${level}-го уровня в «${action.name}» не настроены алхимические предметы.`);
  const sources = range.items.map((formula) => {
    const source = foundry.utils.deepClone(formula.source); delete source._id; delete source.folder; delete source.sort; delete source.ownership;
    source.system ??= {}; source.system.quantity = formula.quantity; source.system.traits ??= {}; source.system.traits.value = Array.from(new Set([...(source.system.traits.value ?? []), "infused"]));
    if (formula.useCreatureDC) applyCreatureDC(source, getCreatureDC(action));
    return source;
  });
  await actor.createEmbeddedDocuments("Item", sources);
  ui.notifications.info(`Созданы насыщенные алхимические предметы: ${range.items.map((entry) => `${entry.name} ×${entry.quantity}`).join(", ")}.`);
  } finally {
    creatingDailyItems.delete(key);
  }
}

registerActionPlusFeature({ id: FEATURE_ID, label: `${I18N_PREFIX}.ActionPlus.Alchemy.FeatureLabel`, render: renderControls, activateListeners, cleanup });

Hooks.on("preCreateItem", (item, source) => { if (item.type === "action" && getPendingActionPlusOptions(item, source).includes(FEATURE_ID)) dailyFrequencyUpdate(item, source); });
Hooks.on("preUpdateItem", (item, changed, options) => {
  if (item.type !== "action") return;
  const oldValue = Number(item.system?.frequency?.value);
  const requestedValue = foundry.utils.getProperty(changed, "system.frequency.value");
  if (isActionPlusFeatureEnabled(item, FEATURE_ID, changed) && requestedValue !== undefined && Number(requestedValue) < oldValue) options[USE_OPTION] = true;
  dailyFrequencyUpdate(item, changed);
});
Hooks.on("updateItem", (item, _changed, options) => { if (item.type === "action" && options?.[USE_OPTION] && isActionPlusFeatureEnabled(item, FEATURE_ID)) void createDailyItems(item); });
