import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "degreeOfSuccess";
const FLAG_KEY = "degreeOfSuccess";
const IMMUNITY_FLAG = "degreeOfSuccessImmunity";
const DEGREES = ["criticalSuccess", "success", "failure", "criticalFailure"];
const RECIPIENTS = ["target", "source"];
const DURATION_UNITS = ["unlimited", "rounds", "minutes", "hours", "days"];

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.DegreeOfSuccess.${key}`);
}

function defaultImmunity() {
  return { enabled: false, durationValue: 1, durationUnit: "rounds", scope: "ability" };
}

function defaultRecipient() {
  return { enabled: false, damage: "", effects: [], immunity: defaultImmunity() };
}

function defaultConfig() {
  return {
    ...Object.fromEntries(DEGREES.map((degree) => [degree, {
    target: defaultRecipient(),
    source: defaultRecipient(),
    }])),
    aura: { enabled: false, radius: 10, targets: "enemies", triggers: { enters: false, startTurn: false, endTurn: false } },
  };
}

function normalizeImmunity(value) {
  const durationValue = Number(value?.durationValue);
  return {
    enabled: value?.enabled === true,
    durationValue: Number.isFinite(durationValue) && durationValue > 0 ? Math.trunc(durationValue) : 1,
    durationUnit: DURATION_UNITS.includes(value?.durationUnit) ? value.durationUnit : "rounds",
    scope: value?.scope === "source" ? "source" : "ability",
  };
}

function normalizeEffect(effect) {
  if (typeof effect === "string") return {
    uuid: effect,
    name: effect,
    img: "icons/svg/aura.svg",
    value: "",
    durationValue: "",
    durationUnit: "unlimited",
  };
  const rawValue = effect?.value;
  const value = Number(rawValue);
  const durationValue = Number(effect?.durationValue);
  const durationUnit = ["unlimited", "rounds", "minutes", "hours", "days"].includes(effect?.durationUnit)
    ? effect.durationUnit
    : "unlimited";
  return {
    uuid: String(effect?.uuid ?? ""),
    name: String(effect?.name ?? effect?.uuid ?? ""),
    img: String(effect?.img ?? "icons/svg/aura.svg"),
    value: rawValue !== "" && rawValue != null && Number.isFinite(value) && value >= 1 ? Math.trunc(value) : "",
    durationValue: Number.isFinite(durationValue) && durationValue > 0 ? Math.trunc(durationValue) : "",
    durationUnit,
  };
}

function normalizeConfig(value) {
  const result = defaultConfig();
  for (const degree of DEGREES) {
    for (const recipient of RECIPIENTS) {
      const source = value?.[degree]?.[recipient] ?? {};
      result[degree][recipient] = {
        enabled: source.enabled === true,
        damage: String(source.damage ?? "").trim(),
        effects: (Array.isArray(source.effects) ? source.effects : [])
          .map(normalizeEffect)
          .filter((effect) => effect.uuid),
        immunity: normalizeImmunity(source.immunity),
      };
    }
  }
  const aura = value?.aura ?? {};
  result.aura = {
    enabled: aura.enabled === true,
    radius: Math.max(1, Number(aura.radius) || 10),
    targets: ["enemies", "allies", "all"].includes(aura.targets) ? aura.targets : "enemies",
    triggers: {
      enters: aura.triggers?.enters === true,
      startTurn: aura.triggers?.startTurn === true,
      endTurn: aura.triggers?.endTurn === true,
    },
  };
  return result;
}

function getConfig(item) {
  return normalizeConfig(item?.getFlag?.(MODULE_ID, FLAG_KEY));
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.DegreeOfSuccess.FeatureLabel`,
  render: renderControls,
  activateListeners,
  cleanup: async ({ item }) => item.unsetFlag(MODULE_ID, FLAG_KEY),
});

Hooks.on("createChatMessage", (message) => {
  if (!shouldProcessMessage(message)) return;
  void processRollMessage(message).catch((error) => {
    console.error(`${MODULE_ID} | Degree of success automation failed`, error);
  });
});

// PF2e Toolbelt's Target Helper rolls saves with createMessage: false, so the
// regular createChatMessage hook above never sees them. Toolbelt exposes the
// completed, uncreated roll message through this hook instead.
Hooks.on("pf2e-toolbelt.rollSave", ({ message, rollMessage, target, data } = {}) => {
  if (!message || !rollMessage || !target?.actor) return;
  void processRollMessage(rollMessage, {
    automationMessage: message,
    outcome: data?.success,
    sourceActor: message.actor,
    targetActor: target.actor,
  }).catch((error) => {
    console.error(`${MODULE_ID} | Toolbelt degree of success automation failed`, error);
  });
});

// Rerolls are stored back on the Target Helper card and do not emit rollSave a
// second time. data.success is Toolbelt's outcome for the roll it actually kept.
Hooks.on("pf2e-toolbelt.rerollSave", ({ message, target, data } = {}) => {
  if (!message || !target?.actor) return;
  void processRollMessage(message, {
    outcome: data?.success,
    sourceActor: message.actor,
    targetActor: target.actor,
  }).catch((error) => {
    console.error(`${MODULE_ID} | Toolbelt reroll degree of success automation failed`, error);
  });
});

function renderControls({ item }) {
  const config = getConfig(item);
  const degreeHtml = DEGREES.map((degree) => {
    const recipients = RECIPIENTS.map((recipient) => {
      const data = config[degree][recipient];
      const effects = data.effects.map((effect, index) => `
        <div class="tsu-dos-effect" data-effect-index="${index}" title="${escapeHtml(effect.uuid)}">
          <div class="tsu-dos-effect-name">
            <img src="${escapeHtml(effect.img)}" alt="" width="22" height="22">
            <span>${escapeHtml(effect.name)}</span>
            <button type="button" data-action="remove-effect" data-degree="${degree}" data-recipient="${recipient}" data-effect-index="${index}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="tsu-dos-effect-fields">
            <label data-tooltip="${escapeHtml(localize("Value"))}">
              <i class="fas fa-arrow-up-1-9"></i>
              <input type="number" min="1" step="1" data-effect-field="value" value="${effect.value}" placeholder="—" aria-label="${escapeHtml(localize("Value"))}">
            </label>
            <i class="far fa-clock" data-tooltip="${escapeHtml(localize("Time"))}"></i>
            <input type="number" min="1" step="1" data-effect-field="durationValue" value="${effect.durationValue}" aria-label="${escapeHtml(localize("Time"))}">
            <select data-effect-field="durationUnit" aria-label="${escapeHtml(localize("Time"))}">
              ${["unlimited", "rounds", "minutes", "hours", "days"].map((unit) => `
                <option value="${unit}" ${effect.durationUnit === unit ? "selected" : ""}>${escapeHtml(localize(`DurationUnits.${unit}`))}</option>
              `).join("")}
            </select>
          </div>
        </div>`).join("");

      return `
        <section class="tsu-dos-recipient ${data.enabled ? "is-enabled" : ""}" data-degree="${degree}" data-recipient="${recipient}">
          <label class="tsu-dos-recipient-title">
            <input type="checkbox" data-field="enabled" ${data.enabled ? "checked" : ""}>
            ${escapeHtml(localize(recipient === "target" ? "Target" : "Source"))}
          </label>
          <label class="tsu-dos-damage">
            <i class="fas fa-burst"></i> ${escapeHtml(localize("Damage"))}
            <input type="text" data-field="damage" value="${escapeHtml(data.damage)}" placeholder="3d6[fire]">
          </label>
          <div class="tsu-dos-immunity">
            <label><input type="checkbox" data-immunity-field="enabled" ${data.immunity.enabled ? "checked" : ""}> ${escapeHtml(localize("Immunity"))}</label>
            <input type="number" min="1" step="1" data-immunity-field="durationValue" value="${data.immunity.durationValue}" aria-label="${escapeHtml(localize("Time"))}">
            <select data-immunity-field="durationUnit">${DURATION_UNITS.map((unit) => `<option value="${unit}" ${data.immunity.durationUnit === unit ? "selected" : ""}>${escapeHtml(localize(`DurationUnits.${unit}`))}</option>`).join("")}</select>
            <select data-immunity-field="scope"><option value="ability" ${data.immunity.scope === "ability" ? "selected" : ""}>${escapeHtml(localize("ImmunityAbility"))}</option><option value="source" ${data.immunity.scope === "source" ? "selected" : ""}>${escapeHtml(localize("ImmunitySource"))}</option></select>
          </div>
          <div class="tsu-dos-effects">${effects}</div>
          <div class="tsu-dos-drop" data-drop-zone>${escapeHtml(localize("DropHint"))}</div>
        </section>`;
    }).join("");

    return `
      <details class="tsu-dos-degree" ${config[degree].target.enabled || config[degree].source.enabled ? "open" : ""}>
        <summary>${escapeHtml(localize(`Degrees.${degree}`))}</summary>
        <div class="tsu-dos-grid">${recipients}</div>
      </details>`;
  }).join("");

  const aura = config.aura;
  return `<div class="tsu-degree-of-success" data-item-id="${item.id}">
    <p class="hint">${escapeHtml(localize("Hint"))}</p>
    <fieldset class="tsu-dos-aura">
      <legend><label><input type="checkbox" data-aura-field="enabled" ${aura.enabled ? "checked" : ""}> ${escapeHtml(localize("Aura"))}</label></legend>
      <label>${escapeHtml(localize("AuraRadius"))} <input type="number" min="1" data-aura-field="radius" value="${aura.radius}"></label>
      <label>${escapeHtml(localize("AuraTargets"))}
        <select data-aura-field="targets"><option value="enemies" ${aura.targets === "enemies" ? "selected" : ""}>${escapeHtml(localize("AuraEnemies"))}</option><option value="allies" ${aura.targets === "allies" ? "selected" : ""}>${escapeHtml(localize("AuraAllies"))}</option><option value="all" ${aura.targets === "all" ? "selected" : ""}>${escapeHtml(localize("AuraAll"))}</option></select>
      </label>
      <span class="tsu-dos-aura-label">${escapeHtml(localize("AuraTriggers"))}</span>
      <label><input type="checkbox" data-aura-trigger="enters" ${aura.triggers.enters ? "checked" : ""}> ${escapeHtml(localize("AuraEnters"))}</label>
      <label><input type="checkbox" data-aura-trigger="startTurn" ${aura.triggers.startTurn ? "checked" : ""}> ${escapeHtml(localize("AuraStartTurn"))}</label>
      <label><input type="checkbox" data-aura-trigger="endTurn" ${aura.triggers.endTurn ? "checked" : ""}> ${escapeHtml(localize("AuraEndTurn"))}</label>
    </fieldset>
    ${degreeHtml}
  </div>`;
}

function activateListeners({ html, item }) {
  const panel = html.querySelector(`.tsu-degree-of-success[data-item-id="${item.id}"]`);
  if (!panel) return;

  const saveField = async (element) => {
    const section = element.closest(".tsu-dos-recipient");
    if (!section) return;
    const config = getConfig(item);
    const data = config[section.dataset.degree]?.[section.dataset.recipient];
    if (!data) return;
    if (element.dataset.field === "enabled") data.enabled = element.checked;
    if (element.dataset.field === "damage") data.damage = String(element.value ?? "").trim();
    await item.setFlag(MODULE_ID, FLAG_KEY, config);
  };

  for (const checkbox of panel.querySelectorAll('[data-field="enabled"]')) {
    checkbox.addEventListener("change", (event) => void saveField(event.currentTarget));
  }
  for (const input of panel.querySelectorAll('[data-field="damage"]')) {
    input.addEventListener("change", (event) => void saveField(event.currentTarget));
  }
  for (const field of panel.querySelectorAll("[data-immunity-field]")) {
    field.addEventListener("change", async (event) => {
      const element = event.currentTarget;
      const section = element.closest(".tsu-dos-recipient");
      const config = getConfig(item);
      const immunity = config[section?.dataset.degree]?.[section?.dataset.recipient]?.immunity;
      if (!immunity) return;
      const key = element.dataset.immunityField;
      if (key === "enabled") immunity.enabled = element.checked;
      else if (key === "durationValue") immunity.durationValue = Math.max(1, Math.trunc(Number(element.value) || 1));
      else if (key === "durationUnit") immunity.durationUnit = DURATION_UNITS.includes(element.value) ? element.value : "rounds";
      else if (key === "scope") immunity.scope = element.value === "source" ? "source" : "ability";
      await item.setFlag(MODULE_ID, FLAG_KEY, config);
    });
  }
  for (const field of panel.querySelectorAll("[data-aura-field], [data-aura-trigger]")) {
    field.addEventListener("change", async (event) => {
      const element = event.currentTarget;
      const config = getConfig(item);
      if (element.dataset.auraTrigger) config.aura.triggers[element.dataset.auraTrigger] = element.checked;
      else if (element.dataset.auraField === "enabled") config.aura.enabled = element.checked;
      else if (element.dataset.auraField === "radius") config.aura.radius = Math.max(1, Number(element.value) || 10);
      else if (element.dataset.auraField === "targets") config.aura.targets = element.value;
      await item.setFlag(MODULE_ID, FLAG_KEY, config);
    });
  }
  for (const field of panel.querySelectorAll("[data-effect-field]")) {
    field.addEventListener("change", async (event) => {
      const element = event.currentTarget;
      const effectElement = element.closest(".tsu-dos-effect");
      const section = element.closest(".tsu-dos-recipient");
      if (!effectElement || !section) return;
      const config = getConfig(item);
      const effect = config[section.dataset.degree]?.[section.dataset.recipient]?.effects?.[Number(effectElement.dataset.effectIndex)];
      if (!effect) return;
      if (element.dataset.effectField === "value") {
        effect.value = element.value === "" ? "" : Math.max(1, Math.trunc(Number(element.value) || 1));
      } else if (element.dataset.effectField === "durationValue") {
        effect.durationValue = Number(element.value) > 0 ? Math.trunc(Number(element.value)) : "";
      } else if (element.dataset.effectField === "durationUnit") {
        effect.durationUnit = element.value;
        if (element.value === "unlimited") effect.durationValue = "";
      }
      await item.setFlag(MODULE_ID, FLAG_KEY, config);
    });
  }
  for (const button of panel.querySelectorAll('[data-action="remove-effect"]')) {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      const config = getConfig(item);
      const effects = config[target.dataset.degree]?.[target.dataset.recipient]?.effects;
      if (!effects) return;
      effects.splice(Number(target.dataset.effectIndex), 1);
      await item.setFlag(MODULE_ID, FLAG_KEY, config);
    });
  }
  for (const zone of panel.querySelectorAll("[data-drop-zone]")) {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragover");
      const dropped = await resolveDroppedItem(event);
      if (!dropped || !["condition", "effect"].includes(dropped.type)) {
        ui.notifications.warn(localize("OnlyEffectsWarning"));
        return;
      }
      const section = zone.closest(".tsu-dos-recipient");
      const config = getConfig(item);
      const effects = config[section.dataset.degree][section.dataset.recipient].effects;
      if (!effects.some((entry) => entry.uuid === dropped.uuid)) {
        effects.push({
          uuid: dropped.uuid,
          name: dropped.name,
          img: dropped.img,
          value: "",
          durationValue: "",
          durationUnit: "unlimited",
        });
        await item.setFlag(MODULE_ID, FLAG_KEY, config);
      }
    });
  }
}

async function resolveDroppedItem(event) {
  try {
    const data = TextEditor.getDragEventData(event);
    const uuid = data.uuid ?? (data.type === "Item" && data.id ? `Item.${data.id}` : "");
    const item = uuid ? await fromUuid(uuid) : null;
    return item?.documentName === "Item" ? item : null;
  } catch {
    return null;
  }
}

function shouldProcessMessage(message) {
  if (!message?.isRoll) return false;
  const activeGM = game.users?.activeGM;
  if (activeGM) return game.user.id === activeGM.id;
  return message.isAuthor;
}

function getContext(message) {
  return message.flags?.pf2e?.context ?? message.getFlag?.("pf2e", "context") ?? {};
}

function normalizeOutcome(value) {
  const key = String(value ?? "").replace(/[\s_-]/g, "").toLowerCase();
  return ({
    criticalsuccess: "criticalSuccess",
    success: "success",
    failure: "failure",
    criticalfailure: "criticalFailure",
  })[key] ?? null;
}

function actorFromReference(reference) {
  if (!reference) return null;
  if (typeof reference === "object" && reference.documentName === "Actor") return reference;
  const actorUuid = typeof reference === "string"
    ? reference
    : reference.actor ?? reference.actorUuid ?? reference.uuid ?? reference.token ?? reference.tokenUuid;
  if (!actorUuid) return null;
  const id = String(actorUuid).split(".").at(-1);
  return game.actors.get(id)
    ?? canvas.tokens?.placeables.find((token) => (
      token.id === id
      || token.document?.uuid === actorUuid
      || token.actor?.uuid === actorUuid
    ))?.actor
    ?? null;
}

async function documentFromReference(reference) {
  if (!reference) return null;
  if (typeof reference === "object" && reference.documentName) return reference;
  const uuid = typeof reference === "string" ? reference : reference.uuid ?? reference.item ?? reference.itemUuid;
  if (!uuid) return null;
  try { return await fromUuid(uuid); } catch { return null; }
}

async function resolveAutomation(message) {
  const context = getContext(message);
  const origin = context.origin ?? message.flags?.pf2e?.origin ?? {};
  const toolbelt = message.flags?.["pf2e-toolbelt"]?.targetHelper ?? {};
  const originActor = actorFromReference(origin.actor ?? origin.actorUuid);
  const rollerActor = message.actor ?? actorFromReference(message.speaker?.actor);
  const actors = [originActor, rollerActor].filter(Boolean);
  const candidates = [message.item, origin.item, origin.itemUuid, context.item, context.itemUuid, toolbelt.item];
  for (const candidate of candidates) {
    const rawId = typeof candidate === "string" && !candidate.includes(".") ? candidate : null;
    const item = (rawId ? actors.map((actor) => actor.items?.get(rawId)).find(Boolean) : null)
      ?? await documentFromReference(candidate);
    if (item?.type === "action" && item.getFlag?.(MODULE_ID, FLAG_KEY)) return item;
  }

  const options = Array.isArray(context.options) ? context.options : [];
  const slug = options.find((option) => String(option).startsWith("item:slug:"))?.slice(10)
    ?? context.action ?? context.slug;
  if (!slug) return null;
  return actors.flatMap((actor) => actor.itemTypes?.action ?? [])
    .find((item) => (item.slug ?? item.system?.slug) === slug && item.getFlag?.(MODULE_ID, FLAG_KEY)) ?? null;
}

async function processRollMessage(message, overrides = {}) {
  const automationMessage = overrides.automationMessage ?? message;
  const outcome = normalizeOutcome(overrides.outcome ?? getContext(message).outcome ?? message.flags?.pf2e?.context?.outcome);
  if (!outcome) return;
  const item = await resolveAutomation(automationMessage) ?? await resolveAutomation(message);
  if (!item) return;

  const context = getContext(message);
  const origin = context.origin ?? message.flags?.pf2e?.origin ?? {};
  const roller = message.actor ?? actorFromReference(message.speaker?.actor);
  const originActor = actorFromReference(origin.actor ?? origin.actorUuid) ?? item.actor;
  const explicitTarget = actorFromReference(context.target ?? context.target?.actor ?? context.target?.actorUuid);
  const isSave = String(context.type ?? "").toLowerCase().includes("save")
    || (Array.isArray(context.domains) && context.domains.some((domain) => String(domain).includes("saving-throw")));
  const sourceActor = overrides.sourceActor ?? (isSave ? originActor : roller);
  const targetActor = overrides.targetActor ?? (isSave ? roller : explicitTarget);
  if (!sourceActor || !targetActor) return;
  const sourceTokenUuid = overrides.sourceTokenUuid
    ?? (typeof origin.token === "string" ? origin.token : origin.token?.uuid)
    ?? item.actor?.getActiveTokens?.(true, true)?.[0]?.document?.uuid
    ?? null;
  if (hasDegreeImmunity(targetActor, item.uuid, sourceTokenUuid)) return;

  const degreeConfig = getConfig(item)[outcome];
  await applyRecipient(degreeConfig.target, targetActor, sourceActor, item, outcome, "target", sourceTokenUuid);
  await applyRecipient(degreeConfig.source, sourceActor, sourceActor, item, outcome, "source", sourceTokenUuid);
}

async function applyRecipient(config, actor, speakerActor, item, outcome, recipient, sourceTokenUuid) {
  if (!config?.enabled || !actor?.canUserModify?.(game.user, "update")) return;
  if (config.damage) await rollDamage(config.damage, actor, speakerActor, item, outcome, recipient);
  for (const effect of config.effects) await applyEffect(effect, actor);
  if (config.immunity?.enabled) await applyDegreeImmunity(config.immunity, actor, item, sourceTokenUuid);
}

async function rollDamage(formula, actor, speakerActor, item, outcome, recipient) {
  const DamageRoll = game.pf2e?.DamageRoll ?? CONFIG.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll");
  if (!DamageRoll) {
    console.warn(`${MODULE_ID} | PF2E DamageRoll is unavailable`);
    return;
  }
  try {
    const roll = await new DamageRoll(formula).evaluate();
    const token = actor.getActiveTokens?.(true, true)?.[0] ?? null;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: speakerActor }),
      flavor: `${item.name} — ${localize(`Degrees.${outcome}`)} (${localize(recipient === "target" ? "Target" : "Source")})`,
      flags: {
        [MODULE_ID]: { degreeOfSuccessDamage: true },
        pf2e: { context: { type: "damage-roll", target: { actor: actor.uuid, token: token?.document?.uuid ?? null } } },
      },
    });
  } catch (error) {
    ui.notifications.error(game.i18n.format(`${I18N_PREFIX}.ActionPlus.DegreeOfSuccess.InvalidDamage`, { formula }));
    console.error(`${MODULE_ID} | Invalid degree-of-success damage formula: ${formula}`, error);
  }
}

async function applyEffect(reference, actor) {
  const source = await documentFromReference(reference.uuid);
  if (!source || !["condition", "effect"].includes(source.type)) return;
  const durationUnit = reference.durationUnit ?? "unlimited";
  const durationValue = Number(reference.durationValue);
  if (source.type === "condition" && durationUnit !== "unlimited") {
    const value = reference.value === "" || reference.value == null ? null : Math.max(1, Math.trunc(Number(reference.value) || 1));
    const grant = { key: "GrantItem", uuid: source.uuid, onDeleteActions: { grantee: "restrict" } };
    if (value) grant.alterations = [{ mode: "override", property: "badge-value", value }];
    const wrapper = {
      name: source.name,
      type: "effect",
      img: source.img,
      system: {
        description: { value: source.system?.description?.value ?? "" },
        duration: { unit: durationUnit, value: Math.max(1, Math.trunc(durationValue) || 1), expiry: "turn-start", sustained: false },
        level: { value: 1 }, rules: [grant], slug: null, tokenIcon: { show: true }, traits: { value: [] }, unidentified: false,
      },
    };
    await actor.createEmbeddedDocuments("Item", [wrapper]);
    return;
  }
  const data = source.toObject();
  delete data._id;
  if (foundry.utils.hasProperty(data, "system.value.value")) {
    const requested = reference.value === "" || reference.value == null ? null : Math.max(1, Math.trunc(Number(reference.value) || 1));
    const existing = actor.getCondition?.(source.slug) ?? null;
    const current = existing?.value ?? 0;
    if (requested === null && existing) return;
    if (requested !== null && current >= requested) return;
    if (requested !== null && existing && !existing.isLocked) {
      await game.pf2e.ConditionManager.updateConditionValue(existing.id, actor, requested);
      return;
    }
    foundry.utils.setProperty(data, "system.value.value", requested);
  }
  foundry.utils.setProperty(data, "system.duration.unit", durationUnit);
  foundry.utils.setProperty(data, "system.duration.value", durationUnit === "unlimited" || !Number.isFinite(durationValue)
    ? -1
    : Math.max(1, Math.trunc(durationValue)));
  foundry.utils.setProperty(data, "system.duration.expiry", durationUnit === "unlimited" ? null : "turn-start");
  await actor.createEmbeddedDocuments("Item", [data]);
}

function immunityData(effect) {
  return effect?.getFlag?.(MODULE_ID, IMMUNITY_FLAG) ?? null;
}

function hasDegreeImmunity(actor, actionUuid, sourceTokenUuid = null) {
  return (actor?.itemTypes?.effect ?? []).some((effect) => {
    const immunity = immunityData(effect);
    return immunity?.actionUuid === actionUuid
      && (immunity.scope !== "source" || immunity.sourceTokenUuid === sourceTokenUuid);
  });
}

function getManualImmunityConfig(item) {
  const config = getConfig(item);
  for (const degree of DEGREES) {
    const recipient = config[degree]?.target;
    if (recipient?.enabled && recipient.immunity?.enabled) return recipient.immunity;
  }
  return null;
}

function manualImmunityActors(message) {
  const controlled = (canvas.tokens?.controlled ?? []).map((token) => token.actor).filter(Boolean);
  const targeted = [...(game.user?.targets ?? [])].map((token) => token.actor).filter(Boolean);
  const messageTargets = game.toolbelt?.targetHelper?.getMessageTargets?.(message) ?? [];
  const fromMessage = messageTargets.map((target) => target.actor ?? target.document?.actor).filter(Boolean);
  const preferred = controlled.length ? controlled : targeted.length ? targeted : fromMessage;
  return [...new Map(preferred.map((actor) => [actor.uuid, actor])).values()];
}

async function applyDegreeImmunity(config, actor, item, sourceTokenUuid) {
  const scope = config.scope === "source" ? "source" : "ability";
  const existing = (actor.itemTypes?.effect ?? []).find((effect) => {
    const immunity = immunityData(effect);
    return immunity?.actionUuid === item.uuid && immunity.scope === scope
      && (scope !== "source" || immunity.sourceTokenUuid === sourceTokenUuid);
  });
  const duration = {
    unit: config.durationUnit,
    value: config.durationUnit === "unlimited" ? -1 : Math.max(1, Number(config.durationValue) || 1),
    expiry: config.durationUnit === "unlimited" ? null : "turn-start",
    sustained: false,
  };
  if (existing) {
    await existing.update({ "system.duration": duration, "system.start.value": game.time.worldTime, "system.start.initiative": actor.combatant?.initiative ?? null });
    return;
  }
  const source = {
    name: `${localize("Immunity")}: ${item.name}`,
    type: "effect",
    img: item.img,
    system: {
      description: { value: localize(scope === "source" ? "ImmunitySource" : "ImmunityAbility") },
      duration,
      level: { value: 1 }, rules: [], slug: null, tokenIcon: { show: true }, traits: { value: [] }, unidentified: false,
      start: { value: game.time.worldTime, initiative: actor.combatant?.initiative ?? null },
    },
    flags: { [MODULE_ID]: { [IMMUNITY_FLAG]: { actionUuid: item.uuid, scope, sourceTokenUuid: scope === "source" ? sourceTokenUuid : null } } },
  };
  await actor.createEmbeddedDocuments("Item", [source]);
}

function isAutomationCoordinator(userId = null) {
  const activeGM = game.users?.activeGM;
  return activeGM ? game.user.id === activeGM.id : userId ? game.user.id === userId : true;
}

function tokenCenter(token) {
  const size = canvas.grid?.size ?? 100;
  return {
    x: Number(token.x) + Number(token.width ?? 1) * size / 2,
    y: Number(token.y) + Number(token.height ?? 1) * size / 2,
  };
}

function tokenDistance(source, target) {
  const a = tokenCenter(source); const b = tokenCenter(target);
  const pixels = Math.hypot(a.x - b.x, a.y - b.y);
  return pixels / (canvas.grid?.size ?? 100) * (canvas.scene?.grid?.distance ?? 5);
}

function auraAcceptsTarget(sourceActor, targetActor, mode) {
  if (!targetActor || sourceActor === targetActor || targetActor.isDead) return false;
  if (mode === "all") return true;
  const sameAlliance = sourceActor.alliance != null && sourceActor.alliance === targetActor.alliance;
  return mode === "allies" ? sameAlliance : !sameAlliance;
}

function auraSources(scene = canvas.scene) {
  const sources = [];
  for (const token of scene?.tokens ?? []) {
    const actor = token.actor; if (!actor) continue;
    for (const item of actor.itemTypes?.action ?? []) {
      const rawConfig = item.getFlag?.(MODULE_ID, FLAG_KEY);
      if (!rawConfig) continue;
      const config = normalizeConfig(rawConfig);
      if (config.aura.enabled) sources.push({ token, actor, item, config: config.aura });
    }
  }
  return sources;
}

function targetsInsideAura(source) {
  return (canvas.scene?.tokens ?? []).filter((target) => target !== source.token
    && auraAcceptsTarget(source.actor, target.actor, source.config.targets)
    && tokenDistance(source.token, target) <= source.config.radius);
}

async function postAuraMessage(source, targets, trigger) {
  if (!targets.length) return;
  const effective = targets.filter((target) => !hasDegreeImmunity(target.actor, source.item.uuid, source.token.uuid));
  if (!effective.length) return;
  const draft = await source.item.toMessage(null, { create: false });
  if (!draft) return;
  const data = draft.toObject(); delete data._id;
  data.speaker = ChatMessage.getSpeaker({ actor: source.actor, token: source.token.object });
  data.content += `<div class="tsu-dos-aura-targets"><strong>${escapeHtml(localize(`AuraTrigger.${trigger}`))}</strong>: ${targets.map((target) => `${escapeHtml(target.name)}${hasDegreeImmunity(target.actor, source.item.uuid, source.token.uuid) ? ` <span class="tsu-dos-immune">${escapeHtml(localize("Immune"))}</span>` : ""}`).join(", ")}</div>`;
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.degreeOfSuccessAura`, { trigger, sourceTokenUuid: source.token.uuid });
  game.toolbelt?.targetHelper?.setMessageFlagTargets?.(data, targets.map((target) => target.uuid));
  await ChatMessage.create(data);
}

const auraMembership = new Map();

function auraKey(source) {
  return `${canvas.scene?.id}:${source.token.id}:${source.item.uuid}`;
}

function seedAuraMembership() {
  auraMembership.clear();
  for (const source of auraSources()) auraMembership.set(auraKey(source), new Set(targetsInsideAura(source).map((target) => target.id)));
}

Hooks.on("canvasReady", seedAuraMembership);
for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (item) => {
    if (item?.type === "action" && item.actor?.getActiveTokens?.().length) seedAuraMembership();
  });
}

Hooks.on("updateToken", (token, changed, _options, userId) => {
  if (!("x" in changed || "y" in changed || "elevation" in changed) || token.parent !== canvas.scene || !isAutomationCoordinator(userId)) return;
  void (async () => {
    for (const source of auraSources()) {
      if (!source.config.triggers.enters) continue;
      const key = auraKey(source);
      const currentTargets = targetsInsideAura(source);
      const current = new Set(currentTargets.map((target) => target.id));
      const previous = auraMembership.get(key) ?? current;
      auraMembership.set(key, current);
      const entered = currentTargets.filter((target) => !previous.has(target.id));
      if (entered.length) await postAuraMessage(source, entered, "enters");
    }
  })().catch((error) => console.error(`${MODULE_ID} | Degree aura movement failed`, error));
});

async function handleAuraTurn(combatant, trigger) {
  if (!combatant?.token || !isAutomationCoordinator()) return;
  for (const source of auraSources(combatant.token.parent)) {
    if (!source.config.triggers[trigger] || source.token === combatant.token) continue;
    if (targetsInsideAura(source).some((target) => target === combatant.token)) await postAuraMessage(source, [combatant.token], trigger);
  }
}

Hooks.on("pf2e.startTurn", (combatant) => void handleAuraTurn(combatant, "startTurn").catch((error) => console.error(`${MODULE_ID} | Degree aura turn-start failed`, error)));
Hooks.on("pf2e.endTurn", (combatant) => void handleAuraTurn(combatant, "endTurn").catch((error) => console.error(`${MODULE_ID} | Degree aura turn-end failed`, error)));

Hooks.on("renderChatMessageHTML", (message, html) => {
  requestAnimationFrame(() => void (async () => {
    const item = await resolveAutomation(message); if (!item) return;
    const context = getContext(message);
    const origin = context.origin ?? message.flags?.pf2e?.origin ?? {};
    const speakerToken = message.speaker?.token ? canvas.tokens?.get(message.speaker.token)?.document?.uuid : null;
    const sourceTokenUuid = message.getFlag?.(MODULE_ID, "degreeOfSuccessAura")?.sourceTokenUuid
      ?? (typeof origin.token === "string" ? origin.token : origin.token?.uuid)
      ?? speakerToken
      ?? null;
    const manualImmunity = getManualImmunityConfig(item);
    const messageContent = html.querySelector(".message-content") ?? html.querySelector(".card-content") ?? html;
    if (manualImmunity && !message.getFlag?.(MODULE_ID, "degreeOfSuccessDamage") && !messageContent.querySelector("[data-tsu-grant-immunity]")) {
      messageContent.insertAdjacentHTML("beforeend", `<div class="tsu-dos-manual-immunity"><button type="button" data-tsu-grant-immunity><i class="fas fa-shield-halved"></i> ${escapeHtml(localize("ManualImmunity"))}</button></div>`);
      messageContent.querySelector("[data-tsu-grant-immunity]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const actors = manualImmunityActors(message).filter((actor) => actor.canUserModify?.(game.user, "update"));
        if (!actors.length) {
          ui.notifications.warn(localize("ManualImmunityNoTargets"));
          return;
        }
        button.disabled = true;
        try {
          for (const actor of actors) await applyDegreeImmunity(manualImmunity, actor, item, sourceTokenUuid);
          ui.notifications.info(game.i18n.format(`${I18N_PREFIX}.ActionPlus.DegreeOfSuccess.ManualImmunityGranted`, { count: actors.length }));
        } finally {
          button.disabled = false;
        }
      });
    }
    if (!game.toolbelt?.targetHelper?.getMessageTargets) return;
    const targets = game.toolbelt.targetHelper.getMessageTargets(message) ?? [];
    const unused = [...targets];
    for (const row of html.querySelectorAll(".pf2e-toolbelt-target-targetRows .target-row")) {
      const name = row.querySelector(".target-header .name")?.textContent?.trim();
      const index = unused.findIndex((target) => target.name === name);
      const target = index >= 0 ? unused.splice(index, 1)[0] : null;
      if (!target?.actor || !hasDegreeImmunity(target.actor, item.uuid, sourceTokenUuid)) continue;
      row.classList.add("tsu-dos-is-immune");
      const controls = row.querySelector(".target-header .controls");
      controls?.querySelector('[data-action="roll-save"]')?.setAttribute("hidden", "hidden");
      if (controls && !controls.querySelector(".tsu-dos-immune")) controls.insertAdjacentHTML("afterbegin", `<span class="tsu-dos-immune">${escapeHtml(localize("Immune"))}</span>`);
    }
  })().catch((error) => console.error(`${MODULE_ID} | Immunity badge rendering failed`, error)));
});
