import assert from "node:assert/strict";
import test from "node:test";
import { tokenCoveredByFloor, installFloorTokenVisibility } from "../scripts/utility/floor-token-visibility.js";

function fixture() {
  const surface = { elevation: 10, sight: true, region: {
    flags: { "ts-pf2e-utility": { floorSurface: { floorId: "floor" } } },
    polygonTree: { testPoint: p => p.x >= 0 && p.x <= 100 },
  } };
  const scene = { getSurfaces: () => [surface] };
  const level = { id: "upper", elevation: { bottom: 10 } };
  const token = { detectionFilter: {}, document: {
    parent: scene, level: "lower", getMovementOrigin: () => ({ elevation: 0 }),
    getOcclusionTestPoints: () => [{ x: 20 }, { x: 80 }],
  } };
  let calls = 0;
  const visibility = { testVisibility() { assert.equal(this, visibility); calls++; return true; } };
  return { scene, level, token, surface, visibility, calls: () => calls };
}

test("covered lower token is rejected before lower-level sight and detection checks", () => {
  const f = fixture();
  installFloorTokenVisibility(f);
  installFloorTokenVisibility(f);
  assert.equal(f.visibility.testVisibility([], { object: f.token }), false);
  assert.equal(f.calls(), 0);
  assert.equal(f.token.detectionFilter, null);
});

test("openings and partially exposed tokens retain normal visibility", () => {
  const f = fixture();
  installFloorTokenVisibility(f);
  f.token.document.getOcclusionTestPoints = () => [{ x: 20 }, { x: 120 }];
  assert.equal(f.visibility.testVisibility([], { object: f.token }), true);
  assert.equal(f.calls(), 1);
  f.token.document.getOcclusionTestPoints = () => [{ x: 120 }];
  assert.equal(tokenCoveredByFloor(f.token, f.scene, f.level), false);
});

test("same-level, elevated, controlled, and preview tokens are unaffected", () => {
  for (const change of [
    f => { f.token.document.level = "upper"; },
    f => { f.token.document.getMovementOrigin = () => ({ elevation: 10 }); },
    f => { f.token.controlled = true; },
    f => { f.token.isPreview = true; },
  ]) {
    const f = fixture(); change(f);
    assert.equal(tokenCoveredByFloor(f.token, f.scene, f.level), false);
  }
});

test("only managed sight-blocking floors between token and viewed level apply", () => {
  for (const change of [
    f => { f.surface.region.flags = {}; },
    f => { f.surface.sight = false; },
    f => { f.surface.elevation = 0; },
    f => { f.surface.elevation = 20; },
  ]) {
    const f = fixture(); change(f);
    assert.equal(tokenCoveredByFloor(f.token, f.scene, f.level), false);
  }
});

test("multiple floor polygons can jointly cover a token; scene and level changes are read live", () => {
  const f = fixture();
  const second = { ...f.surface, region: { ...f.surface.region,
    polygonTree: { testPoint: p => p.x > 50 } } };
  f.surface.region.polygonTree.testPoint = p => p.x <= 50;
  f.scene.getSurfaces = () => [f.surface, second];
  installFloorTokenVisibility(f);
  assert.equal(f.visibility.testVisibility([], { object: f.token }), false);
  f.level = { id: "lower", elevation: { bottom: 0 } };
  assert.equal(f.visibility.testVisibility([], { object: f.token }), true);
  assert.equal(f.visibility.testVisibility({ x: 10 }), true);
});
