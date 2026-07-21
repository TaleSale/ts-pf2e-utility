import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { getItemActionPlusOptions, isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";
import { applySpellModLabels } from "../utility/spell-at-will.js";

const FEATURE_ID = "spellSet";
const FLAG_KEY = "spellSets";
const GENERATED_FLAG = "spellSetGenerated";
const TYPE_LABELS = { prepared: "Подготавливаемые", spontaneous: "Спонтанные", innate: "Врождённые", focus: "Фокусировка" };
const TRADITIONS = { arcane: "Арканный", divine: "Сакральный", occult: "Оккультный", primal: "Природный" };
const ABILITIES = { int: "Интеллект", wis: "Мудрость", cha: "Харизма" };
const syncingActors = new Set();

const uid = () => foundry.utils.randomID();
const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
const actorLevel = (actor) => Math.max(1, Math.min(20, Number(actor?.level ?? actor?.system?.details?.level?.value) || 1));

function normalizeSpell(value) {
  const source = value && typeof value === "object" ? value : {};
  const itemSource = foundry.utils.deepClone(source.source ?? {});
  const uuid = String(source.uuid ?? itemSource?._stats?.compendiumSource ?? itemSource?.flags?.core?.sourceId ?? "");
  const spellMods = itemSource?.flags?.[MODULE_ID]?.spellMods ?? {};
  return { id: String(source.id || uid()), uuid, name: String(source.name || "Заклинание"), img: String(source.img || "icons/svg/book.svg"), rank: Math.max(0, Math.min(10, Number(source.rank) || 0)), start: Math.max(1, Math.min(20, Number(source.start) || 1)), end: Math.max(1, Math.min(20, Number(source.end) || 20)), uses: Math.max(1, Number(source.uses) || 1), signature: Boolean(source.signature), evenOnly: Boolean(source.evenOnly), atWill: Boolean(source.atWill ?? spellMods.atWill), constant: Boolean(source.constant ?? spellMods.constant), self: Boolean(source.self ?? spellMods.self), source: itemSource };
}

function normalizeSet(value) {
  const source = value && typeof value === "object" ? value : {};
  const startLevel = source.startLevel === "" || source.startLevel == null ? "" : Math.max(1, Math.min(20, Number(source.startLevel) || 1));
  const endLevel = source.endLevel === "" || source.endLevel == null ? "" : Math.max(1, Math.min(20, Number(source.endLevel) || 20));
  return { name: String(source.name || "Набор заклинаний"), type: Object.hasOwn(TYPE_LABELS, source.type) ? source.type : "prepared", tradition: Object.hasOwn(TRADITIONS, source.tradition) ? source.tradition : "arcane", ability: Object.hasOwn(ABILITIES, source.ability) ? source.ability : "cha", slotLimit: [2, 3, 4].includes(Number(source.slotLimit)) ? Number(source.slotLimit) : 4, rank10Slots: [1, 2].includes(Number(source.rank10Slots)) ? Number(source.rank10Slots) : 1, startLevel, endLevel, spells: Array.isArray(source.spells) ? source.spells.map(normalizeSpell) : [] };
}

function getConfigs(item) {
  const values = item.getFlag(MODULE_ID, FLAG_KEY);
  return Array.isArray(values) ? values.map(normalizeSet) : [];
}

function options(values, selected) {
  return Object.entries(values).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function isCantripSpell(item) {
  return Boolean(item?.isCantrip || item?.system?.traits?.value?.includes("cantrip"));
}

function rankCapacity(config, rank) {
  return rank === 0 ? 5 : rank === 10 ? config.rank10Slots : config.slotLimit;
}

function ranksFitCapacity(config, slotLimit = config.slotLimit, rank10Slots = config.rank10Slots) {
  return Array.from({ length: 10 }, (_, index) => index + 1).every((rank) => (
    config.spells.filter((spell) => spell.rank === rank).length <= (rank === 10 ? rank10Slots : slotLimit)
  ));
}

function renderSpell(spell, type) {
  let extra = "";
  if (type === "prepared" && spell.rank > 0) extra = `<label title="Только на чётном уровне"><input class="ts-spell-set-field" data-field="evenOnly" type="checkbox" ${spell.evenOnly ? "checked" : ""}>Ч</label>`;
  if (type === "spontaneous" && spell.rank > 0) extra = `<label title="Коронное заклинание"><input class="ts-spell-set-field" data-field="signature" type="checkbox" ${spell.signature ? "checked" : ""}>★</label><label title="Только на чётном уровне"><input class="ts-spell-set-field" data-field="evenOnly" type="checkbox" ${spell.evenOnly ? "checked" : ""}>Ч</label>`;
  if (type === "focus") extra = `<label>С уровня <input class="ts-spell-set-field" data-field="start" type="number" min="1" max="20" value="${spell.start}"></label>`;
  if (type === "innate") extra = `<div class="ts-spell-set-innate-fields"><label>Ранг <input class="ts-spell-set-field" data-field="rank" type="number" min="0" max="10" value="${spell.rank}"></label><label>С <input class="ts-spell-set-field" data-field="start" type="number" min="1" max="20" value="${spell.start}"></label><label>До <input class="ts-spell-set-field" data-field="end" type="number" min="1" max="20" value="${spell.end}"></label><label>Раз <input class="ts-spell-set-field" data-field="uses" type="number" min="1" max="99" value="${spell.uses}" ${spell.atWill || spell.constant ? "disabled" : ""}></label><label title="По желанию"><input class="ts-spell-set-field" data-field="atWill" type="checkbox" ${spell.atWill ? "checked" : ""}>По желанию</label><label title="Постоянно"><input class="ts-spell-set-field" data-field="constant" type="checkbox" ${spell.constant ? "checked" : ""}>Постоянно</label><label title="На себя"><input class="ts-spell-set-field" data-field="self" type="checkbox" ${spell.self ? "checked" : ""}>На себя</label></div>`;
  const rowClass = type === "innate" ? " ts-spell-set-row--innate" : "";
  return `<li class="ts-spell-set-row${rowClass}" data-spell-id="${spell.id}"><img src="${escapeHtml(spell.img)}"><span>${escapeHtml(spell.name)}</span>${extra}<button type="button" class="ts-spell-set-remove" title="Удалить"><i class="fas fa-trash"></i></button></li>`;
}

function renderControls({ flags, occurrenceIndex = 0 }) {
  const config = normalizeSet(Array.isArray(flags?.[FLAG_KEY]) ? flags[FLAG_KEY][occurrenceIndex] : null);
  const setLevelRange = ["prepared", "spontaneous"].includes(config.type) ? `<div class="ts-spell-set-level-range"><span>Уровень набора</span><label>с <input class="ts-spell-set-config" data-field="startLevel" type="number" min="1" max="20" value="${config.startLevel}" placeholder="1"></label><label>по <input class="ts-spell-set-config" data-field="endLevel" type="number" min="1" max="20" value="${config.endLevel}" placeholder="20"></label></div>` : "";
  const editorMaxRank = config.endLevel === "" ? 10 : Math.min(10, Math.ceil(Number(config.endLevel) / 2));
  const spellList = ["prepared", "spontaneous"].includes(config.type)
    ? Array.from({ length: editorMaxRank + 1 }, (_, rank) => `<li class="ts-spell-set-rank" data-drop-rank="${rank}"><h4>${rank === 0 ? "Чары" : `${rank}-й ранг`}</h4><ol>${config.spells.filter((spell) => spell.rank === rank).map((spell) => renderSpell(spell, config.type)).join("") || `<li class="ts-spell-set-empty">Перетащите заклинание сюда</li>`}</ol></li>`).join("")
    : config.spells.map((spell) => renderSpell(spell, config.type)).join("") || `<li class="ts-spell-set-empty">Здесь пока нет заклинаний</li>`;
  return `<div class="ts-spell-set-editor" data-occurrence="${occurrenceIndex}">
    <div class="form-group"><label>Название набора</label><div class="form-fields"><input class="ts-spell-set-config" data-field="name" value="${escapeHtml(config.name)}"></div></div>
    <div class="ts-spell-set-config-grid">
      <label>Заклинания <select class="ts-spell-set-config" data-field="type">${options(TYPE_LABELS, config.type)}</select></label>
      <label>Маг. обычай <select class="ts-spell-set-config" data-field="tradition">${options(TRADITIONS, config.tradition)}</select></label>
      <label>Ключевой атрибут <select class="ts-spell-set-config" data-field="ability">${options(ABILITIES, config.ability)}</select></label>
      ${["prepared", "spontaneous"].includes(config.type) ? `<label>Ячеек на ранг <select class="ts-spell-set-config" data-field="slotLimit">${[4, 3, 2].map((n) => `<option value="${n}" ${config.slotLimit === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Ячеек 10-го ранга <select class="ts-spell-set-config" data-field="rank10Slots">${[1, 2].map((n) => `<option value="${n}" ${config.rank10Slots === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}
    </div>
    ${setLevelRange}
    <p class="hint">Перетащите заклинания из компендиума или листа персонажа. Одинаковое заклинание можно добавить несколько раз.</p>
    <ol class="ts-spell-set-list">${spellList}</ol>
  </div>`;
}

function readPanel(panel, previous) {
  const config = normalizeSet(previous);
  for (const control of panel.querySelectorAll(".ts-spell-set-config")) config[control.dataset.field] = ["slotLimit", "rank10Slots"].includes(control.dataset.field) ? Number(control.value) : control.value;
  for (const row of panel.querySelectorAll("[data-spell-id]")) {
    const spell = config.spells.find((entry) => entry.id === row.dataset.spellId); if (!spell) continue;
    for (const control of row.querySelectorAll(".ts-spell-set-field")) spell[control.dataset.field] = control.type === "checkbox" ? control.checked : Number(control.value);
  }
  return normalizeSet(config);
}

async function persist(item, occurrenceIndex, config) {
  const configs = getConfigs(item); configs[occurrenceIndex] = normalizeSet(config);
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: configs }, { render: false });
}

function activateListeners({ app, html, item, optionIndex, occurrenceIndex = 0 }) {
  const root = htmlElement(html); const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .ts-spell-set-editor`); if (!panel) return;
  const save = () => persist(item, occurrenceIndex, readPanel(panel, getConfigs(item)[occurrenceIndex]));
  panel.addEventListener("change", async (event) => {
    const control = event.target.closest("input, select"); if (!control || !panel.contains(control)) return;
    if (["slotLimit", "rank10Slots"].includes(control.dataset.field)) {
      const previous = getConfigs(item)[occurrenceIndex] ?? normalizeSet(null);
      const nextSlotLimit = control.dataset.field === "slotLimit" ? Number(control.value) : previous.slotLimit;
      const nextRank10Slots = control.dataset.field === "rank10Slots" ? Number(control.value) : previous.rank10Slots;
      if (!ranksFitCapacity(previous, nextSlotLimit, nextRank10Slots)) {
        control.value = String(previous[control.dataset.field]);
        ui.notifications.warn("Нельзя уменьшить число ячеек: в соответствующем ранге уже больше заклинаний.");
        return;
      }
    }
    await save();
    if (["type", "endLevel", "atWill", "constant"].includes(control.dataset.field)) app.render(false);
  });
  panel.addEventListener("dragover", (event) => event.preventDefault());
  panel.addEventListener("drop", async (event) => {
    event.preventDefault(); let data; try { data = TextEditor.getDragEventData(event); } catch { return; }
    const dropRank = event.target.closest("[data-drop-rank]")?.dataset.dropRank;
    const spellItem = data?.uuid ? await fromUuid(data.uuid) : null; if (spellItem?.type !== "spell") return ui.notifications.warn("В набор можно добавить только заклинание.");
    const config = readPanel(panel, getConfigs(item)[occurrenceIndex]);
    if (["prepared", "spontaneous"].includes(config.type)) {
      if (dropRank == null) return ui.notifications.warn("Перетащите заклинание в конкретный раздел чар или ранга.");
      const rank = Number(dropRank); const cantrip = isCantripSpell(spellItem); const baseRank = Number(spellItem.baseRank ?? spellItem.system?.level?.value) || 0;
      if (rank === 0 && !cantrip) return ui.notifications.warn("В раздел чар можно добавлять только чары.");
      if (rank > 0 && cantrip) return ui.notifications.warn("Чары можно добавлять только в раздел чар.");
      if (rank > 0 && baseRank > rank) return ui.notifications.warn(`Это заклинание нельзя добавить в ${rank}-й ранг: его базовый ранг ${baseRank}.`);
      if (config.spells.filter((spell) => spell.rank === rank).length >= rankCapacity(config, rank)) return ui.notifications.warn(`В этом разделе уже достигнут предел: ${rankCapacity(config, rank)}.`);
    }
    const source = spellItem.toObject(); delete source._id; delete source.folder; delete source.sort; delete source.ownership;
    const addedSpell = normalizeSpell({ uuid: spellItem.uuid, name: spellItem.name, img: spellItem.img, rank: dropRank ?? spellItem.baseRank ?? spellItem.system?.level?.value, source });
    config.spells.push(addedSpell); await persist(item, occurrenceIndex, config);
    const targetList = dropRank == null ? panel.querySelector(".ts-spell-set-list") : panel.querySelector(`[data-drop-rank="${dropRank}"] > ol`);
    targetList?.querySelector(".ts-spell-set-empty")?.remove();
    targetList?.insertAdjacentHTML("beforeend", renderSpell(addedSpell, config.type));
  });
  panel.addEventListener("click", async (event) => {
    const button = event.target.closest(".ts-spell-set-remove"); if (!button || !panel.contains(button)) return;
    const row = button.closest("[data-spell-id]"); const config = readPanel(panel, getConfigs(item)[occurrenceIndex]); config.spells = config.spells.filter((spell) => spell.id !== row.dataset.spellId); await persist(item, occurrenceIndex, config);
    const list = row.parentElement; row.remove();
    if (list && !list.querySelector("[data-spell-id]")) list.insertAdjacentHTML("beforeend", `<li class="ts-spell-set-empty">${list.closest("[data-drop-rank]") ? "Перетащите заклинание сюда" : "Здесь пока нет заклинаний"}</li>`);
  });
}

async function cleanup({ item, occurrenceIndex = 0 }) {
  const configs = getConfigs(item); configs.splice(occurrenceIndex, 1); configs.length ? await item.setFlag(MODULE_ID, FLAG_KEY, configs) : await item.unsetFlag(MODULE_ID, FLAG_KEY); await syncActor(item.actor);
}

function activeSpells(config, level) {
  const maxRank = Math.min(10, Math.ceil(level / 2));
  return config.spells.filter((spell) => ["prepared", "spontaneous"].includes(config.type) ? spell.rank <= maxRank && (spell.rank === 0 || !spell.evenOnly || level % 2 === 0) : level >= spell.start && (config.type !== "innate" || level <= spell.end));
}

function isSetActive(config, level) {
  if (!["prepared", "spontaneous"].includes(config.type)) return true;
  if (config.startLevel !== "" && level < Number(config.startLevel)) return false;
  if (config.endLevel !== "" && level > Number(config.endLevel)) return false;
  return true;
}

function entrySource(config, level, marker) {
  const slots = {}; const maxRank = Math.min(10, Math.ceil(level / 2));
  for (let rank = 0; rank <= 10; rank++) { const usesSlots = ["prepared", "spontaneous"].includes(config.type); const rankLimit = rank === 10 ? config.rank10Slots : config.slotLimit; const oddPenalty = rank === maxRank && level % 2 ? 1 : 0; const minimum = rank === 10 && maxRank === 10 ? 1 : 0; const max = rank === 0 && usesSlots ? 5 : rank > 0 && rank <= maxRank && usesSlots ? Math.max(minimum, rankLimit - oddPenalty) : 0; slots[`slot${rank}`] = { prepared: [], value: max, max }; }
  return { name: config.name, type: "spellcastingEntry", system: { ability: { value: config.ability }, tradition: { value: config.tradition }, prepared: { value: config.type }, proficiency: { value: 1 }, showSlotlessLevels: { value: true }, slots }, flags: { [MODULE_ID]: { [GENERATED_FLAG]: { ...marker, kind: "entry" } } } };
}

async function createSetDocuments(actor, action, config, occurrenceIndex) {
  const level = actorLevel(actor); const marker = { actionId: action.id, occurrenceIndex }; const source = entrySource(config, level, marker);
  const correctionSpellcasting = actor.getFlag(MODULE_ID, "creatureCorrectionApplication")?.spellcasting;
  if (correctionSpellcasting?.dc != null) {
    const dc = Number(correctionSpellcasting.dc);
    source.system.spelldc = { dc, value: dc - 8 };
  }
  const [entry] = await actor.createEmbeddedDocuments("Item", [source]); const selected = activeSpells(config, level);
  const maxRank = Math.min(10, Math.ceil(level / 2));
  const sources = selected.map((spell) => { const source = foundry.utils.deepClone(spell.source); const spellMods = { atWill: spell.atWill, constant: spell.constant, self: spell.self }; source.flags = foundry.utils.mergeObject(source.flags ?? {}, { [MODULE_ID]: { [GENERATED_FLAG]: { ...marker, spellId: spell.id, kind: "spell" }, spellMods } }); source.system ??= {}; const heightenedLevel = config.type === "focus" || spell.rank === 0 ? maxRank : spell.rank; source.system.location = { value: entry.id, heightenedLevel, signature: config.type === "spontaneous" && spell.rank > 0 && spell.signature }; if (config.type === "innate") { const uses = spell.atWill || spell.constant ? 99 : spell.uses; source.system.location.uses = { value: uses, max: uses }; source.name = applySpellModLabels(source.name, spellMods); } return source; });
  const created = sources.length ? await actor.createEmbeddedDocuments("Item", sources) : [];
  if (config.type === "prepared" && created.length) {
    const slots = foundry.utils.deepClone(entry.system.slots);
    for (const [index, spell] of selected.entries()) {
      const group = slots[`slot${spell.rank}`];
      if (!group) continue;
      const freeIndex = group.prepared.findIndex((slot) => !slot?.id);
      if (freeIndex === -1) continue;
      group.prepared[freeIndex] = { id: created[index].id, expended: false };
    }
    await entry.update({ "system.slots": slots });
  }
}

async function syncActor(actor) {
  if (!actor || syncingActors.has(actor.id)) return; syncingActors.add(actor.id);
  try {
    const generated = actor.items.filter((item) => item.getFlag(MODULE_ID, GENERATED_FLAG)); if (generated.length) await actor.deleteEmbeddedDocuments("Item", generated.map((item) => item.id));
    const level = actorLevel(actor);
    for (const action of actor.itemTypes?.action ?? []) { if (!isActionPlusFeatureEnabled(action, FEATURE_ID)) continue; const count = getItemActionPlusOptions(action).filter((id) => id === FEATURE_ID).length; const configs = getConfigs(action); for (let index = 0; index < count; index++) { const config = normalizeSet(configs[index]); if (isSetActive(config, level)) await createSetDocuments(actor, action, config, index); } }
  } finally { syncingActors.delete(actor.id); }
}

async function repairPreparedSlots(actor) {
  for (const entry of actor.itemTypes?.spellcastingEntry ?? []) {
    const marker = entry.getFlag(MODULE_ID, GENERATED_FLAG);
    if (marker?.kind !== "entry" || entry.system.prepared.value !== "prepared") continue;
    const action = actor.items.get(marker.actionId); if (!action) continue; const config = getConfigs(action)[marker.occurrenceIndex]; if (!config) continue;
    const slots = foundry.utils.deepClone(entry.system.slots); let changed = false;
    const spells = actor.itemTypes?.spell?.filter((spell) => { const spellMarker = spell.getFlag(MODULE_ID, GENERATED_FLAG); return spellMarker?.actionId === marker.actionId && spellMarker?.occurrenceIndex === marker.occurrenceIndex; }) ?? [];
    for (const spell of spells) {
      if (Object.values(slots).some((group) => group.prepared.some((slot) => slot?.id === spell.id))) continue;
      const spellMarker = spell.getFlag(MODULE_ID, GENERATED_FLAG); const configured = config.spells.find((value) => value.id === spellMarker.spellId); const group = slots[`slot${configured?.rank ?? -1}`]; const freeIndex = group?.prepared.findIndex((slot) => !slot?.id) ?? -1;
      if (freeIndex < 0) continue; group.prepared[freeIndex] = { id: spell.id, expended: false }; changed = true;
    }
    if (changed) await entry.update({ "system.slots": slots });
  }
}

registerActionPlusFeature({ id: FEATURE_ID, label: `${I18N_PREFIX}.ActionPlus.SpellSet.FeatureLabel`, allowMultiple: true, render: renderControls, activateListeners, cleanup });
Hooks.on("createItem", (item) => { if (item.type === "action") void syncActor(item.actor); });
Hooks.on("updateItem", (item, changed) => { if (item.type === "action" && (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`) || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOptions`) || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOption`))) void syncActor(item.actor); });
Hooks.on("deleteItem", (item) => { if (item.type === "action") void syncActor(item.actor); });
Hooks.on("updateActor", (actor, changed) => { if (foundry.utils.hasProperty(changed, "system.details.level.value")) void syncActor(actor); });
Hooks.once("ready", () => { if (game.users.activeGM?.id !== game.user.id) return; for (const actor of game.actors) void repairPreparedSlots(actor); });

export { activeSpells, entrySource, isSetActive };
