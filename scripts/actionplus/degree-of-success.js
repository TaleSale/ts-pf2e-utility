import { escapeHtml, I18N_PREFIX, MODULE_ID } from "../core.js";
import { registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "degreeOfSuccess";
const FLAG_KEY = "degreeOfSuccess";
const DEGREES = ["criticalSuccess", "success", "failure", "criticalFailure"];
const RECIPIENTS = ["target", "source"];

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.ActionPlus.DegreeOfSuccess.${key}`);
}

function defaultRecipient() {
  return { enabled: false, damage: "", effects: [] };
}

function defaultConfig() {
  return Object.fromEntries(DEGREES.map((degree) => [degree, {
    target: defaultRecipient(),
    source: defaultRecipient(),
  }]));
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
      };
    }
  }
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

  return `<div class="tsu-degree-of-success" data-item-id="${item.id}">
    <p class="hint">${escapeHtml(localize("Hint"))}</p>
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

  const degreeConfig = getConfig(item)[outcome];
  await applyRecipient(degreeConfig.target, targetActor, sourceActor, item, outcome, "target");
  await applyRecipient(degreeConfig.source, sourceActor, sourceActor, item, outcome, "source");
}

async function applyRecipient(config, actor, speakerActor, item, outcome, recipient) {
  if (!config?.enabled || !actor?.canUserModify?.(game.user, "update")) return;
  if (config.damage) await rollDamage(config.damage, actor, speakerActor, item, outcome, recipient);
  for (const effect of config.effects) await applyEffect(effect, actor);
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
  const data = source.toObject();
  delete data._id;
  if (foundry.utils.hasProperty(data, "system.value.value")) {
    const value = reference.value === "" || reference.value == null
      ? null
      : Math.max(1, Math.trunc(Number(reference.value) || 1));
    foundry.utils.setProperty(data, "system.value.value", value);
  }
  const durationUnit = reference.durationUnit ?? "unlimited";
  const durationValue = Number(reference.durationValue);
  foundry.utils.setProperty(data, "system.duration.unit", durationUnit);
  foundry.utils.setProperty(data, "system.duration.value", durationUnit === "unlimited" || !Number.isFinite(durationValue)
    ? -1
    : Math.max(1, Math.trunc(durationValue)));
  foundry.utils.setProperty(data, "system.duration.expiry", durationUnit === "unlimited" ? null : "turn-start");
  await actor.createEmbeddedDocuments("Item", [data]);
}
