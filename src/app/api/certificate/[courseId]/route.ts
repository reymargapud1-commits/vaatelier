import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, certificates, courses } from "@/db/schema";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

export async function GET(req: Request, { params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return new NextResponse("Payment required", { status: 402 });
  }

  const [certificate] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, params.courseId)))
    .limit(1);
  if (!certificate) {
    return new NextResponse(
      "Certificate not yet earned. Complete all lessons, pass every module quiz, and book your live training session first.",
      { status: 403 }
    );
  }

  const [course] = await db.select().from(courses).where(eq(courses.id, params.courseId)).limit(1);
  if (!course) return new NextResponse("Course not found", { status: 404 });

  const coachName = course.coachName || process.env.COACH_NAME || "Reymar Gapud";
  const coachTitle = course.coachTitle || process.env.COACH_TITLE || "VA Coach & Trainer";

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const loraBytes = fs.readFileSync(path.join(FONTS_DIR, "Lora-Variable.ttf"));
  const loraItalicBytes = fs.readFileSync(path.join(FONTS_DIR, "Lora-Italic-Variable.ttf"));
  const serif = await pdfDoc.embedFont(loraBytes);
  const serifItalic = await pdfDoc.embedFont(loraItalicBytes);
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.09, 0.13, 0.24);
  const gold = rgb(0.72, 0.56, 0.15);
  const goldLight = rgb(0.93, 0.85, 0.62);
  const gray = rgb(0.42, 0.45, 0.5);
  const cream = rgb(0.99, 0.98, 0.95);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: cream });

  // Outer navy border + inner gold border, with a bit of breathing room
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: navy,
    borderWidth: 6,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: gold,
    borderWidth: 1.5,
  });

  // Corner flourishes (simple concentric quarter-circle accents)
  const corners: [number, number, number, number][] = [
    [34, 34, 1, 1],
    [width - 34, 34, -1, 1],
    [34, height - 34, 1, -1],
    [width - 34, height - 34, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    page.drawLine({
      start: { x: cx, y: cy + dy * 34 },
      end: { x: cx + dx * 34, y: cy },
      thickness: 1,
      color: gold,
    });
    page.drawCircle({ x: cx + dx * 6, y: cy + dy * 6, size: 2.2, color: gold });
  }

  const centerText = (text: string, y: number, font = sans, size = 16, color = navy) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  // Small eyebrow brand
  centerText("VA FOUNDATIONS TRAINING PROGRAM", height - 88, sansBold, 12, gold);

  // Decorative rule under eyebrow
  page.drawLine({
    start: { x: width / 2 - 70, y: height - 98 },
    end: { x: width / 2 + 70, y: height - 98 },
    thickness: 1,
    color: goldLight,
  });

  centerText("Certificate of Completion", height - 145, serif, 34, navy);

  centerText("This certificate is proudly presented to".toUpperCase(), height - 205, sansBold, 11, gray);

  // Student name - the hero element
  centerText(user.name, height - 255, serif, 36, navy);
  page.drawLine({
    start: { x: width / 2 - 160, y: height - 268 },
    end: { x: width / 2 + 160, y: height - 268 },
    thickness: 0.75,
    color: goldLight,
  });

  centerText(
    "for successfully completing every module, video lesson, and quiz of",
    height - 305,
    sans,
    12.5,
    gray
  );
  centerText(course.title, height - 330, sansBold, 17, navy);

  const issuedDate = certificate.issuedAt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  centerText(`Awarded on ${issuedDate}`, height - 358, sans, 11.5, gray);

  // Seal (drawn, not an image): concentric circles + a simple ribbon
  const sealX = width - 150;
  const sealY = 130;
  page.drawCircle({ x: sealX, y: sealY, size: 42, color: gold });
  page.drawCircle({ x: sealX, y: sealY, size: 34, color: navy });
  page.drawCircle({ x: sealX, y: sealY, size: 28, borderColor: goldLight, borderWidth: 1 });
  const sealFont = sansBold;
  const sealText = "VA";
  const sealTextWidth = sealFont.widthOfTextAtSize(sealText, 20);
  page.drawText(sealText, {
    x: sealX - sealTextWidth / 2,
    y: sealY - 8,
    size: 20,
    font: sealFont,
    color: goldLight,
  });
  // Ribbon tails
  page.drawLine({ start: { x: sealX - 16, y: sealY - 38 }, end: { x: sealX - 26, y: sealY - 74 }, thickness: 14, color: gold });
  page.drawLine({ start: { x: sealX + 16, y: sealY - 38 }, end: { x: sealX + 26, y: sealY - 74 }, thickness: 14, color: navy });

  // Signature block (left side, near bottom)
  const sigX = 130;
  const sigBaseY = 150;
  page.drawText(coachName, {
    x: sigX,
    y: sigBaseY,
    size: 26,
    font: serifItalic,
    color: navy,
  });
  page.drawLine({
    start: { x: sigX - 10, y: sigBaseY - 10 },
    end: { x: sigX + 230, y: sigBaseY - 10 },
    thickness: 1,
    color: gray,
  });
  page.drawText(coachName, { x: sigX, y: sigBaseY - 28, size: 11, font: sansBold, color: navy });
  page.drawText(coachTitle, { x: sigX, y: sigBaseY - 43, size: 10, font: sans, color: gray });

  centerText(`Certificate ID: ${certificate.id}`, 40, sans, 8, gray);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="VA-Foundations-Certificate-${user.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
