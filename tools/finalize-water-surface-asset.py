from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def largest_component(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best: list[tuple[int, int]] = []
    for start_y, start_x in zip(*np.nonzero(mask & ~seen)):
        queue = deque([(int(start_y), int(start_x))])
        seen[start_y, start_x] = True
        component: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            component.append((y, x))
            for next_y, next_x in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= next_y < height and 0 <= next_x < width and mask[next_y, next_x] and not seen[next_y, next_x]:
                    seen[next_y, next_x] = True
                    queue.append((next_y, next_x))
        if len(component) > len(best):
            best = component
    result = np.zeros_like(mask, dtype=bool)
    if best:
        ys, xs = zip(*best)
        result[np.asarray(ys), np.asarray(xs)] = True
    return result


def generated_object_crop(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    hsv = np.asarray(image.convert("HSV"), dtype=np.uint8)
    foreground = (rgb.max(axis=2) < 225) | (hsv[..., 1] > 28)
    ys, xs = np.nonzero(foreground)
    if not len(xs):
        raise ValueError("generated input contains no detectable foreground")
    padding = max(2, round(max(image.size) * 0.004))
    box = (
        max(0, int(xs.min()) - padding),
        max(0, int(ys.min()) - padding),
        min(image.width, int(xs.max()) + padding + 1),
        min(image.height, int(ys.max()) + padding + 1),
    )
    return image.convert("RGB").crop(box)


def water_mask(reference: Image.Image, kind: str, dark: bool) -> Image.Image:
    rgba = np.asarray(reference.convert("RGBA"), dtype=np.int16)
    red, green, blue, alpha = [rgba[..., index] for index in range(4)]
    if kind == "puddle":
        candidate = (blue - red > (2 if dark else 5)) & (blue - green > (0 if dark else 2))
        erode = 11
        blur = 6
    else:
        candidate = (green - red > (4 if dark else 10)) & (blue - red > (3 if dark else 8))
        erode = 19
        blur = 9
    candidate &= alpha > 220
    mask = Image.fromarray(np.uint8(candidate) * 255, "L")
    mask = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    component = largest_component(np.asarray(mask, dtype=np.uint8) > 127)
    mask = Image.fromarray(np.uint8(component) * 255, "L")
    mask = mask.filter(ImageFilter.MinFilter(erode)).filter(ImageFilter.GaussianBlur(blur))
    return mask


def apply_detail(reference: Image.Image, generated: Image.Image, mask: Image.Image, strength: float) -> Image.Image:
    target = reference.convert("RGBA")
    alpha = target.getchannel("A")
    alpha_box = alpha.getbbox()
    if alpha_box is None:
        raise ValueError("reference input is fully transparent")

    crop = generated_object_crop(generated)
    fitted = crop.resize((alpha_box[2] - alpha_box[0], alpha_box[3] - alpha_box[1]), Image.Resampling.LANCZOS)
    generated_canvas = Image.new("RGB", target.size)
    generated_canvas.paste(fitted, alpha_box[:2])

    gray = generated_canvas.convert("L")
    radius = max(2.0, min(target.size) / 120.0)
    low = gray.filter(ImageFilter.GaussianBlur(radius))
    detail = np.asarray(gray, dtype=np.float64) - np.asarray(low, dtype=np.float64)
    detail = np.clip(detail, -30.0, 30.0) * float(strength)

    original = np.asarray(target.convert("RGB"), dtype=np.float64)
    weight = np.asarray(mask, dtype=np.float64)[..., None] / 255.0
    enhanced = original + detail[..., None] * weight

    active = weight[..., 0] > 0.1
    for channel in range(3):
        values = original[..., channel][active]
        if len(values):
            low_value, high_value = np.percentile(values, (0.1, 99.9))
            enhanced[..., channel] = np.clip(enhanced[..., channel], low_value, high_value)

    result = Image.fromarray(np.uint8(np.clip(enhanced, 0, 255)), "RGB").convert("RGBA")
    result.putalpha(alpha)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=("pond", "lake", "puddle"))
    parser.add_argument("--dark", action="store_true")
    parser.add_argument("--strength", type=float, default=0.8)
    args = parser.parse_args()

    with Image.open(args.reference) as source:
        reference = source.convert("RGBA")
    with Image.open(args.input) as source:
        generated = source.convert("RGB")

    mask = water_mask(reference, args.kind, args.dark)
    result = apply_detail(reference, generated, mask, args.strength)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, "WEBP", quality=94, method=6, exact=True)

    with Image.open(args.output) as validation:
        if validation.size != reference.size or "A" not in validation.getbands():
            raise RuntimeError("output validation failed")
        original_alpha = np.asarray(reference.getchannel("A"), dtype=np.int16)
        output_alpha = np.asarray(validation.getchannel("A"), dtype=np.int16)
        alpha_difference = int(np.abs(original_alpha - output_alpha).max())
        corners = [output_alpha[0, 0], output_alpha[0, -1], output_alpha[-1, 0], output_alpha[-1, -1]]
        if alpha_difference > 3 or max(corners) != 0:
            raise RuntimeError(f"alpha validation failed: difference={alpha_difference}, corners={corners}")
        coverage = float(np.asarray(mask, dtype=np.float64).mean() / 255.0)
        print(f"{args.output}: {validation.width}x{validation.height}, alpha-diff={alpha_difference}, water-mask={coverage:.3f}")


if __name__ == "__main__":
    main()
