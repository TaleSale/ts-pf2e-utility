"""Validate geometry, alpha masks, and manifest coverage for the Bastion preset."""

from __future__ import annotations

import re
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
PRESET = ROOT / "images" / "presets" / "bastion-blasphemy"
SOURCE = (ROOT / "scripts" / "utility" / "texture-presets.js").read_text(encoding="utf-8")
FLOOR_SOURCE = (ROOT / "scripts" / "utility" / "floor-textures.js").read_text(encoding="utf-8")


def versioned(name: str) -> str:
    path = Path(name)
    return f"{path.stem}-bastion-v2{path.suffix}"


def manifest_entries() -> list[tuple[str, str]]:
    block = SOURCE.split("const BASTION_COMPLETE_TEXTURE_FILES", 1)[1].split("function bastionVersionedFilename", 1)[0]
    entries: list[tuple[str, str]] = []
    for directory in ("scene-assets", "scene-floors", "scene-walls"):
        match = re.search(rf'"{directory}": Object\.freeze\(\[(.*?)\]\)', block, re.DOTALL)
        if not match:
            raise AssertionError(f"Missing manifest group: {directory}")
        entries.extend((directory, filename) for filename in re.findall(r'"([^"]+)"', match.group(1)))
    return entries


def scatter_redirect_entries() -> list[tuple[str, str]]:
    required_spreads = (
        '...numberedScatterTextureRedirects("grass-flower-single", 12, 3, [7])',
        '...numberedScatterTextureRedirects("grass-flower-cluster", 6, 1)',
        '...numberedScatterTextureRedirects("sea-scatter-debris", 8, 1)',
        '...numberedScatterTextureRedirects("sea-scatter-debris", 8, 2)',
        '...numberedScatterTextureRedirects("sea-scatter-debris", 8, 3)',
        '...numberedScatterTextureRedirects("sea-scatter-fish-shadow", 8, 1)',
        '...numberedScatterTextureRedirects("sea-scatter-fish-school", 6, 1)',
        '...numberedScatterTextureRedirects("sea-scatter-wreckage", 4, 1)',
        '...numberedScatterTextureRedirects("sea-scatter-wreckage", 4, 2)',
        '...numberedScatterTextureRedirects("sea-scatter-storm-foam", 2, 1)',
    )
    if any(SOURCE.count(marker) != 1 for marker in required_spreads):
        raise AssertionError("Numbered natural scatter redirects are incomplete")
    redirects = [
        (f"scene-floors/{prefix}-{index:02d}-v3.webp", f"scene-floors/{prefix}-{index:02d}-bastion-v3.webp")
        for prefix in ("grass-flower-single",)
        for index in range(1, 13)
        if index != 7
    ]
    redirects.extend(
        (f"scene-floors/grass-flower-cluster-{index:02d}-v1.webp", f"scene-floors/grass-flower-cluster-{index:02d}-bastion-v1.webp")
        for index in range(1, 7)
    )
    redirects.extend(
        (f"scene-floors/{prefix}-{index:02d}-v1.webp", f"scene-floors/{prefix}-{index:02d}-bastion-v1.webp")
        for prefix in ("sea-scatter-debris", "sea-scatter-fish-shadow")
        for index in range(1, 9)
    )
    redirects.extend(
        (f"scene-floors/sea-scatter-debris-{index:02d}-v2.webp", f"scene-floors/sea-scatter-debris-{index:02d}-bastion-v2.webp")
        for index in range(1, 9)
    )
    redirects.extend(
        (f"scene-floors/sea-scatter-debris-{index:02d}-v3.webp", f"scene-floors/sea-scatter-debris-{index:02d}-bastion-v3.webp")
        for index in range(1, 9)
    )
    redirects.extend(
        (f"scene-floors/sea-scatter-fish-school-{index:02d}-v1.webp", f"scene-floors/sea-scatter-fish-school-{index:02d}-bastion-v1.webp")
        for index in range(1, 7)
    )
    redirects.extend(
        (f"scene-floors/sea-scatter-wreckage-{index:02d}-v{version}.webp", f"scene-floors/sea-scatter-wreckage-{index:02d}-bastion-v{version}.webp")
        for version in (1, 2)
        for index in range(1, 5)
    )
    redirects.extend(
        (f"scene-floors/sea-scatter-storm-foam-{index:02d}-v1.webp", f"scene-floors/sea-scatter-storm-foam-{index:02d}-bastion-v1.webp")
        for index in range(1, 3)
    )
    redirects.append(("scene-floors/sea-scatter-whirlpool-v1.webp", "scene-floors/sea-scatter-whirlpool-bastion-v1.webp"))
    redirects.append(("scene-floors/sea-scatter-whirlpool-dark-v1.webp", "scene-floors/sea-scatter-whirlpool-dark-bastion-v1.webp"))
    return redirects


def svg_size(path: Path) -> tuple[int, int]:
    root = ElementTree.parse(path).getroot()
    return int(float(root.attrib["width"])), int(float(root.attrib["height"]))


def validate() -> None:
    required_sea_logic = (
        'seaNaturalScatter(0.40)',
        '"sea-deep": floorStyle("SeaDeep", "Deep sea", "sea-deep-floor-v5.webp", null, DEEP_SEA_FLOOR_SCALE)',
        '"sea-stormy": floorStyle("SeaStormy", "Stormy sea", "sea-stormy-floor-v5.webp", null, STORMY_SEA_FLOOR_SCALE)',
        'assets: Object.freeze(scatterAssetSeries("sea-scatter-fish-shadow", 8, 0.25, 0.80, 1.45, 0.22, 1, 4, "fish-shadow"))',
        "const placementCounts = new Map();",
        'const orderRandom = seededRandom(`${seed}:nature-order`);',
    )
    if any(FLOOR_SOURCE.count(marker) != 1 for marker in required_sea_logic):
        raise AssertionError("Sea scatter limits or asset pools are incomplete")
    entries = manifest_entries()
    if not entries or len(entries) != len(set(entries)):
        raise AssertionError(f"Expected a non-empty unique manifest, got {len(entries)} / {len(set(entries))} unique")

    counts = {"scene-assets": 0, "scene-floors": 0, "scene-walls": 0}
    exact_alpha = 0
    worst_chroma = (0.0, "")
    for directory, filename in entries:
        reference_path = ROOT / "images" / directory / filename
        output_path = PRESET / directory / versioned(filename)
        if not reference_path.is_file() or not output_path.is_file():
            raise AssertionError(f"Missing pair: {reference_path} -> {output_path}")

        if reference_path.suffix.lower() == ".svg":
            if svg_size(reference_path) != svg_size(output_path):
                raise AssertionError(f"SVG dimensions changed: {filename}")
        else:
            with Image.open(reference_path) as reference, Image.open(output_path) as output:
                if reference.size != output.size:
                    raise AssertionError(f"Dimensions changed: {filename}: {reference.size} -> {output.size}")
                if directory != "scene-floors":
                    ref_alpha = reference.convert("RGBA").getchannel("A")
                    out_rgba = output.convert("RGBA")
                    out_alpha = out_rgba.getchannel("A")
                    if ImageChops.difference(ref_alpha, out_alpha).getbbox() is not None:
                        raise AssertionError(f"Alpha mask changed: {filename}")
                    red, green, blue, alpha = out_rgba.split()
                    magenta = ImageChops.multiply(
                        ImageChops.multiply(red.point(lambda v: 255 if v >= 170 else 0), blue.point(lambda v: 255 if v >= 170 else 0)),
                        ImageChops.multiply(green.point(lambda v: 255 if v <= 90 else 0), alpha.point(lambda v: 255 if v >= 32 else 0)),
                    )
                    visible = sum(alpha.histogram()[32:])
                    chroma_ratio = magenta.histogram()[255] / max(1, visible)
                    worst_chroma = max(worst_chroma, (chroma_ratio, filename))
                    exact_alpha += 1
                elif filename.startswith("rubble-"):
                    ref_alpha = reference.convert("RGBA").getchannel("A")
                    out_alpha = output.convert("RGBA").getchannel("A")
                    if ImageChops.difference(ref_alpha, out_alpha).getbbox() is not None:
                        raise AssertionError(f"Rubble alpha mask changed: {filename}")
                    if out_alpha.getextrema()[1] == 0:
                        raise AssertionError(f"Rubble overlay is fully transparent: {filename}")
        counts[directory] += 1

    if SOURCE.count("...Object.keys(BASTION_COMPLETE_TEXTURE_REDIRECTS)") != 1 or SOURCE.count("...BASTION_COMPLETE_TEXTURE_REDIRECTS,") != 1:
        raise AssertionError("Complete redirects must feed both the allowlist and redirect map")

    if worst_chroma[0] > 0.005:
        raise AssertionError(f"Visible magenta matte remains: {worst_chroma[1]} ({worst_chroma[0]:.2%})")

    scatter_entries = scatter_redirect_entries()
    for source_name, output_name in scatter_entries:
        reference_path = ROOT / "images" / source_name
        output_path = PRESET / output_name
        with Image.open(reference_path) as reference, Image.open(output_path) as output:
            if reference.size != output.size:
                raise AssertionError(f"Scatter dimensions changed: {source_name}: {reference.size} -> {output.size}")
            for path, image in ((reference_path, reference), (output_path, output)):
                alpha = image.convert("RGBA").getchannel("A")
                corners = [alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)),
                           alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1))]
                if alpha.getextrema()[1] == 0 or max(corners) != 0:
                    raise AssertionError(f"Invalid scatter alpha: {path}: {alpha.getextrema()}, corners={corners}")

    print(f"OK: {len(entries)} complete files + {len(scatter_entries)} scatter redirects; {counts}; exact raster alpha masks: {exact_alpha}; SVG dimensions preserved; worst visible chroma: {worst_chroma[0]:.3%}")


if __name__ == "__main__":
    validate()
