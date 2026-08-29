"""Compose compact 3–4 bloom patches from the accepted single-flower sprites."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
SIZE = 128

# source index, centre x, centre y, rendered size, rotation degrees
PATTERNS = (
    ((1, 43, 51, 45, -18), (3, 76, 43, 40, 21), (7, 66, 78, 43, 8)),
    ((2, 46, 43, 42, 12), (8, 79, 53, 45, -24), (9, 50, 79, 40, 31)),
    ((4, 43, 58, 43, 16), (5, 72, 39, 39, -11), (11, 80, 75, 44, 22)),
    ((3, 39, 43, 38, -25), (6, 70, 42, 42, 15), (10, 51, 76, 44, 8), (12, 83, 76, 36, -18)),
    ((1, 50, 38, 41, 24), (7, 79, 55, 43, -8), (5, 44, 76, 39, -22), (9, 75, 82, 36, 17)),
    ((2, 40, 55, 38, -12), (4, 67, 38, 39, 27), (8, 85, 64, 42, 9), (11, 58, 81, 40, -20)),
)


def source(directory: Path, index: int, bastion: bool) -> Image.Image:
    suffix = "-bastion" if bastion else ""
    return Image.open(directory / f"grass-flower-single-{index:02d}{suffix}-v3.webp").convert("RGBA")


def compose(directory: Path, pattern: tuple[tuple[int, int, int, int, int], ...], bastion: bool) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for index, center_x, center_y, rendered_size, rotation in pattern:
        flower = source(directory, index, bastion)
        flower = flower.resize((rendered_size, rendered_size), Image.Resampling.LANCZOS)
        flower = flower.rotate(rotation, Image.Resampling.BICUBIC, expand=True)
        canvas.alpha_composite(flower, (round(center_x - flower.width / 2), round(center_y - flower.height / 2)))
    return canvas


def main() -> None:
    for index, pattern in enumerate(PATTERNS, start=1):
        base = compose(BASE, pattern, False)
        bastion = compose(BASTION, pattern, True)
        base_path = BASE / f"grass-flower-cluster-{index:02d}-v1.webp"
        bastion_path = BASTION / f"grass-flower-cluster-{index:02d}-bastion-v1.webp"
        base.save(base_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        bastion.save(bastion_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print(f"{base_path.relative_to(ROOT)} -> {bastion_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
