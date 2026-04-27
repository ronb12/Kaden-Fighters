#!/usr/bin/env python3
"""
Paint over the baked left-column menu text/graphics in menu-main.png.
Colors interpolate from samples at x=sx (clean art). No numpy required.
"""
from __future__ import annotations

import random
import shutil
import sys
from pathlib import Path

from PIL import Image


def lerp(a: float, b: float, t: float) -> float:
    return a * (1.0 - t) + b * t


def lerp_color(c0: tuple, c1: tuple, t: float) -> tuple:
    return (int(lerp(c0[0], c1[0], t)), int(lerp(c0[1], c1[1], t)), int(lerp(c0[2], c1[2], t)))


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    path = root / "assets" / "menu-main.png"
    if not path.exists():
        print("Missing", path, file=sys.stderr)
        return 1

    bak = path.with_suffix(path.suffix + ".bak")
    if not bak.exists():
        shutil.copy2(path, bak)
        print("Wrote backup:", bak)

    im = Image.open(path).convert("RGB")
    orig = im.copy()
    o_px = orig.load()
    px = im.load()
    w, h = im.size

    x_left = 0
    x_right = 500
    y_top = 50
    y_bot = min(660, h - 1)

    sx = min(540, w - 2)
    # vertical color samples along the clean strip
    sample_ys = [50, 150, 250, 350, 450, 550, min(650, h - 1)]
    colors = [px[sx, max(0, min(h - 1, yy))][:3] for yy in sample_ys]

    rng = random.Random(42)

    for y in range(y_top, y_bot + 1):
        t_map = (y - y_top) / max(1, (y_bot - y_top))
        f = t_map * (len(colors) - 1)
        j = int(f)
        j = min(j, len(colors) - 2)
        u = f - j
        c = lerp_color(colors[j], colors[j + 1], u)
        for x in range(x_left, min(x_right, w)):
            rj = (rng.random() - 0.5) * 2.0
            c2 = (int(max(0, min(255, c[0] + rj))), int(max(0, min(255, c[1] + rj))), int(max(0, min(255, c[2] + rj))))
            edge = 1.0
            if x > 450:
                edge = max(0.0, (x_right - x) / 50.0)
            o = o_px[x, y]
            p = lerp_color(c2, o[:3], 1.0 - edge)
            px[x, y] = p

    im.save(path, optimize=True)
    print("Updated:", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
