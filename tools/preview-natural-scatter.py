"""Render a representative contact sheet for the deterministic nature scatter."""

from __future__ import annotations

import hashlib
import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(r"C:\Users\Valkker\.codex\visualizations\2026\08\26\01a03d5f-7810-7e73-8f23-cb03acbed84e\natural-scatter-map-preview.jpg")
SEA_OUT = Path(r"C:\Users\Valkker\.codex\visualizations\2026\08\26\01a03d5f-7810-7e73-8f23-cb03acbed84e\sea-depth-variants-preview.jpg")


def rng(key: str) -> random.Random:
    seed = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big")
    return random.Random(seed)


def tiled_background(path: Path, size: int = 720, texture_size: int = 256) -> Image.Image:
    texture = Image.open(path).convert("RGBA").resize((texture_size, texture_size), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (size, size))
    for y in range(0, size, texture.height):
        for x in range(0, size, texture.width):
            result.alpha_composite(texture, (x, y))
    return result


def render_grass(base: str, directory: Path, suffix: str, key: str) -> Image.Image:
    result = tiled_background(ROOT / base)
    assets = [
        *((directory / f"grass-flower-single-{index:02d}{suffix}-v3.webp", "flower", 1.0) for index in range(1, 13)),
        *((directory / f"grass-flower-cluster-{index:02d}{suffix}-v1.webp", "cluster", 0.42) for index in range(1, 7)),
    ]
    total_weight = sum(asset[2] for asset in assets)
    randomizer = rng(key)
    for index in range(10):
        roll = randomizer.random() * total_weight
        choice = assets[-1]
        for candidate in assets:
            roll -= candidate[2]
            if roll <= 0:
                choice = candidate
                break
        sprite = Image.open(choice[0]).convert("RGBA")
        size = randomizer.randint(14, 32) if choice[1] == "flower" else randomizer.randint(24, 36)
        sprite = sprite.resize((size, size), Image.Resampling.LANCZOS).rotate(randomizer.randrange(360), resample=Image.Resampling.BICUBIC, expand=True)
        result.alpha_composite(sprite, (randomizer.randint(20, 700 - sprite.width), randomizer.randint(20, 700 - sprite.height)))
    return result


def sea_sprite(path: Path, size: int, opacity: float, rotation: int) -> Image.Image:
    sprite = Image.open(path).convert("RGBA")
    sprite = sprite.resize((size, size), Image.Resampling.LANCZOS).rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    sprite.putalpha(sprite.getchannel("A").point(lambda value: round(value * opacity)))
    return sprite


def render_sea(base: str, directory: Path, suffix: str, key: str, kind: str = "shallow", size: int = 720) -> Image.Image:
    texture_size = round(1024 * {"shallow": 0.25, "deep": 0.45, "stormy": 0.55}[kind])
    result = tiled_background(ROOT / base, size, texture_size)
    randomizer = rng(key)
    scale = size / 720
    if kind == "shallow":
        for _ in range(4):
            index = randomizer.randint(1, 8)
            sprite = sea_sprite(directory / f"sea-scatter-fish-shadow-{index:02d}{suffix}-v1.webp", round(randomizer.randint(70, 120) * scale), 0.22, randomizer.randrange(360))
            result.alpha_composite(sprite, (randomizer.randint(12, max(12, size - 12 - sprite.width)), randomizer.randint(12, max(12, size - 12 - sprite.height))))
    return result


def main() -> None:
    base_dir = ROOT / "images" / "scene-floors"
    bastion_dir = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
    images = [
        render_grass("images/scene-floors/grass-meadow-floor-v4.webp", base_dir, "", "base-grass"),
        render_grass("images/presets/bastion-blasphemy/scene-floors/grass-meadow-floor-bastion-v10.webp", bastion_dir, "-bastion", "bastion-grass"),
        render_sea("images/scene-floors/sea-shallow-floor-v4.webp", base_dir, "", "base-sea", "shallow"),
        render_sea("images/presets/bastion-blasphemy/scene-floors/sea-shallow-floor-bastion-v5.webp", bastion_dir, "-bastion", "bastion-sea", "shallow"),
    ]
    sheet = Image.new("RGB", (1440, 1440))
    for image, position in zip(images, ((0, 0), (720, 0), (0, 720), (720, 720))):
        sheet.paste(image.convert("RGB"), position)
    draw = ImageDraw.Draw(sheet)
    for label, position in zip(("BASE GRASS", "BASTION GRASS", "BASE SEA", "BASTION SEA"), ((16, 16), (736, 16), (16, 736), (736, 736))):
        draw.rectangle((position[0] - 5, position[1] - 4, position[0] + 150, position[1] + 19), fill=(12, 15, 12))
        draw.text(position, label, fill=(235, 235, 225))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, quality=94)
    print(OUT)

    sea_specs = []
    for directory, suffix, prefix, preset in ((base_dir, "", "images/scene-floors", "BASE"), (bastion_dir, "-bastion", "images/presets/bastion-blasphemy/scene-floors", "BASTION")):
        for kind in ("shallow", "deep", "stormy"):
            version = ("v5" if preset == "BASE" else "bastion-v6") if kind in ("deep", "stormy") else ("v4" if preset == "BASE" else "bastion-v5")
            sea_specs.append((render_sea(f"{prefix}/sea-{kind}-floor-{version}.webp", directory, suffix, f"{preset}-{kind}", kind, 480), f"{preset} {kind.upper()}"))
    sea_sheet = Image.new("RGB", (1440, 960))
    sea_draw = ImageDraw.Draw(sea_sheet)
    for index, (image, label) in enumerate(sea_specs):
        x = (index % 3) * 480
        y = (index // 3) * 480
        sea_sheet.paste(image.convert("RGB"), (x, y))
        sea_draw.rectangle((x + 10, y + 10, x + 180, y + 34), fill=(12, 15, 18))
        sea_draw.text((x + 16, y + 16), label, fill=(235, 235, 225))
    sea_sheet.save(SEA_OUT, quality=94)
    print(SEA_OUT)


if __name__ == "__main__":
    main()
