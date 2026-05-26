#!/usr/bin/env python3
from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/generated/new-roster-five-source.png"
OUT_DIR = ROOT / "assets/generated"

NAMES = [
    "astra_marcus_chatgpt.png",
    "astra_aiko_chatgpt.png",
    "astra_luna_chatgpt.png",
    "astra_dante_chatgpt.png",
    "astra_sari_chatgpt.png",
]

ASTRA_W = 1376
ASTRA_H = 768
CELL_W = 275
CELL_H = 384
SRC_COLS = 10
SRC_ROWS = 5


def key_green(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            green_score = g - max(r, b)
            if g > 145 and green_score > 48:
                # Soft matte keeps antialiased sprite edges from looking boxed.
                alpha = 0 if green_score > 90 else max(0, min(255, int((90 - green_score) * 6)))
                px[x, y] = (r, g, b, alpha)
            else:
                # Mild green despill around antialiasing.
                if g > r and g > b:
                    g = int(min(g, max(r, b) + 18))
                px[x, y] = (r, g, b, a)
    return img


def fit_into_cell(src_cell, out_w, out_h):
    keyed = key_green(src_cell)
    keyed = keep_main_components(keyed)
    scale = min((out_w - 18) / keyed.width, (out_h - 18) / keyed.height)
    nw = max(1, round(keyed.width * scale))
    nh = max(1, round(keyed.height * scale))
    resized = keyed.resize((nw, nh), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    # Bottom-align feet so all poses share a ground anchor.
    x = (out_w - nw) // 2
    y = out_h - nh - 5
    cell.alpha_composite(resized, (x, y))
    return cell


def keep_main_components(img):
    w, h = img.size
    pix = img.load()
    seen = bytearray(w * h)
    comps = []

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or pix[x, y][3] <= 16:
                continue
            stack = [(x, y)]
            seen[idx] = 1
            pts = []
            minx = maxx = x
            miny = maxy = y
            while stack:
                cx, cy = stack.pop()
                pts.append((cx, cy))
                if cx < minx: minx = cx
                if cx > maxx: maxx = cx
                if cy < miny: miny = cy
                if cy > maxy: maxy = cy
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if not seen[nidx] and pix[nx, ny][3] > 16:
                        seen[nidx] = 1
                        stack.append((nx, ny))
            comps.append({
                "area": len(pts),
                "pts": pts,
                "bbox": (minx, miny, maxx, maxy),
                "cy": (miny + maxy) / 2,
            })

    if not comps:
        return img
    comps.sort(key=lambda c: c["area"], reverse=True)
    largest = comps[0]["area"]
    # Keep the fighter body and any meaningful VFX, drop stray feet/hands from adjacent rows.
    keep = set()
    for i, comp in enumerate(comps):
        minx, miny, maxx, maxy = comp["bbox"]
        height = maxy - miny + 1
        near_top_edge = maxy < h * 0.22
        meaningful = comp["area"] >= max(120, largest * 0.055) or height > h * 0.24
        if i == 0 or (meaningful and not near_top_edge):
            keep.update(comp["pts"])

    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    op = out.load()
    for x, y in keep:
        op[x, y] = pix[x, y]
    return out


def main():
    src = Image.open(SRC).convert("RGB")
    sw, sh = src.size
    src_cell_w = sw / SRC_COLS
    src_cell_h = sh / SRC_ROWS
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for row, name in enumerate(NAMES):
        sheet = Image.new("RGBA", (ASTRA_W, ASTRA_H), (0, 0, 0, 0))
        for col in range(SRC_COLS):
            left = round(col * src_cell_w)
            top = round(row * src_cell_h)
            right = round((col + 1) * src_cell_w)
            bottom = round((row + 1) * src_cell_h)
            src_cell = src.crop((left, top, right, bottom))

            out_col = col % 5
            out_row = 0 if col < 5 else 1
            out_w = ASTRA_W - out_col * CELL_W if out_col == 4 else CELL_W
            out_h = CELL_H
            cell = fit_into_cell(src_cell, out_w, out_h)
            sheet.alpha_composite(cell, (out_col * CELL_W, out_row * CELL_H))

        out = OUT_DIR / name
        sheet.save(out, optimize=True)
        print(f"Wrote {out} ({ASTRA_W}x{ASTRA_H})")


if __name__ == "__main__":
    main()
