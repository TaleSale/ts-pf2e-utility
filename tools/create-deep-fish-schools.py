"""Compose paired deep-water fish-school shadows from accepted fish silhouettes."""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "images" / "scene-floors"
BASTION = ROOT / "images" / "presets" / "bastion-blasphemy" / "scene-floors"
SIZE = 256


def sprite(directory: Path, suffix: str, index: int, width: int, angle: float) -> Image.Image:
    source = Image.open(directory / f"sea-scatter-fish-shadow-{index:02d}{suffix}-v1.webp").convert("RGBA")
    ratio = width / source.width
    resized = source.resize((width, max(1, round(source.height * ratio))), Image.Resampling.LANCZOS)
    return resized.rotate(angle, Image.Resampling.BICUBIC, expand=True)


def compose_pair(seed: int) -> tuple[Image.Image, Image.Image]:
    randomizer = random.Random(seed)
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bastion = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    count = randomizer.randint(6, 10)
    heading = randomizer.uniform(-28, 28)
    for position in range(count):
        progress = position / max(1, count - 1)
        x = round(34 + progress * 176 + randomizer.uniform(-14, 14))
        y = round(128 + (progress - 0.5) ** 2 * randomizer.choice((-70, 70)) + randomizer.uniform(-30, 30))
        width = randomizer.randint(20, 38)
        angle = heading + randomizer.uniform(-18, 18)
        index = randomizer.choice((1, 2, 3, 4, 5, 7))
        base_fish = sprite(BASE, "", index, width, angle)
        bastion_fish = sprite(BASTION, "-bastion", index, width, angle)
        offset = (x - base_fish.width // 2, y - base_fish.height // 2)
        base.alpha_composite(base_fish, offset)
        bastion.alpha_composite(bastion_fish, offset)
    bastion.putalpha(base.getchannel("A"))
    return base, bastion


def main() -> None:
    for index in range(1, 7):
        base, bastion = compose_pair(5100 + index)
        base_path = BASE / f"sea-scatter-fish-school-{index:02d}-v1.webp"
        bastion_path = BASTION / f"sea-scatter-fish-school-{index:02d}-bastion-v1.webp"
        base.save(base_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        bastion.save(bastion_path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print(f"{base_path.relative_to(ROOT)} -> {bastion_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
