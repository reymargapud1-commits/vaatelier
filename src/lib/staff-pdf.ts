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

/** The circle + "M" zigzag brand mark (src/components/Logo.tsx's LogoMark SVG), redrawn with line segments for the payslip header. */
function drawLogoMark(page: PDFPage, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: GOLD, borderWidth: 1.1 });
  page.drawCircle({ x: cx, y: cy, size: r * 0.82, color: GOLD, opacity: 0.1 });
  const s = r / 40; // LogoMark's viewBox ring radius is 40 out of a 44,44 center.
  const pt = (dx: number, dy: number) => ({ x: cx + dx * s, y: cy - dy * s }); // SVG y-down -> PDF y-up
  const pts = [pt(-16, 16), pt(-16, -16), pt(0, 8), pt(16, -16), pt(16, 16)];
  for (let i = 0; i < pts.length - 1; i++) {
    page.drawLine({ start: pts[i], end: pts[i + 1], thickness: Math.max(1.3, r * 0.12), color: WINE });
  }
}

type PayslipFonts = { serif: PDFFont; sans: PDFFont; sansBold: PDFFont; serifItalic: PDFFont };

type PayslipParams = {
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
  presentDates?: string[];
};

/**
 * Draws one complete payslip "copy" into a 612 x 396 (8.5" x 5.5") band of
 * `page`, starting `offsetY` points up from the page's bottom edge. Used
 * twice per page - once per half of a short bond sheet - so the two copies
 * are pixel-identical in layout, just offset and labeled differently.
 */
function drawPayslipCopy(
  page: PDFPage,
  fonts: PayslipFonts,
  offsetY: number,
  copyLabel: string,
  params: PayslipParams
) {
  const { serif, sans, sansBold, serifItalic } = fonts;
  const Y = (localY: number) => localY + offsetY;
  const bandWidth = 612;
  const bandHeight = 396;

  page.drawCircle({ x: bandWidth - 40, y: Y(bandHeight - 20), size: 140, color: GOLD, opacity: 0.07 });
  page.drawCircle({ x: 60, y: Y(40), size: 80, color: WINE, opacity: 0.045 });

  const inset = 14;
  page.drawRectangle({
    x: inset,
    y: Y(inset),
    width: bandWidth - inset * 2,
    height: bandHeight - inset * 2,
    borderColor: GOLD,
    borderWidth: 1.3,
  });

  const leftX = inset + 22; // 36
  const rightX = bandWidth - inset - 22; // 576
  const colGap = 22;
  const colSplit = leftX + (rightX - leftX) * 0.46;
  const rightColX = colSplit + colGap;

  // --- Header: logo + wordmark (left); copy badge, "PAYSLIP" + period (right) ---
  const headerY = bandHeight - inset - 22;
  drawLogoMark(page, leftX + 12, Y(headerY), 12);
  page.drawText("THE VA ATELIER", { x: leftX + 30, y: Y(headerY - 3), size: 10, font: sansBold, color: WINE });
  page.drawText("Virtual Assistant Services & Training", {
    x: leftX + 30,
    y: Y(headerY - 14),
    size: 6,
    font: sans,
    color: GRAY,
  });

  const badgeSize = 7;
  const badgeLabel = copyLabel.toUpperCase();
  const badgeTextWidth = sansBold.widthOfTextAtSize(badgeLabel, badgeSize);
  const badgePadX = 7;
  const badgeW = badgeTextWidth + badgePadX * 2;
  const badgeH = 14;
  page.drawRectangle({ x: rightX - badgeW, y: Y(headerY - 2), width: badgeW, height: badgeH, color: WINE });
  page.drawText(badgeLabel, {
    x: rightX - badgeW + badgePadX,
    y: Y(headerY + 2),
    size: badgeSize,
    font: sansBold,
    color: GOLD_LIGHT,
  });

  const payslipLabel = "PAYSLIP";
  const payslipLabelSize = 14;
  const payslipLabelWidth = serif.widthOfTextAtSize(payslipLabel, payslipLabelSize);
  page.drawText(payslipLabel, {
    x: rightX - payslipLabelWidth,
    y: Y(headerY - 20),
    size: payslipLabelSize,
    font: serif,
    color: WINE,
  });
  const periodWidth = sansBold.widthOfTextAtSize(params.periodLabel, 8.5);
  page.drawText(params.periodLabel, {
    x: rightX - periodWidth,
    y: Y(headerY - 32),
    size: 8.5,
    font: sansBold,
    color: GOLD,
  });

  const dividerY = headerY - 44;
  page.drawLine({
    start: { x: leftX, y: Y(dividerY) },
    end: { x: rightX, y: Y(dividerY) },
    thickness: 0.75,
    color: GOLD_LIGHT,
  });

  // --- Left column: who, key dates, a short note ---
  let ly = dividerY - 22;
  page.drawText("PAY TO", { x: leftX, y: Y(ly), size: 6.5, font: sansBold, color: GOLD });
  ly -= 15;
  const nameMaxWidth = colSplit - leftX - 4;
  let nameSize = 17;
  while (nameSize > 10 && serif.widthOfTextAtSize(params.staffName, nameSize) > nameMaxWidth) {
    nameSize -= 0.5;
  }
  page.drawText(params.staffName, { x: leftX, y: Y(ly), size: nameSize, font: serif, color: WINE });
  ly -= 15;
  page.drawText(params.position, { x: leftX, y: Y(ly), size: 9, font: sans, color: GRAY });
  ly -= 26;

  const leftFact = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: leftX, y: Y(ly), size: 6, font: sansBold, color: GOLD });
    ly -= 10;
    page.drawText(value, { x: leftX, y: Y(ly), size: 9.5, font: sansBold, color: DARK });
    ly -= 17;
  };
  leftFact(
    "Date Issued",
    params.generatedAt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
  );
  leftFact("Payslip No.", params.payrollId.slice(0, 8).toUpperCase());

  ly -= 4;
  page.drawLine({ start: { x: leftX, y: Y(ly) }, end: { x: colSplit, y: Y(ly) }, thickness: 0.5, color: GOLD_LIGHT });
  ly -= 17;
  const noteLines = wrapText(
    serifItalic,
    `Thank you for your hard work this pay period, ${params.staffName.split(" ")[0]} - it truly makes a difference.`,
    8.5,
    colSplit - leftX
  );
  for (const line of noteLines.slice(0, 2)) {
    page.drawText(line, { x: leftX, y: Y(ly), size: 8.5, font: serifItalic, color: GRAY });
    ly -= 13;
  }

  // --- Right column: earnings, deductions, attendance, net pay hero ---
  let ry = dividerY - 18;
  page.drawText("EARNINGS", { x: rightColX, y: Y(ry), size: 6.5, font: sansBold, color: GOLD });
  ry -= 14;

  const rightRow = (label: string, value: string, opts: { bold?: boolean } = {}) => {
    const font = opts.bold ? sansBold : sans;
    page.drawText(label, { x: rightColX, y: Y(ry), size: 9, font, color: DARK });
    const valueWidth = font.widthOfTextAtSize(value, 9);
    page.drawText(value, { x: rightX - valueWidth, y: Y(ry), size: 9, font, color: DARK });
    ry -= 15;
  };

  rightRow("Days Present", String(params.daysPresent));
  rightRow("Daily Rate", peso(params.dailyRateCentavos));
  rightRow("Gross Pay", peso(params.grossPayCentavos), { bold: true });

  if (params.cashAdvanceDeductionCentavos > 0) {
    ry -= 5;
    page.drawText("DEDUCTIONS", { x: rightColX, y: Y(ry), size: 6.5, font: sansBold, color: GOLD });
    ry -= 14;
    rightRow("Cash Advance", `- ${peso(params.cashAdvanceDeductionCentavos)}`);
    if (params.deductionNote) {
      const noteLines2 = wrapText(serifItalic, params.deductionNote, 7, rightX - rightColX);
      for (const line of noteLines2.slice(0, 2)) {
        page.drawText(line, { x: rightColX, y: Y(ry + 3), size: 7, font: serifItalic, color: GRAY });
        ry -= 9.5;
      }
    }
  }

  // Net pay hero band, anchored above the signature footer.
  const netBoxHeight = 38;
  const netBoxY = inset + 46;
  const chipMinY = netBoxY + netBoxHeight + 10;
  if (params.presentDates && params.presentDates.length > 0 && ry - 13 > chipMinY) {
    ry -= 7;
    page.drawText("ATTENDANCE LOG", { x: rightColX, y: Y(ry), size: 6.5, font: sansBold, color: GOLD });
    ry -= 13;

    const chipFont = sans;
    const chipSize = 6.5;
    const chipH = 13;
    const chipGapX = 5;
    const chipGapY = 4;
    const chipPadX = 5.5;
    const dates = params.presentDates;
    const chipLabel = (iso: string) => {
      const [y2, m2, d2] = iso.split("-").map(Number);
      return new Date(Date.UTC(y2, m2 - 1, d2)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    };
    const drawOneChip = (label: string) => {
      const w = chipFont.widthOfTextAtSize(label, chipSize) + chipPadX * 2;
      page.drawRectangle({ x: cx, y: Y(ry - chipH), width: w, height: chipH, color: GOLD, opacity: 0.14 });
      page.drawText(label, { x: cx + chipPadX, y: Y(ry - chipH + 3.5), size: chipSize, font: chipFont, color: WINE });
      cx += w + chipGapX;
    };

    let cx = rightColX;
    let shown = 0;
    while (shown < dates.length) {
      if (ry - chipH < chipMinY) break;
      const label = chipLabel(dates[shown]);
      const w = chipFont.widthOfTextAtSize(label, chipSize) + chipPadX * 2;
      if (cx + w > rightX) {
        cx = rightColX;
        ry -= chipH + chipGapY;
        if (ry - chipH < chipMinY) break;
      }
      drawOneChip(label);
      shown++;
    }

    if (shown < dates.length) {
      const moreLabel = `+${dates.length - shown} more`;
      const w = chipFont.widthOfTextAtSize(moreLabel, chipSize) + chipPadX * 2;
      if (cx + w > rightX) {
        cx = rightColX;
        ry -= chipH + chipGapY;
      }
      if (ry - chipH >= chipMinY) drawOneChip(moreLabel);
    }
  }

  page.drawRectangle({
    x: rightColX - 14,
    y: Y(netBoxY),
    width: rightX - rightColX + 14,
    height: netBoxHeight,
    color: WINE,
  });
  page.drawText("NET PAY", { x: rightColX, y: Y(netBoxY + netBoxHeight - 13), size: 7.5, font: sansBold, color: GOLD_LIGHT });
  const netText = peso(params.netPayCentavos);
  const netSize = netText.length > 13 ? 15 : 17;
  const netWidth = serif.widthOfTextAtSize(netText, netSize);
  page.drawText(netText, { x: rightX - netWidth, y: Y(netBoxY + 8), size: netSize, font: serif, color: rgb(1, 1, 1) });

  // --- Footer: signature line (this copy gets signed as proof of receipt) ---
  const sigLineY = inset + 32;
  const sigLineWidth = 170;
  page.drawLine({
    start: { x: leftX, y: Y(sigLineY) },
    end: { x: leftX + sigLineWidth, y: Y(sigLineY) },
    thickness: 0.75,
    color: GRAY,
  });
  page.drawText("Signature over Printed Name", { x: leftX, y: Y(sigLineY - 9), size: 6, font: sans, color: GRAY });

  const dateLineX = leftX + sigLineWidth + 24;
  const dateLineWidth = 90;
  page.drawLine({
    start: { x: dateLineX, y: Y(sigLineY) },
    end: { x: dateLineX + dateLineWidth, y: Y(sigLineY) },
    thickness: 0.75,
    color: GRAY,
  });
  page.drawText("Date", { x: dateLineX, y: Y(sigLineY - 9), size: 6, font: sans, color: GRAY });

  const issuedText = `Issued by ${params.coachName}, The VA Atelier`;
  page.drawText(issuedText, { x: leftX, y: Y(inset + 6), size: 6, font: sans, color: GRAY });
  const idText = `Payslip No. ${params.payrollId.slice(0, 8).toUpperCase()}`;
  const idWidth = sans.widthOfTextAtSize(idText, 6);
  page.drawText(idText, { x: rightX - idWidth, y: Y(inset + 6), size: 6, font: sans, color: GRAY });
}

/**
 * Renders one staff member's payslip for one pay period as a FULL short
 * bond sheet (8.5" x 11" portrait) holding two identical copies, stacked
 * top and bottom, cut apart "crosswise" through the middle: "VA ATELIER
 * COPY" on top (kept, signed, as the coach's proof of payment) and
 * "RECEIVING COPY" on the bottom (the VA's own copy) - each with its own
 * signature line. Printable on an ordinary printer with no pre-cut paper
 * needed; the dashed guide shows exactly where to cut. Every value here is
 * a frozen snapshot of the staffPayrollRuns row, never recomputed, so a
 * payslip never changes after it's generated.
 */
export async function generatePayslipPdf(params: PayslipParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedBrandFonts(pdfDoc);
  const page = pdfDoc.addPage([612, 792]); // 8.5" x 11" short bond, portrait - two 8.5"x5.5" copies stacked.
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: 0, width, height, color: CREAM });

  drawPayslipCopy(page, fonts, 396, "VA Atelier Copy", params);
  drawPayslipCopy(page, fonts, 0, "Receiving Copy", params);

  // Cut guide, exactly at the midline.
  const midY = height / 2;
  const dashLen = 5;
  for (let x = 14; x < width - 14; x += dashLen * 2) {
    page.drawLine({
      start: { x, y: midY },
      end: { x: Math.min(x + dashLen, width - 14), y: midY },
      thickness: 0.75,
      color: GRAY,
    });
  }
  const cutLabel = "- - - CUT HERE - - -";
  const cutLabelSize = 7;
  const cutLabelWidth = fonts.sansBold.widthOfTextAtSize(cutLabel, cutLabelSize);
  const cutLabelW = cutLabelWidth + 16;
  page.drawRectangle({ x: (width - cutLabelW) / 2, y: midY - 6.5, width: cutLabelW, height: 13, color: CREAM });
  page.drawText(cutLabel, {
    x: (width - cutLabelWidth) / 2,
    y: midY - 3,
    size: cutLabelSize,
    font: fonts.sansBold,
    color: GRAY,
  });

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
