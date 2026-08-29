"""Create depth-specific debris and whirlpool palette variants."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"


def mean_colour(path: Path) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert("RGB").resize((64, 64)), dtype=np.float32)
    return rgb.mean(axis=(0, 1))


def underwater(image: Image.Image, water: np.ndarray, strength: float, contrast: float) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    visible = rgba[..., 3] > 0
    rgb = rgba[..., :3].astype(np.float32)
    luminance = rgb[..., 0] * 0.21 + rgb[..., 1] * 0.72 + rgb[..., 2] * 0.07
    centre = float(np.median(luminance[visible]))
    detail = np.clip((luminance - centre) * contrast, -28, 34)
    mixed = rgb * (1.0 - strength) + water * strength
    mixed = mixed * 0.72 + (water + detail[..., None]) * 0.28
    rgba[..., :3] = np.where(visible[..., None], np.clip(mixed, 0, 255), 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def save(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print(path.relative_to(ROOT))


def main() -> None:
    base_shallow = mean_colour(BASE / "sea-shallow-floor-v4.webp")
    bastion_shallow = mean_colour(BASTION / "sea-shallow-floor-bastion-v5.webp")
    base_stormy = mean_colour(BASE / "sea-stormy-floor-v5.webp")
    bastion_stormy = mean_colour(BASTION / "sea-stormy-floor-bastion-v6.webp")
    for index in range(1, 9):
        save(
            underwater(Image.open(BASE / f"sea-scatter-debris-{index:02d}-v1.webp"), base_shallow, 0.54, 0.42),
            BASE / f"sea-scatter-debris-{index:02d}-v2.webp",
        )
        save(
            underwater(Image.open(BASTION / f"sea-scatter-debris-{index:02d}-bastion-v1.webp"), bastion_shallow, 0.58, 0.38),
            BASTION / f"sea-scatter-debris-{index:02d}-bastion-v2.webp",
        )
        save(
            underwater(Image.open(BASE / f"sea-scatter-debris-{index:02d}-v1.webp"), base_stormy, 0.72, 0.32),
            BASE / f"sea-scatter-debris-{index:02d}-v3.webp",
        )
        save(
            underwater(Image.open(BASTION / f"sea-scatter-debris-{index:02d}-bastion-v1.webp"), bastion_stormy, 0.76, 0.28),
            BASTION / f"sea-scatter-debris-{index:02d}-bastion-v3.webp",
        )

    base_deep = mean_colour(BASE / "sea-deep-floor-v4.webp")
    bastion_deep = mean_colour(BASTION / "sea-deep-floor-bastion-v5.webp")
    save(
        underwater(Image.open(BASE / "sea-scatter-whirlpool-v1.webp"), base_deep, 0.68, 0.34),
        BASE / "sea-scatter-whirlpool-dark-v1.webp",
    )
    save(
        underwater(Image.open(BASTION / "sea-scatter-whirlpool-bastion-v1.webp"), bastion_deep, 0.72, 0.30),
        BASTION / "sea-scatter-whirlpool-dark-bastion-v1.webp",
    )


if __name__ == "__main__":
    main()
