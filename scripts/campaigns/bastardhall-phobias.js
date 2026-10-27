import { MODULE_ID, SOCKET_CHANNEL, escapeHtml } from "../core.js";
import { registerCheckRollWrapper } from "../utility/check-roll-wrapper.js";

const CONDITION_FLAG = "bastardhallPhobiaCondition";
const EFFECT_FLAG = "bastardhallEffect";
const PROCESSED = "bastardhallPhobiaProcessed";
const CONDITION_IDS = { "off-guard": "AJh5ex99aV6VTggg", frightened: "TBSHQspnbcqxsmjL", sickened: "fesd1n5eVhpCSS18", slowed: "xYTAsEpcJE1Ccni3", stunned: "dfCMdR4wnpbYNTix", "persistent-damage": "lDVqvLKA6eF3Df60" };
const conditionLink = (slug, label) => `@UUID[Compendium.pf2e.conditionitems.Item.${CONDITION_IDS[slug]}]{${label}}`;
const offGuard = conditionLink("off-guard", "Застигнут врасплох");
const frightened = conditionLink("frightened", "Напуган 1");
const slowed = conditionLink("slowed", "Замедлен 1");
const sickened = conditionLink("sickened", "Тошнота 1");
const strike = "@UUID[Compendium.pf2e.actionspf2e.Item.VjxZFuUXrCU94MWR]{Удар}";
export const PHOBIA_PRESETS = Object.freeze([
  { id: "thalassophobia", name: "Талассофобия", description: '<p>Персонаж боится глубоких водоёмов и получает штраф состояния −2 к проверкам @UUID[Compendium.pf2e.actionspf2e.Item.c8TGiZ48ygoSPofx]{Плыть}.</p>' },
  { id: "pyrophobia", name: "Пирофобия", description: `<p>Персонаж боится огня и получает состояние ${frightened} каждый раз, когда получает урон огнём.</p>` },
  { id: "enochlophobia", name: "Энохлофобия", description: `<p>Персонаж боится толпы и получает состояние ${frightened} каждый раз, когда получает состояние ${offGuard}.</p>` },
  { id: "nyctophobia", name: "Никтофобия", description: '<p>Персонаж боится темноты. В тусклом свете он получает штраф состояния −1 к Воле, в темноте — штраф состояния −2 к Воле.</p>' },
  { id: "hemophobia", name: "Гемофобия", description: `<p>Персонаж боится крови. Когда он получает ${conditionLink("persistent-damage", "Кровотечение")} или подвергается критическому попаданию, он получает состояние ${sickened}.</p>` },
  { id: "proditiophobia", name: "Продитиофобия", description: '<p>Персонаж боится предательства. Он не может быть целью @UUID[Compendium.pf2e.actionspf2e.Item.HCl3pzVefiv9ZKQW]{Помощи} и не может фланкировать вместе с союзниками.</p><p>Когда союзник пытается воздействовать на него благотворным эффектом, персонаж должен успешно совершить @Check[will|dc:26]{спасбросок Воли КС 26}, чтобы принять эффект, не пытаясь дать отпор или сбежать.</p>' },
  { id: "agoraphobia", name: "Агорафобия", description: `<p>Персонаж боится открытых пространств. На открытой местности (включая области без крыши) он становится ${offGuard} из-за всепоглощающего страха.</p>` },
  { id: "arachnophobia", name: "Арахнофобия", description: `<p>Персонаж боится пауков. В бою против паукообразных существ он становится ${offGuard}. Когда такое существо совершает критическое попадание действием ${strike} по персонажу или персонаж попадает под действие паутины, он получает состояние ${slowed} от нарастающей паники.</p>` },
  { id: "teraphobia", name: "Терафобия", description: `<p>Персонаж боится чудовищ. Один раз за бой против Вольдрака или Заургалуса он совершает @Check[will|dc:31]{спасбросок Воли КС 31}. При провале он получает состояние ${slowed} до конца боя. При критическом провале — ${conditionLink("stunned", "Ошеломлён 3")}, а затем ${slowed} до конца боя.</p>` },
]);

export function presetPhobia(id, actorUuid) {
  const preset = PHOBIA_PRESETS.find((entry) => entry.id === id);
  if (!preset) return null;
  return { id: foundry.utils.randomID(), actorUuid, presetId: id, sourceUuid: `bastardhall-phobia:${id}`,
    name: preset.name, description: preset.description, img: "icons/magic/control/fear-fright-shadow-monster-purple.webp",
    outdoors: false, effectSystem: { rules: [] } };
}

export function presetRules(entry, { light = 0, spiders = false, outdoors = entry.outdoors } = {}) {
  switch (entry.presetId) {
    case "thalassophobia": return [{ key: "FlatModifier", slug: "bastardhall-thalassophobia", selector: "athletics", type: "status", value: -2, predicate: ["action:swim"] }];
    case "nyctophobia": return light ? [{ key: "FlatModifier", selector: "will", type: "status", value: -light }] : [];
    case "proditiophobia": return [
      { key: "ActiveEffectLike", mode: "override", path: "system.attributes.flanking.canFlank", value: false },
      { key: "AdjustModifier", selector: "all", slug: "aid", suppress: true },
      { key: "AdjustModifier", selector: "all", slug: "effect-aid", suppress: true },
    ];
    case "agoraphobia": return [
      { key: "RollOption", domain: "all", option: "bastardhall:outdoors", label: "На открытой местности", toggleable: true, value: Boolean(outdoors) },
      { key: "GrantItem", uuid: `Compendium.pf2e.conditionitems.Item.${CONDITION_IDS["off-guard"]}`, inMemoryOnly: true, predicate: ["bastardhall:outdoors"] },
    ];
    case "arachnophobia": return spiders
      ? [{ key: "GrantItem", uuid: `Compendium.pf2e.conditionitems.Item.${CONDITION_IDS["off-guard"]}`, inMemoryOnly: true }] : [];
    default: return [];
  }
}

const SPIDER_IDS = new Set(["gN7Ma8swV60FX7wf", "Iwk2qT4lVyrvoz3B", "zEQf2FhTJ1kpbBjo"]);
function creatureNames(actor, token) {
  return [token?.name, token?.document?.name, token?.token?.name, actor?.name, actor?.prototypeToken?.name].filter(Boolean).join(" ");
}
export function isSpider(actor, token) {
  const source = actor?.prototypeToken?.actorId ?? actor?.id;
  return SPIDER_IDS.has(source) || SPIDER_IDS.has(actor?.id)
    || /anophilex|gogiteth|анофилекс|гогитэт|гогитет|arachnid|spider|паук|паукообраз/i.test(creatureNames(actor, token));
}
export function isMonster(actor, token) { return /voldrak|zaurgaulus|вольдрак|волдрак|заургалус/i.test(creatureNames(actor, token)); }
const isEnemy = (actor, enemy) => enemy?.uuid !== actor?.uuid && (actor?.isEnemyOf?.(enemy) ?? enemy?.type === "npc");
function actorCombats(actor) {
  return [...(game.combats ?? [])].filter((combat) => combat.started && [...combat.combatants].some((c) => c.actor?.uuid === actor.uuid));
}
function spiderCombat(actor) {
  return actorCombats(actor).some((combat) => [...combat.combatants].some((c) => !c.isDefeated && isSpider(c.actor, c) && isEnemy(actor, c.actor)));
}

// Use physical light at the token, not darkvision. Same 0.25/0.75 thresholds as PF2e.
export function tokenLightPenalty(token) {
  const point = { x: token.center.x, y: token.center.y, elevation: Number(token.document?.elevation ?? 0) };
  if (canvas.effects?.testInsideDarkness?.(point)) return 2;
  const ambient = 1 - Number(canvas.effects?.getDarknessLevel?.(point) ?? canvas.environment?.darknessLevel ?? 0);
  let light = ambient >= 0.75 ? 0 : ambient > 0.25 ? 1 : 2;
  for (const source of canvas.effects?.lightSources?.values?.() ?? []) {
    // Global light belongs to the ambient calculation; it is not a dim lamp.
    if (source === canvas.environment?.globalLightSource || source.constructor?.sourceType === "GlobalLight") continue;
    if (!source.active || source.isPreview || !source.testPoint?.(point)) continue;
    const bright = Math.abs(Number(source.data?.bright ?? 0));
    if (bright > 0 && Math.hypot(point.x - source.x, point.y - source.y) <= bright) return 0;
    light = Math.min(light, 1);
  }
  return light;
}
export function phobiaEnvironment(actor) {
  const tokens = globalThis.canvas?.ready ? (canvas.tokens?.placeables ?? []).filter((token) => token.actor?.uuid === actor.uuid) : [];
  return { light: tokens.length ? Math.max(...tokens.map(tokenLightPenalty)) : null, spiders: spiderCombat(actor) };
}

let api;
let queue = Promise.resolve();
let scheduled = false;
let entryIndex = null;
let lastEnvironmentSignature = null;
const pendingConditions = new Set();
const damageApplications = new Map();
const entries = (actor) => {
  if (!api) return [];
  if (!entryIndex) {
    entryIndex = new Map();
    for (const entry of api.getData().phobias) {
      const group = entryIndex.get(entry.actorUuid) ?? [];
      group.push(entry); entryIndex.set(entry.actorUuid, group);
    }
  }
  return entryIndex.get(actor?.uuid) ?? [];
};
const entryFor = (actor, id) => entries(actor).find((entry) => entry.presetId === id);
const active = () => Boolean(api?.isPrimaryGM() && game.settings.get(MODULE_ID, "enableBastardhallSheet"));
function enqueue(task) {
  queue = queue.then(task).catch((error) => console.error(`${MODULE_ID} | Phobia automation`, error));
  return queue;
}
export function invalidatePhobiaRuntime() { entryIndex = null; lastEnvironmentSignature = null; schedulePhobiaRuntime(); }
export function schedulePhobiaRuntime() {
  if (!api?.isPrimaryGM() || scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; void enqueue(reconcileRuntime); }, 100);
}

// Each phobia owns at most one native condition per slug. Native PF2e reductions
// (frightened/stunned/sickened) stay in charge; triggers never increment a value.
export async function ensurePhobiaCondition(actor, entry, slug, value, combatId = null) {
  if (!active() || !entries(actor).some((candidate) => candidate.id === entry.id) || actor.isImmuneTo?.(slug)) return;
  const key = `${entry.id}:${slug}`;
  if (pendingConditions.has(key)) return;
  pendingConditions.add(key);
  try {
    const own = actor.items.filter((item) => item.getFlag?.(MODULE_ID, CONDITION_FLAG)?.key === key);
    if (own.length > 1) await actor.deleteEmbeddedDocuments("Item", own.slice(1).map((item) => item.id));
    const existing = own[0];
    if (existing) {
      const changes = {};
      if (Number(existing.system.value?.value ?? 0) < value) changes["system.value.value"] = value;
      if (combatId && existing.getFlag(MODULE_ID, CONDITION_FLAG).combatId !== combatId) changes[`flags.${MODULE_ID}.${CONDITION_FLAG}.combatId`] = combatId;
      if (Object.keys(changes).length) await existing.update(changes);
      return;
    }
    // Do not duplicate an independently applied condition with an equal/higher value.
    // A combat-duration slowed condition needs its own lifetime even if another exists.
    if (!combatId && Number(actor.getCondition?.(slug)?.value ?? 0) >= value) return;
    const source = game.pf2e.ConditionManager.getCondition(slug)?.toObject();
    if (!source) return;
    delete source._id;
    source.system.value.value = value;
    source.flags ??= {};
    source.flags[MODULE_ID] = { ...source.flags[MODULE_ID], [CONDITION_FLAG]: { key, phobiaId: entry.id, combatId } };
    await actor.createEmbeddedDocuments("Item", [source]);
  } finally { pendingConditions.delete(key); }
}

export async function cleanupPhobiaConditions(data, enabled) {
  if (!api?.isPrimaryGM()) return;
  const valid = new Set(enabled ? data.phobias.map((entry) => entry.id) : []);
  for (const actor of game.actors?.contents ?? []) {
    const ids = actor.items.filter((item) => {
      const flag = item.getFlag?.(MODULE_ID, CONDITION_FLAG);
      if (!flag) return false;
      return !valid.has(flag.phobiaId) || (flag.combatId && !game.combats?.get(flag.combatId)?.started);
    }).map((item) => item.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
    const previous = actor.getFlag?.(MODULE_ID, "bastardhallPhobiaOffGuard");
    if (previous && !valid.has(previous.id)) await actor.unsetFlag(MODULE_ID, "bastardhallPhobiaOffGuard");
  }
}

async function observeOffGuard(actor) {
  const entry = entryFor(actor, "enochlophobia");
  if (!entry) return;
  const tokens = globalThis.canvas?.ready ? (canvas.tokens?.placeables ?? []).filter((token) => token.actor?.uuid === actor.uuid) : [];
  const flanked = tokens.some((token) => (canvas.tokens?.placeables ?? []).some((enemy) => isEnemy(actor, enemy.actor) && enemy.isFlanking?.(token)));
  const current = Boolean(actor.getCondition?.("off-guard")) || flanked;
  const persisted = actor.getFlag?.(MODULE_ID, "bastardhallPhobiaOffGuard");
  const previous = persisted?.id === entry.id ? persisted.active : false;
  if (persisted?.id !== entry.id || persisted.active !== current) await actor.setFlag(MODULE_ID, "bastardhallPhobiaOffGuard", { id: entry.id, active: current });
  if (current && previous !== true) await ensurePhobiaCondition(actor, entry, "frightened", 1);
}

async function reconcileRuntime() {
  if (!api?.isPrimaryGM()) return;
  const data = api.getData();
  const enabled = active();
  await cleanupPhobiaConditions(data, enabled);
  if (!enabled) return;
  const environmentSignature = JSON.stringify(data.phobias.filter((entry) => ["nyctophobia", "arachnophobia", "agoraphobia"].includes(entry.presetId)).map((entry) => {
    const actor = game.actors?.get(entry.actorUuid.split(".").at(-1));
    return [entry.id, entry.outdoors, actor ? phobiaEnvironment(actor) : null];
  }));
  // Use the campaign queue only when a phobia's environment really changed.
  if (environmentSignature !== lastEnvironmentSignature) {
    await api.queueReconcile({ forcePhobias: true });
    lastEnvironmentSignature = environmentSignature;
  }
  for (const actor of game.actors?.contents ?? []) {
    if (!entries(actor).length) continue;
    await observeOffGuard(actor);
  }
  for (const combat of game.combats ?? []) await processPhobiaCombat(combat);
}

export async function processPhobiaCombat(combat) {
  if (!active() || !combat?.started) return;
  const combatants = [...combat.combatants];
  const actors = [...new Map(combatants.filter((c) => c.actor?.type === "character").map((c) => [c.actor.uuid, c.actor])).values()];
  for (const actor of actors) {
    const entry = entryFor(actor, "teraphobia");
    if (!entry || !combatants.some((c) => !c.isDefeated && isMonster(c.actor, c) && isEnemy(actor, c.actor))) continue;
    const states = { ...combat.getFlag(MODULE_ID, "phobiaSaves") };
    if (states[entry.id]) continue;
    states[entry.id] = "rolling";
    await combat.setFlag(MODULE_ID, "phobiaSaves", states);
    const roll = await actor.saves.will.check.roll({ dc: { value: 31 }, title: "Терафобия", skipDialog: true });
    const current = { ...combat.getFlag(MODULE_ID, "phobiaSaves") };
    current[entry.id] = Number.isInteger(roll?.degreeOfSuccess) ? roll.degreeOfSuccess + 1 : "cancelled";
    await combat.setFlag(MODULE_ID, "phobiaSaves", current);
    if (!combat.started || !roll) continue;
    if (roll.degreeOfSuccess === 0) await ensurePhobiaCondition(actor, entry, "stunned", 3, combat.id);
    if (roll.degreeOfSuccess < 2) await ensurePhobiaCondition(actor, entry, "slowed", 1, combat.id);
  }
}

function conditionItem(item) { return item?.type === "condition" && item.parent?.type === "character"; }
function webItem(item) {
  if (!item) return false;
  return /^(web|webbed|web-trap|web-attack|entangling-web|effect-web|effect-webbed)$/.test(item.slug ?? item.system?.slug ?? "")
    || /^(web|webbed|web trap|web attack|entangling web|паутина|в паутине|опутан паутиной|эффект: паутина)(?:\s|$|[:(])/i.test(item.name ?? "");
}
async function onItem(item, created) {
  if (!active() || item.parent?.type !== "character") return;
  const actor = item.parent;
  if (conditionItem(item) && item.slug === "persistent-damage" && item.system.persistent?.damageType === "bleed") {
    const entry = entryFor(actor, "hemophobia");
    if (entry && created) await ensurePhobiaCondition(actor, entry, "sickened", 1);
  }
  if (created && webItem(item)) {
    const entry = entryFor(actor, "arachnophobia");
    if (entry) await ensurePhobiaCondition(actor, entry, "slowed", 1);
  }
  await observeOffGuard(actor);
}

function damageRollFor(message) {
  const signature = message.flags.pf2e.context?.options?.find((option) => option.startsWith("origin:signature:"));
  if (!signature) return null;
  return (game.messages?.contents ?? []).findLast((candidate) => candidate.isDamageRoll && candidate.flags?.pf2e?.origin?.rollOptions?.includes(signature))?.rolls?.find((roll) => roll.instances?.length);
}
// Snapshot the actual DamageRoll passed to applyDamage (including evaluated
// persistent fire), not a nearby chat roll which might belong to another hit.
export function hasAppliedFire(actor, roll, options = new Set(), skipIWR = false) {
  if (!roll?.instances) return false;
  return roll.instances.some((instance) => {
    if (instance.type !== "fire" || (instance.persistent && !instance.options?.evaluatePersistent) || !(instance.total > 0)) return false;
    if (skipIWR || game.pf2e.settings?.iwr === false) return true;
    if (actor.isAffectedBy?.("fire") === false) return false;
    const predicates = new Set([...instance.formalDescription ?? [], ...options]);
    const bypass = roll.options?.bypass;
    const immunity = (actor.attributes?.immunities ?? []).find((entry) => entry.type !== "critical-hits" && entry.type !== "precision" && entry.test(predicates));
    if (immunity && !bypass?.immunity?.redirect?.some((entry) => entry.from === immunity.type)) return false;
    const weakness = Math.max(0, ...(actor.attributes?.weaknesses ?? []).filter((entry) => entry.test(predicates)).map((entry) => Number(entry.value) || 0));
    const resistance = Math.max(0, ...(actor.attributes?.resistances ?? []).filter((entry) => entry.test(predicates) && !bypass?.resistance?.ignore?.some((ignored) => ignored.type === entry.type || ignored.type === "all-damage"))
      .map((entry) => Number(entry.getDoubledValue?.(predicates) ?? entry.value) || 0));
    return instance.total + weakness > resistance;
  });
}

function installDamageObserver() {
  const prototype = CONFIG.PF2E.Actor?.documentClasses?.character?.prototype;
  if (!prototype?.applyDamage) return;
  async function wrapper(wrapped, params, ...rest) {
    if (!game.settings.get(MODULE_ID, "enableBastardhallSheet") || !entryFor(this, "pyrophobia")) return wrapped(params, ...rest);
    const key = `${MODULE_ID}:phobia-damage:${foundry.utils.randomID()}`;
    const options = new Set(params.rollOptions ?? []);
    const fire = hasAppliedFire(this, params.damage, options, params.skipIWR || params.final);
    options.add(key);
    damageApplications.set(key, { fire });
    try { return await wrapped({ ...params, rollOptions: options }, ...rest); }
    finally { damageApplications.delete(key); }
  }
  if (globalThis.libWrapper?.register) libWrapper.register(MODULE_ID, "CONFIG.PF2E.Actor.documentClasses.character.prototype.applyDamage", wrapper, "WRAPPER");
  else {
    const original = prototype.applyDamage;
    prototype.applyDamage = function(...args) { return wrapper.call(this, original.bind(this), ...args); };
  }
}
export function fireDamageReceived(message) {
  const applied = message.flags?.pf2e?.appliedDamage;
  if (!applied || applied.isHealing || applied.isReverted || !applied.updates?.some((update) => update.value > 0 && /^system\.attributes\.(hp|sp)\./.test(update.path))) return false;
  const snapshot = message.getFlag?.(MODULE_ID, "phobiaDamage");
  if (snapshot) return snapshot.fire === true;
  const roll = damageRollFor(message);
  const fire = roll?.instances?.filter((instance) => instance.type === "fire" && !instance.persistent).reduce((sum, instance) => sum + Number(instance.total ?? 0), 0) ?? 0;
  if (fire <= 0) return false;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = message.content ?? "";
  let applications = [];
  try { applications = JSON.parse(wrapper.querySelector(".iwr")?.dataset.applications ?? "[]"); } catch { /* no IWR */ }
  const fireLabel = game.i18n.localize(CONFIG.PF2E.damageTypes.fire).toLowerCase();
  const fireReductions = applications.filter((application) => String(application.type).toLowerCase() === fireLabel);
  if (fireReductions.some((application) => application.category === "immunity")) return false;
  return fire + fireReductions.reduce((sum, application) => sum + Number(application.adjustment ?? 0), 0) > 0;
}

async function resolveActor(uuid) {
  const document = typeof uuid === "string" ? await fromUuid(uuid).catch(() => null) : uuid;
  return document?.actor ?? document ?? null;
}
export async function processPhobiaMessage(message) {
  if (!active() || message.getFlag?.(MODULE_ID, PROCESSED) || message.getFlag?.(MODULE_ID, "phobiaConsent")) return;
  const context = message.flags?.pf2e?.context;
  const damage = message.flags?.pf2e?.appliedDamage;
  if (context?.type === "damage-taken" && damage) {
    const actor = await resolveActor(damage.uuid);
    const entry = entryFor(actor, "pyrophobia");
    if (entry && fireDamageReceived(message)) {
      await message.setFlag(MODULE_ID, PROCESSED, true);
      await ensurePhobiaCondition(actor, entry, "frightened", 1);
    }
    return;
  }
  const outcome = context?.outcome ?? ["criticalFailure", "failure", "success", "criticalSuccess"][message.rolls?.[0]?.degreeOfSuccess];
  if (context?.type === "attack-roll" && outcome === "criticalSuccess") {
    const target = await resolveActor(context.target?.actor ?? context.target?.token);
    const blood = entryFor(target, "hemophobia");
    const spider = entryFor(target, "arachnophobia");
    const origin = message.actor ?? await resolveActor(context.origin?.actor);
    const originToken = message.token ?? (context.origin?.token ? await fromUuid(context.origin.token).catch(() => null) : null);
    const strikeRoll = context.options?.includes("action:strike") || ["weapon", "melee"].includes(message.item?.type);
    if (blood || (spider && strikeRoll && isSpider(origin, originToken))) {
      await message.setFlag(MODULE_ID, PROCESSED, true);
      if (blood) await ensurePhobiaCondition(target, blood, "sickened", 1);
      if (spider && strikeRoll && isSpider(origin, originToken)) await ensurePhobiaCondition(target, spider, "slowed", 1);
    }
  }
  if ((context?.type === "attack-roll" && ["success", "criticalSuccess"].includes(outcome)
      || context?.type === "saving-throw" && ["failure", "criticalFailure"].includes(outcome))
      && webItem(message.item ?? (message.flags?.pf2e?.origin?.uuid ? await fromUuid(message.flags.pf2e.origin.uuid).catch(() => null) : null))) {
    const target = context.type === "saving-throw" ? message.actor : await resolveActor(context.target?.actor ?? context.target?.token);
    const entry = entryFor(target, "arachnophobia");
    if (entry) {
      await message.setFlag(MODULE_ID, PROCESSED, true);
      await ensurePhobiaCondition(target, entry, "slowed", 1);
    }
  }
  // Targets are snapshotted on the author client at creation, never read later from GM selection.
  const targets = message.getFlag?.(MODULE_ID, "phobiaTargets") ?? [];
  const origin = message.actor;
  if (!origin || !targets.length || message.getFlag?.(MODULE_ID, "phobiaConsentPrompts")) return;
  const recipients = [];
  for (const uuid of targets) {
    const target = await resolveActor(uuid);
    if (target?.uuid !== origin.uuid && entryFor(target, "proditiophobia") && origin.isAllyOf?.(target)) recipients.push(target);
  }
  if (!recipients.length) return;
  await message.setFlag(MODULE_ID, "phobiaConsentPrompts", true);
  for (const actor of recipients) await postConsent(actor, origin, message.id);
}

async function postConsent(actor, origin = null, sourceMessageId = null) {
  if (!active() || !entryFor(actor, "proditiophobia")) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<h3>Продитиофобия — ${escapeHtml(actor.name)}</h3>${origin ? `<p>Действие союзника: ${escapeHtml(origin.name)}.</p>` : ""}<p>Если это действие требует согласное существо, вы должны совершить спасбросок Воли КС 26, чтобы быть согласным существом. Благотворный эффект принимается только при успехе.</p><button type="button" data-phobia-consent>Воля · КС 26</button>`,
    flags: { [MODULE_ID]: { phobiaConsent: { actorUuid: actor.uuid, sourceMessageId, state: "pending" } } },
  });
}

async function rollConsent(message, user) {
  const flag = message?.getFlag(MODULE_ID, "phobiaConsent");
  if (!active() || flag?.state !== "pending") return;
  const actor = await resolveActor(flag.actorUuid);
  if (!entryFor(actor, "proditiophobia") || !(user?.isGM || actor?.testUserPermission(user, "OWNER"))) return;
  await message.setFlag(MODULE_ID, "phobiaConsent", { ...flag, state: "rolling" });
  const roll = await actor.saves.will.check.roll({ dc: { value: 26 }, title: "Продитиофобия: принять помощь союзника", skipDialog: true });
  await message.setFlag(MODULE_ID, "phobiaConsent", { ...flag, state: roll ? (roll.degreeOfSuccess >= 2 ? "success" : "failure") : "pending" });
}

export function requestPhobiaConsent(actorUuid) {
  if (active()) return enqueue(async () => postConsent(await resolveActor(actorUuid)));
  game.socket.emit(SOCKET_CHANNEL, { type: "bastardhall-phobia-consent", actorUuid, senderId: game.user.id });
}

export function installPhobiaRuntime(callbacks) {
  if (api) return;
  api = callbacks;
  for (const hook of ["canvasReady", "lightingRefresh", "createCombatant", "deleteCombatant", "deleteCombat", "createToken", "deleteToken"]) Hooks.on(hook, schedulePhobiaRuntime);
  Hooks.on("updateCombat", (_combat, change) => { if ("round" in change || "active" in change) schedulePhobiaRuntime(); });
  Hooks.on("updateCombatant", (_combatant, change) => { if (["defeated", "actorId", "name"].some((key) => key in change)) schedulePhobiaRuntime(); });
  Hooks.on("updateToken", (_token, change) => { if (["x", "y", "elevation", "light", "actorId", "name", "disposition"].some((key) => key in change)) schedulePhobiaRuntime(); });
  Hooks.on("updateActor", (actor) => { if (active() && entryFor(actor, "enochlophobia")) void enqueue(() => observeOffGuard(actor)); });
  Hooks.on("createItem", (item) => { if (active()) void enqueue(() => onItem(item, true)); });
  Hooks.on("updateItem", (item) => { if (active() && conditionItem(item)) void enqueue(() => onItem(item, false)); });
  Hooks.on("deleteItem", (item) => { if (active() && item.parent?.type === "character") void enqueue(() => observeOffGuard(item.parent)); });
  Hooks.on("preCreateItem", (item) => {
    if (!game.settings.get(MODULE_ID, "enableBastardhallSheet") || !entryFor(item.parent, "proditiophobia")) return;
    if (item.type === "effect" && (item.slug === "effect-aid" || item.system?.slug === "effect-aid" || item._stats?.compendiumSource === "Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX")) {
      ui.notifications.warn("Продитиофобия: персонаж не может быть целью Помощи.");
      return false;
    }
  });
  Hooks.on("preCreateChatMessage", (message) => {
    if (!game.settings.get(MODULE_ID, "enableBastardhallSheet") || message.flags?.[MODULE_ID]?.phobiaConsent) return;
    const context = message.flags?.pf2e?.context;
    if (context?.type === "damage-taken") {
      const key = context.options?.find((option) => damageApplications.has(option));
      if (key) message.updateSource({ [`flags.${MODULE_ID}.phobiaDamage`]: damageApplications.get(key) });
      return;
    }
    if (context?.type === "damage-taken" || context?.type === "saving-throw" || message.isDamageRoll) return;
    if (!message.flags?.pf2e?.origin && !context) return;
    message.updateSource({ [`flags.${MODULE_ID}.phobiaTargets`]: [...new Set([...game.user.targets].map((token) => token.actor?.uuid).filter(Boolean))] });
  });
  Hooks.on("createChatMessage", (message) => { if (active()) void enqueue(() => processPhobiaMessage(message)); });
  Hooks.on("updateChatMessage", (message, change) => {
    // Also handle integrations which attach the resolved outcome after creation.
    if (active() && (change.flags?.pf2e?.context || "flags.pf2e.context.outcome" in change)) {
      void enqueue(() => processPhobiaMessage(message));
    }
  });
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const flag = message.getFlag(MODULE_ID, "phobiaConsent");
    const button = html.querySelector?.("[data-phobia-consent]");
    if (!flag || !button) return;
    const actor = fromUuidSync(flag.actorUuid);
    button.disabled = flag.state !== "pending" || !(game.user.isGM || actor?.isOwner);
    if (flag.state !== "pending") button.textContent = ({ rolling: "Бросок…", success: "Успех — эффект можно принять", failure: "Провал — эффект не принят" })[flag.state] ?? "Бросок завершён";
    button.addEventListener("click", () => {
      button.disabled = true;
      if (active()) void enqueue(() => rollConsent(message, game.user));
      else game.socket.emit(SOCKET_CHANNEL, { type: "bastardhall-phobia-consent", messageId: message.id, senderId: game.user.id });
    });
  });
  game.socket.on(SOCKET_CHANNEL, (request) => {
    if (!active() || request?.type !== "bastardhall-phobia-consent") return;
    const user = game.users.get(request.senderId);
    if (!user?.active) return;
    if (request.messageId) void enqueue(() => rollConsent(game.messages.get(request.messageId), user));
    else void enqueue(async () => {
      const actor = await resolveActor(request.actorUuid);
      if (user.isGM || actor?.testUserPermission(user, "OWNER")) await postConsent(actor);
    });
  });
  registerCheckRollWrapper("bastardhall-phobias", async function(wrapped, check, context = {}, ...args) {
    if (game.settings.get(MODULE_ID, "enableBastardhallSheet")) {
      const options = context?.options ?? new Set();
      const actor = context.actor ?? (context.origin?.self === false ? context.target?.actor : context.origin?.actor);
      const swim = entryFor(actor, "thalassophobia");
      // Some action launchers rebuild the check without the actor's conditional
      // synthetics. Repair that check before its dialog, without duplicating REs.
      if (swim && [...options].includes("action:swim") && typeof check?.push === "function"
          && !check.modifiers?.some((modifier) => modifier.slug === "bastardhall-thalassophobia"
            || modifier.rule?.item?.getFlag?.(MODULE_ID, EFFECT_FLAG) === `phobia:${swim.id}`)) {
        check.push(new game.pf2e.Modifier({ slug: "bastardhall-thalassophobia", label: swim.name, modifier: -2, type: "status" }));
        check.calculateTotal?.(new Set(options));
      }
      const target = context?.target?.actor;
      const aidTargets = target ? [target] : [...game.user.targets].map((token) => token.actor);
      if ([...options].some((option) => /^action:aid(?::|$)/.test(option)) && aidTargets.some((actor) => entryFor(actor, "proditiophobia"))) {
        ui.notifications.warn("Продитиофобия: персонаж не может быть целью Помощи."); return null;
      }
    }
    return wrapped(check, context, ...args);
  });
  installDamageObserver();
  schedulePhobiaRuntime();
}
