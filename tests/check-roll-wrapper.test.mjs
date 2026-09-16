import assert from "node:assert/strict";
import test from "node:test";

for (const useLibWrapper of [true, false]) {
  test("check wrappers compose once and retain receiver, arguments and result: libWrapper=" + useLibWrapper, async () => {
    const calls = [];
    const result = {};
    let registrations = 0;
    const receiver = { async roll(...args) { calls.push(["original", this, args]); return result; } };
    globalThis.game = { pf2e: { Check: receiver } };
    globalThis.libWrapper = useLibWrapper ? {
      register(module, target, wrapper, type) {
        assert.equal(++registrations, 1);
        assert.equal(module, "ts-pf2e-utility");
        assert.equal(target, "game.pf2e.Check.roll");
        assert.equal(type, "WRAPPER");
        const original = receiver.roll;
        receiver.roll = function(...args) { return wrapper.call(this, original.bind(this), ...args); };
      },
    } : undefined;
    const { registerCheckRollWrapper } = await import("../scripts/utility/check-roll-wrapper.js?mode=" + useLibWrapper);
    const feature = (name) => async function(wrapped, ...args) {
      calls.push([name, this, args]);
      return wrapped(...args);
    };
    registerCheckRollWrapper("forest", feature("stale"));
    registerCheckRollWrapper("horror", feature("horror"));
    registerCheckRollWrapper("forest", feature("forest"));
    const args = [{}, {}, "extra"];
    assert.equal(await receiver.roll(...args), result);
    assert.deepEqual(calls.map(([name]) => name), ["horror", "forest", "original"]);
    for (const [, owner, values] of calls) {
      assert.equal(owner, receiver);
      assert.deepEqual(values, args);
    }
    assert.equal(registrations, useLibWrapper ? 1 : 0);
  });
}
