import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hooks = {};
globalThis.Hooks = { on(name, callback) { (hooks[name] ??= []).push(callback); } };
globalThis.canvas = { level: { id: "ground" } };
const { melodyTier, performanceOutcome, tokenAtInstrument, instrumentKey, MELODY_TIERS, PERFORMANCE_OUTCOMES } = await import("../scripts/utility/musical-instruments.js");
const roll = (total, natural = 10) => ({ total, dice: [{ faces: 20, results: [{ result: natural }] }] });

test("performance bands use total and natural extremes override modifiers", () => {
  for (const [total, expected] of [[-20, "minus15"], [5, "minus15"], [9, "minus15"], [10, "minus10"], [14, "minus10"], [15, "minus5"], [19, "minus5"], [20, "dc"], [24, "dc"], [25, "plus5"], [30, "plus10"], [35, "plus15"], [90, "plus15"]]) assert.equal(melodyTier(roll(total)), expected);
  assert.equal(melodyTier(roll(50, 1)), "natural1");
  assert.equal(melodyTier(roll(0, 20)), "natural20");
  assert.equal(melodyTier({ total: 22, dice: [{ faces: 20, results: [{ result: 1, active: false }, { result: 20, discarded: true }, { result: 10 }] }] }), "dc");
});

test("instrument occupancy respects grid cells, hidden objects, levels and token size", () => {
  const scene = { grid: { size: 100 } };
  const token = { parent: scene, x: 0, y: 0, width: 1, height: 1 };
  const tile = { parent: scene, x: 60, y: 60, width: 40, height: 40, texture: { anchorX: 0, anchorY: 0 } };
  assert.equal(tokenAtInstrument(token, tile), true);
  assert.equal(tokenAtInstrument(token, { ...tile, x: 100 }), false);
  assert.equal(tokenAtInstrument({ ...token, width: 2 }, { ...tile, x: 100 }), true);
  assert.equal(tokenAtInstrument(token, { ...tile, hidden: true }), false);
  assert.equal(tokenAtInstrument(token, { ...tile, includedInLevel: () => false }), false);
  assert.equal(tokenAtInstrument({ ...token, hidden: true }, tile), false);
  const grid = { getOffset: () => ({ i: 1, j: 1 }), getOffsetRange: () => [0, 0, 2, 2] };
  assert.equal(tokenAtInstrument(token, tile, grid), true);
});

test("final PF2e degree controls quality independently of natural die and total", () => {
  assert.equal(performanceOutcome(roll(10), "criticalFailure"), "criticalFailure");
  assert.equal(performanceOutcome(roll(5), "failure"), "failure");
  assert.equal(performanceOutcome(roll(30), "success"), "success");
  assert.equal(performanceOutcome(roll(25), "criticalSuccess"), "criticalSuccess");
  assert.equal(performanceOutcome(roll(10)), "criticalFailure");
  assert.equal(performanceOutcome(roll(11)), "failure");
  assert.equal(performanceOutcome(roll(20)), "success");
  assert.equal(performanceOutcome(roll(30)), "criticalSuccess");
  assert.equal(performanceOutcome(roll(25, 1)), "failure");
  assert.equal(performanceOutcome(roll(15, 20)), "success");
  for (let degree = 0; degree < 4; degree++) assert.equal(performanceOutcome(roll(20), degree), PERFORMANCE_OUTCOMES[degree]);
});

test("every instrument has nine valid WAV variants for each final degree", () => {
  for (const instrument of ["piano", "grandPiano", "drums", "harp"]) {
    for (const outcome of PERFORMANCE_OUTCOMES) {
    for (const tier of MELODY_TIERS) {
      const bytes = fs.readFileSync(new URL(`../audio/instruments/${instrument}/${outcome}/${tier}.wav`, import.meta.url));
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
      assert.equal(bytes.readUInt32LE(24), 22050);
      assert.ok(bytes.length > 40000);
    }
    }
  }
});

test("only the four instrument asset keys enable interaction", () => {
  for (const [key, filename] of [["piano", "piano-topdown-v2.webp"], ["grandPiano", "grand-piano-fixed.webp"], ["drums", "drums.webp"], ["harp", "harp-topdown-v2-fixed.webp"]]) {
    assert.equal(instrumentKey({ flags: { "ts-pf2e-utility": { sceneAsset: { key } } } }), key);
    assert.equal(instrumentKey({ texture: { src: `modules/ts-pf2e-utility/images/scene-assets/${filename}` } }), null);
    assert.equal(instrumentKey({ texture: { src: `modules/ts-pf2e-utility/images/presets/bastion-blasphemy/scene-assets/${filename}?v=3` } }), null);
  }
  assert.equal(instrumentKey({ texture: { src: "other/drums.webp" } }), null);
  assert.equal(instrumentKey({ flags: { "ts-pf2e-utility": { sceneAsset: { key: "musicStandSheetMusic" } } } }), null);
});

test("image bounds and rotation never enable neighbouring cells", () => {
  const parent = { grid: { size: 100 } };
  const token = { parent, x: 0, y: 0, width: 1, height: 1 };
  assert.equal(tokenAtInstrument(token, { parent, x: 150, y: 45, width: 200, height: 90 }), false);
  assert.equal(tokenAtInstrument(token, { parent, x: 150, y: 150, width: 50, height: 200, rotation: 90 }), false);
  assert.equal(tokenAtInstrument(token, { parent, x: 200, y: 200, width: 50, height: 200, rotation: 90 }), false);
  for (const key of ["piano", "grandPiano", "drums", "harp"]) {
    const tile = { parent, x: 50, y: 50, width: 120, height: 120, rotation: 45, flags: { "ts-pf2e-utility": { sceneAsset: { key } } } };
    assert.equal(tokenAtInstrument(token, tile), true);
    for (const [x, y] of [[0, 100], [100, 0], [-100, 0], [0, -100], [100, 100]]) {
      assert.equal(tokenAtInstrument({ ...token, x, y }, tile), false, `${key}: neighbouring cell ${x},${y}`);
    }
  }
});

test("native grid offsets account for scene padding", () => {
  const parent = { grid: { size: 100 } };
  const grid = { getOffset: (point) => ({ i: Math.floor((point.y - 37) / 100), j: Math.floor((point.x - 23) / 100) }) };
  const token = { parent, x: 23, y: 37, width: 1, height: 1 };
  const tile = { parent, x: 73, y: 87, width: 120, height: 120 };
  assert.equal(tokenAtInstrument(token, tile, grid), true);
  assert.equal(tokenAtInstrument({ ...token, y: 137 }, tile, grid), false);
});

test("melodies play once on their scene and respect private rolls and hidden tiles", async () => {
  const calls = [];
  globalThis.foundry = { audio: { AudioHelper: { async play(data, broadcast) { calls.push({ data, broadcast }); return { async stop() {} }; } } } };
  const tile = { hidden: false, includedInLevel: () => true };
  canvas.scene = { id: "scene-a", tiles: { get: () => tile } };
  const flag = { sceneId: "scene-a", tileId: "tile", key: "piano", tier: "dc", outcome: "success" };
  const changed = { flags: { "ts-pf2e-utility": { instrumentPerformance: flag } } };
  const emit = async (message, change = changed) => {
    hooks.updateChatMessage[0](message, change);
    await new Promise((resolve) => setImmediate(resolve));
  };
  await emit({ id: "private", isContentVisible: false });
  await emit({ id: "other-scene", isContentVisible: true }, { flags: { "ts-pf2e-utility": { instrumentPerformance: { ...flag, sceneId: "elsewhere" } } } });
  tile.hidden = true;
  await emit({ id: "hidden", isContentVisible: true });
  tile.hidden = false;
  assert.equal(calls.length, 0);
  await emit({ id: "public", isContentVisible: true });
  await emit({ id: "public", isContentVisible: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.src, "modules/ts-pf2e-utility/audio/instruments/piano/success/dc.wav?v=3");
  assert.equal(calls[0].broadcast, false);
  for (const key of ["piano", "grandPiano", "drums", "harp"]) {
    for (const outcome of PERFORMANCE_OUTCOMES) {
      await emit({ id: `${key}-${outcome}`, isContentVisible: true }, { flags: { "ts-pf2e-utility": { instrumentPerformance: { ...flag, key, outcome } } } });
      assert.equal(calls.at(-1).data.src, `modules/ts-pf2e-utility/audio/instruments/${key}/${outcome}/dc.wav?v=3`);
    }
  }
  assert.equal(calls.length, 17);
});


test("Foundry 14 centre-anchored drums never activate the cell below", () => {
  const parent = { grid: { size: 100 } };
  const grid = {
    getOffset: ({x, y}) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }),
    getOffsetRange: ({x, y, width, height}) => [Math.floor(y / 100), Math.floor(x / 100), Math.ceil((y + height) / 100), Math.ceil((x + width) / 100)],
  };
  for (const key of ["piano", "grandPiano", "drums", "harp"]) {
    const tile = { parent, x: 150, y: 150, width: 100, height: 106,
      texture: { anchorX: .5, anchorY: .5 }, flags: { "ts-pf2e-utility": { sceneAsset: { key } } } };
    const token = { parent, x: 100, y: 100, width: 1, height: 1 };
    assert.equal(tokenAtInstrument(token, tile, grid), true);
    assert.equal(tokenAtInstrument({ ...token, y: 200 }, tile, grid), false);
    assert.equal(tokenAtInstrument({ ...token, x: 200, y: 200 }, tile, grid), false);
    assert.equal(tokenAtInstrument({ ...token, x: 200 }, tile, grid), false);
    assert.equal(tokenAtInstrument(token, { ...tile, x: 250, y: 250, shape: { center: { x: 150, y: 150 } } }, grid), true);
  }
});
