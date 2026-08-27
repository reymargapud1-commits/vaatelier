#!/usr/bin/env python3
"""
Generates eye-catching promotional poster images for The VA Atelier, sized
for the social media formats that actually get used (square feed post,
taller feed post, Stories/Reels cover). Reuses the same brand system already
built for the homepage trailer (generate_trailer.py) - wine/gold palette,
logo mark, Lora serif headline font, Coach Reymar's real photos - so the
website, the trailer video, and these posters all read as one consistent
brand instead of three different looks.

Usage:
    python3 scripts/generate_poster.py
Output (in .poster_output/, not part of the deployed site):
    poster-square.png    1080x1080  - Facebook / Instagram / LinkedIn feed
    poster-portrait.png  1080x1350  - Instagram / Facebook feed (taller)
    poster-story.png     1080x1920  - Instagram / Facebook Stories & Reels
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_trailer as gt  # reuse brand palette, fonts, drawing helpers

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / ".poster_output"
TRAINER_DIR = ROOT / "public" / "images" / "trainer"
P = str(TRAINER_DIR)

KICKER = "THE VA ATELIER"
HEADLINE = "FROM ZERO TO JOB-READY."
SUBHEAD = ("Beginner-friendly VA training, ready-made documents, and real coaching "
           "- everything you need to land your first client.")
FEATURES_LINE = "✓ Beginner-Friendly     ✓ Lifetime Access     ✓ Real Client-Ready Skills"
PRICE_LABEL = "₱499"
PRICE_SUB = ["ONE-TIME PAYMENT", "LIFETIME ACCESS"]
CTA = "Enroll Now  →  vaatelier.online"


def set_canvas(w, h):
    """generate_trailer's drawing helpers read W/H as module globals at call
    time, so retargeting them before each call adapts every reused helper
    (base_background, photo_background_split, wrap_text sizing, etc.) to
    this poster's own dimensions instead of the video's fixed 1920x1080."""
    gt.W, gt.H = w, h


def price_badges_at(img, labels, y, center_x, font_size=24, pad_x=30, gap=34):
    """Same look as generate_trailer's draw_price_badges, but centered on an
    arbitrary column instead of the full canvas width - needed once the
    poster has a photo occupying part of the frame."""
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(gt.FONT_SANS_BOLD, font_size)
    pad_y = 14
    widths = []
    for label in labels:
        bbox = draw.textbbox((0, 0), label, font=font)
        widths.append(bbox[2] - bbox[0] + pad_x * 2)
    total_w = sum(widths) + gap * (len(labels) - 1)
    x = center_x - total_w / 2
    h = font_size + pad_y * 2
    for label, w in zip(labels, widths):
        draw.rounded_rectangle([x, y, x + w, y + h], radius=999, outline=gt.BRAND_GOLD, width=2)
        draw.text((x + pad_x, y + pad_y - 2), label, font=font, fill=gt.BRAND_GOLD_BRIGHT)
        x += w + gap
    return y + h


def cta_button_at(img, text, y, center_x, font_size=28, pad_x=36):
    draw = ImageDraw.Draw(img)
    font_cta = ImageFont.truetype(gt.FONT_SANS_BOLD, font_size)
    bbox = draw.textbbox((0, 0), text, font=font_cta)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_y = int(pad_x * 0.55)
    bx0, bx1 = center_x - tw / 2 - pad_x, center_x + tw / 2 + pad_x
    by0, by1 = y, y + th + pad_y * 2
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=999, fill=gt.BRAND_GOLD)
    draw.text((center_x - tw / 2, by0 + pad_y - 4), text, font=font_cta, fill=gt.BRAND_WINE_DARK)
    return by1


def kicker_and_logo(img, cx, y):
    gt.draw_logo_mark(img, (cx, y), 50)
    draw = ImageDraw.Draw(img)
    y_text = y + 74
    font_kicker = ImageFont.truetype(gt.FONT_SANS_BOLD, 30)
    bbox = draw.textbbox((0, 0), KICKER, font=font_kicker)
    kx = cx - (bbox[2] - bbox[0]) / 2
    draw.text((kx, y_text), KICKER, font=font_kicker, fill=gt.BRAND_GOLD_BRIGHT)
    return y_text + 50


def build_split_poster(out_path, w=1080, h=1080):
    """Square format: left column is Coach Reymar's real photo, right column
    is all text - the same split-screen idea used in the trailer's coach
    scene, so nothing ever overlaps his face."""
    set_canvas(w, h)
    split_frac = 0.58
    photo_w = int(w * split_frac)
    text_cx = photo_w + (w - photo_w) // 2

    # The source photo is a full-room shot; a centered crop into this narrow
    # a column pushes the "Reymar" neon sign (right of center in the room)
    # half out of frame. Pre-crop toward that side of the room first so the
    # sign lands fully inside the column instead of at its edge.
    src = Image.open(f"{P}/coach-wfh-setup-room.jpg").convert("RGB")
    sx0 = int(src.width * 0.37)
    src_cropped = src.crop((sx0, 0, src.width, src.height))
    cropped_path = OUT_DIR / "_src_room_crop.jpg"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src_cropped.save(cropped_path, "JPEG", quality=92)

    img = gt.photo_background_split(
        str(cropped_path), side="left", split_frac=split_frac,
        accent="rings", accent_center=(text_cx, int(h * 0.30)),
    )
    draw = ImageDraw.Draw(img)

    y = kicker_and_logo(img, text_cx, 70)
    draw = ImageDraw.Draw(img)

    max_text_w = w - photo_w - 90

    font_head = ImageFont.truetype(gt.FONT_SERIF_BOLD, 40)
    lines = gt.wrap_text(HEADLINE, font_head, draw, max_text_w)
    line_h = 40 + 10
    y0 = y + 22
    gt.draw_centered_lines(draw, lines, font_head, y0, gt.WHITE, line_h, center_x=text_cx)
    y1 = y0 + line_h * len(lines) + 20

    font_sub = ImageFont.truetype(gt.FONT_SANS, 18)
    sub_lines = gt.wrap_text(SUBHEAD, font_sub, draw, max_text_w - 10)
    y2 = gt.draw_centered_lines(draw, sub_lines, font_sub, y1, (214, 200, 190), 26, center_x=text_cx)

    font_feat = ImageFont.truetype(gt.FONT_SANS_BOLD, 14)
    feat_lines = gt.wrap_text(FEATURES_LINE, font_feat, draw, max_text_w)
    y3 = gt.draw_centered_lines(draw, feat_lines, font_feat, y2 + 22, gt.BRAND_GOLD_BRIGHT, 21, center_x=text_cx)

    font_price = ImageFont.truetype(gt.FONT_SERIF_BOLD, 66)
    bbox = draw.textbbox((0, 0), PRICE_LABEL, font=font_price)
    pw, ph = bbox[2] - bbox[0], bbox[3] - bbox[1]
    py = y3 + 26
    draw.text((text_cx - pw / 2, py), PRICE_LABEL, font=font_price, fill=gt.WHITE)
    y4 = price_badges_at(img, PRICE_SUB, py + ph + 22, text_cx, font_size=13, pad_x=14, gap=14)

    cta_button_at(img, CTA, y4 + 20, text_cx, font_size=16, pad_x=18)

    img.convert("RGB").save(out_path, "PNG", quality=95)


def vertical_gradient_L(width, height, stops):
    """Vertical counterpart to generate_trailer's horizontal_gradient_L - an
    alpha gradient varying by Y, from piecewise-linear [(y_frac, value), ...]
    stops."""
    col = Image.new("L", (1, height))
    ys = [max(0, min(height - 1, int(s[0] * height))) for s in stops]
    vals = [s[1] for s in stops]
    for y in range(height):
        if y <= ys[0]:
            v = vals[0]
        elif y >= ys[-1]:
            v = vals[-1]
        else:
            v = vals[-1]
            for i in range(len(ys) - 1):
                if ys[i] <= y <= ys[i + 1]:
                    span = max(1, ys[i + 1] - ys[i])
                    t = (y - ys[i]) / span
                    v = int(vals[i] * (1 - t) + vals[i + 1] * t)
                    break
        col.putpixel((0, y), v)
    return col.resize((width, height))


def photo_top_band(photo_path, w, band_h, feather=150, accent=None, accent_center=None):
    """A photo confined to a band across the TOP of the frame, fading into
    the branded gradient below it - the vertical equivalent of the split-
    screen coach scene in the trailer. All text then lives entirely below
    the band, on the plain gradient, so it can never sit on top of the
    photo the way a full-bleed photo + scrim risks."""
    bg = gt.base_background(vignette_strength=140, accent=accent, accent_center=accent_center).convert("RGBA")
    photo = gt.cover_crop(Image.open(photo_path).convert("RGB"), w, band_h).convert("RGBA")
    tint = Image.new("RGBA", (w, band_h), (*gt.BRAND_WINE_DARK, 55))
    photo = Image.alpha_composite(photo, tint)

    fade_start = max(0.0, 1 - feather / band_h)
    alpha_mask = vertical_gradient_L(w, band_h, [(0.0, 255), (fade_start, 255), (1.0, 0)])
    photo.putalpha(alpha_mask)
    bg.alpha_composite(photo, dest=(0, 0))
    return bg


def build_tall_poster(out_path, w, h, band_h):
    """Portrait / Story format: Coach Reymar's photo confined to a band
    across the top, all text below it on the clean gradient - structurally
    the same fix as the trailer's split-screen coach scene, just rotated
    90 degrees to suit a tall frame."""
    set_canvas(w, h)
    text_y_start = int(band_h * (1 - 150 / band_h)) + 50
    img = photo_top_band(
        f"{P}/coach-wfh-setup-desk.jpg", w, band_h, feather=150,
        accent="rings", accent_center=(w // 2, int(band_h * 0.5)),
    )
    draw = ImageDraw.Draw(img)
    cx = w // 2

    y = kicker_and_logo(img, cx, int(h * 0.045))
    draw = ImageDraw.Draw(img)

    body_top = max(text_y_start, y + 30)
    max_text_w = int(w * 0.86)

    head_size = int(w * 0.072)
    font_head = ImageFont.truetype(gt.FONT_SERIF_BOLD, head_size)
    lines = gt.wrap_text(HEADLINE, font_head, draw, max_text_w)
    line_h = head_size + 14
    gt.draw_centered_lines(draw, lines, font_head, body_top, gt.WHITE, line_h, center_x=cx)
    y1 = body_top + line_h * len(lines) + 18

    sub_size = int(w * 0.026)
    font_sub = ImageFont.truetype(gt.FONT_SANS, sub_size)
    sub_lines = gt.wrap_text(SUBHEAD, font_sub, draw, int(w * 0.76))
    y2 = gt.draw_centered_lines(draw, sub_lines, font_sub, y1, (222, 210, 200), sub_size + 14, center_x=cx)

    feat_size = int(w * 0.017)
    font_feat = ImageFont.truetype(gt.FONT_SANS_BOLD, feat_size)
    feat_lines = gt.wrap_text(FEATURES_LINE, font_feat, draw, max_text_w)
    y3 = gt.draw_centered_lines(draw, feat_lines, font_feat, y2 + int(h * 0.02), gt.BRAND_GOLD_BRIGHT,
                                 feat_size + 10, center_x=cx)

    font_price = ImageFont.truetype(gt.FONT_SERIF_BOLD, int(w * 0.12))
    bbox = draw.textbbox((0, 0), PRICE_LABEL, font=font_price)
    pw, ph = bbox[2] - bbox[0], bbox[3] - bbox[1]
    py = y3 + int(h * 0.025)
    draw.text((cx - pw / 2, py), PRICE_LABEL, font=font_price, fill=gt.WHITE)
    y4 = price_badges_at(img, PRICE_SUB, py + ph + int(h * 0.02), cx, font_size=int(w * 0.02))

    bottom = cta_button_at(img, CTA, y4 + int(h * 0.02), cx)
    if bottom > h - 20:
        print(f"  WARNING: content bottom {bottom:.0f} exceeds frame height {h} (band_h={band_h})")

    img.convert("RGB").save(out_path, "PNG", quality=95)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_split_poster(OUT_DIR / "poster-square.png", 1080, 1080)
    build_tall_poster(OUT_DIR / "poster-portrait.png", 1080, 1350, band_h=470)
    build_tall_poster(OUT_DIR / "poster-story.png", 1080, 1920, band_h=780)
    print("Done ->", OUT_DIR)


if __name__ == "__main__":
    main()
