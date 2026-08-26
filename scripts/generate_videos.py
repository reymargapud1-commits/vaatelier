#!/usr/bin/env python3
"""
Generates narrated slide-video lessons for the VA Training Portal.

For every lesson in content/curriculum.json, this script:
  1. Renders each slide (heading + bullets) as a branded 1280x720 PNG.
  2. Synthesizes narration audio for each slide with espeak-ng (offline TTS).
  3. Builds a per-slide MP4 (still image + narration audio) with ffmpeg.
  4. Concatenates all slide clips into one final lesson video.

Output: media/videos/<lessonId>.mp4  (one file per lesson)

Note on voice quality: this environment has no network access to
commercial/neural TTS services (Google TTS, ElevenLabs, etc.), so narration
uses espeak-ng, a lightweight offline synthesizer. It is clear and fully
functional for training purposes, but sounds robotic/computerized rather
than human. Swap in a real voiceover (or a paid TTS API) later by dropping
replacement audio files into media/audio/<lessonId>/<slideIndex>.wav and
re-running only the ffmpeg assembly step.
"""

import json
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
MEDIA_DIR = ROOT / "media"
VIDEO_DIR = MEDIA_DIR / "videos"
AUDIO_DIR = MEDIA_DIR / "audio"
SLIDE_DIR = MEDIA_DIR / "slides"

WIDTH, HEIGHT = 1280, 720
BRAND_BLUE = (26, 109, 245)
BRAND_DARK = (17, 24, 39)
BG_WHITE = (255, 255, 255)
LIGHT_GRAY = (243, 246, 251)
TEXT_GRAY = (55, 65, 81)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
FONT_BOLD = f"{FONT_DIR}/DejaVuSans-Bold.ttf"
FONT_REGULAR = f"{FONT_DIR}/DejaVuSans.ttf"

VOICE = os.environ.get("VA_TTS_VOICE", "en+f3")
SPEED = os.environ.get("VA_TTS_SPEED", "165")


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
    draw.rectangle([0, 0, WIDTH, 96], fill=BRAND_BLUE)
    font_brand = ImageFont.truetype(FONT_BOLD, 30)
    font_small = ImageFont.truetype(FONT_REGULAR, 20)
    draw.text((48, 22), "VA Foundations", font=font_brand, fill=BG_WHITE)
    progress_text = f"{module_title}  ·  Slide {slide_index + 1}/{total_slides}"
    draw.text((48, 62), progress_text, font=font_small, fill=(219, 234, 254))

    # Lesson title band
    font_lesson = ImageFont.truetype(FONT_REGULAR, 22)
    draw.rectangle([0, 96, WIDTH, 142], fill=LIGHT_GRAY)
    draw.text((48, 108), lesson_title, font=font_lesson, fill=TEXT_GRAY)

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
        draw.ellipse([bx - 24, y + 12, bx - 12, y + 24], fill=BRAND_BLUE)
        lines = wrap_text(bullet, font_bullet, draw, WIDTH - bx - 96)
        for i, line in enumerate(lines):
            draw.text((bx, y + i * 40), line, font=font_bullet, fill=TEXT_GRAY)
        y += 40 * len(lines) + 22

    # Footer
    font_footer = ImageFont.truetype(FONT_REGULAR, 18)
    draw.rectangle([0, HEIGHT - 44, WIDTH, HEIGHT], fill=BRAND_DARK)
    draw.text((48, HEIGHT - 34), course_title, font=font_footer, fill=(156, 175, 219))

    img.save(out_path, "PNG")


def synthesize_audio(text, out_wav):
    subprocess.run(
        [
            "espeak-ng",
            "-v", VOICE,
            "-s", SPEED,
            "-p", "45",
            "-g", "6",
            "-w", str(out_wav),
            text,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


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
