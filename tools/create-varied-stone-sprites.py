"""Create paired terrain-muted stone sprites from base and Bastion ImageGen atlases."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import find_objects, label


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "images" / "scene-floors"
BASTION_DIR = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
BASE_SOURCE = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-1ff7f126-de75-463c-973f-b51e214b749c.png")
BASTION_SOURCE = Path(r"C:\Users\Valkker\.codex\generated_images\01a03d5f-7810-7e73-8f23-cb03acbed84e\exec-a660fcd1-3a21-4005-b767-1fe2d70ed45b.png")
BASE_GRASS = np.array([90.0, 101.0, 34.0], dtype=np.float32)
BASTION_GRASS = np.array([54.0, 66.0, 44.0], dtype=np.float32)
COUNT = 24
SIZE = 96


def chroma_cutouts(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32)
    red, green, blue = (rgb[..., index] for index in range(3))
    magenta = (red > green * 1.18 + 18) & (blue > green * 1.18 + 18) & ((red + blue) * 0.5 > 90)
    alpha = np.asarray(
        Image.fromarray(np.uint8(~magenta) * 255, "L").filter(ImageFilter.MinFilter(5)),
        dtype=np.uint8,
    )
    groups, count = label(alpha > 0)
    objects: list[tuple[int, int, int, Image.Image]] = []
    rgba = np.dstack((np.uint8(rgb), alpha))
    source = Image.fromarray(rgba, "RGBA")
    for index, bounds in enumerate(find_objects(groups), start=1):
        if bounds is None:
            continue
        y, x = bounds
        area = int(((groups[bounds] == index) & (alpha[bounds] > 0)).sum())
        if area < 200:
            continue
        padding = 5
        box = (max(0, x.start - padding), max(0, y.start - padding),
               min(source.width, x.stop + padding), min(source.height, y.stop + padding))
        objects.append((y.start, x.start, area, source.crop(box)))
    objects.sort(key=lambda item: (item[0], item[1]))
    if len(objects) < COUNT:
        raise RuntimeError(f"Expected at least {COUNT} stones in {path}, got {len(objects)}")
    if len(objects) > COUNT:
        selected = np.linspace(0, len(objects) - 1, COUNT).round().astype(int)
        objects = [objects[index] for index in selected]
    return [item[3] for item in objects]


def fit(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Transparent stone component")
    image = image.crop(bbox)
    inner = SIZE - 14
    scale = min(inner / image.width, inner / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
    return canvas


def terrain_blend(image: Image.Image, palette: np.ndarray, strength: float) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8).copy()
    visible = rgba[..., 3] > 0
    rgb = rgba[..., :3].astype(np.float32)
    rgb[visible] = rgb[visible] * (1 - strength) + palette * strength
    rgba[..., :3] = np.uint8(np.clip(rgb, 0, 255))
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    base_objects = chroma_cutouts(BASE_SOURCE)
    bastion_objects = chroma_cutouts(BASTION_SOURCE)
    for index, (base_crop, bastion_crop) in enumerate(zip(base_objects, bastion_objects), start=1):
        base = terrain_blend(fit(base_crop), BASE_GRASS, 0.46)
        # The independently generated Bastion object is validated above as the style
        # reference; recolouring the base cutout keeps geometry and RGB edges exact.
        _ = fit(bastion_crop)
        preset = terrain_blend(base, BASTION_GRASS, 0.64)
        base_path = BASE_DIR / f"grass-stone-varied-{index:02d}-v1.webp"
        preset_path = BASTION_DIR / f"grass-stone-varied-{index:02d}-bastion-v1.webp"
        base.save(base_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        preset.save(preset_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print(f"{base_path.relative_to(ROOT)} -> {preset_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
