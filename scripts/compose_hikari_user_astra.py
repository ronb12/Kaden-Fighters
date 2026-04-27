#!/usr/bin/env python3
"""
Build assets/astra_hikari.png (1376×768 ASTRA) from hand-authored Hikari reference PNGs
in assets/hikari_concept/. Re-run after updating those sources.
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageOps

W, H = 1376, 768
CELL_H = 384
COLS = 5
RW = 275
LAST_W = 276

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KADEN = os.path.join(ROOT, "assets", "astra_fighter_sheet.png")
OUT = os.path.join(ROOT, "assets", "astra_hikari.png")
TURN = os.path.join(ROOT, "assets", "hikari_concept", "hikari_turnaround.png")
FULL = os.path.join(ROOT, "assets", "hikari_concept", "hikari_full_sheet.png")
# Full-body key art for roster cell (0,0) — same slot the game uses for bust/mini/portrait.
HIKARI_GAMEPLAY = os.path.join(ROOT, "assets", "hikari-gameplay.png")


def kaden_checker_pair():
    if os.path.exists(KADEN):
        k = Image.open(KADEN).convert("RGB")
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
    return LAST_W if col == 4 else RW


def split_row(im: Image.Image, n: int, *, h_frac: float) -> list[Image.Image]:
    w, h = im.size
    h_use = min(int(h * h_frac), h)
    w_each = w // n
    return [
        im.crop((i * w_each, 0, (i + 1) * w_each, h_use)).copy() for i in range(n)
    ]


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
    hflip = bool(kw.get("hflip", False))
    glow = bool(kw.get("glow", False))
    pink = bool(kw.get("pink_glow", False))
    x0, y0 = cell_x(col), row * CELL_H
    sw, sh = cell_w(col), CELL_H
    f = to_rgba(frame)
    if hflip:
        f = ImageOps.mirror(f)
    fw, fh = f.size
    if fw < 1 or fh < 1:
        return
    # Smaller in-cell fit than Kaden’s sheet: wide Wushu stances + roster cover+scaleMult
    # need margin so full arms/legs survive the character-select portrait clip.
    scale = min((sw * 0.78) / fw, (sh * 0.80) / fh)
    nw, nh = max(1, int(fw * scale)), max(1, int(fh * scale))
    f = f.resize((nw, nh), Image.Resampling.LANCZOS)
    f = f.convert("RGBA")
    if glow:
        g = Image.new("RGBA", (nw + 24, nh + 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(g)
        col_fill = (255, 130, 190, 110) if pink else (100, 180, 255, 100)
        d.ellipse((2, nh - 8, nw + 22, nh + 24), fill=col_fill)
        g.paste(f, (0, 0), f)
        f = g
    px = x0 + (sw - f.size[0]) // 2
    py = y0 + sh - f.size[1] - 6
    if py < y0 + 2:
        py = y0 + 2
    out.paste(f, (px, py), f)


def extract_action_strip(fim: Image.Image) -> list[Image.Image]:
    """Right half, mid Y — clear of bottom palette bar on design sheets."""
    w, h = fim.size
    x0, x1 = int(w * 0.50), w
    y0, y1 = int(h * 0.10), int(h * 0.50)
    if x1 - x0 < 10 or y1 - y0 < 10:
        return []
    st = fim.crop((x0, y0, x1, y1))
    sw = st.size[0] // 5
    if sw < 2:
        return []
    sh = st.size[1]
    return [st.crop((i * sw, 0, (i + 1) * sw, sh)).copy() for i in range(5)]


def extract_jump_hero(fim: Image.Image) -> Image.Image:
    """Large hero / dynamic pose on left side of full sheet (jump cell)."""
    w, h = fim.size
    return fim.crop(
        (int(w * 0.02), int(h * 0.05), int(w * 0.45), int(h * 0.55))
    ).copy()


def main() -> int:
    for p in (TURN, FULL):
        if not os.path.exists(p):
            print("Missing", p, file=sys.stderr)
            return 1
    ft = Image.open(TURN).convert("RGB")
    ff = Image.open(FULL).convert("RGB")

    turns = split_row(ft, 4, h_frac=0.64)
    act = extract_action_strip(ff)
    jump_src = extract_jump_hero(ff)

    if len(act) < 5:
        act = [turns[0], turns[1], turns[2], turns[2], turns[3]]

    ca, cb = kaden_checker_pair()
    out = Image.new("RGB", (W, H), (20, 20, 28))
    for r in range(2):
        y0 = r * CELL_H
        for c in range(COLS):
            draw_checker(out, cell_x(c), y0, cell_w(c), CELL_H, ca, cb)

    # Row0: idle, idle2, walk, walk, jump — prefer HD key art for idle (0,0) when present
    idle0 = (
        Image.open(HIKARI_GAMEPLAY).convert("RGB")
        if os.path.isfile(HIKARI_GAMEPLAY)
        else turns[0]
    )
    blit_in_cell(out, 0, 0, idle0)
    blit_in_cell(out, 1, 0, turns[1] if len(turns) > 1 else turns[0])
    blit_in_cell(out, 2, 0, turns[2] if len(turns) > 2 else turns[0])
    blit_in_cell(out, 3, 0, turns[3] if len(turns) > 3 else turns[0])
    blit_in_cell(out, 4, 0, jump_src)

    # Row1: strikes from action strip; pink glow on super
    for i in range(5):
        blit_in_cell(
            out,
            i,
            1,
            act[i],
            hflip=(i == 1),
            glow=(i == 4),
            pink_glow=(i == 4),
        )

    out.save(OUT, "PNG", optimize=True)
    print("Wrote", OUT, os.path.getsize(OUT), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
