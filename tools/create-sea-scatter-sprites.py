"""Extract paired debris and fish-shadow sprites from 4x2 ImageGen atlases."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "images" / "scene-floors"
BASTION_DIR = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
SIZE = 128
INNER = 112
COLS = 4
ROWS = 2
ATLASES = (
    (
        "sea-scatter-debris",
        Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-937cca80-dd1d-4c69-af3e-81977a0bc99a.png"),
        Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-dd788601-3835-4ca9-8363-1aead8cbf06d.png"),
    ),
    (
        "sea-scatter-fish-shadow",
        Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-9b0e4769-5393-4313-8a37-feb95b96b75d.png"),
        Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-7bac213e-6a64-411e-a24e-1ae2de965a33.png"),
    ),
)


def chroma_rgba(cell: Image.Image) -> np.ndarray:
    rgb = np.asarray(cell.convert("RGB"), dtype=np.float32)
    red, green, blue = (rgb[..., channel] for channel in range(3))
    magenta_strength = np.minimum(red - green, blue - green)
    alpha = np.clip(255.0 - magenta_strength * 1.16, 0, 255)
    alpha[(red > 220) & (blue > 205) & (green < 55)] = 0
    alpha[alpha < 8] = 0
    alpha[alpha > 246] = 255
    fraction = alpha[..., None] / 255.0
    key = np.array((255.0, 0.0, 255.0), dtype=np.float32)
    clean = np.where(
        fraction > 0.02,
        (rgb - key * (1.0 - fraction)) / np.maximum(fraction, 0.02),
        0,
    )
    return np.dstack((np.clip(clean, 0, 255), alpha)).astype(np.uint8)


def fit_pair(base_cell: Image.Image, bastion_cell: Image.Image) -> tuple[Image.Image, Image.Image]:
    base = chroma_rgba(base_cell)
    bastion = chroma_rgba(bastion_cell)
    groups, count = label(base[..., 3] > 8)
    if not count:
        raise RuntimeError("Atlas cell contains no visible object")
    sizes = np.bincount(groups.ravel())
    sizes[0] = 0
    keep = groups == int(sizes.argmax())
    base[..., 3] = np.where(keep, base[..., 3], 0)
    bastion[..., 3] = np.where(keep, bastion[..., 3], 0)

    points = np.argwhere(base[..., 3] > 8)
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0) + 1
    padding = 5
    y0, x0 = max(0, y0 - padding), max(0, x0 - padding)
    y1, x1 = min(base.shape[0], y1 + padding), min(base.shape[1], x1 + padding)
    base_image = Image.fromarray(base[y0:y1, x0:x1], "RGBA")
    bastion_image = Image.fromarray(bastion[y0:y1, x0:x1], "RGBA")
    scale = min(INNER / base_image.width, INNER / base_image.height)
    target = (max(1, round(base_image.width * scale)), max(1, round(base_image.height * scale)))
    base_image = base_image.resize(target, Image.Resampling.LANCZOS)
    bastion_image = bastion_image.resize(target, Image.Resampling.LANCZOS)
    bastion_image.putalpha(base_image.getchannel("A"))

    offset = ((SIZE - target[0]) // 2, (SIZE - target[1]) // 2)
    base_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bastion_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    base_canvas.alpha_composite(base_image, offset)
    bastion_canvas.alpha_composite(bastion_image, offset)
    return base_canvas, bastion_canvas


def tint_shadow(image: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8).copy()
    alpha = rgba[..., 3]
    source = rgba[..., :3].astype(np.float32)
    luminance = source[..., 0] * 0.21 + source[..., 1] * 0.72 + source[..., 2] * 0.07
    visible = alpha > 0
    level = np.clip(0.72 + (luminance - 45.0) / 255.0, 0.58, 1.08)
    colour = np.asarray(target, dtype=np.float32)
    graded = colour * level[..., None]
    rgba[..., :3] = np.where(visible[..., None], np.clip(graded, 0, 255), 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    for prefix, base_path, bastion_path in ATLASES:
        base_atlas = Image.open(base_path).convert("RGB")
        bastion_atlas = Image.open(bastion_path).convert("RGB")
        if base_atlas.size != bastion_atlas.size:
            raise RuntimeError(f"Atlas size mismatch for {prefix}")
        cell_width = base_atlas.width // COLS
        cell_height = base_atlas.height // ROWS
        for row in range(ROWS):
            for column in range(COLS):
                index = row * COLS + column + 1
                box = (column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height)
                base, bastion = fit_pair(base_atlas.crop(box), bastion_atlas.crop(box))
                if prefix.endswith("fish-shadow"):
                    base = tint_shadow(base, (26, 76, 82))
                    bastion = tint_shadow(bastion, (28, 43, 40))
                output = BASE_DIR / f"{prefix}-{index:02d}-v1.webp"
                preset = BASTION_DIR / f"{prefix}-{index:02d}-bastion-v1.webp"
                base.save(output, "WEBP", lossless=True, quality=100, method=6, exact=True)
                bastion.save(preset, "WEBP", lossless=True, quality=100, method=6, exact=True)
                print(f"{output.relative_to(ROOT)} -> {preset.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
