"""Build a cold-green seamless micro-grass tile without grid artifacts."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "images/presets/bastion-blasphemy/scene-floors/grass-meadow-floor-bastion-v6.png"
CHECK = ROOT / "grass-meadow-v6-tilecheck.png"
SIZE = 200
RNG = np.random.default_rng(1234)


def periodic_noise(min_frequency: float, max_frequency: float) -> np.ndarray:
    frequencies = np.sqrt(
        np.fft.fftfreq(SIZE)[:, None] ** 2
        + np.fft.fftfreq(SIZE)[None, :] ** 2
    )
    band = np.exp(-((frequencies - min_frequency) / max_frequency) ** 2)
    band[frequencies < min_frequency * 0.55] = 0
    spectrum = (RNG.normal(size=(SIZE, SIZE)) + 1j * RNG.normal(size=(SIZE, SIZE))) * band
    noise = np.fft.ifft2(spectrum).real
    return (noise - noise.mean()) / max(noise.std(), 1e-6)


medium = periodic_noise(0.035, 0.085)
fine = periodic_noise(0.11, 0.25)
shade = np.clip(medium * 5.5 + fine * 3.0, -15, 15)
base = np.array([55.0, 67.0, 45.0])[None, None, :]
ratios = np.array([0.74, 1.0, 0.67])[None, None, :]
pixels = np.clip(base + shade[:, :, None] * ratios, 0, 255).astype(np.uint8)

# Draw many tiny, randomly oriented blades on a 3x3 toroidal canvas, then crop
# the centre. Duplicating every stroke makes opposite edges exactly periodic.
large = Image.fromarray(np.tile(pixels, (3, 3, 1)), "RGB")
draw = ImageDraw.Draw(large, "RGBA")
palette = [(92, 108, 75, 58), (71, 88, 59, 70), (38, 50, 34, 65), (111, 122, 88, 36)]
for _ in range(5200):
    x = float(RNG.uniform(0, SIZE))
    y = float(RNG.uniform(0, SIZE))
    angle = float(RNG.uniform(0, np.pi))
    length = float(RNG.uniform(1.2, 3.8))
    dx = np.cos(angle) * length / 2
    dy = np.sin(angle) * length / 2
    color = palette[int(RNG.integers(0, len(palette)))]
    for offset_y in (0, SIZE, SIZE * 2):
        for offset_x in (0, SIZE, SIZE * 2):
            cx, cy = x + offset_x, y + offset_y
            draw.line((cx - dx, cy - dy, cx + dx, cy + dy), fill=color, width=1)

result = large.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))
result = ImageEnhance.Contrast(result).enhance(0.96)
result = result.filter(ImageFilter.GaussianBlur(0.18))
# Make the sampled raster edges exactly periodic. The one-pixel blend is below
# grass-detail scale and prevents bilinear filtering from revealing a seam.
data = np.asarray(result, dtype=np.float64).copy()
left_right = (data[:, 0, :] + data[:, -1, :]) / 2
top_bottom = (data[0, :, :] + data[-1, :, :]) / 2
data[:, 0, :] = data[:, -1, :] = left_right
data[0, :, :] = data[-1, :, :] = top_bottom
corner = data[[0, 0, -1, -1], [0, -1, 0, -1]].mean(axis=0)
data[0, 0] = data[0, -1] = data[-1, 0] = data[-1, -1] = corner
result = Image.fromarray(np.uint8(np.clip(data, 0, 255)), "RGB")
result.save(OUTPUT, optimize=True)

check = Image.new("RGB", (800, 800))
for y in range(4):
    for x in range(4):
        check.paste(result, (x * SIZE, y * SIZE))
check.save(CHECK)

print(OUTPUT, result.size, result.mode, [round(value, 2) for value in ImageStat.Stat(result).mean], result.getextrema())
