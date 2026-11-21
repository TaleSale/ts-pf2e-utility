import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { buildWallShadowBands } from "../scripts/utility/wall-shadow-geometry.js";

let clipper;
if (process.env.FOUNDRY_CLIPPER_PATH) {
  const context = vm.createContext({ window: {}, document: {}, navigator: { userAgent: "node" } });
  vm.runInContext(fs.readFileSync(process.env.FOUNDRY_CLIPPER_PATH, "utf8"), context);
  clipper = context.window.ClipperLib;
}
const geometryTest = (name, fn) => test(name, { skip: !clipper && "Set FOUNDRY_CLIPPER_PATH to Foundry's scripts/clipper/clipper.js" }, fn);
const segment = (x, y, xx, yy, extra = {}) => ({ a: { x, y }, b: { x: xx, y: yy }, halfWidth: 10, ...extra });
const square = () => [segment(0, 0, 200, 0), segment(200, 0, 200, 200), segment(200, 200, 0, 200), segment(0, 200, 0, 0)];
function contains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const shadowAt = (bands, x, y) => bands.some(band => band.polygons.some(p => contains(p.points, x, y) && !p.holes.some(h => contains(h, x, y))));

geometryTest("an isolated wall casts independent shadows on either side", () => {
  const walls = [segment(0, 0, 200, 0)];
  const inner = buildWallShadowBands(walls, { inner: true, outer: false, width: 14 }, clipper);
  const outer = buildWallShadowBands(walls, { inner: false, outer: true, width: 14 }, clipper);
  assert.ok(shadowAt(inner, 100, 13));
  assert.ok(!shadowAt(inner, 100, -13));
  assert.ok(shadowAt(outer, 100, -13));
  assert.ok(!shadowAt(outer, 100, 13));
});

geometryTest("vertical and diagonal walls use the perpendicular side of their own direction", () => {
  for (const wall of [segment(0, 0, 0, 200), segment(0, 0, 200, 200)]) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const nx = -(wall.b.y - wall.a.y) / length, ny = (wall.b.x - wall.a.x) / length;
    const x = (wall.a.x + wall.b.x) / 2, y = (wall.a.y + wall.b.y) / 2;
    const inner = buildWallShadowBands([wall], { inner: true, outer: false, width: 14 }, clipper);
    assert.ok(shadowAt(inner, x + nx * 13, y + ny * 13));
    assert.ok(!shadowAt(inner, x - nx * 13, y - ny * 13));
    const reversed = buildWallShadowBands([{ ...wall, a: wall.b, b: wall.a }], { inner: true, outer: false, width: 14 }, clipper);
    assert.ok(shadowAt(reversed, x - nx * 13, y - ny * 13));
    assert.ok(!shadowAt(reversed, x + nx * 13, y + ny * 13));
  }
});

geometryTest("small dark inner and outer shadows stay on their corresponding sides", () => {
  const inner = buildWallShadowBands(square(), { inner: true, outer: false, width: 14 }, clipper);
  const outer = buildWallShadowBands(square(), { inner: false, outer: true, width: 14 }, clipper);
  assert.ok(shadowAt(inner, 100, 13));
  assert.ok(!shadowAt(inner, 100, -13));
  assert.ok(shadowAt(outer, 100, -13));
  assert.ok(!shadowAt(outer, 100, 13));
  assert.ok(!shadowAt(inner, 100, 30));
  assert.ok(!shadowAt(inner, 100, 100));
  assert.ok(!shadowAt(inner, 100, 5));
  assert.ok(inner[0].alpha >= 0.6);
  assert.ok(inner.at(-1).alpha < 0.05);
  assert.ok(inner.every((band, index) => !index || band.alpha < inner[index - 1].alpha));
});

geometryTest("partitions use two wall sides even inside an enclosed room", () => {
  const walls = [...square(), segment(100, 0, 100, 200)];
  const inner = buildWallShadowBands(walls, { inner: true, outer: false, width: 14 }, clipper);
  const outer = buildWallShadowBands(walls, { inner: false, outer: true, width: 14 }, clipper);
  assert.ok(shadowAt(inner, 87, 100));
  assert.ok(!shadowAt(inner, 113, 100));
  assert.ok(!shadowAt(outer, 87, 100));
  assert.ok(shadowAt(outer, 113, 100));
});

geometryTest("an open doorway leaves both shadow sides clear", () => {
  const walls = square().slice(1);
  walls.push(segment(0, 0, 60, 0), segment(60, 0, 140, 0, { castsShadow: false }), segment(140, 0, 200, 0));
  const bands = buildWallShadowBands(walls, { inner: true, outer: true, width: 14 }, clipper);
  assert.ok(!shadowAt(bands, 100, 13));
  assert.ok(!shadowAt(bands, 100, -13));
  assert.ok(shadowAt(bands, 30, 13));
});

geometryTest("both buttons may be enabled together and disabling both yields no geometry", () => {
  const bands = buildWallShadowBands(square(), { inner: true, outer: true, width: 14 }, clipper);
  assert.ok(shadowAt(bands, 100, 13));
  assert.ok(shadowAt(bands, 100, -13));
  assert.deepEqual(buildWallShadowBands(square(), { inner: false, outer: false, width: 14 }, clipper), []);
});

const source = fs.readFileSync(new URL("../scripts/utility/wall-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function declaration(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

test("shadow toggles affect only current selection and retain other sides and legacy defaults", async () => {
  const flags = [{}, {}, {}], updates = [];
  const walls = flags.map((value, index) => ({ id: String(index), getFlag: () => value }));
  const scene = { id: "scene", getFlag: () => ({ inner: true, outer: false }),
    updateEmbeddedDocuments: async (type, changes) => {
      assert.equal(type, "Wall");
      updates.push(...changes);
      for (const change of changes) for (const [key, value] of Object.entries(change)) {
        if (key !== "_id") flags[Number(change._id)][key.split(".").at(-1)] = value;
      }
    } };
  const canvas = { scene, walls: { controlled: [{ document: walls[0] }] } };
  const context = vm.createContext({
    canvas, MODULE_ID: "test", WALL_SHADOW_FLAG: "wallShadows", wallShadowUpdates: new Set(),
    bulkToolActive: false, bulkToolEnabled: () => true, scheduleWallTextureRedraw: () => {},
    selectedBulkWallDocuments: () => [walls[2]],
    ui: { controls: { render: () => {} } },
  });
  for (const name of ["isEnabled", "bulkWallDocument", "selectedShadowWallDocuments", "wallShadowEnabled", "selectedWallsHaveShadow", "setWallShadowEnabled"])
    vm.runInContext(declaration(name), context);
  assert.equal(context.selectedWallsHaveShadow("inner"), true);
  await context.setWallShadowEnabled("inner", false);
  assert.deepEqual(flags, [{ inner: false }, {}, {}]);
  canvas.walls.controlled = [{ document: walls[1] }];
  await context.setWallShadowEnabled("outer", true);
  assert.deepEqual(flags, [{ inner: false }, { outer: true }, {}]);
  assert.equal(context.wallShadowEnabled(walls[1], "inner"), true);
  canvas.walls.controlled = [];
  await context.setWallShadowEnabled("inner", true);
  assert.equal(updates.length, 2);
  assert.equal(context.selectedWallsHaveShadow("inner"), false);
  context.bulkToolActive = true;
  await context.setWallShadowEnabled("outer", true);
  assert.deepEqual(flags[2], { outer: true });
  canvas.walls.controlled = [{ document: walls[0] }, { document: walls[1] }];
  context.bulkToolActive = false;
  assert.equal(context.selectedWallsHaveShadow("inner"), false);
  await context.setWallShadowEnabled("inner", true);
  assert.equal(context.selectedWallsHaveShadow("inner"), true);
});

geometryTest("individual walls cast only their configured shadow sides", () => {
  const walls = [segment(0, 0, 200, 0, { inner: true, outer: false }),
    segment(0, 200, 200, 200, { inner: false, outer: true }),
    segment(0, 400, 200, 400, { inner: false, outer: false })];
  const bands = buildWallShadowBands(walls, { inner: true, outer: true, width: 14 }, clipper);
  assert.ok(shadowAt(bands, 100, 13));
  assert.ok(!shadowAt(bands, 100, -13));
  assert.ok(shadowAt(bands, 100, 187));
  assert.ok(!shadowAt(bands, 100, 213));
  assert.ok(!shadowAt(bands, 100, 387));
  assert.ok(!shadowAt(bands, 100, 413));
});

test("render inputs respect levels, open doors, windows, and decorative borders", () => {
  const walls = [
    { c: [0, 0, 100, 0], move: 20 },
    { c: [0, 0, 100, 0], move: 20, door: 1, ds: 1 },
    { c: [0, 0, 100, 0], move: 20, window: true },
    { c: [0, 0, 100, 0], move: 20, flags: { enabled: true, style: "border" } },
    { c: [0, 0, 100, 0], move: 20, includedInLevel: () => false },
    { c: [0, 0, 100, 0], move: 0 },
  ];
  const context = vm.createContext({
    canvas: { scene: { walls: { contents: walls } } },
    wallShadowEnabled: () => true,
    getFlagData: wall => wall.flags ?? {}, isWindowWall: wall => wall.window,
    getStyleDefinition: style => ({ borderOnly: style === "border" }), getStyleTargetWidth: () => 22,
  });
  for (const name of ["isEnabled", "getWallCoords", "wallShadowSegments"]) vm.runInContext(declaration(name), context);
  const segments = context.wallShadowSegments({ id: "ground" });
  assert.equal(segments.length, 4);
  assert.deepEqual(Array.from(segments, wall => wall.castsShadow), [true, false, false, false]);
});
