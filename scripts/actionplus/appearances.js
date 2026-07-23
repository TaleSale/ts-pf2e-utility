import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { getItemActionPlusOptions, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "appearances";
const FLAG_KEY = "appearances";
const ACTOR_STATE_FLAG = "appearanceState";

const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.Appearances.${key}`);
const validScale = (value, fallback = 1, minimum = 0.2) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(3, Math.max(minimum, number)) : fallback;
};

function normalizeAppearance(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: String(source.name ?? ""),
    actorName: String(source.actorName ?? ""),
    tokenName: String(source.tokenName ?? source.actorName ?? ""),
    actorImg: String(source.actorImg ?? ""),
    tokenImg: String(source.tokenImg ?? ""),
    tokenScale: validScale(source.tokenScale),
    dynamicTokenImg: String(source.dynamicTokenImg ?? ""),
    dynamicRingEnabled: Boolean(source.dynamicRingEnabled),
    dynamicTokenScale: validScale(source.dynamicTokenScale, 1, 0.5),
  };
}

function getConfigs(item) {
  const configs = item.getFlag(MODULE_ID, FLAG_KEY);
  return Array.isArray(configs) ? configs.map(normalizeAppearance) : [];
}

function renderControls({ flags, occurrenceIndex = 0 }) {
  const config = normalizeAppearance(flags?.[FLAG_KEY]?.[occurrenceIndex]);
  const fields = [
    ["name", "AppearanceName", false],
    ["actorName", "ActorName", false],
    ["tokenName", "TokenName", false],
    ["actorImg", "ActorImage", true],
    ["tokenImg", "TokenImage", true],
    ["dynamicTokenImg", "DynamicTokenImage", true],
  ];
  return `<div class="ts-appearance-editor">
    ${fields.map(([field, label, isImage, inputType = "text"]) => `<div class="form-group"><label>${escapeHtml(localize(label))}</label><div class="form-fields">${isImage
      ? `<file-picker class="ts-appearance-input" data-field="${field}" type="imagevideo" value="${escapeHtml(config[field])}"></file-picker>`
      : `<input type="${inputType}" class="ts-appearance-input" data-field="${field}" value="${escapeHtml(config[field])}" ${inputType === "number" ? 'min="0.2" max="3" step="0.05"' : ""}>`
    }</div></div>`).join("")}
    <div class="form-group"><label>${escapeHtml(localize("TokenScale"))}</label><div class="form-fields">
      <input type="number" class="ts-appearance-input" data-field="tokenScale" value="${config.tokenScale}" min="0.2" max="3" step="0.05">
    </div></div>
    <div class="form-group"><label>${escapeHtml(localize("DynamicRingEnabled"))}</label><div class="form-fields">
      <input type="checkbox" class="ts-appearance-input" data-field="dynamicRingEnabled" ${config.dynamicRingEnabled ? "checked" : ""}>
    </div></div>
    <div class="form-group"><label>${escapeHtml(localize("DynamicTokenScale"))}</label><div class="form-fields">
      <input type="number" class="ts-appearance-input" data-field="dynamicTokenScale" value="${config.dynamicTokenScale}" min="0.5" max="3" step="0.02">
    </div></div>
  </div>`;
}

async function persist(item, occurrenceIndex, panel) {
  const configs = getConfigs(item);
  const config = normalizeAppearance(configs[occurrenceIndex]);
  for (const input of panel.querySelectorAll(".ts-appearance-input")) {
    if (input.type === "checkbox") config[input.dataset.field] = input.checked;
    else if (input.type === "number") {
      const minimum = input.dataset.field === "dynamicTokenScale" ? 0.5 : 0.2;
      config[input.dataset.field] = validScale(input.value, 1, minimum);
    }
    else config[input.dataset.field] = input.value.trim();
  }
  configs[occurrenceIndex] = config;
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: configs }, { render: false });
  const actor = item.actor;
  const appearanceId = `${item.id}:${occurrenceIndex}`;
  if (actor?.getFlag(MODULE_ID, ACTOR_STATE_FLAG)?.active === appearanceId) {
    await applyAppearance(actor, appearanceId, getActorAppearances(actor));
  } else {
    actor?.sheet?.render(false);
  }
}

function activateListeners({ item, html, optionIndex, occurrenceIndex = 0 }) {
  const root = htmlElement(html);
  const panel = root?.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"] .ts-appearance-editor`);
  if (!panel) return;
  panel.addEventListener("change", (event) => {
    if (!event.target.closest(".ts-appearance-input")) return;
    void persist(item, occurrenceIndex, panel);
  });
}

async function cleanup({ item, occurrenceIndex = 0 }) {
  const configs = getConfigs(item);
  configs.splice(occurrenceIndex, 1);
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: configs }, { render: false });
  item.actor?.sheet?.render(false);
}

function getActorAppearances(actor) {
  const results = [];
  for (const item of actor.itemTypes?.action ?? []) {
    const count = getItemActionPlusOptions(item).filter((id) => id === FEATURE_ID).length;
    const configs = getConfigs(item);
    for (let index = 0; index < count; index += 1) {
      const config = normalizeAppearance(configs[index]);
      if (config.name) results.push({ id: `${item.id}:${index}`, ...config });
    }
  }
  return results;
}

function readOriginal(actor) {
  return {
    name: actor.name,
    actorImg: actor.img,
    tokenName: actor.prototypeToken?.name ?? actor.name,
    tokenImg: actor.prototypeToken?.texture?.src ?? actor.img,
    tokenScale: Math.abs(actor.prototypeToken?.texture?.scaleX ?? 1),
    dynamicTokenImg: actor.prototypeToken?.ring?.subject?.texture ?? "",
    dynamicRingEnabled: actor.prototypeToken?.ring?.enabled ?? false,
    dynamicTokenScale: actor.prototypeToken?.ring?.subject?.scale ?? 1,
  };
}

async function applyAppearance(actor, appearanceId, appearances) {
  const currentState = actor.getFlag(MODULE_ID, ACTOR_STATE_FLAG) ?? {};
  const liveOriginal = readOriginal(actor);
  const savedOriginal = currentState.original && typeof currentState.original === "object" ? currentState.original : {};
  const original = currentState.active ? {
    ...liveOriginal,
    ...savedOriginal,
    tokenScale: validScale(savedOriginal.tokenScale, liveOriginal.tokenScale),
    dynamicTokenScale: validScale(savedOriginal.dynamicTokenScale, liveOriginal.dynamicTokenScale, 0.5),
    dynamicRingEnabled: typeof savedOriginal.dynamicRingEnabled === "boolean"
      ? savedOriginal.dynamicRingEnabled
      : liveOriginal.dynamicRingEnabled,
  } : liveOriginal;
  const appearance = appearances.find((entry) => entry.id === appearanceId) ?? null;
  const data = appearance ? {
    name: appearance.actorName || original.name,
    actorImg: appearance.actorImg || original.actorImg,
    tokenName: appearance.tokenName || original.tokenName,
    tokenImg: appearance.tokenImg || original.tokenImg,
    tokenScale: appearance.tokenScale,
    dynamicTokenImg: appearance.dynamicTokenImg || original.dynamicTokenImg,
    dynamicRingEnabled: appearance.dynamicRingEnabled,
    dynamicTokenScale: appearance.dynamicTokenScale,
  } : original;
  data.tokenScale = validScale(data.tokenScale, original.tokenScale);
  data.dynamicTokenScale = validScale(data.dynamicTokenScale, original.dynamicTokenScale, 0.5);

  const update = {
    name: data.name,
    img: data.actorImg,
    "prototypeToken.name": data.tokenName,
    "prototypeToken.texture.src": data.tokenImg,
    "prototypeToken.texture.scaleX": data.tokenScale * Math.sign(actor.prototypeToken?.texture?.scaleX || 1),
    "prototypeToken.texture.scaleY": data.tokenScale * Math.sign(actor.prototypeToken?.texture?.scaleY || 1),
    "prototypeToken.ring.enabled": data.dynamicRingEnabled,
    "prototypeToken.ring.subject.texture": data.dynamicTokenImg,
    "prototypeToken.ring.subject.scale": data.dynamicTokenScale,
    [`flags.${MODULE_ID}.${ACTOR_STATE_FLAG}`]: { original, active: appearance?.id ?? "" },
  };
  await actor.update(update);

  const tokenUpdate = {
    name: data.tokenName,
    "texture.src": data.tokenImg,
    "ring.enabled": data.dynamicRingEnabled,
    "ring.subject.texture": data.dynamicTokenImg,
    "ring.subject.scale": data.dynamicTokenScale,
  };
  for (const token of actor.getActiveTokens?.(false, true) ?? []) {
    const document = token.document ?? token;
    if (document.canUserModify instanceof Function && !document.canUserModify(game.user, "update")) continue;
    await document.update({
      ...tokenUpdate,
      "texture.scaleX": data.tokenScale * Math.sign(document.texture?.scaleX || 1),
      "texture.scaleY": data.tokenScale * Math.sign(document.texture?.scaleY || 1),
    });
  }
}

function injectSelector(app, html) {
  const actor = app?.document ?? app?.actor ?? null;
  if (!actor || !["npc", "character"].includes(actor.type)) return;
  const root = htmlElement(html);
  if (!root) return;
  if (actor.canUserModify instanceof Function ? !actor.canUserModify(game.user, "update") : !actor.isOwner) return;
  const appearances = getActorAppearances(actor);
  if (!appearances.length || root.querySelector(".ts-appearance-selector")) return;
  const active = actor.getFlag(MODULE_ID, ACTOR_STATE_FLAG)?.active ?? "";
  const options = [
    `<option value="" ${active ? "" : "selected"}>${escapeHtml(localize("Original"))}</option>`,
    ...appearances.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === active ? "selected" : ""}>${escapeHtml(entry.name)}</option>`),
  ].join("");
  const selectorTitle = actor.type === "npc"
    ? `<span style="font-weight:600">${escapeHtml(localize("SelectorLabel"))}</span>`
    : "";
  const characterSpacing = actor.type === "character" ? "margin-top:10px;" : "";
  const markup = `<label class="ts-appearance-selector" style="display:flex;flex-direction:column;align-items:stretch;gap:3px;width:100%;${characterSpacing}">${selectorTitle}<select style="width:100%">${options}</select></label>`;
  const portrait = actor.type === "character"
    ? root.querySelector('.tab[data-tab="character"] .subsection.details .image-container')
    : root.querySelector(".sidebar .image-container");
  const fallback = root.querySelector("header.sheet-header, .sheet-header") ?? root;
  if (portrait && actor.type === "character") {
    portrait.style.maxHeight = "none";
    portrait.insertAdjacentHTML("beforeend", markup);
  } else if (portrait) portrait.insertAdjacentHTML("afterend", markup);
  else fallback.insertAdjacentHTML("afterbegin", markup);
  root.querySelector(".ts-appearance-selector select")?.addEventListener("change", async (event) => {
    event.currentTarget.disabled = true;
    try { await applyAppearance(actor, event.currentTarget.value, appearances); }
    finally { event.currentTarget.disabled = false; }
  });
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.Appearances.FeatureLabel`,
  allowMultiple: true,
  render: renderControls,
  activateListeners,
  cleanup,
});

Hooks.on("renderActorSheet", injectSelector);
