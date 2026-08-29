from __future__ import annotations

import argparse
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def make_edges_periodic(image: Image.Image, band: int) -> Image.Image:
    data = np.asarray(image.convert("RGB"), dtype=np.float64).copy()
    height, width = data.shape[:2]
    band = max(1, min(band, width // 4, height // 4))
    for distance in range(band):
        strength = (1.0 - distance / band) ** 2
        left, right = distance, width - 1 - distance
        average = (data[:, left, :] + data[:, right, :]) / 2.0
        data[:, left, :] += (average - data[:, left, :]) * strength
        data[:, right, :] += (average - data[:, right, :]) * strength
    for distance in range(band):
        strength = (1.0 - distance / band) ** 2
        top, bottom = distance, height - 1 - distance
        average = (data[top, :, :] + data[bottom, :, :]) / 2.0
        data[top, :, :] += (average - data[top, :, :]) * strength
        data[bottom, :, :] += (average - data[bottom, :, :]) * strength
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)), "RGB")


def match_reference_palette(image: Image.Image, reference: Image.Image, detail_contrast: float = 1.0) -> Image.Image:
    """Match channel statistics and clamp to the reference's observed gamut."""
    source = np.asarray(image.convert("RGB"), dtype=np.float64)
    target = np.asarray(reference.convert("RGB"), dtype=np.float64)
    result = source.copy()
    for channel in range(3):
        source_channel = source[..., channel]
        target_channel = target[..., channel]
        source_std = max(1.0, float(source_channel.std()))
        target_std = max(1.0, float(target_channel.std())) * max(0.1, float(detail_contrast))
        result[..., channel] = (
            (source_channel - float(source_channel.mean()))
            * (target_std / source_std)
            + float(target_channel.mean())
        )
        low, high = np.percentile(target_channel, (0.25, 99.75))
        result[..., channel] = np.clip(result[..., channel], low, high)
    return Image.fromarray(np.uint8(np.clip(result, 0, 255)), "RGB")


def grade(image: Image.Image, saturation: float, brightness: float, contrast: float, hue_shift: float) -> Image.Image:
    hsv = np.asarray(image.convert("HSV"), dtype=np.float64).copy()
    hsv[..., 0] = np.mod(hsv[..., 0] + hue_shift * 255.0 / 360.0, 255.0)
    hsv[..., 1] = np.clip(hsv[..., 1] * saturation, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * brightness, 0, 255)
    result = Image.fromarray(np.uint8(hsv), "HSV").convert("RGB")
    result = ImageEnhance.Contrast(result).enhance(contrast)
    return result.filter(ImageFilter.UnsharpMask(radius=0.7, percent=42, threshold=3))


def save_near_weight(image: Image.Image, output: Path, reference_bytes: int, quality_override: int | None = None) -> tuple[int, int | None]:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.suffix.lower() == ".png":
        image.save(output, "PNG", optimize=True, compress_level=9)
        return output.stat().st_size, None
    if quality_override is not None:
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=quality_override, method=6)
        output.write_bytes(buffer.getvalue())
        return len(buffer.getvalue()), quality_override
    candidates = []
    for quality in (84, 88, 92, 95):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=5)
        candidates.append((abs(len(buffer.getvalue()) - reference_bytes), quality, buffer.getvalue()))
    _, quality, data = min(candidates, key=lambda candidate: candidate[0])
    output.write_bytes(data)
    return len(data), quality


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--check", type=Path)
    parser.add_argument("--saturation", type=float, default=0.75)
    parser.add_argument("--brightness", type=float, default=1.0)
    parser.add_argument("--contrast", type=float, default=1.0)
    parser.add_argument("--hue-shift", type=float, default=0.0)
    parser.add_argument("--seam-band", type=int, default=16)
    parser.add_argument("--match-reference", action="store_true")
    parser.add_argument("--detail-contrast", type=float, default=1.0)
    parser.add_argument("--size", type=int, help="square output size; defaults to the reference dimensions")
    parser.add_argument("--quality", type=int, choices=range(1, 101))
    args = parser.parse_args()

    with Image.open(args.reference) as reference_source:
        reference = reference_source.convert("RGB")
        size = (args.size, args.size) if args.size else reference.size
    with Image.open(args.input) as source:
        result = source.convert("RGB").resize(size, Image.Resampling.LANCZOS)

    result = grade(result, args.saturation, args.brightness, args.contrast, args.hue_shift)
    if args.match_reference:
        result = match_reference_palette(result, reference, args.detail_contrast)
    result = make_edges_periodic(result, args.seam_band)
    encoded_bytes, quality = save_near_weight(result, args.output, args.reference.stat().st_size, args.quality)

    if args.check:
        check = Image.new("RGB", (size[0] * 5, size[1] * 5))
        for y in range(5):
            for x in range(5):
                check.paste(result, (x * size[0], y * size[1]))
        args.check.parent.mkdir(parents=True, exist_ok=True)
        check.save(args.check, "PNG", optimize=True)

    with Image.open(args.output) as validation:
        if validation.size != size or validation.mode not in ("RGB", "RGBA"):
            raise RuntimeError("output validation failed")
        pixels = np.asarray(validation.convert("RGB"), dtype=np.int16)
        horizontal = int(np.abs(pixels[:, 0, :] - pixels[:, -1, :]).max())
        vertical = int(np.abs(pixels[0, :, :] - pixels[-1, :, :]).max())
        if max(horizontal, vertical) > 12:
            raise RuntimeError(f"encoded edge mismatch: horizontal={horizontal}, vertical={vertical}")
    print(f"{args.output}: {size[0]}x{size[1]}, bytes={encoded_bytes}, quality={quality}, edge-max={max(horizontal, vertical)}")


if __name__ == "__main__":
    main()
