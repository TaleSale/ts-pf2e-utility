#!/usr/bin/env python3
"""Create a transparent, eerie fog boundary from an existing ribbon."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


RIBBON_TOP = 30.0
RIBBON_BOTTOM = 170.0
CORE_FALLOFF = 0.0
CORE_STRENGTH = 0.86
GLOW_FALLOFF = 1.0
GLOW_STRENGTH = 0.40
BROAD_GLOW_FALLOFF = 0.35
BROAD_GLOW_STRENGTH = 0.28


def blur_channel(channel: np.ndarray, radius: float) -> np.ndarray:
    blurred = Image.fromarray(channel.clip(0, 255).astype(np.uint8), "L")
    return np.asarray(blurred.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)


def transform(source_path: Path, output_path: Path) -> None:
    with Image.open(source_path) as image:
        source = np.asarray(image.convert("RGBA"), dtype=np.float32)

    alpha = source[:, :, 3]
    premultiplied = source[:, :, :3] * (alpha[:, :, None] / 255.0)
    blurred_alpha = blur_channel(alpha, 9)
    broad_blurred_alpha = blur_channel(alpha, 26)
    visible_weight = alpha[:, :, None]
    glow_color = (
        (source[:, :, :3] * visible_weight).sum(axis=(0, 1))
        / max(float(visible_weight.sum()), 1.0)
    ) * np.array([0.85, 1.65, 1.0], dtype=np.float32)
    glow_color = np.clip(glow_color, 0.0, 255.0)
    colorized_glow = glow_color[None, None, :] * (blurred_alpha[:, :, None] / 255.0)
    colorized_broad_glow = glow_color[None, None, :] * (broad_blurred_alpha[:, :, None] / 255.0)

    height = source.shape[0]
    center = (RIBBON_TOP + RIBBON_BOTTOM - 1.0) / 2.0
    half_width = (RIBBON_BOTTOM - RIBBON_TOP) / 2.0
    distance = np.clip(
        np.abs(np.arange(height, dtype=np.float32)[:, None] - center) / half_width,
        0.0,
        1.0,
    )
    core = CORE_STRENGTH * np.exp(-CORE_FALLOFF * distance * distance)
    glow = GLOW_STRENGTH * np.exp(-GLOW_FALLOFF * distance * distance)
    broad_glow = BROAD_GLOW_STRENGTH * np.exp(-BROAD_GLOW_FALLOFF * distance * distance)

    main_alpha = alpha * core
    main_fraction = main_alpha / 255.0
    glow_alpha = blurred_alpha * glow
    broad_glow_alpha = broad_blurred_alpha * broad_glow
    output_alpha = (
        main_alpha
        + glow_alpha * (1.0 - main_fraction)
        + broad_glow_alpha * (1.0 - main_fraction)
    )
    output_premultiplied = (
        premultiplied * core[:, :, None]
        + colorized_glow * glow[:, :, None] * (1.0 - main_fraction[:, :, None])
        + colorized_broad_glow * broad_glow[:, :, None] * (1.0 - main_fraction[:, :, None])
    )

    output = np.zeros_like(source)
    output[:, :, 3] = output_alpha.clip(0, 255)
    denominator = np.maximum(output_alpha[:, :, None], 1.0) / 255.0
    output[:, :, :3] = np.where(
        output_alpha[:, :, None] > 0.5,
        output_premultiplied / denominator,
        0.0,
    ).clip(0, 255)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.round(output).astype(np.uint8), "RGBA").save(
        output_path,
        "WEBP",
        quality=96,
        method=6,
    )

    with Image.open(output_path) as result:
        if result.size != (source.shape[1], source.shape[0]) or "A" not in result.getbands():
            raise RuntimeError("output dimensions or alpha channel changed")
        corners = [
            result.getpixel((0, 0))[3],
            result.getpixel((result.width - 1, 0))[3],
            result.getpixel((0, result.height - 1))[3],
            result.getpixel((result.width - 1, result.height - 1))[3],
        ]
        if max(corners) != 0:
            raise RuntimeError(f"output corners are not transparent: {corners}")

    print(f"{output_path}: {source.shape[1]}x{source.shape[0]}, corners={corners}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    transform(args.input, args.output)


if __name__ == "__main__":
    main()
