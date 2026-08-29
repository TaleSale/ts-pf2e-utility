#!/usr/bin/env python3
"""Create an exact-size, opaque, edge-matched floor texture."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--quality", type=int, default=94)
    args = parser.parse_args()

    if args.size < 2 or args.size % 2:
        raise ValueError("size must be an even integer of at least 2 pixels")

    half = args.size // 2
    with Image.open(args.input) as source:
        rgb = source.convert("RGB")
        crop_size = min(rgb.size) // 2
        left = (rgb.width - crop_size) // 2
        top = (rgb.height - crop_size) // 2
        quadrant = rgb.crop((left, top, left + crop_size, top + crop_size)).resize(
            (half, half), Image.Resampling.LANCZOS
        )

    row = Image.new("RGB", (args.size, half))
    row.paste(quadrant, (0, 0))
    row.paste(ImageOps.mirror(quadrant), (half, 0))
    tile = Image.new("RGB", (args.size, args.size))
    tile.paste(row, (0, 0))
    tile.paste(ImageOps.flip(row), (0, half))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Lossless encoding preserves the exact mirrored border pixels; lossy WebP
    # can quantize opposite edges differently and reintroduce a visible seam.
    tile.save(args.output, "WEBP", lossless=True, quality=args.quality, method=6)

    with Image.open(args.output) as result:
        if result.size != (args.size, args.size) or result.mode != "RGB":
            raise RuntimeError("output validation failed")
        pixels = result.load()
        if any(pixels[0, y] != pixels[args.size - 1, y] for y in range(args.size)):
            raise RuntimeError("left and right edges do not match")
        if any(pixels[x, 0] != pixels[x, args.size - 1] for x in range(args.size)):
            raise RuntimeError("top and bottom edges do not match")

    print(f"{args.output}: {args.size}x{args.size}, mode=RGB, matched edges")


if __name__ == "__main__":
    main()
