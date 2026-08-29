import { MODULE_ID } from "../core.js";
import { ASSETS } from "./scene-assets.js?v=20260829-warehouse-balance-v42";
import { BASTION_TEXTURE_PRESET } from "./texture-presets.js?v=20260829-warehouse-balance-v42";

const GALLERY_FLAG = "bastionGallery";

const FLOOR_STYLES = Object.freeze([
  ["uneven-limestone", "Uneven limestone"], ["cave-brown", "Brown cave"],
  ["cave-grey-pebbles", "Grey cave pebbles"], ["flagstone-grey", "Grey flagstone"],
  ["brick-red", "Red brick"], ["wood-walnut", "Walnut boards"], ["wood-alder", "Alder boards"],
  ["wood-continuous", "Continuous wood grain"],
  ["wood-outdoor", "Outdoor boards"], ["grass-meadow", "Meadow grass"], ["swamp", "Swamp"], ["path-dirt", "Dirt path"],
  ["path-cobblestone", "Cobblestone path"], ["carpet-red", "Red carpet"],
  ["carpet-blue", "Blue carpet"], ["carpet-red-ornate", "Ornate red carpet"],
  ["carpet-blue-heraldic", "Heraldic blue carpet"], ["carpet-green-gold", "Green-gold carpet"],
  ["garden-cabbage", "Cabbage garden"], ["garden-carrot", "Carrot garden"],
  ["garden-rice", "Rice garden"], ["garden-herbs", "Herb garden"],
  ["forest-deciduous", "Deciduous forest"], ["forest-pine", "Pine forest"],
  ["forest-mixed", "Mixed forest"], ["sea-shallow", "Shallow sea"], ["sea-deep", "Deep sea"],
  ["sea-stormy", "Stormy sea"], ["roof-thatch", "Thatch roof"], ["roof-shingles", "Shingle roof"],
  ["roof-tiles", "Tile roof"],
  ["stairs-uneven-limestone-vertical-up", "Limestone stairs ↑"], ["stairs-uneven-limestone-horizontal-right", "Limestone stairs →"],
  ["stairs-flagstone-grey-vertical-up", "Flagstone stairs ↑"], ["stairs-flagstone-grey-horizontal-right", "Flagstone stairs →"],
  ["stairs-brick-red-vertical-up", "Brick stairs ↑"], ["stairs-brick-red-horizontal-right", "Brick stairs →"],
  ["stairs-wood-walnut-vertical-up", "Walnut stairs ↑"], ["stairs-wood-walnut-horizontal-right", "Walnut stairs →"],
  ["stairs-wood-alder-vertical-up", "Alder stairs ↑"], ["stairs-wood-alder-horizontal-right", "Alder stairs →"],
  ["stairs-wood-outdoor-vertical-up", "Outdoor stairs ↑"], ["stairs-wood-outdoor-horizontal-right", "Outdoor stairs →"],
]);

const WALL_STYLES = Object.freeze([
  ["brick-grey-dense", "wall", "Dense grey brick"], ["brick-grey", "wall", "Grey brick"],
  ["brick-red", "wall", "Red brick"], ["metal-iron", "wall", "Iron"], ["wood-nut", "wall", "Walnut"],
  ["wood-alder", "wall", "Alder"], ["hedge-maze", "wall", "Maze hedge"],
  ["border-wood-stone", "border", "Wood and stone border"],
  ["border-green-fog", "border", "Green fog border"], ["border-curtain-red", "border", "Red curtain"],
  ["border-curtain-blue", "border", "Blue curtain"], ["border-curtain-gold", "border", "Ochre curtain"],
  ["cliff-coastal", "border", "Coastal cliff"], ["cliff-limestone", "border", "Limestone cliff"],
  ["cliff-sandy", "border", "Sandy cliff"], ["cliff-volcanic", "border", "Volcanic cliff"],
]);

const WINDOW_STYLES = Object.freeze([
  ["window-wood", "Walnut window"], ["window-iron", "Iron window"],
  ["window-stained", "Stained window"], ["arrow-slit-straight", "Straight arrow slit"],
  ["arrow-slit-cross", "Splayed arrow slit"],
]);

function randomId() {
  return foundry.utils.randomID?.() ?? crypto.randomUUID();
}

function drawing(text, x, y, width, height = 44, fontSize = 24) {
  return {
    shape: { type: "r", width, height }, x, y, fillColor: "#101419", fillAlpha: 0.78,
    strokeColor: "#7f6d4c", strokeAlpha: 0.9, strokeWidth: 2,
    text, fontSize, textColor: "#e2d6bc", textAlpha: 1, textStrokeColor: "#090b0e", textStrokeWidth: 4,
    flags: { [MODULE_ID]: { [GALLERY_FLAG]: true } },
  };
}

function assetTile(key, asset, x, y, grid) {
  const height = Math.max(30, Math.round(asset.size * grid));
  const width = Math.max(30, Math.round(height * asset.aspect));
  return {
    name: `Bastion — ${asset.fallback}`,
    texture: { src: asset.src, anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1 },
    x, y, width, height, rotation: Number(asset.defaultRotation ?? 0), elevation: 0,
    sort: asset.layer === "ground" ? -100 : asset.layer === "overhead" ? 100 : 0,
    restrictions: { light: false, weather: false },
    flags: { [MODULE_ID]: { sceneAsset: { key, layer: asset.layer, level: 0, lightId: null }, [GALLERY_FLAG]: true } },
  };
}

async function clearPrevious(scene) {
  for (const type of ["Tile", "Wall", "Drawing"]) {
    const collection = type === "Tile" ? scene.tiles : type === "Wall" ? scene.walls : scene.drawings;
    const ids = [...collection].filter((document) => document.flags?.[MODULE_ID]?.[GALLERY_FLAG]).map((document) => document.id);
    if (ids.length) await scene.deleteEmbeddedDocuments(type, ids);
  }
}

export async function populateBastionGallery(sceneName = "1234") {
  if (!game.user?.isGM) throw new Error("Only a GM can populate the Bastion gallery.");
  const scene = game.scenes.find((candidate) => candidate.name === sceneName || candidate.id === sceneName);
  if (!scene) throw new Error(`Scene not found: ${sceneName}`);
  if (canvas.scene?.id !== scene.id) await scene.view();

  await clearPrevious(scene);
  await scene.setFlag(MODULE_ID, "texturePreset", BASTION_TEXTURE_PRESET);
  await game.settings.set(MODULE_ID, "enableFloorTextures", true);
  await game.settings.set(MODULE_ID, "enableWallTextures", true);
  await game.settings.set(MODULE_ID, "enableSceneAssets", true);

  const grid = Number(scene.grid?.size ?? canvas.dimensions?.size ?? 100);
  const margin = grid;
  const cellW = grid * 3.2;
  const cellH = grid * 2.8;
  const floorColumns = 8;
  const floorCellW = grid * 3.3;
  const floorCellH = grid * 2.55;
  const floorStartY = margin + grid * 0.8;
  const floors = FLOOR_STYLES.map(([style, label], index) => {
    const column = index % floorColumns;
    const row = Math.floor(index / floorColumns);
    const x = margin + column * floorCellW;
    const y = floorStartY + row * floorCellH;
    return {
      id: randomId(), source: "manual", style, level: 0,
      points: [{ x, y }, { x: x + grid * 2.75, y }, { x: x + grid * 2.75, y: y + grid * 1.8 }, { x, y: y + grid * 1.8 }],
      lines: [], galleryLabel: label,
    };
  });

  const floorRows = Math.ceil(FLOOR_STYLES.length / floorColumns);
  const wallStartY = floorStartY + floorRows * floorCellH + grid;
  const wallDocs = [];
  for (const [index, [style, mode, label]] of WALL_STYLES.entries()) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = margin + column * grid * 6.6;
    const y = wallStartY + row * grid * 1.25;
    wallDocs.push({ c: [x, y, x + grid * 5.2, y], flags: { [MODULE_ID]: { wallTexture: { enabled: true, mode, style, flipX: false, flipY: false }, [GALLERY_FLAG]: true } } });
  }
  const windowStartY = wallStartY + Math.ceil(WALL_STYLES.length / 4) * grid * 1.25 + grid * 0.5;
  for (const [index, [style, label]] of WINDOW_STYLES.entries()) {
    const x = margin + index * grid * 5.25;
    const y = windowStartY;
    const proximity = CONST.EDGE_SENSE_TYPES?.PROXIMITY ?? CONST.WALL_SENSE_TYPES?.PROXIMITY ?? 30;
    wallDocs.push({ c: [x, y, x + grid * 4.3, y], door: CONST.WALL_DOOR_TYPES?.NONE ?? 0, light: proximity, sight: proximity,
      flags: { [MODULE_ID]: { wallTexture: { enabled: true, mode: "window", style, flipX: false, flipY: false }, [GALLERY_FLAG]: true } } });
  }

  const assetEntries = Object.entries(ASSETS);
  const assetStartY = windowStartY + grid * 2.3;
  const assetColumns = 9;
  const galleryWidth = Math.ceil(margin * 2 + Math.max(floorColumns * floorCellW, assetColumns * cellW));
  const galleryHeight = Math.ceil(assetStartY + Math.ceil(assetEntries.length / assetColumns) * cellH + grid);
  if (Number(scene.width) < galleryWidth || Number(scene.height) < galleryHeight) {
    await scene.update({ width: Math.max(Number(scene.width), galleryWidth), height: Math.max(Number(scene.height), galleryHeight) });
  }
  const tileDocs = assetEntries.map(([key, asset], index) => {
    const column = index % assetColumns;
    const row = Math.floor(index / assetColumns);
    return assetTile(key, asset, margin + grid * 1.3 + column * cellW, assetStartY + grid * 1.3 + row * cellH, grid);
  });

  const labels = [drawing("BASTION OF BLASPHEMY — FLOORS & ROOFS", margin, margin * 0.2, grid * 25, grid * 0.5, 32),
    drawing("WALLS, BORDERS & WINDOWS", margin, wallStartY - grid * 0.7, grid * 25, grid * 0.5, 30),
    drawing("SCENE ASSETS", margin, assetStartY - grid * 0.7, grid * 25, grid * 0.5, 30)];
  floors.forEach((floor) => {
    const minX = Math.min(...floor.points.map((point) => point.x));
    const minY = Math.min(...floor.points.map((point) => point.y));
    labels.push(drawing(floor.galleryLabel, minX, minY + grid * 1.85, grid * 2.75, grid * 0.38, 16));
    delete floor.galleryLabel;
  });
  assetEntries.forEach(([, asset], index) => {
    const column = index % assetColumns;
    const row = Math.floor(index / assetColumns);
    labels.push(drawing(asset.fallback, margin + column * cellW, assetStartY + row * cellH + grid * 2.25, grid * 2.6, grid * 0.34, 14));
  });

  await scene.setFlag(MODULE_ID, "floorTextures", { version: 1, floors });
  if (wallDocs.length) await scene.createEmbeddedDocuments("Wall", wallDocs);
  for (let index = 0; index < tileDocs.length; index += 50) await scene.createEmbeddedDocuments("Tile", tileDocs.slice(index, index + 50));
  for (let index = 0; index < labels.length; index += 50) await scene.createEmbeddedDocuments("Drawing", labels.slice(index, index + 50));

  Hooks.callAll(`${MODULE_ID}.texturePresetChanged`, BASTION_TEXTURE_PRESET, scene);
  await scene.setFlag(MODULE_ID, `${GALLERY_FLAG}Version`, "20260813-gallery3");
  await canvas.draw();
  return { scene: scene.name, preset: BASTION_TEXTURE_PRESET, floors: floors.length, walls: wallDocs.length, assets: tileDocs.length, labels: labels.length, width: galleryWidth, height: galleryHeight };
}

Hooks.once("ready", () => {
  globalThis.TS_PF2E_UTILITY ??= {};
  globalThis.TS_PF2E_UTILITY.populateBastionGallery = populateBastionGallery;
  const scene = game.scenes.find((candidate) => candidate.name === "1234" || candidate.id === "1234");
  if (game.user?.isGM && scene && scene.getFlag(MODULE_ID, `${GALLERY_FLAG}Version`) !== "20260813-gallery3") {
    populateBastionGallery(scene.id).then((result) => {
      ui.notifications?.info(`Bastion gallery populated: ${result.floors} floors, ${result.walls} wall styles, ${result.assets} assets.`);
    }).catch((error) => {
      console.error(`${MODULE_ID} | Failed to populate Bastion gallery`, error);
      ui.notifications?.error(`Failed to populate Bastion gallery: ${error.message}`);
    });
  }
});
