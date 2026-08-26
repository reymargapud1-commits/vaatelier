#!/usr/bin/env python3
"""
Generates narrated slide-video lessons for the VA Training Portal.

For every lesson in content/curriculum.json, this script:
  1. Renders each slide (heading + bullets) as a branded 1280x720 PNG.
  2. Synthesizes narration audio for each slide with Piper (offline neural TTS).
  3. Builds a per-slide MP4 (still image + narration audio) with ffmpeg.
  4. Concatenates all slide clips into one final lesson video.

Output: media/videos/<lessonId>.mp4  (one file per lesson)

Note on voice quality: narration uses Piper (https://github.com/OHF-voice/piper1-gpl),
a free offline neural text-to-speech engine - it sounds like a natural human voice,
not robotic, and needs no paid API or account. It does need a one-time voice model
download (see VA_TTS_MODEL below); after that, generation is fully offline.

To use a different voice, download another .onnx + .onnx.json model pair
(browse voices at https://github.com/rhasspy/piper/releases or
https://huggingface.co/rhasspy/piper-voices) and point VA_TTS_MODEL at it, e.g.:
    VA_TTS_MODEL=/path/to/en-us-ryan-high.onnx python3 scripts/generate_videos.py

You can also always replace individual lessons with your own recordings - see the
README's "About the video lessons" section.
"""

import json
import os
import shutil
import subprocess
import sys
import textwrap
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from piper import PiperVoice

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
MEDIA_DIR = ROOT / "media"
VIDEO_DIR = MEDIA_DIR / "videos"
AUDIO_DIR = MEDIA_DIR / "audio"
SLIDE_DIR = MEDIA_DIR / "slides"

WIDTH, HEIGHT = 1280, 720
BRAND_WINE = (43, 22, 32)
BRAND_GOLD = (199, 164, 100)
BRAND_DARK = (43, 22, 32)
BG_WHITE = (250, 246, 241)
LIGHT_GRAY = (245, 237, 228)
TEXT_GRAY = (91, 74, 82)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
FONT_BOLD = f"{FONT_DIR}/DejaVuSans-Bold.ttf"
FONT_REGULAR = f"{FONT_DIR}/DejaVuSans.ttf"

# Path to a Piper voice model (.onnx). Defaults to a natural-sounding US
# English voice downloaded into /tmp/piper-voice - see the module docstring
# above for how to point this at a different voice.
MODEL_PATH = os.environ.get("VA_TTS_MODEL", "/tmp/piper-voice/en-us-lessac-medium.onnx")

_voice = None


def get_voice():
    global _voice
    if _voice is None:
        if not Path(MODEL_PATH).exists():
            raise SystemExit(
                f"Piper voice model not found at {MODEL_PATH}.\n"
                "Download one (see the module docstring) or set VA_TTS_MODEL "
                "to point at an existing .onnx voice file."
            )
        _voice = PiperVoice.load(MODEL_PATH)
    return _voice


def load_curriculum():
    with open(CONTENT_DIR / "curriculum.json") as f:
        return json.load(f)


def wrap_text(text, font, draw, max_width):
    words = text.split()
    lines, current = [], ""
    for w in words:
        trial = (current + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def render_slide(course_title, module_title, lesson_title, slide, slide_index, total_slides, out_path):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_WHITE)
    draw = ImageDraw.Draw(img)

    # Top brand bar
    draw.rectangle([0, 0, WIDTH, 96], fill=BRAND_WINE)
    font_brand = ImageFont.truetype(FONT_BOLD, 30)
    font_small = ImageFont.truetype(FONT_REGULAR, 20)
    draw.text((48, 20), "The VA Atelier", font=font_brand, fill=BRAND_GOLD)
    progress_text = f"{module_title}  ·  Slide {slide_index + 1}/{total_slides}"
    draw.text((48, 62), progress_text, font=font_small, fill=(224, 205, 178))

    # Lesson title band
    font_lesson = ImageFont.truetype(FONT_REGULAR, 22)
    draw.rectangle([0, 96, WIDTH, 142], fill=LIGHT_GRAY)
    draw.text((48, 108), lesson_title, font=font_lesson, fill=TEXT_GRAY)

    # Footer (drawn first so the image-frame layout below can safely go right up to it)
    font_footer = ImageFont.truetype(FONT_REGULAR, 18)
    draw.rectangle([0, HEIGHT - 44, WIDTH, HEIGHT], fill=BRAND_DARK)
    draw.text((48, HEIGHT - 34), course_title, font=font_footer, fill=(196, 170, 138))

    if slide.get("image"):
        render_figure_slide(img, draw, slide)
    else:
        render_bullet_slide(img, draw, slide)

    img.save(out_path, "PNG")


def render_bullet_slide(img, draw, slide):
    # Heading
    font_heading = ImageFont.truetype(FONT_BOLD, 46)
    heading_lines = wrap_text(slide["heading"], font_heading, draw, WIDTH - 96)
    y = 190
    for line in heading_lines:
        draw.text((48, y), line, font=font_heading, fill=BRAND_DARK)
        y += 58

    # Bullets
    font_bullet = ImageFont.truetype(FONT_REGULAR, 30)
    y += 30
    bx = 72
    for bullet in slide.get("bullets", []):
        # bullet dot
        draw.ellipse([bx - 24, y + 12, bx - 12, y + 24], fill=BRAND_GOLD)
        lines = wrap_text(bullet, font_bullet, draw, WIDTH - bx - 96)
        for i, line in enumerate(lines):
            draw.text((bx, y + i * 40), line, font=font_bullet, fill=TEXT_GRAY)
        y += 40 * len(lines) + 22


def render_figure_slide(img, draw, slide):
    """Renders a slide that shows a real screenshot ('figure') instead of bullets,
    e.g. an actual Upwork sign-up screen or Google Calendar view. `slide["image"]`
    is a path relative to the project root (see ROOT below); `slide.get("caption")`
    is an optional one-line label drawn under the screenshot."""
    # Smaller heading so there's more room for the screenshot itself.
    font_heading = ImageFont.truetype(FONT_BOLD, 36)
    heading_lines = wrap_text(slide["heading"], font_heading, draw, WIDTH - 96)
    y = 168
    for line in heading_lines:
        draw.text((48, y), line, font=font_heading, fill=BRAND_DARK)
        y += 44

    content_top = y + 16
    caption = slide.get("caption", "")
    caption_h = 36 if caption else 0
    content_bottom = HEIGHT - 44 - 16 - caption_h
    box_left, box_right = 64, WIDTH - 64
    box_w = box_right - box_left
    box_h = content_bottom - content_top

    image_path = ROOT / slide["image"]
    if not image_path.exists():
        # Fail loudly at build time rather than silently shipping a blank slide -
        # much easier to catch a typo'd path here than by watching every video.
        raise FileNotFoundError(f"Figure image not found: {image_path}")

    fig = Image.open(image_path).convert("RGBA")
    scale = min(box_w / fig.width, box_h / fig.height)
    new_w, new_h = int(fig.width * scale), int(fig.height * scale)
    fig = fig.resize((new_w, new_h), Image.LANCZOS)

    fx = box_left + (box_w - new_w) // 2
    fy = content_top + (box_h - new_h) // 2

    # A simple browser-window style frame behind the screenshot so it reads as
    # "a real screenshot" rather than a floating image.
    frame_pad = 10
    draw.rectangle(
        [fx - frame_pad, fy - frame_pad, fx + new_w + frame_pad, fy + new_h + frame_pad],
        fill=(255, 255, 255),
        outline=BRAND_GOLD,
        width=3,
    )
    img.paste(fig, (fx, fy), fig)

    if caption:
        font_caption = ImageFont.truetype(FONT_REGULAR, 22)
        cap_w = draw.textlength(caption, font=font_caption)
        draw.text(
            ((WIDTH - cap_w) / 2, content_bottom + 8),
            caption,
            font=font_caption,
            fill=TEXT_GRAY,
        )


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


def build_slide_clip(image_path, audio_path, out_path, pad_seconds=0.6):
    duration = get_duration(audio_path) + pad_seconds
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(image_path),
            "-i", str(audio_path),
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            "-t", str(duration),
            "-vf", "fps=24,format=yuv420p",
            "-shortest",
            str(out_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def concat_clips(clip_paths, out_path, tmp_dir):
    list_file = tmp_dir / "concat_list.txt"
    with open(list_file, "w") as f:
        for p in clip_paths:
            f.write(f"file '{p.resolve()}'\n")
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(list_file),
            "-c", "copy",
            str(out_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def main():
    only_lesson = sys.argv[1] if len(sys.argv) > 1 else None

    for d in (VIDEO_DIR, AUDIO_DIR, SLIDE_DIR):
        d.mkdir(parents=True, exist_ok=True)

    curriculum = load_curriculum()
    course_title = curriculum["courseTitle"]

    total_lessons = sum(len(m["lessons"]) for m in curriculum["modules"])
    done = 0

    for module in curriculum["modules"]:
        for lesson in module["lessons"]:
            lesson_id = lesson["id"]
            if only_lesson and lesson_id != only_lesson:
                continue

            done += 1
            out_video = VIDEO_DIR / f"{lesson_id}.mp4"
            if out_video.exists():
                print(f"[{done}/{total_lessons}] SKIP (exists): {lesson_id} - {lesson['title']}")
                continue

            print(f"[{done}/{total_lessons}] Building: {lesson_id} - {lesson['title']}")

            lesson_slide_dir = SLIDE_DIR / lesson_id
            lesson_audio_dir = AUDIO_DIR / lesson_id
            lesson_slide_dir.mkdir(parents=True, exist_ok=True)
            lesson_audio_dir.mkdir(parents=True, exist_ok=True)

            slide_clips = []
            slides = lesson["slides"]
            for idx, slide in enumerate(slides):
                img_path = lesson_slide_dir / f"{idx:02d}.png"
                wav_path = lesson_audio_dir / f"{idx:02d}.wav"
                clip_path = lesson_slide_dir / f"{idx:02d}.mp4"

                render_slide(course_title, module["title"], lesson["title"], slide, idx, len(slides), img_path)
                synthesize_audio(slide["narration"], wav_path)
                build_slide_clip(img_path, wav_path, clip_path)
                slide_clips.append(clip_path)

            concat_clips(slide_clips, out_video, lesson_slide_dir)
            print(f"    -> {out_video.relative_to(ROOT)} ({get_duration(out_video):.1f}s)")

    print("Done.")


if __name__ == "__main__":
    main()
