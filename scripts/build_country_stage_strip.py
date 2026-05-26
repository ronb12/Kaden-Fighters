#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/generated/country-stage-concept-chatgpt.png"
OUT = ROOT / "assets/generated/country-stages-strip.png"

STAGE_W = 1280
STAGE_H = 720
COLS = 4
ROWS = 2


def cover_resize(img, w, h):
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    nw = max(1, round(sw * scale))
    nh = max(1, round(sh * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - w) // 2)
    top = max(0, (nh - h) // 2)
    return resized.crop((left, top, left + w, top + h))


def add_fight_readability(img):
    img = ImageEnhance.Color(img).enhance(1.08)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px = overlay.load()
    w, h = overlay.size
    for y in range(h):
        # Keep the floor readable under fighters and slightly tame the sky.
        a = 30 if y < h * 0.18 else 0
        if y > h * 0.64:
            a = max(a, int(34 * ((y - h * 0.64) / (h * 0.36))))
        for x in range(w):
            px[x, y] = (0, 0, 0, a)
    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=115, threshold=3))


def main():
    src = Image.open(SRC).convert("RGB")
    sw, sh = src.size
    tile_w = sw / COLS
    tile_h = sh / ROWS
    strip = Image.new("RGBA", (STAGE_W, STAGE_H * COLS * ROWS), (0, 0, 0, 255))

    for row in range(ROWS):
        for col in range(COLS):
            i = row * COLS + col
            pad_x = max(4, round(tile_w * 0.012))
            pad_y = max(4, round(tile_h * 0.012))
            left = round(col * tile_w + pad_x)
            top = round(row * tile_h + pad_y)
            right = round((col + 1) * tile_w - pad_x)
            bottom = round((row + 1) * tile_h - pad_y)
            tile = src.crop((left, top, right, bottom))
            tile = cover_resize(tile, STAGE_W, STAGE_H)
            tile = add_fight_readability(tile)
            strip.alpha_composite(tile, (0, i * STAGE_H))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    strip.convert("RGB").save(OUT, quality=94, optimize=True)
    print(f"Wrote {OUT} ({strip.size[0]}x{strip.size[1]})")


if __name__ == "__main__":
    main()
