import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

globalThis.Hooks = { on() {}, once() {} };
const { floorLoadingEnabled, FLOOR_LOADING_FLAG } = await import("../scripts/utility/texture-presets.js?test=floor-loading");

const source = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("function visibleFloorTextureSources(");
const end = source.indexOf('Hooks.on("canvasTearDown"', start);
function fixture(floors, styles, { enabled = true, levels = 2 } = {}) {
  const hooks = {}, events = [];
  const scene = { levels: { size: levels }, getFlag: () => enabled };
  const board = { scene, level: { number: 1 }, loadTexturesOptions: { additionalSources: ["native.webp"] } };
  const context = vm.createContext({
    floorLoadingEnabled, scheduleRedraw: () => events.push("scheduled"),
    Hooks: { on: (name, callback) => { hooks[name] = callback; } },
    getSceneDataForScene: () => ({ floors }), FLOOR_STYLES: styles, DEFAULT_STYLE: "plain",
    normalizePolygon: (points) => points ?? [], getFloorNumberForNativeLevel: (level) => level.number,
    canvas: board, floorDataSnapshots: new Map(), regionSyncKey: () => "scene",
    currentLevel: 0, selectedLevel: 0, trackSceneWallStates() {}, bindStageEvents() {},
    redrawTimer: 99, clearTimeout: (id) => events.push(["cancel", id]), redrawNeedsFullPass: true,
    pendingForestFloorIds: new Set(["old"]), redrawFloors: () => events.push("floors"),
    redrawEditor: () => events.push("editor"), refreshFogConcealment: () => events.push("fog"),
    canManageFloorSurfaces: () => false,
  });
  vm.runInContext(source.slice(start, end), context);
  return { hooks, events, board, context };
}
const floor = (style, level = 1) => ({ style, level, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] });

test("level loading awaits only visible floor textures and their rendering dependencies", () => {
  const styles = {
    plain: { src: "active/floor.webp", edge: { texture: "edge.webp", corner: "corner.webp", rockAssets: [{ src: "rock.webp" }] }, scatter: { assets: [{ src: "flower.webp" }] } },
    garden: { src: "soil.webp", garden: { cropSrc: "crop.webp" } },
    rubble: { get src() { throw new Error("preview must not load"); }, rubble: { assets: [{ src: "rubble.webp" }] } },
    forest: { forest: { assets: [{ src: "tree.webp" }] } },
    overlay: { stretchedOverlay: { src: "overlay.webp" } },
    fog: { weather: "fog", src: "fog.webp" },
    upper: { get src() { throw new Error("upper floor must not load"); } },
    unused: { get src() { throw new Error("unused style must not load"); } },
  };
  const f = fixture([floor("plain", 0), floor("plain"), floor("garden"), floor("rubble"), floor("forest"), floor("overlay"), floor("fog", 0), floor("upper", 2)], styles);
  f.hooks.canvasInit(f.board);
  assert.deepEqual(f.board.loadTexturesOptions.additionalSources, ["native.webp", "active/floor.webp", "edge.webp", "corner.webp", "rock.webp", "flower.webp", "soil.webp", "crop.webp", "rubble.webp", "tree.webp", "overlay.webp"]);
});

test("floors are drawn synchronously before canvasReady returns on every level switch", () => {
  const f = fixture([], {});
  f.hooks.canvasReady();
  assert.deepEqual(f.events, [["cancel", 99], "floors", "editor", "fog"]);
  assert.equal(f.context.currentLevel, 1);
  assert.equal(f.context.redrawTimer, null);
  assert.equal(f.context.pendingForestFloorIds.size, 0);
  f.board.level.number = 2;
  f.hooks.canvasReady();
  assert.equal(f.context.currentLevel, 2);
  assert.equal(f.events.filter(event => event === "floors").length, 2);
});

for (const [name, enabled, levels] of [
  ["existing or new scenes without the flag", undefined, 2],
  ["explicitly disabled scenes", false, 2],
  ["single-level scenes even when checked", true, 1],
  ["string values do not silently enable the setting", "true", 2],
]) {
  test(`${name}: no preloading or synchronous floor draw`, () => {
    const f = fixture([floor("plain")], { plain: { get src() { throw new Error("must not resolve textures"); } } }, { enabled: false, levels });
    f.board.scene.getFlag = () => enabled;
    f.hooks.canvasInit(f.board);
    f.hooks.canvasReady();
    assert.deepEqual(f.board.loadTexturesOptions.additionalSources, ["native.webp"]);
    assert.deepEqual(f.events, ["scheduled", "fog"]);
  });
}

test("saved per-scene flag can be enabled and disabled without affecting another scene", () => {
  const f = fixture([floor("plain")], { plain: { src: "floor.webp" } }, { enabled: false });
  const flags = {};
  f.board.scene.getFlag = (module, key) => {
    assert.equal(module, "ts-pf2e-utility");
    return flags[key];
  };
  assert.equal(floorLoadingEnabled(f.board.scene), false);
  flags[FLOOR_LOADING_FLAG] = true;
  f.hooks.canvasInit(f.board);
  assert.deepEqual(f.board.loadTexturesOptions.additionalSources, ["native.webp", "floor.webp"]);
  assert.equal(floorLoadingEnabled({ levels: { size: 3 }, getFlag: () => undefined }), false);
  flags[FLOOR_LOADING_FLAG] = false;
  f.board.loadTexturesOptions.additionalSources = [];
  f.hooks.canvasInit(f.board);
  f.hooks.canvasReady();
  assert.deepEqual(f.board.loadTexturesOptions.additionalSources, []);
  assert.deepEqual(f.events, ["scheduled", "fog"]);
});
