"""Validate geometry, alpha masks, and manifest coverage for the Bastion preset."""

from __future__ import annotations

import re
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
PRESET = ROOT / "images" / "presets" / "bastion-blasphemy"
SOURCE = (ROOT / "scripts" / "utility" / "texture-presets.js").read_text(encoding="utf-8")


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


def svg_size(path: Path) -> tuple[int, int]:
    root = ElementTree.parse(path).getroot()
    return int(float(root.attrib["width"])), int(float(root.attrib["height"]))


def validate() -> None:
    entries = manifest_entries()
    if len(entries) != 123 or len(entries) != len(set(entries)):
        raise AssertionError(f"Expected 123 unique manifest entries, got {len(entries)} / {len(set(entries))} unique")

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
        counts[directory] += 1

    if SOURCE.count("...Object.keys(BASTION_COMPLETE_TEXTURE_REDIRECTS)") != 1 or SOURCE.count("...BASTION_COMPLETE_TEXTURE_REDIRECTS,") != 1:
        raise AssertionError("Complete redirects must feed both the allowlist and redirect map")

    if worst_chroma[0] > 0.005:
        raise AssertionError(f"Visible magenta matte remains: {worst_chroma[1]} ({worst_chroma[0]:.2%})")

    print(f"OK: {len(entries)} files; {counts}; exact raster alpha masks: {exact_alpha}; SVG dimensions preserved; worst visible chroma: {worst_chroma[0]:.3%}")


if __name__ == "__main__":
    validate()
