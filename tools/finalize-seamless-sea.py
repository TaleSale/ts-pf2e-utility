"""Create palette-stable, edge-matched sea texture siblings for every preset."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
KINDS = ("deep", "shallow", "stormy")


def match_statistics(image: np.ndarray, reference: np.ndarray) -> np.ndarray:
    source_mean = image.mean(axis=(0, 1))
    source_std = image.std(axis=(0, 1))
    target_mean = reference.mean(axis=(0, 1))
    target_std = reference.std(axis=(0, 1))
    return np.clip((image - source_mean) * (target_std / np.maximum(source_std, 0.01)) + target_mean, 0, 255)


def seamless_edges(image: np.ndarray, margin: int = 176) -> np.ndarray:
    height, width = image.shape[:2]
    shifted = np.roll(image, shift=(height // 2, width // 2), axis=(0, 1))
    x = np.abs(np.arange(width, dtype=np.float32) - width / 2)
    y = np.abs(np.arange(height, dtype=np.float32) - height / 2)
    vertical = np.clip(1.0 - x / margin, 0.0, 1.0)
    horizontal = np.clip(1.0 - y / margin, 0.0, 1.0)
    mask = np.maximum(horizontal[:, None], vertical[None, :])
    mask = mask * mask * (3.0 - 2.0 * mask)
    return shifted * (1.0 - mask[..., None]) + image * mask[..., None]


def finalize(source: Path, output: Path) -> None:
    reference = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    pixels = seamless_edges(reference)
    pixels = match_statistics(pixels, reference)
    Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGB").save(
        output, "WEBP", lossless=True, quality=100, method=6
    )
    print(output.relative_to(ROOT))


def main() -> None:
    for kind in KINDS:
        finalize(BASE / f"sea-{kind}-floor-v3.webp", BASE / f"sea-{kind}-floor-v4.webp")
        finalize(
            BASTION / f"sea-{kind}-floor-bastion-v4.webp",
            BASTION / f"sea-{kind}-floor-bastion-v5.webp",
        )


if __name__ == "__main__":
    main()
