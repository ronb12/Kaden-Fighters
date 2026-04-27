#!/usr/bin/env python3
"""
Build ASTRA rival sheets (1376×768, 2×5) from the game’s own production anim strips.

Default pipeline (this script)
--------------------------------
Composites `assets/raijin_anim.png` … `yuki_anim.png` into the ASTRA grid. Running it
**overwrites** the four `astra_*.png` rival sheets—skip it if you are shipping hand art.

Raijin from author PNGs: `python3 scripts/compose_raijin_user_astra.py` (`assets/raijin_concept/`).
Hikari: `python3 scripts/compose_hikari_user_astra.py` (`assets/hikari_concept/`).

Hand export spec — true 10/10 parity with Kaden (`astra_fighter_sheet.png`)
----------------------------------------------------------------------------
1. **Canvas** — Exactly **1376×768** px, PNG, under `assets/`.

2. **Cell grid** (must match `getAstraFighterSheetClip` in `js/kfr-game.js`):
   - **Row height** 384 px. Row 0: y=0..383. Row 1: y=384..767.
   - **Column widths** — cols 0–3: **275** px (x = 0, 275, 550, 825). Col 4: **276** px
     (x = 1100..1375) so 4×275 + 276 = 1376.

3. **Pose slots** (paint one full-body pose per cell, on the mat):
   - **Row 0:** idle, idle2, walk (phase 0), walk (phase 1), jump
   - **Row 1:** jab, cross, kick, special, super (victory also uses this cell in code paths)

4. **Mat / keying** — Like Kaden: **neutral light-gray checker** in empty areas, with
   **low RGB spread** per tile (R,G within ~10–16 of each other) so
   `isAstraCheckerMat` + flood keying clears the floor. Do not fill the *figure* with
   the same “checker gray” you use for the mat, or the silhouette can key out.

5. **Filenames to replace** (drop in, keep names exact):
   - `assets/astra_fighter_sheet.png` — Kaden (roster index 0)
   - `assets/astra_raijin.png` — Raijin (1)
   - `assets/astra_hikari.png` — Hikari (2)
   - `assets/astra_ren.png` — Ren (3)
   - `assets/astra_yuki.png` — Yuki (4)

6. **After** replacing files: bump `ASTRA_ASSET_VER` in `js/kfr-game.js` and the `?v=`
   query on `kfr-game.js` + ASTRA `<link rel="preload">` rows in `index.html`, then
   deploy. Use Sprite Lab / `sprite-lab.html` in this repo to preview the same layout.

Usage (anim compositor; overwrites manual rival sheets): python3 scripts/generate_astra_rival_sheets.py
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
