"""Generate matched base and Bastion seamless swamp floor tiles."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SIZE = 200
SEED = 20260816


def periodic_noise(rng: np.random.Generator, minimum: float, width: float) -> np.ndarray:
    frequencies = np.sqrt(
        np.fft.fftfreq(SIZE)[:, None] ** 2
        + np.fft.fftfreq(SIZE)[None, :] ** 2
    )
    band = np.exp(-((frequencies - minimum) / width) ** 2)
    band[frequencies < minimum * 0.5] = 0
    spectrum = (rng.normal(size=(SIZE, SIZE)) + 1j * rng.normal(size=(SIZE, SIZE))) * band
    result = np.fft.ifft2(spectrum).real
    return (result - result.mean()) / max(result.std(), 1e-6)


def equalize_edges(image: Image.Image) -> Image.Image:
    data = np.asarray(image, dtype=np.float64).copy()
    horizontal = (data[:, 0, :] + data[:, -1, :]) / 2
    vertical = (data[0, :, :] + data[-1, :, :]) / 2
    data[:, 0, :] = data[:, -1, :] = horizontal
    data[0, :, :] = data[-1, :, :] = vertical
    corner = data[[0, 0, -1, -1], [0, -1, 0, -1]].mean(axis=0)
    data[0, 0] = data[0, -1] = data[-1, 0] = data[-1, -1] = corner
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)), "RGB")


def draw_reeds(image: Image.Image, wet: np.ndarray, rng: np.random.Generator, palette: list[tuple[int, int, int, int]]) -> Image.Image:
    large = Image.fromarray(np.tile(np.asarray(image), (3, 3, 1)), "RGB")
    draw = ImageDraw.Draw(large, "RGBA")
    for _ in range(190):
        x = int(rng.integers(0, SIZE))
        y = int(rng.integers(0, SIZE))
        if wet[y, x] < 0.45:
            continue
        height = float(rng.uniform(2.0, 5.5))
        lean = float(rng.uniform(-1.5, 1.5))
        color = palette[int(rng.integers(0, len(palette)))]
        for offset_y in (0, SIZE, SIZE * 2):
            for offset_x in (0, SIZE, SIZE * 2):
                cx, cy = x + offset_x, y + offset_y
                draw.line((cx, cy, cx + lean, cy - height), fill=color, width=1)
                if rng.random() < 0.35:
                    draw.line((cx + lean * 0.45, cy - height * 0.45, cx + lean - 1.2, cy - height * 0.62), fill=color, width=1)
    return large.crop((SIZE, SIZE, SIZE * 2, SIZE * 2)).filter(ImageFilter.GaussianBlur(0.16))


def make_tile(rng: np.random.Generator, bastion: bool) -> Image.Image:
    broad = periodic_noise(rng, 0.014, 0.025)
    medium = periodic_noise(rng, 0.042, 0.065)
    fine = periodic_noise(rng, 0.15, 0.2)
    wet_field = broad * 0.48 + medium * 0.72
    wet = np.clip((wet_field + 0.35) / 1.7, 0.0, 1.0)
    wet = np.clip(wet * 0.8 + (fine > 0.9) * 0.08, 0.0, 1.0)

    if bastion:
        peat = np.array([39.0, 50.0, 34.0])
        water = np.array([31.0, 53.0, 50.0])
        variation = np.array([0.82, 1.0, 0.75])
        reed_palette = [(67, 83, 55, 58), (25, 38, 29, 74), (91, 99, 62, 34)]
    else:
        peat = np.array([63.0, 70.0, 43.0])
        water = np.array([47.0, 72.0, 62.0])
        variation = np.array([0.9, 1.0, 0.7])
        reed_palette = [(94, 111, 65, 62), (42, 58, 35, 75), (126, 130, 73, 36)]

    shade = broad * 4.2 + medium * 5.2 + fine * 3.0
    peat_pixels = peat + shade[:, :, None] * variation
    water_shade = fine * 2.8 + medium * 2.0
    water_pixels = water + water_shade[:, :, None] * np.array([0.65, 0.9, 0.95])
    pixels = peat_pixels * (1.0 - wet[:, :, None]) + water_pixels * wet[:, :, None]

    ripple = np.sin(2 * np.pi * (np.arange(SIZE)[:, None] * 3 / SIZE + np.arange(SIZE)[None, :] * 1 / SIZE))
    glint = np.clip((ripple - 0.7) * 7.0, 0.0, 3.0) * wet
    pixels += glint[:, :, None] * np.array([0.75, 1.0, 0.9])
    image = Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGB")
    return equalize_edges(draw_reeds(image, wet, rng, reed_palette))


def save_tile(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def save_check(image: Image.Image, path: Path) -> None:
    check = Image.new("RGB", (SIZE * 4, SIZE * 4))
    for y in range(4):
        for x in range(4):
            check.paste(image, (x * SIZE, y * SIZE))
    save_tile(check, path)


rng = np.random.default_rng(SEED)
base = make_tile(rng, False)
bastion = make_tile(np.random.default_rng(SEED), True)

save_tile(base, ROOT / "images/scene-floors/swamp-floor-v1.png")
save_tile(bastion, ROOT / "images/presets/bastion-blasphemy/scene-floors/swamp-floor-bastion-v1.png")

print("Generated swamp tiles:", base.size, base.mode)
