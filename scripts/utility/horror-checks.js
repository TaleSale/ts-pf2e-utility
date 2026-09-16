import { MODULE_ID } from "../core.js";
import { registerCheckRollWrapper } from "./check-roll-wrapper.js";
import { horrorDegree, OUTCOMES } from "./horror-rules.js";

export function naturalOf(roll) {
  return roll?.dice?.find((die) => die.faces === 20)?.results?.find((result) => result.active !== false && !result.discarded)?.result ?? null;
}

function snapshot(adjustment) {
  return { predicate: adjustment.predicate ? Array.from(adjustment.predicate) : null,
    adjustments: foundry.utils.deepClone(adjustment.adjustments) };
}

export function baseAdjustments(context, roll) {
  const natural = naturalOf(roll);
  const options = new Set([...(context.options ?? []).filter((option) => !option.startsWith("check:total:") && !option.startsWith("check:roll:total:")),
    `check:total:${roll.total}`, `check:total:natural:${natural}`, `check:roll:total:natural:${natural}`,
    `check:total:delta:${roll.total - context.dc.value}`]);
  return (context.tsuHorror?.base ?? []).filter((entry) => !entry.predicate || new game.pf2e.Predicate(...entry.predicate).test(options))
    .reduce((result, entry) => Object.assign(result, entry.adjustments), {});
}

// PF2e's native reroll clones flags once, then evaluates a new die and reads
// dosAdjustments. Foundry deepClone intentionally retains non-plain objects.
// These getters defer only the degree adjustment until the new die is known;
// the native reroll still owns resource costs, keep-high/low, notes and callbacks.
class RerollAdjustments {
  #context; #enabled; #label; #roll;
  get roll() { return this.#roll; }
  set roll(value) { this.#roll = value; }
  constructor(context, roll, enabled, label) {
    this.#context = context; this.roll = roll; this.#enabled = enabled; this.#label = label;
    for (const key of ["all", ...OUTCOMES]) Object.defineProperty(this, key, { enumerable: true, get: () => this.toJSON()[key] });
  }
  toJSON() {
    const base = baseAdjustments(this.#context, this.roll);
    if (!this.#enabled()) return base;
    const data = this.#context.tsuHorror;
    const degree = horrorDegree(naturalOf(this.roll), data.own) ?? horrorDegree(naturalOf(this.roll), data.incoming, true);
    return degree == null ? base : { ...base, all: { amount: OUTCOMES[degree], label: this.#label() } };
  }
}

export function installHorrorChecks({ enabled, dreadOf, label }) {
  registerCheckRollWrapper("horror-mode", async (wrapped, check, context = {}, ...args) => {
    if (!enabled()) return wrapped(check, context, ...args);
    const actor = context.actor ?? (context.origin?.self === false ? context.target?.actor : context.origin?.actor);
    const target = context.target?.actor;
    const attacker = context.origin?.actor ?? actor;
    const own = actor?.type === "character" ? dreadOf(actor) : 0;
    const incoming = context.type === "attack-roll" && target?.type === "character" && attacker?.isEnemyOf?.(target) ? dreadOf(target) : 0;
    if (!own && !incoming) return wrapped(check, context, ...args);
    const previous = context.dosAdjustments;
    const previousMetadata = context.tsuHorror;
    const base = [...(previous ?? [])];
    const additions = [{ value: incoming, enemy: true, degree: 3 }, { value: own, enemy: false, degree: 0 }]
      .filter(({ value }) => value > 0).map(({ value, enemy, degree }) => ({
        predicate: new game.pf2e.Predicate({ or: Array.from({ length: value }, (_, index) =>
          `check:roll:total:natural:${enemy ? 20 - index : index + 1}`) }),
        adjustments: { all: { label: label(), amount: OUTCOMES[degree] } },
      }));
    context.dosAdjustments = [...base, ...additions];
    context.tsuHorror = { own, incoming, base: base.map(snapshot) };
    try { return await wrapped(check, context, ...args); }
    finally { context.dosAdjustments = previous; context.tsuHorror = previousMetadata; }
  });

  const original = game.pf2e.Check.rerollFromMessage;
  if (typeof original !== "function") return;
  async function reroll(wrapped, message, ...args) {
    const context = message.flags.pf2e?.context;
    if (!context?.dc || !message.rolls?.[0]) return wrapped(message, ...args);
    const actor = message.actor;
    const target = context.target?.actor ? await fromUuid(context.target.actor) : null;
    const own = enabled() && actor?.type === "character" ? dreadOf(actor) : 0;
    const incoming = enabled() && context.type === "attack-roll" && target?.type === "character" && actor?.isEnemyOf?.(target) ? dreadOf(target) : 0;
    if (!context.tsuHorror && !own && !incoming) return wrapped(message, ...args);
    const flags = foundry.utils.deepClone(message.flags);
    flags.pf2e.context.tsuHorror = { own, incoming,
      base: context.tsuHorror?.base ?? [{ predicate: null, adjustments: context.dosAdjustments ?? {} }],
    };
    const prior = Roll.fromJSON(JSON.stringify(message.rolls[0].toJSON()));
    const id = foundry.utils.randomID();
    prior.options.tsuHorrorReroll = id;
    const adjustments = new RerollAdjustments(flags.pf2e.context, prior, enabled, label);
    flags.pf2e.context.dosAdjustments = adjustments;
    const hook = Hooks.on("pf2e.preReroll", (old, next) => { if (old.options.tsuHorrorReroll === id) adjustments.roll = next; });
    const proxy = new Proxy(message, { get(target, key) {
      if (key === "flags") return flags;
      if (key === "rolls") return [prior, ...message.rolls.slice(1)];
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    try { return await wrapped(proxy, ...args); }
    finally { Hooks.off("pf2e.preReroll", hook); }
  }
  if (globalThis.libWrapper?.register) libWrapper.register(MODULE_ID, "game.pf2e.Check.rerollFromMessage", function(wrapped, ...args) { return reroll(wrapped, ...args); }, "WRAPPER");
  else game.pf2e.Check.rerollFromMessage = function(...args) { return reroll(original.bind(this), ...args); };
  Hooks.on("preCreateChatMessage", (message) => {
    const adjustments = message.flags.pf2e?.context?.dosAdjustments;
    if (adjustments instanceof RerollAdjustments) message.updateSource({ "flags.pf2e.context.dosAdjustments": adjustments.toJSON() });
  });
}
