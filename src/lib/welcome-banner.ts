import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

// Reuses the same brand palette as the certificate PDF (lib absent here -
// see api/certificate/[courseId]/[track]/route.ts) so every generated
// document looks like it came from the same place.
const WINE = "#2b1620";
const GOLD = "#c7a464";
const GOLD_LIGHT = "#e9d3a3";
const CREAM = "#faf6f1";
const GRAY = "#6b6166";

const WIDTH = 1200;
const HEIGHT = 630; // Facebook-friendly link/share image size

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsRegistered = false;

function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const loraPath = path.join(FONTS_DIR, "Lora-Variable.ttf");
  const loraItalicPath = path.join(FONTS_DIR, "Lora-Italic-Variable.ttf");
  try {
    if (fs.existsSync(loraPath)) GlobalFonts.registerFromPath(loraPath, "Lora");
    if (fs.existsSync(loraItalicPath)) GlobalFonts.registerFromPath(loraItalicPath, "Lora Italic");
  } catch (err) {
    console.error("[welcome-banner] Failed to register custom fonts, falling back to system fonts:", err);
  }
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a Facebook-postable "Welcome to the family" graphic for a newly
 * enrolled student - wine/gold brand background, their name as the hero
 * element, and (if a photo was supplied) a circular photo with a gold ring
 * border. Pure in-memory rendering, nothing is read from or written to the
 * database - see api/admin/welcome-banner/route.ts.
 */
export async function renderWelcomeBanner(params: {
  studentName: string;
  courseTitle: string;
  photoBuffer?: Buffer | null;
}): Promise<Buffer> {
  ensureFonts();
  const { studentName, courseTitle, photoBuffer } = params;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGradient.addColorStop(0, WINE);
  bgGradient.addColorStop(1, "#3d2130");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Outer gold border, inset
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 18);
  ctx.stroke();

  const hasPhoto = !!(photoBuffer && photoBuffer.length > 0);

  // Eyebrow brand
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("THE VA ATELIER", WIDTH / 2, 90);

  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 90, 108);
  ctx.lineTo(WIDTH / 2 + 90, 108);
  ctx.stroke();

  let photoCenterY = 220;
  const photoRadius = 92;

  if (hasPhoto) {
    try {
      const image = await loadImage(photoBuffer as Buffer);
      const size = photoRadius * 2;
      const cx = WIDTH / 2;
      const cy = photoCenterY;

      // Gold ring
      ctx.beginPath();
      ctx.arc(cx, cy, photoRadius + 8, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();

      // Circular-cropped photo
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, photoRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const srcSize = Math.min(image.width, image.height);
      const srcX = (image.width - srcSize) / 2;
      const srcY = (image.height - srcSize) / 2;
      ctx.drawImage(image, srcX, srcY, srcSize, srcSize, cx - photoRadius, cy - photoRadius, size, size);
      ctx.restore();
    } catch (err) {
      console.error("[welcome-banner] Failed to load student photo, continuing without it:", err);
    }
  } else {
    photoCenterY = 150;
  }

  const congratsY = hasPhoto ? 350 : 220;
  ctx.fillStyle = GRAY;
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("WELCOME TO THE FAMILY", WIDTH / 2, congratsY);

  // Student name - the hero element
  ctx.fillStyle = CREAM;
  ctx.font = `bold 56px ${GlobalFonts.has("Lora") ? "Lora" : "serif"}`;
  let displayName = studentName;
  const maxNameWidth = WIDTH - 160;
  while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== studentName) displayName = displayName.trimEnd() + "…";
  ctx.fillText(displayName, WIDTH / 2, congratsY + 70);

  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 140, congratsY + 92);
  ctx.lineTo(WIDTH / 2 + 140, congratsY + 92);
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = "22px sans-serif";
  const article = /^[aeiou]/i.test(courseTitle) ? "an" : "a";
  const courseLine = `is now training as ${article} ${courseTitle}`;
  ctx.fillText(courseLine, WIDTH / 2, congratsY + 130);

  ctx.fillStyle = GRAY;
  ctx.font = "16px sans-serif";
  ctx.fillText("thevaatelier.com", WIDTH / 2, HEIGHT - 48);

  return canvas.toBuffer("image/png");
}
