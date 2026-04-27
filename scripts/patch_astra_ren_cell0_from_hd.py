#!/usr/bin/env python3
"""
Replace ASTRA cell (0,0) in assets/astra_ren.png with assets/ren-gameplay.png
(checker mat + scaled figure). Roster uses the same layout as other ASTRA fighters.
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KADEN_REF = os.path.join(ROOT, "assets", "astra_fighter_sheet.png")
SHEET = os.path.join(ROOT, "assets", "astra_ren.png")
HD = os.path.join(ROOT, "assets", "ren-gameplay.png")

CELL_H = 384
RW = 275
W, H = 1376, 768


def kaden_checker_pair():
    ref = KADEN_REF if os.path.exists(KADEN_REF) else SHEET
    if os.path.exists(ref):
        k = Image.open(ref).convert("RGB")
        return k.getpixel((0, 0))[:3], k.getpixel((20, 0))[:3]
    return (211, 213, 211), (211, 211, 210)


def draw_checker(
    im: Image.Image, x0: int, y0: int, cw: int, ch: int, a: tuple, b: tuple
) -> None:
    dr = ImageDraw.Draw(im, "RGB")
    size = 18
    for yy in range(ch):
        for xx in range(cw):
            t = ((xx // size) + (yy // size)) % 2
            c = a if t == 0 else b
            dr.rectangle(
                [x0 + xx, y0 + yy, x0 + xx + 1, y0 + yy + 1], fill=c
            )


def cell_x(col: int) -> int:
    return col * RW


def cell_w(col: int) -> int:
    return 276 if col == 4 else RW


def to_rgba(frm: Image.Image) -> Image.Image:
    if frm.mode == "RGBA":
        return frm
    if frm.mode == "P":
        return frm.convert("RGBA")
    im = frm.convert("RGB")
    a = Image.new("L", im.size, 255)
    return Image.merge("RGBA", (*im.split(), a))


def blit_in_cell(
    out: Image.Image, col: int, row: int, frame: Image.Image, **kw
) -> None:
    x0, y0 = cell_x(col), row * CELL_H
    sw, sh = cell_w(col), CELL_H
    f = to_rgba(frame)
    fw, fh = f.size
    if fw < 1 or fh < 1:
        return
    scale = min((sw * 0.88) / fw, (sh * 0.90) / fh)
    nw, nh = max(1, int(fw * scale)), max(1, int(fh * scale))
    f = f.resize((nw, nh), Image.Resampling.LANCZOS)
    f = f.convert("RGBA")
    px = x0 + (sw - f.size[0]) // 2
    py = y0 + sh - f.size[1] - 6
    if py < y0 + 2:
        py = y0 + 2
    out.paste(f, (px, py), f)


def main() -> int:
    if not os.path.isfile(SHEET):
        print("Missing", SHEET, file=sys.stderr)
        return 1
    if not os.path.isfile(HD):
        print("Missing", HD, file=sys.stderr)
        return 1
    sheet = Image.open(SHEET).convert("RGB")
    if sheet.size != (W, H):
        print("Unexpected sheet size", sheet.size, "expected", (W, H), file=sys.stderr)
        return 1
    rhd = Image.open(HD).convert("RGB")
    ca, cb = kaden_checker_pair()
    x0, y0 = 0, 0
    cw, ch = cell_w(0), CELL_H
    draw_checker(sheet, x0, y0, cw, ch, ca, cb)
    blit_in_cell(sheet, 0, 0, rhd)
    sheet.save(SHEET, "PNG", optimize=True)
    print("Patched cell (0,0) in", SHEET, os.path.getsize(SHEET), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
