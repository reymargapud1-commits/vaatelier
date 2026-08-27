#!/usr/bin/env python3
"""
Generates the cinematic homepage trailer for The VA Atelier.

A ~50-58s motion-graphics style promo: animated title cards and icon
montages with slow Ken Burns zoom, color-emoji icons, Coach Reymar's own
photos for the trainer-introduction beat, narrated with Piper (the same
offline neural TTS used for the lesson videos), under a soft synthesized
ambient music bed (a few sine-wave pads mixed together - no external
royalty-free-music download needed, so there are zero licensing
questions).

There is no real video footage of an actual VA's life (or a stock actor
playing an overwhelmed beginner) available to this project, so rather than
fake it with generic stock photography, this trailer leans fully into a
clean, branded, text-and-icon motion-graphics style for those beats - the
same honest choice the course's slide videos make - while using Coach
Reymar's real submitted photos for his own introduction, since those are
genuinely his.

Output: public/trailer.mp4 (served directly, unlike lesson videos - the
trailer is marketing, so it must NOT be paywalled, and belongs in /public
rather than media/videos).

Usage:
    VA_TTS_MODEL=/path/to/voice.onnx python3 scripts/generate_trailer.py
"""

import math
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from piper import PiperVoice
import wave

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
TRAINER_DIR = ROOT / "public" / "images" / "trainer"
TMP_DIR = ROOT / ".trailer_tmp"

W, H = 1920, 1080
FPS = 30

BRAND_WINE = (43, 22, 32)
BRAND_WINE_DARK = (18, 9, 13)
BRAND_GOLD = (199, 164, 100)
BRAND_GOLD_BRIGHT = (226, 195, 138)
WHITE = (250, 246, 241)

FONT_DIR = "/usr/share/fonts/truetype/google-fonts"
FONT_SERIF_BOLD = f"{FONT_DIR}/Lora-Bold.ttf" if Path(f"{FONT_DIR}/Lora-Bold.ttf").exists() else "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FONT_SERIF_ITALIC = f"{FONT_DIR}/Lora-Italic.ttf" if Path(f"{FONT_DIR}/Lora-Italic.ttf").exists() else "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"
FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"

MODEL_PATH = os.environ.get("VA_TTS_MODEL", "/tmp/piper-voice/en-us-lessac-medium.onnx")
_voice = None


def get_voice():
    global _voice
    if _voice is None:
        if not Path(MODEL_PATH).exists():
            raise SystemExit(f"Piper voice model not found at {MODEL_PATH}.")
        _voice = PiperVoice.load(MODEL_PATH)
    return _voice


def synthesize_audio(text, out_wav):
    voice = get_voice()
    with wave.open(str(out_wav), "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)


def get_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def wrap_text(text, font, draw, max_width):
    words = text.split()
    lines, current = [], ""
    for w in words:
        trial = (current + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def radial_glow(size, center, radius, color, max_alpha=140):
    """A soft radial glow used behind headline text / icons for depth."""
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    steps = 60
    cx, cy = center
    for i in range(steps, 0, -1):
        frac = i / steps
        r = int(radius * frac)
        alpha = int(max_alpha * (1 - frac) ** 2)
        gd.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(color[0], color[1], color[2], alpha),
        )
    return glow


def horizontal_gradient_L(width, height, stops):
    """A grayscale (alpha) gradient varying by X, built from piecewise-linear
    stops [(x_frac, value_0_255), ...] - the horizontal counterpart to the
    vertical gradient trick above. O(width), then stretched vertically."""
    row = Image.new("L", (width, 1))
    xs = [max(0, min(width - 1, int(s[0] * width))) for s in stops]
    vals = [s[1] for s in stops]
    for x in range(width):
        if x <= xs[0]:
            v = vals[0]
        elif x >= xs[-1]:
            v = vals[-1]
        else:
            v = vals[-1]
            for i in range(len(xs) - 1):
                if xs[i] <= x <= xs[i + 1]:
                    span = max(1, xs[i + 1] - xs[i])
                    t = (x - xs[i]) / span
                    v = int(vals[i] * (1 - t) + vals[i + 1] * t)
                    break
        row.putpixel((x, 0), v)
    return row.resize((width, height))


def accent_rings_layer(center, color=BRAND_GOLD, base_r=140, count=3, gap=68, alpha=60, width=2):
    """A few faint concentric ring outlines - a quiet decorative accent so
    a scene doesn't look like a plain copy of every other scene."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    cx, cy = center
    for i in range(count):
        r = base_r + i * gap
        a = max(alpha - i * 16, 8)
        ld.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*color, a), width=width)
    return layer


def diagonal_sweep_layer(color=BRAND_GOLD, alpha=34, angle=18, band_frac=0.4, offset_frac=0.62, mirror=False):
    """A soft, rotated diagonal light band across the frame - a 'sweep'
    accent used behind the skill/document icon grids for extra motion."""
    diag = int((W ** 2 + H ** 2) ** 0.5)
    band = Image.new("RGBA", (diag, diag), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    band_w = diag * band_frac
    x0 = diag * offset_frac
    steps = 48
    step_w = band_w / steps
    for i in range(steps):
        frac = i / steps
        a = int(alpha * (1 - abs(frac - 0.5) * 2))
        bd.rectangle([x0 + i * step_w, 0, x0 + (i + 1) * step_w, diag], fill=(*color, max(a, 0)))
    band = band.rotate(-angle if mirror else angle, resample=Image.BICUBIC, expand=False)
    left = (band.width - W) // 2
    top = (band.height - H) // 2
    return band.crop((left, top, left + W, top + H))


def base_background(vignette_strength=170, glow_center=None, accent=None, accent_center=None, mirror_accent=False):
    """Dark wine-to-black cinematic gradient background with a soft gold
    glow and vignette, matching the course's wine/gold brand palette. An
    optional `accent` ("rings" | "beam") gives individual scenes a more
    distinct look instead of every scene sharing one identical backdrop."""
    grad = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / H
        r = int(BRAND_WINE[0] * (1 - t) + BRAND_WINE_DARK[0] * t)
        g = int(BRAND_WINE[1] * (1 - t) + BRAND_WINE_DARK[1] * t)
        b = int(BRAND_WINE[2] * (1 - t) + BRAND_WINE_DARK[2] * t)
        grad.putpixel((0, y), (r, g, b))
    img = grad.resize((W, H))

    img = img.convert("RGBA")
    gc = glow_center or (W // 2, int(H * 0.38))
    glow = radial_glow((W, H), gc, int(H * 0.75), BRAND_GOLD, max_alpha=60)
    img = Image.alpha_composite(img, glow)

    if accent == "rings":
        img = Image.alpha_composite(img, accent_rings_layer(accent_center or gc))
    elif accent == "beam":
        img = Image.alpha_composite(img, diagonal_sweep_layer(mirror=mirror_accent))

    vignette = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([-W * 0.3, -H * 0.3, W * 1.3, H * 1.3], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(120))
    dark_layer = Image.new("RGBA", (W, H), (0, 0, 0, vignette_strength))
    inv = Image.eval(vignette, lambda a: 255 - a)
    dark_layer.putalpha(inv.point(lambda a: int(a * (vignette_strength / 255))))
    img = Image.alpha_composite(img, dark_layer)
    return img.convert("RGB")


def cover_crop(img, target_w, target_h):
    """Crops (center) + resizes a photo to exactly fill target_w x target_h,
    like CSS background-size: cover."""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h
    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        x0 = (src_w - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        y0 = (src_h - new_h) // 2
        img = img.crop((0, y0, src_w, y0 + new_h))
    return img.resize((target_w, target_h), Image.LANCZOS)


def photo_background(photo_path, vignette_strength=185):
    """A real photo, full-bleed, color-graded to match the brand (a warm
    wine-toned tint + a bottom-up scrim so headline text stays legible) -
    used for Coach Reymar's own introduction beat."""
    img = Image.open(photo_path).convert("RGB")
    img = cover_crop(img, W, H).convert("RGBA")

    tint = Image.new("RGBA", (W, H), (*BRAND_WINE_DARK, 70))
    img = Image.alpha_composite(img, tint)

    scrim = Image.new("L", (1, H), 0)
    for y in range(H):
        t = y / H
        alpha = int(240 * max(0.0, (t - 0.28) / 0.72) ** 1.25)
        scrim.putpixel((0, y), alpha)
    scrim = scrim.resize((W, H))
    scrim_layer = Image.new("RGBA", (W, H), (*BRAND_WINE_DARK, 0))
    scrim_layer.putalpha(scrim)
    img = Image.alpha_composite(img, scrim_layer)

    vignette = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([-W * 0.3, -H * 0.5, W * 1.3, H * 1.1], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(140))
    dark_layer = Image.new("RGBA", (W, H), (0, 0, 0, vignette_strength))
    inv = Image.eval(vignette, lambda a: 255 - a)
    dark_layer.putalpha(inv.point(lambda a: int(a * (vignette_strength / 255))))
    img = Image.alpha_composite(img, dark_layer)
    return img


def photo_background_split(photo_path, side="left", split_frac=0.46, feather=170,
                            vignette_strength=150, accent=None, accent_center=None,
                            mirror_accent=False):
    """A split-screen layout: Coach Reymar's real photo confined to one side
    of the frame, the branded gradient (with its own accent) filling the
    rest - so headline/kicker/subtext text living in the other column can
    never physically overlap his face, instead of relying on careful
    positioning of small inset boxes."""
    bg = base_background(
        vignette_strength=vignette_strength, accent=accent,
        accent_center=accent_center, mirror_accent=mirror_accent,
    ).convert("RGBA")

    photo_w = int(W * split_frac)
    photo = cover_crop(Image.open(photo_path).convert("RGB"), photo_w, H).convert("RGBA")

    tint = Image.new("RGBA", (photo_w, H), (*BRAND_WINE_DARK, 55))
    photo = Image.alpha_composite(photo, tint)

    if side == "left":
        fade_start = max(0.0, 1 - feather / photo_w)
        stops = [(0.0, 255), (fade_start, 255), (1.0, 0)]
        dest_x = 0
        seam_x = int(photo_w * fade_start)
    else:
        fade_end = min(1.0, feather / photo_w)
        stops = [(0.0, 0), (fade_end, 255), (1.0, 255)]
        dest_x = W - photo_w
        seam_x = dest_x + int(photo_w * fade_end)

    alpha_mask = horizontal_gradient_L(photo_w, H, stops)
    photo.putalpha(alpha_mask)
    bg.alpha_composite(photo, dest=(dest_x, 0))

    d = ImageDraw.Draw(bg)
    d.line([(seam_x, 0), (seam_x, H)], fill=(*BRAND_GOLD, 90), width=2)
    return bg


def paste_inset(img, photo_path, box, border_color=BRAND_GOLD, border_w=4, radius=18):
    """Pastes a second photo as a small rounded, gold-bordered thumbnail -
    used to bring in more than one of Coach Reymar's real photos per beat."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    thumb = Image.open(photo_path).convert("RGB")
    thumb = cover_crop(thumb, w, h)
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    thumb_rgba = thumb.convert("RGBA")
    thumb_rgba.putalpha(mask)
    img.paste(thumb_rgba, (x0, y0), thumb_rgba)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=border_color, width=border_w)


_EMOJI_NATIVE_SIZE = 109  # NotoColorEmoji is a fixed-strike bitmap font - only this size loads


def draw_emoji(img, emoji, center, size=220):
    font = ImageFont.truetype(FONT_EMOJI, _EMOJI_NATIVE_SIZE)
    pad = 20
    layer = Image.new("RGBA", (_EMOJI_NATIVE_SIZE + pad * 2, _EMOJI_NATIVE_SIZE + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((pad, pad), emoji, font=font, embedded_color=True)
    if size != _EMOJI_NATIVE_SIZE:
        scale = size / _EMOJI_NATIVE_SIZE
        layer = layer.resize((int(layer.width * scale), int(layer.height * scale)), Image.LANCZOS)
    img.paste(layer, (center[0] - layer.width // 2, center[1] - layer.height // 2), layer)


def draw_centered_lines(draw, lines, font, y, fill, line_height, align_center=True, center_x=None):
    cx = W / 2 if center_x is None else center_x
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        x = cx - lw / 2 if align_center else 96
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def draw_icon_grid(img, items, top_y, cols=4, chip_w=372, chip_h=210, gap_x=22, gap_y=22):
    """A grid of rounded glass chips, each with an emoji + label - the
    'quick montage of skills / documents' beat, done as motion graphics
    rather than faked stock footage."""
    rows = math.ceil(len(items) / cols)
    grid_w = cols * chip_w + (cols - 1) * gap_x
    x0 = (W - grid_w) / 2
    font_label = ImageFont.truetype(FONT_SANS_BOLD, 27)

    # ImageDraw paints raw RGBA pixels rather than alpha-blending with what's
    # beneath, so a translucent fill must be composited via a separate layer
    # first - drawing it straight onto `img` would just paint solid white.
    chip_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    chip_draw = ImageDraw.Draw(chip_layer)
    boxes = []
    for idx in range(len(items)):
        col = idx % cols
        row = idx // cols
        cx0 = x0 + col * (chip_w + gap_x)
        cy0 = top_y + row * (chip_h + gap_y)
        boxes.append((cx0, cy0))
        chip_draw.rounded_rectangle(
            [cx0, cy0, cx0 + chip_w, cy0 + chip_h],
            radius=22,
            fill=(255, 255, 255, 30),
            outline=(255, 255, 255, 70),
            width=1,
        )
    img.alpha_composite(chip_layer)

    for (emoji, label), (cx0, cy0) in zip(items, boxes):
        draw_emoji(img, emoji, (int(cx0 + chip_w / 2), int(cy0 + 64)), size=68)

        draw = ImageDraw.Draw(img)
        lines = wrap_text(label, font_label, draw, chip_w - 36)
        ly = cy0 + 118
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font_label)
            lw = bbox[2] - bbox[0]
            draw.text((cx0 + chip_w / 2 - lw / 2, ly), line, font=font_label, fill=WHITE)
            ly += 34
    return top_y + rows * chip_h + (rows - 1) * gap_y


def draw_pill_row(img, labels, y, font_size=28):
    """A row of small translucent search-tag pills - used in the opening
    hook to suggest endless scrolling through tutorials, without needing
    real browser footage."""
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_SANS, font_size)
    pad_x, pad_y, gap = 30, 16, 18
    widths = []
    for label in labels:
        bbox = draw.textbbox((0, 0), label, font=font)
        widths.append(bbox[2] - bbox[0] + pad_x * 2)
    total_w = sum(widths) + gap * (len(labels) - 1)
    x = (W - total_w) / 2

    # See draw_icon_grid: fill must be composited via a separate layer, or
    # a "translucent" pill just paints as solid opaque white.
    pill_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pill_draw = ImageDraw.Draw(pill_layer)
    positions = []
    for label, w in zip(labels, widths):
        pill_draw.rounded_rectangle([x, y, x + w, y + font_size + pad_y * 2], radius=999,
                                     fill=(255, 255, 255, 34), outline=BRAND_GOLD_BRIGHT, width=1)
        positions.append(x)
        x += w + gap
    img.alpha_composite(pill_layer)

    draw = ImageDraw.Draw(img)
    for label, w, x in zip(labels, widths, positions):
        draw.text((x + pad_x, y + pad_y - 2), label, font=font, fill=WHITE)


def draw_price_badges(img, labels, y, font_size=30):
    """Two stacked gold pill badges under a big price headline (ONE-TIME
    PAYMENT / LIFETIME ACCESS)."""
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_SANS_BOLD, font_size)
    pad_x, pad_y, gap = 34, 16, 46
    widths = []
    for label in labels:
        bbox = draw.textbbox((0, 0), label, font=font)
        widths.append(bbox[2] - bbox[0] + pad_x * 2)
    total_w = sum(widths) + gap * (len(labels) - 1)
    x = (W - total_w) / 2
    for label, w in zip(labels, widths):
        h = font_size + pad_y * 2
        draw.rounded_rectangle([x, y, x + w, y + h], radius=999, outline=BRAND_GOLD, width=2)
        draw.text((x + pad_x, y + pad_y - 2), label, font=font, fill=BRAND_GOLD_BRIGHT)
        x += w + gap


def draw_logo_mark(img, center, radius, ring_color=BRAND_GOLD, mark_color=WHITE):
    """Recreates the site's SVG monogram (ring + zigzag M/VA mark) in
    Pillow, for a proper branded logo moment on the closing scene."""
    draw = ImageDraw.Draw(img)
    cx, cy = center
    scale = radius / 40  # SVG ring radius is 40 in an 88x88 viewBox

    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=ring_color, width=max(2, int(3 * scale)))
    inner_r = 33 * scale
    inner = Image.new("RGBA", img.size, (0, 0, 0, 0))
    idraw = ImageDraw.Draw(inner)
    idraw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(*ring_color, 20))
    img.alpha_composite(inner) if img.mode == "RGBA" else img.paste(inner, (0, 0), inner)

    # Path: M28,60 L28,28 L44,52 L60,28 L60,60  (in the 88x88 viewBox, origin at 0,0)
    def pt(px, py):
        return (cx + (px - 44) * scale, cy + (py - 44) * scale)

    pts = [pt(28, 60), pt(28, 28), pt(44, 52), pt(60, 28), pt(60, 60)]
    draw = ImageDraw.Draw(img)
    draw.line(pts, fill=mark_color, width=max(3, int(4.5 * scale)), joint="curve")
    for p in pts:
        r = max(2, int(2.2 * scale))
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=mark_color)


def render_scene(scene, out_path):
    if scene.get("photo_split"):
        img = photo_background_split(
            scene["photo_split"],
            side=scene.get("photo_split_side", "left"),
            split_frac=scene.get("split_frac", 0.46),
            accent=scene.get("accent"),
            accent_center=scene.get("accent_center"),
            mirror_accent=scene.get("mirror_accent", False),
        )
    elif scene.get("photo"):
        img = photo_background(scene["photo"]).copy()
    else:
        img = base_background(
            glow_center=scene.get("glow_center"),
            accent=scene.get("accent"),
            accent_center=scene.get("accent_center"),
            mirror_accent=scene.get("mirror_accent", False),
        ).convert("RGBA")
    draw = ImageDraw.Draw(img)
    text_cx = scene.get("text_center_x", W / 2)

    if scene.get("logo_mark"):
        draw_logo_mark(img, (W // 2, scene.get("logo_y", 300)), scene.get("logo_r", 92))
        draw = ImageDraw.Draw(img)

    if scene.get("emoji"):
        draw_emoji(img, scene["emoji"], (W // 2, scene.get("emoji_y", 340)), size=scene.get("emoji_size", 220))
        draw = ImageDraw.Draw(img)

    if scene.get("kicker"):
        font_kicker = ImageFont.truetype(FONT_SANS_BOLD, 30)
        kicker = scene["kicker"].upper()
        bbox = draw.textbbox((0, 0), kicker, font=font_kicker)
        kx = text_cx - (bbox[2] - bbox[0]) / 2
        draw.text((kx, scene.get("kicker_y", 560)), kicker, font=font_kicker, fill=BRAND_GOLD_BRIGHT)

    font_head = ImageFont.truetype(FONT_SERIF_BOLD, scene.get("head_size", 74))
    max_w = scene.get("head_max_w", 1500)
    lines = wrap_text(scene["headline"], font_head, draw, max_w)
    line_h = scene.get("head_size", 74) + 14
    total_h = line_h * len(lines)
    y0 = scene.get("head_y", 640) - total_h / 2
    draw_centered_lines(draw, lines, font_head, y0, scene.get("head_color", WHITE), line_h, center_x=text_cx)

    if scene.get("subtext"):
        font_sub = ImageFont.truetype(FONT_SANS, scene.get("sub_size", 34))
        sub_lines = wrap_text(scene["subtext"], font_sub, draw, scene.get("sub_max_w", 1100))
        sy = scene.get("sub_y", y0 + total_h + 30)
        draw_centered_lines(draw, sub_lines, font_sub, sy, scene.get("sub_color", (214, 200, 190)), scene.get("sub_line_h", 46), center_x=text_cx)

    if scene.get("rule"):
        rw = 140
        ry = scene.get("rule_y", scene.get("head_y", 640) - total_h / 2 - 50)
        draw.rectangle([text_cx - rw / 2, ry, text_cx + rw / 2, ry + 3], fill=BRAND_GOLD)

    if scene.get("pill_row"):
        draw_pill_row(img, scene["pill_row"], scene.get("pill_y", 700))

    if scene.get("grid_items"):
        draw_icon_grid(
            img, scene["grid_items"], scene.get("grid_y", 640),
            cols=scene.get("grid_cols", 4),
            chip_w=scene.get("chip_w", 372),
            chip_h=scene.get("chip_h", 210),
        )

    if scene.get("price_badges"):
        draw_price_badges(img, scene["price_badges"], scene.get("badges_y", 760))

    if scene.get("insets"):
        for photo, box in scene["insets"]:
            paste_inset(img, photo, box)

    if scene.get("cta_box"):
        text = scene["cta_box"]
        font_cta = ImageFont.truetype(FONT_SANS_BOLD, 34)
        draw = ImageDraw.Draw(img)
        bbox = draw.textbbox((0, 0), text, font=font_cta)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad_x, pad_y = 56, 28
        bx0 = (W - tw) / 2 - pad_x
        by0 = scene.get("cta_y", 840)
        bx1 = (W + tw) / 2 + pad_x
        by1 = by0 + th + pad_y * 2
        draw.rounded_rectangle([bx0, by0, bx1, by1], radius=999, fill=BRAND_GOLD)
        draw.text(((W - tw) / 2, by0 + pad_y - 4), text, font=font_cta, fill=BRAND_WINE_DARK)

    img.convert("RGB").save(out_path, "PNG", quality=95)


P = str(TRAINER_DIR)

SCENES = [
    # Scene 1 - Hook: a beginner overwhelmed searching for how to start.
    # No real footage exists of a generic "confused beginner", so this is
    # told through motion graphics - a search icon and a scrolling row of
    # the exact searches a real beginner types - rather than faked stock
    # footage of an actor.
    dict(
        headline="Want to become a Virtual Assistant,\nbut don't know where to start?",
        emoji="🔍",
        emoji_y=260,
        head_y=560,
        head_size=58,
        head_max_w=1600,
        pill_row=["VA tutorials", "how to become a VA", "virtual assistant jobs", "freelancing tips"],
        pill_y=700,
        narration=(
            "Want to become a Virtual Assistant, but don't know where to start? "
            "You've watched tutorials, joined groups, and saved countless videos, "
            "but you're still asking: what do I actually need to learn?"
        ),
        glow_center=(W // 2, int(H * 0.32)),
    ),
    # Scene 2 - Introduce The VA Atelier.
    dict(
        kicker="Introducing The VA Atelier",
        headline="FROM ZERO\nTO JOB-READY",
        subtext="A beginner-friendly VA training program built to take you all the way there.",
        head_y=560,
        head_size=104,
        rule=True,
        kicker_y=430,
        sub_y=680,
        narration=(
            "That's why I created The VA Atelier: a beginner-friendly program "
            "that takes you from zero, to job-ready."
        ),
        glow_center=(W // 2, int(H * 0.45)),
        accent="rings",
        accent_center=(W // 2, int(H * 0.55)),
    ),
    # Scene 3 - What students learn (fast icon montage, not slow individual clips).
    dict(
        kicker="What You'll Learn",
        headline="Everything You Need\nto Get Job-Ready",
        head_y=310,
        head_size=58,
        kicker_y=210,
        grid_items=[
            ("📧", "Email & Calendar"),
            ("📱", "Social Media"),
            ("🎧", "Customer Support"),
            ("📊", "Data Entry & Research"),
            ("🧰", "Productivity Tools"),
            ("📄", "Resume & Portfolio"),
            ("✉️", "Proposals & Interviews"),
            ("🎯", "Your First Client"),
        ],
        grid_y=430,
        grid_cols=4,
        chip_w=372,
        chip_h=190,
        narration=(
            "You'll learn essential VA skills and tools, build your portfolio and resume, "
            "find real opportunities, and prepare for your first client."
        ),
        glow_center=(W // 2, int(H * 0.28)),
        accent="beam",
    ),
    # Scene 4 - VA Document Store.
    dict(
        kicker="VA Document Store",
        headline="Professional Documents,\nReady to Go",
        head_y=310,
        head_size=58,
        kicker_y=210,
        grid_items=[
            ("📄", "CV / Resume"),
            ("🗂️", "Portfolio"),
            ("✉️", "Cover Letter"),
            ("🧾", "Invoice"),
            ("🎬", "Intro Presentation"),
        ],
        grid_y=440,
        grid_cols=5,
        chip_w=336,
        chip_h=190,
        narration=(
            "Need professional documents without starting from scratch? "
            "Our VA Document Store gives you ready-to-use CVs, portfolios, cover letters, and more."
        ),
        glow_center=(W // 2, int(H * 0.28)),
        accent="beam",
        mirror_accent=True,
    ),
    # Scene 5 - Coach introduction, using Coach Reymar's real photos. Split-
    # screen layout: his photo is confined to the left column and every
    # piece of text lives in the right column, so text can never physically
    # overlap his face/name - not just careful positioning of small insets.
    dict(
        photo_split=f"{P}/coach-portrait-crossed-arms-1.jpg",
        photo_split_side="left",
        split_frac=0.46,
        text_center_x=1400,
        accent="rings",
        accent_center=(1400, 460),
        kicker="Your Coach",
        headline="I'm Reymar,\nYour VA Coach & Trainer",
        subtext="Making your journey into the VA industry simpler, clearer, and a lot less overwhelming.",
        head_y=460,
        head_size=56,
        head_max_w=780,
        kicker_y=250,
        sub_size=28,
        sub_max_w=780,
        sub_line_h=40,
        insets=[
            (f"{P}/coach-video-call-thumbsup.jpg", (40, 860, 350, 1030)),
            (f"{P}/coach-video-call-pointing.jpg", (375, 860, 670, 1030)),
        ],
        narration=(
            "I'm Reymar, your VA Coach and Trainer. I built The VA Atelier to make this journey "
            "simpler, clearer, and a lot less overwhelming."
        ),
    ),
    # Scene 6 - Offer / price.
    dict(
        kicker="The Offer",
        headline="₱499",
        head_y=470,
        head_size=190,
        head_max_w=1700,
        kicker_y=330,
        price_badges=["ONE-TIME PAYMENT", "LIFETIME ACCESS"],
        badges_y=650,
        narration=(
            "For only four hundred ninety-nine pesos, you get lifetime access. "
            "Stop wondering where to start. Start building your skills, your portfolio, "
            "and your first client."
        ),
        glow_center=(W // 2, int(H * 0.38)),
        accent="beam",
        mirror_accent=False,
    ),
    # Final scene - logo + tagline + CTA.
    dict(
        logo_mark=True,
        logo_y=290,
        logo_r=86,
        headline="THE VA ATELIER",
        subtext="From Zero to Your First Client.",
        cta_box="Enroll Now  —  ₱499",
        head_y=470,
        head_size=84,
        sub_y=560,
        cta_y=680,
        narration="The VA Atelier. From zero, to your first client. Enroll now.",
        glow_center=(W // 2, int(H * 0.32)),
    ),
]


def build_scene_clip(idx, scene, tmp_dir):
    png_path = tmp_dir / f"scene_{idx:02d}.png"
    wav_path = tmp_dir / f"scene_{idx:02d}.wav"
    clip_path = tmp_dir / f"scene_{idx:02d}.mp4"

    render_scene(scene, png_path)
    synthesize_audio(scene["narration"], wav_path)

    narration_dur = get_duration(wav_path)
    pad = 0.9
    clip_dur = narration_dur + pad
    total_frames = int(clip_dur * FPS)

    # Slow Ken Burns zoom-in for a subtle cinematic motion instead of a static card.
    #
    # zoompan recomputes its crop position every output frame from whatever
    # resolution its input is at. Feeding it a source already at the exact
    # 1920x1080 output size (the old behavior) gives that per-frame crop math
    # only whole-pixel precision to round to - at a slow zoom like this one
    # that shows up as a visible shake/vibration rather than a smooth glide.
    # Upscaling well beyond the output size first (a standard fix for this
    # well-known ffmpeg zoompan quirk) gives it sub-pixel precision to round
    # from, so the motion comes out smooth.
    zoom_expr = f"min(zoom+0.0006,1.09)"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(png_path),
            "-i", str(wav_path),
            "-filter_complex",
            f"[0:v]scale={W*4}:{H*4}:flags=lanczos,zoompan=z='{zoom_expr}':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
            f"format=yuv420p[v];"
            f"[1:a]adelay=200|200,apad=pad_dur=0.6[a]",
            "-map", "[v]", "-map", "[a]",
            "-t", str(clip_dur),
            "-c:v", "libx264", "-preset", "medium", "-crf", "19",
            "-c:a", "aac", "-b:a", "192k",
            str(clip_path),
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    return clip_path, clip_dur


def concat_with_crossfade(clips_and_durs, out_path, xfade_dur=0.6):
    """Chains scene clips together with a smooth crossfade (xfade) between
    each, instead of a hard cut, for a more cinematic feel."""
    n = len(clips_and_durs)
    inputs = []
    for clip, _ in clips_and_durs:
        inputs += ["-i", str(clip)]

    filter_parts = []
    v_prev = "0:v"
    a_prev = "0:a"
    running_offset = clips_and_durs[0][1] - xfade_dur
    for i in range(1, n):
        v_cur = f"{i}:v"
        a_cur = f"{i}:a"
        v_out = f"v{i}"
        a_out = f"a{i}"
        filter_parts.append(
            f"[{v_prev}][{v_cur}]xfade=transition=fadeblack:duration={xfade_dur}:offset={running_offset:.3f}[{v_out}]"
        )
        filter_parts.append(
            f"[{a_prev}][{a_cur}]acrossfade=d={xfade_dur}[{a_out}]"
        )
        v_prev, a_prev = v_out, a_out
        running_offset += clips_and_durs[i][1] - xfade_dur

    filter_complex = ";".join(filter_parts)
    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", filter_complex,
        "-map", f"[{v_prev}]", "-map", f"[{a_prev}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def add_music_bed(video_in, out_path, total_dur):
    """Synthesizes a soft ambient pad (a few detuned sine tones - no external
    royalty-free music file needed) and mixes it quietly under the narration."""
    freqs = [110, 164.81, 220, 277.18]  # A2, E3, A3, C#4 - a warm, simple A major pad
    sine_inputs = []
    filter_parts = []
    for i, f in enumerate(freqs):
        sine_inputs += ["-f", "lavfi", "-i", f"sine=frequency={f}:duration={total_dur}"]
        filter_parts.append(f"[{i+1}:a]volume=0.05[s{i}]")
    mix_labels = "".join(f"[s{i}]" for i in range(len(freqs)))
    filter_parts.append(f"{mix_labels}amix=inputs={len(freqs)}:duration=longest[padmix]")
    filter_parts.append(
        f"[padmix]afade=t=in:st=0:d=2,afade=t=out:st={max(total_dur-2.5,0):.2f}:d=2.5[music]"
    )
    filter_parts.append("[0:a][music]amix=inputs=2:duration=first:weights=1 0.9[aout]")

    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_in),
        *sine_inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def main():
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    clips_and_durs = []
    for i, scene in enumerate(SCENES):
        print(f"[{i+1}/{len(SCENES)}] Rendering scene: {scene['headline'][:40]!r}")
        clip, dur = build_scene_clip(i, scene, TMP_DIR)
        clips_and_durs.append((clip, dur))

    print("Stitching scenes with crossfades...")
    stitched = TMP_DIR / "stitched.mp4"
    concat_with_crossfade(clips_and_durs, stitched)

    total_dur = get_duration(stitched)
    print(f"Adding ambient music bed... (total duration {total_dur:.1f}s)")
    final_out = PUBLIC_DIR / "trailer.mp4"
    add_music_bed(stitched, final_out, total_dur)

    print(f"Done -> {final_out.relative_to(ROOT)} ({get_duration(final_out):.1f}s)")


if __name__ == "__main__":
    main()
