from __future__ import annotations

import argparse
import io
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


RASTER_EXTENSIONS = {".png", ".webp"}
VERSION_SUFFIX = "-base-refined-v1"


def versioned_name(name: str) -> str:
    path = Path(name)
    return f"{path.stem}{VERSION_SUFFIX}{path.suffix}"


def parse_manifest(source: str) -> list[str]:
    complete_match = re.search(
        r"const BASTION_COMPLETE_TEXTURE_FILES = Object\.freeze\(\{(.*?)\n\}\);",
        source,
        re.S,
    )
    set_match = re.search(r"const BASTION_TEXTURES = new Set\(\[(.*?)\n\]\);", source, re.S)
    if not complete_match or not set_match:
        raise RuntimeError("could not locate texture preset manifests")

    paths = set(re.findall(r'"((?:scene-assets|scene-floors|scene-walls)/[^"\\]+)"', set_match.group(1)))
    for directory, body in re.findall(
        r'"(scene-assets|scene-floors|scene-walls)": Object\.freeze\(\[(.*?)\]\)',
        complete_match.group(1),
        re.S,
    ):
        for filename in re.findall(r'"([^"\\]+)"', body):
            paths.add(f"{directory}/{filename}")
    return sorted(path for path in paths if Path(path).suffix.lower() in RASTER_EXTENSIONS)


def parse_bastion_redirects(source: str) -> dict[str, str]:
    match = re.search(
        r"const BASTION_TEXTURE_REDIRECTS = Object\.freeze\(\{(.*?)\n\}\);",
        source,
        re.S,
    )
    if not match:
        raise RuntimeError("could not locate Bastion redirects")
    return dict(re.findall(
        r'"((?:scene-assets|scene-floors|scene-walls)/[^"\\]+)"\s*:\s*"((?:scene-assets|scene-floors|scene-walls)/[^"\\]+)"',
        match.group(1),
    ))


def bastion_candidate(root: Path, logical: str, redirects: dict[str, str]) -> Path | None:
    preset_root = root / "images" / "presets" / "bastion-blasphemy"
    explicit = preset_root / redirects.get(logical, logical)
    if explicit.exists():
        return explicit
    path = Path(logical)
    conventional = preset_root / path.parent / f"{path.stem}-bastion-v2{path.suffix}"
    return conventional if conventional.exists() else None


def alpha_similarity(base: Image.Image, alternate: Image.Image) -> float:
    if base.size != alternate.size:
        return 0.0
    base_alpha = np.asarray(base.getchannel("A"), dtype=np.uint8) > 12
    alternate_alpha = np.asarray(alternate.getchannel("A"), dtype=np.uint8) > 12
    union = np.logical_or(base_alpha, alternate_alpha).sum()
    if union == 0:
        return 1.0
    return float(np.logical_and(base_alpha, alternate_alpha).sum() / union)


def transfer_material(base: Image.Image, detail: Image.Image, logical: str) -> Image.Image:
    base_rgba = base.convert("RGBA")
    detail_rgba = detail.convert("RGBA")
    base_alpha = np.asarray(base_rgba.getchannel("A"), dtype=np.uint8)
    visible = base_alpha > 24

    base_hsv = np.asarray(base_rgba.convert("RGB").convert("HSV"), dtype=np.float32)
    detail_hsv = np.asarray(detail_rgba.convert("RGB").convert("HSV"), dtype=np.float32)
    output = base_hsv.copy()
    saturation_scale = 0.7
    saturation_limit = 150.0
    value_scale = 1.0
    if any(token in logical for token in ("blood", "fire", "torch", "lantern", "gold", "stained")):
        saturation_scale = 0.82
        saturation_limit = 190.0
    if "border-green-fog" in logical:
        saturation_scale, saturation_limit, value_scale = 0.46, 118.0, 0.84
    elif "path-dirt" in logical:
        saturation_scale, saturation_limit, value_scale = 0.46, 112.0, 0.88
    elif "sea-shallow" in logical:
        saturation_scale, saturation_limit, value_scale = 0.55, 132.0, 0.9
    elif "roof-thatch" in logical:
        saturation_scale, saturation_limit, value_scale = 0.58, 136.0, 0.92
    elif "carpet" in logical:
        saturation_scale, saturation_limit = 0.62, 142.0
    elif any(token in logical for token in ("wood-alder", "stairs-wood-alder")):
        saturation_scale, saturation_limit = 0.6, 138.0
    output[..., 1] = np.minimum(base_hsv[..., 1] * saturation_scale, saturation_limit)

    if visible.any():
        source_values = detail_hsv[..., 2][visible]
        target_values = base_hsv[..., 2][visible]
        source_low, source_mid, source_high = np.percentile(source_values, (10, 50, 90))
        target_low, target_mid, target_high = np.percentile(target_values, (10, 50, 90))
        source_range = max(float(source_high - source_low), 8.0)
        target_range = max(float(target_high - target_low), 8.0)
        desired_mid = float(target_mid) * 0.94 + 118.0 * 0.06
        desired_range = min(max(target_range * 1.04, source_range * 0.82), target_range * 1.22)
        output[..., 2] = ((detail_hsv[..., 2] - float(source_mid)) * (desired_range / source_range) + desired_mid) * value_scale

    rgb = Image.fromarray(np.clip(output, 0, 255).astype(np.uint8), "HSV").convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.035)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.05, percent=58, threshold=3))
    result = rgb.convert("RGBA")
    result.putalpha(Image.fromarray(base_alpha, "L"))
    return result


def save_near_target(image: Image.Image, output: Path, target_bytes: int) -> tuple[int, int | None]:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.suffix.lower() == ".png":
        image.save(output, "PNG", optimize=True, compress_level=9)
        return output.stat().st_size, None

    best: tuple[float, bytes, int] | None = None
    for quality in (86, 90, 94):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=4)
        data = buffer.getvalue()
        size_score = abs(math.log(max(len(data), 1) / max(target_bytes, 1)))
        quality_penalty = max(0, 88 - quality) * 0.018
        score = size_score + quality_penalty
        if best is None or score < best[0]:
            best = (score, data, quality)
    assert best is not None
    output.write_bytes(best[1])
    return len(best[1]), best[2]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--report", type=Path, default=Path("tools/base-refined-preset-report.json"))
    parser.add_argument("--resume-existing", action="store_true")
    parser.add_argument("--match", help="optional regular expression selecting logical paths")
    args = parser.parse_args()
    root = args.root.resolve()
    registry_path = root / "scripts" / "utility" / "texture-presets.js"
    registry_source = registry_path.read_text(encoding="utf-8")
    manifest = parse_manifest(registry_source)
    if args.match:
        selector = re.compile(args.match)
        manifest = [path for path in manifest if selector.search(path)]
    redirects = parse_bastion_redirects(registry_source)

    report = []
    failures = []
    for logical in manifest:
        base_path = root / "images" / logical
        if not base_path.exists():
            failures.append({"path": logical, "reason": "missing base source"})
            continue
        output_path = root / "images" / "presets" / "enhanced-base" / Path(logical).parent / versioned_name(base_path.name)
        detail_path = bastion_candidate(root, logical, redirects)
        with Image.open(base_path) as opened_base:
            base = opened_base.convert("RGBA")
        if args.resume_existing and output_path.exists():
            with Image.open(output_path) as validation:
                base_alpha = np.asarray(base.getchannel("A"), dtype=np.uint8)
                output_alpha = (
                    np.asarray(validation.getchannel("A"), dtype=np.uint8)
                    if "A" in validation.getbands()
                    else np.full((validation.height, validation.width), 255, dtype=np.uint8)
                )
                valid = validation.size == base.size and np.array_equal(output_alpha, base_alpha)
            if valid:
                original_size = base_path.stat().st_size
                encoded_size = output_path.stat().st_size
                report.append({
                    "logical": logical,
                    "output": str(output_path.relative_to(root)).replace("\\", "/"),
                    "dimensions": list(base.size),
                    "detailSource": "existing refined output",
                    "alphaIoU": 1.0,
                    "originalBytes": original_size,
                    "outputBytes": encoded_size,
                    "weightRatio": round(encoded_size / max(original_size, 1), 3),
                    "webpQuality": None,
                })
                continue
        chosen = base
        detail_source = "base"
        alpha_iou = 1.0
        if detail_path:
            with Image.open(detail_path) as opened_detail:
                detail = opened_detail.convert("RGBA")
            alpha_iou = alpha_similarity(base, detail)
            if base.size == detail.size and alpha_iou >= 0.985:
                chosen = detail
                detail_source = str(detail_path.relative_to(root)).replace("\\", "/")

        refined = transfer_material(base, chosen, logical)
        original_size = base_path.stat().st_size
        encoded_size, quality = save_near_target(refined, output_path, original_size)
        with Image.open(output_path) as validation:
            if validation.size != base.size:
                failures.append({"path": logical, "reason": "dimension validation failed"})
                continue
            base_alpha = np.asarray(base.getchannel("A"), dtype=np.uint8)
            output_alpha = (
                np.asarray(validation.getchannel("A"), dtype=np.uint8)
                if "A" in validation.getbands()
                else np.full((validation.height, validation.width), 255, dtype=np.uint8)
            )
            if not np.array_equal(output_alpha, base_alpha):
                failures.append({"path": logical, "reason": "alpha mask changed"})
                continue
        report.append({
            "logical": logical,
            "output": str(output_path.relative_to(root)).replace("\\", "/"),
            "dimensions": list(base.size),
            "detailSource": detail_source,
            "alphaIoU": round(alpha_iou, 5),
            "originalBytes": original_size,
            "outputBytes": encoded_size,
            "weightRatio": round(encoded_size / max(original_size, 1), 3),
            "webpQuality": quality,
        })

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({"assets": report, "failures": failures}, indent=2), encoding="utf-8")
    print(f"refined={len(report)} failures={len(failures)} report={args.report}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
