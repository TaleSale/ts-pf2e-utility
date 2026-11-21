// Each directed wall has two independent shadow sides, including open wall chains.
const SCALE = 100;

export function buildWallShadowBands(walls, { inner, outer, width }, lib = globalThis.ClipperLib) {
  if ((!inner && !outer) || !walls.length || !(width > 0)) return [];
  const toPath = points => points.map(({ x, y }) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
  const clip = (subject, clips, type, tree = false) => {
    const engine = new lib.Clipper(lib.Clipper.ioStrictlySimple);
    engine.AddPaths(subject, lib.PolyType.ptSubject, true);
    engine.AddPaths(clips, lib.PolyType.ptClip, true);
    const result = tree ? new lib.PolyTree() : new lib.Paths();
    engine.Execute(type, result, lib.PolyFillType.pftNonZero, lib.PolyFillType.pftNonZero);
    return result;
  };
  const groups = new Map();
  for (const wall of walls) {
    if (wall.castsShadow === false || Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) < 0.01) continue;
    const halfWidth = Math.max(0.5, wall.halfWidth ?? 0);
    if (!groups.has(halfWidth)) groups.set(halfWidth, []);
    groups.get(halfWidth).push(toPath([wall.a, wall.b]));
  }
  const buffer = extra => {
    const paths = [];
    for (const [halfWidth, lines] of groups) {
      const offset = new lib.ClipperOffset(2, SCALE * 0.25);
      offset.AddPaths(lines, lib.JoinType.jtRound, lib.EndType.etOpenRound);
      const shape = new lib.Paths();
      offset.Execute(shape, (halfWidth + extra) * SCALE);
      paths.push(...shape);
    }
    return clip(paths, [], lib.ClipType.ctUnion);
  };
  const base = buffer(0);
  let previous = base;
  const bands = [];
  const steps = 8;
  for (let step = 0; step < steps; step++) {
    const paths = [...base];
    for (const wall of walls) {
      if (wall.castsShadow === false || Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) < 0.01) continue;
      const radius = Math.max(0.5, wall.halfWidth ?? 0) + width * (step + 1) / steps;
      for (const side of [inner && wall.inner !== false ? 1 : 0, outer && wall.outer !== false ? -1 : 0]) {
        if (!side) continue;
        const path = toPath(wallShadowSide(wall, radius, side));
        if (!lib.Clipper.Orientation(path)) path.reverse();
        paths.push(path);
      }
    }
    const expanded = clip(paths, [], lib.ClipType.ctUnion);
    const ring = clip(expanded, previous, lib.ClipType.ctDifference);
    const tree = clip(ring, [], lib.ClipType.ctUnion, true);
    const polygons = [];
    for (let node = tree.GetFirst(); node; node = node.GetNext()) {
      if (node.IsHole()) continue;
      const fromPath = path => path.map(({ X, Y }) => ({ x: X / SCALE, y: Y / SCALE }));
      polygons.push({ points: fromPath(node.Contour()), holes: node.Childs().map(child => fromPath(child.Contour())) });
    }
    bands.push({ alpha: 0.62 * Math.pow(1 - step / steps, 1.4), polygons });
    previous = expanded;
  }
  return bands;
}

function wallShadowSide({ a, b }, radius, side) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
  const nx = -uy * side, ny = ux * side;
  // One half of a round-ended wall buffer, selected using the wall's direction.
  const points = [{ x: a.x - ux * radius, y: a.y - uy * radius }];
  const steps = Math.max(4, Math.min(64, Math.ceil(Math.PI / 2 / Math.acos(1 - Math.min(0.25 / radius, 1)))));
  for (const [center, start] of [[b, 0], [a, Math.PI / 2]]) {
    for (let i = 0; i <= steps; i++) {
      const angle = start + Math.PI / 2 * i / steps;
      points.push({ x: center.x + radius * (ux * Math.cos(angle) + nx * Math.sin(angle)),
        y: center.y + radius * (uy * Math.cos(angle) + ny * Math.sin(angle)) });
    }
  }
  return points;
}
