"""Encode responsive WebP/AVIF variants of the large public photos.

Usage: python scripts/build-images.py

The originals stay in the repo as the source of truth (and as the <img>
fallback); the encoded variants are what modern browsers actually download.
The lion studio scene is encoded by build-lion-scene.py instead.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# (source, output stem, widths, webp quality, avif quality)
TARGETS = [
    ("public/images/leonard-it-matters-2025.jpg", "public/images/leonard-it-matters-2025", (800, 1200, 1600), 80, 58),
    ("public/tools/maker-street.png", "public/tools/maker-street", (1086, 2172), 84, 62),
]


def encode(source: Path, stem: Path, widths: tuple[int, ...], webp_q: int, avif_q: int) -> None:
    image = Image.open(source)
    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    for width in widths:
        resized = image if width >= image.width else image.resize(
            (width, round(image.height * width / image.width)), Image.LANCZOS
        )
        webp = stem.with_name(f"{stem.name}-{width}.webp")
        avif = stem.with_name(f"{stem.name}-{width}.avif")
        resized.save(webp, "WEBP", quality=webp_q, method=6)
        resized.save(avif, "AVIF", quality=avif_q, speed=4)
        for path in (webp, avif):
            print(f"{path.relative_to(ROOT).as_posix():55s} {path.stat().st_size / 1024:6.0f} KB")


def main() -> None:
    for source, stem, widths, webp_q, avif_q in TARGETS:
        encode(ROOT / source, ROOT / stem, widths, webp_q, avif_q)


if __name__ == "__main__":
    main()
