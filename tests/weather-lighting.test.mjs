import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const source = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const declaration = (name) => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
};
test("lighting regions follow creation, shape, level, style changes and deletion without duplicates", async () => {
  const floor = { id: "f", style: "bright", level: 0, points: [1, 2, 3] };
  let floors = [floor], writes = 0;
  const scene = { regions: [], async createEmbeddedDocuments(type, entries) {
    for (const data of entries) this.regions.push({ ...data, id: "r", _source: data, behaviors: data.behaviors.map(b => ({ ...b, id: "b" })) });
    writes++;
  } };
  const context = vm.createContext({
    MODULE_ID: "test", FLOOR_STYLES: { bright: { weather: "lighting", darkness: 0, fallback: "Bright" }, dark: { weather: "lighting", darkness: 1, fallback: "Dark" } },
    t: (_, fallback) => fallback, canManageFloorSurfaces: () => true,
    getSceneDataForScene: () => ({ floors }), normalizePolygon: p => p,
    floorTouchesSyncScope: () => true,
    floorSurfaceRegionData: (_, f) => ({ shapes: [f.points], levels: [f.level], flags: {} }),
    liveRegion: (_, id) => scene.regions.find(r => r.id === id),
    deleteLiveRegions: async (_, ids) => { scene.regions = scene.regions.filter(r => !ids.has(r.id)); },
    regionMatchesRubble: (r, f) => JSON.stringify(r.shapes[0]) === JSON.stringify(f.points),
    sameStringSet: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    updateLiveRegion: async (_, data) => { Object.assign(scene.regions[0], data); Object.assign(scene.regions[0]._source, data); writes++; },
    updateLiveRegionBehavior: async (_, id, data) => { Object.assign(scene.regions[0].behaviors[0], data); writes++; },
  });
  for (const name of ["weatherLightingRegionData", "synchronizeWeatherLightingRegions"]) vm.runInContext(declaration(name), context);
  const sync = () => context.synchronizeWeatherLightingRegions(scene);
  await sync();
  assert.equal(scene.regions.length, 1);
  assert.equal(scene.regions[0].behaviors[0].system.modifier, 0);
  assert.equal(scene.regions[0].elevation.bottom, null);
  assert.equal(scene.regions[0].flags.test.floorSurface, undefined);
  await sync(); assert.equal(writes, 1);
  floor.points = [4, 5, 6]; floor.level = 2; floor.style = "dark";
  await sync();
  assert.deepEqual(scene.regions[0].shapes[0], floor.points);
  assert.equal(scene.regions[0].levels[0], 2);
  assert.equal(scene.regions[0].behaviors[0].system.modifier, 1);
  floor.style = "ordinary-floor";
  await sync(); assert.equal(scene.regions.length, 0);
  floor.style = "bright";
  await sync(); assert.equal(scene.regions.length, 1);
  floors = [];
  await sync(); assert.equal(scene.regions.length, 0);
});
