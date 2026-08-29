"""Finalize generated stormy-sea textures as palette-stable seamless WebP tiles."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


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


def finalize(source: Path, reference_path: Path, output: Path) -> None:
    generated = Image.open(source).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    reference = Image.open(reference_path).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    pixels = np.asarray(generated, dtype=np.float32)
    reference_pixels = np.asarray(reference, dtype=np.float32)
    pixels = seamless_edges(pixels)
    pixels = match_statistics(pixels, reference_pixels)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGB").save(
        output, "WEBP", lossless=True, quality=100, method=6
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    finalize(args.source, args.reference, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
