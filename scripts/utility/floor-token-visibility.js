const MODULE_ID = "ts-pf2e-utility";
const INSTALLED = Symbol("floorTokenVisibility");

// Match Foundry's top-down token culling even when token vision is active.
// A ray entering the lower level through a distant opening must not reveal a
// token whose entire footprint is covered by the floor we are looking at.
export function tokenCoveredByFloor(token, scene, viewedLevel) {
  const document = token?.document;
  if (!document || document.parent !== scene || !viewedLevel
      || document.level === viewedLevel.id || token.controlled || token.isPreview) return false;
  const elevation = document.getMovementOrigin?.().elevation;
  const ceiling = viewedLevel.elevation?.bottom;
  if (!Number.isFinite(elevation) || !Number.isFinite(ceiling) || elevation >= ceiling) return false;
  const surfaces = (scene.getSurfaces?.({ level: viewedLevel.id, culling: true }) ?? [])
    .filter(surface => surface.region?.flags?.[MODULE_ID]?.floorSurface
      && surface.sight && surface.elevation > elevation && surface.elevation <= ceiling);
  if (!surfaces.length) return false;
  const points = document.getOcclusionTestPoints?.() ?? [];
  return points.length > 0 && points.every(point => surfaces.some(surface =>
    surface.region.polygonTree.testPoint(point)));
}

export function installFloorTokenVisibility(board) {
  const visibility = board?.visibility;
  if (!visibility?.testVisibility || visibility[INSTALLED]) return;
  const original = visibility.testVisibility;
  visibility.testVisibility = function floorTokenVisibility(points, options = {}) {
    if (tokenCoveredByFloor(options.object, board.scene, board.level)) {
      options.object.detectionFilter = null;
      return false;
    }
    return original.call(this, points, options);
  };
  visibility[INSTALLED] = true;
}

globalThis.Hooks?.on("canvasReady", board => installFloorTokenVisibility(board));
