import { MODULE_ID, i18nKey, t } from "../core.js";
import {
  BASTION_TEXTURE_PRESET,
  currentTexturePreset,
  resolvePresetTexture,
  TEXTURE_PRESET_CHANGE_HOOK,
} from "./texture-presets.js?v=20260916-floor-loading-v102";
import { installFogConcealment } from "./fog-visibility.js?v=20260913-weather-fog-v14";

const SETTING_ENABLE = "enableFloorTextures";
const FLAG_ROOT = "floorTextures";
const CONTROL_NAME = "tsu-floors";
const FLOOR_CONTAINER = "tsu-floor-textures";
const COBWEB_ABOVE_CONTAINER = "tsu-cobweb-floor-above";
const WEATHER_CONTAINER = "tsu-weather-floor-above";
const FOREST_CONTAINER = "tsu-forest-textures";
const EDIT_CONTAINER = "tsu-floor-edit";
const DEFAULT_STYLE = "uneven-limestone";
const HIGH_RES_GRASS_SCALE = 0.4;
const HIGH_RES_FLOOR_SCALE = 0.25;
const DEEP_SEA_FLOOR_SCALE = 0.45;
const STORMY_SEA_FLOOR_SCALE = 0.55;
const DIFFICULT_TERRAIN_COST = 2;
const GREATER_DIFFICULT_TERRAIN_COST = 3;
const EPSILON = 0.01;
const FLOOR_EDGE_WIDTH = 15;
const LEVEL_NUMBER_FLAG = "floorLevelNumber";
const RUBBLE_REGION_FLAG = "rubbleDifficultTerrain";
const RUBBLE_REGION_VERSION = 1;
const FLOOR_SURFACE_REGION_FLAG = "floorSurface";
const FLOOR_SURFACE_REGION_VERSION = 4;
const MANAGED_LOWER_VISIBILITY_FLAG = "managedLowerFloorVisibility";
const SETTING_VISIBILITY_MIGRATION = "floorVisibilityMigration";
const FLOOR_VISIBILITY_MIGRATION_VERSION = 1;
const regionSyncs = new Map();
const localFloorMutationDepth = new Map();
const floorDataSnapshots = new Map();
const floorUndoEntries = new Map();
let refreshFogConcealment = () => {};
// Rubble pools must be initialized before FLOOR_STYLES calls rubbleStyle().
// Keeping the images external; this is only the registry of their paths and geometry.
const RUBBLE_ASSET_POOLS = Object.freeze({
  stone: Object.freeze([
    rubbleAsset("rubble-cutout-stone-01-v16.webp", 0.3451, 0.3674),
    rubbleAsset("rubble-cutout-stone-02-v16.webp", 0.3674, 0.3451),
    rubbleAsset("rubble-cutout-stone-03-v16.webp", 0.3451, 0.3674),
    rubbleAsset("rubble-cutout-stone-04-v16.webp", 0.3674, 0.3451),
    rubbleAsset("rubble-cutout-stone-05-v16.webp", 0.5047, 0.4898),
    rubbleAsset("rubble-cutout-stone-06-v16.webp", 0.4676, 0.501),
    rubbleAsset("rubble-cutout-stone-07-v16.webp", 0.4676, 0.501),
    rubbleAsset("rubble-cutout-stone-08-v16.webp", 0.4305, 0.4119),
    rubbleAsset("rubble-cutout-stone-09-v16.webp", 0.4156, 0.4305),
    rubbleAsset("rubble-cutout-stone-10-v16.webp", 0.7756, 1.0391),
    rubbleAsset("rubble-cutout-stone-11-v16.webp", 1.0428, 0.7719),
    rubbleAsset("rubble-cutout-stone-12-v16.webp", 0.8758, 0.6271),
  ]),
  boards: Object.freeze([
    rubbleAsset("rubble-cutout-boards-01-v16.webp", 0.3971, 0.3971),
    rubbleAsset("rubble-cutout-boards-02-v16.webp", 0.3971, 0.3266),
    rubbleAsset("rubble-cutout-boards-03-v16.webp", 0.3266, 0.3971),
    rubbleAsset("rubble-cutout-boards-04-v16.webp", 0.3971, 0.6049),
    rubbleAsset("rubble-cutout-boards-05-v16.webp", 0.4824, 0.5826),
    rubbleAsset("rubble-cutout-boards-06-v16.webp", 0.4824, 0.5826),
    rubbleAsset("rubble-cutout-boards-07-v16.webp", 0.6123, 0.4268),
    rubbleAsset("rubble-cutout-boards-08-v16.webp", 0.5826, 0.4824),
    rubbleAsset("rubble-cutout-boards-09-v16.webp", 1.0873, 0.7311),
    rubbleAsset("rubble-cutout-boards-10-v16.webp", 0.7348, 1.0725),
    rubbleAsset("rubble-cutout-boards-11-v16.webp", 1.0799, 0.7756),
    rubbleAsset("rubble-cutout-boards-12-v16.webp", 0.7533, 1.0168),
  ]),
  brickGrey: Object.freeze([
    rubbleAsset("rubble-cutout-brick-grey-01-v16.webp", 0.3859, 0.3859),
    rubbleAsset("rubble-cutout-brick-grey-02-v16.webp", 0.3896, 0.3859),
    rubbleAsset("rubble-cutout-brick-grey-03-v16.webp", 0.3859, 0.3934),
    rubbleAsset("rubble-cutout-brick-grey-04-v16.webp", 0.3488, 0.3451),
    rubbleAsset("rubble-cutout-brick-grey-05-v16.webp", 0.5752, 0.642),
    rubbleAsset("rubble-cutout-brick-grey-06-v16.webp", 0.6123, 0.6494),
    rubbleAsset("rubble-cutout-brick-grey-07-v16.webp", 0.6123, 0.6494),
    rubbleAsset("rubble-cutout-brick-grey-08-v16.webp", 0.6494, 0.6086),
    rubbleAsset("rubble-cutout-brick-grey-09-v16.webp", 0.616, 0.5678),
    rubbleAsset("rubble-cutout-brick-grey-10-v16.webp", 0.8238, 0.9723),
    rubbleAsset("rubble-cutout-brick-grey-11-v16.webp", 0.9203, 0.7199),
    rubbleAsset("rubble-cutout-brick-grey-12-v16.webp", 0.6865, 0.9129),
  ]),
  brickRed: Object.freeze([
    rubbleAsset("rubble-cutout-brick-red-01-v16.webp", 0.3637, 0.3637),
    rubbleAsset("rubble-cutout-brick-red-02-v16.webp", 0.3785, 0.3154),
    rubbleAsset("rubble-cutout-brick-red-03-v16.webp", 0.3637, 0.36),
    rubbleAsset("rubble-cutout-brick-red-04-v16.webp", 0.3414, 0.3637),
    rubbleAsset("rubble-cutout-brick-red-05-v16.webp", 0.5232, 0.6197),
    rubbleAsset("rubble-cutout-brick-red-06-v16.webp", 0.6197, 0.5232),
    rubbleAsset("rubble-cutout-brick-red-07-v16.webp", 0.5381, 0.6457),
    rubbleAsset("rubble-cutout-brick-red-08-v16.webp", 0.5232, 0.6197),
    rubbleAsset("rubble-cutout-brick-red-09-v16.webp", 0.527, 0.4824),
    rubbleAsset("rubble-cutout-brick-red-10-v16.webp", 0.7459, 0.9871),
    rubbleAsset("rubble-cutout-brick-red-11-v16.webp", 0.9908, 0.7459),
    rubbleAsset("rubble-cutout-brick-red-12-v16.webp", 0.9908, 0.7459),
  ]),
});

const WAREHOUSE_ASSET_POOLS = Object.freeze({
  crates: Object.freeze([warehouseAsset("warehouse-crate-topdown-v1.webp", 0.54, 0.54, 1, "crates")]),
  barrels: Object.freeze([warehouseAsset("warehouse-barrel-topdown-v1.webp", 0.54, 0.54, 1, "barrels")]),
  sacks: Object.freeze([
    warehouseAsset("warehouse-sack-a-topdown-v2.webp", 0.5, 0.68, 1, "sacks"),
    warehouseAsset("warehouse-sack-b-topdown-v2.webp", 0.52, 0.68, 1, "sacks"),
    warehouseAsset("warehouse-sack-c-topdown-v2.webp", 0.48, 0.7, 1, "sacks"),
  ]),
});

const CROWD_GROUPS = Object.freeze([
  ["poor", "Poor", "Poor people"],
  ["laborers", "Laborers", "Laborers"],
  ["merchants", "Merchants", "Merchants"],
  ["artisans", "Artisans", "Artisans"],
  ["middle-class", "MiddleClass", "Middle class"],
  ["aristocrats", "Aristocrats", "Aristocrats"],
]);
const CROWD_STYLES = Object.freeze(Object.fromEntries(
  Array.from({ length: 63 }, (_, index) => {
    const groups = CROWD_GROUPS.filter((_, bit) => (index + 1) & (1 << bit));
    const assets = Object.freeze(groups.map(([key]) => warehouseAsset(`crowd-${key}-v1.webp`, 1, 1, 1, key)));
    return [`crowd-${groups.map(([key]) => key).join("-")}`, Object.freeze({
      labelKey: `Settings.FloorTextures.Choices.Crowd${groups.map(([, label]) => label).join("")}`,
      fallback: groups.map(([, , label]) => label).join(" + "),
      get src() { return assets[0].src; },
      get previewSrc() { return assets[0].src; },
      overlay: true,
      crowd: true,
      scale: 1,
      difficultTerrain: true,
      movementCost: DIFFICULT_TERRAIN_COST,
      rubble: Object.freeze({ assets, crowd: true }),
    })];
  }),
));

const FLOOR_STYLES = Object.freeze({
  ...CROWD_STYLES,
  [DEFAULT_STYLE]: Object.freeze({
    labelKey: "Settings.FloorTextures.Choices.UnevenLimestone",
    fallback: "Uneven limestone",
    get src() { return resolvePresetTexture(`modules/${MODULE_ID}/images/scene-floors/uneven-limestone-floor.png`); },
  }),
  "cave-brown": floorStyle("CaveBrown", "Brown cave floor", "cave-brown-floor.png", caveEdge(0x352a20, 0x9a8469, 0xb39a78)),
  "cave-grey-pebbles": floorStyle("CaveGreyPebbles", "Grey cave pebbles", "cave-grey-pebbles-floor-v2.webp", caveEdge(0x292925, 0x918d80, 0xaaa698)),
  "cave-walls": floorStyle("CaveWalls", "Cave walls", "cave-walls-floor-v1.webp", caveEdge(0x211d19, 0x8f8578, 0xa79e90), HIGH_RES_FLOOR_SCALE),
  "cave-solid-rock": floorStyle("CaveSolidRock", "Solid rock", "cave-solid-rock-v1.svg"),
  "cave-shadow": floorStyle("CaveShadow", "Shadow", "cave-shadow-v2.svg", null, 1, true, null, null, null, 2000),
  "sand-clean": floorStyle("SandClean", "Clean sand", "sand-clean-floor-v1.webp", null, HIGH_RES_FLOOR_SCALE),
  "sand-arena": floorStyle("SandArena", "Arena sand with pebbles", "sand-arena-floor-v1.webp", null, HIGH_RES_FLOOR_SCALE),
  "sand-outdoor": floorStyle("SandOutdoor", "Outdoor sand", "sand-outdoor-floor-v1.webp", null, HIGH_RES_FLOOR_SCALE),
  "courtyard-cobblestone": floorStyle("CourtyardCobblestone", "Courtyard cobblestone", "courtyard-cobblestone-floor-v1.webp", null, HIGH_RES_FLOOR_SCALE),
  "flagstone-grey": floorStyle("FlagstoneGrey", "Grey flagstone", "flagstone-grey-floor.png"),
  "brick-red": floorStyle("BrickRed", "Red brick", "brick-red-floor.png"),
  "wood-walnut": floorStyle("WoodWalnut", "Walnut boards", "wood-walnut-floor.png"),
  "wood-alder": floorStyle("WoodAlder", "Alder boards", "wood-alder-floor.png"),
  "wood-continuous": floorStyle("WoodContinuous", "Continuous wood grain", "wood-continuous-floor-v1.webp"),
  "wood-outdoor": floorStyle("WoodOutdoor", "Outdoor boards", "wood-outdoor-brown-v3.png", null, 1.25),
  "grass-meadow": floorStyle("GrassMeadow", "Meadow grass", "grass-meadow-floor-v4.webp", null, HIGH_RES_GRASS_SCALE, false, null, grassMeadowScatter()),
  "grass-rocky": floorStyle("GrassRocky", "Rocky grass", "grass-rocky-floor-v1.webp", null, HIGH_RES_GRASS_SCALE),
  "flowering-shrubs-dense": floorStyle("FloweringShrubsDense", "Dense flowering shrubs", "flowering-shrubs-dense-floor-v1.webp", shrubEdge()),
  "swamp": floorStyle("Swamp", "Swamp", "swamp-floor-v1.png", null, 1, false, null, null, GREATER_DIFFICULT_TERRAIN_COST),
  "path-dirt": floorStyle("PathDirt", "Dirt path", "path-dirt-floor-v3.webp", { kind: "dirt", jitter: 8, feather: 8 }, HIGH_RES_FLOOR_SCALE),
  "path-cobblestone": floorStyle("PathCobblestone", "Cobblestone path", "path-cobblestone-floor-v3.webp", { kind: "stone", jitter: 8, feather: 6 }, HIGH_RES_FLOOR_SCALE),
  "rubble-stone": rubbleStyle("RubbleStone", "Stone only", "rubble-stone-floor-v9.webp", { groups: ["stone"], spacingCells: 0.29, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "rubble-stone-boards": rubbleStyle("RubbleStoneBoards", "Stone and boards", "rubble-stone-boards-floor-v9.webp", { groups: ["stone", "boards"], spacingCells: 0.30, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "rubble-boards": rubbleStyle("RubbleBoards", "Boards only", "rubble-boards-floor-v9.webp", { groups: ["boards"], spacingCells: 0.31, chance: 0.74, scaleMin: 0.72, scaleMax: 0.94 }),
  "rubble-brick-grey": rubbleStyle("RubbleBrickGrey", "Grey bricks", "rubble-brick-grey-floor-v9.webp", { groups: ["brickGrey"], spacingCells: 0.29, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "rubble-brick-red": rubbleStyle("RubbleBrickRed", "Red bricks", "rubble-brick-red-floor-v9.webp", { groups: ["brickRed"], spacingCells: 0.29, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "rubble-brick-grey-boards": rubbleStyle("RubbleBrickGreyBoards", "Grey bricks and boards", "rubble-brick-grey-boards-floor-v9.webp", { groups: ["brickGrey", "boards"], spacingCells: 0.30, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "rubble-brick-red-boards": rubbleStyle("RubbleBrickRedBoards", "Red bricks and boards", "rubble-brick-red-boards-floor-v9.webp", { groups: ["brickRed", "boards"], spacingCells: 0.30, chance: 0.76, scaleMin: 0.74, scaleMax: 0.98 }),
  "warehouse-crates": warehouseStyle("WarehouseCrates", "Crates only", ["crates"]),
  "warehouse-barrels": warehouseStyle("WarehouseBarrels", "Barrels only", ["barrels"]),
  "warehouse-sacks": warehouseStyle("WarehouseSacks", "Sacks only", ["sacks"]),
  "warehouse-crates-barrels": warehouseStyle("WarehouseCratesBarrels", "Crates and barrels", ["crates", "barrels"]),
  "warehouse-crates-sacks": warehouseStyle("WarehouseCratesSacks", "Crates and sacks", ["crates", "sacks"]),
  "warehouse-sacks-barrels": warehouseStyle("WarehouseSacksBarrels", "Sacks and barrels", ["sacks", "barrels"]),
  "warehouse-crates-barrels-sacks": warehouseStyle("WarehouseCratesBarrelsSacks", "Crates, barrels, and sacks", ["crates", "barrels", "sacks"]),
  "carpet-red": floorStyle("CarpetRed", "Red carpet", "carpet-red-floor.png", carpetEdge("red")),
  "carpet-blue": floorStyle("CarpetBlue", "Blue carpet", "carpet-blue-floor.png", carpetEdge("blue")),
  "carpet-red-ornate": floorStyle("CarpetRedOrnate", "Ornate red carpet", "carpet-red-ornate-floor.webp", carpetEdge("red"), 0.5),
  "carpet-blue-heraldic": floorStyle("CarpetBlueHeraldic", "Ornate blue carpet", "carpet-blue-ornate-floor-v2.webp", carpetEdge("blue"), 0.5),
  "carpet-green-gold": floorStyle("CarpetGreenGold", "Green and gold carpet", "carpet-green-gold-floor.webp", carpetEdge("green"), 0.5),
  "floor-ornament-geometric": stretchedOverlayStyle("FloorOrnamentGeometric", "Geometric flagstone ornament", "floor-ornament-geometric-v2.webp"),
  "floor-ornament-knotwork": stretchedOverlayStyle("FloorOrnamentKnotwork", "Knotwork flagstone ornament", "floor-ornament-knotwork-v2.webp"),
  "floor-ornament-diamond": stretchedOverlayStyle("FloorOrnamentDiamond", "Diamond flagstone ornament", "floor-ornament-diamond-v2.webp"),
  "cobweb-below": cobwebStyle("CobwebBelow", "Cobweb below — full", "below", "patch"),
  "cobweb-below-corner": cobwebStyle("CobwebBelowCorner", "Cobweb below — corner", "below", "corner"),
  "cobweb-below-strip": cobwebStyle("CobwebBelowStrip", "Cobweb below — along edge", "below", "strip"),
  "cobweb-above": cobwebStyle("CobwebAbove", "Cobweb above — full", "above", "patch"),
  "cobweb-above-corner": cobwebStyle("CobwebAboveCorner", "Cobweb above — corner", "above", "corner"),
  "cobweb-above-strip": cobwebStyle("CobwebAboveStrip", "Cobweb above — along edge", "above", "strip"),
  "weather-fog": weatherStyle("WeatherFog", "Fog", "weather-fog-floor-v1.webp", {
    alpha: 0.48,
    scale: 1,
  }),
  "garden-cabbage": gardenStyle("GardenCabbage", "Cabbage beds", "garden-cabbage-floor.webp", "garden-crop-cabbage-v2.webp", { cropSize: 0.19, spacingX: 0.27, spacingY: 0.19, missingChance: 0.015, cropBrightness: 1.24, cropSaturation: 0.14 }),
  "garden-carrot": gardenStyle("GardenCarrot", "Carrot beds", "garden-carrot-floor.webp", "garden-crop-carrot-v2.webp", { cropSize: 0.17, spacingX: 0.21, spacingY: 0.13, missingChance: 0.02, cropBrightness: 1.5, cropSaturation: 0.26 }),
  "garden-herbs": gardenStyle("GardenHerbs", "Herb beds", "garden-herbs-floor.webp", "garden-crop-herbs-v2.webp", { cropSize: 0.18, spacingX: 0.22, spacingY: 0.14, missingChance: 0.02, cropBrightness: 1.4, cropSaturation: 0.22 }),
  "garden-rice": gardenStyle("GardenRice", "Flooded rice beds", "garden-rice-floor.webp", "garden-crop-rice-v2.webp", { cropSize: 0.18, spacingX: 0.22, spacingY: 0.13, missingChance: 0.015, cropBrightness: 1.18, cropSaturation: 0.16, water: true }),
  "forest-deciduous": forestStyle("ForestDeciduous", "Deciduous forest", [
    forestAsset("forest-deciduous-irregular-a.webp", 0.56, 1.2, 1.5, 1, 0x81906f),
    forestAsset("forest-deciduous-irregular-b.webp", 0.44, 1.2, 1.5, 1, 0x748365),
  ]),
  "forest-pine": forestStyle("ForestPine", "Pine forest", [
    forestAsset("forest-pine-irregular-a.webp", 0.54, 1.2, 1.5, 1, 0xb9c5ad),
    forestAsset("forest-pine-irregular-b.webp", 0.46, 1.2, 1.5, 1, 0xaebca2),
  ]),
  "forest-mixed": forestStyle("ForestMixed", "Mixed forest", [
    forestAsset("forest-pine-irregular-a.webp", 0.31, 1.2, 1.5, 1, 0xb9c5ad),
    forestAsset("forest-pine-irregular-b.webp", 0.27, 1.2, 1.5, 1, 0xaebca2),
    forestAsset("forest-deciduous-irregular-a.webp", 0.23, 1.2, 1.5, 1, 0x81906f),
    forestAsset("forest-deciduous-irregular-b.webp", 0.19, 1.2, 1.5, 1, 0x748365),
  ]),
  "sea-shallow": floorStyle("SeaShallow", "Shallow sea", "sea-shallow-floor-v4.webp", null, HIGH_RES_FLOOR_SCALE, false, null, seaNaturalScatter(0.40)),
  "sea-deep": floorStyle("SeaDeep", "Deep sea", "sea-deep-floor-v5.webp", null, DEEP_SEA_FLOOR_SCALE),
  "sea-stormy": floorStyle("SeaStormy", "Stormy sea", "sea-stormy-floor-v5.webp", null, STORMY_SEA_FLOOR_SCALE),
  "roof-thatch": floorStyle("RoofThatch", "Thatched roof", "roof-thatch-floor.webp", roofEdge("thatch", 0x8d5c22, 0x2b190c, 0xc9933f), 1.28),
  "roof-shingles": floorStyle("RoofShingles", "Shingle roof", "roof-shingles-floor.webp", roofEdge("shingles", 0x4a392d, 0x17120f, 0x806954), 1.28),
  "roof-tiles": floorStyle("RoofTiles", "Tile roof", "roof-tiles-floor.webp", roofEdge("tiles", 0x743e2d, 0x21120f, 0xa96a4f), 1.28),
  ...stairStyles("stairs-uneven-limestone", "UnevenLimestone", "Uneven limestone", "stairs-uneven-limestone.png"),
  ...stairStyles("stairs-flagstone-grey", "FlagstoneGrey", "Grey flagstone", "stairs-flagstone-grey.png"),
  ...stairStyles("stairs-brick-red", "BrickRed", "Red brick", "stairs-brick-red.png"),
  ...stairStyles("stairs-wood-walnut", "WoodWalnut", "Walnut boards", "stairs-wood-walnut.png"),
  ...stairStyles("stairs-wood-alder", "WoodAlder", "Alder boards", "stairs-wood-alder.png"),
  ...stairStyles("stairs-wood-outdoor", "WoodOutdoor", "Outdoor boards", "stairs-wood-outdoor-brown.png"),
});
const FLOOR_STYLE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "Crowd", fallback: "Crowd", styles: Object.keys(CROWD_STYLES).sort((a, b) => CROWD_STYLES[a].rubble.assets.length - CROWD_STYLES[b].rubble.assets.length) }),
  Object.freeze({ key: "Stone", fallback: "Stone", styles: ["uneven-limestone", "courtyard-cobblestone", "flagstone-grey", "brick-red"] }),
  Object.freeze({ key: "Rubble", fallback: "Rubble", styles: [
    "rubble-stone", "rubble-stone-boards", "rubble-boards", "rubble-brick-grey",
    "rubble-brick-red", "rubble-brick-grey-boards", "rubble-brick-red-boards",
  ] }),
  Object.freeze({ key: "Warehouse", fallback: "Warehouse", styles: [
    "warehouse-crates", "warehouse-barrels", "warehouse-sacks",
    "warehouse-crates-barrels", "warehouse-crates-sacks", "warehouse-sacks-barrels",
    "warehouse-crates-barrels-sacks",
  ] }),
  Object.freeze({ key: "Earth", fallback: "Earth", styles: [
    "sand-clean", "sand-arena", "sand-outdoor",
    "cave-brown", "cave-grey-pebbles", "cave-walls", "cave-solid-rock", "cave-shadow",
  ] }),
  Object.freeze({ key: "Wood", fallback: "Wood", styles: ["wood-walnut", "wood-alder", "wood-continuous", "wood-outdoor"] }),
  Object.freeze({ key: "Stairs", fallback: "Stairs", styles: [
    ...stairStyleKeys("stairs-uneven-limestone"),
    ...stairStyleKeys("stairs-flagstone-grey"),
    ...stairStyleKeys("stairs-brick-red"),
    ...stairStyleKeys("stairs-wood-walnut"),
    ...stairStyleKeys("stairs-wood-alder"),
    ...stairStyleKeys("stairs-wood-outdoor"),
  ] }),
  Object.freeze({ key: "Nature", fallback: "Nature", styles: ["grass-meadow", "grass-rocky", "flowering-shrubs-dense", "swamp", "forest-deciduous", "forest-pine", "forest-mixed"] }),
  Object.freeze({ key: "Seas", fallback: "Seas", styles: ["sea-shallow", "sea-deep", "sea-stormy"] }),
  Object.freeze({ key: "Roofs", fallback: "Roofs", styles: ["roof-thatch", "roof-shingles", "roof-tiles"] }),
  Object.freeze({ key: "Gardens", fallback: "Gardens", styles: ["garden-cabbage", "garden-carrot", "garden-herbs", "garden-rice"] }),
  Object.freeze({ key: "Paths", fallback: "Paths", styles: ["path-dirt", "path-cobblestone"] }),
  Object.freeze({ key: "FloorDecorations", fallback: "Floor Decorations", styles: [
    "carpet-red", "carpet-blue", "carpet-red-ornate", "carpet-blue-heraldic", "carpet-green-gold",
    "floor-ornament-geometric", "floor-ornament-knotwork", "floor-ornament-diamond",
  ] }),
  Object.freeze({ key: "Cobwebs", fallback: "Cobwebs", styles: [
    "cobweb-below", "cobweb-below-corner", "cobweb-below-strip",
    "cobweb-above", "cobweb-above-corner", "cobweb-above-strip",
  ] }),
  Object.freeze({ key: "Weather", fallback: "Weather", styles: ["weather-fog"] }),
]);

function weatherStyle(label, fallback, filename, options = {}) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get src() { return resolvePresetTexture(source); },
    overlay: true,
    weather: "fog",
    alpha: Number(options.alpha ?? 0.48),
    scale: Number(options.scale ?? 1),
  });
}

function floorStyle(label, fallback, filename, edge = null, scale = 1, overlay = false, rubble = null, scatter = null, movementCost = null, renderOrder = null) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  const style = {
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get src() { return resolvePresetTexture(source); },
    edge,
    scale,
    overlay,
    renderOrder: renderOrder === null ? (overlay ? 1000 : 0) : Number(renderOrder),
    rubble,
    scatter,
  };
  if (movementCost !== null) {
    style.difficultTerrain = Number(movementCost) >= DIFFICULT_TERRAIN_COST;
    style.movementCost = Number(movementCost);
  }
  return Object.freeze(style);
}

function scatterAsset(filename, weight, minSize, maxSize, alpha = 1, maxPerFill = null, limitKey = null) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  const asset = {
    get src() { return resolvePresetTexture(source); },
    weight: Number(weight),
    minSize: Number(minSize),
    maxSize: Number(maxSize),
    alpha: Number(alpha),
  };
  if (Number.isFinite(Number(maxPerFill)) && Number(maxPerFill) > 0) asset.maxPerFill = Math.floor(Number(maxPerFill));
  if (limitKey) asset.limitKey = String(limitKey);
  return Object.freeze(asset);
}

function scatterAssetSeries(prefix, count, weight, minSize, maxSize, alpha = 1, version = 1, maxPerFill = null, limitKey = null) {
  return Array.from({ length: count }, (_, index) => (
    scatterAsset(`${prefix}-${String(index + 1).padStart(2, "0")}-v${version}.webp`, weight, minSize, maxSize, alpha, maxPerFill, limitKey)
  ));
}

function grassMeadowScatter() {
  return Object.freeze({
    assets: Object.freeze([
      ...scatterAssetSeries("grass-flower-single", 12, 1, 0.14, 0.32, 1, 3).filter((_asset, index) => index !== 6),
      ...scatterAssetSeries("grass-flower-cluster", 6, 0.42, 0.34, 0.52, 1, 1),
    ]),
    spacingCells: 0.9,
    chance: 0.12,
    aspectJitter: 0.12,
    maxPieces: 400,
  });
}

function caveEdge(shadow, highlight, rockTint) {
  return Object.freeze({
    kind: "cave",
    jitter: 5,
    width: 10,
    shadow: Number(shadow),
    highlight: Number(highlight),
    rockTint: Number(rockTint),
    rockAssets: Object.freeze(scatterAssetSeries("rubble-cutout-stone", 12, 1, 0.10, 0.23, 0.96, 16)),
    rockSpacingCells: 0.24,
    rockChance: 0.66,
    rockSpreadCells: 0.30,
    maxRocks: 900,
  });
}

function seaNaturalScatter(chance) {
  return Object.freeze({
    assets: Object.freeze(scatterAssetSeries("sea-scatter-fish-shadow", 8, 0.25, 0.80, 1.45, 0.22, 1, 4, "fish-shadow")),
    spacingCells: 3.2,
    chance: Number(chance),
    aspectJitter: 0.10,
    maxPieces: 8,
  });
}

function cobwebStyle(label, fallback, layer, shape) {
  const source = `modules/${MODULE_ID}/images/scene-floors/cobweb-${shape}-${layer}-v1.webp`;
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return resolvePresetTexture(source); },
    get src() { return resolvePresetTexture(source); },
    overlay: true,
    cobweb: Object.freeze({
      layer,
      shape,
      get src() { return resolvePresetTexture(source); },
    }),
  });
}

function stretchedOverlayStyle(label, fallback, filename) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return resolvePresetTexture(source); },
    get src() { return resolvePresetTexture(source); },
    overlay: true,
    stretchedOverlay: Object.freeze({
      shape: "patch",
      get src() { return resolvePresetTexture(source); },
    }),
  });
}

function rubbleAsset(filename, widthCells, heightCells, weight = 1) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  return Object.freeze({
    get src() { return resolvePresetTexture(source); },
    widthCells: Number(widthCells),
    heightCells: Number(heightCells),
    weight: Number(weight),
  });
}

function warehouseAsset(filename, widthCells, heightCells, weight = 1, groupKey = "") {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  return Object.freeze({
    get src() { return resolvePresetTexture(source); },
    key: filename,
    groupKey,
    widthCells: Number(widthCells),
    heightCells: Number(heightCells),
    weight: Number(weight),
  });
}

function warehouseStyle(label, fallback, groups) {
  const assets = Object.freeze(groups.flatMap((group) => WAREHOUSE_ASSET_POOLS[group] ?? []));
  const previewAsset = assets[0];
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return previewAsset?.src; },
    get src() { return previewAsset?.src; },
    scale: 1,
    overlay: true,
    difficultTerrain: true,
    movementCost: DIFFICULT_TERRAIN_COST,
    warehouse: true,
    rubble: Object.freeze({
      assets,
      groupOrder: Object.freeze([...groups]),
      pilePacking: true,
      orderedPacking: false,
      positionJitter: 0.62,
      rotationSteps: 0,
      spacingCells: 0.38,
      chance: 1,
      scaleMin: 0.86,
      scaleMax: 1.08,
      minimumGapCells: 0,
      maxPieces: 8000,
    }),
  });
}



function rubbleStyle(label, fallback, filename, options = {}) {
  const previewSource = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  const assetGroups = Array.isArray(options.groups) && options.groups.length ? options.groups : ["stone"];
  const assets = Object.freeze(assetGroups.flatMap((group) => RUBBLE_ASSET_POOLS[group] ?? []));
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return resolvePresetTexture(previewSource); },
    // Keep src for old picker/compatibility paths; map rendering uses only external cutout assets.
    get src() { return resolvePresetTexture(previewSource); },
    edge: Object.freeze({ kind: "rubble", jitter: 0 }),
    scale: 1,
    overlay: true,
    difficultTerrain: true,
    movementCost: DIFFICULT_TERRAIN_COST,
    rubble: Object.freeze({
      assets,
      spacingCells: Number(options.spacingCells ?? 0.34),
      chance: Number(options.chance ?? 0.52),
      scaleMin: Number(options.scaleMin ?? 0.82),
      scaleMax: Number(options.scaleMax ?? 1.08),
      maxPieces: Number(options.maxPieces ?? 12000),
    }),
  });
}

function gardenStyle(label, fallback, previewFilename, cropFilename, options = {}) {
  const water = Boolean(options.water);
  const previewSource = `modules/${MODULE_ID}/images/scene-floors/${previewFilename}`;
  const source = `modules/${MODULE_ID}/images/scene-floors/${water ? "garden-rice-water-v5.png" : "garden-soil-soft-v3.webp"}`;
  const cropSource = `modules/${MODULE_ID}/images/scene-floors/${cropFilename}`;
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return resolvePresetTexture(previewSource); },
    get src() { return resolvePresetTexture(source); },
    scale: water ? 0.55 : 1,
    edge: Object.freeze({
      kind: "garden",
      color: 0x66513c,
      width: water ? 6 : 0,
      alpha: water ? 0.9 : 0,
      jitter: 2,
    }),
    garden: Object.freeze({
      get cropSrc() { return resolvePresetTexture(cropSource); },
      cropSize: Number(options.cropSize ?? 0.2),
      spacingX: Number(options.spacingX ?? 0.45),
      spacingY: Number(options.spacingY ?? 0.4),
      inset: Number(options.inset ?? (water ? 0.045 : 0.025)),
      missingChance: Number(options.missingChance ?? 0.06),
      positionJitter: Number(options.positionJitter ?? 0.012),
      sizeJitter: Number(options.sizeJitter ?? 0.08),
      baseTint: water ? 0xffffff : 0xa59683,
      cropBrightness: Number(options.cropBrightness ?? 1.35),
      cropSaturation: Number(options.cropSaturation ?? 0.2),
    }),
  });
}

function forestStyle(label, fallback, assets, movementCost = DIFFICULT_TERRAIN_COST) {
  return Object.freeze({
    labelKey: `Settings.FloorTextures.Choices.${label}`,
    fallback,
    get previewSrc() { return assets[0]?.src; },
    difficultTerrain: Number(movementCost) >= DIFFICULT_TERRAIN_COST,
    movementCost: Number(movementCost),
    forest: Object.freeze({
      assets: Object.freeze(assets),
      maxTrees: 8000,
    }),
  });
}

function forestAsset(filename, weight, minSize, maxSize, aspect, tint) {
  const source = `modules/${MODULE_ID}/images/scene-assets/${filename}`;
  return Object.freeze({
    get src() { return resolvePresetTexture(source); },
    weight,
    minSize,
    maxSize,
    aspect,
    tint,
  });
}

function stairStyleKeys(prefix) {
  return ["vertical-up", "vertical-down", "horizontal-right", "horizontal-left"].map((direction) => `${prefix}-${direction}`);
}

function stairStyles(prefix, materialLabel, materialFallback, filename) {
  const source = `modules/${MODULE_ID}/images/scene-floors/${filename}`;
  const directions = [
    { key: "vertical-up", label: "VerticalUp", fallback: "Stairs vertical ↑", rotation: 0 },
    { key: "vertical-down", label: "VerticalDown", fallback: "Stairs vertical ↓", rotation: 180 },
    { key: "horizontal-right", label: "HorizontalRight", fallback: "Stairs horizontal →", rotation: 90 },
    { key: "horizontal-left", label: "HorizontalLeft", fallback: "Stairs horizontal ←", rotation: -90 },
  ];
  return Object.fromEntries(directions.map((direction) => [`${prefix}-${direction.key}`, Object.freeze({
    materialLabelKey: `Settings.FloorTextures.Choices.${materialLabel}`,
    materialFallback,
    directionKey: `Directions.${direction.label}`,
    directionFallback: direction.fallback,
    get src() { return resolvePresetTexture(source); },
    cellSized: true,
    sourceSize: 200,
    rotation: direction.rotation,
  })]));
}

function carpetEdge(color) {
  const palettes = {
    red: { outer: 0x321712, band: 0xb98a46, inner: 0x792c23 },
    blue: { outer: 0x101a2a, band: 0xb5a06a, inner: 0x263d5c },
    green: { outer: 0x142319, band: 0xb69a50, inner: 0x304c32 },
  };
  const textureSource = `modules/${MODULE_ID}/images/scene-floors/carpet-edge-${color}-v2.webp`;
  const cornerSource = `modules/${MODULE_ID}/images/scene-floors/carpet-corner-${color}-v2.webp`;
  return Object.freeze({
    kind: "carpet",
    width: FLOOR_EDGE_WIDTH,
    sourceHeight: 32,
    get texture() { return resolvePresetTexture(textureSource); },
    get corner() { return resolvePresetTexture(cornerSource); },
    palette: palettes[color] ?? palettes.red,
  });
}

function roofEdge(materialType, material, shadow, highlight) {
  return Object.freeze({
    kind: "roof",
    materialType,
    shadow,
    jitter: 0,
  });
}

function shrubEdge() {
  return Object.freeze({
    kind: "shrub",
    shadow: 0x07160b,
    width: 8,
    shadowAlpha: 0.28,
    jitter: 6,
  });
}

let activeTool = null;
let selectedStyle = DEFAULT_STYLE;
let selectedLevel = 0;
let currentLevel = 0;
let draftPoints = [];
let selectedEdge = null;
let redrawTimer = null;
let redrawNeedsFullPass = false;
const pendingForestFloorIds = new Set();
let stageBound = null;
let lastClick = null;
const forestRenderSignatures = new Map();
const trackedWallStates = new Map();
let gardenAssetsReady = false;
let gardenAssetPromise = null;
let gardenAssetRevision = 0;

async function ensureGardenAssets() {
  if (gardenAssetsReady) return true;
  if (!gardenAssetPromise) {
    const revision = gardenAssetRevision;
    const sceneGardenStyles = new Set(getSceneData().floors.map((floor) => FLOOR_STYLES[floor.style]).filter((style) => style?.garden));
    const sources = new Set([...sceneGardenStyles].flatMap((style) => [style.src, style.garden.cropSrc]));
    if (!sources.size) return true;
    gardenAssetPromise = (async () => {
      for (const src of sources) {
        try {
          if (PIXI.Assets?.load) await PIXI.Assets.load(src);
          else if (globalThis.loadTexture) await globalThis.loadTexture(src);
        } catch (error) {
          console.warn(`${MODULE_ID} | Failed to preload garden texture`, src, error);
        }
      }
      if (revision !== gardenAssetRevision) return false;
      gardenAssetsReady = true;
      gardenAssetPromise = null;
      return true;
    })();
  }
  return gardenAssetPromise;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_ENABLE, {
    name: i18nKey("Settings.FloorTextures.Name"),
    hint: i18nKey("Settings.FloorTextures.Hint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      refreshControls();
    },
  });
  game.settings.register(MODULE_ID, SETTING_VISIBILITY_MIGRATION, {
    scope: "world",
    config: false,
    default: 0,
    type: Number,
  });
  refreshFogConcealment = installFogConcealment({
    getFogPolygons: fogPolygonsForScene,
    getFloorNumber: floorNumberForToken,
  });
});

function fogPolygonsForScene(scene, floorNumber) {
  const floors = scene?.getFlag?.(MODULE_ID, FLAG_ROOT)?.floors;
  if (!Array.isArray(floors)) return [];
  return floors
    .filter((floor) => FLOOR_STYLES[floor.style]?.weather === "fog")
    .filter((floor) => Number(floor.level ?? 0) === Number(floorNumber ?? 0))
    .map((floor) => floor.points)
    .filter((points) => Array.isArray(points) && points.length >= 3);
}

function floorNumberForToken(token, scene = token?.parent) {
  const nativeLevel = scene?.levels?.get?.(token?.level);
  return nativeLevel ? getFloorNumberForNativeLevel(nativeLevel) : Number(currentLevel) || 0;
}

Hooks.on(TEXTURE_PRESET_CHANGE_HOOK, () => {
  gardenAssetRevision += 1;
  gardenAssetsReady = false;
  gardenAssetPromise = null;
  renderStyleSelect(ui.controls?.element);
  scheduleRedraw();
});

function enabled() {
  return Boolean(game.user?.isGM && game.settings.get(MODULE_ID, SETTING_ENABLE));
}

function localize(key, fallback) {
  return t(`Settings.FloorTextures.${key}`, fallback);
}

function styleLabel(style) {
  if (style.materialLabelKey && style.directionKey) {
    return `${t(style.materialLabelKey, style.materialFallback)} — ${localize(style.directionKey, style.directionFallback)}`;
  }
  return t(style.labelKey, style.fallback);
}

function styleIsOverlay(styleKey = selectedStyle) {
  return Boolean(FLOOR_STYLES[styleKey]?.overlay);
}

function rotateStylePreview(image, style) {
  const rotation = Number(style.rotation ?? 0);
  if (rotation) image.style.transform = `rotate(${rotation}deg)`;
}

function toolDefinition(name, title, icon) {
  const orders = { fill: 0, draw: 1, level: 2, erase: 3 };
  return {
    name,
    order: orders[name] ?? 99,
    title: localize(title, title),
    icon,
    visible: true,
    onChange: (_event, active) => {
      if (active !== false) activateTool(name);
    },
  };
}

Hooks.on("getSceneControlButtons", (controls) => {
  if (!enabled()) return;
  const tools = [
    toolDefinition("fill", "FillRoom", "fa-solid fa-fill-drip"),
    toolDefinition("draw", "DrawBoundary", "fa-solid fa-draw-polygon"),
    toolDefinition("level", "ChangeFloorLevel", "fa-solid fa-layer-group"),
    toolDefinition("erase", "EraseFloor", "fa-solid fa-eraser"),
    {
      name: "base",
      order: 4,
      title: localize("BaseFloor", "Base floor"),
      icon: "fa-solid fa-expand",
      visible: true,
      button: true,
      onChange: () => setBaseFloor(),
    },
    {
      name: "undo",
      order: 5,
      title: localize("Undo", "Undo last action"),
      icon: "fa-solid fa-rotate-left",
      visible: true,
      button: true,
      onChange: () => undoFloorAction(),
    },
  ];
  const group = {
    name: CONTROL_NAME,
    order: 75,
    title: localize("Control", "Floors"),
    icon: "fa-solid fa-border-all",
    layer: "controls",
    layerName: "controls",
    activeTool: "fill",
    onChange: (_event, active) => {
      if (active) activateTool(ui.controls?.tool?.name ?? "fill");
      else deactivateTool();
      renderStyleSelect(ui.controls?.element);
    },
  };

  controls[CONTROL_NAME] = { ...group, tools: Object.fromEntries(tools.map((tool) => [tool.name, tool])) };
});

Hooks.on("renderSceneControls", (_app, element) => {
  queueMicrotask(() => {
    syncActiveControl();
    renderStyleSelect(element);
  });
});

function refreshControls() {
  ui.controls?.render?.({ reset: true });
}

function currentControlName() {
  return ui.controls?.control?.name ?? null;
}

function currentToolName() {
  return ui.controls?.tool?.name ?? null;
}

function syncActiveControl() {
  if (currentControlName() !== CONTROL_NAME) {
    deactivateTool();
    return;
  }
  activateTool(currentToolName() || activeTool || "fill");
}

function activateTool(name) {
  if (!enabled()) return;
  canvas?.activeLayer?.deactivate?.();
  activeTool = ["fill", "draw", "level", "erase"].includes(name) ? name : "fill";
  if (activeTool !== "draw") draftPoints = [];
  selectedEdge = null;
  bindStageEvents();
  redrawEditor();
  document.querySelector(".tsu-floor-style-picker")?.classList.remove("hidden");
}

function deactivateTool() {
  activeTool = null;
  draftPoints = [];
  selectedEdge = null;
  redrawEditor();
  document.querySelector(".tsu-floor-style-picker")?.classList.add("hidden");
}

function getRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return document.querySelector("#scene-controls");
}

function renderStyleSelect(element) {
  document.querySelector(".tsu-floor-style-picker")?.remove();
  if (!enabled() || currentControlName() !== CONTROL_NAME) return;
  const root = getRoot(element) ?? document.querySelector("#scene-controls");
  if (!root) return;
  const wrapper = document.createElement("div");
  wrapper.className = "tsu-floor-style-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "tsu-floor-style-trigger";
  const updateTrigger = () => {
    const style = FLOOR_STYLES[selectedStyle] ?? FLOOR_STYLES[DEFAULT_STYLE];
    trigger.replaceChildren();
    const preview = document.createElement("img");
    preview.src = style.previewSrc ?? style.src;
    preview.alt = "";
    rotateStylePreview(preview, style);
    const label = document.createElement("span");
    label.textContent = styleLabel(style);
    trigger.append(preview, label, icon);
  };
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";
  updateTrigger();
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    wrapper.classList.toggle("open");
  });

  const menu = document.createElement("div");
  menu.className = "tsu-floor-style-menu";
  for (const category of FLOOR_STYLE_CATEGORIES) {
    const categoryRow = document.createElement("div");
    categoryRow.className = "tsu-floor-style-category";
    categoryRow.tabIndex = 0;
    const categoryLabel = document.createElement("span");
    categoryLabel.textContent = localize(`Categories.${category.key}`, category.fallback);
    const arrow = document.createElement("i");
    arrow.className = "fa-solid fa-chevron-right";
    const submenu = document.createElement("div");
    submenu.className = "tsu-floor-style-submenu";
    for (const styleKey of category.styles) {
      const style = FLOOR_STYLES[styleKey];
      if (!style) continue;
      const choice = document.createElement("button");
      choice.type = "button";
      choice.dataset.style = styleKey;
      choice.title = styleLabel(style);
      const preview = document.createElement("img");
      preview.src = style.previewSrc ?? style.src;
      preview.alt = "";
      rotateStylePreview(preview, style);
      const label = document.createElement("span");
      label.textContent = styleLabel(style);
      choice.append(preview, label);
      choice.classList.toggle("selected", styleKey === selectedStyle);
      choice.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedStyle = styleKey;
        wrapper.querySelectorAll("[data-style]").forEach((item) => item.classList.toggle("selected", item.dataset.style === styleKey));
        updateTrigger();
        wrapper.classList.remove("open");
      });
      submenu.append(choice);
    }
    categoryRow.append(categoryLabel, arrow, submenu);
    menu.append(categoryRow);
  }
  wrapper.append(trigger, menu);
  const levelLabel = document.createElement("label");
  levelLabel.className = "tsu-floor-level";
  levelLabel.textContent = localize("CurrentLevel", "Current map level");
  const levelInput = document.createElement("input");
  levelInput.type = "number";
  levelInput.step = "1";
  levelInput.value = String(currentLevel);
  levelInput.title = localize("CurrentLevelHint", "This level and uncovered lower floors are visible.");
  levelInput.addEventListener("change", async () => {
    currentLevel = Number(levelInput.value) || 0;
    scheduleRedraw();
    const nativeLevel = await ensureNativeLevel(currentLevel);
    if (nativeLevel && canvas?.level?.id !== nativeLevel.id) await canvas.scene.view({ level: nativeLevel.id });
  });
  levelLabel.append(levelInput);
  wrapper.append(levelLabel);
  const targetLevelLabel = document.createElement("label");
  targetLevelLabel.className = "tsu-floor-level";
  targetLevelLabel.textContent = localize("FloorLevel", "Floor level");
  const targetLevelInput = document.createElement("input");
  targetLevelInput.type = "number";
  targetLevelInput.step = "1";
  targetLevelInput.value = String(selectedLevel);
  targetLevelInput.title = localize("FloorLevelHint", "New floors and the change-level tool use this value.");
  targetLevelInput.addEventListener("change", () => { selectedLevel = Number(targetLevelInput.value) || 0; });
  targetLevelLabel.append(targetLevelInput);
  wrapper.append(targetLevelLabel);
  document.body.append(wrapper);
  requestAnimationFrame(positionStyleSelect);
}

function positionStyleSelect() {
  const picker = document.querySelector(".tsu-floor-style-picker");
  if (!(picker instanceof HTMLElement) || currentControlName() !== CONTROL_NAME) return;
  const tools = Array.from(document.querySelectorAll("#scene-controls-tools .tool"));
  const anchor = tools.at(-1);
  if (!(anchor instanceof HTMLElement)) return;

  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const maxLeft = Math.max(gap, window.innerWidth - picker.offsetWidth - gap);
  const maxTop = Math.max(gap, window.innerHeight - picker.offsetHeight - gap);
  picker.style.left = `${Math.min(Math.max(gap, rect.left), maxLeft)}px`;
  picker.style.top = `${Math.min(Math.max(gap, rect.bottom + gap), maxTop)}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(positionStyleSelect));
document.addEventListener("pointerdown", (event) => {
  const picker = document.querySelector(".tsu-floor-style-picker");
  if (picker && !picker.contains(event.target)) picker.classList.remove("open");
});

function getSceneDataForScene(scene) {
  const raw = scene?.getFlag?.(MODULE_ID, FLAG_ROOT);
  const floors = Array.isArray(raw?.floors) ? foundry.utils.deepClone(raw.floors).filter((floor) => floor.style !== "dread-zone") : [];
  return { version: 1, floors };
}

function getSceneData() {
  return getSceneDataForScene(canvas?.scene);
}

export function getCurrentFloorLevel() {
  return Number(currentLevel) || 0;
}

export function getFloorNumberForNativeLevel(level) {
  const stored = Number(level?.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG]);
  return Number.isFinite(stored) ? stored : Number(level?.index ?? 0);
}

function findNativeLevel(floorNumber, scene = canvas?.scene) {
  const levels = scene?.levels?.sorted ?? [];
  return levels.find((level) => Number(level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG]) === Number(floorNumber))
    ?? levels.find((level) => level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG] == null && Number(level.index) === Number(floorNumber));
}

async function persistNativeLevelNumbers(scene) {
  const updates = (scene?.levels?.sorted ?? [])
    .filter((level) => level.flags?.[MODULE_ID]?.[LEVEL_NUMBER_FLAG] == null)
    .map((level) => ({
      _id: level.id,
      [`flags.${MODULE_ID}.${LEVEL_NUMBER_FLAG}`]: Number(level.index),
    }));
  if (updates.length) await scene.updateEmbeddedDocuments("Level", updates);
}

async function ensureNativeLevel(floorNumber, scene = canvas?.scene) {
  if (!scene || !game.user?.isGM) return findNativeLevel(floorNumber, scene);
  await persistNativeLevelNumbers(scene);
  const existing = findNativeLevel(floorNumber, scene);
  if (existing) return existing;
  const levels = scene.levels?.sorted ?? [];
  const reference = findNativeLevel(0, scene) ?? levels[0];
  const referenceNumber = getFloorNumberForNativeLevel(reference);
  const referenceBottom = Number.isFinite(Number(reference?.elevation?.bottom)) ? Number(reference.elevation.bottom) : 0;
  const rawHeight = Number(reference?.elevation?.top) - Number(reference?.elevation?.bottom);
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 10;
  const bottom = referenceBottom + (Number(floorNumber) - referenceNumber) * height;
  const [created] = await scene.createEmbeddedDocuments("Level", [{
    name: localize("NativeLevelName", `Map level ${floorNumber}`).replace("{level}", String(floorNumber)),
    elevation: { bottom, top: bottom + height },
    sort: Number(floorNumber) * (CONST.SORT_INTEGER_DENSITY ?? 100000),
    flags: { [MODULE_ID]: { [LEVEL_NUMBER_FLAG]: Number(floorNumber) } },
  }]);
  if (created && scene === canvas?.scene) {
    ui.notifications.info(localize("NativeLevelCreated", `Created Foundry map level ${floorNumber}.`).replace("{level}", String(floorNumber)));
  }
  return created ?? null;
}

async function undoFloorAction() {
  const scene = canvas?.scene;
  if (!scene || !enabled()) return;
  if (localFloorMutationInProgress(scene)) return;
  const key = regionSyncKey(scene);
  const entry = floorUndoEntries.get(key);
  if (!entry || JSON.stringify(getSceneDataForScene(scene)) !== JSON.stringify(entry.after)) {
    floorUndoEntries.delete(key);
    return ui.notifications.info(localize("NothingToUndo", "There is no floor action to undo."));
  }
  await setSceneData(foundry.utils.deepClone(entry.before), { recordUndo: false });
  draftPoints = [];
  selectedEdge = null;
  lastClick = null;
  redrawEditor();
}

async function setSceneData(data, { recordUndo = true } = {}) {
  if (!canvas?.scene || !game.user?.isGM) return;
  const scene = canvas.scene;
  if (localFloorMutationInProgress(scene)) return;
  const previousData = getSceneDataForScene(scene);
  if (JSON.stringify(previousData) === JSON.stringify(data)) return;
  const syncScope = buildFloorSyncScope(previousData, data);
  const sceneKey = beginLocalFloorMutation(scene);
  try {
    await scene.setFlag(MODULE_ID, FLAG_ROOT, data);
    if (recordUndo) {
      floorUndoEntries.set(sceneKey, {
        before: foundry.utils.deepClone(previousData),
        after: foundry.utils.deepClone(data),
      });
    } else floorUndoEntries.delete(sceneKey);
    floorDataSnapshots.set(sceneKey, foundry.utils.deepClone(data));

    const changedFloorNumbers = [...new Set(data.floors
      .filter((floor) => syncScope.floorIds.has(floor.id))
      .map((floor) => Number(floor.level ?? 0)))].sort((a, b) => a - b);
    for (const floorNumber of changedFloorNumbers) {
      await ensureNativeLevel(floorNumber, scene);
    }
    await synchronizeLowerLevelVisibility(scene);

    if (!floorSyncScopeEmpty(syncScope)) {
      await queueFloorSurfaceSync(scene, syncScope);
      await queueRubbleRegionSync(scene, syncScope);
    }
  } finally {
    endLocalFloorMutation(scene);
  }
}

function canManageFloorSurfaces() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  return !activeGM || activeGM.id === game.user.id;
}

function physicalFloor(floor) {
  return !styleIsOverlay(floor?.style) && normalizePolygon(floor?.points).length >= 3;
}

function regionSyncKey(scene) {
  return scene?.id ?? scene?.uuid ?? "scene";
}

function beginLocalFloorMutation(scene) {
  const key = regionSyncKey(scene);
  localFloorMutationDepth.set(key, (localFloorMutationDepth.get(key) ?? 0) + 1);
  return key;
}

function endLocalFloorMutation(scene) {
  const key = regionSyncKey(scene);
  const depth = (localFloorMutationDepth.get(key) ?? 1) - 1;
  if (depth > 0) localFloorMutationDepth.set(key, depth);
  else localFloorMutationDepth.delete(key);
}

function localFloorMutationInProgress(scene) {
  return (localFloorMutationDepth.get(regionSyncKey(scene)) ?? 0) > 0;
}

function floorRegionSignature(floor) {
  const points = normalizePolygon(floor?.points).map((point) => [Number(point.x), Number(point.y)]);
  return JSON.stringify({
    style: floor?.style ?? "",
    level: Number(floor?.level ?? 0),
    points,
  });
}

function floorSyncPolygon(floor) {
  const points = normalizePolygon(floor?.points);
  return points.length >= 3 ? points : null;
}

function boundsIntersect(left, right) {
  if (!left || !right) return false;
  return left.x <= right.x + right.width + EPSILON
    && left.x + left.width + EPSILON >= right.x
    && left.y <= right.y + right.height + EPSILON
    && left.y + left.height + EPSILON >= right.y;
}

function polygonsOverlap(left, right) {
  if (!left?.length || !right?.length) return false;
  if (!boundsIntersect(polygonBounds(left), polygonBounds(right))) return false;
  if (left.some((point) => pointInPolygon(point, right)) || right.some((point) => pointInPolygon(point, left))) return true;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const a = left[leftIndex];
    const b = left[(leftIndex + 1) % left.length];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const c = right[rightIndex];
      const d = right[(rightIndex + 1) % right.length];
      if (segmentIntersection(a, b, c, d)) return true;
    }
  }
  return false;
}

function buildFloorSyncScope(previousData, nextData) {
  const previous = new Map((previousData?.floors ?? []).map((floor) => [floor.id, floor]));
  const next = new Map((nextData?.floors ?? []).map((floor) => [floor.id, floor]));
  const floorIds = new Set();
  const polygons = [];

  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const before = previous.get(id);
    const after = next.get(id);
    if (before && after && floorRegionSignature(before) === floorRegionSignature(after)) continue;
    floorIds.add(id);
    const beforePolygon = floorSyncPolygon(before);
    const afterPolygon = floorSyncPolygon(after);
    if (beforePolygon) polygons.push(beforePolygon);
    if (afterPolygon) polygons.push(afterPolygon);
  }
  return { floorIds, polygons };
}

function floorSyncScopeEmpty(scope) {
  return Boolean(scope) && !scope.floorIds?.size && !scope.polygons?.length;
}

function floorTouchesSyncScope(floor, scope) {
  if (!scope) return true;
  if (scope.floorIds?.has(floor?.id)) return true;
  const polygon = floorSyncPolygon(floor);
  return Boolean(polygon && scope.polygons?.some((dirtyPolygon) => polygonsOverlap(polygon, dirtyPolygon)));
}

function regionTouchesSyncScope(region, scope) {
  if (!scope) return true;
  const linkedFloorIds = [
    floorSurfaceRegionLink(region)?.floorId,
    rubbleRegionLink(region)?.floorId,
  ].filter(Boolean);
  if (linkedFloorIds.some((floorId) => scope.floorIds?.has(floorId))) return true;
  const polygon = regionPolygon(region);
  return Boolean(polygon?.length && scope.polygons?.some((dirtyPolygon) => polygonsOverlap(polygon, dirtyPolygon)));
}

function floorSurfaceRegionLink(region) {
  return region?.flags?.[MODULE_ID]?.[FLOOR_SURFACE_REGION_FLAG] ?? null;
}

function floorSurfaceBehaviorData() {
  return {
    name: "",
    type: "defineSurface",
    system: {
      placement: "bottom",
      light: true,
      move: false,
      // Restrict vision at the floor polygon, leaving uncovered lower levels visible.
      sight: true,
      sound: false,
      occlusion: false,
      exposure: false,
      culling: true,
    },
    disabled: false,
  };
}

function floorSurfaceBehavior(region) {
  return [...(region?.behaviors ?? [])].find((behavior) => behavior.type === "defineSurface"
    && !behavior.disabled && Boolean(behavior.system?.culling ?? behavior._source?.system?.culling));
}

function regionHasFloorSurface(region) {
  return Boolean(floorSurfaceBehavior(region));
}

function liveRegion(scene, regionOrId) {
  const id = typeof regionOrId === "string" ? regionOrId : regionOrId?.id;
  return id ? (scene?.regions?.get(id) ?? null) : null;
}

function missingRegionError(error) {
  const message = String(error?.message ?? error ?? "");
  return /\bRegion(?:Behavior)?\b.*(?:does not exist|not found)/i.test(message);
}

async function deleteLiveRegions(scene, ids) {
  for (const id of [...new Set(ids)]) {
    const region = liveRegion(scene, id);
    if (!region) continue;
    try {
      await region.delete();
    } catch (error) {
      if (!missingRegionError(error)) throw error;
    }
  }
}

async function updateLiveRegion(scene, update) {
  const id = update?._id;
  const region = liveRegion(scene, id);
  if (!region) return null;
  const changes = { ...update };
  delete changes._id;
  try {
    if (Object.keys(changes).length) await region.update(changes);
  } catch (error) {
    if (!missingRegionError(error)) throw error;
    return null;
  }
  return liveRegion(scene, id);
}

async function updateLiveRegionBehavior(scene, regionOrId, update) {
  const region = liveRegion(scene, regionOrId);
  const behavior = region?.behaviors?.get(update?._id);
  if (!region || !behavior) return null;
  const changes = { ...update };
  delete changes._id;
  try {
    if (Object.keys(changes).length) await behavior.update(changes);
  } catch (error) {
    if (!missingRegionError(error)) throw error;
    return null;
  }
  return liveRegion(scene, region.id)?.behaviors?.get(behavior.id) ?? null;
}

async function createLiveRegionBehavior(scene, regionOrId, data, exists) {
  const region = liveRegion(scene, regionOrId);
  if (!region || (exists && exists(region))) return null;
  try {
    return await region.createEmbeddedDocuments("RegionBehavior", [data]);
  } catch (error) {
    if (!missingRegionError(error)) throw error;
    return null;
  }
}

async function withBrowserRegionLock(scene, task) {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return task();
  const worldId = game.world?.id ?? game.world?.name ?? "world";
  const sceneId = scene?.id ?? scene?.uuid ?? "scene";
  return locks.request(`${MODULE_ID}:region-sync:${worldId}:${sceneId}`, { mode: "exclusive" }, task);
}

function floorSurfacePlacement(scene, floor) {
  const nativeLevel = findNativeLevel(Number(floor.level ?? 0), scene);
  if (!nativeLevel) return null;
  const elevation = Number(nativeLevel.elevation?.bottom ?? nativeLevel.elevation?.base ?? 0);
  return { elevation, levels: [nativeLevel.id] };
}

function floorSurfaceRegionData(scene, floor) {
  const placement = floorSurfacePlacement(scene, floor);
  if (!placement) return null;
  return {
    name: localize("FloorSurfaceRegionName", "Floor surface (automatic)"),
    shapes: [rubbleRegionShape(floor)],
    elevation: { bottom: placement.elevation, top: placement.elevation, topInclusive: true },
    levels: placement.levels,
    restriction: { enabled: false, type: "move", priority: 0 },
    attachment: { token: null },
    behaviors: [floorSurfaceBehaviorData()],
    visibility: globalThis.CONST?.REGION_VISIBILITY?.LAYER_UNLOCKED ?? 4,
    highlightMode: "shapes",
    displayMeasurements: false,
    hidden: false,
    locked: true,
    flags: {
      [MODULE_ID]: {
        [FLOOR_SURFACE_REGION_FLAG]: { floorId: floor.id, version: FLOOR_SURFACE_REGION_VERSION },
      },
    },
  };
}

async function synchronizeLowerLevelVisibility(scene) {
  return reconcileLowerLevelVisibility(scene);
}

function managedLowerLevelIds(level) {
  const value = level?.flags?.[MODULE_ID]?.[MANAGED_LOWER_VISIBILITY_FLAG];
  return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id) : [];
}

async function reconcileLowerLevelVisibility(scene, { legacyCleanup = false } = {}) {
  if (!scene || !canManageFloorSurfaces()) return;
  const levels = scene?.levels?.sorted ?? [];
  const coveredFloorNumbers = new Set(getSceneDataForScene(scene).floors
    .filter(physicalFloor)
    .map((floor) => Number(floor.level ?? 0)));
  const updates = [];
  for (const level of levels) {
    const floorNumber = getFloorNumberForNativeLevel(level);
    const lowerIds = levels
      .filter((candidate) => getFloorNumberForNativeLevel(candidate) < floorNumber)
      .map((candidate) => candidate.id);
    const current = level._source?.visibility?.levels ?? [];
    const previousManaged = managedLowerLevelIds(level);
    const hasAutomaticOcclusion = coveredFloorNumbers.has(floorNumber);
    const desired = hasAutomaticOcclusion
      ? [...new Set([...current, ...lowerIds])]
      : current.filter((id) => !(legacyCleanup ? lowerIds : previousManaged).includes(id));
    const nextManaged = hasAutomaticOcclusion
      ? [...new Set([...previousManaged, ...lowerIds.filter((id) => legacyCleanup || !current.includes(id))])]
      : [];
    if (sameStringSet(current, desired) && sameStringSet(previousManaged, nextManaged)) continue;
    updates.push({
      _id: level.id,
      "visibility.levels": desired,
      [`flags.${MODULE_ID}.${MANAGED_LOWER_VISIBILITY_FLAG}`]: nextManaged,
    });
  }
  if (updates.length) await scene.updateEmbeddedDocuments("Level", updates);
}

async function synchronizeFloorSurfaceRegions(scene, scope = null) {
  if (!scene || !canManageFloorSurfaces() || !scene.regions) return;
  if (!scope) await synchronizeLowerLevelVisibility(scene);

  const allFloors = getSceneDataForScene(scene).floors.filter(physicalFloor);
  const allFloorIds = new Set(allFloors.map((floor) => floor.id));
  const floors = scope ? allFloors.filter((floor) => floorTouchesSyncScope(floor, scope)) : allFloors;
  const managedByFloor = new Map();
  const deleteIds = new Set();

  for (const region of [...scene.regions]) {
    const floorId = floorSurfaceRegionLink(region)?.floorId;
    if (!floorId || !regionTouchesSyncScope(region, scope)) continue;
    if (!allFloorIds.has(floorId) || managedByFloor.has(floorId)) deleteIds.add(region.id);
    else managedByFloor.set(floorId, region.id);
  }

  await deleteLiveRegions(scene, deleteIds);

  for (const floorSnapshot of floors) {
    const floor = getSceneDataForScene(scene).floors.find((candidate) => candidate.id === floorSnapshot.id && physicalFloor(candidate));
    if (!floor || !floorTouchesSyncScope(floor, scope)) continue;
    const regionId = managedByFloor.get(floor.id);
    let region = liveRegion(scene, regionId);
    if (!region) continue;
    const placement = floorSurfacePlacement(scene, floor);
    if (!placement) continue;

    const link = floorSurfaceRegionLink(region);
    const update = { _id: region.id };
    let changed = false;
    const desiredVisibility = globalThis.CONST?.REGION_VISIBILITY?.LAYER_UNLOCKED ?? 4;
    if (Number(region._source?.visibility ?? region.visibility) !== desiredVisibility) {
      update.visibility = desiredVisibility;
      changed = true;
    }
    if ((region._source?.highlightMode ?? region.highlightMode) !== "shapes") {
      update.highlightMode = "shapes";
      changed = true;
    }
    if (Boolean(region._source?.displayMeasurements ?? region.displayMeasurements)) {
      update.displayMeasurements = false;
      changed = true;
    }
    if (!regionMatchesRubble(region, floor)) {
      update.shapes = [rubbleRegionShape(floor)];
      changed = true;
    }
    if (!sameStringSet(region._source?.levels ?? [], placement.levels)) {
      update.levels = placement.levels;
      changed = true;
    }
    const bottom = Number(region._source?.elevation?.bottom);
    const top = Number(region._source?.elevation?.top);
    if (bottom !== placement.elevation || top !== placement.elevation) {
      update.elevation = { bottom: placement.elevation, top: placement.elevation, topInclusive: true };
      changed = true;
    }
    if (link?.floorId !== floor.id || Number(link?.version) !== FLOOR_SURFACE_REGION_VERSION) {
      update[`flags.${MODULE_ID}.${FLOOR_SURFACE_REGION_FLAG}`] = {
        floorId: floor.id,
        version: FLOOR_SURFACE_REGION_VERSION,
      };
      changed = true;
    }
    if (changed) region = await updateLiveRegion(scene, update);
    else region = liveRegion(scene, region.id);
    if (!region) continue;

    const behavior = floorSurfaceBehavior(region);
    if (!behavior) {
      await createLiveRegionBehavior(scene, region.id, floorSurfaceBehaviorData(), floorSurfaceBehavior);
    } else {
      const behaviorUpdate = { _id: behavior.id };
      for (const restriction of ["light", "sight"]) {
        if (!Boolean(behavior.system?.[restriction] ?? behavior._source?.system?.[restriction])) {
          behaviorUpdate[`system.${restriction}`] = true;
        }
      }
      if (Object.keys(behaviorUpdate).length > 1) {
        await updateLiveRegionBehavior(scene, region.id, behaviorUpdate);
      }
    }
  }

  const latestFloors = getSceneDataForScene(scene).floors
    .filter(physicalFloor)
    .filter((floor) => floorTouchesSyncScope(floor, scope));
  const existingFloorIds = new Set([...scene.regions]
    .map((region) => floorSurfaceRegionLink(region)?.floorId)
    .filter(Boolean));
  for (const floor of latestFloors) {
    if (existingFloorIds.has(floor.id)) continue;
    const data = floorSurfaceRegionData(scene, floor);
    if (!data) continue;
    await scene.createEmbeddedDocuments("Region", [data]);
    existingFloorIds.add(floor.id);
  }
}

function queueRegionSync(scene, task, errorLabel) {
  if (!scene) return Promise.resolve();
  const key = scene.id ?? scene.uuid;
  const previous = regionSyncs.get(key) ?? Promise.resolve();
  let queued;
  queued = previous.catch(() => {}).then(() => withBrowserRegionLock(scene, task)).catch((error) => {
    if (!missingRegionError(error)) console.error(`${MODULE_ID} | ${errorLabel}`, scene.name, error);
  }).finally(() => {
    if (regionSyncs.get(key) === queued) regionSyncs.delete(key);
  });
  regionSyncs.set(key, queued);
  return queued;
}

function queueFloorSurfaceSync(scene, scope = null) {
  if (!scene || !canManageFloorSurfaces()) return Promise.resolve();
  if (floorSyncScopeEmpty(scope)) return Promise.resolve();
  return queueRegionSync(
    scene,
    () => synchronizeFloorSurfaceRegions(scene, scope),
    "Failed to synchronize procedural floor surfaces",
  );
}

function canManageRubbleRegions() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  return !activeGM || activeGM.id === game.user.id;
}

function rubbleFloor(floor) {
  return floorMovementCost(floor) >= DIFFICULT_TERRAIN_COST;
}

function floorMovementCost(floor) {
  const style = FLOOR_STYLES[floor?.style];
  if (!style?.difficultTerrain) return 0;
  const cost = Number(style.movementCost ?? DIFFICULT_TERRAIN_COST);
  return cost >= GREATER_DIFFICULT_TERRAIN_COST
    ? GREATER_DIFFICULT_TERRAIN_COST
    : DIFFICULT_TERRAIN_COST;
}

function rubbleRegionLink(region) {
  return region?.flags?.[MODULE_ID]?.[RUBBLE_REGION_FLAG] ?? null;
}

function rubbleRegionShape(floor) {
  const points = normalizePolygon(floor.points).flatMap((point) => [Number(point.x), Number(point.y)]);
  return { type: "polygon", hole: false, points, origin: null };
}

function regionPolygon(region) {
  const shapes = region?._source?.shapes ?? region?.shapes ?? [];
  if (shapes.length !== 1 || shapes[0]?.type !== "polygon" || !Array.isArray(shapes[0]?.points)) return null;
  const points = [];
  for (let index = 0; index < shapes[0].points.length; index += 2) {
    points.push({ x: Number(shapes[0].points[index]), y: Number(shapes[0].points[index + 1]) });
  }
  return normalizePolygon(points);
}

function regionHasDifficultTerrain(region) {
  return [...(region?.behaviors ?? [])].some((behavior) => {
    if (behavior.type !== "modifyMovementCost" || behavior.disabled) return false;
    const difficulties = behavior.system?.difficulties ?? behavior._source?.system?.difficulties ?? {};
    return Number(difficulties.walk ?? 1) >= 2;
  });
}

function regionMatchesRubble(region, floor) {
  const polygon = regionPolygon(region);
  return polygon && polygonsEquivalent(polygon, normalizePolygon(floor.points));
}

function rubbleRegionLevels(scene, floor) {
  const nativeLevel = findNativeLevel(Number(floor.level ?? 0), scene);
  return nativeLevel?.id ? [nativeLevel.id] : [];
}

function sameStringSet(left, right) {
  const a = [...(left ?? [])].map(String).sort();
  const b = [...(right ?? [])].map(String).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function difficultTerrainBehaviorData(floor) {
  const movementCost = floorMovementCost(floor) || DIFFICULT_TERRAIN_COST;
  return {
    name: "",
    type: "modifyMovementCost",
    system: { difficulties: { walk: movementCost, travel: movementCost } },
    disabled: false,
  };
}

function difficultTerrainBehaviorUpdate(region, floor) {
  const behavior = [...(region?.behaviors ?? [])].find((candidate) => candidate.type === "modifyMovementCost");
  const behaviorId = behavior?.id ?? behavior?._id;
  if (!behavior || !behaviorId) return null;

  const movementCost = floorMovementCost(floor) || DIFFICULT_TERRAIN_COST;
  const difficulties = behavior.system?.difficulties ?? behavior._source?.system?.difficulties ?? {};
  const update = { _id: behaviorId };
  if (Number(difficulties.walk ?? 1) !== movementCost) update["system.difficulties.walk"] = movementCost;
  if (Number(difficulties.travel ?? 1) !== movementCost) update["system.difficulties.travel"] = movementCost;
  if (behavior.disabled) update.disabled = false;
  return Object.keys(update).length > 1 ? update : null;
}

function difficultTerrainRegionName(floor) {
  const style = FLOOR_STYLES[floor?.style];
  if (style?.crowd) return localize("CrowdRegionName", "Crowd — difficult terrain");
  return style?.warehouse
    ? localize("WarehouseRegionName", "Warehouse clutter — difficult terrain")
    : style?.forest
      ? localize("ForestRegionName", "Forest — difficult terrain")
      : floorMovementCost(floor) >= GREATER_DIFFICULT_TERRAIN_COST
        ? localize("SwampRegionName", "Swamp — greater difficult terrain")
        : localize("RubbleRegionName", "Rubble — difficult terrain");
}

function rubbleRegionData(scene, floor) {
  return {
    name: difficultTerrainRegionName(floor),
    shapes: [rubbleRegionShape(floor)],
    elevation: { bottom: null, top: null, topInclusive: false },
    levels: rubbleRegionLevels(scene, floor),
    restriction: { enabled: false, type: "move", priority: 0 },
    attachment: { token: null },
    behaviors: [difficultTerrainBehaviorData(floor)],
    visibility: globalThis.CONST?.REGION_VISIBILITY?.LAYER_UNLOCKED ?? 4,
    highlightMode: "shapes",
    displayMeasurements: false,
    hidden: false,
    locked: false,
    flags: {
      [MODULE_ID]: {
        [RUBBLE_REGION_FLAG]: { floorId: floor.id, version: RUBBLE_REGION_VERSION },
      },
    },
  };
}

async function synchronizeRubbleRegions(scene, scope = null) {
  if (!scene || !canManageRubbleRegions() || !scene.regions) return;
  const allFloors = getSceneDataForScene(scene).floors.filter(rubbleFloor);
  const allFloorIds = new Set(allFloors.map((floor) => floor.id));
  const floors = scope ? allFloors.filter((floor) => floorTouchesSyncScope(floor, scope)) : allFloors;
  const regions = [...scene.regions];
  const claimedRegionIds = new Set();
  const deleteIds = new Set();
  const managedByFloor = new Map();

  for (const region of regions) {
    const floorId = rubbleRegionLink(region)?.floorId;
    if (!floorId || !regionTouchesSyncScope(region, scope)) continue;
    if (!allFloorIds.has(floorId)) {
      deleteIds.add(region.id);
      continue;
    }
    if (managedByFloor.has(floorId)) deleteIds.add(region.id);
    else managedByFloor.set(floorId, region.id);
  }

  await deleteLiveRegions(scene, deleteIds);

  for (const floorSnapshot of floors) {
    const floor = getSceneDataForScene(scene).floors.find((candidate) => candidate.id === floorSnapshot.id && rubbleFloor(candidate));
    if (!floor || !floorTouchesSyncScope(floor, scope)) continue;
    let region = liveRegion(scene, managedByFloor.get(floor.id));
    if (!region) {
      region = [...scene.regions].find((candidate) => !claimedRegionIds.has(candidate.id)
        && regionTouchesSyncScope(candidate, scope)
        && !rubbleRegionLink(candidate)
        && regionHasDifficultTerrain(candidate)
        && regionMatchesRubble(candidate, floor)) ?? null;
    }
    if (!region) continue;
    claimedRegionIds.add(region.id);

    const update = { _id: region.id };
    let changed = false;
    if (!regionMatchesRubble(region, floor)) {
      update.shapes = [rubbleRegionShape(floor)];
      changed = true;
    }
    const desiredLevels = rubbleRegionLevels(scene, floor);
    if (!sameStringSet(region._source?.levels ?? [], desiredLevels)) {
      update.levels = desiredLevels;
      changed = true;
    }
    const regionLink = rubbleRegionLink(region);
    const desiredName = difficultTerrainRegionName(floor);
    if (regionLink && region.name !== desiredName) {
      update.name = desiredName;
      changed = true;
    }
    if (regionLink?.floorId !== floor.id || Number(regionLink?.version) !== RUBBLE_REGION_VERSION) {
      update[`flags.${MODULE_ID}.${RUBBLE_REGION_FLAG}`] = { floorId: floor.id, version: RUBBLE_REGION_VERSION };
      changed = true;
    }
    if (changed) region = await updateLiveRegion(scene, update);
    else region = liveRegion(scene, region.id);
    if (!region) continue;

    const behavior = [...(region.behaviors ?? [])].find((candidate) => candidate.type === "modifyMovementCost");
    if (!behavior) {
      await createLiveRegionBehavior(
        scene,
        region.id,
        difficultTerrainBehaviorData(floor),
        (candidate) => [...(candidate.behaviors ?? [])].some((item) => item.type === "modifyMovementCost"),
      );
    } else {
      const behaviorUpdate = difficultTerrainBehaviorUpdate(region, floor);
      if (behaviorUpdate) await updateLiveRegionBehavior(scene, region.id, behaviorUpdate);
    }
  }

  const latestFloors = getSceneDataForScene(scene).floors
    .filter(rubbleFloor)
    .filter((floor) => floorTouchesSyncScope(floor, scope));
  const existingFloorIds = new Set([...scene.regions]
    .map((region) => rubbleRegionLink(region)?.floorId)
    .filter(Boolean));
  for (const floor of latestFloors) {
    if (existingFloorIds.has(floor.id)) continue;
    await scene.createEmbeddedDocuments("Region", [rubbleRegionData(scene, floor)]);
    existingFloorIds.add(floor.id);
  }
}

function queueRubbleRegionSync(scene, scope = null) {
  if (!scene || !canManageRubbleRegions()) return Promise.resolve();
  if (floorSyncScopeEmpty(scope)) return Promise.resolve();
  return queueRegionSync(
    scene,
    () => synchronizeRubbleRegions(scene, scope),
    "Failed to synchronize rubble difficult-terrain regions",
  );
}

function randomId() {
  return foundry.utils.randomID?.() ?? crypto.randomUUID();
}

function storedFloor(source, points) {
  const normalized = normalizePolygon(points);
  return {
    id: randomId(),
    source,
    style: selectedStyle,
    level: selectedLevel,
    points: normalized,
    lines: source === "manual" ? normalized.map((point, index) => ({
      id: randomId(),
      a: point,
      b: normalized[(index + 1) % normalized.length],
    })) : [],
  };
}

async function addFloor(source, points, { replaceAt = null } = {}) {
  const data = getSceneData();
  const polygon = normalizePolygon(points);
  if (polygon.length < 3 || Math.abs(polygonArea(polygon)) < 1) {
    return ui.notifications.warn(localize("InvalidPolygon", "The floor boundary is invalid."));
  }
  if (polygonSelfIntersects(polygon)) {
    return ui.notifications.warn(localize("SelfIntersection", "The floor boundary crosses itself."));
  }
  if (replaceAt && !styleIsOverlay()) {
    const existing = data.floors
      .filter((floor) => floor.source !== "base" && pointInPolygon(replaceAt, floor.points))
      .filter((floor) => Number(floor.level ?? 0) === currentLevel)
      .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
    if (existing) {
      existing.style = selectedStyle;
      existing.level = selectedLevel;
      if (existing.source === "walls") {
        existing.points = polygon;
        existing.lines = [];
      }
      await setSceneData(data);
      return;
    }
  }
  const duplicate = data.floors.find((floor) => Number(floor.level ?? 0) === selectedLevel
    && (!styleIsOverlay() || styleIsOverlay(floor.style))
    && polygonsEquivalent(floor.points, polygon));
  if (duplicate) {
    duplicate.style = selectedStyle;
    duplicate.level = selectedLevel;
    await setSceneData(data);
    return;
  }
  data.floors.push(storedFloor(source, polygon));
  await setSceneData(data);
}

async function setBaseFloor() {
  if (styleIsOverlay()) {
    return ui.notifications.warn(localize("OverlayFloorOnly", "Overlay floors can only be placed over an existing floor."));
  }
  const rect = canvas?.dimensions?.sceneRect;
  if (!rect) return ui.notifications.warn(localize("NoScene", "The scene is not ready."));
  const points = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  const data = getSceneData();
  const existing = data.floors.find((floor) => floor.source === "base" && Number(floor.level ?? 0) === selectedLevel);
  const base = existing
    ? { ...existing, style: selectedStyle, level: selectedLevel, points, lines: [] }
    : storedFloor("base", points);
  data.floors = [base, ...data.floors.filter((floor) => floor !== existing)];
  await setSceneData(data);
  ui.notifications.info(localize("BaseFloorCreated", "The base floor covers the whole scene."));
}

async function removeFloorAt(point) {
  const data = getSceneData();
  const matches = data.floors
    .map((floor, index) => ({ floor, index, area: Math.abs(polygonArea(floor.points)) }))
    .filter(({ floor }) => pointInPolygon(point, floor.points))
    .filter(({ floor }) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => a.area - b.area);
  if (!matches.length) return ui.notifications.warn(localize("NoFloor", "No floor was found here."));
  data.floors.splice(matches[0].index, 1);
  await setSceneData(data);
}

async function replaceFloorStyleAt(point) {
  const data = getSceneData();
  const existing = data.floors
    .filter((floor) => floor.source !== "base" && pointInPolygon(point, floor.points))
    .filter((floor) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (!existing) return false;
  existing.style = selectedStyle;
  existing.level = selectedLevel;
  await setSceneData(data);
  return true;
}

async function changeFloorLevelAt(point) {
  const data = getSceneData();
  const existing = data.floors
    .filter((floor) => pointInPolygon(point, floor.points))
    .filter((floor) => Number(floor.level ?? 0) === currentLevel)
    .sort((a, b) => Math.abs(polygonArea(a.points)) - Math.abs(polygonArea(b.points)))[0];
  if (!existing) return ui.notifications.warn(localize("NoFloor", "No floor was found here."));
  existing.level = selectedLevel;
  await setSceneData(data);
  ui.notifications.info(localize("FloorLevelChanged", "Floor level changed."));
}

function bindStageEvents() {
  const element = document.getElementById("board")
    ?? canvas?.app?.canvas
    ?? canvas?.app?.renderer?.canvas
    ?? canvas?.app?.view;
  if (!(element instanceof HTMLElement) || stageBound === element) return;
  unbindStageEvents();
  stageBound = element;
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
}

function unbindStageEvents() {
  if (stageBound) {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
  }
  stageBound = null;
}

function eventPoint(event) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
    const element = stageBound
      ?? document.getElementById("board")
      ?? canvas?.app?.canvas
      ?? canvas?.app?.renderer?.canvas
      ?? canvas?.app?.view;
    const rectangle = element?.getBoundingClientRect?.();
    const screen = canvas?.app?.renderer?.screen;
    if (rectangle?.width && rectangle?.height && screen && canvas?.stage?.worldTransform) {
      const global = {
        x: (event.clientX - rectangle.left) * Number(screen.width) / rectangle.width,
        y: (event.clientY - rectangle.top) * Number(screen.height) / rectangle.height,
      };
      const local = canvas.stage.worldTransform.applyInverse(global);
      return { x: Number(local.x), y: Number(local.y) };
    }
  }
  const global = event?.global ?? event?.data?.global;
  if (!global || !canvas?.stage?.worldTransform) return null;
  const local = canvas.stage.worldTransform.applyInverse(global);
  return { x: Number(local.x), y: Number(local.y) };
}

function eventOnCanvas(event) {
  const element = stageBound ?? document.getElementById("board");
  return Boolean(element && (event.target === element || element.contains?.(event.target)));
}

function snapPoint(point) {
  const snapped = canvas?.grid?.getSnappedPoint?.(point, { mode: CONST.GRID_SNAPPING_MODES?.VERTEX ?? 0 });
  return snapped && Number.isFinite(snapped.x) ? { x: snapped.x, y: snapped.y } : point;
}

async function onPointerDown(event) {
  if (!activeTool || currentControlName() !== CONTROL_NAME || event.button !== 0 || !eventOnCanvas(event)) return;
  const rawPoint = eventPoint(event);
  if (!rawPoint) return;
  event.stopPropagation?.();

  if (activeTool === "erase") return removeFloorAt(rawPoint);
  if (activeTool === "level") return changeFloorLevelAt(rawPoint);
  if (activeTool === "fill") {
    const overlay = styleIsOverlay();
    if (!overlay && await replaceFloorStyleAt(rawPoint)) return;
    const polygon = findWallFace(rawPoint) ?? (overlay ? findExistingFloorFace(rawPoint) : null);
    if (!polygon) return ui.notifications.warn(localize("OpenRoom", "No closed room was found here."));
    return addFloor("walls", polygon, { replaceAt: overlay ? null : rawPoint });
  }

  const hit = findManualEdge(rawPoint);
  if (hit && draftPoints.length === 0) {
    selectedEdge = hit;
    redrawEditor();
    return;
  }

  const point = snapPoint(rawPoint);
  const now = Date.now();
  const doubleClick = lastClick && now - lastClick.time < 350 && distance(lastClick.point, point) < 8;
  if (!doubleClick) draftPoints.push(point);
  lastClick = { time: now, point };
  if (doubleClick) await finishDraft();
  redrawEditor(point);
}

function onPointerMove(event) {
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  if (!eventOnCanvas(event)) return;
  const point = eventPoint(event);
  if (!point) return;
  redrawEditor(point);
}

async function finishDraft() {
  const points = normalizePolygon(draftPoints);
  draftPoints = [];
  lastClick = null;
  if (points.length < 3) {
    ui.notifications.warn(localize("NeedThreePoints", "A floor needs at least three points."));
    return;
  }
  await addFloor("manual", points);
}

function findManualEdge(point) {
  const threshold = Math.max(8, Number(canvas?.dimensions?.size ?? 100) * 0.08);
  let best = null;
  for (const floor of getSceneData().floors) {
    if (Number(floor.level ?? 0) !== currentLevel) continue;
    if (floor.source !== "manual") continue;
    floor.points.forEach((a, index) => {
      const b = floor.points[(index + 1) % floor.points.length];
      const d = pointSegmentDistance(point, a, b);
      if (d <= threshold && (!best || d < best.distance)) best = { floorId: floor.id, edgeIndex: index, distance: d };
    });
  }
  return best;
}

function findExistingFloorFace(point) {
  return getSceneData().floors
    .filter((floor) => floor.source !== "base" && Number(floor.level ?? 0) === currentLevel && pointInPolygon(point, floor.points))
    .sort((left, right) => Math.abs(polygonArea(left.points)) - Math.abs(polygonArea(right.points)))[0]?.points ?? null;
}

document.addEventListener("keydown", async (event) => {
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  if (event.key === "Escape") {
    draftPoints = [];
    selectedEdge = null;
    redrawEditor();
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedEdge) {
    event.preventDefault();
    const data = getSceneData();
    data.floors = data.floors.filter((floor) => floor.id !== selectedEdge.floorId);
    selectedEdge = null;
    await setSceneData(data);
  }
});

function levelContainerName(baseName, floorNumber) {
  return `${baseName}:${Number(floorNumber) || 0}`;
}

function managedLevelContainers(baseName) {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return [];
  return parent.children?.filter((child) => child.name === baseName || child.name?.startsWith(`${baseName}:`)) ?? [];
}

function getLevelContainer(baseName, create, floorNumber, sortLayer, fallbackZIndex) {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return null;
  const name = levelContainerName(baseName, floorNumber);
  let container = parent.children?.find((child) => child.name === name);
  if (!container && create) {
    container = new PIXI.Container();
    container.name = name;
    container.eventMode = "none";
    container.sortableChildren = true;
    parent.sortableChildren = true;
    parent.addChild(container);
  }
  if (!container) return null;
  if (parent === canvas?.primary) {
    const nativeLevel = findNativeLevel(floorNumber);
    container.elevation = Number(nativeLevel?.elevation?.bottom ?? 0);
    container.sortLayer = sortLayer;
    container.sort = 0;
    container.zIndex = 0;
    parent.sortDirty = true;
  }
  else container.zIndex = fallbackZIndex + Number(floorNumber || 0);
  return container;
}

function getFloorContainer(create = true, floorNumber = currentLevel) {
  const sortLayers = canvas?.primary?.constructor?.SORT_LAYERS ?? {};
  return getLevelContainer(FLOOR_CONTAINER, create, floorNumber, Number(sortLayers.SCENE ?? 0), -10000);
}

function getCobwebAboveContainer(create = true, floorNumber = currentLevel) {
  const sortLayers = canvas?.primary?.constructor?.SORT_LAYERS ?? {};
  // Above ordinary asset tiles, but below border (+1) and wall (+3) textures.
  return getLevelContainer(COBWEB_ABOVE_CONTAINER, create, floorNumber, Number(sortLayers.TILES ?? 500) + 0.5, 9999);
}

function getWeatherContainer(create = true, floorNumber = currentLevel) {
  const sortLayers = canvas?.primary?.constructor?.SORT_LAYERS ?? {};
  const container = getLevelContainer(WEATHER_CONTAINER, create, floorNumber, Number(sortLayers.WEATHER ?? 1000), 20000);
  if (container && container.parent === canvas?.primary) {
    container.elevation = Infinity;
    container.sortLayer = Number(sortLayers.WEATHER ?? 1000);
    container.sort = 1;
    canvas.primary.sortDirty = true;
  }
  return container;
}

function getForestContainer(create = true, floorNumber = currentLevel) {
  const sortLayers = canvas?.primary?.constructor?.SORT_LAYERS ?? {};
  // Canopies cover the wall border, while placement clearance prevents them
  // from crossing the wall's inner edge.
  return getLevelContainer(FOREST_CONTAINER, create, floorNumber, Number(sortLayers.TILES ?? 500) + 2, 10001);
}

function getEditorContainer(create = true) {
  const parent = canvas?.controls ?? canvas?.stage;
  if (!parent) return null;
  let container = parent.children?.find((child) => child.name === EDIT_CONTAINER);
  if (!container && create) {
    container = new PIXI.Container();
    container.name = EDIT_CONTAINER;
    container.eventMode = "none";
    container.zIndex = 1000;
    parent.addChild(container);
  }
  return container;
}

function clearContainer(container) {
  if (!container) return;
  for (const child of container.removeChildren()) destroyDisplayObject(child);
}

function removeManagedLevelContainers(baseName) {
  const parent = canvas?.primary ?? canvas?.stage;
  if (!parent) return;
  for (const container of managedLevelContainers(baseName)) {
    parent.removeChild(container);
    destroyDisplayObject(container);
  }
  if (parent === canvas?.primary) parent.sortDirty = true;
}

function destroyDisplayObject(displayObject) {
  const ownedTextures = new Set();
  const collect = (child) => {
    if (child?._tsuOwnedTexture) ownedTextures.add(child._tsuOwnedTexture);
    for (const nested of child?.children ?? []) collect(nested);
  };
  collect(displayObject);
  displayObject?.destroy?.({ children: true });
  for (const texture of ownedTextures) texture.destroy?.(true);
}

function findForestLayer(floorId) {
  for (const container of managedLevelContainers(FOREST_CONTAINER)) {
    const layer = container.children?.find((child) => child._tsuForestFloorId === floorId);
    if (layer) return { container, layer };
  }
  return null;
}

function removeForestLayer(floorId) {
  const found = findForestLayer(floorId);
  if (!found) return;
  found.container.removeChild(found.layer);
  destroyDisplayObject(found.layer);
}

function newGraphics() {
  return new PIXI.Graphics();
}

function drawPolygon(graphics, points, color, alpha = 1) {
  if (!points.length) return;
  if (typeof graphics.poly === "function") graphics.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
  else {
    graphics.beginFill(color, alpha);
    graphics.drawPolygon(points.flatMap((p) => [p.x, p.y]));
    graphics.endFill();
  }
}

function drawLine(graphics, a, b, color, width, alpha = 1) {
  if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
    graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha });
  } else {
    graphics.lineStyle(width, color, alpha).moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
}

function drawClosedStroke(graphics, points, color, width, alpha = 1, join = "round", cap = "round") {
  if (!points.length) return;
  if (typeof graphics.stroke === "function") {
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.lineTo(points[0].x, points[0].y);
    graphics.stroke({ color, width, alpha, join, cap });
    return;
  }
  graphics.lineStyle(width, color, alpha);
  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.lineTo(points[0].x, points[0].y);
}

function redrawFloors({ forestOnly = false, forestFloorIds = [] } = {}) {
  const targetedForestIds = forestOnly ? new Set(forestFloorIds) : null;
  if (!forestOnly) {
    removeManagedLevelContainers(FLOOR_CONTAINER);
    removeManagedLevelContainers(COBWEB_ABOVE_CONTAINER);
    removeManagedLevelContainers(WEATHER_CONTAINER);
    removeManagedLevelContainers(FOREST_CONTAINER);
    forestRenderSignatures.clear();
  }
  // The setting controls the GM drawing tools only. Persisted floor data must
  // remain visible when a scene is opened from a compendium or in another world.
  if (!canvas?.ready) {
    removeManagedLevelContainers(FOREST_CONTAINER);
    forestRenderSignatures.clear();
    return;
  }
  const sceneData = getSceneData();
  const gridSize = Number(canvas?.dimensions?.size ?? 100);
  const texturePreset = currentTexturePreset();
  const blockingWalls = blockingWallSegments();
  const visibleForestIds = new Set();

  for (const floor of sceneData.floors) {
    if (Number(floor.level ?? 0) > currentLevel) continue;
    const points = normalizePolygon(floor.points);
    if (points.length < 3) continue;
    const floorNumber = Number(floor.level ?? 0);
    const style = FLOOR_STYLES[floor.style] ?? FLOOR_STYLES[DEFAULT_STYLE];
    if (style.weather && floorNumber !== currentLevel) continue;
    if (style.forest) {
      if (targetedForestIds && !targetedForestIds.has(floor.id)) continue;
      visibleForestIds.add(floor.id);
      const forestContainer = getForestContainer(true, floorNumber);
      const nearbyWalls = forestWallSegments(points, style.forest, blockingWalls);
      const signature = JSON.stringify({ gridSize, texturePreset, style: floor.style, level: floor.level, points, walls: nearbyWalls });
      if (forestRenderSignatures.get(floor.id) === signature && findForestLayer(floor.id)) continue;
      removeForestLayer(floor.id);
      const floorLayer = new PIXI.Container();
      floorLayer.eventMode = "none";
      floorLayer.zIndex = 0;
      floorLayer._tsuForestFloorId = floor.id;
      forestContainer?.addChild(floorLayer);
      const forest = createForestFill(points, style.forest, `${floor.id}:${floor.style}`, nearbyWalls);
      if (forest) floorLayer.addChild(forest);
      forestRenderSignatures.set(floor.id, signature);
      continue;
    }
    if (forestOnly) continue;
    const floorLayer = new PIXI.Container();
    floorLayer.eventMode = "none";
    floorLayer.zIndex = Number(style.renderOrder ?? (style.overlay ? 1000 : 0));
    const floorParent = style.weather
      ? getWeatherContainer(true, floorNumber)
      : style.cobweb?.layer === "above"
        ? getCobwebAboveContainer(true, floorNumber)
        : getFloorContainer(true, floorNumber);
    floorParent?.addChild(floorLayer);
    const boundarySeed = style.edge?.kind === "garden" ? "shared-garden-boundary" : `${floor.id}:${floor.style}`;
    const renderPoints = style.rubble
      ? points
      : style.edge?.texture ? points : style.edge ? createNaturalBoundary(points, boundarySeed, style.edge) : points;
    const stretchedOverlay = style.stretchedOverlay ?? style.cobweb;
    if (stretchedOverlay) {
      const overlay = createStretchedOverlayFill(renderPoints, stretchedOverlay);
      if (overlay) floorLayer.addChild(overlay);
      continue;
    }
    if (style.rubble) {
      const rubble = createRubbleFill(renderPoints, style.rubble, `${floor.id}:${floor.style}`);
      if (rubble) floorLayer.addChild(rubble);
      continue;
    }
    if (style.garden) {
      const garden = createGardenFill(renderPoints, style, `${floor.id}:${floor.style}`);
      if (garden) floorLayer.addChild(garden);
      const edgeGraphic = createFloorEdge(renderPoints, style.edge, `${floor.id}:${floor.style}`);
      if (edgeGraphic) floorLayer.addChild(edgeGraphic);
      continue;
    }
    const bounds = polygonBounds(renderPoints);
    const roofFrame = style.edge?.kind === "roof" ? orientedPolygonFrame(renderPoints) : null;
    const texture = PIXI.Texture.from(style.src);
    const roofTextureQuarterTurn = roofFrame && roofFrame.height > roofFrame.width ? 90 : 0;
    const rotationDegrees = Number(style.rotation ?? 0) + (roofFrame?.angle ?? 0) * 180 / Math.PI + roofTextureQuarterTurn;
    const swapsAxes = Math.abs(rotationDegrees) % 180 === 90;
    const spriteWidth = roofFrame
      ? (roofTextureQuarterTurn ? roofFrame.height : roofFrame.width)
      : (swapsAxes ? bounds.height : bounds.width);
    const spriteHeight = roofFrame
      ? (roofTextureQuarterTurn ? roofFrame.width : roofFrame.height)
      : (swapsAxes ? bounds.width : bounds.height);
    let sprite;
    try { sprite = new PIXI.TilingSprite({ texture, width: spriteWidth, height: spriteHeight }); }
    catch { sprite = new PIXI.TilingSprite(texture, spriteWidth, spriteHeight); }
    sprite.pivot.set(spriteWidth / 2, spriteHeight / 2);
    sprite.position.set(roofFrame?.center.x ?? bounds.x + bounds.width / 2, roofFrame?.center.y ?? bounds.y + bounds.height / 2);
    sprite.rotation = rotationDegrees * Math.PI / 180;
    const tileScale = style.cellSized
      ? Number(canvas?.dimensions?.size ?? 100) / Number(style.sourceSize ?? 200)
      : Number(style.scale ?? 1);
    sprite.tileScale?.set?.(tileScale);
    sprite.alpha = Math.max(0, Math.min(1, Number(style.alpha ?? 1)));
    const mask = isNaturalPathEdge(style.edge)
      ? createFeatheredFloorMask(renderPoints, bounds, style.edge)
      : newGraphics();
    if (!isNaturalPathEdge(style.edge)) drawPolygon(mask, renderPoints, 0xffffff);
    sprite.mask = mask;
    floorLayer.addChild(sprite, mask);
    const scatter = createNaturalScatter(renderPoints, style.scatter, `${floor.id}:${floor.style}`);
    if (scatter) floorLayer.addChild(scatter);
    const edgeGraphic = style.edge ? createFloorEdge(renderPoints, style.edge, `${floor.id}:${floor.style}`) : null;
    if (edgeGraphic) floorLayer.addChild(edgeGraphic);
  }
  if (!forestOnly) {
    for (const floorId of [...forestRenderSignatures.keys()]) {
      if (visibleForestIds.has(floorId)) continue;
      removeForestLayer(floorId);
      forestRenderSignatures.delete(floorId);
    }
  }
}

function isNaturalPathEdge(edge) {
  return edge?.kind === "dirt" || edge?.kind === "stone" || edge?.kind === "rubble";
}

function forestMaxWallClearance(forest) {
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  return (forest?.assets ?? []).reduce((maximum, asset) => {
    const aspect = Math.max(0.1, Number(asset.aspect ?? 1));
    const width = grid * Number(asset.maxSize ?? 1.5);
    const height = width / aspect;
    return Math.max(maximum, Math.max(0, Math.max(width, height) * 0.46 - grid * 0.1));
  }, 0);
}

function forestWallSegments(points, forest, walls) {
  const clearance = forestMaxWallClearance(forest);
  const unique = new Map();
  for (const wall of walls) {
    if (!segmentWithinPolygonClearance(wall, points, clearance)) continue;
    const segment = canonicalWallSegment(wall);
    unique.set(wallSegmentKey(segment), segment);
  }
  return [...unique.values()].sort((left, right) => wallSegmentKey(left).localeCompare(wallSegmentKey(right)));
}

function canonicalWallSegment(segment) {
  const ordered = segment.a.x < segment.b.x || (segment.a.x === segment.b.x && segment.a.y <= segment.b.y);
  return ordered ? segment : { a: segment.b, b: segment.a };
}

function wallSegmentKey(segment) {
  return `${segment.a.x},${segment.a.y}:${segment.b.x},${segment.b.y}`;
}

function segmentWithinPolygonClearance(segment, points, clearance) {
  const bounds = polygonBounds(points);
  const segmentLeft = Math.min(segment.a.x, segment.b.x);
  const segmentRight = Math.max(segment.a.x, segment.b.x);
  const segmentTop = Math.min(segment.a.y, segment.b.y);
  const segmentBottom = Math.max(segment.a.y, segment.b.y);
  if (segmentRight < bounds.x - clearance || segmentLeft > bounds.x + bounds.width + clearance
      || segmentBottom < bounds.y - clearance || segmentTop > bounds.y + bounds.height + clearance) return false;
  if (pointInPolygon(segment.a, points) || pointInPolygon(segment.b, points)) return true;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (segmentIntersection(segment.a, segment.b, a, b)
        || pointSegmentDistance(segment.a, a, b) <= clearance
        || pointSegmentDistance(segment.b, a, b) <= clearance
        || pointSegmentDistance(a, segment.a, segment.b) <= clearance
        || pointSegmentDistance(b, segment.a, segment.b) <= clearance) return true;
  }
  return false;
}

function createForestFill(points, forest, seed, nearbyWalls) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  const trees = new PIXI.Container();
  trees.eventMode = "none";
  trees.interactive = false;
  trees.sortableChildren = true;
  container.addChild(trees);

  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const bounds = polygonBounds(points);
  const maxTrees = Math.max(1, Number(forest.maxTrees ?? 8000));
  const placements = [];
  const startCellX = Math.floor(bounds.x / grid);
  const endCellX = Math.ceil((bounds.x + bounds.width) / grid);
  const startCellY = Math.floor(bounds.y / grid);
  const endCellY = Math.ceil((bounds.y + bounds.height) / grid);

  for (let cellY = startCellY; cellY < endCellY && placements.length < maxTrees; cellY += 1) {
    for (let cellX = startCellX; cellX < endCellX && placements.length < maxTrees; cellX += 1) {
      const random = seededRandom(`${seed}:cell:${cellX}:${cellY}`);
      const speciesPatch = stableNoise(`${seed}:species:${Math.floor(cellX / 3)}:${Math.floor(cellY / 3)}`);
      const asset = weightedForestAsset(forest.assets, speciesPatch * 0.72 + random() * 0.28);
      if (!asset) continue;
      const aspect = Math.max(0.1, Number(asset.aspect ?? 1));
      const sizeCells = lerp(Number(asset.minSize ?? 1.2), Number(asset.maxSize ?? 1.5), random());
      const width = grid * sizeCells;
      const height = width / aspect;
      const wallClearance = Math.max(0, Math.max(width, height) * 0.46 - grid * 0.1);
      let point = null;
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const inset = attempt < 18 ? 0.08 : 0;
        const candidate = {
          x: (cellX + inset + random() * (1 - inset * 2)) * grid,
          y: (cellY + inset + random() * (1 - inset * 2)) * grid,
        };
        const clearsWalls = nearbyWalls.every((wall) => pointSegmentDistance(candidate, wall.a, wall.b) >= wallClearance);
        if (pointInPolygon(candidate, points) && clearsWalls) {
          point = candidate;
          break;
        }
      }
      if (!point) continue;

      placements.push({
        ...point,
        asset,
        width,
        height: width / aspect,
        rotation: random() * Math.PI * 2,
      });
    }
  }

  placements.sort((a, b) => a.y - b.y);
  placements.forEach((placement, index) => {
    const texture = PIXI.Texture.from(placement.asset.src);
    let tree;
    try { tree = new PIXI.Sprite({ texture }); }
    catch { tree = new PIXI.Sprite(texture); }
    tree.anchor?.set?.(0.5);
    tree.position.set(placement.x, placement.y);
    tree.width = placement.width;
    tree.height = placement.height;
    tree.rotation = placement.rotation;
    tree.alpha = 1;
    tree.tint = Number(placement.asset.tint ?? forestTint());
    tree.zIndex = index;
    tree.eventMode = "none";
    tree.interactive = false;
    trees.addChild(tree);
  });
  return container;
}

function createGardenFill(points, style, seed) {
  const garden = style.garden;
  if (!garden) return null;
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  const bounds = polygonBounds(points);

  const baseTexture = PIXI.Texture.from(style.src);
  let base;
  try { base = new PIXI.TilingSprite({ texture: baseTexture, width: bounds.width, height: bounds.height }); }
  catch { base = new PIXI.TilingSprite(baseTexture, bounds.width, bounds.height); }
  base.position.set(bounds.x, bounds.y);
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const spacingX = Math.max(0.05, Number(garden.spacingX ?? 0.45)) * grid;
  base.tileScale?.set?.(Number(style.scale ?? 1));
  base.tilePosition?.set?.(-bounds.x / Number(style.scale ?? 1), -bounds.y / Number(style.scale ?? 1));
  base.tint = Number(garden.baseTint ?? 0xffffff);
  const mask = newGraphics();
  drawPolygon(mask, points, 0xffffff);
  base.mask = mask;
  container.addChild(base, mask);

  const cropSize = Math.max(0.08, Number(garden.cropSize ?? 0.2));
  const cropPixels = cropSize * grid;
  const spacingY = Math.max(0.05, Number(garden.spacingY ?? 0.4)) * grid;
  const clearance = cropPixels / 2 + Math.max(2, Number(garden.inset ?? 0.08) * grid);
  const texture = PIXI.Texture.from(garden.cropSrc);
  const crops = new PIXI.Container();
  crops.eventMode = "none";
  crops.interactive = false;
  const ColorMatrixFilter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
  if (ColorMatrixFilter) {
    const cropFilter = new ColorMatrixFilter();
    cropFilter.brightness(Number(garden.cropBrightness ?? 1.35), false);
    cropFilter.saturate(Number(garden.cropSaturation ?? 0.2), true);
    crops.filters = [cropFilter];
  }
  container.addChild(crops);
  const firstX = Math.ceil((bounds.x + clearance) / spacingX) * spacingX;
  const firstY = Math.ceil((bounds.y + clearance) / spacingY) * spacingY;

  for (let y = firstY; y <= bounds.y + bounds.height - clearance; y += spacingY) {
    for (let x = firstX; x <= bounds.x + bounds.width - clearance; x += spacingX) {
      const key = `${seed}:${Math.round(x)}:${Math.round(y)}`;
      if (stableNoise(`${key}:missing`) < Number(garden.missingChance ?? 0.06)) continue;
      const jitter = Number(garden.positionJitter ?? 0.035) * grid;
      const point = {
        x: x + (stableNoise(`${key}:x`) * 2 - 1) * jitter,
        y: y + (stableNoise(`${key}:y`) * 2 - 1) * jitter,
      };
      const sizeScale = 1 + (stableNoise(`${key}:size`) * 2 - 1) * Number(garden.sizeJitter ?? 0.14);
      const renderedSize = cropPixels * sizeScale;
      const renderedClearance = renderedSize / 2 + Math.max(2, Number(garden.inset ?? 0.035) * grid);
      if (!pointInPolygon(point, points) || distanceToPolygon(point, points) < renderedClearance) continue;
      let crop;
      try { crop = new PIXI.Sprite({ texture }); }
      catch { crop = new PIXI.Sprite(texture); }
      crop.anchor?.set?.(0.5);
      crop.position.set(point.x, point.y);
      crop.width = renderedSize;
      crop.height = renderedSize;
      crop.rotation = (stableNoise(`${key}:rotation`) - 0.5) * 0.34;
      crop.eventMode = "none";
      crop.interactive = false;
      crops.addChild(crop);
    }
  }
  return container;
}

function createStretchedOverlayFill(points, overlay) {
  if (!overlay || points.length < 3) return null;
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const frame = orientedPolygonFrame(points);
  const shape = overlay.shape ?? "patch";
  const texture = PIXI.Texture.from(overlay.src);
  let sprite;
  try { sprite = new PIXI.Sprite({ texture }); }
  catch { sprite = new PIXI.Sprite(texture); }
  sprite.anchor?.set?.(0.5);

  if (shape === "corner") {
    const corner = nearestCobwebCorner(points, frame.center, wallSegments(), grid);
    if (corner) {
      const extent = frameExtentAtAngle(points, corner.rotation);
      const offset = rotateVector({ x: extent.width / 2, y: extent.height / 2 }, corner.rotation);
      sprite.position.set(corner.point.x + offset.x, corner.point.y + offset.y);
      sprite.width = extent.width;
      sprite.height = extent.height;
      sprite.rotation = corner.rotation;
    } else {
      sprite.position.set(frame.center.x, frame.center.y);
      sprite.width = frame.width;
      sprite.height = frame.height;
      sprite.rotation = frame.angle;
    }
  } else if (shape === "strip") {
    const wall = nearestWallToPoint(frame.center, wallSegments());
    let rotation = wall?.angle ?? (frame.width >= frame.height ? frame.angle : frame.angle + Math.PI / 2);
    const extent = frameExtentAtAngle(points, rotation);
    const width = Math.max(1, extent.width);
    const height = Math.max(1, extent.height);
    let position = frame.center;
    if (wall && wall.distance <= grid * 0.9) {
      let normal = { x: -Math.sin(rotation), y: Math.cos(rotation) };
      if ((frame.center.x - wall.projected.x) * normal.x + (frame.center.y - wall.projected.y) * normal.y < 0) {
        normal = { x: -normal.x, y: -normal.y };
        rotation += Math.PI;
      }
      position = { x: wall.projected.x + normal.x * height / 2, y: wall.projected.y + normal.y * height / 2 };
    }
    sprite.position.set(position.x, position.y);
    sprite.width = width;
    sprite.height = height;
    sprite.rotation = rotation;
  } else {
    sprite.position.set(frame.center.x, frame.center.y);
    sprite.width = frame.width;
    sprite.height = frame.height;
    sprite.rotation = frame.angle;
  }

  const mask = newGraphics();
  drawPolygon(mask, points, 0xffffff);
  sprite.mask = mask;
  sprite.eventMode = "none";
  sprite.interactive = false;
  mask.eventMode = "none";
  mask.interactive = false;
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.addChild(sprite, mask);
  return container;
}

function nearestCobwebCorner(points, center, walls, grid) {
  const groups = new Map();
  const precision = Math.max(2, grid * 0.04);
  const add = (point, other) => {
    const key = `${Math.round(point.x / precision)},${Math.round(point.y / precision)}`;
    const group = groups.get(key) ?? { point: { ...point }, directions: [] };
    const length = distance(point, other) || 1;
    group.directions.push({ x: (other.x - point.x) / length, y: (other.y - point.y) / length });
    groups.set(key, group);
  };
  for (const wall of walls) {
    add(wall.a, wall.b);
    add(wall.b, wall.a);
  }

  let best = null;
  for (const group of groups.values()) {
    if (group.directions.length < 2) continue;
    if (!pointInPolygon(group.point, points) && distanceToPolygon(group.point, points) > grid * 0.3) continue;
    const centerDistance = distance(group.point, center);
    for (let left = 0; left < group.directions.length; left += 1) {
      for (let right = left + 1; right < group.directions.length; right += 1) {
        const a = group.directions[left];
        const b = group.directions[right];
        const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
        const angle = Math.acos(dot);
        if (angle < Math.PI * 0.28 || angle > Math.PI * 0.72) continue;
        const cross = a.x * b.y - a.y * b.x;
        const xAxis = cross >= 0 ? a : b;
        const score = centerDistance + Math.abs(angle - Math.PI / 2) * grid * 0.2;
        if (!best || score < best.score) {
          best = { point: group.point, rotation: Math.atan2(xAxis.y, xAxis.x), score };
        }
      }
    }
  }
  return best;
}

function nearestWallToPoint(point, walls) {
  let best = null;
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const length2 = dx * dx + dy * dy;
    if (length2 <= EPSILON) continue;
    const ratio = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / length2));
    const projected = { x: wall.a.x + dx * ratio, y: wall.a.y + dy * ratio };
    const candidate = { wall, projected, distance: distance(point, projected), angle: Math.atan2(dy, dx) };
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function frameExtentAtAngle(points, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local = points.map((point) => ({ x: point.x * cos + point.y * sin, y: -point.x * sin + point.y * cos }));
  const xs = local.map((point) => point.x);
  const ys = local.map((point) => point.y);
  return { width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function rotateVector(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

function createNaturalScatter(points, scatter, seed) {
  const assets = Array.isArray(scatter?.assets) ? scatter.assets : [];
  if (!assets.length) return null;
  const bounds = polygonBounds(points);
  if (!bounds.width || !bounds.height) return null;

  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.sortableChildren = true;
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const spacing = grid * Math.max(0.5, Number(scatter.spacingCells ?? 2.5));
  const chance = Math.max(0, Math.min(1, Number(scatter.chance ?? 0.4)));
  const maxPieces = Math.max(1, Number(scatter.maxPieces ?? 240));
  const aspectJitter = Math.max(0, Math.min(0.45, Number(scatter.aspectJitter ?? 0)));
  const startX = Math.floor(bounds.x / spacing) - 1;
  const endX = Math.ceil((bounds.x + bounds.width) / spacing) + 1;
  const startY = Math.floor(bounds.y / spacing) - 1;
  const endY = Math.ceil((bounds.y + bounds.height) / spacing) + 1;
  const placements = [];
  const placementCounts = new Map();

  const candidateCells = [];
  for (let gy = startY; gy <= endY; gy += 1) {
    for (let gx = startX; gx <= endX; gx += 1) candidateCells.push({ gx, gy });
  }
  const orderRandom = seededRandom(`${seed}:nature-order`);
  for (let index = candidateCells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(orderRandom() * (index + 1));
    [candidateCells[index], candidateCells[swapIndex]] = [candidateCells[swapIndex], candidateCells[index]];
  }

  for (const { gx, gy } of candidateCells) {
      if (placements.length >= maxPieces) break;
      const random = seededRandom(`${seed}:nature:${gx}:${gy}`);
      if (random() > chance) continue;
      const eligibleAssets = assets.filter((candidate) => {
        const limit = Number(candidate.maxPerFill);
        if (!Number.isFinite(limit) || limit <= 0) return true;
        const key = candidate.limitKey || candidate.src;
        return (placementCounts.get(key) ?? 0) < limit;
      });
      const asset = weightedRubbleAsset(eligibleAssets, random());
      if (!asset) continue;
      const size = grid * lerp(Number(asset.minSize ?? 1), Number(asset.maxSize ?? 1.4), random());
      const aspect = 1 + (random() * 2 - 1) * aspectJitter;
      const width = size * Math.sqrt(aspect);
      const height = size / Math.sqrt(aspect);
      const rotation = random() * Math.PI * 2;
      let point = null;
      for (let attempt = 0; attempt < 18; attempt += 1) {
        const candidate = {
          x: (gx + 0.08 + random() * 0.84) * spacing,
          y: (gy + 0.08 + random() * 0.84) * spacing,
        };
        if (!rotatedRectInsidePolygon(candidate, width, height, rotation, points)) continue;
        const clearsOtherPatches = placements.every((placed) => (
          distance(candidate, placed) >= (Math.max(width, height) + placed.radius * 2) * 0.43
        ));
        if (!clearsOtherPatches) continue;
        point = candidate;
        break;
      }
      if (point) {
        placements.push({ ...point, asset, width, height, radius: Math.max(width, height) / 2, rotation });
        const key = asset.limitKey || asset.src;
        placementCounts.set(key, (placementCounts.get(key) ?? 0) + 1);
      }
  }

  placements.sort((left, right) => left.y - right.y);
  placements.forEach((placement, index) => {
    const texture = PIXI.Texture.from(placement.asset.src);
    let sprite;
    try { sprite = new PIXI.Sprite({ texture }); }
    catch { sprite = new PIXI.Sprite(texture); }
    sprite.anchor?.set?.(0.5);
    sprite.position.set(placement.x, placement.y);
    sprite.width = placement.width;
    sprite.height = placement.height;
    sprite.rotation = placement.rotation;
    sprite.alpha = Math.max(0, Math.min(1, Number(placement.asset.alpha ?? 1)));
    sprite.zIndex = index;
    sprite.eventMode = "none";
    sprite.interactive = false;
    container.addChild(sprite);
  });
  return container;
}

function createCrowdFill(points, assets, seed) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  if (!assets.length) return container;
  const bounds = polygonBounds(points);
  const size = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const grid = canvas?.grid;
  const offset = (x, y) => grid?.getOffset?.({ x, y }) ?? { i: Math.floor(y / size), j: Math.floor(x / size) };
  const first = offset(bounds.x, bounds.y);
  const last = offset(bounds.x + bounds.width, bounds.y + bounds.height);
  const counts = new Map(assets.map(asset => [asset.key, 0]));
  for (let i = first.i - 1; i <= last.i + 1; i++) {
    for (let j = first.j - 1; j <= last.j + 1; j++) {
      const center = grid?.getCenterPoint?.({ i, j }) ?? { x: (j + 0.5) * size, y: (i + 0.5) * size };
      if (!pointInPolygon(center, points)) continue;
      const random = seededRandom(`${seed}:crowd:${i}:${j}`);
      const start = Math.floor(random() * assets.length);
      const ordered = [...assets.slice(start), ...assets.slice(0, start)];
      ordered.sort((a, b) => counts.get(a.key) - counts.get(b.key));
      const asset = ordered[0];
      counts.set(asset.key, counts.get(asset.key) + 1);
      const texture = PIXI.Texture.from(asset.src);
      let sprite;
      try { sprite = new PIXI.Sprite({ texture }); }
      catch { sprite = new PIXI.Sprite(texture); }
      sprite.anchor?.set?.(0.5);
      sprite.position.set(center.x, center.y);
      // Square one-cell images use an inscribed silhouette, so arbitrary facing stays in-cell.
      sprite.width = size;
      sprite.height = size;
      sprite.rotation = random() * Math.PI * 2;
      sprite.eventMode = "none";
      sprite.interactive = false;
      container.addChild(sprite);
    }
  }
  return container;
}

function createRubbleFill(points, rubble, seed) {
  if (rubble?.crowd) return createCrowdFill(points, rubble.assets ?? [], seed);
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;

  const assets = Array.isArray(rubble?.assets) ? rubble.assets : [];
  if (!assets.length) return container;
  const bounds = polygonBounds(points);
  if (!bounds.width || !bounds.height) return container;

  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const spacing = grid * Math.max(0.18, Number(rubble.spacingCells ?? 0.34));
  const chance = Math.max(0, Math.min(1, Number(rubble.chance ?? 0.52)));
  const scaleMin = Math.max(0.1, Number(rubble.scaleMin ?? 0.82));
  const scaleMax = Math.max(scaleMin, Number(rubble.scaleMax ?? 1.08));
  const minimumGap = grid * Math.max(0, Number(rubble.minimumGapCells ?? 0));
  const groupOrder = Array.isArray(rubble.groupOrder) ? rubble.groupOrder.map(String).filter(Boolean) : [];
  const pilePacking = Boolean(rubble.pilePacking);
  const orderedPacking = Boolean(rubble.orderedPacking);
  const positionJitter = Math.max(0, Math.min(0.75, Number(rubble.positionJitter ?? 0.1)));
  const rotationSteps = Math.max(0, Math.floor(Number(rubble.rotationSteps ?? 0)));
  const maxPieces = Math.max(1, Number(rubble.maxPieces ?? 12000));
  const startX = Math.floor(bounds.x / spacing) - 1;
  const endX = Math.ceil((bounds.x + bounds.width) / spacing) + 1;
  const startY = Math.floor(bounds.y / spacing) - 1;
  const endY = Math.ceil((bounds.y + bounds.height) / spacing) + 1;

  const placements = [];
  const groupCounts = new Map(groupOrder.map((group) => [group, 0]));
  const assetCounts = new Map();
  for (let gy = startY; gy <= endY && placements.length < maxPieces; gy += 1) {
    for (let gx = startX; gx <= endX && placements.length < maxPieces; gx += 1) {
      const random = seededRandom(`${seed}:rubble:${gx}:${gy}`);
      if (random() > chance) continue;
      const groupOffset = groupOrder.length ? Math.floor(random() * groupOrder.length) : 0;
      const assetCandidates = groupOrder.length
        ? balancedRubbleAssets(assets, groupOrder, groupCounts, assetCounts, groupOffset)
        : [weightedRubbleAsset(assets, random())].filter(Boolean);
      for (let assetIndex = 0; assetIndex < assetCandidates.length; assetIndex += 1) {
        const asset = assetCandidates[assetIndex];
        const assetRandom = seededRandom(`${seed}:rubble:${gx}:${gy}:asset:${asset.key ?? assetIndex}`);
        const scale = lerp(scaleMin, scaleMax, assetRandom());
        const width = grid * Math.max(0.02, Number(asset.widthCells ?? 0.3)) * scale;
        const height = grid * Math.max(0.02, Number(asset.heightCells ?? 0.3)) * scale;
        const rotation = rotationSteps > 0
          ? Math.floor(assetRandom() * rotationSteps) * Math.PI * 2 / rotationSteps
          : assetRandom() * Math.PI * 2;

        // Try several deterministic positions inside this lattice cell. Pile props may overlap,
        // but every rotated footprint must remain entirely inside the selected floor polygon.
        let point = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          let candidate;
          if (pilePacking) {
            candidate = {
              x: (gx + 0.5) * spacing + (assetRandom() - 0.5) * spacing * positionJitter * 2,
              y: (gy + 0.5) * spacing + (assetRandom() - 0.5) * spacing * positionJitter * 2,
            };
          } else if (orderedPacking) {
            const radius = attempt === 0 ? 0 : spacing * Math.min(0.45, positionJitter + attempt * 0.018);
            const angle = assetRandom() * Math.PI * 2;
            candidate = {
              x: (gx + 0.5) * spacing + Math.cos(angle) * radius,
              y: (gy + 0.5) * spacing + Math.sin(angle) * radius,
            };
          } else {
            candidate = {
              x: (gx + 0.06 + assetRandom() * 0.88) * spacing,
              y: (gy + 0.06 + assetRandom() * 0.88) * spacing,
            };
          }
          const overlaps = minimumGap > 0 && placements.some((existing) => {
            const required = (Math.max(width, height) + Math.max(existing.width, existing.height)) * 0.42 + minimumGap;
            return distance(candidate, existing) < required;
          });
          if (overlaps) continue;
          if (rotatedRectInsidePolygon(candidate, width, height, rotation, points)) {
            point = candidate;
            break;
          }
        }
        if (!point) continue;
        placements.push({ ...point, asset, width, height, rotation, stackOrder: assetRandom() });
        if (asset.groupKey) groupCounts.set(asset.groupKey, (groupCounts.get(asset.groupKey) ?? 0) + 1);
        const assetKey = asset.key ?? asset.src;
        assetCounts.set(assetKey, (assetCounts.get(assetKey) ?? 0) + 1);
        break;
      }
    }
  }

  // Pile layers are deliberately shuffled so neighbouring props visibly stack over one another.
  placements.sort((a, b) => pilePacking ? a.stackOrder - b.stackOrder : a.y - b.y);
  placements.forEach((placement, index) => {
    const texture = PIXI.Texture.from(placement.asset.src);
    let sprite;
    try { sprite = new PIXI.Sprite({ texture }); }
    catch { sprite = new PIXI.Sprite(texture); }
    sprite.anchor?.set?.(0.5);
    sprite.position.set(placement.x, placement.y);
    sprite.width = placement.width;
    sprite.height = placement.height;
    sprite.rotation = placement.rotation;
    sprite.zIndex = index;
    sprite.eventMode = "none";
    sprite.interactive = false;
    container.addChild(sprite);
  });
  return container;
}

function weightedRubbleAsset(assets, roll) {
  const total = assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.weight ?? 1)), 0);
  if (total <= 0) return assets[0] ?? null;
  let cursor = roll * total;
  for (const asset of assets) {
    cursor -= Math.max(0, Number(asset.weight ?? 1));
    if (cursor <= 0) return asset;
  }
  return assets.at(-1) ?? null;
}

function balancedRubbleAssets(assets, groupOrder, groupCounts, assetCounts, groupOffset = 0) {
  const groupRank = new Map(groupOrder.map((group, index) => [
    group,
    (index - groupOffset + groupOrder.length) % groupOrder.length,
  ]));
  return [...assets].sort((left, right) => {
    const groupDifference = (groupCounts.get(left.groupKey) ?? 0) - (groupCounts.get(right.groupKey) ?? 0);
    if (groupDifference) return groupDifference;
    const assetDifference = (assetCounts.get(left.key) ?? 0) - (assetCounts.get(right.key) ?? 0);
    if (left.groupKey === right.groupKey && assetDifference) return assetDifference;
    const rankDifference = (groupRank.get(left.groupKey) ?? groupOrder.length) - (groupRank.get(right.groupKey) ?? groupOrder.length);
    if (rankDifference) return rankDifference;
    if (assetDifference) return assetDifference;
    return String(left.key ?? "").localeCompare(String(right.key ?? ""));
  });
}

function rotatedRectInsidePolygon(center, width, height, rotation, polygon) {
  if (!pointInPolygon(center, polygon)) return false;
  const halfW = width / 2;
  const halfH = height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const local = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];
  const corners = local.map((point) => ({
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos,
  }));
  if (corners.some((corner) => !pointInPolygon(corner, polygon))) return false;

  // Corner tests alone are insufficient for concave polygons: a rectangle edge can cross
  // a notch while all corners are technically inside. Reject every polygon-edge crossing.
  for (let r = 0; r < corners.length; r += 1) {
    const from = corners[r];
    const to = corners[(r + 1) % corners.length];
    for (let p = 0; p < polygon.length; p += 1) {
      const edgeFrom = polygon[p];
      const edgeTo = polygon[(p + 1) % polygon.length];
      if (segmentIntersection(from, to, edgeFrom, edgeTo)) return false;
    }
  }
  return true;
}

function weightedForestAsset(assets, roll) {
  const choices = Array.isArray(assets) ? assets : [];
  const total = choices.reduce((sum, asset) => sum + Math.max(0, Number(asset.weight ?? 1)), 0);
  if (!choices.length || total <= 0) return null;
  let cursor = roll * total;
  for (const asset of choices) {
    cursor -= Math.max(0, Number(asset.weight ?? 1));
    if (cursor <= 0) return asset;
  }
  return choices.at(-1);
}

function seededRandom(seed) {
  let state = Math.floor(stableNoise(seed) * 4294967295) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function lerp(from, to, ratio) { return from + (to - from) * ratio; }

function forestTint() {
  return 0xc6d0b8;
}

function createFeatheredFloorMask(points, bounds, edge) {
  const feather = Math.max(1, Number(edge.feather ?? 5));
  const padding = feather * 2.5;
  const fullWidth = Math.max(1, bounds.width + padding * 2);
  const fullHeight = Math.max(1, bounds.height + padding * 2);
  const resolution = Math.max(0.125, Math.min(0.5, 4096 / Math.max(fullWidth, fullHeight)));
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.ceil(fullWidth * resolution));
  element.height = Math.max(1, Math.ceil(fullHeight * resolution));
  const context = element.getContext("2d");
  if (!context) {
    const fallback = newGraphics();
    drawPolygon(fallback, points, 0xffffff);
    return fallback;
  }
  context.filter = `blur(${Math.max(0.75, feather * resolution)}px)`;
  context.fillStyle = "#ffffff";
  context.beginPath();
  points.forEach((point, index) => {
    const x = (point.x - bounds.x + padding) * resolution;
    const y = (point.y - bounds.y + padding) * resolution;
    if (!index) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  context.filter = "none";

  const texture = PIXI.Texture.from(element);
  const mask = new PIXI.Sprite(texture);
  mask.position.set(bounds.x - padding, bounds.y - padding);
  mask.scale.set(1 / resolution);
  mask.eventMode = "none";
  mask.interactive = false;
  mask._tsuOwnedTexture = texture;
  return mask;
}

function stableNoise(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash += hash << 13; hash ^= hash >>> 7; hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
  return (hash >>> 0) / 4294967295;
}

function createNaturalBoundary(points, seed, edge) {
  if (!(Number(edge.jitter) > 0)) return points;
  const result = [];
  const spacing = edge.kind === "dirt" ? 11 : edge.kind === "rubble" ? 9 : 13;
  points.forEach((from, edgeIndex) => {
    const to = points[(edgeIndex + 1) % points.length];
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    const divisions = Math.max(1, Math.ceil(length / spacing));
    const forward = from.x < to.x || (Math.abs(from.x - to.x) < EPSILON && from.y <= to.y);
    const canonicalFrom = forward ? from : to;
    const canonicalTo = forward ? to : from;
    const canonicalDx = canonicalTo.x - canonicalFrom.x;
    const canonicalDy = canonicalTo.y - canonicalFrom.y;
    const normal = { x: -canonicalDy / length, y: canonicalDx / length };
    const segmentKey = `${Math.round(canonicalFrom.x * 10)}:${Math.round(canonicalFrom.y * 10)}:${Math.round(canonicalTo.x * 10)}:${Math.round(canonicalTo.y * 10)}`;
    for (let step = 0; step < divisions; step += 1) {
      const ratio = step / divisions;
      const canonicalRatio = forward ? ratio : 1 - ratio;
      const taper = Math.sin(Math.PI * canonicalRatio);
      const sample = Math.round(canonicalRatio * divisions);
      const jitter = (stableNoise(`${seed}:${segmentKey}:${sample}`) * 2 - 1) * Number(edge.jitter ?? 0) * taper;
      result.push({ x: from.x + dx * ratio + normal.x * jitter, y: from.y + dy * ratio + normal.y * jitter });
    }
  });
  return result;
}

function createFloorEdge(points, edge, seed) {
  if (edge.kind === "carpet" && edge.texture) return createTexturedFloorEdge(points, edge);
  if (edge.kind === "cut") return null;
  if (isNaturalPathEdge(edge)) return null;
  if (edge.texture) return createTexturedFloorEdge(points, edge);
  if (edge.kind === "cave") return createCaveFloorEdge(points, edge, seed);
  const graphics = newGraphics();
  if (edge.kind === "garden") {
    // The Bastion water/soil treatment already supplies its own dark edge.
    // Drawing the generic garden stroke on top reads as a rectangular UI-like
    // selection outline, particularly on narrow beds.
    if (currentTexturePreset() === BASTION_TEXTURE_PRESET) return null;
    const width = Number(edge.width ?? 0);
    if (width <= 0) return null;
    drawClosedStroke(graphics, points, Number(edge.color ?? 0x766047), width, Number(edge.alpha ?? 0.82));
    graphics.eventMode = "none";
    graphics.interactive = false;
    return graphics;
  }
  if (edge.kind === "roof") {
    return drawRoofEdge(graphics, points, edge, seed);
  }
  if (edge.kind === "shrub") {
    drawClosedStroke(
      graphics,
      points,
      Number(edge.shadow ?? 0x07160b),
      Number(edge.width ?? 8),
      Number(edge.shadowAlpha ?? 0.28),
    );
    graphics.eventMode = "none";
    graphics.interactive = false;
    return graphics;
  }
  const alpha = edge.kind === "garden" ? 0.6 : 0.72;
  const edgeWidth = Number(edge.width ?? FLOOR_EDGE_WIDTH);
  points.forEach((point, index) => drawLine(graphics, point, points[(index + 1) % points.length], edge.color, edgeWidth, alpha));
  if (edge.kind === "carpet") {
    points.forEach((point, index) => {
      if (index % 2) return;
      const next = points[(index + 1) % points.length];
      const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy) || 1;
      const side = stableNoise(`${seed}:fiber:${index}`) > 0.5 ? 1 : -1;
      const fiber = 1.5 + stableNoise(`${seed}:fiber-length:${index}`) * 2;
      drawLine(graphics, point, { x: point.x - dy / length * fiber * side, y: point.y + dx / length * fiber * side }, edge.color, 1, 0.5);
    });
  }
  graphics.eventMode = "none";
  graphics.interactive = false;
  return graphics;
}

function pointInsideRotatedRect(point, center, width, height, rotation) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return Math.abs(localX) <= width / 2 + EPSILON && Math.abs(localY) <= height / 2 + EPSILON;
}

function rotatedRectCorners(center, width, height, rotation) {
  const halfW = width / 2;
  const halfH = height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map((point) => ({
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos,
  }));
}

function caveRockCrossesWalls(origin, center, width, height, rotation, walls) {
  const corners = rotatedRectCorners(center, width, height, rotation);
  return walls.some((wall) => {
    const travelHit = segmentIntersection(origin, center, wall.a, wall.b);
    if (travelHit) return true;
    if (pointInsideRotatedRect(wall.a, center, width, height, rotation)
        || pointInsideRotatedRect(wall.b, center, width, height, rotation)) return true;
    return corners.some((corner, index) => (
      Boolean(segmentIntersection(corner, corners[(index + 1) % corners.length], wall.a, wall.b))
    ));
  });
}

function createCaveFloorEdge(points, edge, seed) {
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.sortableChildren = true;

  const graphics = newGraphics();
  const width = Math.max(2, Number(edge.width ?? 10));
  drawClosedStroke(graphics, points, Number(edge.shadow ?? 0x29251f), width, 0.72);
  drawClosedStroke(graphics, points, Number(edge.highlight ?? 0x948875), Math.max(1, width * 0.22), 0.52);
  graphics.eventMode = "none";
  graphics.interactive = false;
  graphics.zIndex = 0;
  container.addChild(graphics);

  const assets = Array.isArray(edge.rockAssets) ? edge.rockAssets : [];
  if (!assets.length) return container;
  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const spacing = grid * Math.max(0.12, Number(edge.rockSpacingCells ?? 0.24));
  const chance = Math.max(0, Math.min(1, Number(edge.rockChance ?? 0.66)));
  const spread = grid * Math.max(0, Number(edge.rockSpreadCells ?? 0.30));
  const maxRocks = Math.max(1, Number(edge.maxRocks ?? 900));
  // Decorative and non-movement walls still separate the visible rock spill.
  const walls = wallSegments();
  let rockCount = 0;

  for (let edgeIndex = 0; edgeIndex < points.length && rockCount < maxRocks; edgeIndex += 1) {
    const from = points[edgeIndex];
    const to = points[(edgeIndex + 1) % points.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    const tangent = { x: dx / length, y: dy / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const normalTest = grid * 0.12;
    const positiveIsInside = pointInPolygon({ x: midpoint.x + normal.x * normalTest, y: midpoint.y + normal.y * normalTest }, points);
    const outward = positiveIsInside ? { x: -normal.x, y: -normal.y } : normal;
    const divisions = Math.max(1, Math.ceil(length / spacing));

    for (let step = 0; step < divisions && rockCount < maxRocks; step += 1) {
      const random = seededRandom(`${seed}:cave-rock:${edgeIndex}:${step}`);
      if (random() > chance) continue;
      const asset = weightedRubbleAsset(assets, random());
      if (!asset) continue;
      let placement = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const ratio = (step + 0.18 + random() * 0.64) / divisions;
        const along = (random() * 2 - 1) * spacing * 0.28;
        const away = spread * (-0.08 + Math.pow(random(), 1.35) * 1.08);
        const size = grid * lerp(Number(asset.minSize ?? 0.10), Number(asset.maxSize ?? 0.23), random());
        const width = size * lerp(0.82, 1.18, random());
        const height = size * lerp(0.76, 1.08, random());
        const rotation = random() * Math.PI * 2;
        const origin = {
          x: from.x + dx * ratio + tangent.x * along,
          y: from.y + dy * ratio + tangent.y * along,
        };
        const position = {
          x: origin.x + outward.x * away,
          y: origin.y + outward.y * away,
        };
        // Start within the rock mass: the jittered lip may sit on or just beyond
        // a wall, so starting at the lip would miss that wall entirely.
        const inset = Math.max(grid * 0.15, Number(edge.jitter ?? 0) + 1);
        const source = {
          x: origin.x - outward.x * inset,
          y: origin.y - outward.y * inset,
        };
        if (caveRockCrossesWalls(source, position, width, height, rotation, walls)) continue;
        placement = { position, width, height, rotation };
        break;
      }
      if (!placement) continue;
      const texture = PIXI.Texture.from(asset.src);
      let sprite;
      try { sprite = new PIXI.Sprite({ texture }); }
      catch { sprite = new PIXI.Sprite(texture); }
      sprite.anchor?.set?.(0.5);
      sprite.position.set(placement.position.x, placement.position.y);
      sprite.width = placement.width;
      sprite.height = placement.height;
      sprite.rotation = placement.rotation;
      sprite.alpha = Math.max(0, Math.min(1, Number(asset.alpha ?? 1)));
      sprite.tint = Number(edge.rockTint ?? 0xffffff);
      sprite.zIndex = 1 + rockCount;
      sprite.eventMode = "none";
      sprite.interactive = false;
      container.addChild(sprite);
      rockCount += 1;
    }
  }
  return container;
}

function drawRoofEdge(graphics, points, edge, seed) {
  const shadow = Number(edge.shadow ?? 0x17120f);
  const frame = orientedPolygonFrame(points);
  const left = frame.minX;
  const right = frame.maxX;
  const top = frame.minY;
  const bottom = frame.maxY;
  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const horizontal = frame.width >= frame.height;
  const shortSide = horizontal ? frame.height : frame.width;
  const hipDepth = Math.min(shortSide * 0.46, (horizontal ? frame.width : frame.height) * 0.34);
  const world = (point) => frame.toWorld(point);
  const corners = {
    topLeft: world({ x: left, y: top }),
    topRight: world({ x: right, y: top }),
    bottomRight: world({ x: right, y: bottom }),
    bottomLeft: world({ x: left, y: bottom }),
  };
  const ridgeStart = horizontal
    ? world({ x: left + hipDepth, y: center.y })
    : world({ x: center.x, y: top + hipDepth });
  const ridgeEnd = horizontal
    ? world({ x: right - hipDepth, y: center.y })
    : world({ x: center.x, y: bottom - hipDepth });

  if (horizontal) {
    drawPolygon(graphics, [corners.topLeft, corners.topRight, ridgeEnd, ridgeStart], 0xffffff, 0.035);
    drawPolygon(graphics, [corners.bottomLeft, ridgeStart, ridgeEnd, corners.bottomRight], shadow, 0.12);
    drawPolygon(graphics, [corners.topLeft, ridgeStart, corners.bottomLeft], shadow, 0.055);
    drawPolygon(graphics, [corners.topRight, corners.bottomRight, ridgeEnd], shadow, 0.08);
  } else {
    drawPolygon(graphics, [corners.topLeft, ridgeStart, ridgeEnd, corners.bottomLeft], 0xffffff, 0.035);
    drawPolygon(graphics, [corners.topRight, corners.bottomRight, ridgeEnd, ridgeStart], shadow, 0.12);
    drawPolygon(graphics, [corners.topLeft, corners.topRight, ridgeStart], shadow, 0.055);
    drawPolygon(graphics, [corners.bottomLeft, ridgeEnd, corners.bottomRight], shadow, 0.08);
  }

  const hipLines = horizontal
    ? [[corners.topLeft, ridgeStart], [corners.bottomLeft, ridgeStart], [corners.topRight, ridgeEnd], [corners.bottomRight, ridgeEnd]]
    : [[corners.topLeft, ridgeStart], [corners.topRight, ridgeStart], [corners.bottomLeft, ridgeEnd], [corners.bottomRight, ridgeEnd]];
  drawLine(graphics, ridgeStart, ridgeEnd, shadow, 3, 0.55);
  const ridgeHighlightOffset = frame.vectorToWorld(horizontal ? { x: 0, y: -1 } : { x: -1, y: 0 });
  drawLine(graphics,
    { x: ridgeStart.x + ridgeHighlightOffset.x, y: ridgeStart.y + ridgeHighlightOffset.y },
    { x: ridgeEnd.x + ridgeHighlightOffset.x, y: ridgeEnd.y + ridgeHighlightOffset.y },
    0xffffff, 1, 0.27);
  hipLines.forEach(([from, to]) => drawLine(graphics, from, to, shadow, 2, 0.38));

  const grid = Math.max(1, Number(canvas?.dimensions?.size ?? 100));
  const bevel = Math.max(10, Math.min(grid * 0.18, frame.width * 0.16, frame.height * 0.22));
  const inner = {
    topLeft: world({ x: left + bevel, y: top + bevel }),
    topRight: world({ x: right - bevel, y: top + bevel }),
    bottomRight: world({ x: right - bevel, y: bottom - bevel }),
    bottomLeft: world({ x: left + bevel, y: bottom - bevel }),
  };
  // Four explicit trapezoids form a straight architectural bevel. Their
  // different values make the roof edge readable on both light and dark tiles.
  drawPolygon(graphics, [corners.topLeft, corners.topRight, inner.topRight, inner.topLeft], shadow, 0.24);
  drawPolygon(graphics, [corners.bottomLeft, inner.bottomLeft, inner.bottomRight, corners.bottomRight], shadow, 0.48);
  drawPolygon(graphics, [corners.topLeft, inner.topLeft, inner.bottomLeft, corners.bottomLeft], shadow, 0.34);
  drawPolygon(graphics, [corners.topRight, corners.bottomRight, inner.bottomRight, inner.topRight], shadow, 0.4);
  drawClosedStroke(graphics, [inner.topLeft, inner.topRight, inner.bottomRight, inner.bottomLeft], shadow, 3, 0.72);
  drawLine(graphics, inner.topLeft, inner.topRight, 0xffffff, 1.5, 0.22);
  drawLine(graphics, inner.topLeft, inner.bottomLeft, 0xffffff, 1, 0.12);
  drawClosedStroke(graphics, points, shadow, 2.5, 0.72);

  const mask = newGraphics();
  drawPolygon(mask, points, 0xffffff);
  graphics.mask = mask;
  graphics.eventMode = "none";
  graphics.interactive = false;
  mask.eventMode = "none";
  mask.interactive = false;
  const container = new PIXI.Container();
  container.eventMode = "none";
  container.interactive = false;
  container.addChild(graphics, mask);
  return container;
}

function createTexturedFloorEdge(points, edge) {
  const container = new PIXI.Container();
  const texture = PIXI.Texture.from(edge.texture);
  const edgeWidth = Number(edge.width ?? FLOOR_EDGE_WIDTH);
  const halfWidth = edgeWidth / 2;
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const inwardNormal = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    let x = -dy / length, y = dx / length;
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if ((center.x - midpoint.x) * x + (center.y - midpoint.y) * y < 0) { x = -x; y = -y; }
    return { x, y };
  };
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy);
    const visibleLength = length - halfWidth * 2;
    if (visibleLength <= 0) return;
    const ux = dx / length, uy = dy / length;
    const inward = inwardNormal(point, next);
    let strip;
    try { strip = new PIXI.TilingSprite({ texture, width: visibleLength, height: edgeWidth }); }
    catch { strip = new PIXI.TilingSprite(texture, visibleLength, edgeWidth); }
    strip.position.set(point.x + ux * halfWidth + inward.x * halfWidth, point.y + uy * halfWidth + inward.y * halfWidth);
    strip.pivot.set(0, edgeWidth / 2);
    strip.rotation = Math.atan2(dy, dx);
    strip.tileScale?.set?.(0.2, edgeWidth / Number(edge.sourceHeight ?? 16));
    container.addChild(strip);
  });
  if (edge.corner) {
    const cornerTexture = PIXI.Texture.from(edge.corner);
    points.forEach((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const incoming = inwardNormal(previous, point);
      const outgoing = inwardNormal(point, next);
      const corner = new PIXI.Sprite(cornerTexture);
      corner.anchor.set(0.5);
      corner.position.set(
        point.x + (incoming.x + outgoing.x) * halfWidth,
        point.y + (incoming.y + outgoing.y) * halfWidth,
      );
      corner.width = edgeWidth;
      corner.height = edgeWidth;
      container.addChild(corner);
    });
  }
  container.eventMode = "none";
  container.interactive = false;
  return container;
}

function redrawEditor(cursor = null) {
  drawEditorData(getSceneData(), cursor);
}

function drawEditorData(data, cursor = null) {
  const container = getEditorContainer();
  if (!container) return;
  clearContainer(container);
  container._previewData = data;
  if (!activeTool || currentControlName() !== CONTROL_NAME) return;
  const graphics = newGraphics();
  for (const floor of data.floors) {
    if (Number(floor.level ?? 0) !== currentLevel) continue;
    if (floor.source !== "manual") continue;
    floor.points.forEach((point, index) => {
      const next = floor.points[(index + 1) % floor.points.length];
      const chosen = selectedEdge?.floorId === floor.id && selectedEdge.edgeIndex === index;
      drawLine(graphics, point, next, chosen ? 0xffaa00 : 0x35c9ff, chosen ? 5 : 3, 0.95);
    });
  }
  draftPoints.forEach((point, index) => {
    if (index) drawLine(graphics, draftPoints[index - 1], point, 0x35c9ff, 3, 0.95);
  });
  if (draftPoints.length && cursor) drawLine(graphics, draftPoints.at(-1), snapPoint(cursor), 0xffffff, 2, 0.7);
  container.addChild(graphics);
}

function scheduleRedraw({ forestOnly = false, forestFloorIds = [] } = {}) {
  if (!forestOnly) redrawNeedsFullPass = true;
  else for (const floorId of forestFloorIds) pendingForestFloorIds.add(floorId);
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(async () => {
    redrawTimer = null;
    const fullPass = redrawNeedsFullPass;
    const targetedForestIds = [...pendingForestFloorIds];
    redrawNeedsFullPass = false;
    pendingForestFloorIds.clear();
    if (fullPass) await ensureGardenAssets();
    redrawFloors({ forestOnly: !fullPass, forestFloorIds: targetedForestIds });
    if (fullPass) redrawEditor();
  }, 100);
}

function snapshotWallState(wall) {
  const coords = Array.isArray(wall?.c) ? wall.c.slice(0, 4).map(Number) : [];
  return { id: wall?.id ?? null, c: coords, move: Number(wall?.move ?? 0) };
}

function wallBelongsToCanvasScene(wall) {
  return Boolean(wall?.parent && canvas?.scene
    && (wall.parent === canvas.scene || wall.parent.id === canvas.scene.id));
}

function blockingSegmentFromWallState(state) {
  const noRestriction = globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0;
  if (!state || Number(state.move ?? noRestriction) === noRestriction || state.c.length < 4) return null;
  const segment = { a: { x: state.c[0], y: state.c[1] }, b: { x: state.c[2], y: state.c[3] } };
  return distance(segment.a, segment.b) > EPSILON ? segment : null;
}

function affectedVisibleForestIds(states) {
  const affected = new Set();
  if (!canvas?.ready) return affected;
  const segments = states.map(blockingSegmentFromWallState).filter(Boolean);
  if (!segments.length) return affected;
  for (const floor of getSceneData().floors) {
    if (Number(floor.level ?? 0) > currentLevel) continue;
    const forest = FLOOR_STYLES[floor.style]?.forest;
    if (!forest) continue;
    const points = normalizePolygon(floor.points);
    if (points.length < 3) continue;
    const clearance = forestMaxWallClearance(forest);
    if (segments.some((segment) => segmentWithinPolygonClearance(segment, points, clearance))) affected.add(floor.id);
  }
  return affected;
}

function trackSceneWallStates() {
  trackedWallStates.clear();
  for (const wall of canvas?.scene?.walls ?? []) trackedWallStates.set(wall.id, snapshotWallState(wall));
}

function visibleFloorTextureSources(scene, floorNumber) {
  const sources = new Set();
  const add = (src) => { if (typeof src === "string" && src) sources.add(src); };
  const addAssets = (assets) => { for (const asset of assets ?? []) add(asset.src); };
  for (const floor of getSceneDataForScene(scene).floors) {
    const level = Number(floor.level ?? 0);
    if (level > floorNumber || normalizePolygon(floor.points).length < 3) continue;
    const style = FLOOR_STYLES[floor.style] ?? FLOOR_STYLES[DEFAULT_STYLE];
    if (style.weather && level !== floorNumber) continue;
    if (style.forest) {
      addAssets(style.forest.assets);
      continue;
    }
    const overlay = style.stretchedOverlay ?? style.cobweb;
    if (overlay) {
      add(overlay.src);
      continue;
    }
    if (style.rubble) {
      addAssets(style.rubble.assets);
      continue;
    }
    add(style.src);
    add(style.garden?.cropSrc);
    add(style.edge?.texture);
    add(style.edge?.corner);
    addAssets(style.edge?.rockAssets);
    if (!style.garden) addAssets(style.scatter?.assets);
  }
  return [...sources];
}

Hooks.on("canvasInit", (board) => {
  // Foundry awaits these sources while the new scene/level is still hidden.
  // Only inspect placed, visible styles: their getters resolve the active preset.
  const floorNumber = board.level ? getFloorNumberForNativeLevel(board.level) : 0;
  board.loadTexturesOptions.additionalSources.push(...visibleFloorTextureSources(board.scene, floorNumber));
});

Hooks.on("canvasReady", () => {
  if (canvas?.scene) floorDataSnapshots.set(regionSyncKey(canvas.scene), getSceneDataForScene(canvas.scene));
  currentLevel = canvas?.level ? getFloorNumberForNativeLevel(canvas.level) : 0;
  selectedLevel = currentLevel;
  trackSceneWallStates();
  bindStageEvents();
  // canvasReady hooks are synchronous and run before Foundry reveals the level.
  // A debounced redraw here exposes lower-floor assets for at least one frame.
  clearTimeout(redrawTimer);
  redrawTimer = null;
  redrawNeedsFullPass = false;
  pendingForestFloorIds.clear();
  redrawFloors();
  redrawEditor();
  refreshFogConcealment();
  if (canManageFloorSurfaces()) {
    void (async () => {
      const scene = canvas?.scene;
      if (!scene) return;
      const floorNumbers = [...new Set(getSceneDataForScene(scene).floors
        .map((floor) => Number(floor.level ?? 0)))].sort((a, b) => a - b);
      for (const floorNumber of floorNumbers) await ensureNativeLevel(floorNumber, scene);
      await queueFloorSurfaceSync(scene);
    })();
  }
});
Hooks.on("canvasTearDown", () => {
  clearTimeout(redrawTimer);
  redrawTimer = null;
  redrawNeedsFullPass = false;
  pendingForestFloorIds.clear();
  removeManagedLevelContainers(FLOOR_CONTAINER);
  removeManagedLevelContainers(COBWEB_ABOVE_CONTAINER);
  removeManagedLevelContainers(WEATHER_CONTAINER);
  removeManagedLevelContainers(FOREST_CONTAINER);
  clearContainer(getEditorContainer(false));
  forestRenderSignatures.clear();
  trackedWallStates.clear();
  draftPoints = [];
  selectedEdge = null;
  lastClick = null;
  unbindStageEvents();
});
Hooks.on("updateScene", (scene, change) => {
  const floorDataChanged = foundry.utils.hasProperty(change, `flags.${MODULE_ID}.${FLAG_ROOT}`);
  if (floorDataChanged
      || foundry.utils.hasProperty(change, "grid")
      || foundry.utils.hasProperty(change, "width")
      || foundry.utils.hasProperty(change, "height")) {
    scheduleRedraw();
    if (floorDataChanged) refreshFogConcealment();
    if (floorDataChanged) {
      const key = regionSyncKey(scene);
      const latestData = getSceneDataForScene(scene);
      if (!localFloorMutationInProgress(scene)) {
        const previousData = floorDataSnapshots.get(key);
        const scope = previousData ? buildFloorSyncScope(previousData, latestData) : null;
        void queueFloorSurfaceSync(scene, scope);
        void queueRubbleRegionSync(scene, scope);
      }
      floorDataSnapshots.set(key, foundry.utils.deepClone(latestData));
    }
  }
});
Hooks.on("createLevel", (level) => {
  const scene = level?.parent;
  if (!localFloorMutationInProgress(scene)) void queueFloorSurfaceSync(scene);
});
Hooks.on("updateLevel", (level, change) => {
  const scene = level?.parent;
  if (localFloorMutationInProgress(scene)) return;
  if (foundry.utils.hasProperty(change, "elevation")
      || foundry.utils.hasProperty(change, `flags.${MODULE_ID}.${LEVEL_NUMBER_FLAG}`)) {
    void queueFloorSurfaceSync(scene);
  }
});
Hooks.on("deleteLevel", (level) => {
  const scene = level?.parent;
  if (!localFloorMutationInProgress(scene)) void queueFloorSurfaceSync(scene);
});

Hooks.on("createWall", (wall) => {
  if (!wallBelongsToCanvasScene(wall)) return;
  const current = snapshotWallState(wall);
  trackedWallStates.set(wall.id, current);
  const forestFloorIds = affectedVisibleForestIds([current]);
  if (forestFloorIds.size) scheduleRedraw({ forestOnly: true, forestFloorIds });
});
Hooks.on("updateWall", (wall, change) => {
  if (!wallBelongsToCanvasScene(wall)) return;
  const previous = trackedWallStates.get(wall.id);
  const current = snapshotWallState(wall);
  trackedWallStates.set(wall.id, current);
  if (foundry.utils.hasProperty(change, "c") || foundry.utils.hasProperty(change, "move")) {
    const forestFloorIds = affectedVisibleForestIds([previous, current]);
    if (forestFloorIds.size) scheduleRedraw({ forestOnly: true, forestFloorIds });
  }
});
Hooks.on("deleteWall", (wall) => {
  if (!wallBelongsToCanvasScene(wall)) return;
  const previous = trackedWallStates.get(wall.id) ?? snapshotWallState(wall);
  trackedWallStates.delete(wall.id);
  const forestFloorIds = affectedVisibleForestIds([previous]);
  if (forestFloorIds.size) scheduleRedraw({ forestOnly: true, forestFloorIds });
});

Hooks.once("ready", () => {
  if (!canManageRubbleRegions() && !canManageFloorSurfaces()) return;
  void (async () => {
    const legacyCleanup = canManageFloorSurfaces()
      && Number(game.settings.get(MODULE_ID, SETTING_VISIBILITY_MIGRATION) ?? 0) < FLOOR_VISIBILITY_MIGRATION_VERSION;
    for (const scene of game.scenes ?? []) {
      floorDataSnapshots.set(regionSyncKey(scene), getSceneDataForScene(scene));
      if (canManageFloorSurfaces()) {
        const floorNumbers = [...new Set(getSceneDataForScene(scene).floors
          .map((floor) => Number(floor.level ?? 0)))].sort((a, b) => a - b);
        for (const floorNumber of floorNumbers) await ensureNativeLevel(floorNumber, scene);
        await reconcileLowerLevelVisibility(scene, { legacyCleanup });
        await queueFloorSurfaceSync(scene);
      }
      if (canManageRubbleRegions()) await queueRubbleRegionSync(scene);
    }
    if (legacyCleanup) {
      await game.settings.set(MODULE_ID, SETTING_VISIBILITY_MIGRATION, FLOOR_VISIBILITY_MIGRATION_VERSION);
    }
  })();
});

function wallSegments() {
  return (canvas?.scene?.walls ?? []).map((wall) => wall.c).filter((c) => Array.isArray(c) && c.length >= 4)
    .map((c) => ({ a: { x: Number(c[0]), y: Number(c[1]) }, b: { x: Number(c[2]), y: Number(c[3]) } }))
    .filter(({ a, b }) => distance(a, b) > EPSILON);
}

function blockingWallSegments() {
  const noRestriction = globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0;
  return (canvas?.scene?.walls ?? [])
    .filter((wall) => Number(wall?.move ?? noRestriction) !== noRestriction)
    .map((wall) => wall.c).filter((c) => Array.isArray(c) && c.length >= 4)
    .map((c) => ({ a: { x: Number(c[0]), y: Number(c[1]) }, b: { x: Number(c[2]), y: Number(c[3]) } }))
    .filter(({ a, b }) => distance(a, b) > EPSILON);
}

function splitSegments(segments) {
  const cuts = segments.map(() => [0, 1]);
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const hit = segmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (!hit) continue;
      cuts[i].push(hit.t);
      cuts[j].push(hit.u);
    }
  }
  const result = [];
  segments.forEach((segment, index) => {
    const values = [...new Set(cuts[index].filter((n) => n >= -EPSILON && n <= 1 + EPSILON).map((n) => Math.round(n * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let i = 1; i < values.length; i += 1) {
      const a = interpolate(segment.a, segment.b, values[i - 1]);
      const b = interpolate(segment.a, segment.b, values[i]);
      if (distance(a, b) > EPSILON) result.push({ a, b });
    }
  });
  return result;
}

function findWallFaces() {
  const segments = splitSegments(wallSegments());
  const vertices = new Map();
  const key = (p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
  const vertex = (p) => {
    const k = key(p);
    if (!vertices.has(k)) vertices.set(k, { ...p, key: k, outgoing: [] });
    return vertices.get(k);
  };
  const directed = [];
  for (const segment of segments) {
    const a = vertex(segment.a);
    const b = vertex(segment.b);
    const ab = { from: a, to: b, visited: false };
    const ba = { from: b, to: a, visited: false };
    ab.twin = ba; ba.twin = ab;
    a.outgoing.push(ab); b.outgoing.push(ba);
    directed.push(ab, ba);
  }
  for (const v of vertices.values()) v.outgoing.sort((x, y) => edgeAngle(x) - edgeAngle(y));
  const faces = [];
  for (const start of directed) {
    if (start.visited) continue;
    const points = [];
    let edge = start;
    let guard = 0;
    while (!edge.visited && guard++ < directed.length + 1) {
      edge.visited = true;
      points.push({ x: edge.from.x, y: edge.from.y });
      const outgoing = edge.to.outgoing;
      const twinIndex = outgoing.indexOf(edge.twin);
      edge = outgoing[(twinIndex - 1 + outgoing.length) % outgoing.length];
      if (edge === start) break;
    }
    const polygon = normalizePolygon(points);
    // Canvas Y coordinates grow downwards. With the clockwise successor used
    // above, bounded faces have positive area and the unbounded exterior is
    // traced with negative area.
    if (edge === start && polygon.length >= 3 && polygonArea(polygon) > 1) faces.push(polygon);
  }
  return faces;
}

function findWallFace(point) {
  return findWallFaces().filter((polygon) => pointInPolygon(point, polygon))
    .sort((a, b) => Math.abs(polygonArea(a)) - Math.abs(polygonArea(b)))[0] ?? null;
}

function edgeAngle(edge) { return Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x); }
function interpolate(a, b, tValue) { return { x: a.x + (b.x - a.x) * tValue, y: a.y + (b.y - a.y) * tValue }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function polygonArea(points) { return points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2; }
function normalizePolygon(points) {
  const clean = (Array.isArray(points) ? points : []).map((p) => ({ x: Number(p.x), y: Number(p.y) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length > 1 && distance(clean[0], clean.at(-1)) < EPSILON) clean.pop();
  return clean.filter((point, index) => index === 0 || distance(point, clean[index - 1]) >= EPSILON);
}
function polygonBounds(points) {
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}
function orientedPolygonFrame(points) {
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]; const to = points[(index + 1) % points.length];
    if (distance(from, to) < EPSILON) continue;
    let angle = Math.atan2(to.y - from.y, to.x - from.x);
    angle -= Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    let minX = Number.POSITIVE_INFINITY; let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY; let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      const x = point.x * cos + point.y * sin;
      const y = -point.x * sin + point.y * cos;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY);
    const candidate = { angle, cos, sin, minX, maxX, minY, maxY, width, height, area: width * height };
    if (!best || candidate.area < best.area - EPSILON || (Math.abs(candidate.area - best.area) <= EPSILON && Math.abs(angle) < Math.abs(best.angle))) best = candidate;
  }
  if (!best) {
    const bounds = polygonBounds(points);
    best = { angle: 0, cos: 1, sin: 0, minX: bounds.x, maxX: bounds.x + bounds.width, minY: bounds.y, maxY: bounds.y + bounds.height, width: bounds.width, height: bounds.height };
  }
  const localCenter = { x: (best.minX + best.maxX) / 2, y: (best.minY + best.maxY) / 2 };
  return {
    ...best,
    center: { x: localCenter.x * best.cos - localCenter.y * best.sin, y: localCenter.x * best.sin + localCenter.y * best.cos },
    toWorld: ({ x, y }) => ({ x: x * best.cos - y * best.sin, y: x * best.sin + y * best.cos }),
    vectorToWorld: ({ x, y }) => ({ x: x * best.cos - y * best.sin, y: x * best.sin + y * best.cos }),
  };
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function orientation(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function segmentsCross(a, b, c, d) {
  const o1 = orientation(a, b, c); const o2 = orientation(a, b, d); const o3 = orientation(c, d, a); const o4 = orientation(c, d, b);
  return o1 * o2 < -EPSILON && o3 * o4 < -EPSILON;
}
function polygonSelfIntersects(points) {
  for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1)) continue;
    if (segmentsCross(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return true;
  }
  return false;
}
function segmentIntersection(a, b, c, d) {
  const rx = b.x - a.x; const ry = b.y - a.y; const sx = d.x - c.x; const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < EPSILON) return null;
  const qx = c.x - a.x; const qy = c.y - a.y;
  const tValue = (qx * sy - qy * sx) / denominator;
  const uValue = (qx * ry - qy * rx) / denominator;
  if (tValue < -EPSILON || tValue > 1 + EPSILON || uValue < -EPSILON || uValue > 1 + EPSILON) return null;
  return { t: tValue, u: uValue };
}
function pointSegmentDistance(p, a, b) {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!length2) return distance(p, a);
  const tValue = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2));
  return distance(p, interpolate(a, b, tValue));
}
function distanceToPolygon(point, polygon) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    minimum = Math.min(minimum, pointSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return minimum;
}
function polygonsEquivalent(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  const keys = (points) => points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  const left = keys(a); const right = keys(b); const doubled = `${right.join("|")}|${right.join("|")}`;
  const reversed = [...right].reverse(); const doubledReverse = `${reversed.join("|")}|${reversed.join("|")}`;
  return doubled.includes(left.join("|")) || doubledReverse.includes(left.join("|"));
}
