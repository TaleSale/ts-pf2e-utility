"""Split a clean scatter atlas into independent, preset-safe flower sprites."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, find_objects, label


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
COUNT = 12
OUTPUT_SIZE = 96
BASE_GRASS = np.array([90.0, 101.0, 34.0], dtype=np.float32)
BASTION_GRASS = np.array([54.0, 66.0, 44.0], dtype=np.float32)


def components(path: Path, dilation: int, minimum_area: int) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    rgba = np.asarray(image, dtype=np.uint8)
    visible = rgba[..., 3] >= 24
    groups, count = label(binary_dilation(visible, iterations=dilation))
    candidates: list[tuple[int, int, int, Image.Image]] = []
    for index, bounds in enumerate(find_objects(groups), start=1):
        if bounds is None:
            continue
        original_area = int((visible[bounds] & (groups[bounds] == index)).sum())
        if original_area < minimum_area:
            continue
        y, x = bounds
        padding = 3
        box = (
            max(0, x.start - padding), max(0, y.start - padding),
            min(image.width, x.stop + padding), min(image.height, y.stop + padding),
        )
        crop = image.crop(box)
        candidates.append((y.start, x.start, original_area, crop))
    candidates.sort(key=lambda item: (-item[2], item[0], item[1]))
    if len(candidates) < COUNT:
        raise RuntimeError(f"Expected at least {COUNT} objects in {path}, got {len(candidates)}")
    # Largest objects are the most readable after a 24-38 px map-scale render.
    return [item[3] for item in candidates[:COUNT]]


def fit_sprite(crop: Image.Image) -> Image.Image:
    bbox = crop.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Fully transparent scatter component")
    crop = crop.crop(bbox)
    inner = OUTPUT_SIZE - 16
    scale = min(inner / crop.width, inner / crop.height)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((OUTPUT_SIZE - resized.width) // 2, (OUTPUT_SIZE - resized.height) // 2))
    return canvas


def neutralize_purple_petals(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8).copy()
    rgb = rgba[..., :3].astype(np.float32)
    red, green, blue = (rgb[..., index] for index in range(3))
    purple = (rgba[..., 3] > 16) & (red > green * 1.08) & (blue > green * 0.90) & (red > 100)
    luminance = red * 0.30 + green * 0.58 + blue * 0.12
    rgb[purple, 0] = np.clip(luminance[purple] * 1.12, 0, 255)
    rgb[purple, 1] = np.clip(luminance[purple] * 1.02, 0, 255)
    rgb[purple, 2] = np.clip(luminance[purple] * 0.72, 0, 255)
    rgba[..., :3] = np.uint8(rgb)
    return Image.fromarray(rgba, "RGBA")


def terrain_blend(image: Image.Image, palette: np.ndarray, strength: float) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8).copy()
    rgb = rgba[..., :3].astype(np.float32)
    visible = rgba[..., 3] > 0
    rgb[visible] = rgb[visible] * (1.0 - strength) + palette * strength
    rgba[..., :3] = np.uint8(np.clip(rgb, 0, 255))
    return Image.fromarray(rgba, "RGBA")


def export(source: Path, dilation: int, minimum_area: int) -> None:
    prefix = "grass-flower-single"
    for index, crop in enumerate(components(source, dilation, minimum_area), start=1):
        if index == 7:
            continue
        base = fit_sprite(crop)
        base = neutralize_purple_petals(base)
        base = terrain_blend(base, BASE_GRASS, 0.46)
        preset = terrain_blend(base, BASTION_GRASS, 0.62)
        base_path = BASE / f"{prefix}-{index:02d}-v2.webp"
        preset_path = BASTION / f"{prefix}-{index:02d}-bastion-v2.webp"
        base.save(base_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        preset.save(preset_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print(f"{base_path.relative_to(ROOT)} -> {preset_path.relative_to(ROOT)}")


def main() -> None:
    export(BASE / "grass-scatter-flowers-v2.webp", dilation=5, minimum_area=150)


if __name__ == "__main__":
    main()
