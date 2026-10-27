import assert from "node:assert/strict";
import test from "node:test";
import { floorLightSurfaces, floorDepthColor, refreshFloorLightDepth } from "../scripts/utility/floor-light-depth.js";

test("only managed light-blocking physical surfaces enter the depth mask", () => {
  const region = { flags: { "ts-pf2e-utility": { floorSurface: {} } } };
  const floor = { region, light: true, elevation: 20 };
  assert.deepEqual(floorLightSurfaces({ getSurfaces: () => [floor,
    { ...floor, light: false }, { ...floor, elevation: Infinity },
    { ...floor, region: {} }] }), [floor]);
});

test("depth channels reject lights across floors and ceilings but retain same-storey light", () => {
  const passes = (color, light) => light >= ((color >> 8) & 255) - 0.5
    && light <= 254.5 - ((color >> 16) & 255);
  assert.equal(passes(floorDepthColor(2 / 255, false), 1), false);
  assert.equal(passes(floorDepthColor(2 / 255, false), 2), true);
  assert.equal(passes(floorDepthColor(2 / 255, true), 2), false);
  assert.equal(passes(floorDepthColor(2 / 255, true), 1), true);
});

test("refresh preserves polygon openings and replaces masks without duplicates", () => {
  class Graphics {
    shapes = []; tint = 0;
    beginFill() {} endFill() {} beginHole() { this.hole = true; }
    endHole() { this.hole = false; }
    drawPolygon(points) { this.shapes.push({ points, hole: !!this.hole }); }
    render() { this.rendered = true; } destroy() { this.destroyed = true; }
  }
  globalThis.PIXI = { Graphics, BLEND_MODES: { MAX_COLOR: 16 } };
  try {
    const shapes = [{ type: "polygon", points: [0, 0, 100, 0, 100, 100, 0, 100] },
      { type: "polygon", hole: true, points: [20, 20, 40, 20, 40, 40, 20, 40] }];
    const floor = { light: true, elevation: 20, region: {
      flags: { "ts-pf2e-utility": { floorSurface: {} } }, shapes } };
    const primary = { children: [], addChild(c) { this.children.push(c); },
      removeChild(c) { this.children.splice(this.children.indexOf(c), 1); } };
    const board = { primary, scene: { getSurfaces: () => [floor] },
      level: { elevation: { bottom: 20 } }, masks: { depth: { mapElevation: () => 2 / 255 } } };
    refreshFloorLightDepth(board);
    const first = primary.children[0];
    first.render(); assert.equal(first.rendered, undefined);
    first.renderDepthData({}); assert.equal(first.tint, 0x000200);
    assert.deepEqual(first.shapes, shapes.map(s => ({ points: s.points, hole: !!s.hole })));
    board.level.elevation.bottom = 0;
    refreshFloorLightDepth(board);
    assert.equal(first.destroyed, true);
    assert.equal(primary.children.length, 1);
    primary.children[0].renderDepthData({});
    assert.equal(primary.children[0].tint, 0xfd0000);
  } finally { delete globalThis.PIXI; }
});
