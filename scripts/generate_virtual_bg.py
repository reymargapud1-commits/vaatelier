#!/usr/bin/env python3
"""
Generates a branded virtual meeting background for The VA Atelier (Zoom /
Google Meet / Microsoft Teams), reusing the same brand system as the
trailer video and social posters (generate_trailer.py) - wine/gold
palette, logo mark, fonts.

Standard 1920x1080 16:9, matching the trailer's own canvas exactly, so no
resizing tricks are needed. A webcam feed usually centers the person
horizontally and their head sits fairly high in frame - a top-band header
gets covered. So branding instead lives in a vertical column down the LEFT
side, clear of the center column where a face sits, with a matching accent
on the right for balance.

Usage:
    python3 scripts/generate_virtual_bg.py
Output:
    .poster_output/virtual-background.png  (1920x1080)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_trailer as gt  # reuse brand palette, fonts, drawing helpers

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / ".poster_output"

KICKER = "THE VA ATELIER"
TAGLINE = "Virtual Assistant Training Program"
WATERMARK = "vaatelier.online"


def build():
    W, H = gt.W, gt.H  # 1920x1080 - same canvas the trailer already uses
    col_cx = 235  # left column center - clear of a centered face/shoulders

    img = gt.base_background(
        vignette_strength=185,
        glow_center=(col_cx, int(H * 0.42)),
        accent="rings", accent_center=(W - 260, int(H * 0.58)),
    ).convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Logo + kicker + tagline, stacked down the left column instead of the
    # top band - a webcam feed centers the person and their head sits high
    # in frame, so anything centered up top gets covered.
    logo_cy = int(H * 0.30)
    gt.draw_logo_mark(img, (col_cx, logo_cy), 58)
    draw = ImageDraw.Draw(img)

    font_kicker = ImageFont.truetype(gt.FONT_SANS_BOLD, 30)
    kicker_lines = ["THE VA", "ATELIER"]
    ky = logo_cy + 84
    for line in kicker_lines:
        bbox = draw.textbbox((0, 0), line, font=font_kicker)
        draw.text((col_cx - (bbox[2] - bbox[0]) / 2, ky), line, font=font_kicker, fill=gt.BRAND_GOLD_BRIGHT)
        ky += 42

    rule_y = ky + 14
    rw = 90
    draw.rectangle([col_cx - rw / 2, rule_y, col_cx + rw / 2, rule_y + 2], fill=gt.BRAND_GOLD)

    font_tag = ImageFont.truetype(gt.FONT_SANS, 20)
    tag_lines = gt.wrap_text(TAGLINE, font_tag, draw, 300)
    ty = rule_y + 30
    for line in tag_lines:
        bbox = draw.textbbox((0, 0), line, font=font_tag)
        draw.text((col_cx - (bbox[2] - bbox[0]) / 2, ty), line, font=font_tag, fill=(214, 200, 190))
        ty += 28

    # Watermark further down the same column, well below the header block.
    font_wm = ImageFont.truetype(gt.FONT_SANS_BOLD, 22)
    bbox = draw.textbbox((0, 0), WATERMARK, font=font_wm)
    wy = int(H * 0.80)
    draw.text((col_cx - (bbox[2] - bbox[0]) / 2, wy), WATERMARK, font=font_wm, fill=gt.BRAND_GOLD)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "virtual-background.png"
    img.convert("RGB").save(out_path, "PNG", quality=95)
    print("Done ->", out_path)


if __name__ == "__main__":
    build()
