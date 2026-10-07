import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function declaration(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}
const data = (...floors) => ({ version: 1, floors });
const floor = { id: "floor", style: "wood", level: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }], lines: [] };
function fixture(initial = data()) {
  const scene = {
    id: "one", value: structuredClone(initial), fail: false,
    async setFlag(_module, _flag, value) {
      if (this.fail) throw new Error("save failed");
      this.value = structuredClone(value);
    },
  };
  const syncs = [], notices = [];
  const context = vm.createContext({
    MODULE_ID: "test", FLAG_ROOT: "floorTextures", canvas: { scene }, game: { user: { isGM: true } },
    foundry: { utils: { deepClone: structuredClone } },
    floorUndoEntries: new Map(), floorDataSnapshots: new Map(), localFloorMutationDepth: new Map(),
    getSceneDataForScene: scene => structuredClone(scene.value),
    buildFloorSyncScope: (before, after) => ({ floorIds: new Set([...before.floors, ...after.floors].map(f => f.id)) }),
    floorSyncScopeEmpty: scope => !scope.floorIds.size,
    ensureNativeLevel: async () => {}, synchronizeLowerLevelVisibility: async () => {},
    queueFloorSurfaceSync: async scene => syncs.push(["surface", structuredClone(scene.value)]),
    queueRubbleRegionSync: async scene => syncs.push(["rubble", structuredClone(scene.value)]),
    enabled: () => true, localize: (_key, fallback) => fallback,
    ui: { notifications: { info: message => notices.push(message) } },
    draftPoints: [], selectedEdge: null, lastClick: null, redrawEditor: () => {},
  });
  for (const name of ["regionSyncKey", "beginLocalFloorMutation", "endLocalFloorMutation", "localFloorMutationInProgress", "setSceneData", "undoFloorAction"]) vm.runInContext(declaration(name), context);
  return { scene, context, syncs, notices };
}

for (const [name, before, after] of [
  ["creation", data(), data(floor)],
  ["deletion", data(floor), data()],
  ["style and level change", data(floor), data({ ...floor, style: "stone", level: 2 })],
  ["base floor replacement", data({ ...floor, source: "base" }), data({ ...floor, source: "base", style: "stone" })],
]) test(`undo restores ${name} and resynchronizes regions`, async () => {
  const f = fixture(before);
  await f.context.setSceneData(after);
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, before);
  assert.deepEqual(f.syncs.slice(-2), [["surface", before], ["rubble", before]]);
  assert.equal(f.context.floorUndoEntries.size, 0);
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, before);
  assert.equal(f.notices.length, 1);
});

test("no-op does not replace the last undo entry", async () => {
  const f = fixture();
  await f.context.setSceneData(data(floor));
  await f.context.setSceneData(data(floor));
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, data());
});

test("history is scene-specific and external edits are preserved", async () => {
  const f = fixture();
  await f.context.setSceneData(data(floor));
  f.context.canvas.scene = { ...f.scene, id: "two", value: data() };
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, data(floor));
  f.context.canvas.scene = f.scene;
  f.scene.value = data({ ...floor, style: "external" });
  await f.context.undoFloorAction();
  assert.equal(f.scene.value.floors[0].style, "external");
  assert.equal(f.context.floorUndoEntries.size, 0);
});

test("failed undo remains retryable and releases the mutation guard", async () => {
  const f = fixture();
  await f.context.setSceneData(data(floor));
  f.scene.fail = true;
  await assert.rejects(f.context.undoFloorAction(), /save failed/);
  assert.equal(f.context.floorUndoEntries.size, 1);
  assert.equal(f.context.localFloorMutationDepth.size, 0);
  f.scene.fail = false;
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, data());
});

test("undo is ignored while a floor mutation is running", async () => {
  const f = fixture();
  await f.context.setSceneData(data(floor));
  f.context.beginLocalFloorMutation(f.scene);
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, data(floor));
  f.context.endLocalFloorMutation(f.scene);
  await f.context.undoFloorAction();
  assert.deepEqual(f.scene.value, data());
});
