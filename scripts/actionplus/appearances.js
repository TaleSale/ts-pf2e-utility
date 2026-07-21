import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { getItemActionPlusOptions, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "appearances";
const FLAG_KEY = "appearances";
const ACTOR_STATE_FLAG = "appearanceState";

const htmlElement = (html) => html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.Appearances.${key}`);

function normalizeAppearance(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: String(source.name ?? ""),
    actorName: String(source.actorName ?? ""),
    actorImg: String(source.actorImg ?? ""),
    tokenImg: String(source.tokenImg ?? ""),
    dynamicTokenImg: String(source.dynamicTokenImg ?? ""),
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
    ["actorImg", "ActorImage", true],
    ["tokenImg", "TokenImage", true],
    ["dynamicTokenImg", "DynamicTokenImage", true],
  ];
  return `<div class="ts-appearance-editor">
    ${fields.map(([field, label, isImage]) => `<div class="form-group"><label>${escapeHtml(localize(label))}</label><div class="form-fields">${isImage
      ? `<file-picker class="ts-appearance-input" data-field="${field}" type="imagevideo" value="${escapeHtml(config[field])}"></file-picker>`
      : `<input type="text" class="ts-appearance-input" data-field="${field}" value="${escapeHtml(config[field])}">`
    }</div></div>`).join("")}
  </div>`;
}

async function persist(item, occurrenceIndex, panel) {
  const configs = getConfigs(item);
  const config = normalizeAppearance(configs[occurrenceIndex]);
  for (const input of panel.querySelectorAll(".ts-appearance-input")) config[input.dataset.field] = input.value.trim();
  configs[occurrenceIndex] = config;
  await item.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: configs }, { render: false });
  item.actor?.sheet?.render(false);
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
    dynamicTokenImg: actor.prototypeToken?.ring?.subject?.texture ?? "",
  };
}

async function applyAppearance(actor, appearanceId, appearances) {
  const currentState = actor.getFlag(MODULE_ID, ACTOR_STATE_FLAG) ?? {};
  const original = currentState.active ? (currentState.original ?? readOriginal(actor)) : readOriginal(actor);
  const appearance = appearances.find((entry) => entry.id === appearanceId) ?? null;
  const data = appearance ? {
    name: appearance.actorName || original.name,
    actorImg: appearance.actorImg || original.actorImg,
    tokenName: appearance.actorName || original.tokenName,
    tokenImg: appearance.tokenImg || original.tokenImg,
    dynamicTokenImg: appearance.dynamicTokenImg || original.dynamicTokenImg,
  } : original;

  const update = {
    name: data.name,
    img: data.actorImg,
    "prototypeToken.name": data.tokenName,
    "prototypeToken.texture.src": data.tokenImg,
    [`flags.${MODULE_ID}.${ACTOR_STATE_FLAG}`]: { original, active: appearance?.id ?? "" },
  };
  if (actor.prototypeToken?.ring) update["prototypeToken.ring.subject.texture"] = data.dynamicTokenImg;
  await actor.update(update);

  const tokenUpdate = { name: data.tokenName, "texture.src": data.tokenImg };
  for (const token of actor.getActiveTokens?.(false, true) ?? []) {
    const document = token.document ?? token;
    const current = { ...tokenUpdate };
    if (document.ring) current["ring.subject.texture"] = data.dynamicTokenImg;
    await document.update(current);
  }
}

function injectSelector(app, html) {
  const actor = app?.document ?? app?.actor ?? null;
  if (actor?.type !== "npc") return;
  const appearances = getActorAppearances(actor);
  if (!appearances.length) return;
  const root = htmlElement(html);
  if (!root || root.querySelector(".ts-appearance-selector")) return;
  const active = actor.getFlag(MODULE_ID, ACTOR_STATE_FLAG)?.active ?? "";
  const options = [
    `<option value="" ${active ? "" : "selected"}>${escapeHtml(localize("Original"))}</option>`,
    ...appearances.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === active ? "selected" : ""}>${escapeHtml(entry.name)}</option>`),
  ].join("");
  const markup = `<label class="ts-appearance-selector" style="display:flex;flex-direction:column;align-items:stretch;gap:3px;width:100%"><span style="font-weight:600">${escapeHtml(localize("SelectorLabel"))}</span><select style="width:100%">${options}</select></label>`;
  const portrait = root.querySelector(".sidebar .image-container");
  const fallback = root.querySelector("header.sheet-header, .sheet-header") ?? root;
  if (portrait) portrait.insertAdjacentHTML("afterend", markup);
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
