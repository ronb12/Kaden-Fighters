#!/usr/bin/env python3
"""
Build ASTRA rival sheets (1376×768, 2×5) from the game’s own production anim strips.

Kaden’s `assets/astra_fighter_sheet.png` is hand-authored at “hero” fidelity; the closest
practical match for the other four is to use `assets/raijin_anim.png` (etc.)—the same
lineage of pixel art that ships in `character_sheet.png` / anim strips—scaled into the
Sprite Lab cell grid on a Kaden-matched neutral checker mat (for engine keying).

This does not replace a future hand-painted 10-pose ASTRA export, but it brings rivals up
to the same *asset tier* as the rest of the cast instead of simple geometry.

Usage: python3 scripts/generate_astra_rival_sheets.py
"""
from __future__ import annotations

import os
from typing import List, Tuple

from PIL import Image, ImageDraw, ImageOps

W, H = 1376, 768
CELL_H = 384
COLS = 5
LAST_COL_W = W - 4 * 275
RGB = Tuple[int, int, int]


def cell_x(c: int) -> int:
    return c * 275


def cell_w(c: int) -> int:
    return LAST_COL_W if c == 4 else 275


def kaden_checker_pair() -> Tuple[RGB, RGB]:
    """Two near-neutral grays from Kaden’s top-left mat (low RGB spread for keyAstraCheckerMat)."""
    p = "assets/astra_fighter_sheet.png"
    if os.path.exists(p):
        k = Image.open(p).convert("RGB")
        return k.getpixel((0, 0))[:3], k.getpixel((20, 0))[:3]
    return (211, 213, 211), (211, 211, 210)


def draw_checker(
    im: Image.Image,
    x0: int,
    y0: int,
    cw: int,
    ch: int,
    a: RGB,
    b: RGB,
) -> None:
    dr = ImageDraw.Draw(im, "RGB")
    size = 18
    for yy in range(ch):
        for xx in range(cw):
            t = ((xx // size) + (yy // size)) % 2
            c: RGB = a if t == 0 else b
            dr.rectangle([x0 + xx, y0 + yy, x0 + xx + 1, y0 + yy + 1], fill=c)


def split_frames(anim: Image.Image) -> List[Image.Image]:
    w, h = anim.size
    n = 5
    fw = w // n
    frames: List[Image.Image] = []
    for i in range(n):
        f = anim.crop((i * fw, 0, (i + 1) * fw, h))
        frames.append(f.convert("RGBA" if f.mode in ("RGBA", "P") else "RGB"))
    return frames


def to_rgba(frm: Image.Image) -> Image.Image:
    if frm.mode == "RGBA":
        return frm
    if frm.mode == "P":
        return frm.convert("RGBA")
    rgb = frm.convert("RGB")
    a = Image.new("L", rgb.size, 255)
    out = Image.merge("RGBA", (*rgb.split(), a))
    return out


def blit_frame(
    out: Image.Image,
    col: int,
    row: int,
    frame: Image.Image,
    *,
    hflip: bool = False,
    add_super_glow: bool = False,
) -> None:
    x0, y0 = cell_x(col), row * CELL_H
    sw = cell_w(col)
    sh = CELL_H
    f = to_rgba(frame)
    if hflip:
        f = ImageOps.mirror(f)
    fw, fh = f.size
    if fw < 1 or fh < 1:
        return
    scale = min((sw * 0.92) / fw, (sh * 0.93) / fh)
    nw, nh = max(1, int(fw * scale)), max(1, int(fh * scale))
    f = f.resize((nw, nh), Image.Resampling.NEAREST)
    f = f.convert("RGBA")
    if add_super_glow:
        g = Image.new("RGBA", (nw + 24, nh + 16), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.ellipse((2, nh - 8, nw + 22, nh + 24), fill=(255, 230, 120, 110))
        g.paste(f, (0, 0), f)
        f = g
    px = x0 + (sw - f.size[0]) // 2
    py = y0 + sh - f.size[1] - 8
    if py < y0 + 2:
        py = y0 + 2
    out.paste(f, (px, py), f)


def build_sheet(anim_name: str, out_name: str) -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = os.path.join(root, "assets", anim_name)
    if not os.path.exists(ap):
        raise FileNotFoundError(ap)
    anim = Image.open(ap)
    ca, cb = kaden_checker_pair()
    out = Image.new("RGB", (W, H), (20, 20, 28))
    frames = split_frames(anim)
    if len(frames) < 5:
        raise ValueError(anim_name)

    # Fill mat
    for row in range(2):
        y0 = row * CELL_H
        for col in range(COLS):
            draw_checker(out, cell_x(col), y0, cell_w(col), CELL_H, ca, cb)

    f0, f1, f2, f3, f4 = frames

    # Top row: use the five original strip frames in order (idle + motion spread).
    for c in range(5):
        blit_frame(out, c, 0, frames[c])

    # Bottom: jab, cross, kick, special, super — reuse high-motion frames; mirror cross
    blit_frame(out, 0, 1, f2)
    blit_frame(out, 1, 1, f2, hflip=True)
    blit_frame(out, 2, 1, f3)
    blit_frame(out, 3, 1, f4)
    blit_frame(out, 4, 1, f0, add_super_glow=True)

    out_path = os.path.join(root, "assets", out_name)
    out.save(out_path, "PNG", optimize=True)
    print("Wrote", out_path, os.path.getsize(out_path), "bytes (from", anim_name, ")")


def main() -> None:
    jobs = [
        ("raijin_anim.png", "astra_raijin.png"),
        ("hikari_anim.png", "astra_hikari.png"),
        ("ren_anim.png", "astra_ren.png"),
        ("yuki_anim.png", "astra_yuki.png"),
    ]
    for anim, out in jobs:
        build_sheet(anim, out)


if __name__ == "__main__":
    main()
