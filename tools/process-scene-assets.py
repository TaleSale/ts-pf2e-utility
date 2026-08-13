"""Crop generated alpha PNGs and export optimized scene-asset WebP files."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "scene-assets"
OUTPUT = ROOT / "images" / "scene-assets"
SIZES = {
    "table": 1024,
    "chair": 512,
    "bed": 1024,
    "cabinet": 1024,
    "tree": 1536,
    "forest-pine-irregular-a": 384,
    "forest-pine-irregular-b": 384,
    "forest-deciduous-irregular-a": 384,
    "forest-deciduous-irregular-b": 384,
    "ruins": 1536,
    "corpse": 1024,
    "blood": 1024,
    "torch": 512,
    "brazier": 1024,
    "round-table": 1024,
    "chest": 1024,
    "bookshelf": 1024,
    "barrel": 768,
    "crate": 768,
    "sacks": 1024,
    "tub": 1024,
    "cauldron": 768,
    "candle": 512,
    "lantern": 512,
    "pine-tree": 1536,
    "dead-tree": 1536,
    "bush": 1024,
    "stump": 768,
    "rocks": 1024,
    "logs": 1024,
    "bridge": 1536,
    "well": 1536,
    "pond": 1536,
    "lake": 1536,
    "broken-boards": 1024,
    "fallen-column": 1024,
    "skeleton": 1024,
    "rug-red": 1024,
    "books-scrolls": 768,
    "gold-pile": 1024,
    "mud": 1024,
    "water-puddle": 1024,
    "ash": 1024,
    "footprints": 1024,
    "long-table": 1024,
    "banquet-table": 1024,
    "pew": 1024,
    "desk": 1024,
    "throne": 1024,
    "altar": 1024,
    "lectern": 768,
    "statue": 1024,
    "standing-column": 1024,
    "ritual-circle": 1024,
    "ladder": 1024,
    "ladder-vertical": 1024,
    "trapdoor": 768,
    "stairs-up": 1024,
    "stairs-down": 1024,
    "short-stairs-up": 1024,
    "short-stairs-down": 1024,
    "dock-straight": 1536,
    "dock-corner": 1536,
    "rowboat": 1536,
    "fountain": 1024,
    "mooring-posts": 768,
    "piano": 1024,
    "grand-piano": 1024,
    "drums": 1024,
}


def process(name: str, maximum: int) -> None:
    image = Image.open(SOURCE / f"{name}-alpha.png").convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"{name}: no visible pixels")
    image = image.crop(bounds)
    padding = max(8, round(max(image.size) * 0.035))
    padded = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
    padded.alpha_composite(image, (padding, padding))
    if max(padded.size) > maximum:
        ratio = maximum / max(padded.size)
        padded = padded.resize((round(padded.width * ratio), round(padded.height * ratio)), Image.Resampling.LANCZOS)
    padded.save(OUTPUT / f"{name}.webp", "WEBP", lossless=False, quality=90, method=6, exact=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
for asset_name, max_size in SIZES.items():
    target = OUTPUT / f"{asset_name}.webp"
    if not target.exists():
        process(asset_name, max_size)
