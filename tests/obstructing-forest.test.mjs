import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeasuredForestWaypoints,
  closestFootprintCenterPair,
  coverLevelForForestDistance,
  forestIntervals,
  mergeIntervals,
  segmentPolygonIntervals,
} from "../scripts/utility/obstructing-forest-geometry.js";

const rectangle = (x1, y1, x2, y2) => [
  { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
];

test("a line outside the forest has no intervals", () => {
  assert.deepEqual(segmentPolygonIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, rectangle(20, 10, 80, 30)), []);
});

test("a line enters and exits a forest", () => {
  assert.deepEqual(segmentPolygonIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, rectangle(20, -10, 60, 10)), [[0.2, 0.6]]);
});

test("a line starting inside a forest measures from its origin", () => {
  assert.deepEqual(segmentPolygonIntervals({ x: 40, y: 0 }, { x: 100, y: 0 }, rectangle(20, -10, 60, 10)), [[0, 1 / 3]]);
});

test("separate forests remain separate and open gaps are unmeasured", () => {
  const origin = { x: 0, y: 0 };
  const destination = { x: 100, y: 0 };
  const intervals = forestIntervals(origin, destination, [rectangle(20, -5, 40, 5), rectangle(60, -5, 90, 5)]);
  assert.deepEqual(intervals, [[0.2, 0.4], [0.6, 0.9]]);
  assert.deepEqual(buildMeasuredForestWaypoints(origin, destination, intervals), [
    { x: 0, y: 0 },
    { x: 20, y: 0, measure: false },
    { x: 40, y: 0, measure: true },
    { x: 60, y: 0, measure: false },
    { x: 90, y: 0, measure: true },
  ]);
});

test("overlapping forest polygons are merged", () => {
  assert.deepEqual(mergeIntervals([[0.2, 0.6], [0.4, 0.8], [0.9, 1]]), [[0.2, 0.8], [0.9, 1]]);
  assert.deepEqual(forestIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, [
    rectangle(20, -5, 60, 5), rectangle(40, -5, 80, 5),
  ]), [[0.2, 0.8]]);
});

test("a concave polygon produces multiple intervals", () => {
  const concave = [
    { x: 10, y: -30 }, { x: 90, y: -30 }, { x: 90, y: 30 }, { x: 70, y: 30 },
    { x: 70, y: -10 }, { x: 30, y: -10 }, { x: 30, y: 30 }, { x: 10, y: 30 },
  ];
  assert.deepEqual(segmentPolygonIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, concave), [[0.1, 0.3], [0.7, 0.9]]);
});

test("touching a boundary does not create false forest length", () => {
  assert.deepEqual(segmentPolygonIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, rectangle(20, 0, 80, 20)), []);
  assert.deepEqual(segmentPolygonIntervals({ x: 0, y: 0 }, { x: 100, y: 0 }, [
    { x: 50, y: 0 }, { x: 60, y: 10 }, { x: 40, y: 10 },
  ]), []);
});

test("cover thresholds are inclusive at 15, 30, and 60 feet", () => {
  assert.equal(coverLevelForForestDistance(14), null);
  assert.equal(coverLevelForForestDistance(15), "lesser");
  assert.equal(coverLevelForForestDistance(29), "lesser");
  assert.equal(coverLevelForForestDistance(30), "standard");
  assert.equal(coverLevelForForestDistance(59), "standard");
  assert.equal(coverLevelForForestDistance(60), "greater");
});

test("20 open feet plus 20 forest feet yields lesser cover", () => {
  const origin = { x: 0, y: 0 };
  const destination = { x: 40, y: 0 };
  const intervals = forestIntervals(origin, destination, [rectangle(20, -5, 40, 5)]);
  const waypoints = buildMeasuredForestWaypoints(origin, destination, intervals);
  const measured = waypoints.slice(1).reduce((sum, waypoint, index) => {
    if (waypoint.measure === false) return sum;
    const previous = waypoints[index];
    return sum + Math.hypot(waypoint.x - previous.x, waypoint.y - previous.y);
  }, 0);
  assert.equal(measured, 20);
  assert.equal(coverLevelForForestDistance(measured), "lesser");
});

test("large tokens use the occupied cell centers nearest the other token", () => {
  const pair = closestFootprintCenterPair(
    [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 5, y: 15 }, { x: 15, y: 15 }],
    [{ x: 35, y: 5 }, { x: 45, y: 5 }],
    { x: 10, y: 10 },
    { x: 40, y: 5 },
  );
  assert.deepEqual(pair, { origin: { x: 15, y: 5 }, destination: { x: 35, y: 5 } });
});

test("diagonal forest segments remain in one measured path", () => {
  assert.deepEqual(buildMeasuredForestWaypoints(
    { x: 0, y: 0 },
    { x: 40, y: 40 },
    [[0.25, 0.5], [0.75, 1]],
  ), [
    { x: 0, y: 0 },
    { x: 10, y: 10, measure: false },
    { x: 20, y: 20, measure: true },
    { x: 30, y: 30, measure: false },
    { x: 40, y: 40, measure: true },
  ]);
});
