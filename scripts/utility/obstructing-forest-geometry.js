const EPSILON = 1e-7;

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function interpolate(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function normalizePolygon(points) {
  const normalized = (Array.isArray(points) ? points : [])
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (normalized.length > 1 && Math.hypot(normalized[0].x - normalized.at(-1).x, normalized[0].y - normalized.at(-1).y) <= EPSILON) {
    normalized.pop();
  }
  return normalized;
}

function pointOnSegment(point, a, b) {
  const ab = subtract(b, a);
  const ap = subtract(point, a);
  if (Math.abs(cross(ab, ap)) > EPSILON) return false;
  const dot = ap.x * ab.x + ap.y * ab.y;
  const lengthSquared = ab.x * ab.x + ab.y * ab.y;
  return dot >= -EPSILON && dot <= lengthSquared + EPSILON;
}

function pointStrictlyInsidePolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[previous];
    const b = polygon[index];
    if (pointOnSegment(point, a, b)) return false;
    const crossesRay = (a.y > point.y) !== (b.y > point.y);
    if (crossesRay && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function edgeIntersectionParameters(origin, destination, a, b) {
  const ray = subtract(destination, origin);
  const edge = subtract(b, a);
  const offset = subtract(a, origin);
  const denominator = cross(ray, edge);
  if (Math.abs(denominator) > EPSILON) {
    const t = cross(offset, edge) / denominator;
    const u = cross(offset, ray) / denominator;
    return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON
      ? [Math.max(0, Math.min(1, t))]
      : [];
  }
  if (Math.abs(cross(offset, ray)) > EPSILON) return [];
  const lengthSquared = ray.x * ray.x + ray.y * ray.y;
  if (lengthSquared <= EPSILON) return [];
  return [a, b].map((point) => {
    const relative = subtract(point, origin);
    const t = (relative.x * ray.x + relative.y * ray.y) / lengthSquared;
    return Math.max(0, Math.min(1, t));
  });
}

function uniqueSorted(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.filter((value, index) => index === 0 || Math.abs(value - sorted[index - 1]) > EPSILON);
}

export function segmentPolygonIntervals(origin, destination, points) {
  const polygon = normalizePolygon(points);
  if (polygon.length < 3 || Math.hypot(destination.x - origin.x, destination.y - origin.y) <= EPSILON) return [];
  const parameters = [0, 1];
  for (let index = 0; index < polygon.length; index += 1) {
    parameters.push(...edgeIntersectionParameters(origin, destination, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  const sorted = uniqueSorted(parameters);
  const intervals = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    if (end - start <= EPSILON) continue;
    if (pointStrictlyInsidePolygon(interpolate(origin, destination, (start + end) / 2), polygon)) intervals.push([start, end]);
  }
  return intervals;
}

export function mergeIntervals(intervals) {
  const ordered = (Array.isArray(intervals) ? intervals : [])
    .map(([start, end]) => [Math.max(0, Math.min(1, Number(start))), Math.max(0, Math.min(1, Number(end)))])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end - start > EPSILON)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1] + EPSILON) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

export function forestIntervals(origin, destination, polygons) {
  return mergeIntervals((Array.isArray(polygons) ? polygons : []).flatMap((polygon) => segmentPolygonIntervals(origin, destination, polygon)));
}

export function buildMeasuredForestWaypoints(origin, destination, intervals) {
  const merged = mergeIntervals(intervals);
  if (!merged.length) return [];
  const waypoints = [{ x: origin.x, y: origin.y }];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor + EPSILON) waypoints.push({ ...interpolate(origin, destination, start), measure: false });
    waypoints.push({ ...interpolate(origin, destination, end), measure: true });
    cursor = end;
  }
  return waypoints;
}

export function closestFootprintCenterPair(sourceCenters, targetCenters, sourceCenter, targetCenter) {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const from = [...sourceCenters].sort((a, b) => distance(a, targetCenter) - distance(b, targetCenter))[0] ?? sourceCenter;
  const to = [...targetCenters].sort((a, b) => distance(a, sourceCenter) - distance(b, sourceCenter))[0] ?? targetCenter;
  return { origin: from, destination: to };
}

export function coverLevelForForestDistance(distance) {
  const feet = Number(distance);
  if (!Number.isFinite(feet) || feet < 15 - EPSILON) return null;
  if (feet < 30 - EPSILON) return "lesser";
  if (feet < 60 - EPSILON) return "standard";
  return "greater";
}
