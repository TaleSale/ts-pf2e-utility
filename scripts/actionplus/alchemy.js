import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { getPendingActionPlusOptions, isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "alchemy";
const FLAG_KEY = "alchemyRanges";
const USE_OPTION = "tsPf2eUtilityAlchemyUse";

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
  return `<li class="ts-alchemy-row" data-formula-id="${formula.id}"><img src="${escapeHtml(formula.img)}"><span>${escapeHtml(formula.name)}</span><label>Кол-во <input class="ts-alchemy-quantity" type="number" min="1" max="999" value="${formula.quantity}"></label><button type="button" class="ts-alchemy-remove-formula" title="Удалить"><i class="fas fa-trash"></i></button></li>`;
}

function renderRange(range) {
  return `<section class="ts-alchemy-range" data-range-id="${range.id}">
    <header><strong>Уровень</strong><label>от <input class="ts-alchemy-level" data-field="start" type="number" min="1" max="20" value="${range.start}"></label><label>до <input class="ts-alchemy-level" data-field="end" type="number" min="1" max="20" value="${range.end}"></label><button type="button" class="ts-alchemy-remove-range" title="Удалить диапазон"><i class="fas fa-trash"></i></button></header>
    <ol>${range.items.map(renderFormula).join("") || '<li class="ts-alchemy-empty">Перетащите сюда алхимические расходные предметы</li>'}</ol>
  </section>`;
}

function renderControls({ flags }) {
  const ranges = Array.isArray(flags?.[FLAG_KEY]) ? flags[FLAG_KEY].map(normalizeRange) : [];
  return `<div class="ts-alchemy-editor"><p class="hint">При использовании действия создаются насыщенные расходники из подходящего диапазона уровня. Частота действия автоматически устанавливается на 1 раз в день.</p><div class="ts-alchemy-ranges">${ranges.map(renderRange).join("") || '<p class="ts-alchemy-no-ranges">Диапазоны пока не настроены.</p>'}</div><button type="button" class="ts-alchemy-add-range"><i class="fas fa-plus"></i> Добавить диапазон уровней</button></div>`;
}

function readEditor(editor, previous) {
  const ranges = (Array.isArray(previous) ? previous : []).map(normalizeRange);
  for (const section of editor.querySelectorAll(".ts-alchemy-range")) {
    const range = ranges.find((entry) => entry.id === section.dataset.rangeId); if (!range) continue;
    for (const input of section.querySelectorAll(".ts-alchemy-level")) range[input.dataset.field] = Number(input.value);
    for (const row of section.querySelectorAll("[data-formula-id]")) {
      const formula = range.items.find((entry) => entry.id === row.dataset.formulaId);
      if (formula) formula.quantity = Number(row.querySelector(".ts-alchemy-quantity")?.value);
    }
  }
  return ranges.map(normalizeRange);
}

async function persist(item, ranges) {
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: ranges.map(normalizeRange) }, { render: false });
}

function activateListeners({ app, html, item, optionIndex }) {
  const root = htmlElement(html);
  const editor = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .ts-alchemy-editor`);
  if (!editor) return;
  const save = () => persist(item, readEditor(editor, getAlchemyRanges(item)));
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

async function cleanup({ item }) { await item.unsetFlag(MODULE_ID, FLAG_KEY); }

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
  const level = actorLevel(actor);
  const range = getAlchemyRanges(action).find((entry) => level >= entry.start && level <= entry.end);
  if (!range?.items.length) return ui.notifications.warn(`Для ${level}-го уровня в «${action.name}» не настроены алхимические предметы.`);
  const sources = range.items.map((formula) => {
    const source = foundry.utils.deepClone(formula.source); delete source._id; delete source.folder; delete source.sort; delete source.ownership;
    source.system ??= {}; source.system.quantity = formula.quantity; source.system.traits ??= {}; source.system.traits.value = Array.from(new Set([...(source.system.traits.value ?? []), "infused"]));
    return source;
  });
  await actor.createEmbeddedDocuments("Item", sources);
  ui.notifications.info(`Созданы насыщенные алхимические предметы: ${range.items.map((entry) => `${entry.name} ×${entry.quantity}`).join(", ")}.`);
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
