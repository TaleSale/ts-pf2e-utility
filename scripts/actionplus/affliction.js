import { escapeHtml, I18N_PREFIX, MODULE_ID, SOCKET_CHANNEL } from "../core.js";
import { isActionPlusFeatureEnabled, isSupportedActionPlusItem, registerActionPlusFeature } from "./actionplus.js";
import {
  durationUnitSeconds,
  mergeAfflictionDefinition,
  normalizeDuration,
  parseAfflictionDescription,
  validateAfflictionDefinition,
} from "./affliction-parser.js";
import { exposureTransition, periodicTransition } from "./affliction-rules.js";

const FEATURE_ID = "affliction";
const DEFINITION_FLAG = "afflictionDefinition";
const INSTANCE_FLAG = "afflictionInstance";
const MANAGED_FLAG = "afflictionManaged";
const TRANSACTIONS_FLAG = "afflictionTransactions";
const CYCLE_OPTION_PREFIX = `${MODULE_ID}:affliction-cycle:`;
const PERIODIC_OPTION_PREFIX = `${MODULE_ID}:affliction-instance:`;
const ACTION_OPTION_PREFIX = `${MODULE_ID}:affliction-action:`;
const SOCKET_ACTION = "affliction.processToolbeltSave";
const CONFIG_VERSION = 1;
const MAX_TRANSACTIONS = 20;
const OUTCOMES = ["criticalFailure", "failure", "success", "criticalSuccess"];

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.Affliction.${key}`);
}

function clone(value) {
  return foundry.utils.deepClone(value);
}

function uid() {
  return foundry.utils.randomID();
}

function getHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function itemTraits(item) {
  const value = item?.system?.traits?.value ?? [];
  return Array.isArray(value) ? value : Array.from(value ?? []);
}

function defaultConfig(item = null) {
  return {
    version: CONFIG_VERSION,
    type: "poison",
    sourceMode: "action",
    source: null,
    parsed: parseAfflictionDescription(item?.system?.description?.value ?? "", {
      name: item?.name ?? "",
      img: item?.img ?? "",
      traits: itemTraits(item),
    }),
    overrides: {},
  };
}

function normalizeDamage(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    formula: String(source.formula ?? "").trim(),
    damageType: String(source.damageType ?? "poison").trim() || "poison",
    category: source.category ? String(source.category).trim() : null,
  };
}

function normalizeCondition(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    slug: String(source.slug ?? "").trim(),
    value: Math.max(1, Math.trunc(Number(source.value) || 1)),
    linked: source.linked !== false,
  };
}

function stripItemSource(source) {
  const copy = clone(source ?? {});
  delete copy._id;
  delete copy.folder;
  delete copy.sort;
  delete copy.ownership;
  delete copy._stats;
  return copy;
}

function normalizeEffect(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: String(source.id || uid()),
    name: String(source.name ?? source.source?.name ?? localize("EffectFallback")),
    img: String(source.img ?? source.source?.img ?? "icons/svg/aura.svg"),
    source: stripItemSource(source.source),
  };
}

function normalizeStage(value, index) {
  const source = value && typeof value === "object" ? value : {};
  return {
    number: index + 1,
    text: String(source.text ?? "").trim(),
    duration: normalizeDuration(source.duration),
    damage: (Array.isArray(source.damage) ? source.damage : []).map(normalizeDamage),
    conditions: (Array.isArray(source.conditions) ? source.conditions : []).map(normalizeCondition).filter((entry) => entry.slug),
    effects: (Array.isArray(source.effects) ? source.effects : []).map(normalizeEffect).filter((entry) => entry.source?.type === "effect"),
  };
}

function normalizeDefinition(value) {
  const source = value && typeof value === "object" ? value : {};
  const save = source.save && typeof source.save === "object" ? source.save : {};
  return {
    name: String(source.name ?? "").trim(),
    img: String(source.img ?? "").trim(),
    type: source.type === "poison" ? "poison" : String(source.type ?? "poison"),
    save: { type: ["fortitude", "reflex", "will"].includes(save.type) ? save.type : "fortitude", dc: Number(save.dc) || null },
    onset: normalizeDuration(source.onset),
    maxDuration: normalizeDuration(source.maxDuration),
    virulent: source.virulent === true,
    stages: (Array.isArray(source.stages) ? source.stages : []).map(normalizeStage),
  };
}

function normalizeConfig(value, item = null) {
  const source = value && typeof value === "object" ? value : defaultConfig(item);
  return {
    version: CONFIG_VERSION,
    type: source.type === "poison" ? "poison" : String(source.type ?? "poison"),
    sourceMode: source.sourceMode === "dropped" ? "dropped" : "action",
    source: source.source && typeof source.source === "object" ? {
      name: String(source.source.name ?? ""), img: String(source.source.img ?? ""),
    } : null,
    parsed: normalizeDefinition(source.parsed ?? defaultConfig(item).parsed),
    overrides: source.overrides && typeof source.overrides === "object" ? clone(source.overrides) : {},
  };
}

function resolvedDefinition(config) {
  return normalizeDefinition(mergeAfflictionDefinition(config));
}

function getConfig(item) {
  return normalizeConfig(item?.getFlag?.(MODULE_ID, DEFINITION_FLAG), item);
}

async function persistConfig(item, config, { render = true } = {}) {
  await item.update({ [`flags.${MODULE_ID}.${DEFINITION_FLAG}`]: normalizeConfig(config, item) }, { render });
}

function durationInput(duration, field) {
  const units = ["rounds", "seconds", "minutes", "hours", "days"];
  return `<div class="tsu-affliction-duration" data-field="${field}">
    <input type="text" data-duration-formula value="${escapeHtml(duration?.formula ?? "")}" placeholder="1 или 1d4">
    <select data-duration-unit>${units.map((unit) => `<option value="${unit}" ${duration?.unit === unit ? "selected" : ""}>${escapeHtml(localize(`Units.${unit}`))}</option>`).join("")}</select>
  </div>`;
}

function resetButton(field, config) {
  return Object.hasOwn(config.overrides, field)
    ? `<button type="button" class="tsu-affliction-reset" data-reset="${field}" title="${escapeHtml(localize("ResetAuto"))}"><i class="fas fa-rotate-left"></i></button>`
    : "";
}

function renderStage(stage, index, config) {
  const damageTypes = Object.keys(CONFIG.PF2E?.damageTypes ?? { poison: "Poison" });
  const conditions = Object.keys(CONFIG.PF2E?.conditionTypes ?? {}).sort((a, b) => a.localeCompare(b));
  return `<details class="tsu-affliction-stage" data-stage-index="${index}" open>
    <summary>${escapeHtml(localize("Stage").replace("{stage}", String(index + 1)))}</summary>
    <div class="tsu-affliction-stage-body">
      <label>${escapeHtml(localize("StageText"))}<textarea data-stage-field="text" rows="3">${escapeHtml(stage.text)}</textarea></label>
      <label>${escapeHtml(localize("Period"))}${durationInput(stage.duration, "stage")}</label>
      <section><header><strong>${escapeHtml(localize("Damage"))}</strong><button type="button" data-stage-action="add-damage"><i class="fas fa-plus"></i></button></header>
        <div class="tsu-affliction-rows">${stage.damage.map((damage, damageIndex) => `<div class="tsu-affliction-damage" data-damage-index="${damageIndex}">
          <input type="text" data-damage-field="formula" value="${escapeHtml(damage.formula)}" placeholder="1d6">
          <select data-damage-field="damageType">${damageTypes.map((type) => `<option value="${type}" ${damage.damageType === type ? "selected" : ""}>${escapeHtml(game.i18n.localize(CONFIG.PF2E.damageTypes[type] ?? type))}</option>`).join("")}</select>
          <button type="button" data-stage-action="remove-damage"><i class="fas fa-trash"></i></button></div>`).join("")}</div>
      </section>
      <section><header><strong>${escapeHtml(localize("Conditions"))}</strong><button type="button" data-stage-action="add-condition"><i class="fas fa-plus"></i></button></header>
        <div class="tsu-affliction-rows">${stage.conditions.map((condition, conditionIndex) => `<div class="tsu-affliction-condition" data-condition-index="${conditionIndex}">
          <select data-condition-field="slug">${conditions.map((slug) => `<option value="${slug}" ${condition.slug === slug ? "selected" : ""}>${escapeHtml(game.i18n.localize(CONFIG.PF2E.conditionTypes[slug] ?? slug))}</option>`).join("")}</select>
          <input type="number" min="1" data-condition-field="value" value="${condition.value}">
          <button type="button" data-stage-action="remove-condition"><i class="fas fa-trash"></i></button></div>`).join("")}</div>
      </section>
      <section><header><strong>${escapeHtml(localize("Effects"))}</strong></header>
        <div class="tsu-affliction-effects">${stage.effects.map((effect, effectIndex) => `<div data-effect-index="${effectIndex}"><img src="${escapeHtml(effect.img)}"><span>${escapeHtml(effect.name)}</span><button type="button" data-stage-action="remove-effect"><i class="fas fa-trash"></i></button></div>`).join("")}</div>
        <div class="tsu-affliction-effect-drop">${escapeHtml(localize("EffectDrop"))}</div>
      </section>
      <footer><button type="button" data-stage-action="remove-stage"><i class="fas fa-trash"></i> ${escapeHtml(localize("RemoveStage"))}</button></footer>
    </div>
  </details>`;
}

function renderControls({ item }) {
  const config = getConfig(item);
  const definition = resolvedDefinition(config);
  const errors = validateAfflictionDefinition(definition);
  const errorHtml = errors.length ? `<div class="tsu-affliction-errors"><strong>${escapeHtml(localize("Invalid"))}</strong><ul>${errors.map((error) => `<li>${escapeHtml(formatValidationError(error))}</li>`).join("")}</ul></div>` : `<p class="tsu-affliction-ready"><i class="fas fa-check"></i> ${escapeHtml(localize("Ready"))}</p>`;
  return `<div class="tsu-affliction-editor" data-item-id="${item.id}">
    <p class="notes">${escapeHtml(localize("Hint"))}</p>
    <div class="form-group"><label>${escapeHtml(localize("Type"))}</label><div class="form-fields"><select class="tsu-affliction-type"><option value="poison">${escapeHtml(localize("Types.poison"))}</option><option disabled>${escapeHtml(localize("Types.disease"))}</option><option disabled>${escapeHtml(localize("Types.curse"))}</option></select></div></div>
    <div class="tsu-affliction-import"><img src="${escapeHtml(config.source?.img || definition.img || item.img)}"><span>${escapeHtml(config.source?.name || localize(config.sourceMode === "dropped" ? "ImportedCopy" : "ActionDescription"))}</span><button type="button" data-action="parse-action"><i class="fas fa-wand-magic-sparkles"></i> ${escapeHtml(localize("ParseAction"))}</button></div>
    <div class="tsu-affliction-item-drop">${escapeHtml(localize("ItemDrop"))}</div>
    ${errorHtml}
    <div class="form-group"><label>${escapeHtml(localize("Name"))}</label><div class="form-fields"><input type="text" data-top-field="name" value="${escapeHtml(definition.name || item.name)}">${resetButton("name", config)}</div></div>
    <div class="form-group"><label>${escapeHtml(localize("Save"))}</label><div class="form-fields"><select data-save-field="type">${["fortitude", "reflex", "will"].map((type) => `<option value="${type}" ${definition.save.type === type ? "selected" : ""}>${escapeHtml(localize(`Saves.${type}`))}</option>`).join("")}</select><input type="number" min="1" data-save-field="dc" value="${definition.save.dc ?? ""}">${resetButton("save", config)}</div></div>
    <div class="form-group"><label>${escapeHtml(localize("Onset"))}</label><div class="form-fields">${durationInput(definition.onset, "onset")}${resetButton("onset", config)}</div></div>
    <div class="form-group"><label>${escapeHtml(localize("MaxDuration"))}</label><div class="form-fields">${durationInput(definition.maxDuration, "maxDuration")}${resetButton("maxDuration", config)}</div></div>
    <div class="form-group"><label>${escapeHtml(localize("Virulent"))}</label><div class="form-fields"><input type="checkbox" data-top-field="virulent" ${definition.virulent ? "checked" : ""}>${resetButton("virulent", config)}</div></div>
    <div class="tsu-affliction-stages"><header><strong>${escapeHtml(localize("Stages"))}</strong>${resetButton("stages", config)}<button type="button" data-action="add-stage"><i class="fas fa-plus"></i></button></header>${definition.stages.map((stage, index) => renderStage(stage, index, config)).join("")}</div>
  </div>`;
}

function formatValidationError(error) {
  if (error === "unsupportedType") return localize("Errors.unsupportedType");
  if (error === "save") return localize("Errors.save");
  if (error === "stages") return localize("Errors.stages");
  if (error.startsWith("stageDuration:")) return localize("Errors.stageDuration").replace("{stage}", error.split(":")[1]);
  return error;
}

function readDuration(element) {
  const formula = String(element?.querySelector("[data-duration-formula]")?.value ?? "").trim();
  const unit = String(element?.querySelector("[data-duration-unit]")?.value ?? "rounds");
  return formula ? { formula, unit } : null;
}

function definitionFromEditor(editor, base) {
  const definition = clone(base);
  definition.name = String(editor.querySelector('[data-top-field="name"]')?.value ?? definition.name).trim();
  definition.save = {
    type: String(editor.querySelector('[data-save-field="type"]')?.value ?? "fortitude"),
    dc: Number(editor.querySelector('[data-save-field="dc"]')?.value) || null,
  };
  definition.onset = readDuration(editor.querySelector('[data-field="onset"]'));
  definition.maxDuration = readDuration(editor.querySelector('[data-field="maxDuration"]'));
  definition.virulent = Boolean(editor.querySelector('[data-top-field="virulent"]')?.checked);
  definition.stages = Array.from(editor.querySelectorAll(".tsu-affliction-stage")).map((section, index) => ({
    number: index + 1,
    text: String(section.querySelector('[data-stage-field="text"]')?.value ?? "").trim(),
    duration: readDuration(section.querySelector('[data-field="stage"]')),
    damage: Array.from(section.querySelectorAll(".tsu-affliction-damage")).map((row) => ({
      formula: String(row.querySelector('[data-damage-field="formula"]')?.value ?? "").trim(),
      damageType: String(row.querySelector('[data-damage-field="damageType"]')?.value ?? "poison"), category: null,
    })),
    conditions: Array.from(section.querySelectorAll(".tsu-affliction-condition")).map((row) => ({
      slug: String(row.querySelector('[data-condition-field="slug"]')?.value ?? ""),
      value: Math.max(1, Number(row.querySelector('[data-condition-field="value"]')?.value) || 1), linked: true,
    })),
    effects: base.stages?.[index]?.effects?.map(normalizeEffect) ?? [],
  }));
  return normalizeDefinition(definition);
}

async function confirmReplace() {
  if (foundry.applications?.api?.DialogV2?.confirm) {
    return foundry.applications.api.DialogV2.confirm({ window: { title: localize("ReplaceTitle") }, content: `<p>${escapeHtml(localize("ReplaceConfirm"))}</p>` });
  }
  return globalThis.confirm(localize("ReplaceConfirm"));
}

async function resolveDroppedItem(event) {
  try {
    const data = TextEditor.getDragEventData(event);
    return data?.uuid ? await fromUuid(data.uuid) : data?.type === "Item" && data.id ? game.items.get(data.id) : null;
  } catch { return null; }
}

function activateListeners({ app, html, item, optionIndex }) {
  const root = getHtmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  const editor = panel?.querySelector(".tsu-affliction-editor");
  if (!editor) return;

  if (!item.getFlag(MODULE_ID, DEFINITION_FLAG)) void persistConfig(item, defaultConfig(item));

  const saveEditorOverride = async (field) => {
    const config = getConfig(item);
    const definition = definitionFromEditor(editor, resolvedDefinition(config));
    config.overrides[field] = clone(definition[field]);
    await persistConfig(item, config, { render: false });
    app.render(false);
  };

  editor.addEventListener("change", (event) => {
    if (!event.target.matches("input, select, textarea")) return;
    const field = event.target.closest(".tsu-affliction-stage")
      ? "stages"
      : event.target.closest("[data-save-field]")
        ? "save"
        : event.target.closest("[data-field]")?.dataset.field
          ?? event.target.dataset.topField;
    if (["name", "save", "onset", "maxDuration", "virulent", "stages"].includes(field)) {
      void saveEditorOverride(field);
    }
  });

  editor.addEventListener("click", async (event) => {
    const reset = event.target.closest("[data-reset]");
    if (reset) {
      const config = getConfig(item); delete config.overrides[reset.dataset.reset];
      await persistConfig(item, config); return;
    }
    if (event.target.closest('[data-action="parse-action"]')) {
      const config = getConfig(item);
      config.sourceMode = "action"; config.source = null;
      config.parsed = normalizeDefinition(parseAfflictionDescription(item.system?.description?.value ?? "", { name: item.name, img: item.img, traits: itemTraits(item) }));
      await persistConfig(item, config); return;
    }
    if (event.target.closest('[data-action="add-stage"]')) {
      const config = getConfig(item); const definition = definitionFromEditor(editor, resolvedDefinition(config));
      definition.stages.push(normalizeStage({ duration: { formula: "1", unit: "rounds" } }, definition.stages.length));
      config.overrides.stages = definition.stages; await persistConfig(item, config); return;
    }
    const actionButton = event.target.closest("[data-stage-action]");
    if (!actionButton) return;
    const config = getConfig(item); const definition = definitionFromEditor(editor, resolvedDefinition(config));
    const section = actionButton.closest(".tsu-affliction-stage"); const index = Number(section?.dataset.stageIndex);
    const stage = definition.stages[index]; if (!stage) return;
    switch (actionButton.dataset.stageAction) {
      case "add-damage": stage.damage.push(normalizeDamage({ damageType: "poison" })); break;
      case "remove-damage": stage.damage.splice(Number(actionButton.closest("[data-damage-index]")?.dataset.damageIndex), 1); break;
      case "add-condition": stage.conditions.push(normalizeCondition({ slug: "sickened" })); break;
      case "remove-condition": stage.conditions.splice(Number(actionButton.closest("[data-condition-index]")?.dataset.conditionIndex), 1); break;
      case "remove-effect": stage.effects.splice(Number(actionButton.closest("[data-effect-index]")?.dataset.effectIndex), 1); break;
      case "remove-stage": definition.stages.splice(index, 1); break;
      default: return;
    }
    config.overrides.stages = definition.stages.map(normalizeStage); await persistConfig(item, config);
  });

  for (const dropZone of editor.querySelectorAll(".tsu-affliction-item-drop, .tsu-affliction-effect-drop")) {
    dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("is-dragover"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragover"));
    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault(); dropZone.classList.remove("is-dragover");
      const dropped = await resolveDroppedItem(event); if (!dropped) return;
      if (dropZone.classList.contains("tsu-affliction-item-drop")) {
        if (!itemTraits(dropped).includes("poison")) return ui.notifications.warn(localize("OnlyPoison"));
        if (item.getFlag(MODULE_ID, DEFINITION_FLAG) && !await confirmReplace()) return;
        const config = defaultConfig(item);
        config.sourceMode = "dropped"; config.source = { name: dropped.name, img: dropped.img };
        config.parsed = normalizeDefinition(parseAfflictionDescription(dropped.system?.description?.value ?? "", { name: dropped.name, img: dropped.img, traits: itemTraits(dropped) }));
        config.overrides = {}; await persistConfig(item, config); return;
      }
      if (dropped.type !== "effect") return ui.notifications.warn(localize("OnlyEffect"));
      const config = getConfig(item); const definition = definitionFromEditor(editor, resolvedDefinition(config));
      const index = Number(dropZone.closest(".tsu-affliction-stage")?.dataset.stageIndex);
      if (!definition.stages[index]) return;
      definition.stages[index].effects.push(normalizeEffect({ name: dropped.name, img: dropped.img, source: dropped.toObject() }));
      config.overrides.stages = definition.stages; await persistConfig(item, config);
    });
  }
}

async function cleanup({ item }) {
  await item.unsetFlag(MODULE_ID, DEFINITION_FLAG);
}

registerActionPlusFeature({ id: FEATURE_ID, label: `${I18N_PREFIX}.ActionPlus.Affliction.FeatureLabel`, render: renderControls, activateListeners, cleanup });

Hooks.on("preUpdateItem", (item, changed) => {
  if (!isSupportedActionPlusItem(item) || !isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;
  const description = foundry.utils.getProperty(changed, "system.description.value");
  if (description === undefined) return;
  const config = getConfig(item); if (config.sourceMode !== "action") return;
  config.parsed = normalizeDefinition(parseAfflictionDescription(description, { name: item.name, img: item.img, traits: itemTraits(item) }));
  foundry.utils.setProperty(changed, `flags.${MODULE_ID}.${DEFINITION_FLAG}`, config);
});

function normalizeOutcome(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 3) return OUTCOMES[value];
  const key = String(value ?? "").replace(/[\s_-]/g, "").toLowerCase();
  return ({ criticalsuccess: "criticalSuccess", success: "success", failure: "failure", criticalfailure: "criticalFailure" })[key] ?? null;
}

function actorFromReference(reference) {
  if (!reference) return null;
  if (reference.documentName === "Actor") return reference;
  if (reference.actor?.documentName === "Actor") return reference.actor;
  const uuid = typeof reference === "string" ? reference : reference.actor ?? reference.actorUuid ?? reference.uuid ?? reference.token ?? reference.tokenUuid;
  if (!uuid) return null;
  const direct = fromUuidSync?.(String(uuid));
  if (direct?.documentName === "Actor") return direct;
  if (direct?.actor) return direct.actor;
  const id = String(uuid).split(".").at(-1);
  return game.actors.get(id) ?? canvas.tokens?.placeables.find((token) => token.id === id || token.document?.uuid === uuid)?.actor ?? null;
}

async function documentFromReference(reference) {
  if (!reference) return null;
  if (reference.documentName) return reference;
  const uuid = typeof reference === "string" ? reference : reference.uuid ?? reference.item ?? reference.itemUuid;
  if (!uuid) return null;
  try { return await fromUuid(uuid); } catch { return null; }
}

function messageContext(message) {
  return message?.flags?.pf2e?.context ?? message?.getFlag?.("pf2e", "context") ?? {};
}

async function resolveAction(message) {
  const context = messageContext(message);
  const origin = context.origin ?? message?.flags?.pf2e?.origin ?? {};
  const toolbelt = message?.flags?.["pf2e-toolbelt"]?.targetHelper ?? {};
  const actors = [message?.actor, actorFromReference(origin.actor ?? origin.actorUuid), actorFromReference(message?.speaker?.actor)].filter(Boolean);
  const actionOption = (Array.isArray(context.options) ? context.options : [])
    .find((option) => String(option).startsWith(ACTION_OPTION_PREFIX));
  const actionUuid = actionOption?.slice(ACTION_OPTION_PREFIX.length)
    ?? message?.getFlag?.(MODULE_ID, "afflictionExposure")?.actionUuid;
  for (const candidate of [message?.item, origin.item, origin.itemUuid, context.item, context.itemUuid, toolbelt.item, actionUuid]) {
    const rawId = typeof candidate === "string" && !candidate.includes(".") ? candidate : null;
    const item = (rawId ? actors.map((actor) => actor.items?.get(rawId)).find(Boolean) : null) ?? await documentFromReference(candidate);
    if (item?.type === "action" && item.getFlag?.(MODULE_ID, DEFINITION_FLAG)) return item;
  }
  const options = Array.isArray(context.options) ? context.options : [];
  const slug = options.find((option) => String(option).startsWith("item:slug:"))?.slice(10) ?? context.action ?? context.slug;
  return slug ? actors.flatMap((actor) => actor.itemTypes?.action ?? []).find((item) => (item.slug ?? item.system?.slug) === slug && item.getFlag(MODULE_ID, DEFINITION_FLAG)) ?? null : null;
}

function getCycleOption(context) {
  return (Array.isArray(context?.options) ? context.options : []).find((option) => String(option).startsWith(CYCLE_OPTION_PREFIX))?.slice(CYCLE_OPTION_PREFIX.length) ?? null;
}

function appendActionCardContent(content, addition) {
  const template = document.createElement("template");
  template.innerHTML = String(content ?? "").trim();
  const card = template.content.querySelector(".pf2e.chat-card, .chat-card");
  if (!card) return `${content ?? ""}${addition}`;
  let cardContent = card.querySelector(":scope > .card-content");
  if (!cardContent) {
    cardContent = document.createElement("div");
    cardContent.className = "card-content";
    const footer = card.querySelector(":scope > .card-footer");
    if (footer) footer.before(cardContent);
    else card.append(cardContent);
  }
  cardContent.insertAdjacentHTML("beforeend", addition);
  return template.innerHTML;
}

Hooks.on("preCreateChatMessage", (message) => {
  const context = messageContext(message);
  if (context?.type !== "saving-throw" || getCycleOption(context)) return;
  const origin = context.origin ?? message.flags?.pf2e?.origin;
  const actor = actorFromReference(origin?.actor ?? origin?.actorUuid);
  const rawId = typeof origin?.item === "string" && !origin.item.includes(".") ? origin.item : null;
  const item = rawId ? actor?.items?.get(rawId) : message.item;
  if (item?.type !== "action" || !item.getFlag?.(MODULE_ID, DEFINITION_FLAG)) return;
  const options = Array.from(new Set([...(context.options ?? []), `${CYCLE_OPTION_PREFIX}${uid()}`, `${ACTION_OPTION_PREFIX}${item.uuid}`, "item:trait:poison"]));
  message.updateSource({ "flags.pf2e.context.options": options });
});

async function prepareExposureMessage(message) {
  if (
    !message?.isAuthor
    || message.isRoll
    || message.getFlag?.(MODULE_ID, "afflictionExposure")
    || message.getFlag?.(MODULE_ID, "afflictionSave")
  ) return;
  const action = await resolveAction(message);
  if (!action || !isActionPlusFeatureEnabled(action, FEATURE_ID)) return;
  const definition = resolvedDefinition(getConfig(action));
  if (validateAfflictionDefinition(definition).length) {
    ui.notifications.warn(localize("InvalidUse"));
    return;
  }

  const cycleId = `exposure:${message.id}:${uid()}`;
  const updates = {
    [`flags.${MODULE_ID}.afflictionExposure`]: { actionUuid: action.uuid, cycleId },
  };
  const rawDescription = String(action.system?.description?.value ?? "");
  if (!/@Check\s*\[/i.test(rawDescription)) {
    const check = `@Check[${definition.save.type}|dc:${definition.save.dc}|options:${CYCLE_OPTION_PREFIX}${cycleId},${ACTION_OPTION_PREFIX}${action.uuid},item:trait:poison]{${localize("InitialSave")}}`;
    const enriched = await TextEditor.enrichHTML(`<div class="tsu-affliction-initial-save"><strong>${escapeHtml(definition.name)}</strong><span class="tsu-affliction-save-separator"> — </span>${check}</div>`, { async: true, relativeTo: action });
    updates.content = appendActionCardContent(message.content, enriched);
  }

  if (game.toolbelt?.targetHelper) {
    const existingTargets = game.toolbelt.targetHelper.getMessageTargets?.(message) ?? [];
    const targets = existingTargets.length ? existingTargets : [...(game.user.targets ?? [])];
    const targetUuids = targets.map((target) => target.document?.uuid ?? target.uuid).filter(Boolean);
    const helper = clone(message.flags?.["pf2e-toolbelt"]?.targetHelper ?? {});
    Object.assign(helper, {
      type: "action",
      author: action.actor?.uuid ?? null,
      item: action.uuid,
      options: Array.from(new Set([...(helper.options ?? []), `${CYCLE_OPTION_PREFIX}${cycleId}`, `${ACTION_OPTION_PREFIX}${action.uuid}`, "item:trait:poison"])),
      saveVariants: { null: { basic: false, dc: definition.save.dc, statistic: definition.save.type, saves: {} } },
      targets: targetUuids,
    });
    updates["flags.pf2e-toolbelt.targetHelper"] = helper;
  }
  await message.update(updates);
}

function instanceFromEffect(effect) {
  const value = effect?.getFlag?.(MODULE_ID, INSTANCE_FLAG);
  return value && typeof value === "object" ? clone(value) : null;
}

function findInstanceEffect(actor, { instanceId = null, actionUuid = null } = {}) {
  return (actor?.itemTypes?.effect ?? []).find((effect) => {
    const instance = instanceFromEffect(effect);
    return instance && (!instanceId || instance.id === instanceId) && (!actionUuid || instance.actionUuid === actionUuid);
  }) ?? null;
}

function isPoisonImmune(actor, action) {
  try { if (actor?.isImmuneTo?.(action)) return true; } catch { /* continue */ }
  const immunities = actor?.attributes?.immunities ?? actor?.system?.attributes?.immunities ?? [];
  return Array.from(immunities).some((entry) => [entry?.type, entry?.slug, entry].includes("poison"));
}

function combatTurnKey(combat = game.combat) {
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? -1}` : null;
}

async function evaluateFormula(formula) {
  try { return Math.max(0, Math.trunc((await new Roll(String(formula || 0)).evaluate()).total)); }
  catch { return 0; }
}

async function durationTurns(duration) {
  const normalized = normalizeDuration(duration); if (!normalized) return null;
  const value = await evaluateFormula(normalized.formula);
  const seconds = value * durationUnitSeconds(normalized.unit, Number(CONFIG.time?.roundTime) || 6);
  return Math.max(1, Math.ceil(seconds / (Number(CONFIG.time?.roundTime) || 6)));
}

function effectBadge(definition, instance) {
  const hasOnset = Boolean(definition.onset);
  const labels = hasOnset ? [localize("OnsetBadge"), ...definition.stages.map((_, index) => String(index + 1))] : definition.stages.map((_, index) => String(index + 1));
  return { type: "counter", value: instance.phase === "onset" ? 1 : instance.stage + (hasOnset ? 1 : 0), labels, loop: false };
}

function instanceDescription(instance) {
  if (instance.phase === "onset") return `<p>${escapeHtml(localize("OnsetActive"))}</p>`;
  const stage = instance.definition.stages[instance.stage - 1];
  const timer = instance.awaitingSave
    ? localize("AwaitingSave")
    : localize("NextSaveTurns").replace("{turns}", String(Math.max(0, Number(instance.remainingStageTurns) || 0)));
  return `<p><strong>${escapeHtml(localize("Stage").replace("{stage}", String(instance.stage)))}</strong></p><p>${escapeHtml(stage?.text ?? "")}</p><p><em>${escapeHtml(timer)}</em></p>`;
}

function rootEffectSource(instance) {
  return {
    name: instance.definition.name || localize("UnnamedPoison"), type: "effect",
    img: instance.definition.img || "icons/consumables/potions/potion-jar-corked-labeled-poison-skull-green.webp",
    system: {
      badge: effectBadge(instance.definition, instance), description: { value: instanceDescription(instance) },
      duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
      level: { value: 1 }, rules: [], slug: null, tokenIcon: { show: true }, traits: { value: ["poison"] }, unidentified: false,
    },
    flags: { [MODULE_ID]: { [INSTANCE_FLAG]: instance } },
  };
}

async function createRootEffect(actor, instance) {
  return (await actor.createEmbeddedDocuments("Item", [rootEffectSource(instance)]))[0] ?? null;
}

async function updateRootEffect(effect, instance) {
  await effect.update({
    [`flags.${MODULE_ID}.${INSTANCE_FLAG}`]: instance,
    "system.badge": effectBadge(instance.definition, instance),
    "system.description.value": instanceDescription(instance),
  }, { render: false });
}

async function deleteManagedChildren(actor, instanceId) {
  const ids = actor.items.filter((item) => item.getFlag?.(MODULE_ID, MANAGED_FLAG)?.instanceId === instanceId).map((item) => item.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids, { render: false });
}

async function applyStageItems(actor, effect, instance) {
  const stage = instance.definition.stages[instance.stage - 1]; if (!stage) return [];
  const sources = [];
  for (const condition of stage.conditions) {
    const base = game.pf2e?.ConditionManager?.getCondition?.(condition.slug);
    if (!base) continue;
    const source = base.toObject(); delete source._id;
    if (foundry.utils.hasProperty(source, "system.value.value")) foundry.utils.setProperty(source, "system.value.value", condition.value);
    foundry.utils.setProperty(source, `flags.${MODULE_ID}.${MANAGED_FLAG}`, { instanceId: instance.id, revision: instance.revision });
    sources.push(source);
  }
  for (const reference of stage.effects) {
    const source = stripItemSource(reference.source); if (source.type !== "effect") continue;
    foundry.utils.setProperty(source, `flags.${MODULE_ID}.${MANAGED_FLAG}`, { instanceId: instance.id, revision: instance.revision });
    sources.push(source);
  }
  return sources.length ? actor.createEmbeddedDocuments("Item", sources, { render: false }) : [];
}

function damageFormula(stage) {
  const entries = stage.damage.filter((entry) => entry.formula).map((entry) => `${entry.formula}[${[entry.damageType, entry.category].filter(Boolean).join(",")}]`);
  if (!entries.length) return null;
  return entries.length === 1 ? entries[0] : `{${entries.join(",")}}`;
}

async function applyStageDamage(actor, effect, instance) {
  const stage = instance.definition.stages[instance.stage - 1]; const formula = damageFormula(stage ?? {});
  if (!formula) return { messages: [], appliedDamage: null };
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll");
  if (!DamageRoll) return { messages: [], appliedDamage: null };
  const roll = await new DamageRoll(formula).evaluate();
  const token = actor.combatant?.token?.object ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
  const rollMessage = await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token }), flavor: `${escapeHtml(instance.definition.name)} — ${escapeHtml(localize("Stage").replace("{stage}", String(instance.stage)))}`,
    flags: { [MODULE_ID]: { afflictionDamage: { instanceId: instance.id, revision: instance.revision } }, pf2e: { context: { type: "damage-roll", target: { actor: actor.uuid, token: token?.document?.uuid ?? null }, options: ["item:trait:poison"] } } },
  });
  const appliedMessage = await actor.applyDamage({ damage: roll, token, item: effect, rollOptions: new Set(["item:trait:poison", "origin:action:trait:poison"]) });
  return { messages: [rollMessage?.id, appliedMessage?.id].filter(Boolean), appliedDamage: clone(appliedMessage?.flags?.pf2e?.appliedDamage ?? null) };
}

async function postStageDescription(actor, instance) {
  const stage = instance.definition.stages[instance.stage - 1];
  const stageLabel = localize("Stage").replace("{stage}", String(instance.stage));
  const description = stage?.text ? await TextEditor.enrichHTML(stage.text, { async: true }) : "";
  const content = `<div class="tsu-affliction-stage-card"><strong>${escapeHtml(actor.name)} ${escapeHtml(localize("Receives"))} ${escapeHtml(instance.definition.name)} — ${escapeHtml(stageLabel)}</strong>${description ? `<div>${description}</div>` : ""}</div>`;
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { [MODULE_ID]: { afflictionStage: { instanceId: instance.id, revision: instance.revision } } },
  });
  return message?.id ?? null;
}

async function enterStage(actor, effect, instance, { damage = true } = {}) {
  instance.phase = "stage"; instance.stage = Math.clamp(instance.stage, 1, instance.definition.stages.length);
  instance.remainingStageTurns = await durationTurns(instance.definition.stages[instance.stage - 1]?.duration);
  instance.revision += 1;
  await deleteManagedChildren(actor, instance.id);
  await updateRootEffect(effect, instance);
  await applyStageItems(actor, effect, instance);
  const descriptionMessage = await postStageDescription(actor, instance);
  const consequence = damage ? await applyStageDamage(actor, effect, instance) : { messages: [], appliedDamage: null };
  return { ...consequence, messages: [descriptionMessage, ...(consequence.messages ?? [])].filter(Boolean) };
}

function getTransactions(actor) {
  const value = actor.getFlag?.(MODULE_ID, TRANSACTIONS_FLAG);
  return Array.isArray(value) ? clone(value) : [];
}

async function saveTransactions(actor, transactions) {
  await actor.setFlag(MODULE_ID, TRANSACTIONS_FLAG, transactions.slice(-MAX_TRANSACTIONS));
}

async function undoTransaction(actor, transaction) {
  if (transaction.appliedDamage) await actor.undoDamage(transaction.appliedDamage);
  const messageIds = transaction.messages?.filter((id) => game.messages?.get(id)?.canUserModify?.(game.user, "delete")) ?? [];
  if (messageIds.length) await ChatMessage.deleteDocuments(messageIds);
  const current = findInstanceEffect(actor, { actionUuid: transaction.actionUuid });
  if (current) {
    const currentInstance = instanceFromEffect(current);
    await deleteManagedChildren(actor, currentInstance.id);
    await current.delete({ render: false });
  }
  if (!transaction.baseInstance) return null;
  const base = clone(transaction.baseInstance);
  const effect = await createRootEffect(actor, base); if (!effect) return null;
  if (base.phase === "stage") await applyStageItems(actor, effect, base);
  return effect;
}

async function removeInstance(actor, effect, instance) {
  await deleteManagedChildren(actor, instance.id);
  await effect.delete({ render: false });
}

async function buildInitialInstance(definition, actionUuid, targetActor, targetStage) {
  const hasOnset = Boolean(definition.onset);
  const instance = {
    id: uid(), actionUuid, definition: clone(definition), phase: hasOnset ? "onset" : "stage",
    stage: hasOnset ? 0 : Math.clamp(targetStage, 1, definition.stages.length), pendingStage: Math.clamp(targetStage, 1, definition.stages.length),
    remainingOnsetTurns: hasOnset ? await durationTurns(definition.onset) : null,
    remainingStageTurns: null, remainingMaxTurns: hasOnset ? null : await durationTurns(definition.maxDuration),
    virulentSuccesses: 0, revision: 0, awaitingSave: false, pendingCycleId: null, pendingMessageId: null,
    skipEndTurnKey: targetActor.combatant?.id === game.combat?.combatant?.id ? combatTurnKey() : null,
  };
  return instance;
}

async function applyOutcome({ actor, definition, actionUuid, cycleId, outcome, kind = "exposure", instanceId = null }) {
  let transactions = getTransactions(actor);
  let transaction = transactions.find((entry) => entry.cycleId === cycleId);
  if (transaction?.outcome === outcome) {
    if (kind === "periodic") {
      const current = findInstanceEffect(actor, { instanceId, actionUuid });
      const currentInstance = instanceFromEffect(current);
      if (current && currentInstance?.awaitingSave && currentInstance.pendingCycleId === cycleId) {
        currentInstance.awaitingSave = false;
        currentInstance.pendingCycleId = null;
        currentInstance.pendingMessageId = null;
        currentInstance.revision += 1;
        await updateRootEffect(current, currentInstance);
      }
    }
    return;
  }
  if (transaction) {
    const latestForAction = transactions.findLast((entry) => entry.actionUuid === transaction.actionUuid);
    if (latestForAction?.cycleId !== transaction.cycleId) {
      ui.notifications.warn(localize("StaleReroll"));
      return;
    }
    const current = findInstanceEffect(actor, { actionUuid: transaction.actionUuid });
    const currentRevision = instanceFromEffect(current)?.revision ?? null;
    if (currentRevision !== (transaction.appliedRevision ?? null)) {
      ui.notifications.warn(localize("StaleReroll"));
      return;
    }
    await undoTransaction(actor, transaction);
    transactions = getTransactions(actor).filter((entry) => entry.cycleId !== cycleId);
  }
  let effect = findInstanceEffect(actor, { instanceId, actionUuid });
  let instance = effect ? instanceFromEffect(effect) : null;
  const baseInstance = instance ? clone(instance) : null;
  const record = { cycleId, actionUuid, kind, outcome, definition: clone(definition), baseInstance, messages: [], appliedDamage: null, appliedRevision: null };

  if (kind === "exposure" && !instance) {
    if (["success", "criticalSuccess"].includes(outcome)) {
      transactions.push(record); await saveTransactions(actor, transactions); return;
    }
    instance = await buildInitialInstance(definition, actionUuid, actor, outcome === "criticalFailure" ? 2 : 1);
    effect = await createRootEffect(actor, instance); if (!effect) return;
    if (instance.phase === "stage") {
      const consequence = await enterStage(actor, effect, instance); Object.assign(record, consequence);
    } else await updateRootEffect(effect, instance);
  } else if (!instance || !effect) {
    return;
  } else if (kind === "exposure") {
    if (["failure", "criticalFailure"].includes(outcome)) {
      instance.virulentSuccesses = 0;
      if (instance.phase === "onset") {
        instance.pendingStage = exposureTransition({ stage: instance.pendingStage, outcome, maxStage: instance.definition.stages.length }).stage;
        instance.revision += 1; await updateRootEffect(effect, instance);
      } else {
        const transition = exposureTransition({ stage: instance.stage, outcome, maxStage: instance.definition.stages.length });
        instance.stage = transition.stage;
        if (transition.changed) {
          const consequence = await enterStage(actor, effect, instance); Object.assign(record, consequence);
        } else {
          instance.revision += 1;
          await updateRootEffect(effect, instance);
        }
      }
    }
  } else {
    instance.awaitingSave = false; instance.pendingCycleId = null; instance.pendingMessageId = null;
    const transition = periodicTransition({
      stage: instance.stage, outcome, maxStage: instance.definition.stages.length,
      virulent: instance.definition.virulent, virulentSuccesses: instance.virulentSuccesses,
    });
    instance.virulentSuccesses = transition.virulentSuccesses;
    if (transition.cured) await removeInstance(actor, effect, instance);
    else {
      instance.stage = transition.stage;
      const consequence = await enterStage(actor, effect, instance); Object.assign(record, consequence);
    }
  }
  const applied = findInstanceEffect(actor, { actionUuid });
  record.appliedRevision = instanceFromEffect(applied)?.revision ?? null;
  transactions.push(record); await saveTransactions(actor, transactions);
}

function shouldProcessStandardMessage(message) {
  if (!message?.isRoll || messageContext(message).type !== "saving-throw") return false;
  const actor = message.actor ?? actorFromReference(message.speaker?.actor);
  return actor?.primaryUpdater ? game.user === actor.primaryUpdater : message.isAuthor;
}

const actorMutationQueues = new Map();

async function enqueueActorMutation(actor, operation) {
  if (!actor) return;
  const key = actor.uuid;
  const previous = actorMutationQueues.get(key) ?? Promise.resolve();
  const current = previous
    .catch((error) => console.error(`${MODULE_ID} | Affliction queue recovered`, error))
    .then(operation);
  actorMutationQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (actorMutationQueues.get(key) === current) actorMutationQueues.delete(key);
  }
}

async function processRoll(message, overrides = {}) {
  const actor = overrides.targetActor ?? message.actor ?? actorFromReference(message.speaker?.actor);
  return enqueueActorMutation(actor, () => processRollNow(message, overrides));
}

async function processRollNow(message, overrides = {}) {
  const outcome = normalizeOutcome(overrides.outcome ?? messageContext(message).outcome);
  const targetActor = overrides.targetActor ?? message.actor ?? actorFromReference(message.speaker?.actor);
  const mayCoordinate = overrides.localToolbelt
    ? targetActor?.canUserModify?.(game.user, "update")
    : game.user === targetActor?.primaryUpdater;
  if (!outcome || !targetActor || !mayCoordinate) return;
  const context = messageContext(message);
  const saveFlag = overrides.automationMessage?.getFlag?.(MODULE_ID, "afflictionSave") ?? message.getFlag?.(MODULE_ID, "afflictionSave");
  const optionInstanceId = (context.options ?? []).find((option) => String(option).startsWith(PERIODIC_OPTION_PREFIX))?.slice(PERIODIC_OPTION_PREFIX.length) ?? null;
  const periodicInstanceId = saveFlag?.instanceId ?? optionInstanceId;
  if (periodicInstanceId) {
    const effect = findInstanceEffect(targetActor, { instanceId: periodicInstanceId }); const instance = instanceFromEffect(effect);
    if (!instance) return;
    const cycleId = saveFlag?.cycleId ?? getCycleOption(context) ?? `${periodicInstanceId}:${uid()}`;
    await applyOutcome({ actor: targetActor, definition: instance.definition, actionUuid: instance.actionUuid, cycleId, outcome, kind: "periodic", instanceId: instance.id });
    return;
  }
  const action = await resolveAction(overrides.automationMessage ?? message) ?? await resolveAction(message);
  if (!action) return;
  const definition = resolvedDefinition(getConfig(action));
  const errors = validateAfflictionDefinition(definition);
  if (errors.length) return ui.notifications.warn(localize("InvalidUse"));
  if (isPoisonImmune(targetActor, action)) return ui.notifications.info(localize("Immune").replace("{name}", targetActor.name));
  const cycleId = overrides.cycleId ?? getCycleOption(messageContext(message)) ?? `message:${message.id}:${targetActor.uuid}`;
  await applyOutcome({ actor: targetActor, definition, actionUuid: action.uuid, cycleId, outcome, kind: "exposure" });
}

Hooks.on("createChatMessage", (message) => {
  if (!message?.isRoll) void prepareExposureMessage(message).catch((error) => console.error(`${MODULE_ID} | Affliction exposure card failed`, error));
  if (shouldProcessStandardMessage(message)) void processRoll(message).catch((error) => console.error(`${MODULE_ID} | Affliction roll failed`, error));
});

function toolbeltTargetData(target) {
  const token = target?.documentName === "Token"
    ? target
    : target?.uuid ? fromUuidSync?.(target.uuid) : null;
  const actor = token?.actor ?? null;
  return actor ? { actor, tokenUuid: token.uuid } : null;
}

async function processToolbeltSave({ message, rollMessage = null, target, outcome, reroll = false }) {
  const targetData = toolbeltTargetData(target);
  if (!message || !targetData || !outcome) return;
  const cycleId = `toolbelt:${message.id}:${targetData.tokenUuid}`;
  if (game.user === targetData.actor.primaryUpdater) {
    await processRoll(rollMessage ?? message, {
      automationMessage: message,
      outcome,
      targetActor: targetData.actor,
      cycleId,
      localToolbelt: true,
    });
    return;
  }
  game.socket?.emit(SOCKET_CHANNEL, {
    moduleId: MODULE_ID,
    action: SOCKET_ACTION,
    senderId: game.user.id,
    payload: { messageId: message.id, targetTokenUuid: targetData.tokenUuid, outcome, cycleId, reroll },
  });
}

Hooks.on("pf2e-toolbelt.rollSave", ({ message, rollMessage, target, data } = {}) => {
  void processToolbeltSave({ message, rollMessage, target, outcome: data?.success })
    .catch((error) => console.error(`${MODULE_ID} | Toolbelt affliction roll failed`, error));
});

Hooks.on("pf2e-toolbelt.rerollSave", ({ message, target, data } = {}) => {
  void processToolbeltSave({ message, target, outcome: data?.success, reroll: true })
    .catch((error) => console.error(`${MODULE_ID} | Toolbelt affliction reroll failed`, error));
});

function storedToolbeltOutcome(message, targetId) {
  const variants = message?.flags?.["pf2e-toolbelt"]?.targetHelper?.saveVariants ?? {};
  for (const variant of Object.values(variants)) {
    const outcome = variant?.saves?.[targetId]?.success;
    if (outcome) return outcome;
  }
  return null;
}

async function processStoredToolbeltResults(message) {
  const targets = game.toolbelt?.targetHelper?.getMessageTargets?.(message) ?? [];
  for (const target of targets) {
    const targetData = toolbeltTargetData(target);
    const outcome = storedToolbeltOutcome(message, target.id);
    if (!targetData || !outcome || game.user !== targetData.actor.primaryUpdater) continue;
    await processRoll(message, {
      automationMessage: message,
      outcome,
      targetActor: targetData.actor,
      cycleId: `toolbelt:${message.id}:${targetData.tokenUuid}`,
      localToolbelt: true,
    });
  }
}

Hooks.on("updateChatMessage", (message, changed) => {
  if (!message.getFlag?.(MODULE_ID, "afflictionSave") && !message.getFlag?.(MODULE_ID, "afflictionExposure")) return;
  const toolbeltChanged = foundry.utils.hasProperty(changed, "flags.pf2e-toolbelt")
    || foundry.utils.hasProperty(changed, "flags.pf2e-toolbelt.targetHelper")
    || foundry.utils.hasProperty(changed, "flags.pf2e-toolbelt.targetHelper.saveVariants")
    || Object.keys(changed ?? {}).some((key) => key.startsWith("flags.pf2e-toolbelt.targetHelper.saveVariants"));
  if (!toolbeltChanged) return;
  void processStoredToolbeltResults(message)
    .catch((error) => console.error(`${MODULE_ID} | Stored Toolbelt affliction result failed`, error));
});

Hooks.once("ready", () => {
  game.socket?.on(SOCKET_CHANNEL, (request) => {
    if (request?.moduleId !== MODULE_ID || request.action !== SOCKET_ACTION || request.senderId === game.user.id) return;
    void (async () => {
      const message = game.messages?.get(request.payload?.messageId);
      const token = request.payload?.targetTokenUuid ? await fromUuid(request.payload.targetTokenUuid).catch(() => null) : null;
      const actor = token?.documentName === "Token" ? token.actor : null;
      if (!message || !actor || game.user !== actor.primaryUpdater) return;
      await processRoll(message, {
        automationMessage: message,
        outcome: request.payload.outcome,
        targetActor: actor,
        cycleId: request.payload.cycleId,
        localToolbelt: true,
      });
    })().catch((error) => console.error(`${MODULE_ID} | Socket affliction save failed`, error));
  });
});

Hooks.on("pf2e.reroll", () => { /* The replacement message preserves the cycle roll option and is handled by createChatMessage. */ });

async function postPeriodicSave(combatant, effect, instance) {
  const cycleId = `periodic:${instance.id}:${uid()}`;
  const label = `${instance.definition.name} — ${localize("Stage").replace("{stage}", String(instance.stage))}`;
  const check = `@Check[${instance.definition.save.type}|dc:${instance.definition.save.dc}|options:${PERIODIC_OPTION_PREFIX}${instance.id},${CYCLE_OPTION_PREFIX}${cycleId},item:trait:poison]{${localize("RollSave")}}`;
  const targetUuid = combatant.token?.uuid;
  const helper = targetUuid && game.toolbelt?.targetHelper ? {
    type: "check",
    author: combatant.actor?.uuid ?? null,
    item: instance.actionUuid,
    options: [`${PERIODIC_OPTION_PREFIX}${instance.id}`, `${CYCLE_OPTION_PREFIX}${cycleId}`, "item:trait:poison"],
    saveVariants: { null: { basic: false, dc: instance.definition.save.dc, statistic: instance.definition.save.type, saves: {} } },
    targets: [targetUuid],
  } : null;
  const updates = {
    speaker: ChatMessage.getSpeaker({ actor: combatant.actor, token: combatant.token?.object }),
    content: check,
    flavor: escapeHtml(label),
    flags: {
      [MODULE_ID]: { afflictionSave: { instanceId: instance.id, cycleId, actionUuid: instance.actionUuid } },
      ...(helper ? { "pf2e-toolbelt": { targetHelper: helper } } : {}),
    },
  };
  const message = await ChatMessage.create(updates);
  instance.awaitingSave = true;
  instance.pendingCycleId = cycleId;
  instance.pendingMessageId = message.id;
  instance.revision += 1;
  await updateRootEffect(effect, instance);
}

function findPendingSaveMessage(instance) {
  const direct = instance.pendingMessageId ? game.messages?.get(instance.pendingMessageId) : null;
  if (direct) return direct;
  const messages = game.messages?.contents ?? [];
  for (let index = messages.length - 1, checked = 0; index >= 0 && checked < 100; index -= 1, checked += 1) {
    const message = messages[index];
    const flag = message.getFlag?.(MODULE_ID, "afflictionSave");
    if (flag?.instanceId === instance.id && (!instance.pendingCycleId || flag.cycleId === instance.pendingCycleId)) return message;
  }
  return null;
}

function findCompletedPeriodicRoll(actor, instance) {
  const messages = game.messages?.contents ?? [];
  for (let index = messages.length - 1, checked = 0; index >= 0 && checked < 100; index -= 1, checked += 1) {
    const message = messages[index];
    if (!message?.isRoll || (message.actor ?? actorFromReference(message.speaker?.actor))?.uuid !== actor.uuid) continue;
    const context = messageContext(message);
    const options = Array.isArray(context.options) ? context.options : [];
    const matchesInstance = options.includes(`${PERIODIC_OPTION_PREFIX}${instance.id}`);
    const matchesCycle = !instance.pendingCycleId || getCycleOption(context) === instance.pendingCycleId;
    if (matchesInstance && matchesCycle && normalizeOutcome(context.outcome)) return message;
  }
  return null;
}

async function recoverPendingSave(actor, effect, instance) {
  const message = findPendingSaveMessage(instance);
  if (message) {
    if (instance.pendingMessageId !== message.id) {
      instance.pendingMessageId = message.id;
      instance.revision += 1;
      await updateRootEffect(effect, instance);
    }
    const target = game.toolbelt?.targetHelper?.getMessageTargets?.(message)
      ?.find((candidate) => toolbeltTargetData(candidate)?.actor === actor);
    const outcome = target ? storedToolbeltOutcome(message, target.id) : null;
    if (target && outcome) {
      await processRollNow(message, {
        automationMessage: message,
        outcome,
        targetActor: actor,
        cycleId: `toolbelt:${message.id}:${target.uuid}`,
        localToolbelt: true,
      });
      return "resolved";
    }
    const standardRoll = findCompletedPeriodicRoll(actor, instance);
    if (standardRoll) {
      await processRollNow(standardRoll, { targetActor: actor });
      return "resolved";
    }
    return "waiting";
  }

  const standardRoll = findCompletedPeriodicRoll(actor, instance);
  if (standardRoll) {
    await processRollNow(standardRoll, { targetActor: actor });
    return "resolved";
  }

  // Old/broken pending state without a live card must never freeze the poison.
  instance.awaitingSave = false;
  instance.pendingCycleId = null;
  instance.pendingMessageId = null;
  instance.remainingStageTurns = 0;
  instance.revision += 1;
  await updateRootEffect(effect, instance);
  return "retry";
}

async function handleEndTurn(combatant) {
  const actor = combatant?.actor; if (!actor || game.user !== actor.primaryUpdater) return;
  const effects = (actor.itemTypes?.effect ?? []).filter((effect) => instanceFromEffect(effect));
  for (const effect of effects) {
    const instance = instanceFromEffect(effect); if (!instance) continue;
    if (instance.awaitingSave) {
      const recovered = await recoverPendingSave(actor, effect, instance);
      if (recovered !== "retry") continue;
    }
    const key = combatTurnKey();
    if (instance.skipEndTurnKey === key) { instance.skipEndTurnKey = null; await updateRootEffect(effect, instance); continue; }
    if (instance.phase === "stage" && Number.isFinite(instance.remainingMaxTurns)) {
      instance.remainingMaxTurns -= 1;
      if (instance.remainingMaxTurns <= 0) { await removeInstance(actor, effect, instance); continue; }
    }
    if (instance.phase === "onset") {
      instance.remainingOnsetTurns = Math.max(0, Number(instance.remainingOnsetTurns ?? 1) - 1);
      if (instance.remainingOnsetTurns <= 0) {
        instance.phase = "stage"; instance.stage = instance.pendingStage;
        instance.remainingMaxTurns = await durationTurns(instance.definition.maxDuration);
        await enterStage(actor, effect, instance);
      } else await updateRootEffect(effect, instance);
      continue;
    }
    instance.remainingStageTurns = Math.max(0, Number(instance.remainingStageTurns ?? 1) - 1);
    if (instance.remainingStageTurns <= 0) await postPeriodicSave(combatant, effect, instance);
    else await updateRootEffect(effect, instance);
  }
}

Hooks.on("pf2e.endTurn", (combatant) => {
  const actor = combatant?.actor;
  void enqueueActorMutation(actor, () => handleEndTurn(combatant))
    .catch((error) => console.error(`${MODULE_ID} | Affliction turn processing failed`, error));
});

Hooks.on("deleteItem", (item) => {
  const instance = instanceFromEffect(item); if (!instance || !item.actor || game.user !== item.actor.primaryUpdater) return;
  void deleteManagedChildren(item.actor, instance.id);
});
