"""Create square corner furniture variants from the accepted corner silhouettes.

The corner files already contain the correct two-sided frame, hardware, and
alpha. Only their broad inner panel is retextured here so it follows the
diagonal turn while retaining the exact material of each scene preset.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PANEL_BOX = (148, 66, 856, 806)
DIAGONAL_SLOPE = 0.78

ASSETS = (
    (
        "cabinet-corner-wall-topdown-v2.webp",
        "cabinet-corner-wall-topdown-v11.webp",
        "cabinet-wall-topdown-v4.webp",
        (180, 38, 844, 163),
    ),
    (
        "bookshelf-corner-wall-topdown-v2.webp",
        "bookshelf-corner-wall-topdown-v11.webp",
        "bookshelf-wall-topdown-v5.webp",
        (180, 25, 844, 185),
    ),
)

TREES = (
    ROOT / "images" / "scene-assets",
    ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-assets",
)


def reflected_tile(source: Image.Image) -> Image.Image:
    """Build a large reflected tile so the diagonal remap has no hard edges."""
    source = source.convert("RGBA")
    tile = Image.new("RGBA", (source.width * 3, source.height * 3))
    horizontal = ImageOps.mirror(source)
    vertical = ImageOps.flip(source)
    both = ImageOps.flip(horizontal)
    for row, images in enumerate(((both, vertical, both), (horizontal, source, horizontal), (both, vertical, both))):
        for column, image in enumerate(images):
            tile.alpha_composite(image, (column * source.width, row * source.height))
    return tile


def diagonal_panel(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Shear the accepted panel texture so its grain runs into the corner."""
    source = source.convert("RGBA")
    tile = reflected_tile(source)
    width, height = size
    offset_y = source.height + DIAGONAL_SLOPE * source.width / 2
    # The inverse mapping makes horizontal boards run down and to the right.
    result = tile.transform(
        size,
        Image.Transform.AFFINE,
        (1, 0, source.width, -DIAGONAL_SLOPE, 1, offset_y),
        resample=Image.Resampling.BICUBIC,
    )
    return ImageEnhance.Contrast(result).enhance(1.025).filter(
        ImageFilter.UnsharpMask(radius=0.65, percent=24, threshold=3)
    )


def generate(source_path: Path, straight_path: Path, wood_box: tuple[int, int, int, int], output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    straight = Image.open(straight_path).convert("RGBA")
    left, top = PANEL_BOX[:2]
    panel = source.crop(PANEL_BOX)
    wood = straight.crop(wood_box).resize(panel.size, Image.Resampling.LANCZOS).convert("RGBA")
    panel_result = diagonal_panel(wood, panel.size)
    source.paste(panel_result, (left, top), Image.new("L", panel.size, 255))

    visible = Image.new("L", source.size)
    ImageDraw.Draw(visible).polygon(
        [(0, 0), (left + round(panel.width * 0.50), 0),
         (source.width - 1, top + round(panel.height * 0.48)),
         (source.width - 1, source.height - 1), (0, source.height - 1)],
        fill=255,
    )
    source.putalpha(ImageChops.multiply(source.getchannel("A"), visible))
    source.save(output_path, "WEBP", quality=93, method=6, exact=True)

    with Image.open(output_path) as check:
        if check.size != (1024, 1024) or check.mode not in ("RGB", "RGBA"):
            raise RuntimeError(f"Unexpected output format: {output_path}")


def main() -> None:
    for tree in TREES:
        for old_name, new_name, straight_name, wood_box in ASSETS:
            source = tree / old_name
            straight = tree / straight_name
            output = tree / new_name
            if not source.exists() or not straight.exists():
                raise FileNotFoundError(source if not source.exists() else straight)
            generate(source, straight, wood_box, output)
            print(f"{output}: 1024x1024")


if __name__ == "__main__":
    main()
