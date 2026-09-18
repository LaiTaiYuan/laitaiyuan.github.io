"""Cut animated layers out of the public toolbox hero illustration.

Usage: python scripts/build-toolbox-scene.py [--review]

Reads public/tools/maker-street.png and writes:
  public/tools/scene/<layer>.webp   lossless cut-outs (characters, reel, static props)
  src/data/toolboxScene.json        layer boxes as percentages of the scene

Characters are isolated with an outline-bounded fill (see scene_cutout.py).
Because every cut-out is placed back over the untouched base image at the
exact same spot, the edges only need to be roughly right; the animations are
small scale/translate moves.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from scene_cutout import cut_character, cut_disc, percent_box, save

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/tools/maker-street.png"
OUT_DIR = ROOT / "public/tools/scene"
MANIFEST = ROOT / "src/data/toolboxScene.json"

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
        size = save(cut, OUT_DIR, name)
        manifest["layers"][name] = percent_box(box, width, height)
        print(f"{name:8s} box={tuple(int(v) for v in box)} {size / 1024:.0f} KB")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    if review:
        write_review(rgba, layers)
        print("review images in output/toolbox-scene/")


if __name__ == "__main__":
    main()
