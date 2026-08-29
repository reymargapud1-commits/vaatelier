import path from "path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

// Fonts only need to be registered with the canvas engine once per process
// (Railway keeps the server process warm between requests) - a module-level
// flag avoids re-registering on every single banner generated.
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Lora-Variable.ttf"), "Lora");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Lora-Italic-Variable.ttf"), "Lora Italic");
  fontsRegistered = true;
}

const SIZE = 1080;
const WINE = "#2b1620";
const WINE_DARK = "#12090d";
const GOLD = "#c7a464";
const GOLD_BRIGHT = "#e2c38a";
const CREAM = "#faf6f1";

/**
 * Same brand palette/gradient/corner-ring treatment used by the trailer and
 * poster generator scripts elsewhere in this project - kept consistent so
 * every generated graphic (video poster, certificate, this banner) reads as
 * the same brand.
 */
function drawBackground(ctx: any) {
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, WINE);
  grad.addColorStop(1, WINE_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.strokeStyle = "rgba(199,164,100,0.25)";
  ctx.lineWidth = 1.5;
  for (const [cx, cy] of [
    [0, 0],
    [SIZE, SIZE],
  ]) {
    for (const r of [60, 100, 140]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawKicker(ctx: any, y: number) {
  ctx.fillStyle = GOLD;
  ctx.font = "600 22px Lora";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("THE VA ATELIER".split("").join(" "), SIZE / 2, y);
}

function drawFooter(ctx: any) {
  ctx.strokeStyle = "rgba(199,164,100,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - 100, SIZE - 110);
  ctx.lineTo(SIZE / 2 + 100, SIZE - 110);
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = "700 22px Lora";
  ctx.textAlign = "center";
  ctx.fillText("thevaatelier.online", SIZE / 2, SIZE - 78);
}

async function drawCircularPhoto(ctx: any, photo: any, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Cover-fit: scale so the shorter dimension fills the circle's bounding
  // box, then center-crop, so an arbitrary uploaded photo (portrait or
  // landscape) always fills the circle with no letterboxing.
  const scale = Math.max((radius * 2) / photo.width, (radius * 2) / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(250,246,241,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function wrapText(ctx: any, text: string, cx: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return lines.length;
}

/**
 * Shrinks the font size (same family/weight) until the given text fits
 * within maxWidth, so an unusually long student name never overflows or
 * gets clipped off the edge of the banner.
 */
function fitFontSize(ctx: any, text: string, weight: string, maxSize: number, minSize: number, maxWidth: number) {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Lora`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export interface WelcomeBannerOptions {
  studentName: string;
  courseTitle: string;
  photoBuffer?: Buffer | null;
}

/**
 * Renders a 1080x1080 Facebook-postable "Welcome to the family" banner for a
 * newly-enrolled student - with or without an optional photo (circular
 * crop, gold-ring border). Pure image generation, no DB/session access -
 * callers (the admin API route) are responsible for auth and fetching the
 * student/course data.
 */
export async function renderWelcomeBanner(opts: WelcomeBannerOptions): Promise<Buffer> {
  ensureFontsRegistered();

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx);
  ctx.textAlign = "center";

  const photo = opts.photoBuffer ? await loadImage(opts.photoBuffer) : null;
  const nameMaxWidth = SIZE - 240;

  if (photo) {
    drawKicker(ctx, 100);
    await drawCircularPhoto(ctx, photo, SIZE / 2, 350, 160);

    ctx.fillStyle = CREAM;
    ctx.font = "400 34px Lora";
    ctx.fillText("Welcome to the family,", SIZE / 2, 580);

    ctx.fillStyle = GOLD_BRIGHT;
    const nameSize = fitFontSize(ctx, opts.studentName, "700", 68, 34, nameMaxWidth);
    ctx.font = `700 ${nameSize}px Lora`;
    ctx.fillText(opts.studentName, SIZE / 2, 660);

    ctx.fillStyle = CREAM;
    ctx.font = "400 27px Lora";
    wrapText(ctx, `is officially enrolled in ${opts.courseTitle}!`, SIZE / 2, 720, 760, 40);
  } else {
    drawKicker(ctx, 140);

    ctx.fillStyle = CREAM;
    ctx.font = "400 38px Lora";
    ctx.fillText("Welcome to the family,", SIZE / 2, 500);

    ctx.fillStyle = GOLD_BRIGHT;
    const nameSize = fitFontSize(ctx, opts.studentName, "700", 76, 38, nameMaxWidth);
    ctx.font = `700 ${nameSize}px Lora`;
    ctx.fillText(opts.studentName, SIZE / 2, 590);

    ctx.fillStyle = CREAM;
    ctx.font = "400 29px Lora";
    wrapText(ctx, `is officially enrolled in ${opts.courseTitle}!`, SIZE / 2, 660, 780, 42);
  }

  drawFooter(ctx);

  return canvas.encode("png");
}
