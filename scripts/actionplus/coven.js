import { areCreatureCorrectionsLocked, escapeHtml, I18N_PREFIX, isCreatureCorrectionManagedItem, MODULE_ID } from "../core.js";
import { getItemActionPlusOptions, isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "coven";
const FLAG_KEY = "coven";
const GENERATED_FLAG = "covenGenerated";
const SUPPORT_FLAG = "covenSupportTemplate";
const ICON = "systems/pf2e/icons/spells/cackle.webp";
const BASE_SPELL_SLUGS = [
  "cursed-metamorphosis", "augury", "charm", "clairaudience", "clairvoyance",
  "dream-message", "illusory-disguise", "illusory-scene", "scouting-eye", "talking-corpse",
];
const HIGH_DCS = { "-1": 15, 0: 16, 1: 17, 2: 18, 3: 20, 4: 21, 5: 22, 6: 24, 7: 25, 8: 26, 9: 28, 10: 29, 11: 30, 12: 32, 13: 33, 14: 34, 15: 36, 16: 37, 17: 38, 18: 40, 19: 41, 20: 42, 21: 44, 22: 45, 23: 46, 24: 48 };
const syncingActors = new Set();
let supportEffectPromise = null;
const uid = () => foundry.utils.randomID();
const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;

function normalizeSpell(value) {
  const source = value && typeof value === "object" ? value : {};
  const itemSource = foundry.utils.deepClone(source.source ?? {});
  return {
    id: String(source.id || uid()),
    uuid: String(source.uuid ?? itemSource?._stats?.compendiumSource ?? itemSource?.flags?.core?.sourceId ?? ""),
    name: String(source.name || "Заклинание"), img: String(source.img || "icons/svg/book.svg"), source: itemSource,
  };
}

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const legacySpells = Array.isArray(source.contributors) ? source.contributors.flatMap((entry) => Array.isArray(entry?.spells) ? entry.spells : []) : [];
  return {
    name: String(source.name || "Заклинания ковена"), tradition: ["arcane", "divine", "occult", "primal"].includes(source.tradition) ? source.tradition : "occult",
    ability: ["int", "wis", "cha"].includes(source.ability) ? source.ability : "cha",
    spells: (Array.isArray(source.spells) ? source.spells : legacySpells).map(normalizeSpell),
  };
}

const getConfig = (item) => normalizeConfig(item.getFlag(MODULE_ID, FLAG_KEY));
const options = (values, selected) => Object.entries(values).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");

function renderSpell(spell) {
  return `<li class="ts-coven-spell" data-spell-id="${spell.id}"><img src="${escapeHtml(spell.img)}"><span>${escapeHtml(spell.name)}</span><button type="button" data-action="remove-spell" title="Удалить"><i class="fas fa-trash"></i></button></li>`;
}

function renderControls({ flags }) {
  const config = normalizeConfig(flags?.[FLAG_KEY]);
  return `<div class="ts-coven-editor">
    <div class="form-group"><label>Название набора</label><div class="form-fields"><input data-field="name" value="${escapeHtml(config.name)}"></div></div>
    <div class="ts-spell-set-config-grid">
      <label>Маг. обычай <select data-field="tradition">${options({ arcane: "Арканный", divine: "Сакральный", occult: "Оккультный", primal: "Природный" }, config.tradition)}</select></label>
      <label>Ключевой атрибут <select data-field="ability">${options({ int: "Интеллект", wis: "Мудрость", cha: "Харизма" }, config.ability)}</select></label>
    </div>
    <p class="hint">Базовые заклинания ковена добавляются автоматически и не удаляются. Заклинания создаются врождёнными: их минимальный ранг — 5-й, а использования доступны, пока на сцене ковен поддерживают хотя бы две участницы.</p>
    <div class="ts-coven-base"><b>Базовые:</b> Проклятая метаморфоза, Предзнаменование, Очаровать, Яснослышание, Ясновидение, Послание во сне, Иллюзорная маскировка, Иллюзорная сцена, Зоркий глаз, Говорящий труп.</div>
    <div class="ts-coven-title"><b>Дополнительные заклинания</b></div>
    <p class="hint">Перетащите сюда заклинания, которые участницы добавляют в ковен.</p>
    <ol class="ts-coven-spells ts-coven-spell-drop">${config.spells.map(renderSpell).join("") || '<li class="ts-coven-empty">Нет добавленных заклинаний</li>'}</ol>
  </div>`;
}

async function persist(item, config) { await item.setFlag(MODULE_ID, FLAG_KEY, normalizeConfig(config)); }

function activateListeners({ app, html, item, optionIndex }) {
  const root = htmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .ts-coven-editor`);
  if (!panel) return;
  panel.addEventListener("change", async (event) => {
    const config = getConfig(item); const target = event.target;
    if (target.dataset.field === "name" || target.dataset.field === "tradition" || target.dataset.field === "ability") config[target.dataset.field] = target.value;
    await persist(item, config);
  });
  panel.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const config = getConfig(item);
    if (button.dataset.action === "remove-spell") config.spells = config.spells.filter((spell) => spell.id !== button.closest("[data-spell-id]")?.dataset.spellId);
    await persist(item, config); app.render(false);
  });
  panel.addEventListener("dragover", (event) => event.preventDefault());
  panel.addEventListener("drop", async (event) => {
    if (!event.target.closest(".ts-coven-spell-drop")) return;
    event.preventDefault(); let data; try { data = TextEditor.getDragEventData(event); } catch { return; }
    const spell = data?.uuid ? await fromUuid(data.uuid) : null; if (spell?.type !== "spell") return ui.notifications.warn("Можно добавлять только заклинания.");
    const config = getConfig(item);
    const source = spell.toObject(); delete source._id; delete source.folder; delete source.sort; delete source.ownership;
    config.spells.push(normalizeSpell({ uuid: spell.uuid, name: spell.name, img: spell.img, source })); await persist(item, config); app.render(false);
  });
}

async function baseSpellSources() {
  const pack = game.packs.get("pf2e.spells-srd"); if (!pack) return [];
  const index = await pack.getIndex({ fields: ["system.slug"] });
  const documents = await Promise.all(BASE_SPELL_SLUGS.map((slug) => { const entry = index.find((item) => item.system?.slug === slug); return entry ? pack.getDocument(entry._id) : null; }));
  return documents.filter(Boolean).map((spell) => { const source = spell.toObject(); delete source._id; delete source.folder; delete source.sort; delete source.ownership; return { source, uuid: spell.uuid }; });
}

function marker(actionId, kind) { return { actionId, kind }; }
function effectSource() { return { name: "Поддержка ковена", type: "effect", img: ICON, system: { description: { value: "Вы поддерживаете общую магию ковена." }, duration: { value: 1, unit: "rounds", expiry: "turn-end", sustained: false }, tokenIcon: { show: true }, unidentified: false, start: { value: 0, initiative: null }, badge: null, traits: { value: [] }, rules: [], slug: "coven-support" }, flags: { [MODULE_ID]: { [SUPPORT_FLAG]: true } } }; }
function actionSource(action, effect) { return { name: "Поддержать Ковен", type: "action", img: ICON, system: { description: { value: "<p>Вы сосредотачиваетесь на общей магии ковена и до конца раунда считаетесь поддерживающей его. Если ковен поддерживают как минимум две участницы, третья может сотворять заклинания ковена.</p>" }, actionType: { value: "action" }, actions: { value: 1 }, category: "interaction", traits: { value: ["concentrate"] }, selfEffect: { uuid: effect.uuid, name: effect.name }, rules: [], slug: "support-coven" }, flags: { [MODULE_ID]: { [GENERATED_FLAG]: marker(action.id, "action") } } }; }

async function supportEffect() {
  const existing = game.items.find((item) => item.getFlag(MODULE_ID, SUPPORT_FLAG));
  if (existing) return existing;
  supportEffectPromise ??= Item.createDocuments([effectSource()]).then(([created]) => created).finally(() => { supportEffectPromise = null; });
  return supportEffectPromise;
}

async function createDocuments(actor, action, config) {
  const correction = actor.getFlag(MODULE_ID, "creatureCorrectionApplication")?.spellcasting;
  const actorLevel = Math.max(-1, Math.min(24, Number(actor.level ?? actor.system?.details?.level?.value) || 0));
  const system = { ability: { value: config.ability }, tradition: { value: config.tradition }, prepared: { value: "innate" }, proficiency: { value: 1 }, showSlotlessLevels: { value: true } };
  const dc = correction?.dc != null ? Number(correction.dc) : HIGH_DCS[actorLevel];
  system.spelldc = { dc, value: dc - 8 };
  const [entry] = await actor.createEmbeddedDocuments("Item", [{ name: config.name, type: "spellcastingEntry", system, flags: { [MODULE_ID]: { [GENERATED_FLAG]: marker(action.id, "entry") } } }]);
  const base = await baseSpellSources(); const contributed = config.spells.map((spell) => ({ source: foundry.utils.deepClone(spell.source), uuid: spell.uuid }));
  const unique = [...base, ...contributed].filter((spell, index, all) => all.findIndex((other) => (other.uuid || other.source?.system?.slug) === (spell.uuid || spell.source?.system?.slug)) === index);
  const available = hasEnoughSupporters();
  const spells = unique.map(({ source }, index) => {
    const rank = Math.max(5, Number(source.system?.level?.value) || 0);
    source.flags = foundry.utils.mergeObject(source.flags ?? {}, { [MODULE_ID]: { [GENERATED_FLAG]: marker(action.id, "spell") } });
    source.system.location = { value: entry.id, heightenedLevel: rank, signature: false, uses: { value: available ? 1 : 0, max: 1 } };
    source.sort = (index + 1) * 100000;
    return source;
  });
  if (spells.length) await actor.createEmbeddedDocuments("Item", spells);
  const effect = await supportEffect();
  await actor.createEmbeddedDocuments("Item", [actionSource(action, effect)]);
}

function sceneActors() {
  const actors = new Map();
  for (const token of canvas.scene?.tokens ?? []) {
    const actor = token.actor;
    if (actor) actors.set(actor.uuid, actor);
  }
  return [...actors.values()];
}

function hasEnoughSupporters() {
  let supporters = 0;
  for (const token of canvas.scene?.tokens ?? []) {
    if (token.actor?.itemTypes?.effect?.some((effect) => effect.getFlag(MODULE_ID, SUPPORT_FLAG))) supporters += 1;
    if (supporters >= 2) return true;
  }
  return false;
}

async function refreshSceneCovenSpells() {
  if (!game.user.isGM || !canvas.ready) return;
  const value = hasEnoughSupporters() ? 1 : 0;
  for (const actor of sceneActors()) {
    const updates = (actor.itemTypes?.spell ?? [])
      .filter((spell) => spell.getFlag(MODULE_ID, GENERATED_FLAG)?.kind === "spell")
      .filter((spell) => spell.system.location?.uses?.max === 1 && spell.system.location.uses.value !== value)
      .map((spell) => ({ _id: spell.id, "system.location.uses.value": value }));
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }
}

async function setSceneCovenSpellUses(value) {
  for (const actor of sceneActors()) {
    const updates = (actor.itemTypes?.spell ?? [])
      .filter((spell) => spell.getFlag(MODULE_ID, GENERATED_FLAG)?.kind === "spell")
      .filter((spell) => spell.system.location?.uses?.max === 1 && spell.system.location.uses.value !== value)
      .map((spell) => ({ _id: spell.id, "system.location.uses.value": value }));
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }
}

async function consumeCovenSupportFromMessage(message) {
  if (!game.user.isGM || message.getFlag(MODULE_ID, "covenSupportConsumed")) return;
  const spell = message.item;
  if (spell?.type !== "spell" || spell.getFlag(MODULE_ID, GENERATED_FLAG)?.kind !== "spell") return;

  for (const actor of sceneActors()) {
    const effects = (actor.itemTypes?.effect ?? []).filter((effect) => effect.getFlag(MODULE_ID, SUPPORT_FLAG));
    if (effects.length) await actor.deleteEmbeddedDocuments("Item", effects.map((effect) => effect.id));
  }
  await setSceneCovenSpellUses(0);
  await message.setFlag(MODULE_ID, "covenSupportConsumed", true);
}

async function migrateSceneCovens() {
  if (!game.user.isGM || !canvas.ready) return;
  for (const actor of sceneActors()) {
    const legacyEntry = (actor.itemTypes?.spellcastingEntry ?? []).some((entry) => (
      entry.getFlag(MODULE_ID, GENERATED_FLAG)?.kind === "entry" && entry.system.prepared?.value !== "innate"
    ));
    if (legacyEntry) await syncActor(actor);
  }
  await refreshSceneCovenSpells();
}

async function syncActor(actor) {
  if (!actor || syncingActors.has(actor.id)) return; syncingActors.add(actor.id);
  try {
    const locked = areCreatureCorrectionsLocked(actor); const lockedAction = (id) => locked && isCreatureCorrectionManagedItem(actor.items.get(id));
    const generated = actor.items.filter((item) => { const value = item.getFlag(MODULE_ID, GENERATED_FLAG); return value && !lockedAction(value.actionId); });
    if (generated.length) await actor.deleteEmbeddedDocuments("Item", generated.map((item) => item.id));
    for (const action of actor.itemTypes?.action ?? []) if (!lockedAction(action.id) && isActionPlusFeatureEnabled(action, FEATURE_ID)) await createDocuments(actor, action, getConfig(action));
  } finally { syncingActors.delete(actor.id); }
}

async function cleanup({ item }) { await item.unsetFlag(MODULE_ID, FLAG_KEY); await syncActor(item.actor); }

async function applySupportEffectFromMessage(message) {
  if (message.author?.id !== game.user.id || message.getFlag(MODULE_ID, "covenSupportApplied")) return;
  if (message.flags?.pf2e?.context?.type !== "self-effect") return;
  const actor = message.actor;
  const action = message.item;
  const generated = action?.getFlag(MODULE_ID, GENERATED_FLAG);
  if (!actor || action?.type !== "action" || generated?.kind !== "action" || !action.system?.selfEffect?.uuid) return;
  const effect = await fromUuid(action.system.selfEffect.uuid);
  if (effect?.type !== "effect") return ui.notifications.error("Не найден эффект поддержки ковена.");
  const source = effect.toObject();
  source._id = null;
  source.system ??= {};
  source.system.context = {
    origin: { actor: actor.uuid, token: message.token?.uuid ?? null, item: action.uuid, spellcasting: null, rollOptions: action.getOriginData().rollOptions },
    target: { actor: actor.uuid, token: actor.getActiveTokens(true, true).at(0)?.uuid ?? null },
    roll: null,
  };
  source.system.traits = { value: action.system.traits.value.filter((trait) => trait === "concentrate") };
  const previous = actor.itemTypes?.effect?.filter((item) => item.getFlag(MODULE_ID, SUPPORT_FLAG)) ?? [];
  if (previous.length) await actor.deleteEmbeddedDocuments("Item", previous.map((item) => item.id));
  await actor.createEmbeddedDocuments("Item", [source]);
  const container = document.createElement("div");
  container.innerHTML = message.content;
  const buttons = container.querySelector(".message-buttons");
  if (buttons) buttons.innerHTML = '<div class="notification info">Поддержка ковена активна до конца раунда.</div>';
  await message.update({ content: container.innerHTML, [`flags.${MODULE_ID}.covenSupportApplied`]: true });
}

registerActionPlusFeature({ id: FEATURE_ID, label: `${I18N_PREFIX}.ActionPlus.Coven.FeatureLabel`, render: renderControls, activateListeners, cleanup });
Hooks.on("preUpdateItem", (item, changed) => {
  if (item.type !== "spell" || item.getFlag(MODULE_ID, GENERATED_FLAG)?.kind !== "spell") return;
  const path = "system.location.uses.value";
  if (foundry.utils.getProperty(changed, path) !== undefined && hasEnoughSupporters()) foundry.utils.setProperty(changed, path, 1);
});
Hooks.on("createItem", (item) => { if (item.type === "action") void syncActor(item.actor); });
Hooks.on("updateItem", (item, changed) => { if (item.type === "action" && (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`) || foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.actionOptions`))) void syncActor(item.actor); });
Hooks.on("deleteItem", (item) => { if (item.type === "action") void syncActor(item.actor); });
Hooks.on("updateActor", (actor, changed) => { if (foundry.utils.hasProperty(changed, "system.details.level.value")) void syncActor(actor); });
Hooks.on("tsPf2eUtilityCorrectionLockChanged", (actor, locked) => { if (!locked) void syncActor(actor); });
Hooks.on("createChatMessage", (message) => {
  void applySupportEffectFromMessage(message);
  void consumeCovenSupportFromMessage(message);
});
Hooks.on("createItem", (item) => { if (item.type === "effect" && item.getFlag(MODULE_ID, SUPPORT_FLAG)) void refreshSceneCovenSpells(); });
Hooks.on("deleteItem", (item) => { if (item.type === "effect" && item.getFlag(MODULE_ID, SUPPORT_FLAG)) void refreshSceneCovenSpells(); });
Hooks.on("canvasReady", () => { void migrateSceneCovens(); });
