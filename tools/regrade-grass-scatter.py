"""Make grass flower scatter opaque and palette-matched without changing silhouettes."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"

BASE_FLOWERS = (
    (141, 126, 54), (137, 133, 82), (115, 96, 111), (134, 119, 45),
    (145, 137, 83), (126, 112, 48), (111, 91, 108), (143, 124, 48),
    (134, 131, 88), (127, 107, 49), (108, 88, 105), (139, 125, 59),
)
BASTION_FLOWERS = (
    (94, 88, 52), (97, 96, 73), (78, 67, 80), (88, 83, 47),
    (101, 98, 72), (84, 79, 47), (75, 65, 78), (92, 85, 48),
    (96, 95, 74), (86, 78, 47), (73, 63, 76), (91, 86, 54),
)
BASE_LEAF = np.array((76, 95, 38), dtype=np.float32)
BASTION_LEAF = np.array((48, 64, 43), dtype=np.float32)


def hardened_alpha(alpha: np.ndarray) -> np.ndarray:
    # Keep only a narrow antialiased edge; normal object pixels become opaque.
    return np.uint8(np.clip((alpha.astype(np.float32) - 12.0) * (255.0 / 100.0), 0, 255))


def grade_flower(source: Image.Image, petal: tuple[int, int, int], leaf: np.ndarray) -> Image.Image:
    rgba = np.asarray(source.convert("RGBA"), dtype=np.uint8).copy()
    alpha = hardened_alpha(rgba[..., 3])
    visible = alpha > 0
    rgb = rgba[..., :3].astype(np.float32)
    luminance = rgb[..., 0] * 0.213 + rgb[..., 1] * 0.715 + rgb[..., 2] * 0.072
    center = float(np.median(luminance[visible]))
    detail = np.clip((luminance - center) * 0.48, -22, 25)
    leaf_mask = visible & (rgb[..., 1] > rgb[..., 0] * 1.04) & (rgb[..., 1] > rgb[..., 2] * 1.2)
    target = np.broadcast_to(np.asarray(petal, dtype=np.float32), rgb.shape).copy()
    target[leaf_mask] = leaf
    graded = target + detail[..., None] + (rgb - luminance[..., None]) * 0.06
    rgba[..., :3] = np.where(visible[..., None], np.clip(graded, 0, 255), 0).astype(np.uint8)
    rgba[..., 3] = alpha
    return Image.fromarray(rgba, "RGBA")


def save_pair(base_image: Image.Image, preset_image: Image.Image, base_name: str, preset_name: str) -> None:
    base_image.save(BASE / base_name, "WEBP", lossless=True, quality=100, method=6, exact=True)
    preset_image.save(BASTION / preset_name, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print(f"{base_name} -> {preset_name}")


def main() -> None:
    for index in range(1, 13):
        if index == 7:
            continue
        flower = Image.open(BASE / f"grass-flower-single-{index:02d}-v2.webp")
        save_pair(
            grade_flower(flower, BASE_FLOWERS[index - 1], BASE_LEAF),
            grade_flower(flower, BASTION_FLOWERS[index - 1], BASTION_LEAF),
            f"grass-flower-single-{index:02d}-v3.webp",
            f"grass-flower-single-{index:02d}-bastion-v3.webp",
        )
if __name__ == "__main__":
    main()
