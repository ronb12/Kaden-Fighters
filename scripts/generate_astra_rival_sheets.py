#!/usr/bin/env python3
"""
Generate ASTRA-format sheets (1376x768, 2x5 cells) for Raijin, Hikari, Ren, Yuki.
Checker mat + simple pose shapes per cell — matches Sprite Lab / kfr-game.js grid.
Replace with hand-drawn Sprite Lab exports when you want final art.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw

W, H = 1376, 768
CELL_H = 384
COLS = 5
# col 0-3: 275px; col 4: 276px (total 1376)
LAST_COL_W = W - 4 * 275


def cell_x(c: int) -> int:
    return c * 275


def cell_w(c: int) -> int:
    return LAST_COL_W if c == 4 else 275


# Row0: idle, idle2, walk0, walk1, jump  |  Row1: jab, cross, kick, special, super
POSES = [
    ["idle", "idle2", "walk0", "walk1", "jump"],
    ["jab", "cross", "kick", "special", "super"],
]


def draw_checker(draw: ImageDraw.ImageDraw, x0: int, y0: int, cw: int, ch: int, a: tuple, b: tuple) -> None:
    size = 18
    for yy in range(ch):
        for xx in range(cw):
            t = ((xx // size) + (yy // size)) % 2
            c = a if t == 0 else b
            px, py = x0 + xx, y0 + yy
            draw.rectangle([px, py, px + 1, py + 1], fill=c[:3])


def draw_fighter(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    skin: tuple[int, int, int],
    suit: tuple[int, int, int],
    accent: tuple[int, int, int],
) -> None:
    mcx = x0 + cw // 2
    head_cy = y0 + 78
    body_y1 = y0 + 118
    body_h = 92
    leg_top = body_y1 + body_h

    def ell(cx, cy, rx, ry, fill):
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)

    def rect(x1, y1, x2, y2, fill):
        draw.rectangle([x1, y1, x2, y2], fill=fill)

    ell(mcx, head_cy, 22, 24, skin)
    rect(mcx - 30, body_y1, mcx + 30, body_y1 + body_h, suit)
    rect(mcx - 26, leg_top, mcx - 5, y0 + CELL_H - 10, suit)
    rect(mcx + 5, leg_top, mcx + 26, y0 + CELL_H - 10, suit)

    if pose == "walk0":
        rect(mcx - 28, leg_top + 18, mcx - 2, y0 + CELL_H - 24, suit)
    elif pose == "walk1":
        rect(mcx + 2, leg_top + 18, mcx + 30, y0 + CELL_H - 24, suit)
    elif pose == "jump":
        rect(mcx - 18, leg_top - 25, mcx - 2, leg_top + 48, suit)
        rect(mcx + 2, leg_top - 25, mcx + 18, leg_top + 48, suit)

    if pose in ("jab",):
        rect(mcx + 22, body_y1 + 4, x0 + cw - 18, body_y1 + 32, skin)
        ell(x0 + cw - 28, body_y1 + 16, 11, 11, skin)
    elif pose == "cross":
        rect(x0 + 18, body_y1 + 2, mcx - 24, body_y1 + 30, skin)
    elif pose == "kick":
        rect(mcx + 8, leg_top - 8, mcx + 88, leg_top + 22, skin)
        ell(mcx + 82, leg_top + 8, 13, 13, skin)
    elif pose in ("special", "super"):
        rect(mcx - 42, body_y1 - 42, mcx - 4, body_y1 - 4, accent)
        rect(mcx + 4, body_y1 - 42, mcx + 42, body_y1 - 4, accent)
        rect(mcx - 8, body_y1 + 20, mcx + 8, body_y1 + 70, suit)
    else:
        rect(mcx - 58, body_y1 + 2, mcx - 18, body_y1 + 30, skin)
        rect(mcx + 18, body_y1 + 2, mcx + 58, body_y1 + 30, skin)


def build_sheet(pal: dict) -> Image.Image:
    im = Image.new("RGB", (W, H), (20, 20, 28))
    dr = ImageDraw.Draw(im)
    ca, cb = pal["check_a"], pal["check_b"]
    skin, suit, acc = pal["skin"], pal["suit"], pal["accent"]

    for row in range(2):
        y0 = row * CELL_H
        for col in range(COLS):
            cw = cell_w(col)
            x0 = cell_x(col)
            draw_checker(dr, x0, y0, cw, CELL_H, ca, cb)
            pose = POSES[row][col]
            draw_fighter(dr, x0, y0, cw, pose, skin, suit, acc)
    return im


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets = os.path.join(root, "assets")
    os.makedirs(assets, exist_ok=True)
    # Checker tiles must be near-neutral RGB (max−min < 16 per pixel) so kfr-game.js
    # isAstraCheckerMat + keyAstraFloodKeyBackground clear the mat in roster & gameplay.
    sheets = {
        "astra_raijin.png": {
            "check_a": (210, 211, 213),
            "check_b": (192, 194, 196),
            "skin": (255, 218, 198),
            "suit": (38, 78, 178),
            "accent": (255, 228, 72),
        },
        "astra_hikari.png": {
            "check_a": (222, 216, 220),
            "check_b": (204, 200, 206),
            "skin": (255, 210, 225),
            "suit": (198, 38, 108),
            "accent": (255, 160, 195),
        },
        "astra_ren.png": {
            "check_a": (208, 214, 210),
            "check_b": (190, 196, 192),
            "skin": (238, 208, 188),
            "suit": (32, 118, 52),
            "accent": (170, 255, 150),
        },
        "astra_yuki.png": {
            "check_a": (214, 220, 228),
            "check_b": (196, 202, 210),
            "skin": (228, 238, 255),
            "suit": (36, 105, 155),
            "accent": (170, 225, 255),
        },
    }
    for fname, pal in sheets.items():
        img = build_sheet(pal)
        path = os.path.join(assets, fname)
        img.save(path, "PNG", optimize=True)
        print("Wrote", path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
