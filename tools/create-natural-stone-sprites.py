"""Extract matched 96px natural stone sprites from paired ImageGen atlases."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "images" / "scene-floors"
BASTION_DIR = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
BASE_ATLAS = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-8d8ff5e1-74b6-43c6-8f65-ad66368b5672.png")
BASTION_ATLAS = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-49a566db-4422-418a-8763-542f94c65384.png")
SIZE = 96
INNER = 82
COLS = 6
ROWS = 4


def chroma_rgba(cell: Image.Image) -> np.ndarray:
    rgb = np.asarray(cell.convert("RGB"), dtype=np.float32)
    red, green, blue = (rgb[..., channel] for channel in range(3))
    magenta_strength = np.minimum(red - green, blue - green)
    alpha = np.clip(255.0 - magenta_strength * 1.18, 0, 255)
    alpha[(red > 220) & (blue > 210) & (green < 45)] = 0
    alpha[alpha < 12] = 0
    alpha[alpha > 238] = 255

    fraction = alpha[..., None] / 255.0
    key = np.array((255.0, 0.0, 255.0), dtype=np.float32)
    clean = np.where(
        fraction > 0.03,
        (rgb - key * (1.0 - fraction)) / np.maximum(fraction, 0.03),
        0,
    )
    return np.dstack((np.clip(clean, 0, 255), alpha)).astype(np.uint8)


def fit_pair(base_cell: Image.Image, bastion_cell: Image.Image) -> tuple[Image.Image, Image.Image]:
    base = chroma_rgba(base_cell)
    bastion = chroma_rgba(bastion_cell)
    groups, count = label(base[..., 3] > 16)
    if count:
        sizes = np.bincount(groups.ravel())
        sizes[0] = 0
        keep = groups == int(sizes.argmax())
        base[..., 3] = np.where(keep, base[..., 3], 0)
        bastion[..., 3] = np.where(keep, bastion[..., 3], 0)
    points = np.argwhere(base[..., 3] > 16)
    if points.size == 0:
        raise RuntimeError("Atlas cell contains no stone")
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0) + 1
    padding = 4
    y0, x0 = max(0, y0 - padding), max(0, x0 - padding)
    y1, x1 = min(base.shape[0], y1 + padding), min(base.shape[1], x1 + padding)
    base_image = Image.fromarray(base[y0:y1, x0:x1], "RGBA")
    bastion_image = Image.fromarray(bastion[y0:y1, x0:x1], "RGBA")

    scale = min(INNER / base_image.width, INNER / base_image.height)
    target = (max(1, round(base_image.width * scale)), max(1, round(base_image.height * scale)))
    base_image = base_image.resize(target, Image.Resampling.LANCZOS)
    bastion_image = bastion_image.resize(target, Image.Resampling.LANCZOS)

    # Geometry must remain identical across presets. Bastion contributes RGB only.
    alpha = base_image.getchannel("A")
    bastion_image.putalpha(alpha)
    offset = ((SIZE - target[0]) // 2, (SIZE - target[1]) // 2)
    base_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bastion_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    base_canvas.alpha_composite(base_image, offset)
    bastion_canvas.alpha_composite(bastion_image, offset)
    return base_canvas, bastion_canvas


def main() -> None:
    base_atlas = Image.open(BASE_ATLAS).convert("RGB")
    bastion_atlas = Image.open(BASTION_ATLAS).convert("RGB")
    if base_atlas.size != bastion_atlas.size:
        raise RuntimeError(f"Atlas size mismatch: {base_atlas.size} != {bastion_atlas.size}")
    cell_width = base_atlas.width // COLS
    cell_height = base_atlas.height // ROWS
    if cell_width * COLS != base_atlas.width or cell_height * ROWS != base_atlas.height:
        raise RuntimeError(f"Atlas is not an exact {COLS}x{ROWS} grid: {base_atlas.size}")

    index = 0
    for row in range(ROWS):
        for column in range(COLS):
            index += 1
            box = (column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height)
            base, bastion = fit_pair(base_atlas.crop(box), bastion_atlas.crop(box))
            base_path = BASE_DIR / f"grass-stone-varied-{index:02d}-v3.webp"
            bastion_path = BASTION_DIR / f"grass-stone-varied-{index:02d}-bastion-v3.webp"
            base.save(base_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            bastion.save(bastion_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            print(f"{base_path.relative_to(ROOT)} -> {bastion_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
