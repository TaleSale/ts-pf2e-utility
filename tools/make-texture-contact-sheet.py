from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--cell", type=int, default=220)
    parser.add_argument("--columns", type=int, default=6)
    args = parser.parse_args()

    label_height = 42
    rows = (len(args.inputs) + args.columns - 1) // args.columns
    sheet = Image.new("RGB", (args.columns * args.cell, rows * (args.cell + label_height)), "#242424")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, path in enumerate(args.inputs):
        with Image.open(path) as source:
            image = source.convert("RGBA")
            backdrop = Image.new("RGBA", image.size, "#777777")
            backdrop.alpha_composite(image)
            image = backdrop.convert("RGB")
            image.thumbnail((args.cell - 12, args.cell - 12), Image.Resampling.LANCZOS)
        col = index % args.columns
        row = index // args.columns
        x = col * args.cell + (args.cell - image.width) // 2
        y = row * (args.cell + label_height) + (args.cell - image.height) // 2
        sheet.paste(image, (x, y))
        label = path.name
        draw.text((col * args.cell + 6, row * (args.cell + label_height) + args.cell + 4), label[:35], fill="white", font=font)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, quality=92)


if __name__ == "__main__":
    main()
