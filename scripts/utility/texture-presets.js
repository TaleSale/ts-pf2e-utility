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
    "bookshelf.webp", "books-scrolls.webp", "brazier.webp", "bridge.webp", "broken-boards.webp",
    "bush.webp", "cabinet.webp", "campfire-embers.webp", "campfire-stones.webp", "candle.webp",
    "cauldron.webp", "chest.webp", "corpse.webp", "crate.webp", "dead-tree.webp", "desk.webp",
    "dock-corner.webp", "dock-straight.webp", "double-bed-linen.webp", "double-bed-red.webp",
    "fallen-column.webp", "footprints.webp", "fountain.webp", "gold-pile.webp", "ladder.webp",
    "ladder-vertical.webp", "lake.webp", "lantern.webp", "lectern.webp", "logs.webp",
    "long-table.webp", "mooring-posts.webp", "mud.webp", "pew.webp", "pine-tree.webp", "pond.webp",
    "ritual-circle.webp", "rocks.webp", "round-table-four-legs.webp", "rowboat.webp", "rug-red.webp",
    "ruins.webp", "sacks.webp", "short-stairs-down.webp", "short-stairs-up.webp", "sink-stone.webp",
    "sink-wood.webp", "skeleton.webp", "stairs-down.webp", "stairs-stone-square.webp", "stairs-up.webp",
    "stairs-wood-rustic.webp", "stairs-wood-straight.webp", "standing-column.webp",
    "standing-stone-broad.webp", "standing-stone-crooked.webp", "standing-stone-narrow.webp",
    "statue.webp", "stonehenge-circle.webp", "stonehenge-fangs.webp",
    "stonehenge-trilithon-circle-v2.webp", "stump.webp", "tableware-ale.webp",
    "tableware-breakfast.webp", "tableware-cheese-fruit.webp", "tableware-feast-v2.webp",
    "tableware-fish.webp", "tableware-roast.webp", "tableware-stew.webp", "tableware-wine.webp",
    "throne.webp", "toilet-board-alder.webp", "toilet-board-oak.webp", "toilet-board-walnut.webp",
    "torch.webp", "trapdoor.webp", "tree.webp", "tub.webp", "wall-torch-bracket.webp",
    "wall-torch-iron.webp", "water-puddle.webp", "well.webp",
  ]),
  "scene-floors": Object.freeze([
    "carpet-blue-ornate-floor-v2.webp", "carpet-green-gold-floor.webp", "carpet-red-ornate-floor.webp",
    "rubble-stone-piece-a-v6.webp", "rubble-stone-piece-b-v6.webp", "rubble-stone-piece-c-v6.webp",
    "rubble-board-piece-a-v6.webp",
    "rubble-brick-grey-piece-a-v6.webp", "rubble-brick-grey-piece-b-v6.webp", "rubble-brick-grey-piece-c-v6.webp",
    "rubble-brick-red-piece-a-v6.webp", "rubble-brick-red-piece-b-v6.webp", "rubble-brick-red-piece-c-v6.webp",
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
    "sea-deep-floor.webp", "sea-shallow-floor.webp", "sea-stormy-floor.webp", "stairs-brick-red.png",
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

// Complete registered texture coverage for the Bastion of Blasphemy preset.
// A path is redirected only when its alternate file is present in this
// manifest, so clients request one active variant instead of every preset.
const BASTION_TEXTURES = new Set([
  "scene-assets/armchair-burgundy-topdown-v1.webp",
  "scene-assets/armchair-green-topdown-v1.webp",
  "scene-assets/bar-counter-corner.webp",
  "scene-assets/bar-counter-straight.webp",
  "scene-assets/barrels-side-cluster.webp",
  "scene-assets/beehive-skep-topdown-v1.webp",
  "scene-assets/carriage-closed-topdown-v1.webp",
  "scene-assets/carriage-open-topdown-v1.webp",
  "scene-assets/carriage-stagecoach-topdown-v1.webp",
  "scene-assets/cart-utility-topdown-v1.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v3.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v4.webp",
  "scene-assets/bookshelf-wall-topdown-v4.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v2.webp",
  "scene-assets/cabinet-narrow-topdown-v3.png",
  "scene-assets/cabinet-narrow-wall-topdown-v4.webp",
  "scene-assets/cabinet-topdown-v2.webp",
  "scene-assets/cabinet-wall-topdown-v3.webp",
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
  "scene-assets/grand-piano.webp",
  "scene-assets/harp-topdown-v2.webp",
  "scene-assets/hay-cluster.webp",
  "scene-assets/hay-pile.webp",
  "scene-assets/hay-windrow.webp",
  "scene-assets/painting-landscape-topdown-v2.webp",
  "scene-assets/painting-portrait-topdown-v2.webp",
  "scene-assets/painting-still-life-topdown-v2.webp",
  "scene-assets/piano.webp",
  "scene-assets/potted-flowers-v2.webp",
  "scene-assets/potted-herbs-v2.webp",
  "scene-assets/potted-tree-v2.webp",
  "scene-assets/sofa-burgundy-topdown-v1.webp",
  "scene-assets/sofa-green-topdown-v1.webp",
  "scene-assets/stairs-wood-square.webp",
  "scene-assets/statue-child-topdown-v2.webp",
  "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-man-topdown-v2.webp",
  "scene-assets/statue-woman-topdown-v2.webp",
  "scene-assets/stool-v2.webp",
  "scene-assets/table.webp",
  "scene-assets/tabletop-set-alchemy-v1.webp",
  "scene-assets/tabletop-set-arcane-v1.webp",
  "scene-assets/tabletop-set-books-v1.webp",
  "scene-assets/tabletop-set-cartography-v1.webp",
  "scene-assets/tabletop-set-jewelry-v1.webp",
  "scene-assets/tabletop-set-medicine-v1.webp",
  "scene-assets/tabletop-set-metalworking-v1.webp",
  "scene-assets/tabletop-set-torture-v1.webp",
  "scene-assets/tabletop-set-woodworking-v1.webp",
  "scene-assets/tabletop-set-writing-v1.webp",
  "scene-assets/tableware-empty.webp",
  "scene-assets/tableware-tea.webp",
  "scene-assets/toilet-board-alder-square-v2.webp",
  "scene-assets/toilet-board-alder-square-v3.webp",
  "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-alder-double-v3.webp",
  "scene-assets/toilet-board-oak-square-v2.webp",
  "scene-assets/toilet-board-oak-square-v3.webp",
  "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-oak-double-v3.webp",
  "scene-assets/toilet-board-walnut-square-v2.webp",
  "scene-assets/toilet-board-walnut-square-v3.webp",
  "scene-assets/toilet-board-walnut-square-v4.webp",
  "scene-assets/toilet-board-walnut-double-v3.webp",
  "scene-assets/wagon-covered-topdown-v1.webp",
  "scene-assets/wagon-freight-topdown-v1.webp",
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
  "scene-floors/cave-brown-floor.png",
  "scene-floors/cave-grey-pebbles-floor-v2.webp",
  "scene-floors/flagstone-grey-floor.png",
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
  "scene-floors/grass-meadow-floor.png",
  "scene-floors/swamp-floor-v1.png",
  "scene-floors/flowering-shrubs-dense-floor-v1.webp",
  "scene-floors/path-cobblestone-floor.png",
  "scene-floors/path-dirt-floor.png",
  "scene-floors/roof-shingles-floor.webp",
  "scene-floors/roof-thatch-floor.webp",
  "scene-floors/roof-tiles-floor.webp",
  "scene-floors/uneven-limestone-floor.png",
  "scene-floors/wood-alder-floor.png",
  "scene-floors/wood-outdoor-brown-v3.png",
  "scene-floors/wood-walnut-floor.png",
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
  "scene-walls/cliff-limestone.webp",
  "scene-walls/cliff-sandy-v2.webp",
  "scene-walls/hedge-maze.webp",
  "scene-walls/window-stained.webp",
  ...Object.keys(BASTION_COMPLETE_TEXTURE_REDIRECTS),
]);

// Image generation can leave a light matte in RGB pixels underneath a valid
// alpha mask. These corrected siblings preserve the original dimensions and
// alpha channel while replacing only that matte-contaminated colour data.
const BASTION_TEXTURE_REDIRECTS = Object.freeze({
  "scene-floors/grass-meadow-floor.png": "scene-floors/grass-meadow-floor-bastion-v7.png",
  "scene-floors/swamp-floor-v1.png": "scene-floors/swamp-floor-bastion-v1.png",
  "scene-floors/path-dirt-floor.png": "scene-floors/path-dirt-floor-dark-fantasy-v4.png",
  "scene-assets/bar-counter-corner.webp": "scene-assets/bar-counter-corner-fixed.webp",
  "scene-assets/bar-counter-straight.webp": "scene-assets/bar-counter-straight-fixed.webp",
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
  "scene-assets/harp-topdown-v2.webp": "scene-assets/harp-topdown-v2-fixed.webp",
  "scene-assets/hay-cluster.webp": "scene-assets/hay-cluster-fixed.webp",
  "scene-assets/hay-pile.webp": "scene-assets/hay-pile-fixed.webp",
  "scene-assets/hay-windrow.webp": "scene-assets/hay-windrow-fixed.webp",
  "scene-assets/painting-landscape-topdown-v2.webp": "scene-assets/painting-landscape-topdown-v2-fixed.webp",
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
  "scene-floors/garden-crop-carrot-v2.webp": "scene-floors/garden-crop-carrot-v2-fixed.webp",
  "scene-floors/garden-crop-rice-v2.webp": "scene-floors/garden-crop-rice-v2-fixed.webp",
  "scene-walls/border-curtain-gold.webp": "scene-walls/border-curtain-gold-fixed.webp",
  "scene-walls/brick-grey-dense.webp": "scene-walls/brick-grey-dense-fixed.webp",
  "scene-walls/brick-red.webp": "scene-walls/brick-red-fixed.webp",
  "scene-walls/cliff-sandy-v2.webp": "scene-walls/cliff-sandy-v2-fixed.webp",
  ...BASTION_COMPLETE_TEXTURE_REDIRECTS,
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
  "scene-floors/path-dirt-floor-dark-fantasy-v2.png": "scene-floors/path-dirt-floor.png",
  "scene-floors/path-dirt-floor-dark-fantasy-v3.png": "scene-floors/path-dirt-floor.png",
  "scene-assets/bookshelf.webp": "scene-assets/bookshelf-wall-topdown-v4.webp",
  "scene-assets/bookshelf-bastion-v2.webp": "scene-assets/bookshelf-wall-topdown-v4.webp",
  "scene-assets/bookshelf-narrow.webp": "scene-assets/bookshelf-narrow-wall-topdown-v4.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v2.webp": "scene-assets/bookshelf-narrow-wall-topdown-v4.webp",
  "scene-assets/bookshelf-narrow-wall-topdown-v3.webp": "scene-assets/bookshelf-narrow-wall-topdown-v4.webp",
  "scene-assets/cabinet.webp": "scene-assets/cabinet-wall-topdown-v3.webp",
  "scene-assets/cabinet-bastion-v2.webp": "scene-assets/cabinet-wall-topdown-v3.webp",
  "scene-assets/cabinet-topdown-v2.webp": "scene-assets/cabinet-wall-topdown-v3.webp",
  "scene-assets/cabinet-narrow.webp": "scene-assets/cabinet-narrow-wall-topdown-v4.webp",
  "scene-assets/cabinet-narrow-wall-topdown-v2.webp": "scene-assets/cabinet-narrow-wall-topdown-v4.webp",
  "scene-assets/cabinet-narrow-topdown-v3.png": "scene-assets/cabinet-narrow-wall-topdown-v4.webp",
  "scene-assets/column-stone-topdown-v1.png": "scene-assets/column-stone-topdown-v3.webp",
  "scene-assets/column-stone-topdown-v2.webp": "scene-assets/column-stone-topdown-v3.webp",
  "scene-assets/column-wood-topdown-v1.png": "scene-assets/column-wood-topdown-v3.webp",
  "scene-assets/column-wood-topdown-v2.webp": "scene-assets/column-wood-topdown-v3.webp",
  "scene-assets/fireplace-brick-v3.webp": "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-brick-v3-fixed.webp": "scene-assets/fireplace-brick-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-v3.webp": "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/fireplace-stone-v3-fixed.webp": "scene-assets/fireplace-stone-wall-topdown-v4.webp",
  "scene-assets/statue.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-bastion-v2.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-knight-topdown-v2.webp": "scene-assets/statue-knight-topdown-v3.webp",
  "scene-assets/statue-man-topdown-v1.webp": "scene-assets/statue-man-topdown-v2.webp",
  "scene-assets/statue-woman-topdown-v1.webp": "scene-assets/statue-woman-topdown-v2.webp",
  "scene-assets/statue-child-topdown-v1.webp": "scene-assets/statue-child-topdown-v2.webp",
  "scene-assets/toilet-board-alder.webp": "scene-assets/toilet-board-alder-double-v3.webp",
  "scene-assets/toilet-board-alder-bastion-v2.webp": "scene-assets/toilet-board-alder-double-v3.webp",
  "scene-assets/toilet-board-alder-square-v2.webp": "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-alder-square-v3.webp": "scene-assets/toilet-board-alder-square-v4.webp",
  "scene-assets/toilet-board-oak.webp": "scene-assets/toilet-board-oak-double-v3.webp",
  "scene-assets/toilet-board-oak-bastion-v2.webp": "scene-assets/toilet-board-oak-double-v3.webp",
  "scene-assets/toilet-board-oak-square-v2.webp": "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-oak-square-v3.webp": "scene-assets/toilet-board-oak-square-v4.webp",
  "scene-assets/toilet-board-walnut.webp": "scene-assets/toilet-board-walnut-double-v3.webp",
  "scene-assets/toilet-board-walnut-bastion-v2.webp": "scene-assets/toilet-board-walnut-double-v3.webp",
  "scene-assets/toilet-board-walnut-square-v2.webp": "scene-assets/toilet-board-walnut-square-v4.webp",
  "scene-assets/toilet-board-walnut-square-v3.webp": "scene-assets/toilet-board-walnut-square-v4.webp",
});

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
  if (!relative.startsWith("presets/")) return relative;
  const parts = relative.split("/");
  if (parts.length <= 2) return null;
  const preset = parts[1];
  const presetRelative = parts.slice(2).join("/");
  const canonical = PRESET_TEXTURE_CANONICAL_PATHS[preset]?.[presetRelative] ?? presetRelative;
  return LEGACY_PRESET_CANONICAL_PATHS[canonical]
    ?? LEGACY_PRESET_CANONICAL_PATHS[presetRelative]
    ?? canonical;
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
  return [...(PRESET_TEXTURES[preset] ?? [])];
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
