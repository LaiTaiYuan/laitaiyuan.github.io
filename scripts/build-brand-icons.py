"""Render the favicon set from the brand app icon.

Usage: python scripts/build-brand-icons.py

Reads public/brand/lai-app-icon.svg (the 512x512 app icon from the brand kit)
and writes into public/:
  favicon.svg                  the app icon itself
  favicon.ico                  16, 32 and 48 px
  favicon-16.png, favicon-32.png
  apple-touch-icon.png         180 px, square and full-bleed: iOS rounds the
                               corners itself and fills transparent ones black
  icon-192.png, icon-512.png   listed in site.webmanifest

Chromium draws the SVG (Playwright for Python), so the PNGs match what
browsers show; Pillow packs the ICO.
"""

from __future__ import annotations

import io
import shutil
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = PUBLIC / "brand/lai-app-icon.svg"
ROUNDED = '<rect width="512" height="512" rx="116" fill="#0A3A9E"/>'
SQUARE = '<rect width="512" height="512" fill="#0A3A9E"/>'


def render(browser, svg: str, size: int) -> Image.Image:
    page = browser.new_page(viewport={"width": size, "height": size})
    sized = svg.replace('width="512" height="512"', f'width="{size}" height="{size}"', 1)
    page.set_content(f'<body style="margin:0">{sized}</body>')
    png = page.screenshot(
        omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size}
    )
    page.close()
    return Image.open(io.BytesIO(png)).convert("RGBA")


def main() -> None:
    icon = SOURCE.read_text(encoding="utf-8")
    assert ROUNDED in icon, "app icon background rect not found"
    square = icon.replace(ROUNDED, SQUARE)
    shutil.copyfile(SOURCE, PUBLIC / "favicon.svg")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-color-profile=srgb"])
        ico = [render(browser, icon, size) for size in (16, 32, 48)]
        ico[0].save(PUBLIC / "favicon-16.png")
        ico[1].save(PUBLIC / "favicon-32.png")
        ico[2].save(
            PUBLIC / "favicon.ico",
            sizes=[(16, 16), (32, 32), (48, 48)],
            append_images=ico[:2],
        )
        render(browser, square, 180).save(PUBLIC / "apple-touch-icon.png")
        for size in (192, 512):
            render(browser, icon, size).save(PUBLIC / f"icon-{size}.png")
        browser.close()
    print("Wrote favicon.svg, favicon.ico and the 16/32/180/192/512 PNGs.")


if __name__ == "__main__":
    main()
