"""Convert a sand reference into a small, exactly periodic VTT texture."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageStat


def periodic_noise(size: int, rng: np.random.Generator, center: float, width: float) -> np.ndarray:
    frequencies = np.sqrt(
        np.fft.fftfreq(size)[:, None] ** 2
        + np.fft.fftfreq(size)[None, :] ** 2
    )
    band = np.exp(-((frequencies - center) / width) ** 2)
    band[frequencies < center * 0.45] = 0
    spectrum = (rng.normal(size=(size, size)) + 1j * rng.normal(size=(size, size))) * band
    noise = np.fft.ifft2(spectrum).real
    return (noise - noise.mean()) / max(noise.std(), 1e-6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--check", type=Path)
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--seed", type=int, default=20260813)
    parser.add_argument("--preserve-detail", action="store_true")
    args = parser.parse_args()

    with Image.open(args.input) as source:
        reference = source.convert("RGB")
        source_detail = reference.copy()
        reference.thumbnail((512, 512), Image.Resampling.LANCZOS)
        mean = np.array(ImageStat.Stat(reference).mean, dtype=np.float64)
        contrast = np.mean(ImageStat.Stat(reference).stddev)

    if args.preserve_detail:
        result = source_detail.resize((args.size, args.size), Image.Resampling.LANCZOS)
        # Downscaling the generated reference suppresses most grains; restore
        # map-scale microcontrast so the sand does not read as a flat fill.
        data = np.asarray(result, dtype=np.float64).copy()
        channel_mean = data.mean(axis=(0, 1), keepdims=True)
        data = channel_mean + (data - channel_mean) * 1.65
        band = max(8, args.size // 12)
        for distance in range(band):
            strength = (1 - distance / band) ** 2
            left_x, right_x = distance, args.size - 1 - distance
            average = (data[:, left_x, :] + data[:, right_x, :]) / 2
            data[:, left_x, :] += (average - data[:, left_x, :]) * strength
            data[:, right_x, :] += (average - data[:, right_x, :]) * strength
        for distance in range(band):
            strength = (1 - distance / band) ** 2
            top_y, bottom_y = distance, args.size - 1 - distance
            average = (data[top_y, :, :] + data[bottom_y, :, :]) / 2
            data[top_y, :, :] += (average - data[top_y, :, :]) * strength
            data[bottom_y, :, :] += (average - data[bottom_y, :, :]) * strength
        result = Image.fromarray(np.uint8(np.clip(data, 0, 255)), "RGB")
    else:
        rng = np.random.default_rng(args.seed)
        broad = periodic_noise(args.size, rng, 0.032, 0.055)
        medium = periodic_noise(args.size, rng, 0.065, 0.09)
        grain = periodic_noise(args.size, rng, 0.13, 0.18)
        grit = periodic_noise(args.size, rng, 0.29, 0.20)
        shade = broad * 0.55
        shade += medium * 2.1
        shade += grain * 4.7
        shade += grit * 2.9
        shade = np.clip(shade, -18, 18)

        # Sand varies mostly in value, with slightly warmer highlights. Keeping
        # the low-frequency band weak prevents recognizable motifs when repeated.
        ratios = np.array([1.04, 0.98, 0.82], dtype=np.float64)
        pixels = np.clip(mean[None, None, :] + shade[:, :, None] * ratios, 0, 255).astype(np.uint8)
        result = Image.fromarray(pixels, "RGB")
        result = result.filter(ImageFilter.GaussianBlur(0.08))

    # FFT noise is periodic already. Equalizing the sampled border pixels also
    # keeps bilinear filtering from exposing a one-pixel seam in PIXI.
    data = np.asarray(result, dtype=np.float64).copy()
    horizontal = (data[:, 0, :] + data[:, -1, :]) / 2
    vertical = (data[0, :, :] + data[-1, :, :]) / 2
    data[:, 0, :] = data[:, -1, :] = horizontal
    data[0, :, :] = data[-1, :, :] = vertical
    corner = data[[0, 0, -1, -1], [0, -1, 0, -1]].mean(axis=0)
    data[0, 0] = data[0, -1] = data[-1, 0] = data[-1, -1] = corner
    result = Image.fromarray(np.uint8(np.clip(data, 0, 255)), "RGB")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, "PNG", optimize=True)

    if args.check:
        check = Image.new("RGB", (args.size * 5, args.size * 5))
        for y in range(5):
            for x in range(5):
                check.paste(result, (x * args.size, y * args.size))
        args.check.parent.mkdir(parents=True, exist_ok=True)
        check.save(args.check, "PNG", optimize=True)

    print(args.output, result.size, result.mode, [round(value, 2) for value in ImageStat.Stat(result).mean])


if __name__ == "__main__":
    main()
