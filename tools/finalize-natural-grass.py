"""Finalize generated grass as matched, seamless 1024px preset textures."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE_SOURCE = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-b93d8e18-07e0-4399-8e45-e6cbeb7c0838.png")
BASTION_SOURCE = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-a91773cb-76a8-483e-8eca-472516e80d92.png")
BASE_REFERENCE = ROOT / "images" / "scene-floors" / "grass-meadow-floor-v3.webp"
BASTION_REFERENCE = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors" / "grass-meadow-floor-bastion-v9.webp"
BASE_OUTPUT = ROOT / "images" / "scene-floors" / "grass-meadow-floor-v4.webp"
BASTION_OUTPUT = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors" / "grass-meadow-floor-bastion-v10.webp"
SIZE = 1024


def match_palette(image: np.ndarray, reference_path: Path) -> np.ndarray:
    reference = np.asarray(Image.open(reference_path).convert("RGB"), dtype=np.float32)
    source_mean = image.mean(axis=(0, 1))
    source_std = image.std(axis=(0, 1))
    target_mean = reference.mean(axis=(0, 1))
    target_std = reference.std(axis=(0, 1))
    matched = (image - source_mean) * (target_std / np.maximum(source_std, 0.01)) + target_mean
    return np.clip(matched, 0, 255)


def seamless_edges(image: np.ndarray, margin: int = 112) -> np.ndarray:
    result = image.copy()
    for distance in range(margin):
        position = distance / max(1, margin - 1)
        smooth = position * position * (3.0 - 2.0 * position)
        opposite = result.shape[1] - 1 - distance
        average = (result[:, distance] + result[:, opposite]) * 0.5
        result[:, distance] = average * (1.0 - smooth) + result[:, distance] * smooth
        result[:, opposite] = average * (1.0 - smooth) + result[:, opposite] * smooth
    for distance in range(margin):
        position = distance / max(1, margin - 1)
        smooth = position * position * (3.0 - 2.0 * position)
        opposite = result.shape[0] - 1 - distance
        average = (result[distance] + result[opposite]) * 0.5
        result[distance] = average * (1.0 - smooth) + result[distance] * smooth
        result[opposite] = average * (1.0 - smooth) + result[opposite] * smooth
    return result


def finalize(source_path: Path, reference_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    pixels = np.asarray(source, dtype=np.float32)
    pixels = match_palette(pixels, reference_path)
    pixels = seamless_edges(pixels)
    # Edge blending slightly shifts statistics, so lock the requested gamma again.
    pixels = match_palette(pixels, reference_path)
    output = Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGB")
    output.save(output_path, "WEBP", lossless=True, quality=100, method=6)
    print(output_path.relative_to(ROOT))


def main() -> None:
    finalize(BASE_SOURCE, BASE_REFERENCE, BASE_OUTPUT)
    finalize(BASTION_SOURCE, BASTION_REFERENCE, BASTION_OUTPUT)


if __name__ == "__main__":
    main()
