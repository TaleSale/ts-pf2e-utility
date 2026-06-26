import { I18N_PREFIX, MODULE_ID } from "../core.js";
import { isActionPlusFeatureEnabled, isSupportedActionPlusItem, registerActionPlusFeature } from "./actionplus.js";

const FEATURE_ID = "regeneration";
const AUTOMATION_FLAG = "tsUtilityRegenerationAutomation";
const BLOCK_EFFECT_SLUG = "not-regen";
const BLOCK_EFFECT_PREDICATE = `self:effect:${BLOCK_EFFECT_SLUG}`;
const BLOCK_EFFECT_FLAG = "regenerationBlock";
const BLOCK_EFFECT_TURN_FLAG = "remainingOwnerTurnEnds";

function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

registerActionPlusFeature({
  id: FEATURE_ID,
  label: `${I18N_PREFIX}.ActionPlus.Regeneration.FeatureLabel`,
  render: renderRegenerationControls,
  activateListeners: activateRegenerationListeners,
  cleanup: cleanupRegeneration,
});

Hooks.on("createChatMessage", (message) => {
  debugDamageRollMessage(message);
  void handleDamageTakenMessage(message);
});

Hooks.on("pf2e.endTurn", (combatant) => {
  void handleOwnerTurnEnd(combatant);
});

Hooks.on("deleteCombat", (combat) => {
  void cleanupCombatEffects(combat);
});

Hooks.on("preUpdateItem", (item, changed) => {
  applyRegenerationRuleSyncToPendingUpdate(item, changed);
});

function renderRegenerationControls({ item }) {
  const rules = getRegenerationRules(item);
  const hasRules = rules.length > 0;
  const hasDeactivation = rules.some((rule) => getDeactivationEntries(rule).length > 0);
  const messageKey = !hasRules
    ? "ActionPlus.Regeneration.Messages.MissingRule"
    : !hasDeactivation
      ? "ActionPlus.Regeneration.Messages.MissingTriggers"
      : "ActionPlus.Regeneration.Messages.Ready";

  return `
    <div style="margin-top: 10px; padding: 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.05);">
      <p style="margin: 0 0 6px 0;"><strong>${localize("ActionPlus.Regeneration.HintTitle")}</strong></p>
      <p style="margin: 0;">${localize(messageKey)}</p>
    </div>
  `;
}

function activateRegenerationListeners({ item }) {
  ensureRegenerationRulesCurrent(item);
}

async function cleanupRegeneration({ item }) {
  await updateRegenerationRules(item, { enabled: false });
}

function getRegenerationRules(item) {
  return (item.system.rules ?? []).filter((rule) => (
    rule?.key === "FastHealing" && rule?.type === "regeneration"
  ));
}

function getDeactivationEntries(rule) {
  const values = Array.isArray(rule?.deactivatedBy) ? rule.deactivatedBy : [];
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function clonePredicate(rule) {
  return foundry.utils.deepClone(rule?.predicate);
}

function areDeeplyEqual(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left === right;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((entry, index) => areDeeplyEqual(entry, right[index]));
  }

  if (typeof left === "object" || typeof right === "object") {
    if (typeof left !== "object" || typeof right !== "object") return false;

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) => (
      Object.hasOwn(right, key) && areDeeplyEqual(left[key], right[key])
    ));
  }

  return false;
}

function normalizePredicateStatements(value) {
  if (Array.isArray(value)) return foundry.utils.deepClone(value);

  if (value && typeof value === "object") return [foundry.utils.deepClone(value)];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function hasAutomationPredicate(rule) {
  return predicateHasAutomation(rule?.predicate);
}

function predicateHasAutomation(predicate) {
  if (Array.isArray(predicate)) {
    return predicate.some((entry) => predicateHasAutomation(entry));
  }

  if (typeof predicate === "string") {
    return predicate.trim() === BLOCK_EFFECT_PREDICATE;
  }

  if (!predicate || typeof predicate !== "object") return false;

  const notEntries = Array.isArray(predicate.not)
    ? predicate.not
    : typeof predicate.not === "string"
      ? [predicate.not]
      : [];
  if (notEntries.includes(BLOCK_EFFECT_PREDICATE)) return true;

  return Object.values(predicate).some((entry) => predicateHasAutomation(entry));
}

function addAutomationPredicate(predicate) {
  const nextPredicate = removeAutomationPredicate(predicate) ?? [];
  nextPredicate.push({ not: BLOCK_EFFECT_PREDICATE });
  return nextPredicate;
}

function removeAutomationPredicate(predicate) {
  const statements = normalizePredicateStatements(predicate);
  const cleaned = statements
    .map((entry) => removeAutomationPredicateStatement(entry))
    .filter((entry) => entry !== null);
  return cleaned.length ? cleaned : null;
}

function removeAutomationPredicateStatement(statement) {
  if (Array.isArray(statement)) {
    const cleaned = statement
      .map((entry) => removeAutomationPredicateStatement(entry))
      .filter((entry) => entry !== null);
    return cleaned.length ? cleaned : null;
  }

  if (typeof statement === "string") {
    const trimmed = statement.trim();
    if (!trimmed || trimmed === BLOCK_EFFECT_PREDICATE) return null;
    return trimmed;
  }

  if (!statement || typeof statement !== "object") return null;

  const nextStatement = foundry.utils.deepClone(statement);
  if ("not" in nextStatement) {
    const notEntries = Array.isArray(nextStatement.not)
      ? nextStatement.not
      : typeof nextStatement.not === "string"
        ? [nextStatement.not]
        : [];
    const filteredNot = notEntries.filter((entry) => entry !== BLOCK_EFFECT_PREDICATE);
    if (filteredNot.length === 1) {
      [nextStatement.not] = filteredNot;
    } else if (filteredNot.length > 1) {
      nextStatement.not = filteredNot;
    } else {
      delete nextStatement.not;
    }
  }

  const cleanedEntries = Object.entries(nextStatement)
    .map(([key, value]) => [key, removeAutomationPredicateStatement(value)])
    .filter(([, value]) => value !== null);
  if (!cleanedEntries.length) return null;
  return Object.fromEntries(cleanedEntries);
}

function ensureRegenerationRulesCurrent(item) {
  updateRegenerationRules(item, { enabled: true }).catch((error) => {
    console.warn(`${MODULE_ID} | Failed to refresh regeneration automation`, error);
  });
}

function getItemSourceRules(item) {
  return foundry.utils.deepClone(item._source?.system?.rules ?? item.toObject()?.system?.rules ?? []);
}

function buildUpdatedRegenerationRules(existingRules, { enabled }) {
  let changed = false;

  const updatedRules = existingRules.map((rule) => {
    if (!(rule?.key === "FastHealing" && rule?.type === "regeneration")) return rule;

    const nextRule = foundry.utils.deepClone(rule);
    const predicate = clonePredicate(rule);
    const nextPredicate = enabled
      ? addAutomationPredicate(predicate)
      : removeAutomationPredicate(predicate);
    const predicateChanged = enabled
      ? !areDeeplyEqual(predicate, nextPredicate)
      : !areDeeplyEqual(predicate ?? null, nextPredicate ?? null);
    const hadDetails = "details" in nextRule;

    if (hadDetails) {
      delete nextRule.details;
      changed = true;
    }

    if (enabled) {
      nextRule.predicate = nextPredicate;
      nextRule[AUTOMATION_FLAG] = true;
      changed ||= !rule[AUTOMATION_FLAG] || !hasAutomationPredicate(rule) || predicateChanged;
    } else {
      if (nextPredicate) {
        nextRule.predicate = nextPredicate;
      } else if ("predicate" in nextRule) {
        delete nextRule.predicate;
      }
      if (AUTOMATION_FLAG in nextRule) delete nextRule[AUTOMATION_FLAG];
      changed ||= Boolean(rule[AUTOMATION_FLAG]) || hasAutomationPredicate(rule) || predicateChanged;
    }

    return nextRule;
  });

  return { changed, updatedRules };
}

function applyRegenerationRuleSyncToPendingUpdate(item, changed) {
  if (!isSupportedActionPlusItem(item)) return;
  if (!isActionPlusFeatureEnabled(item, FEATURE_ID, changed)) return;

  const existingRules = foundry.utils.deepClone(
    foundry.utils.getProperty(changed, "system.rules")
    ?? item._source?.system?.rules
    ?? [],
  );
  const { changed: rulesChanged, updatedRules } = buildUpdatedRegenerationRules(existingRules, { enabled: true });
  if (!rulesChanged) return;
  foundry.utils.setProperty(changed, "system.rules", updatedRules);
}

async function updateRegenerationRules(item, { enabled }) {
  const existingRules = getItemSourceRules(item);
  const { changed, updatedRules } = buildUpdatedRegenerationRules(existingRules, { enabled });

  if (!changed) return;
  await item.update({ "system.rules": updatedRules });
}

async function handleDamageTakenMessage(message) {
  const context = message?.flags?.pf2e?.context;
  const appliedDamage = message?.flags?.pf2e?.appliedDamage;

  if (context?.type !== "damage-taken" || !appliedDamage || appliedDamage.isHealing) return;
  if (!didApplyActorDamage(appliedDamage)) return;

  const actor = await fromUuid(appliedDamage.uuid).catch(() => null);
  if (!actor || game.user !== actor.primaryUpdater) return;

  const rollOptions = new Set(Array.isArray(context.options) ? context.options : []);
  for (const option of getDamageApplicationsOptions(message)) {
    rollOptions.add(option);
  }
  const damageRollOptions = getDamageRollOptionsBySignature(message);
  for (const option of damageRollOptions) {
    rollOptions.add(option);
  }
  if (!rollOptions.size) return;

  const enabledItems = actor.itemTypes.action.filter((item) => isActionPlusFeatureEnabled(item, FEATURE_ID));
  if (!enabledItems.length) return;

  const debugMatches = [];
  const shouldBlockRegeneration = enabledItems.some((item) => {
    const rules = getRegenerationRules(item);
    return rules.some((rule) => getDeactivationEntries(rule).some((entry) => {
      const matched = matchesDeactivationEntry(entry, rollOptions);
      debugMatches.push({
        item: item.name,
        entry,
        matched,
      });
      return matched;
    }));
  });

  console.debug(`${MODULE_ID} | Regeneration damage check`, {
    actor: actor.name,
    messageId: message?.id ?? null,
    origin: message?.flags?.pf2e?.origin ?? null,
    contextOptions: Array.isArray(context?.options) ? context.options : [],
    applicationOptions: getDamageApplicationsOptions(message),
    damageRollOptions,
    normalizedRollOptions: Array.from(getNormalizedRollOptions(rollOptions)),
    debugMatches,
    shouldBlockRegeneration,
  });

  if (!shouldBlockRegeneration) return;
  await applyRegenerationBlockEffect(actor);
}

function debugDamageRollMessage(message) {
  if (!message?.isDamageRoll) return;

  const roll = Array.isArray(message.rolls)
    ? message.rolls.find((candidate) => Array.isArray(candidate?.instances) && candidate.instances.length > 0)
    : null;
  if (!roll) return;

  const instances = roll.instances.map((instance) => ({
    type: instance?.type ?? null,
    persistent: instance?.persistent ?? false,
    materials: Array.isArray(instance?.materials) ? instance.materials : Array.from(instance?.materials ?? []),
    kinds: Array.isArray(instance?.kinds) ? instance.kinds : Array.from(instance?.kinds ?? []),
    formalDescription: Array.isArray(instance?.formalDescription)
      ? instance.formalDescription
      : Array.from(instance?.formalDescription ?? []),
  }));

  console.debug(`${MODULE_ID} | Damage roll instances`, {
    messageId: message.id ?? null,
    flavor: message.flavor ?? "",
    origin: message.flags?.pf2e?.origin ?? null,
    context: message.flags?.pf2e?.context ?? null,
    instances,
  });
}

function getDamageRollOptionsBySignature(message) {
  const originSignature = getDamageTakenOriginSignature(message);
  if (!originSignature) return [];

  const messages = game.messages?.contents ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidateMessage = messages[index];
    if (!candidateMessage?.isDamageRoll) continue;
    if (getDamageRollOriginSignature(candidateMessage) !== originSignature) continue;

    const roll = Array.isArray(candidateMessage.rolls)
      ? candidateMessage.rolls.find((candidate) => Array.isArray(candidate?.instances) && candidate.instances.length > 0)
      : null;
    if (!roll) return [];

    return roll.instances.flatMap((instance) => (
      Array.isArray(instance?.formalDescription)
        ? instance.formalDescription
        : Array.from(instance?.formalDescription ?? [])
    ))
      .map((entry) => String(entry ?? "").trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function getDamageRollOriginSignature(message) {
  const rollOptions = message?.flags?.pf2e?.origin?.rollOptions;
  if (!Array.isArray(rollOptions)) return null;

  const signature = rollOptions.find((option) => /^origin:signature:/i.test(String(option ?? "")));
  return signature ? String(signature).trim().toLowerCase() : null;
}

function getDamageTakenOriginSignature(message) {
  const options = message?.flags?.pf2e?.context?.options;
  if (!Array.isArray(options)) return null;

  const signature = options.find((option) => /^origin:signature:/i.test(String(option ?? "")));
  return signature ? String(signature).trim().toLowerCase() : null;
}

function didApplyActorDamage(appliedDamage) {
  const updates = Array.isArray(appliedDamage?.updates) ? appliedDamage.updates : [];
  return updates.some((update) => (
    typeof update?.value === "number"
    && update.value > 0
    && /^system\.attributes\.hp(?:\.|$)/.test(String(update.path ?? ""))
  ));
}

function matchesDeactivationEntry(entry, rollOptions) {
  const candidates = getDeactivationCandidates(entry);
  const normalizedRollOptions = getNormalizedRollOptions(rollOptions);
  return candidates.some((candidate) => normalizedRollOptions.has(candidate));
}

function getDeactivationCandidates(entry) {
  const slug = String(entry ?? "").trim().toLowerCase();
  if (!slug) return [];

  const candidates = new Set([
    slug,
    `item:trait:${slug}`,
    `origin:action:trait:${slug}`,
  ]);

  const damageTypeMatch = /^damage:type:(.+)$/.exec(slug)
    ?? /^item:damage:type:(.+)$/.exec(slug)
    ?? /^origin:damage:type:(.+)$/.exec(slug);
  const materialMatch = /^damage:material:(.+)$/.exec(slug);
  const normalizedDamageType = damageTypeMatch?.[1] ?? slug;
  const normalizedMaterial = materialMatch?.[1] ?? slug;

  if (normalizedDamageType in (CONFIG.PF2E?.damageTypes ?? {})) {
    candidates.add(`damage:type:${normalizedDamageType}`);
    candidates.add(`item:damage:${normalizedDamageType}`);
    candidates.add(`item:damage:type:${normalizedDamageType}`);
    candidates.add(`origin:damage:${normalizedDamageType}`);
    candidates.add(`origin:damage:type:${normalizedDamageType}`);
  }

  if (normalizedMaterial in (CONFIG.PF2E?.materialDamageEffects ?? {})) {
    candidates.add(`damage:material:${normalizedMaterial}`);
  }

  return Array.from(candidates);
}

function getNormalizedRollOptions(rollOptions) {
  const normalized = new Set();

  for (const option of rollOptions) {
    const value = String(option ?? "").trim().toLowerCase();
    if (!value) continue;

    normalized.add(value);

    const damageTypeMatch = /^damage:type:(.+)$/.exec(value)
      ?? /^item:damage:type:(.+)$/.exec(value)
      ?? /^origin:damage:type:(.+)$/.exec(value)
      ?? /^item:damage:(.+)$/.exec(value)
      ?? /^origin:damage:(.+)$/.exec(value);
    if (damageTypeMatch?.[1]) normalized.add(damageTypeMatch[1]);

    const materialMatch = /^damage:material:(.+)$/.exec(value);
    if (materialMatch?.[1]) normalized.add(materialMatch[1]);

    const traitMatch = /^item:trait:(.+)$/.exec(value)
      ?? /^origin:action:trait:(.+)$/.exec(value);
    if (traitMatch?.[1]) normalized.add(traitMatch[1]);
  }

  return normalized;
}

function getDamageApplicationsOptions(message) {
  const options = new Set();
  const applications = getDamageApplications(message);
  if (!applications.length) return [];

  const normalizedDamageLabels = new Map(Object.keys(CONFIG.PF2E?.damageTypes ?? {}).map((slug) => [
    normalizeApplicationLabel(game.i18n.localize(CONFIG.PF2E.damageTypes[slug])),
    `damage:type:${slug}`,
  ]));
  const normalizedWeaknessLabels = new Map(Object.keys(CONFIG.PF2E?.weaknessTypes ?? {}).map((slug) => [
    normalizeApplicationLabel(game.i18n.localize(CONFIG.PF2E.weaknessTypes[slug])),
    slug in (CONFIG.PF2E?.damageTypes ?? {})
      ? `damage:type:${slug}`
      : slug in (CONFIG.PF2E?.materialDamageEffects ?? {})
        ? `damage:material:${slug}`
        : null,
  ]).filter(([, value]) => Boolean(value)));

  for (const application of applications) {
    const normalizedType = normalizeApplicationLabel(String(application?.type ?? ""));
    if (!normalizedType) continue;

    const damageOption = normalizedDamageLabels.get(normalizedType);
    if (damageOption) options.add(damageOption);

    const weaknessOption = normalizedWeaknessLabels.get(normalizedType);
    if (weaknessOption) options.add(weaknessOption);
  }

  return Array.from(options);
}

function getDamageApplications(message) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(message?.content ?? "");

  const encoded = wrapper.querySelector(".iwr")?.dataset?.applications;
  if (!encoded) return [];

  try {
    const parsed = JSON.parse(encoded);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeApplicationLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function applyRegenerationBlockEffect(actor) {
  const isOwnTurn = actor.combatant?.id && game.combat?.combatant?.id === actor.combatant.id;
  const remainingOwnerTurnEnds = isOwnTurn ? 2 : 1;
  const existing = actor.itemTypes.effect.find((effect) => effect.getFlag(MODULE_ID, BLOCK_EFFECT_FLAG));

  if (existing) {
    await existing.update({
      [`flags.${MODULE_ID}.${BLOCK_EFFECT_TURN_FLAG}`]: remainingOwnerTurnEnds,
    });
    return;
  }

  await actor.createEmbeddedDocuments("Item", [createRegenerationBlockEffectSource(actor, remainingOwnerTurnEnds)]);
}

function createRegenerationBlockEffectSource(actor, remainingOwnerTurnEnds) {
  return {
    name: localize("ActionPlus.Regeneration.BlockEffect.Name"),
    type: "effect",
    img: "icons/magic/time/hourglass-brown-orange.webp",
    system: {
      description: {
        value: `<p>${localize("ActionPlus.Regeneration.BlockEffect.Description")}</p>`,
      },
      duration: {
        value: -1,
        unit: "unlimited",
        expiry: null,
        sustained: false,
      },
      level: {
        value: Math.max(Number(actor.level) || 0, 1),
      },
      rules: [],
      slug: BLOCK_EFFECT_SLUG,
      tokenIcon: {
        show: true,
      },
      traits: {
        value: [],
      },
    },
    flags: {
      [MODULE_ID]: {
        [BLOCK_EFFECT_FLAG]: true,
        [BLOCK_EFFECT_TURN_FLAG]: remainingOwnerTurnEnds,
      },
    },
  };
}

async function handleOwnerTurnEnd(combatant) {
  const actor = combatant?.actor;
  if (!actor || game.user !== actor.primaryUpdater) return;

  const effects = actor.itemTypes.effect.filter((effect) => effect.getFlag(MODULE_ID, BLOCK_EFFECT_FLAG));
  for (const effect of effects) {
    const remaining = Number(effect.getFlag(MODULE_ID, BLOCK_EFFECT_TURN_FLAG) ?? 0);
    if (remaining <= 1) {
      await effect.delete();
    } else {
      await effect.update({
        [`flags.${MODULE_ID}.${BLOCK_EFFECT_TURN_FLAG}`]: remaining - 1,
      });
    }
  }
}

async function cleanupCombatEffects(combat) {
  const combatants = combat?.combatants?.contents ?? [];
  const actors = Array.from(new Map(
    combatants
      .map((combatant) => combatant.actor)
      .filter(Boolean)
      .map((actor) => [actor.uuid, actor]),
  ).values());

  for (const actor of actors) {
    if (game.user !== actor.primaryUpdater) continue;

    const effectIds = actor.itemTypes.effect
      .filter((effect) => effect.getFlag(MODULE_ID, BLOCK_EFFECT_FLAG))
      .map((effect) => effect.id);

    if (effectIds.length) {
      await actor.deleteEmbeddedDocuments("Item", effectIds);
    }
  }
}
