#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/generated/astra_kaden_chatgpt.png"
ICONSET = ROOT / "ios/App/Kaden Fighters/Assets.xcassets/AppIcon.appiconset"

SLOTS = [
    ("iphone", "20x20", "2x", 40),
    ("iphone", "20x20", "3x", 60),
    ("iphone", "29x29", "2x", 58),
    ("iphone", "29x29", "3x", 87),
    ("iphone", "40x40", "2x", 80),
    ("iphone", "40x40", "3x", 120),
    ("iphone", "60x60", "2x", 120),
    ("iphone", "60x60", "3x", 180),
    ("ipad", "20x20", "1x", 20),
    ("ipad", "20x20", "2x", 40),
    ("ipad", "29x29", "1x", 29),
    ("ipad", "29x29", "2x", 58),
    ("ipad", "40x40", "1x", 40),
    ("ipad", "40x40", "2x", 80),
    ("ipad", "76x76", "1x", 76),
    ("ipad", "76x76", "2x", 152),
    ("ipad", "83.5x83.5", "2x", 167),
    ("ios-marketing", "1024x1024", "1x", 1024),
]


def alpha_components(image: Image.Image) -> list[tuple[int, int, int, int, int]]:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    visited = set()
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y] <= 20:
                continue

            queue = deque([(x, y)])
            visited.add((x, y))
            min_x = max_x = x
            min_y = max_y = y
            count = 0

            while queue:
                px, py = queue.popleft()
                count += 1
                min_x = min(min_x, px)
                max_x = max(max_x, px)
                min_y = min(min_y, py)
                max_y = max(max_y, py)

                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited and pixels[nx, ny] > 20:
                        visited.add((nx, ny))
                        queue.append((nx, ny))

            if count > 500:
                components.append((min_x, min_y, max_x + 1, max_y + 1, count))

    return components


def load_kaden_pose() -> Image.Image:
    sheet = Image.open(SOURCE).convert("RGBA")
    components = alpha_components(sheet)
    if not components:
        raise RuntimeError(f"No sprite components found in {SOURCE}")

    first_row = [box for box in components if box[1] < sheet.height * 0.45]
    pose_box = min(first_row or components, key=lambda box: (box[0], box[1]))
    x1, y1, x2, y2, _ = pose_box
    pad = 18
    crop = sheet.crop((max(0, x1 - pad), max(0, y1 - pad), min(sheet.width, x2 + pad), min(sheet.height, y2 + pad)))
    return crop


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_icon() -> Image.Image:
    size = 1024
    icon = Image.new("RGBA", (size, size), "#120c0d")
    draw = ImageDraw.Draw(icon)

    for radius, color in ((680, (154, 16, 28, 170)), (480, (238, 177, 60, 70)), (320, (0, 0, 0, 150))):
        overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.ellipse(
            ((size - radius) // 2, (size - radius) // 2, (size + radius) // 2, (size + radius) // 2),
            fill=color,
        )
        icon.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(50)))

    for offset in range(-900, 1100, 145):
        draw.line([(offset, size + 40), (offset + size + 40, -40)], fill=(255, 209, 92, 34), width=8)
    draw.rounded_rectangle((58, 58, 966, 966), radius=170, outline=(247, 194, 83, 210), width=22)
    draw.rounded_rectangle((92, 92, 932, 932), radius=145, outline=(230, 34, 43, 170), width=10)

    pose = load_kaden_pose()
    target_height = 705
    scale = target_height / pose.height
    pose = pose.resize((round(pose.width * scale), target_height), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", pose.size, (0, 0, 0, 210))
    shadow.putalpha(pose.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    pose_x = (size - pose.width) // 2
    pose_y = 170
    icon.alpha_composite(shadow, (pose_x + 18, pose_y + 28))
    icon.alpha_composite(pose, (pose_x, pose_y))

    label = "KF"
    label_font = font(194)
    bbox = draw.textbbox((0, 0), label, font=label_font, stroke_width=6)
    text_w = bbox[2] - bbox[0]
    text_x = (size - text_w) // 2
    text_y = 744
    draw.text((text_x + 8, text_y + 10), label, font=label_font, fill=(0, 0, 0, 185), stroke_width=7, stroke_fill=(0, 0, 0, 185))
    draw.text((text_x, text_y), label, font=label_font, fill=(255, 232, 150, 255), stroke_width=7, stroke_fill=(84, 9, 17, 255))

    return icon.convert("RGB")


def main() -> None:
    ICONSET.mkdir(parents=True, exist_ok=True)
    for path in ICONSET.glob("*.png"):
        path.unlink()

    base = make_icon()
    images = []
    for idiom, logical_size, scale, pixels in SLOTS:
        filename = f"AppIcon-{idiom}-{logical_size.replace('.', '_')}@{scale}.png"
        output = ICONSET / filename
        resized = base.resize((pixels, pixels), Image.Resampling.LANCZOS)
        resized.save(output)
        images.append(
            {
                "filename": filename,
                "idiom": idiom,
                "scale": scale,
                "size": logical_size,
            }
        )

    contents = {
        "images": images,
        "info": {
            "author": "xcode",
            "version": 1,
        },
    }
    (ICONSET / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")


if __name__ == "__main__":
    main()
