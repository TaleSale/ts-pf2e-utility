import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "familiarOwner";
const FLAG_KEY = "familiarOwner";
const MASTER_FLAG_KEY = "familiarOwnerMasterUuid";
const PATCH_MARKER = Symbol.for(`${MODULE_ID}.familiarOwner.masterGetter`);
const ATTRIBUTE_PATCH_MARKER = Symbol.for(`${MODULE_ID}.familiarOwner.masterAttributeModifierGetter`);
const localize = (key) => game.i18n.localize(`${I18N_PREFIX}.ActionPlus.FamiliarOwner.${key}`);

function normalizeConfig(value) {
  return {
    familiarUuid: String(value?.familiarUuid ?? "").trim(),
    familiarName: String(value?.familiarName ?? "").trim(),
  };
}

function getConfig(item) {
  return normalizeConfig(item?.getFlag?.(MODULE_ID, FLAG_KEY));
}

function getOwnerAction(actor, familiar = null) {
  return (actor?.itemTypes?.action ?? []).find((item) => {
    if (!isActionPlusFeatureEnabled(item, FEATURE_ID)) return false;
    if (!familiar) return true;
    const uuid = getConfig(item).familiarUuid;
    return uuid === familiar.uuid || uuid === `Actor.${familiar.id}` || uuid === familiar.id;
  }) ?? null;
}

function canUpdate(document) {
  return document?.canUserModify instanceof Function
    ? document.canUserModify(game.user, "update")
    : Boolean(document?.isOwner);
}

async function resolveFamiliar(uuid) {
  if (!uuid) return null;
  try {
    const document = await fromUuid(uuid);
    return document?.documentName === "Actor" && document.type === "familiar" && !document.isToken ? document : null;
  } catch (error) {
    console.warn(`${MODULE_ID} | Unable to resolve familiar UUID: ${uuid}`, error);
    return null;
  }
}

function actorFromUuid(uuid) {
  if (!uuid) return null;
  try {
    const document = fromUuidSync(uuid);
    if (document?.documentName === "Token") return document.actor ?? null;
    return document?.documentName === "Actor" ? document : null;
  } catch {
    return null;
  }
}

function createMasterReference(master) {
  const token = master?.token?.documentName === "Token"
    ? master.token
    : master?.parent?.documentName === "Token" ? master.parent : null;
  if (token) {
    return {
      type: "token",
      sceneId: String(token.parent?.id ?? ""),
      tokenId: String(token.id ?? ""),
      actorId: String(master.id ?? token.actorId ?? ""),
    };
  }
  return {
    type: "actor",
    actorId: String(master?.id ?? ""),
  };
}

function resolveMasterReference(reference) {
  // Compatibility with links created by the first implementation.
  if (typeof reference === "string") return actorFromUuid(reference);
  if (reference?.type === "token") {
    return game.scenes?.get(String(reference.sceneId ?? ""))
      ?.tokens?.get(String(reference.tokenId ?? ""))
      ?.actor ?? null;
  }
  if (reference?.type === "actor") {
    return game.actors?.get(String(reference.actorId ?? "")) ?? null;
  }
  return null;
}

function referencesSameMaster(reference, master) {
  if (typeof reference === "string") {
    return actorFromUuid(reference) === master;
  }
  const current = createMasterReference(master);
  return reference?.type === current.type
    && String(reference?.actorId ?? "") === current.actorId
    && (current.type !== "token" || (
      String(reference?.sceneId ?? "") === current.sceneId
      && String(reference?.tokenId ?? "") === current.tokenId
    ));
}

function configuredMaster(familiar) {
  const reference = familiar?.getFlag?.(MODULE_ID, MASTER_FLAG_KEY) ?? null;
  const master = resolveMasterReference(reference);
  return master && getOwnerAction(master, familiar) ? master : null;
}

function findGetterDescriptor(prototype, property) {
  for (let current = prototype; current; current = Object.getPrototypeOf(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor?.get) return descriptor;
  }
  return null;
}

function patchFamiliarMasterGetter(familiar) {
  const prototype = familiar ? Object.getPrototypeOf(familiar) : null;
  const descriptor = prototype && findGetterDescriptor(prototype, "master");
  if (descriptor?.get && !descriptor.get[PATCH_MARKER]) {
    const original = descriptor.get;
    function getMasterWithConfiguredCreatureOwner() {
      const systemMaster = original.call(this);
      if (systemMaster) return systemMaster;
      const master = configuredMaster(this);
      if (master) master.familiar ??= this;
      return master;
    }
    getMasterWithConfiguredCreatureOwner[PATCH_MARKER] = true;
    Object.defineProperty(prototype, "master", { ...descriptor, get: getMasterWithConfiguredCreatureOwner });
  }

  const attributeDescriptor = prototype && findGetterDescriptor(prototype, "masterAttributeModifier");
  if (attributeDescriptor?.get && !attributeDescriptor.get[ATTRIBUTE_PATCH_MARKER]) {
    const original = attributeDescriptor.get;
    function getConfiguredMasterAttributeModifier() {
      const selectedAbility = String(this.system?.master?.ability ?? "");
      if (selectedAbility) return original.call(this);
      return Number(this.master?.system?.abilities?.cha?.mod) || 0;
    }
    getConfiguredMasterAttributeModifier[ATTRIBUTE_PATCH_MARKER] = true;
    Object.defineProperty(prototype, "masterAttributeModifier", {
      ...attributeDescriptor,
      get: getConfiguredMasterAttributeModifier,
    });
  }

  return Boolean(Object.getOwnPropertyDescriptor(prototype, "master")?.get?.[PATCH_MARKER]);
}

function ensurePatch() {
  const familiar = (game.actors?.contents ?? []).find((actor) => actor.type === "familiar");
  return familiar ? patchFamiliarMasterGetter(familiar) : false;
}

async function unlinkFamiliar(familiar, master) {
  const reference = familiar?.getFlag?.(MODULE_ID, MASTER_FLAG_KEY) ?? null;
  const belongsToMaster = referencesSameMaster(reference, master);
  if (!familiar || !belongsToMaster || getOwnerAction(master, familiar)) return;
  if (canUpdate(familiar)) {
    await familiar.update({
      "system.master.id": null,
      [`flags.${MODULE_ID}.-=${MASTER_FLAG_KEY}`]: null,
    });
  }
  if (master?.familiar === familiar) master.familiar = null;
}

async function linkFamiliar(item, familiar) {
  const master = item.actor ?? item.parent;
  if (!master || !familiar) return false;
  if (!canUpdate(familiar)) return ui.notifications.warn(localize("NoPermission")), false;
  const previous = await resolveFamiliar(getConfig(item).familiarUuid);
  await item.setFlag(MODULE_ID, FLAG_KEY, { familiarUuid: familiar.uuid, familiarName: familiar.name });
  ensurePatch();
  await familiar.update({
    "system.master.id": master.id,
    [`flags.${MODULE_ID}.${MASTER_FLAG_KEY}`]: createMasterReference(master),
  });
  familiar.reset();
  if (previous && previous !== familiar) await unlinkFamiliar(previous, master);
  return true;
}

function renderControls({ item }) {
  const config = getConfig(item);
  return `
    <div class="form-group" style="margin:0;">
      <label>${escapeHtml(localize("FamiliarUuid"))}</label>
      <div class="form-fields"><input class="ts-familiar-owner-uuid" type="text" value="${escapeHtml(config.familiarUuid)}" placeholder="Actor..."></div>
      <p class="hint">${escapeHtml(localize("FamiliarUuidHint"))}</p>
    </div>
    <div class="ts-familiar-owner-drop" style="margin-top:5px;padding:7px;border:1px dashed var(--color-border-light-tertiary);border-radius:3px;text-align:center;">
      ${escapeHtml(config.familiarName ? localize("SelectedFamiliar").replace("{name}", config.familiarName) : localize("DropHint"))}
    </div>`;
}

async function saveFamiliar(item, uuid) {
  const familiar = await resolveFamiliar(String(uuid ?? "").trim());
  if (!familiar) return ui.notifications.warn(localize("InvalidFamiliar")), false;
  return linkFamiliar(item, familiar);
}

function activateListeners({ html, item, optionIndex }) {
  const panel = html.querySelector(`.ts-utility-feature-panel[data-feature-id="${FEATURE_ID}"][data-option-index="${optionIndex}"]`);
  if (!panel) return;
  const input = panel.querySelector(".ts-familiar-owner-uuid");
  input?.addEventListener("change", async () => {
    input.disabled = true;
    try { await saveFamiliar(item, input.value); } finally { input.disabled = false; }
  });
  const drop = panel.querySelector(".ts-familiar-owner-drop");
  drop?.addEventListener("dragover", (event) => event.preventDefault());
  drop?.addEventListener("drop", async (event) => {
    event.preventDefault();
    let data = null;
    try { data = JSON.parse(event.dataTransfer?.getData("text/plain") || "null"); } catch { /* malformed drag data */ }
    await saveFamiliar(item, data?.uuid);
  });
}

async function cleanup({ item }) {
  const familiar = await resolveFamiliar(getConfig(item).familiarUuid);
  const master = item.actor ?? item.parent;
  await item.unsetFlag(MODULE_ID, FLAG_KEY);
  await unlinkFamiliar(familiar, master);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.FamiliarOwner.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup,
});

Hooks.once("ready", () => {
  ensurePatch();
  for (const familiar of (game.actors?.contents ?? []).filter((actor) => actor.type === "familiar")) {
    if (configuredMaster(familiar)) familiar.reset();
  }
});

Hooks.on("createActor", (actor) => {
  if (actor.type !== "familiar") return;
  patchFamiliarMasterGetter(actor);
  actor.reset();
});

Hooks.on("updateActor", (actor, changed, options) => {
  if (options?.fromMaster || actor.type === "familiar") return;
  const familiar = (game.actors?.contents ?? []).find((candidate) => (
    candidate.type === "familiar" && configuredMaster(candidate) === actor
  ));
  if (familiar) familiar.reset({ fromMaster: true });
});

Hooks.on("renderActorSheet", (app, html) => {
  const familiar = app?.actor ?? app?.document ?? app?.object ?? null;
  if (familiar?.type !== "familiar") return;
  const master = configuredMaster(familiar);
  if (!master) return;
  const root = html instanceof HTMLElement ? html : html?.[0] ?? html?.element ?? null;
  const select = root?.querySelector('select[name="system.master.id"]');
  if (!select) return;

  let option = Array.from(select.options).find((entry) => entry.value === master.id);
  if (!option) {
    option = document.createElement("option");
    option.value = master.id;
    select.append(option);
  }
  const isTokenOwner = Boolean(master.isToken || master.token);
  option.textContent = isTokenOwner
    ? localize("SelectedTokenOwner").replace("{name}", master.name)
    : master.name;
  option.selected = true;
  select.value = master.id;
});

Hooks.on("deleteItem", (item) => {
  if (item.type !== "action" || !isActionPlusFeatureEnabled(item, FEATURE_ID)) return;
  const master = item.actor ?? item.parent;
  void resolveFamiliar(getConfig(item).familiarUuid).then((familiar) => unlinkFamiliar(familiar, master));
});
