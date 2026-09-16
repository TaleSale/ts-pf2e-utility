import fs from "node:fs";
import vm from "node:vm";

// Read the installed PF2e bundle, not a reimplementation of its mathematics.
// Only Foundry document persistence, dice input and HTML rendering are fixtures.
export function loadNativePF2eChecks({ emit, messages }) {
  const source = fs.readFileSync(process.env.PF2E_SYSTEM_BUNDLE ?? new URL("../../../../systems/pf2e/pf2e.mjs", import.meta.url), "utf8");
  function between(start, end, offset = 0) {
    const a = source.indexOf(start, offset), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw Error("PF2e bundle layout changed: " + start);
    return source.slice(a, b);
  }
  const degree = between("class DegreeOfSuccess {", "}, It = {") + "}";
  const amounts = between("It = {", "}, Lt = {") + "}";
  const predicate = between("class Predicate extends Array {", "}, StatementValidator =") + "}";
  const validator = between("StatementValidator = class {", "}, AutomaticBonusProgression$1 =") + "}";
  const checkRoll = between("class CheckRoll extends Roll {", "}, StrikeAttackRoll =") + "}";
  const checkStart = source.indexOf("ha = class Check {");
  const rollMethod = between("\tstatic async roll(", "\n\tstatic #createTagFlavor", checkStart);
  const rerollMethod = between("\tstatic async rerollFromMessage(", "\n\tstatic async renderReroll", checkStart);
  const dice = [];
  function clone(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(clone);
    if (value.constructor?.name !== "Object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, data]) => [key, clone(data)]));
  }
  class Die {
    faces = 20;
    constructor(results) { this.results = results; this.modifiers = []; }
    get total() { return this.results.filter((r) => r.active && !r.discarded).reduce((sum, r) => sum + r.result, 0); }
  }
  class NumericTerm { constructor(number) { this.total = number; } }
  let NativeCheckRoll;
  class Roll {
    constructor(formula, data = {}, options = {}) { this.formula = formula; this.data = data; this.options = options; this.dice = []; this.terms = []; }
    async evaluate() {
      if (this._evaluated) return this;
      const count = Number(/^(\d+)d20/.exec(this.formula)?.[1] ?? 0);
      if (count) {
        const results = Array.from({ length: count }, () => ({ result: dice.shift(), active: true }));
        if (results.some((r) => !Number.isInteger(r.result))) throw Error("No deterministic test die supplied");
        if (count > 1) {
          const best = this.formula.includes("kl") ? Math.min(...results.map((r) => r.result)) : Math.max(...results.map((r) => r.result));
          let kept = false;
          for (const result of results) { result.active = result.result === best && !kept; result.discarded = !result.active; kept ||= result.active; }
        }
        this.dice = [new Die(results)]; this.terms = this.dice;
        this.total = this.dice[0].total + (this.options.totalModifier ?? 0);
      } else {
        const value = Number.parseInt(this.formula); this.isDeterministic = true;
        this.terms = [new NumericTerm(value)]; this.total = value + (this.options.totalModifier ?? 0);
      }
      this._evaluated = true; return this;
    }
    clone() { return new NativeCheckRoll(this.formula, clone(this.data), clone(this.options)); }
    toJSON() { return { formula: this.formula, data: this.data, options: this.options, total: this.total,
      results: this.dice.map((die) => die.results), evaluated: this._evaluated }; }
    static fromJSON(json) {
      const data = JSON.parse(json), roll = new NativeCheckRoll(data.formula, data.data, data.options);
      roll.total = data.total; roll.dice = (data.results ?? []).map((results) => new Die(results));
      roll.terms = roll.dice; roll._evaluated = data.evaluated; return roll;
    }
    async toMessage(data, options = {}) {
      const message = new ChatMessagePF2e({ ...data, rolls: [this] });
      if (options.create !== false) { emit("preCreateChatMessage", message); emit("createChatMessage", message); }
      messages.push(message); return message;
    }
  }
  class ChatMessagePF2e {
    constructor(data) {
      Object.assign(this, data); this.flags = JSON.parse(JSON.stringify(data.flags ?? {}));
      this.actor = data.actor ?? globalThis.fromUuidSync(this.flags.pf2e?.context?.origin?.actor);
      this.id = "native-message-" + messages.length; this.isAuthor = true;
    }
    static getSpeaker({ actor, token }) { return { actor: actor?.id, token: token?.id, scene: token?.parent?.id }; }
    static async create(data) { const message = new ChatMessagePF2e(data); messages.push(message); return message; }
    getFlag(module, key) { return this.flags[module]?.[key]; }
    async setFlag(module, key, value) { (this.flags[module] ??= {})[key] = value; }
    async delete() { this.deleted = true; }
    updateSource(change) { for (const [path, value] of Object.entries(change)) globalThis.foundry.utils.setProperty(this, path, value); }
  }
  const element = () => ({ innerHTML: "", outerHTML: "", dataset: {}, classList: { add() {} }, append() {}, querySelector: () => null });
  const sandbox = { Roll, game: globalThis.game, foundry: globalThis.foundry, Hooks: globalThis.Hooks,
    CONFIG: { ChatMessage: { modes: { public: {}, gm: {}, blind: {} } } },
    document: { createElement: element }, ChatMessagePF2e, ui: globalThis.ui, console,
    N: (value) => value != null && typeof value === "object" && !Array.isArray(value),
    _loc: (key) => key, reduceItemName: (name) => name, sluggify: (s) => s, Rt: ["criticalFailure", "failure", "success", "criticalSuccess"],
    objectHasKey: (o, k) => Object.hasOwn(o, k), o: (v) => v !== null && v !== undefined && v !== false,
    me: Boolean, signedInteger: (value) => value ? (value > 0 ? "+" : "") + value : "",
    Ri: class { static notesToHTML() { return ""; } }, R: (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]])),
    createHTMLElement: element, isCheckContextFlag: (c) => !!c?.type,
    ErrorPF2e: (message) => Error(message), fontAwesomeIcon: element, htmlQuery: () => null,
    fromUuidSync: globalThis.fromUuidSync, gs: class {}, is: class {},
    treatWoundsMacroCallback: (data) => sandbox.lastTreatWounds = data,
  };
  globalThis.foundry.dice = { terms: { Die, NumericTerm } };
  globalThis.foundry.utils.deepClone = clone;
  const context = vm.createContext(sandbox);
  vm.runInContext(`Math.clamp = (v, min, max) => Math.max(min, Math.min(max, v)); const ${validator}; const NativePredicate = ${predicate}; const ${amounts}; const Ft = ${degree}; const ma = ${checkRoll};
    class Check { ${rollMethod} ${rerollMethod}
      static #createTagFlavor() { return []; }
      static async #createResultFlavor({degree}) { return degree ? "degree:" + degree.value : ""; }
      static async renderReroll(roll) { return "degree:" + roll.degreeOfSuccess; }
    }
    globalThis.native = { Check, CheckRoll: ma, DegreeOfSuccess: Ft, Predicate: NativePredicate };`, context);
  NativeCheckRoll = sandbox.native.CheckRoll;
  globalThis.Roll = Roll; globalThis.ChatMessage = ChatMessagePF2e;
  return { ...sandbox.native, dice, sandbox, clone };
}
