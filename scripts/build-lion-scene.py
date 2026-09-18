"""Cut animated layers out of the homepage lion studio illustration.

Usage: python scripts/build-lion-scene.py [--review]

Reads public/images/leonard-lion-studio.png (the untouched source) and writes:
  public/images/lion/base.png                the scene with the tail and pupils
                                             removed so those layers can move
  public/images/lion/base-{768,1536}.{webp,avif}
                                             responsive encodes of that base
  public/images/lion/<layer>.webp            cut-outs (lossy colour, lossless alpha)
  src/data/lionScene.json                    layer boxes and pivots as
                                             percentages of the 1536 × 1024 scene

Layers that stay on top of an untouched base (head, plants, bulb) only move a
few pixels, so their edges can be rough. The tail is erased from the base so it
can wag over the transparent background, and each pupil is replaced by eye
white so the eyes can follow the pointer.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from scene_cutout import (
    DARK_LUMA,
    RING,
    cut_character,
    drop_specks,
    luma,
    percent_box,
    save,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/images/leonard-lion-studio.png"
OUT_DIR = ROOT / "public/images/lion"
MANIFEST = ROOT / "src/data/lionScene.json"
BASE_WIDTHS = (768, 1536)

# Polygons in source pixels, generous around each object but never enclosing
# a whole background object (it would travel with the layer).
CHARACTERS = {
    "head": [
        (595, 120), (615, 60), (660, 30), (720, 15), (790, 10), (860, 20),
        (920, 45), (965, 90), (990, 150), (995, 220), (985, 290), (975, 340),
        (940, 375), (880, 395), (820, 405), (760, 405), (700, 398), (650, 380),
        (610, 340), (590, 270), (585, 190),
    ],
    "bulb": [
        (1008, 165), (1014, 142), (1035, 130), (1060, 126), (1086, 132),
        (1104, 148), (1112, 172), (1110, 202), (1100, 228), (1090, 246),
        (1088, 264), (1030, 264), (1022, 246), (1010, 224), (1004, 195),
    ],
    "plant-left": [
        (15, 330), (60, 315), (130, 318), (200, 330), (255, 345), (275, 380),
        (270, 430), (262, 500), (255, 560), (250, 640), (262, 700), (255, 790),
        (240, 850), (230, 900), (200, 935), (150, 940), (90, 930), (45, 900),
        (20, 850), (15, 780), (20, 700), (12, 600), (10, 500), (8, 420),
    ],
    "plant-right": [
        (1372, 420), (1400, 395), (1440, 392), (1480, 400), (1505, 430),
        (1500, 480), (1490, 520), (1485, 600), (1470, 612), (1400, 612),
        (1390, 590), (1388, 520), (1372, 480),
    ],
    "tail": [
        (998, 656), (1038, 656), (1062, 700), (1080, 728), (1084, 690),
        (1097, 662), (1130, 650), (1175, 650), (1205, 660), (1215, 700),
        (1210, 745), (1195, 780), (1160, 800), (1120, 804), (1090, 802),
        (1060, 792), (1030, 772), (1006, 740), (998, 705),
    ],
}

# Ink strokes that close gaps where a layer's fill runs into the background.
SEALS = {
    # where the tail slips under the desk and behind the chair
    "tail": [[(990, 656), (1040, 656)], [(998, 650), (998, 736)]],
}

# Layers erased from the base so they can move over the transparent backdrop.
ERASE = {"tail", "bulb"}

# Fills that leak into neighbours: the pothos wraps around the desk top and
# front leg. Strip pixels matching the colour test (r, g, b), ignoring matches
# smaller than min_size, plus the outline ink hugging them from the cut.
STRIP = {
    "plant-left": (lambda r, g, b: (r > g + 30) & (b < 120), 1),  # desk wood
}

# Pivots in source pixels (transform-origin of each layer's motion).
PIVOTS = {
    "head": (790, 400),
    "bulb": (1058, 262),
    "plant-left": (172, 560),
    "plant-right": (1438, 604),
    "tail": (1000, 678),
}

# Pupils: ellipse centre and radii in source pixels. The cut-out is the pupil;
# the base gets eye white underneath so the pupil can slide a few pixels.
PUPILS = {
    "pupil-left": (708, 196, 10.5, 14),
    "pupil-right": (785.5, 205.5, 11, 13.75),
}
EYE_WHITE = (255, 255, 255, 255)


def ellipse_alpha(size: tuple[int, int], cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    scale = 4
    canvas = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(canvas).ellipse(
        ((cx - rx) * scale, (cy - ry) * scale, (cx + rx) * scale, (cy + ry) * scale),
        fill=255,
    )
    return np.array(canvas.resize(size, Image.LANCZOS))


def cut_pupil(rgba: np.ndarray, cx: float, cy: float, rx: float, ry: float):
    x0, y0 = int(cx - rx) - 2, int(cy - ry) - 2
    x1, y1 = int(cx + rx) + 3, int(cy + ry) + 3
    window = rgba[y0:y1, x0:x1].copy()
    alpha = ellipse_alpha((x1 - x0, y1 - y0), cx - x0, cy - y0, rx, ry)
    window[..., 3] = np.minimum(window[..., 3], alpha)
    return window, (x0, y0, x1, y1), alpha


def strip_colour(cut: np.ndarray, test, min_size: int) -> np.ndarray:
    rgb = cut[..., :3].astype(np.int16)
    hit = (cut[..., 3] > 0) & test(rgb[..., 0], rgb[..., 1], rgb[..., 2])
    if min_size > 1:
        hit = drop_specks(hit, min_size)
    near = np.array(
        Image.fromarray(hit.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))
    ) > 0
    ink = (cut[..., 3] > 0) & (luma(cut) < DARK_LUMA)
    out = cut.copy()
    out[hit | (near & ink), 3] = 0
    return out


BACKDROP = (64, 90, 218)  # --tb-blue behind the scene


def save_base(rgba: np.ndarray) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Lossy AVIF/WebP alpha rings slightly at hard edges; painting every
    # transparent pixel (including the punched holes) with the page's blue
    # makes that ringing blend into the backdrop instead of showing a rim.
    rgba = rgba.copy()
    rgba[rgba[..., 3] == 0, :3] = BACKDROP
    image = Image.fromarray(rgba, "RGBA")
    image.save(OUT_DIR / "base.png", optimize=True)
    for width in BASE_WIDTHS:
        resized = image if width == image.width else image.resize(
            (width, round(image.height * width / image.width)), Image.LANCZOS
        )
        resized.save(OUT_DIR / f"base-{width}.webp", "WEBP", quality=84, method=6)
        resized.save(OUT_DIR / f"base-{width}.avif", "AVIF", quality=62, speed=4)
        for suffix in ("webp", "avif"):
            size = (OUT_DIR / f"base-{width}.{suffix}").stat().st_size
            print(f"base-{width}.{suffix:4s} {size / 1024:.0f} KB")


def write_review(rgba: np.ndarray, layers) -> None:
    review_dir = ROOT / "output/lion-scene"
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
        base.save(review_dir / f"{name}-mask.png")
        solo = Image.new("RGBA", (cut.shape[1] + 20, cut.shape[0] + 20), (64, 90, 218, 255))
        solo.alpha_composite(Image.fromarray(cut, "RGBA"), (10, 10))
        solo.save(review_dir / f"{name}-cut.png")


def main() -> None:
    review = "--review" in sys.argv
    image = Image.open(SOURCE).convert("RGBA")
    rgba = np.array(image)
    width, height = image.size
    base = rgba.copy()
    layers = {}
    for name, points in CHARACTERS.items():
        erased = name in ERASE
        cut, box = cut_character(
            rgba,
            points,
            SEALS.get(name, []),
            [],
            ring=0 if erased else RING,
            soften=not erased,
        )
        if name in STRIP:
            cut = strip_colour(cut, *STRIP[name])
        layers[name] = (cut, box)
        if erased:
            # Punch the layer out of the base, taking the semi-transparent
            # anti-aliasing fringe just outside its outline with it (never
            # opaque neighbours such as the chair).
            x0, y0, x1, y1 = box
            hole = (cut[..., 3] > 0).astype(np.uint8) * 255
            fringe = np.array(Image.fromarray(hole).filter(ImageFilter.MaxFilter(5))) > 0
            region = base[y0:y1, x0:x1]
            region[..., 3] = np.minimum(region[..., 3], 255 - hole)
            region[fringe & (region[..., 3] < 200), 3] = 0
    for name, (cx, cy, rx, ry) in PUPILS.items():
        cut, box, alpha = cut_pupil(rgba, cx, cy, rx, ry)
        layers[name] = (cut, box)
        x0, y0, x1, y1 = box
        region = base[y0:y1, x0:x1]
        white = np.array(EYE_WHITE, np.uint8)
        weight = (alpha.astype(np.float32) / 255)[..., None]
        region[...] = (region * (1 - weight) + white * weight).round().astype(np.uint8)

    manifest = {"width": width, "height": height, "layers": {}}
    for name, (cut, box) in layers.items():
        size = save(cut, OUT_DIR, name, lossless=False)
        entry = percent_box(box, width, height)
        pivot = PIVOTS.get(name) or PUPILS[name][:2]  # pupils pivot on centre
        entry["ox"] = round((pivot[0] - box[0]) / (box[2] - box[0]) * 100, 2)
        entry["oy"] = round((pivot[1] - box[1]) / (box[3] - box[1]) * 100, 2)
        manifest["layers"][name] = entry
        print(f"{name:12s} box={tuple(int(v) for v in box)} {size / 1024:.0f} KB")
    save_base(base)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    if review:
        write_review(rgba, layers)
        Image.fromarray(base, "RGBA").save(ROOT / "output/lion-scene/base.png")
        print("review images in output/lion-scene/")


if __name__ == "__main__":
    main()
