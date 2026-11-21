import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/utility/floor-textures.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const clipperSource = process.env.FOUNDRY_CLIPPER_PATH ? fs.readFileSync(process.env.FOUNDRY_CLIPPER_PATH, "utf8") : null;
const geometryTest = (name, fn) => test(name, { skip: !clipperSource && "Set FOUNDRY_CLIPPER_PATH to Foundry's scripts/clipper/clipper.js" }, fn);
function declaration(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}
function fixture(zoom = 1) {
  const saved = [];
  const context = vm.createContext({
    activeTool: "brush", CONTROL_NAME: "floors", EPSILON: 0.01,
    draftPoints: [], brushPointerId: null, brushStrokes: [], brushWidth: 1, brushPolygonCache: null, lastClick: null, selectedEdge: null,
    canvas: { dimensions: { size: 100 }, stage: { worldTransform: { a: zoom, b: 0 } } },
    navigator: { userAgent: "node" }, window: {}, document: { querySelector: () => null },
    currentControlName: () => "floors", eventOnCanvas: event => event.onCanvas !== false,
    eventPoint: event => ({ x: event.x, y: event.y }), redrawEditor: () => {},
    snapPoint: () => { throw new Error("Brush must not snap to the grid"); },
    addFloor: async (source, points) => saved.push({ source, points: structuredClone(points) }),
    getSceneData: () => ({ floors: [] }), storedFloor: (source, points) => ({ source, points }),
    setSceneData: async data => saved.push(structuredClone(data)),
    localize: (_key, fallback) => fallback, ui: { notifications: { warn: () => {} } },
    validSelectedFloorHazard: () => true, enabled: () => true, bindStageEvents: () => {},
  });
  if (clipperSource) {
    vm.runInContext(clipperSource, context);
    context.ClipperLib = context.window.ClipperLib;
  }
  for (const name of ["distance", "normalizePolygon", "polygonArea", "polygonBounds", "pointInPolygon", "brushDiameter", "buildBrushPolygons", "brushSimplePolygons", "brushWorldDistance", "appendBrushPoint", "onPointerDown", "onPointerMove", "onPointerUp", "finishDraft", "activateTool", "deactivateTool"]) {
    vm.runInContext(declaration(name), context);
  }
  const event = (x, y, extra = {}) => ({ x, y, pointerId: 1, button: 0, buttons: 1, ...extra });
  return { context, saved, event };
}

geometryTest("brush paints a thick area and saves all strokes only on double click", async () => {
  const { context: c, saved, event } = fixture();
  await c.onPointerDown(event(10.5, 10.5));
  for (const [x, y] of [[90.5, 10.5], [40.5, 40.5], [90.5, 90.5], [10.5, 90.5]]) c.onPointerMove(event(x, y));
  c.onPointerUp(event(10.5, 90.5, { type: "pointerup" }));
  assert.equal(saved.length, 0);
  assert.equal(c.brushPointerId, null);
  assert.equal(c.draftPoints.length, 5);
  c.onPointerMove(event(5, 50, { buttons: 0 }));
  assert.equal(c.draftPoints.length, 5);
  await c.onPointerDown(event(10.5, 90.5));
  assert.equal(c.brushStrokes.length, 2);
  c.onPointerUp(event(10.5, 90.5, { type: "pointerup" }));
  assert.equal(saved.length, 0);
  await c.onPointerDown(event(10.5, 90.5));
  assert.equal(saved.length, 1);
  assert.ok(saved[0].floors.length > 0);
  assert.equal(saved[0].floors[0].source, "manual");
  assert.ok(saved[0].floors[0].points.some(p => p.x < 0));
  assert.equal(c.draftPoints.length, 0);
  assert.equal(c.brushPointerId, null);
});

test("sampling follows zoom and release preserves the final short segment", async () => {
  const { context: c, event } = fixture(2);
  await c.onPointerDown(event(0, 0));
  c.onPointerMove(event(1, 0));
  assert.equal(c.draftPoints.length, 1);
  c.onPointerMove(event(2, 0));
  assert.equal(c.draftPoints.length, 2);
  c.onPointerUp(event(3, 0, { type: "pointerup" }));
  assert.equal(c.draftPoints.at(-1).x, 3);
});

test("a quick drag followed by a click at its endpoint does not finish the floor", async () => {
  const { context: c, saved, event } = fixture();
  await c.onPointerDown(event(0, 0));
  c.onPointerMove(event(50, 0));
  c.onPointerMove(event(50, 50));
  c.onPointerUp(event(50, 50, { type: "pointerup" }));
  await c.onPointerDown(event(50, 50));
  assert.equal(saved.length, 0);
  assert.equal(c.brushStrokes.length, 2);
  assert.equal(c.brushStrokes[0].length, 3);
});

test("release outside the canvas and pointer cancellation stop recording", async () => {
  const { context: c, event } = fixture();
  await c.onPointerDown(event(0, 0));
  c.onPointerUp(event(20, 20, { type: "pointerup", onCanvas: false }));
  c.onPointerMove(event(30, 30));
  assert.equal(c.draftPoints.length, 1);
  await c.onPointerDown(event(40, 40));
  c.onPointerUp(event(50, 50, { type: "pointercancel" }));
  assert.equal(c.brushPointerId, null);
  assert.equal(c.lastClick, null);
  assert.equal(c.brushStrokes.length, 2);
});

test("control rerenders preserve the contour; switching tools clears it", async () => {
  const { context: c, event } = fixture();
  await c.onPointerDown(event(0, 0));
  c.activateTool("brush");
  assert.equal(c.draftPoints.length, 1);
  c.activateTool("draw");
  assert.equal(c.draftPoints.length, 0);
  assert.equal(c.brushPointerId, null);
  assert.equal(c.lastClick, null);
  assert.equal(c.brushStrokes.length, 0);
});

geometryTest("straight stroke has the configured diameter and round caps", () => {
  const { context: c } = fixture();
  c.brushWidth = 0.4;
  c.brushStrokes = [[{ x: 0, y: 0 }, { x: 200, y: 0 }]];
  const [polygon] = c.buildBrushPolygons();
  const bounds = c.polygonBounds(polygon);
  assert.ok(Math.abs(bounds.height - 40) < 0.5);
  assert.ok(Math.abs(bounds.width - 240) < 0.5);
  assert.ok(c.pointInPolygon({ x: -10, y: 0 }, polygon));
  assert.ok(!c.pointInPolygon({ x: -19, y: 19 }, polygon));
  c.brushWidth = 0.8;
  assert.ok(Math.abs(c.polygonBounds(c.buildBrushPolygons()[0]).height - 80) < 0.5);
});

geometryTest("separate strokes have no connecting bridge and crossing strokes merge", () => {
  const { context: c } = fixture();
  c.brushWidth = 0.2;
  c.brushStrokes = [[{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 100 }, { x: 100, y: 100 }]];
  let polygons = c.buildBrushPolygons();
  assert.equal(polygons.length, 2);
  assert.ok(!polygons.some(p => c.pointInPolygon({ x: 50, y: 50 }, p)));
  c.brushStrokes.push([{ x: 50, y: -50 }, { x: 50, y: 150 }]);
  polygons = c.buildBrushPolygons();
  assert.equal(polygons.length, 1);
  assert.ok(c.pointInPolygon({ x: 50, y: 50 }, polygons[0]));
});

geometryTest("a loop keeps its interior unpainted and a single dab becomes a disk", () => {
  const { context: c } = fixture();
  c.brushWidth = 0.2;
  c.brushStrokes = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 }]];
  const polygons = c.buildBrushPolygons();
  assert.ok(polygons.length >= 2);
  assert.ok(!polygons.some(p => c.pointInPolygon({ x: 50, y: 50 }, p)));
  assert.ok(polygons.some(p => c.pointInPolygon({ x: 0, y: 50 }, p)));
  c.brushStrokes = [[{ x: 20, y: 20 }]];
  const [dab] = c.buildBrushPolygons();
  assert.ok(c.pointInPolygon({ x: 20, y: 20 }, dab));
  assert.ok(Math.abs(c.polygonBounds(dab).width - 20) < 0.5);
});
