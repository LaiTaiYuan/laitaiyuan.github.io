"""Cut animated layers out of the public toolbox hero illustration.

Usage: python scripts/build-toolbox-scene.py [--review]

Reads public/tools/maker-street.png and writes:
  public/tools/scene/<layer>.webp   lossless cut-outs (characters, reel, static props)
  src/data/toolboxScene.json        layer boxes as percentages of the scene

Characters are isolated with an outline-bounded fill: everything inside the
hand-drawn polygon that is not connected to the background (regions reachable
from outside the polygon) belongs to the character. Because every cut-out is
placed back over the untouched base image at the exact same spot, the edges
only need to be roughly right; the animations are small scale/translate moves.
"""

from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/tools/maker-street.png"
OUT_DIR = ROOT / "public/tools/scene"
MANIFEST = ROOT / "src/data/toolboxScene.json"

DARK_LUMA = 40  # outline ink and dark fills
RING = 3  # half the outline width, trimmed from the background side

# Polygons in source pixels, generous around each character but never
# enclosing a whole background object (it would travel with the character).
CHARACTERS = {
    "cat": [
        (140, 345), (200, 336), (255, 328), (275, 350), (300, 352), (330, 350),
        (360, 358), (400, 372), (404, 458), (396, 470), (338, 478), (334, 505),
        (326, 525), (312, 540), (304, 548), (303, 590), (300, 640), (318, 660),
        (320, 692), (300, 700), (232, 700), (222, 690), (212, 692), (148, 700),
        (135, 690), (145, 660), (150, 600), (150, 540), (150, 505), (128, 460),
        (125, 420),
    ],
    "beaver": [
        (945, 340), (965, 315), (990, 318), (1010, 305), (1040, 300), (1065, 318),
        (1088, 322), (1100, 340), (1112, 380), (1108, 425), (1090, 440), (1078, 448),
        (1075, 500), (1080, 532), (1065, 532), (860, 532), (846, 520), (845, 470),
        (855, 440), (880, 430), (905, 437), (925, 445), (930, 420), (945, 395),
    ],
    "bird": [
        (1458, 372), (1462, 348), (1478, 326), (1500, 318), (1520, 318), (1546, 342),
        (1568, 372), (1584, 395), (1594, 418), (1598, 430), (1624, 378), (1640, 372),
        (1646, 390), (1634, 418), (1650, 445), (1645, 485), (1610, 495), (1592, 505),
        (1592, 560), (1584, 590), (1582, 612), (1485, 612), (1470, 604), (1440, 604),
        (1402, 594), (1398, 570), (1431, 548), (1431, 500), (1440, 465), (1458, 435),
        (1456, 400),
    ],
    "raccoon": [
        (1835, 380), (1848, 352), (1870, 350), (1900, 348), (1930, 350), (1965, 355),
        (1978, 380), (1988, 420), (1990, 460), (2005, 490), (2008, 525), (2030, 522),
        (2062, 536), (2064, 592), (2052, 625), (2040, 648), (2000, 645), (1985, 660), (1985, 690),
        (1920, 692), (1912, 682), (1905, 692), (1840, 692), (1825, 680), (1845, 655),
        (1845, 590), (1832, 578), (1808, 578), (1798, 560), (1795, 520), (1795, 478),
        (1812, 470), (1815, 452), (1815, 425),
    ],
}

# Ink strokes that close gaps where a character's fill runs into the background
# without an outline (polyline points, stroked 3px wide before labelling).
SEALS = {
    "bird": [[(1455, 600), (1467, 600)]],  # bush channel under the tail
}

# Thin props (the bird's pointer) that the outline trim would eat: inside these
# polygons every non-background pixel is kept.
FORCE = {
    "bird": [[(1600, 436), (1626, 380), (1640, 386), (1616, 444)]],
}

# Props that sit in front of a character and must stay still on top of it.
STATIC_PROPS = {
    "laptop": (1072, 424, 1228, 534),
}

# Circular cut-outs that rotate in place (centre x, centre y, radius).
DISCS = {
    "reel": (450, 171, 46),
}


def luma(rgba: np.ndarray) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float32)
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def label_components(free: np.ndarray, diagonal: bool = False) -> np.ndarray:
    """Connected component labels for True pixels of `free` (0 = not free)."""
    height, width = free.shape
    labels = np.zeros(free.shape, dtype=np.int32)
    current = 0
    steps = ((-1, 0), (1, 0), (0, -1), (0, 1))
    if diagonal:
        steps += ((-1, -1), (-1, 1), (1, -1), (1, 1))
    for y0 in range(height):
        row = free[y0]
        for x0 in range(width):
            if not row[x0] or labels[y0, x0]:
                continue
            current += 1
            labels[y0, x0] = current
            queue = deque([(y0, x0)])
            while queue:
                y, x = queue.popleft()
                for dy, dx in steps:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < height and 0 <= nx < width:
                        if free[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = current
                            queue.append((ny, nx))
    return labels


def polygon_mask(size: tuple[int, int], points: list[tuple[int, int]]) -> np.ndarray:
    canvas = Image.new("L", size, 0)
    ImageDraw.Draw(canvas).polygon(points, fill=255)
    return np.array(canvas) > 0


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.array(image.filter(ImageFilter.MaxFilter(radius * 2 + 1))) > 0


def drop_specks(mask: np.ndarray, min_size: int = 120) -> np.ndarray:
    labels = label_components(mask, diagonal=True)
    counts = np.bincount(labels.ravel())
    keep = counts >= min_size
    keep[0] = False
    return keep[labels]


def cut_character(
    rgba: np.ndarray,
    points: list[tuple[int, int]],
    seals: list[list[tuple[int, int]]],
    force: list[list[tuple[int, int]]],
) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    margin = 12
    x0, y0 = max(min(xs) - margin, 0), max(min(ys) - margin, 0)
    x1, y1 = min(max(xs) + margin, rgba.shape[1]), min(max(ys) + margin, rgba.shape[0])
    window = rgba[y0:y1, x0:x1]
    inside = polygon_mask((x1 - x0, y1 - y0), [(x - x0, y - y0) for x, y in points])
    opaque = window[..., 3] > 128
    dark = (luma(window) < DARK_LUMA) & opaque
    if seals:
        ink = Image.new("L", (x1 - x0, y1 - y0), 0)
        for line in seals:
            ImageDraw.Draw(ink).line([(x - x0, y - y0) for x, y in line], fill=255, width=3)
        dark |= np.array(ink) > 0
    free = opaque & ~dark
    labels = label_components(free)
    outside_labels = np.unique(labels[~inside & free])
    background = np.isin(labels, outside_labels) & free
    background |= ~opaque
    mask = inside & ~dilate(background, RING)
    for polygon in force:
        keep = polygon_mask((x1 - x0, y1 - y0), [(x - x0, y - y0) for x, y in polygon])
        mask |= keep & inside & ~background
    mask = drop_specks(mask)
    # Drop stray specks and soften the edge by a pixel.
    alpha = Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.array(alpha)
    ys_on, xs_on = np.nonzero(alpha)
    bx0, bx1 = xs_on.min(), xs_on.max() + 1
    by0, by1 = ys_on.min(), ys_on.max() + 1
    out = window[by0:by1, bx0:bx1].copy()
    out[..., 3] = np.minimum(out[..., 3], alpha[by0:by1, bx0:bx1])
    return out, (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1)


def cut_disc(rgba: np.ndarray, cx: int, cy: int, radius: int) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    box = (cx - radius, cy - radius, cx + radius, cy + radius)
    window = rgba[box[1]:box[3], box[0]:box[2]].copy()
    size = radius * 2
    canvas = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(canvas).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    alpha = np.array(canvas.resize((size, size), Image.LANCZOS))
    window[..., 3] = np.minimum(window[..., 3], alpha)
    return window, box


def percent_box(box: tuple[int, int, int, int], width: int, height: int) -> dict[str, float]:
    x0, y0, x1, y1 = (int(v) for v in box)
    return {
        "x": round(x0 / width * 100, 3),
        "y": round(y0 / height * 100, 3),
        "w": round((x1 - x0) / width * 100, 3),
        "h": round((y1 - y0) / height * 100, 3),
    }


def save(rgba: np.ndarray, name: str) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.webp"
    Image.fromarray(rgba, "RGBA").save(path, "WEBP", lossless=True, quality=100, method=6)
    return path.stat().st_size


def write_review(rgba: np.ndarray, layers: dict[str, tuple[np.ndarray, tuple[int, int, int, int]]]) -> None:
    review_dir = ROOT / "output/toolbox-scene"
    review_dir.mkdir(parents=True, exist_ok=True)
    for name, (cut, box) in layers.items():
        x0, y0, x1, y1 = box
        pad = 30
        crop = Image.fromarray(rgba[max(y0 - pad, 0):y1 + pad, max(x0 - pad, 0):x1 + pad].copy(), "RGBA")
        base = Image.new("RGBA", crop.size, (64, 90, 218, 255))
        base.alpha_composite(crop)
        tint = Image.new("RGBA", crop.size, (0, 0, 0, 0))
        overlay = np.zeros((cut.shape[0], cut.shape[1], 4), np.uint8)
        overlay[..., 0] = 255
        overlay[..., 3] = (cut[..., 3] > 0) * 140
        tint.paste(Image.fromarray(overlay, "RGBA"), (x0 - max(x0 - pad, 0), y0 - max(y0 - pad, 0)))
        base.alpha_composite(tint)
        base = base.resize((base.width * 2, base.height * 2), Image.NEAREST)
        base.save(review_dir / f"{name}-mask.png")
        solo = Image.new("RGBA", (cut.shape[1] + 20, cut.shape[0] + 20), (64, 90, 218, 255))
        solo.alpha_composite(Image.fromarray(cut, "RGBA"), (10, 10))
        solo.resize((solo.width * 2, solo.height * 2), Image.NEAREST).save(review_dir / f"{name}-cut.png")


def main() -> None:
    review = "--review" in sys.argv
    image = Image.open(SOURCE).convert("RGBA")
    rgba = np.array(image)
    width, height = image.size
    layers: dict[str, tuple[np.ndarray, tuple[int, int, int, int]]] = {}
    for name, points in CHARACTERS.items():
        layers[name] = cut_character(rgba, points, SEALS.get(name, []), FORCE.get(name, []))
    for name, box in STATIC_PROPS.items():
        layers[name] = (rgba[box[1]:box[3], box[0]:box[2]].copy(), box)
    for name, (cx, cy, radius) in DISCS.items():
        layers[name] = cut_disc(rgba, cx, cy, radius)

    manifest = {"width": width, "height": height, "layers": {}}
    for name, (cut, box) in layers.items():
        size = save(cut, name)
        manifest["layers"][name] = percent_box(box, width, height)
        print(f"{name:8s} box={tuple(int(v) for v in box)} {size / 1024:.0f} KB")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    if review:
        write_review(rgba, layers)
        print("review images in output/toolbox-scene/")


if __name__ == "__main__":
    main()
