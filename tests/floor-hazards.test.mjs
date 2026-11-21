import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const source = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function declaration(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}
test("drawn hazard regions follow creation, changes, deletion and undo", async () => {
  const scope = "ts-pf2e-utility", regions = [], changes = [];
  let floors = [{ id: "floor", style: "hazard-acid", points: [{x:0,y:0},{x:100,y:0},{x:100,y:100}], hazard: { damage: "2d6[acid]", save: "reflex", dc: 22 } }];
  const scene = { regions, createEmbeddedDocuments: async (_, entries) => {
    for (const entry of entries) regions.push({ ...entry, id: "region", _source: entry });
  } };
  const context = vm.createContext({ MODULE_ID: scope, SPELL_FLOOR_FLAG: "spellFloor", canManageFloorSurfaces: () => true,
    getSceneDataForScene: () => ({floors}), isHazardFloorStyle: style => style.startsWith("hazard-"), normalizePolygon: points => points,
    floorTouchesSyncScope: () => true, FLOOR_STYLES: {"hazard-acid": {}}, styleLabel: () => "Acid",
    floorSurfaceRegionData: (_, floor) => ({shapes: floor.points, elevation: {bottom:0,top:0,topInclusive:true}, levels:["ground"]}),
    deleteLiveRegions: async (_, ids) => { for (let i=regions.length-1;i>=0;i--) if(ids.has(regions[i].id)) regions.splice(i,1); },
    liveRegion: (_, id) => regions.find(r=>r.id===id), regionMatchesRubble: () => true, sameStringSet: () => true,
    updateLiveRegion: async (_, update) => { changes.push(update); const value=update[`flags.${scope}.spellFloor`]; if(value) regions[0].flags[scope].spellFloor=value; },
  });
  vm.runInContext(declaration("synchronizeHazardFloorRegions"),context);
  await context.synchronizeHazardFloorRegions(scene);
  assert.equal(regions.length,1);
  assert.equal(regions[0].flags[scope].spellFloor.damage,"2d6[acid]");
  assert.equal(regions[0].flags[scope].spellFloor.managedFloor,true);
  assert.equal(regions[0].behaviors.length,0);
  await context.synchronizeHazardFloorRegions(scene); assert.equal(changes.length,0);
  floors[0].hazard.damage="3d6[acid]";
  await context.synchronizeHazardFloorRegions(scene); assert.equal(regions[0].flags[scope].spellFloor.damage,"3d6[acid]");
  const previous=floors;floors=[];
  await context.synchronizeHazardFloorRegions(scene);assert.equal(regions.length,0);
  floors=previous;await context.synchronizeHazardFloorRegions(scene);assert.equal(regions.length,1);
});
