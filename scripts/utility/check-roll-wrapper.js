import { MODULE_ID } from "../core.js";

const wrappers = new Map();
let installed = false;

// libWrapper allows one registration per package and target.
// Compose feature wrappers here, with the latest registration outermost.
export function registerCheckRollWrapper(key, wrapper) {
  if (!installed) {
    const original = game.pf2e?.Check?.roll;
    if (!original) return;
    function dispatch(wrapped, ...args) {
      let next = wrapped;
      for (const feature of wrappers.values()) {
        const inner = next;
        next = (...values) => feature.call(this, inner, ...values);
      }
      return next(...args);
    }
    if (globalThis.libWrapper?.register) {
      globalThis.libWrapper.register(MODULE_ID, "game.pf2e.Check.roll", dispatch, "WRAPPER");
    } else {
      game.pf2e.Check.roll = function(...args) {
        return dispatch.call(this, original.bind(this), ...args);
      };
    }
    installed = true;
  }
  wrappers.set(key, wrapper);
}
