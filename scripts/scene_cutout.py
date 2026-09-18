"""Shared helpers for cutting animated layers out of the hero illustrations.

Used by build-toolbox-scene.py and build-lion-scene.py. Characters are
isolated with an outline-bounded fill: everything inside a hand-drawn polygon
that is not connected to the background (regions reachable from outside the
polygon, or transparent) belongs to the character.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DARK_LUMA = 40  # outline ink and dark fills
RING = 3  # half the outline width, trimmed from the background side


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
    ring: int = RING,
    soften: bool = True,
) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Cut the object inside `points`. `ring` trims that many pixels of outline
    on the background side; `soften` blurs the edge by a pixel. Layers that are
    also erased from the base use ring=0 and soften=False so the cut and the
    hole match exactly."""
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
    mask = inside & ~(dilate(background, ring) if ring else background)
    for polygon in force:
        keep = polygon_mask((x1 - x0, y1 - y0), [(x - x0, y - y0) for x, y in polygon])
        mask |= keep & inside & ~background
    mask = drop_specks(mask)
    alpha = Image.fromarray(mask.astype(np.uint8) * 255)
    if soften:
        alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
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


def save(rgba: np.ndarray, out_dir: Path, name: str, lossless: bool = True) -> int:
    """Write a layer as WebP. Lossy layers keep a lossless alpha channel so
    their edges still line up with the base."""
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.webp"
    image = Image.fromarray(rgba, "RGBA")
    if lossless:
        image.save(path, "WEBP", lossless=True, quality=100, method=6)
    else:
        image.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
    return path.stat().st_size
