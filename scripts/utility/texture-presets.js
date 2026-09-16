import { MODULE_ID, t } from "../core.js";

export const TEXTURE_PRESET_FLAG = "texturePreset";
export const TEXTURE_PRESET_CHANGE_HOOK = `${MODULE_ID}.texturePresetChanged`;
export const BASE_TEXTURE_PRESET = "base";
export const BASTION_TEXTURE_PRESET = "bastion-blasphemy";

const MODULE_IMAGE_ROOT = `modules/${MODULE_ID}/images/`;
const PRESET_IMAGE_ROOT = `${MODULE_IMAGE_ROOT}presets/`;

export const TEXTURE_PRESETS = Object.freeze({
  [BASE_TEXTURE_PRESET]: Object.freeze({
    labelKey: "Settings.TexturePreset.Choices.Base",
    fallback: "Base",
  }),
  [BASTION_TEXTURE_PRESET]: Object.freeze({
    labelKey: "Settings.TexturePreset.Choices.DarkFantasy",
    fallback: "Dark Fantasy",
  }),
});

const BASTION_COMPLETE_TEXTURE_FILES = Object.freeze({
  "scene-assets": Object.freeze([

    "altar.webp", "ash.webp", "banquet-table.webp", "barrel.webp", "barrel-side.webp",
    "bathtub-copper.webp", "bathtub-wood.webp", "bed.webp", "bed-blue.webp", "bed-fur.webp",
    "bed-messy-blue.webp", "bed-messy-brown.webp", "bed-oak.webp", "bedroll-blue.webp",
    "bedroll-fur.webp", "bedroll-green.webp", "bench-topdown-v2.webp", "blood.webp",
    "books-scrolls.webp", "brazier.webp", "bridge.webp", "broken-boards.webp",
    "broken-column-stump-v1.webp",
    "bush.webp", "bucket-topdown-v1.webp", "campfire-embers.webp", "campfire-stones.webp", "candle.webp",
    "chandelier-round-topdown-v1.webp",
    "cauldron.webp", "chest.webp", "corpse.webp", "crate.webp", "dead-tree.webp", "desk.webp",
    "grave-buried-topdown-v1.webp", "grave-open-topdown-v1.webp",
    "grave-marker-rounded-topdown-v1.webp", "grave-marker-pointed-topdown-v1.webp",
    "dock-corner.webp", "dock-straight.webp", "double-bed-linen.webp", "double-bed-red.webp",
    "fallen-column.webp", "footprints.webp", "fountain.webp", "gold-pile.webp", "ladder.webp",
    "ladder-vertical.webp", "lantern.webp", "logs.webp", "long-table.webp", "mooring-posts.webp",
    "mud.webp", "pine-tree.webp",
    "ritual-circle.webp", "rocks.webp", "round-table-four-legs.webp", "rowboat.webp", "rug-red.webp",
    "ruins.webp", "sacks.webp", "short-stairs-down.webp", "short-stairs-up.webp",
    "sink-stone-topdown-v3.webp", "sink-wood-topdown-v3.webp", "skeleton.webp", "stairs-down.webp", "stairs-stone-square.webp", "stairs-up.webp",
    "stairs-wood-rustic.webp", "stairs-wood-straight.webp", "standing-column.webp",
    "standing-stone-broad.webp", "standing-stone-crooked.webp", "standing-stone-narrow.webp",
    "stonehenge-circle.webp", "stonehenge-fangs.webp",
    "stonehenge-trilithon-circle-v2.webp", "stump.webp", "tableware-ale.webp",
    "tableware-breakfast.webp", "tableware-cheese-fruit.webp", "tableware-feast-v2.webp",
    "tableware-fish.webp", "tableware-roast.webp", "tableware-stew.webp", "tableware-wine.webp",
    "throne-topdown-v1.webp",
    "side-wall-torch-topdown-v1.webp", "side-wall-torch-holder-empty-topdown-v1.webp",
    "side-wall-torch-holder-torch-topdown-v1.webp", "side-wall-torch-holder-crystal-topdown-v1.webp",
    "torch.webp", "trapdoor.webp", "tree.webp", "tub.webp", "wall-torch-bracket.webp",
    "wall-torch-iron.webp", "well.webp",
  ]),
  "scene-floors": Object.freeze([
    "crowd-poor-v1.webp",
    "crowd-laborers-v1.webp",
    "crowd-merchants-v1.webp",
    "crowd-artisans-v1.webp",
    "crowd-middle-class-v1.webp",
    "crowd-aristocrats-v1.webp",

    "cave-solid-rock-v1.svg", "cave-shadow-v2.svg",
    "carpet-blue-ornate-floor-v2.webp", "carpet-green-gold-floor.webp", "carpet-red-ornate-floor.webp",
    "rubble-stone-floor-v9.webp", "rubble-stone-boards-floor-v9.webp", "rubble-boards-floor-v9.webp",
    "rubble-brick-grey-floor-v9.webp", "rubble-brick-red-floor-v9.webp",
    "rubble-brick-grey-boards-floor-v9.webp", "rubble-brick-red-boards-floor-v9.webp",
    "rubble-cutout-stone-01-v16.webp",
    "rubble-cutout-stone-02-v16.webp",
    "rubble-cutout-stone-03-v16.webp",
    "rubble-cutout-stone-04-v16.webp",
    "rubble-cutout-stone-05-v16.webp",
    "rubble-cutout-stone-06-v16.webp",
    "rubble-cutout-stone-07-v16.webp",
    "rubble-cutout-stone-08-v16.webp",
    "rubble-cutout-stone-09-v16.webp",
    "rubble-cutout-stone-10-v16.webp",
    "rubble-cutout-stone-11-v16.webp",
    "rubble-cutout-stone-12-v16.webp",
    "rubble-cutout-boards-01-v16.webp",
    "rubble-cutout-boards-02-v16.webp",
    "rubble-cutout-boards-03-v16.webp",
    "rubble-cutout-boards-04-v16.webp",
    "rubble-cutout-boards-05-v16.webp",
    "rubble-cutout-boards-06-v16.webp",
    "rubble-cutout-boards-07-v16.webp",
    "rubble-cutout-boards-08-v16.webp",
    "rubble-cutout-boards-09-v16.webp",
    "rubble-cutout-boards-10-v16.webp",
    "rubble-cutout-boards-11-v16.webp",
    "rubble-cutout-boards-12-v16.webp",
    "rubble-cutout-brick-grey-01-v16.webp",
    "rubble-cutout-brick-grey-02-v16.webp",
    "rubble-cutout-brick-grey-03-v16.webp",
    "rubble-cutout-brick-grey-04-v16.webp",
    "rubble-cutout-brick-grey-05-v16.webp",
    "rubble-cutout-brick-grey-06-v16.webp",
    "rubble-cutout-brick-grey-07-v16.webp",
    "rubble-cutout-brick-grey-08-v16.webp",
    "rubble-cutout-brick-grey-09-v16.webp",
    "rubble-cutout-brick-grey-10-v16.webp",
    "rubble-cutout-brick-grey-11-v16.webp",
    "rubble-cutout-brick-grey-12-v16.webp",
    "rubble-cutout-brick-red-01-v16.webp",
    "rubble-cutout-brick-red-02-v16.webp",
    "rubble-cutout-brick-red-03-v16.webp",
    "rubble-cutout-brick-red-04-v16.webp",
    "rubble-cutout-brick-red-05-v16.webp",
    "rubble-cutout-brick-red-06-v16.webp",
    "rubble-cutout-brick-red-07-v16.webp",
    "rubble-cutout-brick-red-08-v16.webp",
    "rubble-cutout-brick-red-09-v16.webp",
    "rubble-cutout-brick-red-10-v16.webp",
    "rubble-cutout-brick-red-11-v16.webp",
    "rubble-cutout-brick-red-12-v16.webp",
    "stairs-brick-red.png",
    "stairs-flagstone-grey.png", "stairs-uneven-limestone.png", "stairs-wood-alder.png",
    "stairs-wood-outdoor-brown.png", "stairs-wood-walnut.png",
  ]),
  "scene-walls": Object.freeze([
    "arrow-slit-splayed-v4.svg", "border-curtain-blue.webp", "border-curtain-red.webp",
    "border-wood-stone-v2.webp", "cliff-coastal-stone-v3.webp", "cliff-volcanic-v3.webp",
    "metal-iron.png", "window-iron.webp", "window-wood.webp", "wood-alder.png", "wood-nut.png",
  ]),
});

function bastionVersionedFilename(filename) {
  const extensionIndex = filename.lastIndexOf(".");
  return extensionIndex < 0
    ? `${filename}-bastion-v2`
    : `${filename.slice(0, extensionIndex)}-bastion-v2${filename.slice(extensionIndex)}`;
}

const BASTION_COMPLETE_TEXTURE_REDIRECTS = Object.freeze(Object.fromEntries(
  Object.entries(BASTION_COMPLETE_TEXTURE_FILES).flatMap(([directory, filenames]) => filenames.map((filename) => [
    `${directory}/${filename}`,
    `${directory}/${bastionVersionedFilename(filename)}`,
  ])),
));

function numberedScatterTexturePaths(prefix, count, version = 1, excluded = []) {
  const excludedNumbers = new Set(excluded.map(Number));
  return Array.from({ length: count }, (_, index) => index + 1)
    .filter((number) => !excludedNumbers.has(number))
    .map((number) => `scene-floors/${prefix}-${String(number).padStart(2, "0")}-v${version}.webp`);
}

function numberedScatterTextureRedirects(prefix, count, version = 1, excluded = []) {
  const excludedNumbers = new Set(excluded.map(Number));
  return Object.fromEntries(Array.from({ length: count }, (_, index) => index + 1)
    .filter((number) => !excludedNumbers.has(number))
    .map((index) => {
    const number = String(index).padStart(2, "0");
    return [
      `scene-floors/${prefix}-${number}-v${version}.webp`,
      `scene-floors/${prefix}-${number}-bastion-v${version}.webp`,
    ];
  }));
}

function numberedScatterLegacyCanonicalPaths(prefix, count, oldVersion, newVersion) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const current = `scene-floors/${prefix}-${number}-v${newVersion}.webp`;
    return [
      [`scene-floors/${prefix}-${number}-v${oldVersion}.webp`, current],
      [`scene-floors/${prefix}-${number}-bastion-v${oldVersion}.webp`, current],
    ];
  }).flat());
}

function retiredGrassStoneCanonicalPaths(prefix, count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const rubbleNumber = String((index % 12) + 1).padStart(2, "0");
    const replacement = `scene-floors/rubble-cutout-stone-${rubbleNumber}-v16.webp`;
    return [1, 2, 3].flatMap((version) => [
      [`scene-floors/${prefix}-${number}-v${version}.webp`, replacement],
      [`scene-floors/${prefix}-${number}-bastion-v${version}.webp`, replacement],
    ]);
  }).flat());
}

function retiredScatterAssetCanonicalPaths(prefix, number, replacement, latestVersion = 3) {
  const padded = String(number).padStart(2, "0");
  return Object.fromEntries(Array.from({ length: latestVersion }, (_, index) => index + 1).flatMap((version) => [
    [`scene-floors/${prefix}-${padded}-v${version}.webp`, replacement],
    [`scene-floors/${prefix}-${padded}-bastion-v${version}.webp`, replacement],
  ]));
}

// Complete registered texture coverage for the Bastion of Blasphemy preset.
// A path is redirected only when its alternate file is present in this
// manifest, so clients request one active variant instead of every preset.
const BASTION_TEXTURES = new Set([
  "scene-assets/armchair-burgundy-topdown-v1.webp",
  "scene-assets/armchair-green-topdown-v1.webp",
  "scene-assets/bar-counter-corner.webp",
  "scene-assets/bar-counter-straight.webp",
  "scene-assets/laborer-counter-straight-topdown-v1.webp",
  "scene-assets/barrels-side-cluster.webp",
  "scene-assets/beehive-skep-topdown-v1.webp",
  "scene-assets/floor-lever-compact-front-v2.webp",
  "scene-assets/floor-lever-heavy-front-v2.webp",
  "scene-assets/grandfather-clock-oak-topdown-v1.webp",
  "scene-assets/grandfather-clock-mechanical-topdown-v1.webp",
  "scene-assets/grandfather-clock-oak-topdown-v2.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v2.webp",
  "scene-assets/grandfather-clock-oak-topdown-v3.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v3.webp",
  "scene-assets/grandfather-clock-oak-topdown-v4.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v4.webp",
  "scene-assets/carriage-closed-topdown-v1.webp",
  "scene-assets/carriage-open-topdown-v1.webp",
  "scene-assets/carriage-stagecoach-topdown-v1.webp",
  "scene-assets/cart-utility-topdown-v1.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v3.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v4.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v5.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-wall-topdown-v4.webp",
  "scene-assets/bookshelf-wall-topdown-v5.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v2.webp",
  "scene-assets/cabinet-narrow-topdown-v3.png",
  "scene-assets/cabinet-narrow-wall-topdown-v4.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v5.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/cabinet-topdown-v2.webp",
  "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-wall-topdown-v3.webp",
  "scene-assets/cabinet-wall-topdown-v4.webp",
  "scene-assets/column-stone-topdown-v1.png",
  "scene-assets/column-stone-topdown-v2.webp",
  "scene-assets/column-stone-topdown-v3.webp",
  "scene-assets/column-wood-topdown-v1.png",
  "scene-assets/column-wood-topdown-v2.webp",
  "scene-assets/column-wood-topdown-v3.webp",
  "scene-assets/chair.webp",
  "scene-assets/coffin-stone-topdown-v1.webp",
  "scene-assets/coffin-wood-topdown-v1.webp",
  "scene-assets/drums.webp",
  "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/forest-deciduous-irregular-a.webp",
  "scene-assets/forest-deciduous-irregular-b.webp",
  "scene-assets/forest-pine-irregular-a.webp",
  "scene-assets/forest-pine-irregular-b.webp",
  "scene-assets/grand-piano-topdown-v2.webp",
  "scene-assets/harp-topdown-v2.webp",
  "scene-assets/music-stand-empty-topdown-v2.webp",
  "scene-assets/music-stand-sheet-music-topdown-v2.webp",
  "scene-assets/hay-cluster.webp",
  "scene-assets/hay-pile.webp",
  "scene-assets/hay-windrow.webp",
  "scene-assets/feeding-trough-topdown-v1.webp",
  "scene-assets/hay-scatter-topdown-v1.webp",
  "scene-assets/hay-bale-rectangular-topdown-v1.webp",
  "scene-assets/painting-landscape-topdown-v2.webp",
  "scene-assets/mirror-wall-square-topdown-v3.webp",
  "scene-assets/mirror-wall-rectangular-2-topdown-v3.webp",
  "scene-assets/mirror-wall-round-topdown-v3.webp",
  "scene-assets/mirror-wall-oval-2-topdown-v3.webp",
  "scene-assets/mirror-wall-wide-topdown-v1.webp",
  "scene-assets/painting-portrait-topdown-v2.webp",
  "scene-assets/painting-still-life-topdown-v2.webp",
  "scene-assets/lectern-topdown-v2.webp",
  "scene-assets/lectern-topdown-v3.webp",
  "scene-assets/pew-topdown-v2.webp",
  "scene-assets/piano-topdown-v2.webp",
  "scene-assets/potted-flowers-v2.webp",
  "scene-assets/potted-herbs-v2.webp",
  "scene-assets/potted-tree-v2.webp",
  "scene-assets/sofa-burgundy-topdown-v1.webp",
  "scene-assets/sofa-green-topdown-v1.webp",
  "scene-assets/stairs-wood-square.webp",
  "scene-assets/statue-child-topdown-v2.webp",
  "scene-assets/statue-dwarf-guardian-topdown-v1.webp",
  "scene-assets/statue-dwarf-smith-topdown-v1.webp",
  "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-man-topdown-v2.webp",
  "scene-assets/statue-woman-topdown-v2.webp",
  "scene-assets/stool-v2.webp",
  "scene-assets/table.webp",
  "scene-assets/noble-table-walnut-rectangular-topdown-v3.webp",
  "scene-assets/noble-table-mahogany-oval-topdown-v1.webp",
  "scene-assets/noble-table-burgundy-velvet-cloth-topdown-v3.webp",
  "scene-assets/noble-table-blue-damask-cloth-topdown-v1.webp",
  "scene-assets/noble-table-marquetry-round-topdown-v1.webp",
  "scene-assets/noble-table-grand-banquet-topdown-v1.webp",
  "scene-assets/tabletop-set-alchemy-v1.webp",
  "scene-assets/tabletop-set-arcane-v1.webp",
  "scene-assets/tabletop-set-books-v1.webp",
  "scene-assets/tabletop-dollhouse-open-square-v3.webp",
  "scene-assets/tabletop-dollhouse-closed-square-v3.webp",
  "scene-assets/tabletop-dollhouse-manor-open-square-v3.webp",
  "scene-assets/tabletop-dollhouse-gothic-castle-closed-square-v3.webp",
  "scene-assets/tabletop-dollhouse-castle-open-square-v3.webp",
  "scene-assets/wall-gear-large-front-v2.webp",
  "scene-assets/wall-gear-small-front-v2.webp",
  "scene-assets/wall-gears-cluster-front-v2.webp",
  "scene-assets/wall-lever-brass-front-v2.webp",
  "scene-assets/wall-lever-iron-front-v2.webp",
  "scene-assets/wall-gear-small-topdown-v4.webp",
  "scene-assets/wall-lever-brass-topdown-v4.webp",
  "scene-assets/wall-lever-iron-topdown-v4.webp",
  "scene-assets/printing-press-topdown-v1.webp",
  "scene-assets/floor-loom-topdown-v1.webp",
  "scene-assets/woodworking-circular-saw-bench-topdown-v1.webp",
  "scene-assets/weapon-rack-axes-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-bows-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-bow-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-crossbows-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-mixed-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-mixed-wall-topdown-v1.webp",
  "scene-assets/weapon-rack-armorer-display-topdown-v1.webp",
  "scene-assets/weapon-rack-polearms-cradle-topdown-v1.webp",
  "scene-assets/weapon-rack-spears-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-swords-straight-standing-topdown-v5.webp",
  "scene-assets/tabletop-set-cartography-v1.webp",
  "scene-assets/tabletop-set-jewelry-v1.webp",
  "scene-assets/tabletop-set-medicine-v1.webp",
  "scene-assets/tabletop-set-disguise-v1.webp",
  "scene-assets/tabletop-set-metalworking-v1.webp",
  "scene-assets/tabletop-set-torture-v1.webp",
  "scene-assets/tabletop-set-woodworking-v1.webp",
  "scene-assets/tabletop-set-writing-v1.webp",
  "scene-assets/throne-topdown-v1.webp",
  "scene-assets/tableware-empty.webp",
  "scene-assets/tableware-tea.webp",
  "scene-assets/toilet-board-alder-square-v2.webp",
  "scene-assets/toilet-board-alder-square-v3.webp",
  "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-alder-double-v3.webp",
  "scene-assets/toilet-board-alder-double-v4.webp",
  "scene-assets/toilet-board-oak-square-v2.webp",
  "scene-assets/toilet-board-oak-square-v3.webp",
  "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-oak-double-v3.webp",
  "scene-assets/toilet-board-oak-double-v4.webp",
  "scene-assets/toilet-board-walnut-square-v2.webp",
  "scene-assets/toilet-board-walnut-square-v3.webp",
  "scene-assets/toilet-board-walnut-square-v4.webp",
  "scene-assets/toilet-board-walnut-double-v3.webp",
  "scene-assets/toilet-board-walnut-double-v4.webp",
  "scene-assets/wagon-covered-topdown-v1.webp",
  "scene-assets/wagon-freight-topdown-v1.webp",
  "scene-assets/lake-v2.webp",
  "scene-assets/pond-v2.webp",
  "scene-assets/water-puddle-v2.webp",
  "scene-floors/brick-red-floor.png",
  "scene-floors/carpet-blue-floor.png",
  "scene-floors/carpet-corner-blue-v2.webp",
  "scene-floors/carpet-corner-red-v2.webp",
  "scene-floors/carpet-edge-blue-v2.webp",
  "scene-floors/carpet-edge-red-v2.webp",
  "scene-floors/carpet-red-floor.png",
  "scene-floors/cobweb-corner-above-v1.webp",
  "scene-floors/cobweb-corner-below-v1.webp",
  "scene-floors/cobweb-patch-above-v1.webp",
  "scene-floors/cobweb-patch-below-v1.webp",
  "scene-floors/cobweb-strip-above-v1.webp",
  "scene-floors/cobweb-strip-below-v1.webp",
  "scene-floors/weather-fog-floor-v1.webp",
  "scene-floors/cave-brown-floor.png",
  "scene-floors/cave-grey-pebbles-floor-v2.webp",
  "scene-floors/cave-walls-floor-v1.webp",
  "scene-floors/sand-clean-floor-v1.webp",
  "scene-floors/sand-arena-floor-v1.webp",
  "scene-floors/sand-outdoor-floor-v1.webp",
  "scene-floors/courtyard-cobblestone-floor-v1.webp",
  "scene-floors/flagstone-grey-floor.png",
  "scene-floors/floor-ornament-geometric-v2.webp",
  "scene-floors/floor-ornament-knotwork-v2.webp",
  "scene-floors/floor-ornament-diamond-v2.webp",
  "scene-floors/garden-cabbage-floor.webp",
  "scene-floors/garden-carrot-floor.webp",
  "scene-floors/garden-crop-cabbage-v2.webp",
  "scene-floors/garden-crop-carrot-v2.webp",
  "scene-floors/garden-crop-herbs-v2.webp",
  "scene-floors/garden-crop-rice-v2.webp",
  "scene-floors/garden-herbs-floor.webp",
  "scene-floors/garden-rice-floor.webp",
  "scene-floors/garden-rice-water-v5.png",
  "scene-floors/garden-soil-soft-v3.webp",
  "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-rocky-floor-v1.webp",
  "scene-floors/grass-meadow-floor-v3.webp",
  "scene-floors/grass-meadow-floor-v2.png",
  "scene-floors/grass-meadow-floor.png",
  ...numberedScatterTexturePaths("grass-flower-single", 12, 3, [7]),
  ...numberedScatterTexturePaths("grass-flower-cluster", 6, 1),
  "scene-floors/swamp-floor-v1.png",
  "scene-floors/flowering-shrubs-dense-floor-v1.webp",
  "scene-floors/path-cobblestone-floor.png",
  "scene-floors/path-cobblestone-floor-v2.png",
  "scene-floors/path-cobblestone-floor-v3.webp",
  "scene-floors/path-dirt-floor.png",
  "scene-floors/path-dirt-floor-v2.png",
  "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/roof-shingles-floor.webp",
  "scene-floors/roof-thatch-floor.webp",
  "scene-floors/roof-tiles-floor.webp",
  "scene-floors/sea-deep-floor-v2.webp",
  "scene-floors/sea-deep-floor-v3.webp",
  "scene-floors/sea-deep-floor-v4.webp",
  "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-shallow-floor-v2.webp",
  "scene-floors/sea-shallow-floor-v3.webp",
  "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-stormy-floor-v2.webp",
  "scene-floors/sea-stormy-floor-v3.webp",
  "scene-floors/sea-stormy-floor-v4.webp",
  "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-scatter-whirlpool-v1.webp",
  ...numberedScatterTexturePaths("sea-scatter-debris", 8, 1),
  ...numberedScatterTexturePaths("sea-scatter-debris", 8, 2),
  ...numberedScatterTexturePaths("sea-scatter-debris", 8, 3),
  ...numberedScatterTexturePaths("sea-scatter-fish-shadow", 8, 1),
  ...numberedScatterTexturePaths("sea-scatter-fish-school", 6, 1),
  ...numberedScatterTexturePaths("sea-scatter-wreckage", 4, 1),
  ...numberedScatterTexturePaths("sea-scatter-wreckage", 4, 2),
  ...numberedScatterTexturePaths("sea-scatter-storm-foam", 2, 1),
  "scene-floors/sea-scatter-whirlpool-dark-v1.webp",
  "scene-floors/uneven-limestone-floor.png",
  "scene-floors/wood-alder-floor.png",
  "scene-floors/wood-continuous-floor-v1.webp",
  "scene-floors/wood-outdoor-brown-v3.png",
  "scene-floors/wood-walnut-floor.png",
  "scene-floors/warehouse-crate-topdown-v1.webp",
  "scene-floors/warehouse-barrel-topdown-v1.webp",
  "scene-floors/warehouse-sacks-topdown-v1.webp",
  "scene-floors/warehouse-sack-a-topdown-v2.webp",
  "scene-floors/warehouse-sack-b-topdown-v2.webp",
  "scene-floors/warehouse-sack-c-topdown-v2.webp",
  "scene-walls/arrow-slit-straight-v4.svg",
  "scene-walls/border-curtain-gold.webp",
  "scene-walls/border-green-fog.webp",
  "scene-walls/border-green-fog-v2.webp",
  "scene-walls/border-green-fog-v3.webp",
  "scene-walls/border-green-fog-v4.webp",
  "scene-walls/border-green-fog-v5.webp",
  "scene-walls/border-green-fog-v6.webp",
  "scene-walls/border-green-fog-v7.webp",
  "scene-walls/brick-grey-dense.webp",
  "scene-walls/brick-grey.webp",
  "scene-walls/brick-red.webp",
  "scene-walls/cliff-limestone-v2.webp",
  "scene-walls/cliff-sandy-v2.webp",
  "scene-walls/hedge-maze.webp",
  "scene-walls/window-stained.webp",
  "scene-assets/prison-floor-cage-topdown-v1.webp",
  "scene-assets/prison-hanging-cage-topdown-v1.webp",
  "scene-assets/prison-fairy-table-cage-topdown-v1.webp",
  "scene-assets/prison-fairy-hanging-cage-topdown-v1.webp",
  "scene-assets/prison-iron-maiden-topdown-v2.webp",
  "scene-assets/prison-restraint-table-topdown-v1.webp",
  "scene-assets/prison-ceiling-chain-topdown-v2.webp",
  "scene-assets/prison-wall-manacles-topdown-v2.webp",
  "scene-assets/prison-stocks-topdown-v2.webp",
  "scene-assets/prison-restraint-chair-topdown-v1.webp",
  "scene-assets/prison-instrument-table-topdown-v1.webp",
  "scene-assets/prison-brazier-pokers-topdown-v1.webp",
  ...Object.keys(BASTION_COMPLETE_TEXTURE_REDIRECTS),
]);

// Image generation can leave a light matte in RGB pixels underneath a valid
// alpha mask. These corrected siblings preserve the original dimensions and
// alpha channel while replacing only that matte-contaminated colour data.
const BASTION_TEXTURE_REDIRECTS = Object.freeze({
  "scene-floors/weather-fog-floor-v1.webp": "scene-floors/weather-fog-floor-bastion-v1.webp",
  "scene-assets/lake-v2.webp": "scene-assets/lake-bastion-v3.webp",
  "scene-assets/pond-v2.webp": "scene-assets/pond-bastion-v3.webp",
  "scene-assets/water-puddle-v2.webp": "scene-assets/water-puddle-bastion-v3.webp",
  "scene-floors/grass-meadow-floor-v4.webp": "scene-floors/grass-meadow-floor-bastion-v10.webp",
  "scene-floors/grass-rocky-floor-v1.webp": "scene-floors/grass-rocky-floor-bastion-v1.webp",
  "scene-floors/grass-meadow-floor-v3.webp": "scene-floors/grass-meadow-floor-bastion-v9.webp",
  "scene-floors/grass-meadow-floor-v2.png": "scene-floors/grass-meadow-floor-bastion-v8.png",
  "scene-floors/grass-meadow-floor.png": "scene-floors/grass-meadow-floor-bastion-v7.png",
  ...numberedScatterTextureRedirects("grass-flower-single", 12, 3, [7]),
  ...numberedScatterTextureRedirects("grass-flower-cluster", 6, 1),
  "scene-floors/swamp-floor-v1.png": "scene-floors/swamp-floor-bastion-v1.png",
  "scene-floors/path-cobblestone-floor-v3.webp": "scene-floors/path-cobblestone-floor-bastion-v4.webp",
  "scene-floors/path-cobblestone-floor-v2.png": "scene-floors/path-cobblestone-floor-bastion-v3.png",
  "scene-floors/courtyard-cobblestone-floor-v1.webp": "scene-floors/courtyard-cobblestone-floor-bastion-v1.webp",
  "scene-floors/cave-walls-floor-v1.webp": "scene-floors/cave-walls-floor-bastion-v1.webp",
  "scene-floors/sand-clean-floor-v1.webp": "scene-floors/sand-clean-floor-bastion-v1.webp",
  "scene-floors/sand-arena-floor-v1.webp": "scene-floors/sand-arena-floor-bastion-v1.webp",
  "scene-floors/sand-outdoor-floor-v1.webp": "scene-floors/sand-outdoor-floor-bastion-v1.webp",
  "scene-floors/path-dirt-floor-v3.webp": "scene-floors/path-dirt-floor-dark-fantasy-v6.webp",
  "scene-floors/path-dirt-floor-v2.png": "scene-floors/path-dirt-floor-dark-fantasy-v5.png",
  "scene-floors/path-dirt-floor.png": "scene-floors/path-dirt-floor-dark-fantasy-v4.png",
  "scene-floors/sea-deep-floor-v5.webp": "scene-floors/sea-deep-floor-bastion-v6.webp",
  "scene-floors/sea-deep-floor-v4.webp": "scene-floors/sea-deep-floor-bastion-v5.webp",
  "scene-floors/sea-deep-floor-v3.webp": "scene-floors/sea-deep-floor-bastion-v4.webp",
  "scene-floors/sea-deep-floor-v2.webp": "scene-floors/sea-deep-floor-bastion-v3.webp",
  "scene-floors/sea-shallow-floor-v4.webp": "scene-floors/sea-shallow-floor-bastion-v5.webp",
  "scene-floors/sea-shallow-floor-v3.webp": "scene-floors/sea-shallow-floor-bastion-v4.webp",
  "scene-floors/sea-shallow-floor-v2.webp": "scene-floors/sea-shallow-floor-bastion-v3.webp",
  "scene-floors/sea-stormy-floor-v5.webp": "scene-floors/sea-stormy-floor-bastion-v6.webp",
  "scene-floors/sea-stormy-floor-v4.webp": "scene-floors/sea-stormy-floor-bastion-v5.webp",
  "scene-floors/sea-stormy-floor-v3.webp": "scene-floors/sea-stormy-floor-bastion-v4.webp",
  "scene-floors/sea-stormy-floor-v2.webp": "scene-floors/sea-stormy-floor-bastion-v3.webp",
  "scene-floors/sea-scatter-whirlpool-v1.webp": "scene-floors/sea-scatter-whirlpool-bastion-v1.webp",
  ...numberedScatterTextureRedirects("sea-scatter-debris", 8, 1),
  ...numberedScatterTextureRedirects("sea-scatter-debris", 8, 2),
  ...numberedScatterTextureRedirects("sea-scatter-debris", 8, 3),
  ...numberedScatterTextureRedirects("sea-scatter-fish-shadow", 8, 1),
  ...numberedScatterTextureRedirects("sea-scatter-fish-school", 6, 1),
  ...numberedScatterTextureRedirects("sea-scatter-wreckage", 4, 1),
  ...numberedScatterTextureRedirects("sea-scatter-wreckage", 4, 2),
  ...numberedScatterTextureRedirects("sea-scatter-storm-foam", 2, 1),
  "scene-floors/sea-scatter-whirlpool-dark-v1.webp": "scene-floors/sea-scatter-whirlpool-dark-bastion-v1.webp",
  "scene-floors/wood-continuous-floor-v1.webp": "scene-floors/wood-continuous-floor-bastion-v1.webp",
  "scene-floors/warehouse-crate-topdown-v1.webp": "scene-floors/warehouse-crate-topdown-bastion-v1.webp",
  "scene-floors/warehouse-barrel-topdown-v1.webp": "scene-floors/warehouse-barrel-topdown-bastion-v1.webp",
  "scene-floors/warehouse-sacks-topdown-v1.webp": "scene-floors/warehouse-sacks-topdown-bastion-v1.webp",
  "scene-floors/warehouse-sack-a-topdown-v2.webp": "scene-floors/warehouse-sack-a-topdown-bastion-v2.webp",
  "scene-floors/warehouse-sack-b-topdown-v2.webp": "scene-floors/warehouse-sack-b-topdown-bastion-v2.webp",
  "scene-floors/warehouse-sack-c-topdown-v2.webp": "scene-floors/warehouse-sack-c-topdown-bastion-v2.webp",
  "scene-assets/bar-counter-corner.webp": "scene-assets/bar-counter-corner-fixed.webp",
  "scene-assets/bar-counter-straight.webp": "scene-assets/bar-counter-straight-fixed.webp",
  "scene-assets/laborer-counter-straight-topdown-v1.webp": "scene-assets/laborer-counter-straight-topdown-bastion-v1.webp",
  "scene-assets/barrels-side-cluster.webp": "scene-assets/barrels-side-cluster-fixed.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v3.webp": "scene-assets/bookshelf-narrow-wall-topdown-v3.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v2.webp": "scene-assets/cabinet-narrow-wall-topdown-v2.webp",
  "scene-assets/chair.webp": "scene-assets/chair-fixed.webp",
  "scene-assets/drums.webp": "scene-assets/drums-fixed.webp",
  "scene-assets/fireplace-brick-wall-topdown-v4.webp": "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-wall-topdown-v4.webp": "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/forest-deciduous-irregular-a.webp": "scene-assets/forest-deciduous-irregular-a-fixed.webp",
  "scene-assets/forest-pine-irregular-b.webp": "scene-assets/forest-pine-irregular-b-fixed.webp",
  "scene-assets/grand-piano.webp": "scene-assets/grand-piano-fixed.webp",
  "scene-assets/grandfather-clock-oak-topdown-v1.webp": "scene-assets/grandfather-clock-oak-topdown-bastion-v1.webp",
  "scene-assets/grandfather-clock-mechanical-topdown-v1.webp": "scene-assets/grandfather-clock-mechanical-topdown-bastion-v1.webp",
  "scene-assets/grandfather-clock-oak-topdown-v2.webp": "scene-assets/grandfather-clock-oak-topdown-bastion-v2.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v2.webp": "scene-assets/grandfather-clock-mahogany-topdown-bastion-v2.webp",
  "scene-assets/grandfather-clock-oak-topdown-v3.webp": "scene-assets/grandfather-clock-oak-topdown-bastion-v3.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v3.webp": "scene-assets/grandfather-clock-mahogany-topdown-bastion-v3.webp",
  "scene-assets/grandfather-clock-oak-topdown-v4.webp": "scene-assets/grandfather-clock-oak-topdown-bastion-v4.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v4.webp": "scene-assets/grandfather-clock-mahogany-topdown-bastion-v4.webp",
  "scene-assets/harp-topdown-v2.webp": "scene-assets/harp-topdown-v2-fixed.webp",
  "scene-assets/hay-cluster.webp": "scene-assets/hay-cluster-fixed.webp",
  "scene-assets/hay-pile.webp": "scene-assets/hay-pile-fixed.webp",
  "scene-assets/hay-windrow.webp": "scene-assets/hay-windrow-fixed.webp",
  "scene-assets/feeding-trough-topdown-v1.webp": "scene-assets/feeding-trough-topdown-v1-bastion-v2.webp",
  "scene-assets/hay-scatter-topdown-v1.webp": "scene-assets/hay-scatter-topdown-v1-bastion-v2.webp",
  "scene-assets/hay-bale-rectangular-topdown-v1.webp": "scene-assets/hay-bale-rectangular-topdown-v1-bastion-v2.webp",
  "scene-assets/painting-landscape-topdown-v2.webp": "scene-assets/painting-landscape-topdown-v2-fixed.webp",
  "scene-assets/mirror-wall-square-topdown-v3.webp": "scene-assets/mirror-wall-square-topdown-v3-bastion-v1.webp",
  "scene-assets/mirror-wall-rectangular-2-topdown-v3.webp": "scene-assets/mirror-wall-rectangular-2-topdown-v3-bastion-v1.webp",
  "scene-assets/mirror-wall-round-topdown-v3.webp": "scene-assets/mirror-wall-round-topdown-v3-bastion-v1.webp",
  "scene-assets/mirror-wall-oval-2-topdown-v3.webp": "scene-assets/mirror-wall-oval-2-topdown-v3-bastion-v1.webp",
  "scene-assets/mirror-wall-wide-topdown-v1.webp": "scene-assets/mirror-wall-wide-topdown-v1-bastion-v1.webp",
  "scene-assets/painting-portrait-topdown-v2.webp": "scene-assets/painting-portrait-topdown-v2-fixed.webp",
  "scene-assets/painting-still-life-topdown-v2.webp": "scene-assets/painting-still-life-topdown-v2-fixed.webp",
  "scene-assets/piano.webp": "scene-assets/piano-fixed.webp",
  "scene-assets/potted-flowers-v2.webp": "scene-assets/potted-flowers-v2-fixed.webp",
  "scene-assets/potted-herbs-v2.webp": "scene-assets/potted-herbs-v2-fixed.webp",
  "scene-assets/potted-tree-v2.webp": "scene-assets/potted-tree-v2-fixed.webp",
  "scene-assets/stairs-wood-square.webp": "scene-assets/stairs-wood-square-fixed.webp",
  "scene-assets/stool-v2.webp": "scene-assets/stool-v2-fixed.webp",
  "scene-assets/table.webp": "scene-assets/table-fixed.webp",
  "scene-assets/tableware-empty.webp": "scene-assets/tableware-empty-fixed.webp",
  "scene-assets/tableware-tea.webp": "scene-assets/tableware-tea-fixed.webp",
  "scene-assets/printing-press-topdown-v1.webp": "scene-assets/printing-press-topdown-bastion-v1.webp",
  "scene-assets/floor-loom-topdown-v1.webp": "scene-assets/floor-loom-topdown-bastion-v1.webp",
  "scene-assets/woodworking-circular-saw-bench-topdown-v1.webp": "scene-assets/woodworking-circular-saw-bench-topdown-bastion-v1.webp",
  "scene-floors/garden-crop-carrot-v2.webp": "scene-floors/garden-crop-carrot-v2-fixed.webp",
  "scene-floors/garden-crop-rice-v2.webp": "scene-floors/garden-crop-rice-v2-fixed.webp",
  "scene-walls/border-curtain-gold.webp": "scene-walls/border-curtain-gold-fixed.webp",
  "scene-walls/brick-grey-dense.webp": "scene-walls/brick-grey-dense-fixed.webp",
  "scene-walls/brick-red.webp": "scene-walls/brick-red-fixed.webp",
  "scene-walls/cliff-sandy-v2.webp": "scene-walls/cliff-sandy-v2-fixed.webp",
  "scene-walls/cliff-limestone-v2.webp": "scene-walls/cliff-limestone-fixed-v2.webp",
  ...BASTION_COMPLETE_TEXTURE_REDIRECTS,
  "scene-floors/crowd-poor-v1.webp": "scene-floors/crowd-poor-v1.webp",
  "scene-floors/crowd-laborers-v1.webp": "scene-floors/crowd-laborers-v1.webp",
  "scene-floors/crowd-merchants-v1.webp": "scene-floors/crowd-merchants-v1.webp",
  "scene-floors/crowd-artisans-v1.webp": "scene-floors/crowd-artisans-v1.webp",
  "scene-floors/crowd-middle-class-v1.webp": "scene-floors/crowd-middle-class-v1.webp",
  "scene-floors/crowd-aristocrats-v1.webp": "scene-floors/crowd-aristocrats-v1.webp",

  "scene-walls/wood-alder.png": "scene-walls/wood-alder-bastion-v3.png",
  "scene-walls/wood-nut.png": "scene-walls/wood-nut-bastion-v3.png",
  "scene-assets/sink-wood-topdown-v2.webp": "scene-assets/sink-wood-topdown-v3-bastion-v3.webp",
  "scene-assets/sink-stone-topdown-v2.webp": "scene-assets/sink-stone-topdown-v3-bastion-v3.webp",
  "scene-assets/sink-wood-topdown-v3.webp": "scene-assets/sink-wood-topdown-v3-bastion-v3.webp",
  "scene-assets/sink-stone-topdown-v3.webp": "scene-assets/sink-stone-topdown-v3-bastion-v3.webp",
});

const PRESET_TEXTURES = Object.freeze({
  [BASTION_TEXTURE_PRESET]: BASTION_TEXTURES,
});

const PRESET_TEXTURE_REDIRECTS = Object.freeze({
  [BASTION_TEXTURE_PRESET]: BASTION_TEXTURE_REDIRECTS,
});

const PRESET_TEXTURE_CANONICAL_PATHS = Object.freeze(Object.fromEntries(
  Object.entries(PRESET_TEXTURE_REDIRECTS).map(([preset, redirects]) => [
    preset,
    Object.freeze(Object.fromEntries(Object.entries(redirects).map(([base, corrected]) => [corrected, base]))),
  ]),
));

const LEGACY_PRESET_CANONICAL_PATHS = Object.freeze({
  "scene-assets/prison-stocks-topdown-v1.webp": "scene-assets/prison-stocks-topdown-v2.webp",
  "scene-assets/prison-wall-manacles-topdown-v1.webp": "scene-assets/prison-wall-manacles-topdown-v2.webp",
  "scene-assets/prison-ceiling-chain-topdown-v1.webp": "scene-assets/prison-ceiling-chain-topdown-v2.webp",
  "scene-assets/prison-iron-maiden-topdown-v1.webp": "scene-assets/prison-iron-maiden-topdown-v2.webp",
  "scene-floors/floor-ornament-geometric-v1.webp": "scene-floors/floor-ornament-geometric-v2.webp",
  "scene-floors/floor-ornament-knotwork-v1.webp": "scene-floors/floor-ornament-knotwork-v2.webp",
  "scene-floors/floor-ornament-diamond-v1.webp": "scene-floors/floor-ornament-diamond-v2.webp",
  "scene-assets/tabletop-dollhouse-open-square-v2.webp": "scene-assets/tabletop-dollhouse-open-square-v3.webp",
  "scene-assets/tabletop-dollhouse-closed-square-v2.webp": "scene-assets/tabletop-dollhouse-closed-square-v3.webp",
  "scene-assets/tabletop-dollhouse-manor-open-square-v2.webp": "scene-assets/tabletop-dollhouse-manor-open-square-v3.webp",
  "scene-assets/tabletop-dollhouse-gothic-castle-closed-square-v2.webp": "scene-assets/tabletop-dollhouse-gothic-castle-closed-square-v3.webp",
  "scene-assets/tabletop-dollhouse-castle-open-square-v2.webp": "scene-assets/tabletop-dollhouse-castle-open-square-v3.webp",
  "scene-assets/tabletop-dollhouse-open-square-v1.webp": "scene-assets/tabletop-dollhouse-open-square-v2.webp",
  "scene-assets/tabletop-dollhouse-closed-square-v1.webp": "scene-assets/tabletop-dollhouse-closed-square-v2.webp",
  "scene-assets/tabletop-dollhouse-manor-open-square-v1.webp": "scene-assets/tabletop-dollhouse-manor-open-square-v2.webp",
  "scene-assets/tabletop-dollhouse-gothic-castle-closed-square-v1.webp": "scene-assets/tabletop-dollhouse-gothic-castle-closed-square-v2.webp",
  "scene-assets/tabletop-dollhouse-castle-open-square-v1.webp": "scene-assets/tabletop-dollhouse-castle-open-square-v2.webp",
  "scene-walls/cliff-limestone.webp": "scene-walls/cliff-limestone-v2.webp",
  "scene-floors/cave-shadow-v1.svg": "scene-floors/cave-shadow-v2.svg",
  "scene-floors/cave-shadow-v1-bastion-v2.svg": "scene-floors/cave-shadow-v2.svg",
  "scene-assets/music-stand-empty-topdown-v1.webp": "scene-assets/music-stand-empty-topdown-v2.webp",
  "scene-assets/music-stand-sheet-music-topdown-v1.webp": "scene-assets/music-stand-sheet-music-topdown-v2.webp",
  "scene-assets/throne-bastion-v2.webp": "scene-assets/throne-topdown-v1.webp",
  "scene-assets/mirror-wall-square-topdown-v1-bastion-v1.webp": "scene-assets/mirror-wall-square-topdown-v3.webp",
  "scene-assets/mirror-wall-rectangular-2-topdown-v1-bastion-v1.webp": "scene-assets/mirror-wall-rectangular-2-topdown-v3.webp",
  "scene-assets/mirror-wall-round-topdown-v1-bastion-v1.webp": "scene-assets/mirror-wall-round-topdown-v3.webp",
  "scene-assets/mirror-wall-oval-2-topdown-v1-bastion-v1.webp": "scene-assets/mirror-wall-oval-2-topdown-v3.webp",
  "scene-assets/mirror-wall-square-topdown-v2-bastion-v1.webp": "scene-assets/mirror-wall-square-topdown-v3.webp",
  "scene-assets/mirror-wall-rectangular-2-topdown-v2-bastion-v1.webp": "scene-assets/mirror-wall-rectangular-2-topdown-v3.webp",
  "scene-assets/mirror-wall-round-topdown-v2-bastion-v1.webp": "scene-assets/mirror-wall-round-topdown-v3.webp",
  "scene-assets/mirror-wall-oval-2-topdown-v2-bastion-v1.webp": "scene-assets/mirror-wall-oval-2-topdown-v3.webp",
  "scene-assets/sink-wood-bastion-v2.webp": "scene-assets/sink-wood-topdown-v3.webp",
  "scene-assets/sink-stone-bastion-v2.webp": "scene-assets/sink-stone-topdown-v3.webp",
  "scene-assets/sink-wood-topdown-v2-bastion-v2.webp": "scene-assets/sink-wood-topdown-v3.webp",
  "scene-assets/sink-stone-topdown-v2-bastion-v2.webp": "scene-assets/sink-stone-topdown-v3.webp",
  "scene-assets/sink-wood-topdown-v2.webp": "scene-assets/sink-wood-topdown-v3.webp",
  "scene-assets/sink-stone-topdown-v2.webp": "scene-assets/sink-stone-topdown-v3.webp",
  "scene-assets/lake-bastion-v2.webp": "scene-assets/lake-v2.webp",
  "scene-assets/lake.webp": "scene-assets/lake-v2.webp",
  "scene-assets/pond-bastion-v2.webp": "scene-assets/pond-v2.webp",
  "scene-assets/pond.webp": "scene-assets/pond-v2.webp",
  "scene-assets/water-puddle-bastion-v2.webp": "scene-assets/water-puddle-v2.webp",
  "scene-assets/water-puddle.webp": "scene-assets/water-puddle-v2.webp",
  "scene-floors/grass-meadow-floor-bastion-v3.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v4.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v5.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v6.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v7.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v8.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-bastion-v9.webp": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-v2.png": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-meadow-floor-v3.webp": "scene-floors/grass-meadow-floor-v4.webp",
  "scene-floors/grass-scatter-flowers-v1.webp": "scene-floors/grass-flower-single-01-v3.webp",
  "scene-floors/grass-scatter-flowers-v2.webp": "scene-floors/grass-flower-single-01-v3.webp",
  "scene-floors/grass-scatter-flowers-bastion-v1.webp": "scene-floors/grass-flower-single-01-v3.webp",
  "scene-floors/grass-scatter-flowers-bastion-v2.webp": "scene-floors/grass-flower-single-01-v3.webp",
  "scene-floors/grass-scatter-stones-v1.webp": "scene-floors/rubble-cutout-stone-01-v16.webp",
  "scene-floors/grass-scatter-stones-v2.webp": "scene-floors/rubble-cutout-stone-01-v16.webp",
  "scene-floors/grass-scatter-stones-bastion-v1.webp": "scene-floors/rubble-cutout-stone-01-v16.webp",
  "scene-floors/grass-scatter-stones-bastion-v2.webp": "scene-floors/rubble-cutout-stone-01-v16.webp",
  "scene-floors/grass-scatter-dirt-v1.webp": "scene-assets/mud.webp",
  "scene-floors/grass-scatter-dirt-bastion-v1.webp": "scene-assets/mud.webp",
  ...numberedScatterLegacyCanonicalPaths("grass-flower-single", 12, 1, 3),
  ...numberedScatterLegacyCanonicalPaths("grass-flower-single", 12, 2, 3),
  ...retiredScatterAssetCanonicalPaths(
    "grass-flower-single",
    7,
    "scene-floors/grass-flower-single-08-v3.webp",
  ),
  ...retiredGrassStoneCanonicalPaths("grass-stone-single", 12),
  ...retiredGrassStoneCanonicalPaths("grass-stone-varied", 24),
  ...numberedScatterLegacyCanonicalPaths("sea-scatter-debris", 8, 1, 2),
  "scene-floors/path-cobblestone-floor.png": "scene-floors/path-cobblestone-floor-v3.webp",
  "scene-floors/path-cobblestone-floor-v2.png": "scene-floors/path-cobblestone-floor-v3.webp",
  "scene-floors/path-cobblestone-floor-bastion-v3.png": "scene-floors/path-cobblestone-floor-v3.webp",
  "scene-floors/path-dirt-floor.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/path-dirt-floor-v2.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/path-dirt-floor-dark-fantasy-v2.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/path-dirt-floor-dark-fantasy-v3.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/path-dirt-floor-dark-fantasy-v4.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/path-dirt-floor-dark-fantasy-v5.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/sea-deep-floor.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-v2.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-v3.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-v4.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-bastion-v2.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-bastion-v3.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-bastion-v4.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-deep-floor-bastion-v5.webp": "scene-floors/sea-deep-floor-v5.webp",
  "scene-floors/sea-shallow-floor.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-shallow-floor-v2.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-shallow-floor-v3.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-shallow-floor-bastion-v2.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-shallow-floor-bastion-v3.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-shallow-floor-bastion-v4.webp": "scene-floors/sea-shallow-floor-v4.webp",
  "scene-floors/sea-stormy-floor.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-v2.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-v3.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-v4.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-bastion-v2.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-bastion-v3.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-bastion-v4.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-floors/sea-stormy-floor-bastion-v5.webp": "scene-floors/sea-stormy-floor-v5.webp",
  "scene-assets/grandfather-clock-oak-topdown-v1.webp": "scene-assets/grandfather-clock-oak-topdown-v4.webp",
  "scene-assets/grandfather-clock-mechanical-topdown-v1.webp": "scene-assets/grandfather-clock-mahogany-topdown-v4.webp",
  "scene-assets/grandfather-clock-oak-topdown-v2.webp": "scene-assets/grandfather-clock-oak-topdown-v4.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v2.webp": "scene-assets/grandfather-clock-mahogany-topdown-v4.webp",
  "scene-assets/grandfather-clock-oak-topdown-v3.webp": "scene-assets/grandfather-clock-oak-topdown-v4.webp",
  "scene-assets/grandfather-clock-mahogany-topdown-v3.webp": "scene-assets/grandfather-clock-mahogany-topdown-v4.webp",
  "scene-assets/noble-table-walnut-rectangular-topdown-v1.webp": "scene-assets/noble-table-walnut-rectangular-topdown-v3.webp",
  "scene-assets/noble-table-walnut-rectangular-topdown-v2.webp": "scene-assets/noble-table-walnut-rectangular-topdown-v3.webp",
  "scene-assets/noble-table-burgundy-velvet-cloth-topdown-v1.webp": "scene-assets/noble-table-burgundy-velvet-cloth-topdown-v3.webp",
  "scene-assets/noble-table-burgundy-velvet-cloth-topdown-v2.webp": "scene-assets/noble-table-burgundy-velvet-cloth-topdown-v3.webp",
  "scene-walls/wood-alder-bastion-v2.png": "scene-walls/wood-alder.png",
  "scene-walls/wood-nut-bastion-v2.png": "scene-walls/wood-nut.png",
  "scene-assets/bookshelf.webp": "scene-assets/bookshelf-wall-topdown-v5.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v1.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v2.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v3.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v4.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v5.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v6.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v7.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v8.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v9.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-corner-wall-topdown-v10.webp": "scene-assets/bookshelf-corner-wall-topdown-v11.webp",
  "scene-assets/bookshelf-bastion-v2.webp": "scene-assets/bookshelf-wall-topdown-v5.webp",
  "scene-assets/bookshelf-wall-topdown-v4.webp": "scene-assets/bookshelf-wall-topdown-v5.webp",
  "scene-assets/bookshelf-narrow.webp": "scene-assets/bookshelf-narrow-wall-topdown-v5.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v2.webp": "scene-assets/bookshelf-narrow-wall-topdown-v5.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v3.webp": "scene-assets/bookshelf-narrow-wall-topdown-v5.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v4.webp": "scene-assets/bookshelf-narrow-wall-topdown-v5.webp",
  "scene-assets/cabinet.webp": "scene-assets/cabinet-wall-topdown-v4.webp",
  "scene-assets/cabinet-corner-wall-topdown-v1.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v2.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v3.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v4.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v5.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v6.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v7.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v8.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v9.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-corner-wall-topdown-v10.webp": "scene-assets/cabinet-corner-wall-topdown-v11.webp",
  "scene-assets/cabinet-bastion-v2.webp": "scene-assets/cabinet-wall-topdown-v4.webp",
  "scene-assets/cabinet-topdown-v2.webp": "scene-assets/cabinet-wall-topdown-v4.webp",
  "scene-assets/cabinet-wall-topdown-v3.webp": "scene-assets/cabinet-wall-topdown-v4.webp",
  "scene-assets/cabinet-narrow.webp": "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v2.webp": "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/cabinet-narrow-topdown-v3.png": "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v4.webp": "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v5.webp": "scene-assets/cabinet-narrow-wall-topdown-v6.webp",
  "scene-assets/column-stone-topdown-v1.png": "scene-assets/column-stone-topdown-v3.webp",
  "scene-assets/column-stone-topdown-v2.webp": "scene-assets/column-stone-topdown-v3.webp",
  "scene-assets/column-wood-topdown-v1.png": "scene-assets/column-wood-topdown-v3.webp",
  "scene-assets/column-wood-topdown-v2.webp": "scene-assets/column-wood-topdown-v3.webp",
  "scene-assets/fireplace-brick-v3.webp": "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-brick-v3-fixed.webp": "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-v3.webp": "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-v3-fixed.webp": "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/floor-lever-compact-topdown-v1.webp": "scene-assets/floor-lever-compact-front-v2.webp",
  "scene-assets/floor-lever-compact-topdown-v2.webp": "scene-assets/floor-lever-compact-front-v2.webp",
  "scene-assets/floor-lever-heavy-topdown-v1.webp": "scene-assets/floor-lever-heavy-front-v2.webp",
  "scene-assets/floor-lever-heavy-topdown-v2.webp": "scene-assets/floor-lever-heavy-front-v2.webp",
  "scene-assets/grand-piano.webp": "scene-assets/grand-piano-topdown-v2.webp",
  "scene-assets/grand-piano-fixed.webp": "scene-assets/grand-piano-topdown-v2.webp",
  "scene-assets/lectern.webp": "scene-assets/lectern-topdown-v3.webp",
  "scene-assets/lectern-bastion-v2.webp": "scene-assets/lectern-topdown-v3.webp",
  "scene-assets/lectern-topdown-v2.webp": "scene-assets/lectern-topdown-v3.webp",
  "scene-assets/pew.webp": "scene-assets/pew-topdown-v2.webp",
  "scene-assets/pew-bastion-v2.webp": "scene-assets/pew-topdown-v2.webp",
  "scene-assets/piano.webp": "scene-assets/piano-topdown-v2.webp",
  "scene-assets/piano-fixed.webp": "scene-assets/piano-topdown-v2.webp",
  "scene-assets/statue.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-bastion-v2.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-knight-topdown-v2.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-man-topdown-v1.webp": "scene-assets/statue-man-topdown-v2.webp",
  "scene-assets/statue-woman-topdown-v1.webp": "scene-assets/statue-woman-topdown-v2.webp",
  "scene-assets/statue-child-topdown-v1.webp": "scene-assets/statue-child-topdown-v2.webp",
  "scene-assets/wall-gear-large-topdown-v1.webp": "scene-assets/wall-gear-large-front-v2.webp",
  "scene-assets/wall-gear-large-topdown-v2.webp": "scene-assets/wall-gear-large-front-v2.webp",
  "scene-assets/wall-gear-large-topdown-v3.webp": "scene-assets/wall-gear-large-front-v2.webp",
  "scene-assets/wall-gear-small-topdown-v1.webp": "scene-assets/wall-gear-small-front-v2.webp",
  "scene-assets/wall-gear-small-topdown-v2.webp": "scene-assets/wall-gear-small-topdown-v4.webp",
  "scene-assets/wall-gear-small-topdown-v3.webp": "scene-assets/wall-gear-small-topdown-v4.webp",
  "scene-assets/wall-gears-cluster-topdown-v1.webp": "scene-assets/wall-gears-cluster-front-v2.webp",
  "scene-assets/wall-gears-cluster-topdown-v2.webp": "scene-assets/wall-gears-cluster-front-v2.webp",
  "scene-assets/wall-gears-cluster-topdown-v3.webp": "scene-assets/wall-gears-cluster-front-v2.webp",
  "scene-assets/wall-lever-brass-topdown-v1.webp": "scene-assets/wall-lever-brass-front-v2.webp",
  "scene-assets/wall-lever-brass-topdown-v2.webp": "scene-assets/wall-lever-brass-topdown-v4.webp",
  "scene-assets/wall-lever-iron-topdown-v1.webp": "scene-assets/wall-lever-iron-front-v2.webp",
  "scene-assets/wall-lever-iron-topdown-v2.webp": "scene-assets/wall-lever-iron-topdown-v4.webp",
  "scene-assets/wall-lever-brass-topdown-v3.webp": "scene-assets/wall-lever-brass-topdown-v4.webp",
  "scene-assets/wall-lever-iron-topdown-v3.webp": "scene-assets/wall-lever-iron-topdown-v4.webp",
  "scene-assets/cobweb-floor-above-v1.webp": "scene-floors/cobweb-patch-above-v1.webp",
  "scene-assets/cobweb-floor-below-v1.webp": "scene-floors/cobweb-patch-below-v1.webp",
  "scene-walls/border-green-fog.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-walls/border-green-fog-v2.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-walls/border-green-fog-v3.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-walls/border-green-fog-v4.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-walls/border-green-fog-v5.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-walls/border-green-fog-v6.webp": "scene-walls/border-green-fog-v7.webp",
  "scene-assets/weapon-rack-swords-topdown-v1.webp": "scene-assets/weapon-rack-swords-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-swords-open-standing-topdown-v3.webp": "scene-assets/weapon-rack-swords-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-spears-topdown-v1.webp": "scene-assets/weapon-rack-spears-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-spears-open-standing-topdown-v3.webp": "scene-assets/weapon-rack-spears-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-axes-topdown-v1.webp": "scene-assets/weapon-rack-axes-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-axes-open-standing-topdown-v3.webp": "scene-assets/weapon-rack-axes-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-bows-topdown-v1.webp": "scene-assets/weapon-rack-bows-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-bows-open-standing-topdown-v3.webp": "scene-assets/weapon-rack-bows-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-bow-open-standing-topdown-v4.webp": "scene-assets/weapon-rack-bow-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-crossbows-open-standing-topdown-v4.webp": "scene-assets/weapon-rack-crossbows-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-mixed-topdown-v1.webp": "scene-assets/weapon-rack-mixed-straight-standing-topdown-v5.webp",
  "scene-assets/weapon-rack-mixed-open-standing-topdown-v3.webp": "scene-assets/weapon-rack-mixed-straight-standing-topdown-v5.webp",
  "scene-assets/toilet-board-alder.webp": "scene-assets/toilet-board-alder-double-v4.webp",
  "scene-assets/toilet-board-alder-bastion-v2.webp": "scene-assets/toilet-board-alder-double-v4.webp",
  "scene-assets/toilet-board-alder-double-v3.webp": "scene-assets/toilet-board-alder-double-v4.webp",
  "scene-assets/toilet-board-alder-square-v2.webp": "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-alder-square-v3.webp": "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-oak.webp": "scene-assets/toilet-board-oak-double-v4.webp",
  "scene-assets/toilet-board-oak-bastion-v2.webp": "scene-assets/toilet-board-oak-double-v4.webp",
  "scene-assets/toilet-board-oak-double-v3.webp": "scene-assets/toilet-board-oak-double-v4.webp",
  "scene-assets/toilet-board-oak-square-v2.webp": "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-oak-square-v3.webp": "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-walnut.webp": "scene-assets/toilet-board-walnut-double-v4.webp",
  "scene-assets/toilet-board-walnut-bastion-v2.webp": "scene-assets/toilet-board-walnut-double-v4.webp",
  "scene-assets/toilet-board-walnut-double-v3.webp": "scene-assets/toilet-board-walnut-double-v4.webp",
  "scene-assets/toilet-board-walnut-square-v2.webp": "scene-assets/toilet-board-walnut-square-v4.webp",
  "scene-assets/toilet-board-walnut-square-v3.webp": "scene-assets/toilet-board-walnut-square-v4.webp",
});

// The removed preset is not selectable or loadable. This migration-only map
// lets already persisted scene paths fall back to their base logical assets.
const REMOVED_ENHANCED_BASE_PRESET = "enhanced-base";
const REMOVED_ENHANCED_BASE_OVERRIDES = Object.freeze({
  "scene-floors/brick-red-floor-enhanced-v2.png": "scene-floors/brick-red-floor.png",
  "scene-floors/cave-brown-floor-enhanced-v2.png": "scene-floors/cave-brown-floor.png",
  "scene-floors/flagstone-grey-floor-enhanced-v2.png": "scene-floors/flagstone-grey-floor.png",
  "scene-floors/path-dirt-floor-enhanced-v2.png": "scene-floors/path-dirt-floor-v3.webp",
  "scene-floors/swamp-floor-v1-enhanced-v2.png": "scene-floors/swamp-floor-v1.png",
});

function removedEnhancedBaseLogicalPath(relative) {
  return REMOVED_ENHANCED_BASE_OVERRIDES[relative]
    ?? relative.replace(/-base-refined-v1(?=\.[^/.]+$)/, "");
}

function currentBaseLogicalPath(relative) {
  let current = removedEnhancedBaseLogicalPath(relative);
  const visited = new Set();
  while (!visited.has(current)) {
    visited.add(current);
    const replacement = LEGACY_PRESET_CANONICAL_PATHS[current];
    if (!replacement || replacement === current) break;
    current = removedEnhancedBaseLogicalPath(replacement);
  }
  return current;
}

function sceneFlagValue(scene) {
  try {
    return scene?.getFlag?.(MODULE_ID, TEXTURE_PRESET_FLAG)
      ?? scene?.flags?.[MODULE_ID]?.[TEXTURE_PRESET_FLAG];
  } catch (_error) {
    return null;
  }
}

function hasChangedScenePreset(change) {
  const path = `flags.${MODULE_ID}.${TEXTURE_PRESET_FLAG}`;
  return foundry.utils.hasProperty(change, path) || Object.hasOwn(change ?? {}, path);
}

export function currentTexturePreset(scene = globalThis.canvas?.scene) {
  const preset = sceneFlagValue(scene);
  return TEXTURE_PRESETS[preset] ? preset : BASE_TEXTURE_PRESET;
}

export function baseTextureRelativePath(source) {
  if (typeof source !== "string" || !source.startsWith(MODULE_IMAGE_ROOT)) return null;
  const relative = source.slice(MODULE_IMAGE_ROOT.length).split(/[?#]/, 1)[0];
  if (!relative.startsWith("presets/")) {
    return currentBaseLogicalPath(relative);
  }
  const parts = relative.split("/");
  if (parts.length <= 2) return null;
  const preset = parts[1];
  const presetRelative = parts.slice(2).join("/");
  const canonical = preset === REMOVED_ENHANCED_BASE_PRESET
    ? removedEnhancedBaseLogicalPath(presetRelative)
    : PRESET_TEXTURE_CANONICAL_PATHS[preset]?.[presetRelative] ?? presetRelative;
  return currentBaseLogicalPath(
    LEGACY_PRESET_CANONICAL_PATHS[canonical]
      ?? LEGACY_PRESET_CANONICAL_PATHS[presetRelative]
      ?? canonical,
  );
}

export function baseTextureSource(source) {
  const relative = baseTextureRelativePath(source);
  return relative ? `${MODULE_IMAGE_ROOT}${relative}` : source;
}

export function resolvePresetTexture(source, preset = null, scene = globalThis.canvas?.scene) {
  const activePreset = TEXTURE_PRESETS[preset] ? preset : currentTexturePreset(scene);
  const relative = baseTextureRelativePath(source);
  if (!relative) return source;
  const supported = PRESET_TEXTURES[activePreset];
  if (!supported?.has(relative)) return `${MODULE_IMAGE_ROOT}${relative}`;
  const presetRelative = PRESET_TEXTURE_REDIRECTS[activePreset]?.[relative] ?? relative;
  return `${PRESET_IMAGE_ROOT}${activePreset}/${presetRelative}`;
}

export function presetTextureManifest(preset = currentTexturePreset()) {
  return [...new Set([...(PRESET_TEXTURES[preset] ?? [])].map(currentBaseLogicalPath))];
}

function getElement(root) {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if (root[0] instanceof HTMLElement) return root[0];
  return null;
}

function createScenePresetField(scene) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-group tsu-scene-texture-preset-field";

  const label = document.createElement("label");
  label.textContent = t("Settings.TexturePreset.Name", "Scene texture preset");

  const fields = document.createElement("div");
  fields.className = "form-fields";
  const select = document.createElement("select");
  select.name = `flags.${MODULE_ID}.${TEXTURE_PRESET_FLAG}`;
  const selectedPreset = currentTexturePreset(scene);
  for (const [key, preset] of Object.entries(TEXTURE_PRESETS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = t(preset.labelKey, preset.fallback);
    option.selected = key === selectedPreset;
    select.append(option);
  }
  fields.append(select);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = t("Settings.TexturePreset.Hint", "Selects a coordinated texture set for this scene only. Clients request only this scene's active set.");
  wrapper.append(label, fields, hint);
  return wrapper;
}

Hooks.on("renderSceneConfig", (app, element) => {
  const root = getElement(element);
  if (!root || root.querySelector(".tsu-scene-texture-preset-field")) return;
  const basicsTab = root.querySelector('.tab[data-tab="basics"]');
  if (!(basicsTab instanceof HTMLElement)) return;
  const field = createScenePresetField(app.document);
  const foregroundField = basicsTab.querySelector('file-picker[name="foreground"]')?.closest(".form-group");
  if (foregroundField instanceof HTMLElement) foregroundField.after(field);
  else basicsTab.append(field);
  app.setPosition?.({ height: "auto" });
});

Hooks.on("updateScene", (scene, change) => {
  if (!hasChangedScenePreset(change)) return;
  Hooks.callAll(TEXTURE_PRESET_CHANGE_HOOK, currentTexturePreset(scene), scene);
});

function legacyPresetValue(setting) {
  let value = setting?.value;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch (_error) { /* Stored strings need no decoding. */ }
  }
  return TEXTURE_PRESETS[value] ? value : BASE_TEXTURE_PRESET;
}

async function migrateLegacyWorldPreset() {
  if (!game.user?.isGM) return;
  const storage = game.settings.storage?.get?.("world");
  const legacy = storage?.get?.(`${MODULE_ID}.texturePreset`);
  if (!legacy) return;
  const preset = legacyPresetValue(legacy);
  const target = game.scenes?.find?.((scene) => scene.name === "Scene (2)") ?? globalThis.canvas?.scene;
  if (target && preset !== BASE_TEXTURE_PRESET && !sceneFlagValue(target)) {
    await target.setFlag(MODULE_ID, TEXTURE_PRESET_FLAG, preset);
  }
  try { await legacy.delete(); }
  catch (error) { console.warn(`${MODULE_ID} | Could not remove legacy world texture preset`, error); }
}

Hooks.once("ready", () => void migrateLegacyWorldPreset());
