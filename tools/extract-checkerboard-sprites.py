"""Recover transparent VTT sprites from ImageGen's baked checkerboard preview."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import binary_dilation, distance_transform_edt, label


def recover_alpha(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    lightness_gap = 255.0 - rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    # The generated matte alternates around RGB 243 and 254. Subject pixels are
    # either darker or chromatic, including softly antialiased grass/water edges.
    evidence = lightness_gap + chroma * 2.2
    alpha = np.clip((evidence - 42.0) / 92.0, 0.0, 1.0)
    alpha = np.asarray(
        Image.fromarray(np.uint8(alpha * 255), "L").filter(ImageFilter.GaussianBlur(0.65)),
        dtype=np.float32,
    ) / 255.0
    alpha[alpha < 0.07] = 0.0
    components, count = label(alpha > 0)
    if count:
        areas = np.bincount(components.ravel())
        areas[0] = 0
        alpha[components != int(areas.argmax())] = 0.0

    solid = alpha >= 0.88
    if solid.any():
        # Replace checker-contaminated fringe RGB with the closest solid subject
        # colour. Correct RGB under soft alpha prevents pale square halos in PIXI.
        _, indices = distance_transform_edt(~solid, return_indices=True)
        nearest = rgb[indices[0], indices[1]]
        fringe_mix = np.clip((0.88 - alpha) / 0.58, 0.0, 1.0)[..., None]
        rgb = rgb * (1.0 - fringe_mix) + nearest * fringe_mix

    rgba = np.dstack((np.uint8(np.clip(rgb, 0, 255)), np.uint8(alpha * 255)))
    return Image.fromarray(rgba, "RGBA")


def recover_magenta(image: Image.Image, dark_objects: bool = False) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    red, green, blue = (rgb[..., index] for index in range(3))
    magenta = (
        (red > green * 1.18 + 18.0)
        & (blue > green * 1.18 + 18.0)
        & ((red + blue) * 0.5 > 90.0)
    )
    subject = ~magenta
    if dark_objects:
        core = subject & (rgb.mean(axis=2) < 142.0)
        components, count = label(core)
        if count:
            areas = np.bincount(components.ravel())
            keep = np.flatnonzero(areas >= 40)
            keep = keep[keep != 0]
            core = np.isin(components, keep)
        subject &= binary_dilation(core, iterations=10)
    alpha_image = Image.fromarray(np.uint8(subject) * 255, "L").filter(ImageFilter.MinFilter(5))
    alpha = np.asarray(alpha_image, dtype=np.uint8)
    components, count = label(alpha > 0)
    if count:
        areas = np.bincount(components.ravel())
        keep = np.flatnonzero(areas >= 48)
        keep = keep[keep != 0]
        alpha = np.where(np.isin(components, keep), 255, 0).astype(np.uint8)
    rgba = np.dstack((np.uint8(np.clip(rgb, 0, 255)), alpha))
    return Image.fromarray(rgba, "RGBA")


def recover_black(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    evidence = rgb.max(axis=2)
    white_matte = (rgb.min(axis=2) > 220) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 18)
    evidence[white_matte] = 0
    alpha = np.clip((evidence - 7.0) / 30.0, 0.0, 1.0)
    components, count = label(alpha > 0.08)
    if count:
        areas = np.bincount(components.ravel())
        areas[0] = 0
        alpha[components != int(areas.argmax())] = 0.0
    alpha = np.array(
        Image.fromarray(np.uint8(alpha * 255), "L").filter(ImageFilter.GaussianBlur(0.55)),
        dtype=np.uint8,
        copy=True,
    )
    alpha[alpha < 10] = 0
    solid = alpha >= 220
    if solid.any():
        _, indices = distance_transform_edt(~solid, return_indices=True)
        nearest = rgb[indices[0], indices[1]]
        fringe = ((alpha > 0) & (alpha < 220))[..., None]
        rgb = np.where(fringe, nearest, rgb)
    return Image.fromarray(np.dstack((np.uint8(np.clip(rgb, 0, 255)), alpha)), "RGBA")


def clean_generated_edge_chroma(image: Image.Image) -> Image.Image:
    """Remove isolated saturated preview artefacts along generated alpha edges."""
    pixels = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    rgb = pixels[..., :3].astype(np.float32)
    alpha = pixels[..., 3]
    visible = alpha > 0
    inward = distance_transform_edt(visible)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturated = (maximum > 180) & (minimum < 32) & ((maximum - minimum) > 155)
    artefact = visible & (inward <= 5.0) & saturated
    valid = visible & ~artefact & (alpha >= 96)
    if artefact.any() and valid.any():
        _, indices = distance_transform_edt(~valid, return_indices=True)
        pixels[..., :3][artefact] = pixels[..., :3][indices[0], indices[1]][artefact]
    return Image.fromarray(pixels, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("outputs", nargs="+", type=Path)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--stretch", action="store_true")
    parser.add_argument("--bastion-grade", action="store_true")
    parser.add_argument("--edge-fade", type=float, default=0.0)
    parser.add_argument("--magenta-key", action="store_true")
    parser.add_argument("--black-key", action="store_true")
    parser.add_argument("--dark-objects", action="store_true")
    parser.add_argument("--glass", nargs=4, type=float, metavar=("X", "Y", "WIDTH", "HEIGHT"))
    parser.add_argument("--glass-shape", choices=("rect", "ellipse"), default="rect")
    args = parser.parse_args()

    opened = Image.open(args.input)
    source = opened.convert("RGB")
    source_alpha = opened.getchannel("A") if "A" in opened.getbands() else None
    cell_width = source.width // len(args.outputs)
    for index, output in enumerate(args.outputs):
        left = index * cell_width
        right = source.width if index == len(args.outputs) - 1 else (index + 1) * cell_width
        cell = source.crop((left, 0, right, source.height))
        alpha_cell = source_alpha.crop((left, 0, right, source.height)) if source_alpha is not None else None
        if alpha_cell is not None and alpha_cell.getextrema()[0] < 255:
            sprite = cell.convert("RGBA")
            sprite.putalpha(alpha_cell)
        else:
            if args.magenta_key:
                sprite = recover_magenta(cell, args.dark_objects)
            elif args.black_key:
                sprite = recover_black(cell)
            else:
                sprite = recover_alpha(cell)
        target_width = args.width or args.size
        target_height = args.height or args.size
        preserve_canvas = alpha_cell is not None and sprite.size == (target_width, target_height)
        bbox = sprite.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError(f"No subject recovered from atlas cell {index}")
        if preserve_canvas:
            resized = sprite
        else:
            crop = sprite.crop(bbox)
            padding = max(12, round(min(target_width, target_height) * 0.045))
            inner_width = target_width - padding * 2
            inner_height = target_height - padding * 2
            if args.stretch:
                resized_size = (inner_width, inner_height)
            else:
                scale = min(inner_width / crop.width, inner_height / crop.height)
                resized_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
            resized = crop.resize(resized_size, Image.Resampling.LANCZOS)
        resized = clean_generated_edge_chroma(resized)
        if args.bastion_grade:
            pixels = np.asarray(resized, dtype=np.uint8).copy()
            rgb = pixels[..., :3].astype(np.float32)
            gray = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
            rgb = rgb * 0.20 + gray[..., None] * 0.80 + np.array([2.0, 3.0, 5.0])
            pixels[..., :3] = np.uint8(np.clip(rgb, 0, 255))
            resized = Image.fromarray(pixels, "RGBA")
        if preserve_canvas:
            canvas = resized
        else:
            canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
            canvas.alpha_composite(resized, ((target_width - resized.width) // 2, (target_height - resized.height) // 2))
        if args.glass:
            x, y, width, height = args.glass
            scale = 4
            mask = Image.new("L", (target_width * scale, target_height * scale), 0)
            draw = ImageDraw.Draw(mask)
            box = tuple(round(value * scale) for value in (
                x * target_width,
                y * target_height,
                (x + width) * target_width,
                (y + height) * target_height,
            ))
            if args.glass_shape == "ellipse":
                draw.ellipse(box, fill=255)
            else:
                draw.rectangle(box, fill=255)
            mask = mask.resize((target_width, target_height), Image.Resampling.LANCZOS)
            alpha = np.asarray(canvas.getchannel("A"), dtype=np.uint16)
            cut = np.asarray(mask, dtype=np.uint16)
            canvas.putalpha(Image.fromarray(np.uint8(alpha * (255 - cut) // 255), "L"))
        if args.edge_fade > 0:
            pixels = np.asarray(canvas, dtype=np.uint8).copy()
            alpha_values = pixels[..., 3].astype(np.float32) / 255.0
            inward = distance_transform_edt(alpha_values > 0)
            fade = np.clip((inward - 0.5) / args.edge_fade, 0.0, 1.0)
            fade = fade * fade * (3.0 - 2.0 * fade)
            pixels[..., 3] = np.uint8(alpha_values * fade * 255.0)
            canvas = Image.fromarray(pixels, "RGBA")
        output.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output, "WEBP", lossless=True, quality=100, method=6)
        alpha = canvas.getchannel("A")
        corners = [alpha.getpixel((0, 0)), alpha.getpixel((target_width - 1, 0)),
                   alpha.getpixel((0, target_height - 1)), alpha.getpixel((target_width - 1, target_height - 1))]
        print(f"{output}: {canvas.size}, alpha={alpha.getextrema()}, corners={corners}")


if __name__ == "__main__":
    main()
