"""Extract paired storm-foam overlays from ImageGen chroma-key sources."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
SIZE = 256
INNER = 238
SOURCES = (
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-feef355a-d33f-4dc8-b313-7bb572c11607.png"),
    Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-57411744-f5ed-4d12-9882-51c2ceded128.png"),
)


def chroma_rgba(source: Path) -> Image.Image:
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    red, green, blue = (rgb[..., channel] for channel in range(3))
    magenta_strength = np.minimum(red - green, blue - green)
    alpha = np.clip(255.0 - magenta_strength * 1.18, 0, 255)
    alpha[(red > 220) & (blue > 205) & (green < 70)] = 0
    alpha[alpha < 5] = 0
    groups, count = label(alpha > 5)
    if count:
        sizes = np.bincount(groups.ravel())
        keep = np.zeros_like(alpha, dtype=bool)
        for group in range(1, count + 1):
            if sizes[group] >= 18:
                keep |= groups == group
        alpha = np.where(keep, alpha, 0)
    fraction = alpha[..., None] / 255.0
    key = np.array((255.0, 0.0, 255.0), dtype=np.float32)
    clean = np.where(
        fraction > 0.02,
        (rgb - key * (1.0 - fraction)) / np.maximum(fraction, 0.02),
        0,
    )
    rgba = np.dstack((np.clip(clean, 0, 255), alpha)).astype(np.uint8)
    points = np.argwhere(alpha > 5)
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0) + 1
    image = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
    scale = min(INNER / image.width, INNER / image.height)
    target = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((SIZE - target[0]) // 2, (SIZE - target[1]) // 2))
    return canvas


def tint(image: Image.Image, colour: tuple[int, int, int]) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8).copy()
    alpha = rgba[..., 3]
    source = rgba[..., :3].astype(np.float32)
    luminance = source[..., 0] * 0.21 + source[..., 1] * 0.72 + source[..., 2] * 0.07
    level = np.clip(0.58 + luminance / 255.0 * 0.62, 0.58, 1.18)
    graded = np.asarray(colour, dtype=np.float32) * level[..., None]
    rgba[..., :3] = np.where((alpha > 0)[..., None], np.clip(graded, 0, 255), 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def save(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print(path.relative_to(ROOT))


def main() -> None:
    for index, source in enumerate(SOURCES, start=1):
        extracted = chroma_rgba(source)
        base = tint(extracted, (170, 198, 211))
        bastion = tint(extracted, (116, 128, 129))
        bastion.putalpha(base.getchannel("A"))
        save(base, BASE / f"sea-scatter-storm-foam-{index:02d}-v1.webp")
        save(bastion, BASTION / f"sea-scatter-storm-foam-{index:02d}-bastion-v1.webp")


if __name__ == "__main__":
    main()
