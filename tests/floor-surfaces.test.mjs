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
function fixture({ existing = true, light = true, sight = false, sound = false, version = 4 } = {}) {
  const behavior = { id: "behavior", type: "defineSurface", system: { light, sight, sound, culling: true } };
  const region = {
    id: "region", behaviors: [behavior],
    flags: { "ts-pf2e-utility": { floorSurface: { floorId: "floor", version } } },
    _source: { visibility: 4, highlightMode: "shapes", levels: ["upper"], elevation: { bottom: 10, top: 10 } },
  };
  const updates = [], created = [], regionUpdates = [];
  const floor = { id: "floor", level: 1 };
  const shape = { type: "polygon", points: [0, 0, 100, 0, 100, 100, 0, 100] };
  const scene = { regions: existing ? [region] : [], createEmbeddedDocuments: async (_, data) => created.push(...data) };
  const context = vm.createContext({
    MODULE_ID: "ts-pf2e-utility", FLOOR_SURFACE_REGION_FLAG: "floorSurface", FLOOR_SURFACE_REGION_VERSION: 5,
    canManageFloorSurfaces: () => true, synchronizeLowerLevelVisibility: async () => {},
    getSceneDataForScene: () => ({ floors: [floor] }), physicalFloor: () => true,
    floorTouchesSyncScope: () => true, regionTouchesSyncScope: () => true,
    deleteLiveRegions: async () => {}, liveRegion: (_, id) => scene.regions.find(r => r.id === id),
    findNativeLevel: () => ({ id: "upper", elevation: { bottom: 10 } }),
    sameStringSet: (a, b) => JSON.stringify(a) === JSON.stringify(b), regionMatchesRubble: () => true,
    updateLiveRegion: async (_, update) => {
      regionUpdates.push(update);
      if (update["flags.ts-pf2e-utility.floorSurface"]) {
        region.flags["ts-pf2e-utility"].floorSurface = update["flags.ts-pf2e-utility.floorSurface"];
      }
      return region;
    },
    updateLiveRegionBehavior: async (_, id, update) => {
      updates.push(update);
      for (const [key, value] of Object.entries(update)) if (key.startsWith("system.")) behavior.system[key.slice(7)] = value;
    },
    localize: (_, fallback) => fallback, rubbleRegionShape: () => shape,
  });
  for (const name of ["floorSurfaceBehaviorData", "floorSurfaceBehavior", "floorSurfaceRegionLink", "floorSurfacePlacement", "floorSurfaceRegionData", "synchronizeFloorSurfaceRegions"]) {
    vm.runInContext(declaration(name), context);
  }
  return { run: () => context.synchronizeFloorSurfaceRegions(scene), updates, regionUpdates, created, shape };
}

test("existing light-blocking floors gain sight blocking and synchronize idempotently", async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.updates.length, 1);
  assert.equal(f.updates[0]["system.sight"], true);
  assert.equal(f.updates[0]["system.sound"], true);
  assert.equal(f.updates[0]["system.light"], undefined);
  await f.run();
  assert.equal(f.updates.length, 1);
});

test("older floors restore both light and sight blocking together", async () => {
  const f = fixture({ light: false });
  await f.run();
  assert.equal(f.updates[0]["system.light"], true);
  assert.equal(f.updates[0]["system.sight"], true);
});

test("new sight-blocking surfaces retain the exact floor footprint and elevation", async () => {
  const f = fixture({ existing: false });
  await f.run();
  const surface = f.created[0];
  assert.equal(surface.shapes.length, 1);
  assert.equal(surface.shapes[0], f.shape);
  assert.equal(surface.elevation.bottom, 10);
  assert.equal(surface.elevation.top, 10);
  assert.equal(surface.behaviors[0].system.sight, true);
  assert.equal(surface.behaviors[0].system.sound, true);
  assert.equal(surface.behaviors[0].system.move, false);
  assert.equal(surface.flags["ts-pf2e-utility"].floorSurface.version, 5);
});

test("version 4 floors gain sound blocking without recreation or repeated writes", async () => {
  const f = fixture({ sight: true });
  await f.run();
  assert.equal(f.updates.length, 1);
  assert.deepEqual(Object.keys(f.updates[0]).sort(), ["_id", "system.sound"]);
  assert.equal(f.updates[0]["system.sound"], true);
  assert.equal(f.regionUpdates[0]["flags.ts-pf2e-utility.floorSurface"].version, 5);
  await f.run();
  assert.equal(f.updates.length, 1);
  assert.equal(f.regionUpdates.length, 1);
  assert.equal(f.created.length, 0);
});

test("current sound-blocking floors need no writes", async () => {
  const f = fixture({ sight: true, sound: true, version: 5 });
  await f.run();
  assert.equal(f.updates.length, 0);
  assert.equal(f.regionUpdates.length, 0);
  assert.equal(f.created.length, 0);
});
