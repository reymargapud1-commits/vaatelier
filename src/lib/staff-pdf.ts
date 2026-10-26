import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

const WINE = rgb(0.169, 0.086, 0.125);
const GOLD = rgb(0.78, 0.643, 0.392);
const GOLD_LIGHT = rgb(0.914, 0.827, 0.639);
const GRAY = rgb(0.42, 0.38, 0.4);
const CREAM = rgb(0.98, 0.965, 0.945);
const DARK = rgb(0.15, 0.13, 0.14);

async function embedBrandFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  const loraPath = path.join(FONTS_DIR, "Lora-Variable.ttf");
  const loraItalicPath = path.join(FONTS_DIR, "Lora-Italic-Variable.ttf");

  let serif: PDFFont, serifItalic: PDFFont;
  if (fs.existsSync(loraPath) && fs.existsSync(loraItalicPath)) {
    serif = await pdfDoc.embedFont(fs.readFileSync(loraPath));
    serifItalic = await pdfDoc.embedFont(fs.readFileSync(loraItalicPath));
  } else {
    // Same graceful fallback as the certificate PDF - a missing custom font
    // file should never 500 a document generation route.
    serif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    serifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  }
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { serif, serifItalic, sans, sansBold };
}

// pdf-lib's StandardFonts (Helvetica etc.) use WinAnsi encoding, which has
// no glyph for "₱" - drawing it throws "WinAnsi cannot encode...". Same
// workaround already used in lib/billing-pdf.ts: spell it out as "Php ".
function peso(centavos: number): string {
  return `Php ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawHeader(page: PDFPage, sansBold: PDFFont, title: string) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: CREAM });
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: GOLD,
    borderWidth: 1.5,
  });

  const eyebrow = "THE VA ATELIER";
  const eyebrowSize = 12;
  const eyebrowWidth = sansBold.widthOfTextAtSize(eyebrow, eyebrowSize);
  page.drawText(eyebrow, {
    x: (width - eyebrowWidth) / 2,
    y: height - 70,
    size: eyebrowSize,
    font: sansBold,
    color: GOLD,
  });

  const titleSize = 20;
  const titleWidth = sansBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 96,
    size: titleSize,
    font: sansBold,
    color: WINE,
  });

  page.drawLine({
    start: { x: width / 2 - 90, y: height - 108 },
    end: { x: width / 2 + 90, y: height - 108 },
    thickness: 1,
    color: GOLD_LIGHT,
  });
}

/**
 * Renders one staff member's payslip for one semi-monthly pay period as a
 * clean A4 document - days present x daily rate, the admin-typed cash
 * advance deduction (if any) for this run, and the resulting net pay. Every
 * value here is a frozen snapshot of the staffPayrollRuns row, never
 * recomputed, so a payslip never changes after it's generated.
 */
export async function generatePayslipPdf(params: {
  staffName: string;
  position: string;
  periodLabel: string;
  daysPresent: number;
  dailyRateCentavos: number;
  grossPayCentavos: number;
  cashAdvanceDeductionCentavos: number;
  deductionNote?: string | null;
  netPayCentavos: number;
  payrollId: string;
  generatedAt: Date;
  coachName: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const { serif, sans, sansBold } = await embedBrandFonts(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width } = page.getSize();

  drawHeader(page, sansBold, "PAYSLIP");

  let y = 700;
  const leftX = 70;
  const rightX = width - 70;

  page.drawText(params.staffName, { x: leftX, y, size: 20, font: serif, color: WINE });
  y -= 22;
  page.drawText(params.position, { x: leftX, y, size: 11, font: sans, color: GRAY });
  y -= 36;

  const labelValue = (label: string, value: string, atY: number) => {
    page.drawText(label.toUpperCase(), { x: leftX, y: atY, size: 9, font: sansBold, color: GOLD });
    const valueWidth = sansBold.widthOfTextAtSize(value, 11);
    page.drawText(value, { x: rightX - valueWidth, y: atY, size: 11, font: sansBold, color: DARK });
  };

  labelValue("Pay Period", params.periodLabel, y);
  y -= 20;
  labelValue(
    "Date Generated",
    params.generatedAt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
    y
  );
  y -= 36;

  page.drawLine({ start: { x: leftX, y }, end: { x: rightX, y }, thickness: 0.75, color: GOLD_LIGHT });
  y -= 30;

  const row = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: leftX, y, size: 11.5, font: sans, color: DARK });
    const valueWidth = (bold ? sansBold : sans).widthOfTextAtSize(value, 11.5);
    page.drawText(value, { x: rightX - valueWidth, y, size: 11.5, font: bold ? sansBold : sans, color: DARK });
    y -= 24;
  };

  row("Days Present", String(params.daysPresent));
  row("Daily Rate", peso(params.dailyRateCentavos));
  row("Gross Pay", peso(params.grossPayCentavos), true);

  if (params.cashAdvanceDeductionCentavos > 0) {
    y -= 6;
    row("Cash Advance Deduction", `- ${peso(params.cashAdvanceDeductionCentavos)}`);
    if (params.deductionNote) {
      page.drawText(params.deductionNote, { x: leftX + 14, y: y + 10, size: 9, font: sans, color: GRAY });
      y -= 16;
    }
  }

  y -= 12;
  page.drawLine({ start: { x: leftX, y }, end: { x: rightX, y }, thickness: 0.75, color: GOLD_LIGHT });
  y -= 34;

  // Net pay - the hero number
  page.drawRectangle({ x: leftX - 16, y: y - 14, width: rightX - leftX + 32, height: 46, color: WINE });
  page.drawText("NET PAY", { x: leftX, y: y + 2, size: 12, font: sansBold, color: GOLD_LIGHT });
  const netText = peso(params.netPayCentavos);
  const netWidth = serif.widthOfTextAtSize(netText, 24);
  page.drawText(netText, { x: rightX - netWidth, y: y - 8, size: 24, font: serif, color: rgb(1, 1, 1) });

  page.drawText(`Payslip ID: ${params.payrollId}`, { x: leftX, y: 50, size: 8, font: sans, color: GRAY });
  page.drawText(`Issued by ${params.coachName}, The VA Atelier`, { x: leftX, y: 38, size: 8, font: sans, color: GRAY });

  return pdfDoc.save();
}

/**
 * Renders a staff member's service agreement as an A4 document - admin-
 * entered free text (staffProfiles.serviceAgreement), with basic word-
 * wrapping, plus printed signature lines for both parties.
 */
export async function generateServiceAgreementPdf(params: {
  staffName: string;
  position: string;
  dailyRateCentavos: number;
  startDate: Date;
  agreementText: string;
  coachName: string;
  coachTitle: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const { serif, sans, sansBold } = await embedBrandFonts(pdfDoc);
  let page = pdfDoc.addPage([595.28, 841.89]);
  let { width, height } = page.getSize();

  drawHeader(page, sansBold, "SERVICE AGREEMENT");

  const leftX = 70;
  const rightX = width - 70;
  const maxWidth = rightX - leftX;
  let y = 700;

  page.drawText(params.staffName, { x: leftX, y, size: 18, font: serif, color: WINE });
  y -= 20;
  page.drawText(params.position, { x: leftX, y, size: 10.5, font: sans, color: GRAY });
  y -= 28;

  const summaryLines = [
    `Position: ${params.position}`,
    `Daily Rate: ${peso(params.dailyRateCentavos)}`,
    `Start Date: ${params.startDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}`,
  ];
  for (const line of summaryLines) {
    page.drawText(line, { x: leftX, y, size: 10.5, font: sansBold, color: DARK });
    y -= 17;
  }
  y -= 10;
  page.drawLine({ start: { x: leftX, y }, end: { x: rightX, y }, thickness: 0.75, color: GOLD_LIGHT });
  y -= 26;

  const bodySize = 10.5;
  const lineHeight = 15;
  const minY = 170; // leave room for the signature block on the last page

  const newPage = () => {
    const p = pdfDoc.addPage([595.28, 841.89]);
    const { width: w, height: h } = p.getSize();
    p.drawRectangle({ x: 0, y: 0, width: w, height: h, color: CREAM });
    p.drawRectangle({ x: 24, y: 24, width: w - 48, height: h - 48, borderColor: GOLD, borderWidth: 1.5 });
    return { page: p, width: w, height: h };
  };

  const paragraphs = (params.agreementText || "No specific terms have been entered yet - contact your admin.")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const lines = wrapText(sans, paragraph, bodySize, maxWidth);
    for (const line of lines) {
      if (y < minY) {
        ({ page, width, height } = newPage());
        y = height - 80;
      }
      page.drawText(line, { x: leftX, y, size: bodySize, font: sans, color: DARK });
      y -= lineHeight;
    }
    y -= 8;
  }

  if (y < minY) {
    ({ page, width, height } = newPage());
    y = height - 100;
  }

  y = Math.min(y, minY + 20);
  y -= 30;

  const sigLineY = y;
  page.drawLine({ start: { x: leftX, y: sigLineY }, end: { x: leftX + 190, y: sigLineY }, thickness: 1, color: GRAY });
  page.drawLine({ start: { x: rightX - 190, y: sigLineY }, end: { x: rightX, y: sigLineY }, thickness: 1, color: GRAY });
  page.drawText(params.coachName, { x: leftX, y: sigLineY - 16, size: 10, font: sansBold, color: WINE });
  page.drawText(params.coachTitle, { x: leftX, y: sigLineY - 30, size: 9, font: sans, color: GRAY });
  page.drawText(params.staffName, { x: rightX - 190, y: sigLineY - 16, size: 10, font: sansBold, color: WINE });
  page.drawText(params.position, { x: rightX - 190, y: sigLineY - 30, size: 9, font: sans, color: GRAY });

  return pdfDoc.save();
}
