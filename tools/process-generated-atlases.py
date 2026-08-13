"""Split generated chroma-key atlases into project WebP assets."""

from pathlib import Path
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "generated-atlases"
ASSETS = ROOT / "images" / "scene-assets"
FLOORS = ROOT / "images" / "scene-floors"


def remove_magenta(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if (red > 180 and blue > 180 and green < 120) or (red > 90 and blue > 90 and red > green * 1.45 and blue > green * 1.45):
                pixels[x, y] = (red, green, blue, 0)
    image.putalpha(image.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return image


def crop_object(cell: Image.Image, output: Path, maximum: int = 1024) -> None:
    cell = remove_magenta(cell)
    bounds = cell.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"No visible object for {output.name}")
    cell = cell.crop(bounds)
    padding = max(8, round(max(cell.size) * 0.035))
    padded = Image.new("RGBA", (cell.width + padding * 2, cell.height + padding * 2))
    padded.alpha_composite(cell, (padding, padding))
    if max(padded.size) > maximum:
        scale = maximum / max(padded.size)
        padded = padded.resize((round(padded.width * scale), round(padded.height * scale)), Image.Resampling.LANCZOS)
    padded.save(output, "WEBP", quality=91, method=6, exact=True)


def split_row(source: str, names: list[str | None], cuts: list[float] | None = None) -> None:
    image = Image.open(SOURCE / source)
    boundaries = [round(value * image.width) for value in cuts] if cuts else [round(index * image.width / len(names)) for index in range(len(names) + 1)]
    for index, name in enumerate(names):
        if name is None:
            continue
        left, right = boundaries[index], boundaries[index + 1]
        crop_object(image.crop((left, 0, right, image.height)), ASSETS / f"{name}.webp")


def split_grid(source: str, names: list[str], columns: int = 3, rows: int | None = None) -> None:
    image = Image.open(SOURCE / source).convert("RGB")
    rows = rows or (len(names) + columns - 1) // columns
    cell_width, cell_height = image.width / columns, image.height / rows
    for index, name in enumerate(names):
        column, row = index % columns, index // columns
        box = (round(column * cell_width), round(row * cell_height), round((column + 1) * cell_width), round((row + 1) * cell_height))
        tile = image.crop(box)
        if index < 6:
            inset = round(min(tile.size) * (0.28 if index < 3 else 0.12))
            tile = tile.crop((inset, inset, tile.width - inset, tile.height - inset))
        tile = tile.resize((1024, 1024), Image.Resampling.LANCZOS)
        tile.save(FLOORS / f"{name}-floor.webp", "WEBP", quality=92, method=6)


def process_border(source: str, output: str) -> None:
    image = remove_magenta(Image.open(SOURCE / source))
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Border source has no visible pixels")
    strip = image.crop(bounds).resize((200, 40), Image.Resampling.LANCZOS)
    texture = Image.new("RGBA", (200, 200))
    texture.alpha_composite(strip, (0, 80))
    texture.save(ROOT / "images" / "scene-walls" / output, "WEBP", quality=92, method=6, exact=True)


def process_wall_source(source: str, output: str) -> None:
    image = Image.open(SOURCE / source).convert("RGB").resize((200, 200), Image.Resampling.LANCZOS)
    image.save(ROOT / "images" / "scene-walls" / output, "WEBP", quality=93, method=6)


def process_edge_strip(source: str, output: str, height: int = 16) -> None:
    image = remove_magenta(Image.open(SOURCE / source))
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"Edge strip {source} has no visible pixels")
    strip = image.crop(bounds)
    strip = strip.resize((1024, height), Image.Resampling.LANCZOS)
    strip.save(FLOORS / output, "WEBP", quality=93, method=6, exact=True)


def process_carpet_corner(edge_filename: str, corner_filename: str) -> None:
    edge = Image.open(FLOORS / edge_filename).convert("RGBA")
    sample_width = min(160, edge.width)
    left = (edge.width - sample_width) // 2
    sample = edge.crop((left, 0, left + sample_width, edge.height)).resize((32, 32), Image.Resampling.LANCZOS)
    rotations = [sample, sample.transpose(Image.Transpose.ROTATE_90), sample.transpose(Image.Transpose.ROTATE_180), sample.transpose(Image.Transpose.ROTATE_270)]
    channels = [list(image.getdata()) for image in rotations]
    corner = Image.new("RGBA", (32, 32))
    corner.putdata([tuple(round(sum(pixel[channel] for pixel in pixels) / 4) for channel in range(4)) for pixels in zip(*channels)])
    corner.save(FLOORS / corner_filename, "WEBP", lossless=True, method=6, exact=True)


def process_seamless_replacement(source: str, output: str) -> None:
    """Guarantee matching outer edges by assembling a mirrored four-quadrant repeat."""
    image = Image.open(SOURCE / source).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    texture = Image.new("RGB", (1024, 1024))
    texture.paste(image, (0, 0))
    texture.paste(image.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (512, 0))
    texture.paste(image.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, 512))
    texture.paste(image.transpose(Image.Transpose.FLIP_LEFT_RIGHT).transpose(Image.Transpose.FLIP_TOP_BOTTOM), (512, 512))
    texture.save(FLOORS / output, "WEBP", lossless=True, method=6, exact=True)


def process_seamless_edge_blend(source: str, output: str, band: int = 64) -> None:
    """Match opposite edges while preserving stochastic detail and avoiding mirrored repeats."""
    image = Image.open(SOURCE / source).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    pixels = image.load()
    width, height = image.size

    for distance in range(band):
        strength = (1 - distance / band) ** 2
        left_x, right_x = distance, width - 1 - distance
        for y in range(height):
            left, right = pixels[left_x, y], pixels[right_x, y]
            average = tuple(round((a + b) / 2) for a, b in zip(left, right))
            pixels[left_x, y] = tuple(round(a + (m - a) * strength) for a, m in zip(left, average))
            pixels[right_x, y] = tuple(round(a + (m - a) * strength) for a, m in zip(right, average))

    for distance in range(band):
        strength = (1 - distance / band) ** 2
        top_y, bottom_y = distance, height - 1 - distance
        for x in range(width):
            top, bottom = pixels[x, top_y], pixels[x, bottom_y]
            average = tuple(round((a + b) / 2) for a, b in zip(top, bottom))
            pixels[x, top_y] = tuple(round(a + (m - a) * strength) for a, m in zip(top, average))
            pixels[x, bottom_y] = tuple(round(a + (m - a) * strength) for a, m in zip(bottom, average))

    image.save(FLOORS / output, "WEBP", lossless=True, method=6, exact=True)


ASSETS.mkdir(parents=True, exist_ok=True)
FLOORS.mkdir(parents=True, exist_ok=True)
split_row("beds.png", ["bed-oak", "bed-blue", "bed-fur", "double-bed-red", "double-bed-linen"], [0, .17, .335, .515, .74, 1])
split_row("hearths.png", ["wall-torch-iron", "wall-torch-bracket", None, None, "stairs-wood-straight", "stairs-wood-rustic"], [0, .137, .29, .488, .688, .852, 1])
split_row("camp.png", ["bedroll-green", "bedroll-fur", "bedroll-blue", "campfire-stones", "campfire-embers"], [0, .203, .396, .583, .772, 1])
split_row("washroom.png", ["bathtub-wood", "bathtub-copper", "sink-wood", "sink-stone", "toilet-board-oak", "toilet-board-alder", "toilet-board-walnut"], [0, .161, .32, .461, .598, .732, .862, 1])
split_grid("floors.png", ["carpet-red-ornate", "carpet-blue-heraldic", "carpet-green-gold", "garden-cabbage", "garden-carrot", "garden-herbs"], rows=3)
if (SOURCE / "messy-beds-stairs.png").exists():
    split_row("messy-beds-stairs.png", ["bed-messy-blue", "bed-messy-brown", "stairs-wood-square", "stairs-stone-square"])
if (SOURCE / "border-trim.png").exists():
    process_border("border-trim.png", "border-wood-stone.webp")
for edge_source, edge_output in [
    ("carpet-edge-red.png", "carpet-edge-red.webp"),
    ("carpet-edge-blue.png", "carpet-edge-blue.webp"),
    ("carpet-edge-green.png", "carpet-edge-green.webp"),
]:
    if (SOURCE / edge_source).exists():
        process_edge_strip(edge_source, edge_output)
if (SOURCE / "path-dirt-edge.png").exists():
    process_edge_strip("path-dirt-edge.png", "path-dirt-edge.webp", 24)
for color in ("red", "blue", "green"):
    process_carpet_corner(f"carpet-edge-{color}-v2.webp", f"carpet-corner-{color}-v2.webp")
for replacement_source, replacement_output in [
    ("garden-cabbage-v2.png", "garden-cabbage-floor.webp"),
    ("garden-carrot-v2.png", "garden-carrot-floor.webp"),
    ("garden-herbs-v2.png", "garden-herbs-floor.webp"),
]:
    if (SOURCE / replacement_source).exists():
        process_seamless_replacement(replacement_source, replacement_output)
if (SOURCE / "cave-grey-pebbles-v2.png").exists():
    process_seamless_edge_blend("cave-grey-pebbles-v2.png", "cave-grey-pebbles-floor-v2.webp")
if (SOURCE / "carpet-blue-ornate-v2.png").exists():
    process_seamless_edge_blend("carpet-blue-ornate-v2.png", "carpet-blue-ornate-floor-v2.webp", 48)
for source, output in [
    ("sea-shallow.png", "sea-shallow-floor.webp"),
    ("sea-deep.png", "sea-deep-floor.webp"),
    ("sea-stormy.png", "sea-stormy-floor.webp"),
    ("roof-thatch.png", "roof-thatch-floor.webp"),
    ("roof-shingles.png", "roof-shingles-floor.webp"),
    ("roof-tiles.png", "roof-tiles-floor.webp"),
]:
    if (SOURCE / source).exists():
        process_seamless_edge_blend(source, output, 48)
for source, output in [
    ("cliff-limestone.png", "cliff-limestone.webp"),
    ("cliff-sandy.png", "cliff-sandy.webp"),
    ("cliff-volcanic.png", "cliff-volcanic.webp"),
    ("battlement-stone.png", "battlement-stone.webp"),
    ("battlement-brick.png", "battlement-brick.webp"),
    ("hedge-maze.png", "hedge-maze.webp"),
    ("arrow-slit-straight.png", "arrow-slit-straight.webp"),
    ("arrow-slit-cross.png", "arrow-slit-cross.webp"),
]:
    if (SOURCE / source).exists():
        process_wall_source(source, output)
for source, output in [
    ("stonehenge-circle.png", "stonehenge-circle.webp"),
    ("stonehenge-fangs.png", "stonehenge-fangs.webp"),
    ("stonehenge-trilithon-circle-v2.png", "stonehenge-trilithon-circle-v2.webp"),
    ("standing-stone-broad.png", "standing-stone-broad.webp"),
    ("standing-stone-narrow.png", "standing-stone-narrow.webp"),
    ("standing-stone-crooked.png", "standing-stone-crooked.webp"),
]:
    if (SOURCE / source).exists():
        crop_object(Image.open(SOURCE / source), ASSETS / output)
