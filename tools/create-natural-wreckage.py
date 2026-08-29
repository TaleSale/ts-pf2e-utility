"""Extract and grade natural loose wreckage sprites for shallow and stormy sea."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, label


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
SIZE = 128
INNER = 118
SOURCES = (
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-34d2f97d-314d-4daf-b61f-de874378d27b.png"),
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-ca57dde4-783e-469d-a4bc-14e3052dedf7.png"),
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-66d23697-0a5a-4298-92f9-91dc0235eb6d.png"),
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-dfd5e765-d330-400b-8cd3-5253f357ceff.png"),
)


def water_colour(path: Path) -> np.ndarray:
    pixels = np.asarray(Image.open(path).convert("RGB").resize((64, 64)), dtype=np.float32)
    return pixels.mean(axis=(0, 1))


def extract(source: Path) -> Image.Image:
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.uint8)
    luminance = rgb[..., 0] * 0.21 + rgb[..., 1] * 0.72 + rgb[..., 2] * 0.07
    alpha = np.uint8(np.clip((238.0 - luminance) * 7.0, 0, 255))
    groups, count = label(alpha > 12)
    sizes = np.bincount(groups.ravel()) if count else np.zeros(1, dtype=int)
    keep = np.zeros_like(alpha, dtype=bool)
    for group in range(1, count + 1):
        if sizes[group] >= 350:
            keep |= groups == group
    alpha = np.where(keep, alpha, 0).astype(np.uint8)
    opaque = alpha > 220
    if not opaque.any():
        raise RuntimeError(f"No opaque wreckage pixels in {source}")
    _, indices = distance_transform_edt(~opaque, return_indices=True)
    clean_rgb = rgb[indices[0], indices[1]]
    points = np.argwhere(alpha > 8)
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0) + 1
    rgba = np.dstack((clean_rgb, alpha))[y0:y1, x0:x1]
    image = Image.fromarray(rgba, "RGBA")
    scale = min(INNER / image.width, INNER / image.height)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((SIZE - target[0]) // 2, (SIZE - target[1]) // 2))
    return canvas


def submerged(source: Image.Image, water: np.ndarray, strength: float, detail_scale: float, phase: float, lift: float) -> Image.Image:
    rgba = np.asarray(source, dtype=np.uint8).copy()
    visible = rgba[..., 3] > 0
    rgb = rgba[..., :3].astype(np.float32)
    luminance = rgb[..., 0] * 0.21 + rgb[..., 1] * 0.72 + rgb[..., 2] * 0.07
    centre = float(np.median(luminance[visible]))
    detail = np.clip((luminance - centre) * detail_scale, -32, 35)
    water_luminance = water[0] * 0.21 + water[1] * 0.72 + water[2] * 0.07
    timber_tint = water_luminance + (water - water_luminance) * 0.24
    mixed = rgb * (1.0 - strength) + timber_tint * strength
    mixed = mixed + detail[..., None] * 0.34
    yy, xx = np.indices(rgba.shape[:2], dtype=np.float32)
    wave = np.exp(-((np.sin(xx * 0.105 + yy * 0.045 + phase) - 0.84) / 0.18) ** 2)
    highlight = wave[..., None] * np.clip(water + 30.0, 0, 255) * 0.09
    graded = np.clip(mixed + highlight + lift, 0, 255)
    rgba[..., :3] = np.where(visible[..., None], graded, 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def save(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print(path.relative_to(ROOT))


def main() -> None:
    colours = {
        "base-shallow": water_colour(BASE / "sea-shallow-floor-v4.webp"),
        "base-storm": water_colour(BASE / "sea-stormy-floor-v5.webp"),
        "bastion-shallow": water_colour(BASTION / "sea-shallow-floor-bastion-v5.webp"),
        "bastion-storm": water_colour(BASTION / "sea-stormy-floor-bastion-v6.webp"),
    }
    for index, source_path in enumerate(SOURCES, start=1):
        source = extract(source_path)
        variants = (
            (BASE / f"sea-scatter-wreckage-{index:02d}-v1.webp", colours["base-shallow"], 0.30, 0.58, 22.0),
            (BASTION / f"sea-scatter-wreckage-{index:02d}-bastion-v1.webp", colours["bastion-shallow"], 0.36, 0.52, 24.0),
            (BASE / f"sea-scatter-wreckage-{index:02d}-v2.webp", colours["base-storm"], 0.44, 0.48, 30.0),
            (BASTION / f"sea-scatter-wreckage-{index:02d}-bastion-v2.webp", colours["bastion-storm"], 0.50, 0.44, 32.0),
        )
        alpha = source.getchannel("A")
        for path, colour, strength, detail_scale, lift in variants:
            result = submerged(source, colour, strength, detail_scale, index * 0.73, lift)
            result.putalpha(alpha)
            save(result, path)


if __name__ == "__main__":
    main()
