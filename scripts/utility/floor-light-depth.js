const NAME = "tsu-floor-light-depth";

export function floorLightSurfaces(scene) {
  return (scene?.getSurfaces?.({ type: "light" }) ?? []).filter(surface =>
    surface.light && surface.region?.flags?.["ts-pf2e-utility"]?.floorSurface
    && Number.isFinite(surface.elevation));
}

// Foundry's depth texture stores ceilings in red and floors in green.
// Region collision alone does not contribute to this GPU lighting mask.
export function floorDepthColor(depth, ceiling) {
  const byte = Math.round(depth * 255);
  return ceiling ? (255 - byte) << 16 : byte << 8;
}

export function refreshFloorLightDepth(board) {
  const primary = board?.primary;
  if (!primary || !board.level || !board.masks?.depth) return;
  for (const child of [...primary.children]) {
    if (child.name !== NAME) continue;
    primary.removeChild(child);
    child.destroy({ children: true });
  }
  for (const surface of floorLightSurfaces(board.scene)) {
    const graphic = new PIXI.Graphics();
    graphic.name = NAME;
    graphic.eventMode = "none";
    graphic.elevation = surface.elevation;
    graphic.sortLayer = 0;
    graphic.sort = 0;
    graphic.shouldRenderDepth = true;
    graphic.blendMode = PIXI.BLEND_MODES.MAX_COLOR;
    graphic.beginFill(0xffffff);
    for (const shape of surface.region.shapes) {
      if (shape.type !== "polygon") continue;
      if (shape.hole) graphic.beginHole();
      graphic.drawPolygon(shape.points);
      if (shape.hole) graphic.endHole();
    }
    graphic.endFill();
    const render = graphic.render;
    graphic.render = () => {};
    graphic.renderDepthData = renderer => {
      graphic.tint = floorDepthColor(board.masks.depth.mapElevation(surface.elevation),
        surface.elevation > board.level.elevation.bottom);
      render.call(graphic, renderer);
    };
    primary.addChild(graphic);
  }
  primary.sortDirty = true;
  board.masks.depth._elevationDirty = true;
}

// Region synchronization is asynchronous and may finish after floor textures draw.
for (const event of ["createRegion", "updateRegion", "deleteRegion"]) {
  globalThis.Hooks?.on(event, region => {
    if (region.parent === globalThis.canvas?.scene
        && region.flags?.["ts-pf2e-utility"]?.floorSurface) refreshFloorLightDepth(canvas);
  });
}
for (const event of ["createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
  globalThis.Hooks?.on(event, behavior => {
    const region = behavior.parent;
    if (region?.parent === globalThis.canvas?.scene
        && region.flags?.["ts-pf2e-utility"]?.floorSurface) refreshFloorLightDepth(canvas);
  });
}
