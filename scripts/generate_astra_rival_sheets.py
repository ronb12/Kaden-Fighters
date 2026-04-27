#!/usr/bin/env python3
"""
ASTRA-format rival sheets (1376×768, 2×5 cells) — Japanese martial-arts–inspired pixel figures.
Raijin (M / karate-dōgi), Hikari (F / wushu-guis), Ren (M / aikido + hakama), Yuki (F / judogi).
Matches kfr-game.js grid; checker stays low-RGB-spread for mat keying.
Regenerate: python3 scripts/generate_astra_rival_sheets.py
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Callable, Sequence, Tuple

from PIL import Image, ImageDraw

W, H = 1376, 768
CELL_H = 384
COLS = 5
LAST_COL_W = W - 4 * 275

RGB = Tuple[int, int, int]


def cell_x(c: int) -> int:
    return c * 275


def cell_w(c: int) -> int:
    return LAST_COL_W if c == 4 else 275


POSES: Sequence[Sequence[str]] = [
    ["idle", "idle2", "walk0", "walk1", "jump"],
    ["jab", "cross", "kick", "special", "super"],
]


def shade(rgb: RGB, factor: float) -> RGB:
    return tuple(max(0, min(255, int(c * factor))) for c in rgb)  # type: ignore


def draw_checker(draw: ImageDraw.ImageDraw, x0: int, y0: int, cw: int, ch: int, a: RGB, b: RGB) -> None:
    size = 18
    for yy in range(ch):
        for xx in range(cw):
            t = ((xx // size) + (yy // size)) % 2
            c = a if t == 0 else b
            draw.rectangle([x0 + xx, y0 + yy, x0 + xx + 1, y0 + yy + 1], fill=c)


@dataclass(frozen=True)
class Style:
    """Visual identity for one fighter — 2 men (Raijin, Ren), 2 women (Hikari, Yuki)."""

    key: str
    skin: RGB
    skin_dark: RGB
    hair: RGB
    hair_hi: RGB
    primary: RGB  # dogi / top
    primary_dark: RGB
    secondary: RGB  # belt, hakama, trim
    accent: RGB
    female: bool
    # body (relative to default center)
    shoulder_w: int  # half-width of torso at chest
    head_rx: int
    head_ry: int


STYLES: dict[str, Style] = {
    "raijin": Style(
        key="raijin",
        skin=(232, 198, 175),
        skin_dark=(180, 140, 120),
        hair=(28, 24, 22),
        hair_hi=(55, 48, 44),
        primary=(42, 88, 198),
        primary_dark=(22, 48, 128),
        secondary=(240, 240, 245),
        accent=(255, 220, 60),
        female=False,
        shoulder_w=34,
        head_rx=21,
        head_ry=24,
    ),
    "hikari": Style(
        key="hikari",
        skin=(255, 210, 205),
        skin_dark=(200, 150, 140),
        hair=(48, 28, 38),
        hair_hi=(90, 55, 70),
        primary=(215, 55, 120),
        primary_dark=(140, 28, 72),
        secondary=(255, 245, 250),
        accent=(255, 190, 215),
        female=True,
        shoulder_w=26,
        head_rx=19,
        head_ry=22,
    ),
    "ren": Style(
        key="ren",
        skin=(210, 185, 165),
        skin_dark=(150, 120, 100),
        hair=(35, 32, 30),
        hair_hi=(70, 64, 58),
        primary=(245, 245, 248),
        primary_dark=(190, 192, 200),
        secondary=(24, 52, 32),
        accent=(130, 220, 140),
        female=False,
        shoulder_w=30,
        head_rx=20,
        head_ry=23,
    ),
    "yuki": Style(
        key="yuki",
        skin=(240, 220, 210),
        skin_dark=(185, 155, 140),
        hair=(22, 22, 28),
        hair_hi=(55, 55, 62),
        primary=(252, 252, 255),
        primary_dark=(200, 205, 215),
        secondary=(38, 95, 170),
        accent=(160, 215, 255),
        female=True,
        shoulder_w=27,
        head_rx=19,
        head_ry=21,
    ),
}


def _rect(
    draw: ImageDraw.ImageDraw,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    fill: RGB,
    outline: RGB | None = None,
) -> None:
    draw.rectangle([x1, y1, x2, y2], fill=fill, outline=outline)


def _ell(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, fill: RGB, outline: RGB | None = None) -> None:
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline)


def draw_head(
    draw: ImageDraw.ImageDraw,
    mcx: int,
    top_y: int,
    st: Style,
    *,
    tilt: int = 0,
) -> int:
    """Returns chin y."""
    cy = top_y + st.head_ry
    # face
    _ell(draw, mcx + tilt, cy, st.head_rx, st.head_ry, st.skin, shade(st.skin_dark, 1.0))
    # hair mass
    _ell(draw, mcx + tilt, top_y + 8, st.head_rx + 4, 12, st.hair, st.hair_hi)
    draw.pieslice([mcx - st.head_rx - 6 + tilt, top_y - 4, mcx + st.head_rx + 6 + tilt, top_y + 24], 180, 360, fill=st.hair)
    if st.female:
        # side tail / bob detail
        _ell(draw, mcx - st.head_rx - 10 + tilt, cy + 6, 8, 18, st.hair)
        _ell(draw, mcx + st.head_rx + 8 + tilt, cy + 4, 7, 14, st.hair)
    else:
        # short sides
        _rect(draw, mcx - st.head_rx - 2 + tilt, top_y + 6, mcx - st.head_rx + 6 + tilt, top_y + 28, st.hair)
        _rect(draw, mcx + st.head_rx - 4 + tilt, top_y + 6, mcx + st.head_rx + 2 + tilt, top_y + 28, st.hair)
    return cy + st.head_ry


def draw_raijin_karate(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    """Karate-dōgi: blue jacket, white obi, red hachimaki hint, bare forearms."""
    mcx = x0 + cw // 2
    chin = draw_head(draw, mcx, y0 + 52, st)
    # hachimaki
    _rect(draw, mcx - 26, y0 + 56, mcx + 26, y0 + 64, (220, 52, 48))
    body_y = chin + 4
    bw = st.shoulder_w
    # uwagi open V + fold
    _rect(draw, mcx - bw, body_y, mcx + bw, body_y + 95, st.primary, st.primary_dark)
    _rect(draw, mcx - 4, body_y + 8, mcx + 4, body_y + 88, st.secondary)  # inner / wrap
    # obi
    by = body_y + 62
    _rect(draw, mcx - bw - 2, by, mcx + bw + 2, by + 14, st.secondary, (180, 180, 190))
    leg0 = by + 14
    # dogi pants
    _rect(draw, mcx - bw + 4, leg0, mcx - 6, y0 + CELL_H - 12, st.primary, st.primary_dark)
    _rect(draw, mcx + 6, leg0, mcx + bw - 4, y0 + CELL_H - 12, st.primary, st.primary_dark)
    # feet
    _rect(draw, mcx - 28, y0 + CELL_H - 22, mcx - 4, y0 + CELL_H - 4, (35, 35, 38))
    _rect(draw, mcx + 4, y0 + CELL_H - 22, mcx + 28, y0 + CELL_H - 4, (35, 35, 38))
    # forearms skin at sleeve
    _rect(draw, mcx - bw - 16, body_y + 18, mcx - bw - 2, body_y + 48, st.skin, st.skin_dark)
    _rect(draw, mcx + bw + 2, body_y + 18, mcx + bw + 16, body_y + 48, st.skin, st.skin_dark)
    _apply_pose_raijin(draw, mcx, body_y, by, x0, y0, cw, pose, st)


def draw_hikari_wushu(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    """Changquan-style top + sash + light pants."""
    mcx = x0 + cw // 2
    chin = draw_head(draw, mcx, y0 + 54, st)
    body_y = chin + 6
    bw = st.shoulder_w
    # wide sleeves (flared)
    _rect(draw, mcx - bw - 22, body_y, mcx - bw, body_y + 40, st.primary, st.primary_dark)
    _rect(draw, mcx + bw, body_y, mcx + bw + 22, body_y + 40, st.primary, st.primary_dark)
    _rect(draw, mcx - bw, body_y, mcx + bw, body_y + 70, st.primary, st.primary_dark)
    # sash
    sy = body_y + 48
    _rect(draw, mcx - bw - 8, sy, mcx + bw + 8, sy + 12, st.accent, shade(st.primary_dark, 1.1))
    # white pants
    py = sy + 12
    _rect(draw, mcx - bw + 2, py, mcx - 5, y0 + CELL_H - 10, st.secondary)
    _rect(draw, mcx + 5, py, mcx + bw - 2, y0 + CELL_H - 10, st.secondary)
    # shoes
    _rect(draw, mcx - 26, y0 + CELL_H - 20, mcx - 4, y0 + CELL_H - 4, (42, 38, 48))
    _rect(draw, mcx + 4, y0 + CELL_H - 20, mcx + 26, y0 + CELL_H - 4, (42, 38, 48))
    _apply_pose_hikari(draw, mcx, body_y, sy, x0, y0, cw, pose, st)


def draw_ren_aikido(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    """White keikogi + dark hakama — wide pleated legs."""
    mcx = x0 + cw // 2
    chin = draw_head(draw, mcx, y0 + 52, st)
    # small chonmage bump
    _ell(draw, mcx, y0 + 48, 8, 8, st.hair)
    body_y = chin + 4
    bw = st.shoulder_w
    _rect(draw, mcx - bw, body_y, mcx + bw, body_y + 58, st.primary, st.primary_dark)
    # himo
    _rect(draw, mcx - 6, body_y + 50, mcx + 6, body_y + 86, st.secondary)
    # hakama legs (very wide)
    hx = body_y + 58
    # trapezoid left / right
    leg_l = [(mcx - bw - 30, hx), (mcx - 8, hx), (mcx - 4, y0 + CELL_H - 8), (mcx - 38, y0 + CELL_H - 8)]
    leg_r = [(mcx + 8, hx), (mcx + bw + 30, hx), (mcx + 38, y0 + CELL_H - 8), (mcx + 4, y0 + CELL_H - 8)]
    draw.polygon(leg_l, fill=st.secondary, outline=shade(st.secondary, 0.75))
    draw.polygon(leg_r, fill=st.secondary, outline=shade(st.secondary, 0.75))
    # tabi / zori
    _rect(draw, mcx - 32, y0 + CELL_H - 18, mcx - 6, y0 + CELL_H - 4, (48, 46, 50))
    _rect(draw, mcx + 6, y0 + CELL_H - 18, mcx + 32, y0 + CELL_H - 4, (48, 46, 50))
    _apply_pose_ren(draw, mcx, body_y, hx, x0, y0, cw, pose, st)


def draw_yuki_judo(
    draw: ImageDraw.ImageDraw,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    """Judogi: thick collar, colored obi."""
    mcx = x0 + cw // 2
    chin = draw_head(draw, mcx, y0 + 56, st, tilt=0)
    body_y = chin + 4
    bw = st.shoulder_w
    # thick collar V
    _rect(draw, mcx - bw - 4, body_y, mcx + bw + 4, body_y + 88, st.primary, st.primary_dark)
    _rect(draw, mcx - 8, body_y + 6, mcx + 8, body_y + 70, (230, 232, 238))
    obiy = body_y + 52
    _rect(draw, mcx - bw - 6, obiy, mcx + bw + 6, obiy + 16, st.secondary, (25, 70, 140))
    ly = obiy + 16
    _rect(draw, mcx - bw + 2, ly, mcx - 4, y0 + CELL_H - 10, st.primary)
    _rect(draw, mcx + 4, ly, mcx + bw - 2, y0 + CELL_H - 10, st.primary)
    _rect(draw, mcx - 24, y0 + CELL_H - 18, mcx - 4, y0 + CELL_H - 4, (32, 32, 36))
    _rect(draw, mcx + 4, y0 + CELL_H - 18, mcx + 24, y0 + CELL_H - 4, (32, 32, 36))
    _apply_pose_yuki(draw, mcx, body_y, obiy, x0, y0, cw, pose, st)


def _apply_pose_raijin(
    draw: ImageDraw.ImageDraw,
    mcx: int,
    body_y: int,
    by: int,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    bw = st.shoulder_w
    if pose == "walk0":
        _rect(draw, mcx - 30, y0 + CELL_H - 36, mcx - 6, y0 + CELL_H - 8, st.primary_dark)
    elif pose == "walk1":
        _rect(draw, mcx + 6, y0 + CELL_H - 36, mcx + 30, y0 + CELL_H - 8, st.primary_dark)
    elif pose == "jump":
        _rect(draw, mcx - 36, by + 10, mcx - 10, by + 44, st.skin)
        _rect(draw, mcx + 10, by + 10, mcx + 36, by + 44, st.skin)
    elif pose == "jab":
        _rect(draw, mcx + bw, body_y + 20, x0 + cw - 12, body_y + 36, st.skin, st.skin_dark)
    elif pose == "cross":
        _rect(draw, x0 + 18, body_y + 18, mcx - bw - 4, body_y + 34, st.skin)
    elif pose == "kick":
        _rect(draw, mcx + 8, by + 10, mcx + 100, by + 28, st.skin)
    elif pose in ("special", "super"):
        _ell(draw, mcx, body_y - 28, 36, 28, st.accent, (200, 170, 40))
        _ell(draw, mcx, body_y + 40, 22, 22, st.accent, (200, 170, 40))


def _apply_pose_hikari(
    draw: ImageDraw.ImageDraw,
    mcx: int,
    body_y: int,
    sy: int,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    bw = st.shoulder_w
    if pose == "walk0":
        _rect(draw, mcx - 26, y0 + CELL_H - 32, mcx - 4, y0 + CELL_H - 6, st.primary_dark)
    elif pose == "walk1":
        _rect(draw, mcx + 4, y0 + CELL_H - 32, mcx + 26, y0 + CELL_H - 6, st.primary_dark)
    elif pose == "jump":
        _rect(draw, mcx - 22, y0 + CELL_H - 100, mcx, y0 + CELL_H - 60, st.primary)
        _rect(draw, mcx, y0 + CELL_H - 100, mcx + 22, y0 + CELL_H - 60, st.primary)
    elif pose == "jab":
        _rect(draw, mcx + bw + 8, body_y + 8, x0 + cw - 8, body_y + 30, st.skin)
    elif pose == "cross":
        _rect(draw, x0 + 20, body_y + 6, mcx - bw, body_y + 28, st.skin)
    elif pose == "kick":
        _rect(draw, mcx + 4, sy, mcx + 96, sy + 22, st.skin)
    elif pose in ("special", "super"):
        for dx, dy in [(-32, 0), (32, 0), (0, -28)]:
            _ell(draw, mcx + dx, body_y + 20 + dy, 20, 20, st.accent)


def _apply_pose_ren(
    draw: ImageDraw.ImageDraw,
    mcx: int,
    body_y: int,
    hx: int,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    if pose == "walk0":
        draw.line([(mcx - 20, y0 + CELL_H - 20), (mcx - 8, y0 + CELL_H - 6)], fill=st.accent, width=3)
    elif pose == "walk1":
        draw.line([(mcx + 8, y0 + CELL_H - 20), (mcx + 20, y0 + CELL_H - 6)], fill=st.accent, width=3)
    elif pose == "jump":
        _rect(draw, mcx - 18, hx - 20, mcx, hx + 20, st.primary)
        _rect(draw, mcx, hx - 20, mcx + 18, hx + 20, st.primary)
    elif pose in ("special", "super"):
        _ell(draw, mcx, body_y - 32, 40, 30, st.accent, (80, 180, 90))


def _apply_pose_yuki(
    draw: ImageDraw.ImageDraw,
    mcx: int,
    body_y: int,
    obiy: int,
    x0: int,
    y0: int,
    cw: int,
    pose: str,
    st: Style,
) -> None:
    bw = st.shoulder_w
    if pose == "walk0":
        _rect(draw, mcx - 22, y0 + CELL_H - 30, mcx - 2, y0 + CELL_H - 4, (210, 210, 218))
    elif pose == "walk1":
        _rect(draw, mcx + 2, y0 + CELL_H - 30, mcx + 22, y0 + CELL_H - 4, (210, 210, 218))
    elif pose == "jump":
        _rect(draw, mcx - 20, y0 + CELL_H - 90, mcx, y0 + CELL_H - 50, st.primary)
        _rect(draw, mcx, y0 + CELL_H - 90, mcx + 20, y0 + CELL_H - 50, st.primary)
    elif pose == "jab":
        _rect(draw, mcx + bw, body_y + 16, x0 + cw - 10, body_y + 40, st.skin)
    elif pose == "cross":
        _rect(draw, x0 + 16, body_y + 12, mcx - bw, body_y + 36, st.skin)
    elif pose == "kick":
        _rect(draw, mcx + 4, obiy, mcx + 88, obiy + 20, st.skin)
    elif pose in ("special", "super"):
        for ang in range(0, 360, 45):
            r = 48
            px = mcx + int(math.cos(math.radians(ang)) * r * 0.4)
            py = body_y - 8 + int(math.sin(math.radians(ang)) * r * 0.25)
            _ell(draw, px, py, 10, 10, st.accent)


DRAWERS: dict[str, Callable[[ImageDraw.ImageDraw, int, int, int, str, Style], None]] = {
    "raijin": draw_raijin_karate,
    "hikari": draw_hikari_wushu,
    "ren": draw_ren_aikido,
    "yuki": draw_yuki_judo,
}


def build_sheet(sheet_key: str, check_a: RGB, check_b: RGB) -> Image.Image:
    st = STYLES[sheet_key]
    draw_fn = DRAWERS[sheet_key]
    im = Image.new("RGB", (W, H), (20, 20, 28))
    dr = ImageDraw.Draw(im)
    for row in range(2):
        y0 = row * CELL_H
        for col in range(COLS):
            cw = cell_w(col)
            x0 = cell_x(col)
            draw_checker(dr, x0, y0, cw, CELL_H, check_a, check_b)
            pose = POSES[row][col]
            draw_fn(dr, x0, y0, cw, pose, st)
    return im


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets = os.path.join(root, "assets")
    os.makedirs(assets, exist_ok=True)
    # Neutral checkers: max RGB spread < 16 per tile color for ASTRA mat key
    jobs = {
        "astra_raijin.png": ("raijin", (210, 213, 218), (192, 195, 200)),
        "astra_hikari.png": ("hikari", (220, 214, 218), (202, 198, 204)),
        "astra_ren.png": ("ren", (208, 214, 210), (192, 198, 194)),
        "astra_yuki.png": ("yuki", (214, 220, 226), (198, 204, 210)),
    }
    for fname, (k, ca, cb) in jobs.items():
        path = os.path.join(assets, fname)
        img = build_sheet(k, ca, cb)
        img.save(path, "PNG", optimize=True)
        print("Wrote", path, os.path.getsize(path), "bytes", k)


if __name__ == "__main__":
    main()
