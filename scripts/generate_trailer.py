#!/usr/bin/env python3
"""
Generates the cinematic homepage trailer for The VA Atelier.

This is a short (~50-60s) motion-graphics style trailer - animated title
cards with slow Ken Burns zoom, color-emoji icons, narrated with Piper
(the same offline neural TTS used for the lesson videos), under a soft
synthesized ambient music bed (a few sine-wave pads mixed together - no
external royalty-free-music download needed, so there are zero licensing
questions).

There is no real video footage of an actual VA's life available to this
project, so rather than fake it with generic stock photography, this
trailer leans fully into a clean, branded, text-and-icon motion-graphics
style - the same honest choice the course's slide videos make.

Output: public/trailer.mp4 (served directly, unlike lesson videos - the
trailer is marketing, so it must NOT be paywalled, and belongs in /public
rather than media/videos).

Usage:
    VA_TTS_MODEL=/path/to/voice.onnx python3 scripts/generate_trailer.py
"""

import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from piper import PiperVoice
import wave

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
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


def base_background(vignette_strength=170, glow_center=None):
    """Dark wine-to-black cinematic gradient background with a soft gold
    glow and vignette, matching the course's wine/gold brand palette."""
    # Build the gradient on a 1px-wide column, then stretch it to full width -
    # much faster than a per-pixel loop across a 1920px-wide image.
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

    # Vignette
    vignette = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([-W * 0.3, -H * 0.3, W * 1.3, H * 1.3], fill=255)
    vignette = vignette.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(120))
    dark_layer = Image.new("RGBA", (W, H), (0, 0, 0, vignette_strength))
    inv = Image.eval(vignette, lambda a: 255 - a)
    dark_layer.putalpha(inv.point(lambda a: int(a * (vignette_strength / 255))))
    img = Image.alpha_composite(img, dark_layer)
    return img.convert("RGB")


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


def draw_centered_lines(draw, lines, font, y, fill, line_height, align_center=True):
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        x = (W - lw) / 2 if align_center else 96
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def render_scene(scene, out_path):
    img = base_background(glow_center=scene.get("glow_center")).convert("RGBA")
    draw = ImageDraw.Draw(img)

    if scene.get("emoji"):
        draw_emoji(img, scene["emoji"], (W // 2, scene.get("emoji_y", 340)), size=scene.get("emoji_size", 220))
        draw = ImageDraw.Draw(img)

    if scene.get("kicker"):
        font_kicker = ImageFont.truetype(FONT_SANS_BOLD, 30)
        kicker = scene["kicker"].upper()
        bbox = draw.textbbox((0, 0), kicker, font=font_kicker)
        kx = (W - (bbox[2] - bbox[0])) / 2
        draw.text((kx, scene.get("kicker_y", 560)), kicker, font=font_kicker, fill=BRAND_GOLD_BRIGHT)

    font_head = ImageFont.truetype(FONT_SERIF_BOLD, scene.get("head_size", 74))
    max_w = scene.get("head_max_w", 1500)
    lines = wrap_text(scene["headline"], font_head, draw, max_w)
    line_h = scene.get("head_size", 74) + 14
    total_h = line_h * len(lines)
    y0 = scene.get("head_y", 640) - total_h / 2
    draw_centered_lines(draw, lines, font_head, y0, WHITE, line_h)

    if scene.get("subtext"):
        font_sub = ImageFont.truetype(FONT_SANS, 34)
        sub_lines = wrap_text(scene["subtext"], font_sub, draw, 1100)
        sy = scene.get("sub_y", y0 + total_h + 30)
        draw_centered_lines(draw, sub_lines, font_sub, sy, (214, 200, 190), 46)

    if scene.get("rule"):
        rw = 140
        ry = scene.get("rule_y", scene.get("head_y", 640) - total_h / 2 - 50)
        draw.rectangle([(W - rw) / 2, ry, (W + rw) / 2, ry + 3], fill=BRAND_GOLD)

    if scene.get("cta_box"):
        text = scene["cta_box"]
        font_cta = ImageFont.truetype(FONT_SANS_BOLD, 34)
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


SCENES = [
    dict(
        headline="What if your office\ncould be anywhere in the world?",
        emoji="🌍",
        emoji_y=300,
        head_y=660,
        head_size=64,
        narration="What if your office could be anywhere in the world?",
        glow_center=(W // 2, int(H * 0.3)),
    ),
    dict(
        headline="Your kitchen table.\nA coffee shop. Your hometown.",
        emoji="🏡",
        emoji_y=300,
        head_y=660,
        head_size=64,
        narration="Your kitchen table. A coffee shop. Your hometown.",
    ),
    dict(
        headline="Earning in dollars.\nWorking with clients across the globe.",
        emoji="💵",
        emoji_y=300,
        head_y=660,
        head_size=60,
        narration="Earning in dollars, working with clients across the globe.",
    ),
    dict(
        headline="No traffic. No boss\nbreathing down your neck.",
        subtext="Just you, your laptop, and a schedule you control.",
        emoji="⏰",
        emoji_y=300,
        head_y=630,
        head_size=62,
        narration="No traffic, and no boss breathing down your neck. Just you, your laptop, and a schedule you control.",
    ),
    dict(
        headline="This is the life\nof a Virtual Assistant.",
        emoji="💻",
        emoji_y=300,
        head_y=660,
        head_size=68,
        narration="This is the life of a Virtual Assistant.",
    ),
    dict(
        headline="Thousands of Filipinos\nare already living it.",
        subtext="And it started with one decision.",
        emoji="🇵🇭",
        emoji_y=290,
        head_y=630,
        head_size=64,
        narration="Thousands of Filipinos are already living it. And it started with one decision.",
    ),
    dict(
        kicker="Introducing",
        headline="The VA Atelier",
        subtext="From zero experience to your first paying client.",
        head_y=560,
        head_size=110,
        rule=True,
        kicker_y=440,
        sub_y=650,
        narration="Introducing The VA Atelier: from zero experience, to your first paying client.",
        glow_center=(W // 2, int(H * 0.45)),
    ),
    dict(
        headline="Your new career\nstarts today.",
        cta_box="Enroll Now  →",
        head_y=470,
        head_size=76,
        cta_y=700,
        narration="Your new career starts today. Enroll now in The VA Atelier.",
        glow_center=(W // 2, int(H * 0.4)),
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
    zoom_expr = f"min(zoom+0.0006,1.09)"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(png_path),
            "-i", str(wav_path),
            "-filter_complex",
            f"[0:v]scale={W}:{H},zoompan=z='{zoom_expr}':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
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
