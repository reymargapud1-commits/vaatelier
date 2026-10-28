import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { personalClients, fleetVehicles } from "@/db/schema";
import { computeDueStatus, type FleetPmsRecord } from "@/lib/fleet-pms";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
const ASSETS_DIR = path.join(process.cwd(), "assets", "clients", "jjts");

type PersonalClient = typeof personalClients.$inferSelect;
type FleetVehicle = typeof fleetVehicles.$inferSelect;

// Triton's own letterhead, lifted from the source PMS form (Phase 1 BLK 1
// Lot 6H, Sterling Techno Park, Brgy. Maguyam Silang, Cavite). JJTS's own
// report is printed ON Triton's form because that's how the original paper
// trail works (JJTS is Triton's trucking contractor, reporting back on
// Triton's own document-controlled template) - see the uploaded
// "Delivery Truck PMS revised.xlsx" this was modeled on.
const TRITON_NAME = "TRITON INDUSTRIAL PLASTIC MANUFACTURING CORP.";
const TRITON_ADDRESS_LINES = [
  "Phase 1 BLK 1 Lot 6H, Sterling Techno Park",
  "Brgy. Maguyam Silang, Cavite, Philippines",
  "Tel. No. (632) 899-59-55 to 66",
  "e-mail: tpmc@topnotcherplastic.com",
];

const DARK = rgb(0.13, 0.13, 0.15);
const GRAY = rgb(0.45, 0.45, 0.48);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.63);
const BORDER = rgb(0.75, 0.76, 0.8);
const HEADER_FILL = rgb(0.68, 0.76, 0.93); // the original form's lavender-blue column header band
const ROW_ALT_FILL = rgb(0.97, 0.97, 0.98);
const WINE = rgb(0.42, 0.1, 0.13);

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// Short form for table cells, where column width is tight (e.g. "Sep 28, 2025").
function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

async function loadFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  const loraBytes = fs.readFileSync(path.join(FONTS_DIR, "Lora-Variable.ttf"));
  const serif = await pdfDoc.embedFont(loraBytes);
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { serif, sans, sansBold };
}

async function loadImage(pdfDoc: PDFDocument, filename: string) {
  const p = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return pdfDoc.embedPng(fs.readFileSync(p));
}

type Fonts = Awaited<ReturnType<typeof loadFonts>>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Table columns for the history table (one row per PMS record) - a
// generalization of the original's horizontal "1st PMS / 2nd PMS" block
// layout, which only had room for exactly two events per truck. This
// version scales to however many PMS events a truck has had.
interface Column {
  key: keyof RowData;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}
interface RowData {
  date: string;
  planOdo: string;
  actualOdo: string;
  mileage: string;
  remarks: string;
  personInCharge: string;
}

const COLUMNS: Column[] = [
  { key: "date", label: "Date", width: 75, align: "center" },
  { key: "planOdo", label: "Plan Odo", width: 55, align: "center" },
  { key: "actualOdo", label: "Actual Odo", width: 58, align: "center" },
  { key: "mileage", label: "Mileage", width: 50, align: "center" },
  { key: "remarks", label: "Remarks", width: 120, align: "left" },
  { key: "personInCharge", label: "Person In Charge", width: 174, align: "left" },
];

const ROW_HEIGHT = 20;
const HEADER_ROW_HEIGHT = 22;

// pdf-lib's drawText happily overflows past its box, so a free-text cell
// (remarks, person in charge) that's wider than its column is truncated
// with an ellipsis rather than left to bleed into the next column.
function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(truncated + "…", size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

function drawCell(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" | "center",
  size: number,
  color = DARK
) {
  if (!text) return;
  const fitted = align === "left" ? fitText(font, text, size, width - 12) : text;
  const w = font.widthOfTextAtSize(fitted, size);
  let drawX = x + 6;
  if (align === "center") drawX = x + (width - w) / 2;
  else if (align === "right") drawX = x + width - w - 6;
  page.drawText(fitted, { x: drawX, y, size, font, color });
}

function drawTableHeader(page: PDFPage, fonts: Fonts, x: number, y: number): number {
  let cx = x;
  page.drawRectangle({ x, y: y - HEADER_ROW_HEIGHT, width: CONTENT_WIDTH, height: HEADER_ROW_HEIGHT, color: HEADER_FILL });
  for (const col of COLUMNS) {
    drawCell(page, fonts.sansBold, col.label, cx, y - HEADER_ROW_HEIGHT + 7, col.width, "center", 8.5, DARK);
    cx += col.width;
  }
  page.drawRectangle({
    x,
    y: y - HEADER_ROW_HEIGHT,
    width: CONTENT_WIDTH,
    height: HEADER_ROW_HEIGHT,
    borderColor: BORDER,
    borderWidth: 0.75,
  });
  return y - HEADER_ROW_HEIGHT;
}

function drawTableRow(page: PDFPage, fonts: Fonts, x: number, y: number, row: RowData, alt: boolean): number {
  if (alt) page.drawRectangle({ x, y: y - ROW_HEIGHT, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: ROW_ALT_FILL });
  let cx = x;
  for (const col of COLUMNS) {
    drawCell(page, fonts.sans, row[col.key], cx, y - ROW_HEIGHT + 6.5, col.width, col.align || "left", 8);
    cx += col.width;
  }
  page.drawLine({ start: { x, y: y - ROW_HEIGHT }, end: { x: x + CONTENT_WIDTH, y: y - ROW_HEIGHT }, thickness: 0.5, color: BORDER });
  return y - ROW_HEIGHT;
}

async function drawLetterhead(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  title: string
): Promise<number> {
  let y = PAGE_HEIGHT - MARGIN;

  // JJTS Enterprises' own banner (logo + contact details), exactly as
  // embedded in the source Excel form.
  const banner = await loadImage(pdfDoc, "jjts-banner.png");
  if (banner) {
    const targetWidth = 300;
    const scale = targetWidth / banner.width;
    const h = banner.height * scale;
    page.drawImage(banner, { x: PAGE_WIDTH - MARGIN - targetWidth, y: y - h, width: targetWidth, height: h });
  }
  y -= 58;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: BORDER });
  y -= 10;

  // Triton's own document-controlled "FORM" header - this report is
  // printed on Triton's form since JJTS is reporting fleet maintenance
  // back to them as their trucking contractor.
  const logoW = 46;
  const triton = await loadImage(pdfDoc, "triton-logo.png");
  if (triton) {
    const scale = logoW / triton.width;
    const h = triton.height * scale;
    page.drawImage(triton, { x: MARGIN, y: y - h, width: logoW, height: h });
  }
  page.drawText(TRITON_NAME, { x: MARGIN + logoW + 8, y: y - 10, size: 8.5, font: fonts.sansBold, color: DARK, maxWidth: 265 });
  let addrY = y - 22;
  for (const line of TRITON_ADDRESS_LINES) {
    page.drawText(line, { x: MARGIN + logoW + 8, y: addrY, size: 6, font: fonts.sans, color: GRAY });
    addrY -= 8;
  }

  // Form meta box, right side.
  const boxX = PAGE_WIDTH - MARGIN - 190;
  const boxW = 190;
  const boxTop = y + 4;
  const boxH = 62;
  page.drawRectangle({ x: boxX, y: boxTop - boxH, width: boxW, height: boxH, borderColor: BORDER, borderWidth: 0.75 });
  const metaRows: [string, string][] = [
    ["Form no:", ""],
    ["Revision Level:", "1"],
    ["Effective Date:", ""],
    ["Page:", "1 of 1"],
  ];
  let metaY = boxTop - 11;
  for (const [label, value] of metaRows) {
    page.drawText(label, { x: boxX + 6, y: metaY, size: 7.5, font: fonts.sansBold, color: DARK });
    page.drawText(value, { x: boxX + 95, y: metaY, size: 7.5, font: fonts.sans, color: DARK });
    metaY -= 14.5;
  }

  y -= 72;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: BORDER });
  y -= 20;

  page.drawText(title, { x: MARGIN, y, size: 14, font: fonts.serif, color: WINE });
  return y - 22;
}

export interface FleetPmsReportParams {
  client: PersonalClient;
  vehicle: FleetVehicle;
  records: FleetPmsRecord[]; // any order; sorted here
  generatedAt: Date;
}

export async function generateFleetPmsReportPdf(params: FleetPmsReportParams): Promise<Uint8Array> {
  const { client, vehicle, records } = params;
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);

  const sorted = [...records].sort((a, b) => {
    if (a.pmsDate && b.pmsDate) return a.pmsDate.getTime() - b.pmsDate.getTime();
    if (a.pmsDate) return -1;
    if (b.pmsDate) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = await drawLetterhead(pdfDoc, page, fonts, "PREVENTIVE MAINTENANCE SCHEDULE OF DELIVERY TRUCK");

  // Truck identification + masterlist details (two columns: name/plate on
  // the left, the Masterlist-sheet fields on the right).
  page.drawText("TRUCK NAME / PLATE NO.", { x: MARGIN, y, size: 7, font: fonts.sansBold, color: GRAY });
  page.drawText(vehicle.plateNumber, {
    x: MARGIN,
    y: y - 14,
    size: 13,
    font: fonts.sansBold,
    color: DARK,
  });
  const leftBottom = y - 14;

  const infoRightX = MARGIN + 300;
  const infoLines: string[] = [];
  if (vehicle.location) infoLines.push(`Location: ${vehicle.location}`);
  if (vehicle.status) infoLines.push(`Status: ${vehicle.status}`);
  if (vehicle.dateAcquired) infoLines.push(`Date Acquired: ${formatDate(vehicle.dateAcquired)}`);
  if (vehicle.registrationDate) infoLines.push(`Registration Date: ${formatDate(vehicle.registrationDate)}`);
  let infoY = y - 2;
  for (const line of infoLines) {
    page.drawText(line, { x: infoRightX, y: infoY, size: 7.5, font: fonts.sans, color: GRAY });
    infoY -= 10.5;
  }
  const rightBottom = infoY + 10.5; // bottom of the last line actually drawn (or y - 2 if none)

  // Current status line (computed - not part of the original form, but
  // useful context for whoever reads the report) - placed below BOTH
  // columns above so it never collides with either, however many
  // masterlist detail lines happened to be present.
  y = Math.min(leftBottom, rightBottom) - 18;
  const status = computeDueStatus(records, params.generatedAt);
  const statusText = status.neverServiced
    ? "Status: No completed PMS on record yet"
    : `Last PMS: ${formatDate(status.lastCompleted!.pmsDate!)}   -   Next Due: ${formatDate(status.nextDueDate!)}${
        status.overdue ? "   -   OVERDUE" : ""
      }`;
  page.drawText(statusText, {
    x: MARGIN,
    y,
    size: 8.5,
    font: fonts.sansBold,
    color: status.overdue ? WINE : GRAY,
  });
  y -= 18;

  // Table, paginated. Each page's outer border is tracked and drawn against
  // that SAME page's own table-top, not the first page's - otherwise a
  // continuation page draws a border spanning the wrong vertical range
  // entirely (and can slice straight through a row).
  let tableTop = y;
  let borderPage = page;
  const bottomLimit = 150; // leaves room for the notes + signature block on the last page
  y = drawTableHeader(page, fonts, MARGIN, tableTop);

  function closeTableBorder(p: PDFPage, top: number, bottom: number) {
    p.drawRectangle({ x: MARGIN, y: bottom, width: CONTENT_WIDTH, height: top - HEADER_ROW_HEIGHT - bottom, borderColor: BORDER, borderWidth: 0.75 });
  }

  if (sorted.length === 0) {
    page.drawText("No PMS records yet.", { x: MARGIN + 6, y: y - 14, size: 9, font: fonts.sans, color: GRAY });
    y -= ROW_HEIGHT;
  } else {
    sorted.forEach((r, i) => {
      if (y - ROW_HEIGHT < bottomLimit) {
        closeTableBorder(borderPage, tableTop, y);
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        let ny = PAGE_HEIGHT - MARGIN;
        page.drawText(`PMS History - ${vehicle.plateNumber} (continued)`, {
          x: MARGIN,
          y: ny,
          size: 10,
          font: fonts.sansBold,
          color: GRAY,
        });
        ny -= 20;
        tableTop = ny;
        borderPage = page;
        y = drawTableHeader(page, fonts, MARGIN, ny);
      }
      const row: RowData = {
        date: r.pmsDate ? formatDateShort(r.pmsDate) : "-",
        planOdo: r.planOdo || "-",
        actualOdo: r.actualOdo || "-",
        mileage: r.mileage != null ? r.mileage.toLocaleString("en-PH") : "-",
        remarks: r.remarks || "-",
        personInCharge: r.personInCharge || "-",
      };
      y = drawTableRow(page, fonts, MARGIN, y, row, i % 2 === 1);
    });
  }

  closeTableBorder(borderPage, tableTop, y);

  // Notes - verbatim from the original Triton form.
  y -= 16;
  if (y < 110) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }
  page.drawText("Note:", { x: MARGIN, y, size: 8, font: fonts.sansBold, color: DARK });
  y -= 11;
  page.drawText("In every +10,000 kilometer will be the PMS of the Delivery truck", {
    x: MARGIN + 8,
    y,
    size: 7.5,
    font: fonts.sans,
    color: GRAY,
  });
  y -= 10;
  page.drawText("In every +7,500 kilometer will be the PMS of the Shuttle service", {
    x: MARGIN + 8,
    y,
    size: 7.5,
    font: fonts.sans,
    color: GRAY,
  });

  // Signature block - blank lines, filled in by hand at print time (per
  // Reymar: no fixed defaults, since who signs can vary report to report).
  y -= 46;
  const sigCols = [
    { label: "Prepared by:", role: "Maintenance Engineer" },
    { label: "Checked by:", role: "Truck Mechanic" },
    { label: "Confirmed by:", role: "Maintenance Supervisor" },
  ];
  const sigColWidth = CONTENT_WIDTH / 3;
  sigCols.forEach((s, i) => {
    const sx = MARGIN + i * sigColWidth;
    page.drawText(s.label, { x: sx, y: y + 28, size: 7.5, font: fonts.sansBold, color: GRAY });
    page.drawLine({ start: { x: sx, y }, end: { x: sx + sigColWidth - 24, y }, thickness: 0.75, color: DARK });
    page.drawText(s.role, { x: sx, y: y - 11, size: 7, font: fonts.sans, color: GRAY });
  });

  // Footer.
  const footerY = 36;
  page.drawText(`Generated ${formatDate(params.generatedAt)} via The VA Atelier for ${client.name}`, {
    x: MARGIN,
    y: footerY,
    size: 6.5,
    font: fonts.sans,
    color: LIGHT_GRAY,
  });

  return pdfDoc.save();
}

// ---------------------------------------------------------------------
// DELIVERY TRUCK PMS MONITORING CHECKLIST - the 25-item per-visit
// inspection form (separate from the PMS History Report above - printed
// once per actual PMS visit and handed over with the truck). Date/Time,
// Mileage and Service Provider are left blank for hand-filling at the
// visit itself, matching the "blank for hand-filling" approach used for
// Plan Odo/Actual Odo/etc. in the history report. Item text below is
// copied verbatim from the source Excel (including its "Alingment" typo)
// per Reymar's "walang babaguhin" (don't change anything) instruction.
// ---------------------------------------------------------------------

interface ChecklistItem {
  num: number;
  text: string;
  subLines?: string[];
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { num: 1, text: "Change oil and filter" },
  { num: 2, text: "Change Fuel filter" },
  { num: 3, text: "Air Filter Change and Clean" },
  { num: 4, text: "Check Engine Oil Leaks" },
  { num: 5, text: "Check Radiator leaks" },
  { num: 6, text: "Check Belts" },
  { num: 7, text: "Check Brakes" },
  { num: 8, text: "Check steering" },
  { num: 9, text: "Check Windshield" },
  { num: 10, text: "Check Transmission" },
  { num: 11, text: "Check Differential" },
  { num: 12, text: "Wheel Alingment Check / Adjust" },
  { num: 13, text: "Check Headlights / Signal and Parklights" },
  { num: 14, text: "Tightened Battery Terminal" },
  { num: 15, text: "Regreasing of All Fittings" },
  { num: 16, text: "Tire Rotation" },
  { num: 17, text: "Tire Inflation", subLines: ["Front Left and Right 110psi", "Rear Left & Right 115psi"] },
  { num: 18, text: "Spare Tire" },
  { num: 19, text: "Tire Wrench" },
  { num: 20, text: "Tire Jack (15t / 20t / 25t / 30t )" },
  { num: 21, text: "Tools" },
  { num: 22, text: "Oil Pan" },
  { num: 23, text: "Early Warning Device" },
  { num: 24, text: "Tire Choked ( Steel / Wood)" },
  { num: 25, text: "Fire Extinguisher" },
];

interface ChecklistColumn {
  label: string;
  width: number;
}

// Task Perform / Checked / Inspect / Remarks - same four columns as the
// original Excel form's header row (A12/H12/J12/L12). "Checked" and
// "Inspect" are left blank for a hand-written mark at the actual visit.
const CHECKLIST_COLUMNS: ChecklistColumn[] = [
  { label: "TASK PERFORM", width: 258 },
  { label: "CHECKED", width: 78 },
  { label: "INSPECT", width: 78 },
  { label: "REMARKS", width: 118 },
];

// Kept tight on purpose - Reymar wants the full 25-item checklist (plus
// legend/remarks/signature) to print on a single page, so every gap here is
// deliberately as small as still stays legible.
const CL_ROW_HEIGHT = 12;
const CL_TALL_ROW_HEIGHT = 25; // item 17 (Tire Inflation) needs room for its two psi sub-notes
const CL_HEADER_HEIGHT = 15;

function drawChecklistHeader(page: PDFPage, fonts: Fonts, x: number, y: number): number {
  let cx = x;
  page.drawRectangle({ x, y: y - CL_HEADER_HEIGHT, width: CONTENT_WIDTH, height: CL_HEADER_HEIGHT, color: HEADER_FILL });
  for (const col of CHECKLIST_COLUMNS) {
    drawCell(page, fonts.sansBold, col.label, cx, y - CL_HEADER_HEIGHT + 5, col.width, "center", 7.5, DARK);
    cx += col.width;
  }
  return y - CL_HEADER_HEIGHT;
}

// Every row gets its own full grid line (not just a bottom line) - a
// column-separator line down each side of Checked/Inspect/Remarks, plus the
// bottom line - so it's easy to mark a check per row per Reymar's request.
function drawChecklistRow(page: PDFPage, fonts: Fonts, x: number, y: number, item: ChecklistItem, alt: boolean): number {
  const rowH = item.subLines ? CL_TALL_ROW_HEIGHT : CL_ROW_HEIGHT;
  if (alt) page.drawRectangle({ x, y: y - rowH, width: CONTENT_WIDTH, height: rowH, color: ROW_ALT_FILL });

  drawCell(page, fonts.sans, `${item.num}.  ${item.text}`, x, y - 8.5, CHECKLIST_COLUMNS[0].width, "left", 7.5);
  if (item.subLines) {
    let sy = y - 16.5;
    for (const line of item.subLines) {
      page.drawText(line, { x: x + 16, y: sy, size: 6, font: fonts.sans, color: GRAY });
      sy -= 7.5;
    }
  }

  let vx = x;
  for (const col of CHECKLIST_COLUMNS) {
    page.drawLine({ start: { x: vx, y }, end: { x: vx, y: y - rowH }, thickness: 0.5, color: BORDER });
    vx += col.width;
  }
  page.drawLine({ start: { x: vx, y }, end: { x: vx, y: y - rowH }, thickness: 0.5, color: BORDER });
  page.drawLine({ start: { x, y: y - rowH }, end: { x: x + CONTENT_WIDTH, y: y - rowH }, thickness: 0.5, color: BORDER });
  return y - rowH;
}

export interface FleetPmsChecklistParams {
  client: PersonalClient;
  vehicle: FleetVehicle;
  generatedAt: Date;
}

export async function generateFleetPmsChecklistPdf(params: FleetPmsChecklistParams): Promise<Uint8Array> {
  const { client, vehicle } = params;
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = await drawLetterhead(pdfDoc, page, fonts, "DELIVERY TRUCK PMS MONITORING CHECKLIST");

  // Truck identification - Date/Time, Mileage and Service Provider are left
  // blank for hand-filling at the actual PMS visit.
  const col2X = MARGIN + 300;
  page.drawText("TRUCK NAME / PLATE NO.", { x: MARGIN, y, size: 6.5, font: fonts.sansBold, color: GRAY });
  page.drawText("DATE / TIME", { x: col2X, y, size: 6.5, font: fonts.sansBold, color: GRAY });
  y -= 9;
  page.drawText(vehicle.plateNumber, {
    x: MARGIN,
    y,
    size: 10,
    font: fonts.sansBold,
    color: DARK,
  });
  page.drawLine({ start: { x: col2X, y: y - 2 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 2 }, thickness: 0.75, color: BORDER });
  y -= 15;

  page.drawText("MILEAGE", { x: MARGIN, y, size: 6.5, font: fonts.sansBold, color: GRAY });
  page.drawText("SERVICE PROVIDER", { x: col2X, y, size: 6.5, font: fonts.sansBold, color: GRAY });
  y -= 9;
  page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: col2X - 20, y: y - 2 }, thickness: 0.75, color: BORDER });
  page.drawLine({ start: { x: col2X, y: y - 2 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 2 }, thickness: 0.75, color: BORDER });
  y -= 15;

  // 25-item checklist table, paginated if it ever doesn't fit on one page.
  // (The legend/remarks/signature below have their own page-break checks,
  // so this only needs to protect the table rows themselves - not reserve
  // room for what comes after, which would strand a lot of blank space on
  // whichever page the table happens to end on.)
  const bottomLimit = 45;
  y = drawChecklistHeader(page, fonts, MARGIN, y);

  CHECKLIST_ITEMS.forEach((item, i) => {
    const rowH = item.subLines ? CL_TALL_ROW_HEIGHT : CL_ROW_HEIGHT;
    if (y - rowH < bottomLimit) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let ny = PAGE_HEIGHT - MARGIN;
      page.drawText(`DELIVERY TRUCK PMS MONITORING CHECKLIST - ${vehicle.plateNumber} (continued)`, {
        x: MARGIN,
        y: ny,
        size: 10,
        font: fonts.sansBold,
        color: GRAY,
      });
      ny -= 20;
      y = drawChecklistHeader(page, fonts, MARGIN, ny);
    }
    y = drawChecklistRow(page, fonts, MARGIN, y, item, i % 2 === 1);
  });

  // Truck diagram on the LEFT, Legend + Remarks + Evaluated-by on the RIGHT
  // - matches the actual position in the source Triton Excel form (per
  // Reymar's screenshot of the original sheet). Laid out as two columns so
  // the diagram fits without pushing the form past one page.
  y -= 8;
  const diagram = await loadImage(pdfDoc, "truck-diagram.png");
  const diagramW = 200;
  const diagramH = diagram ? diagram.height * (diagramW / diagram.width) : 162;
  const blockH = diagramH;
  if (y < blockH + 30) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  // Left column: the truck diagram, for marking damage location by hand.
  page.drawText("MARK DAMAGE LOCATION (S / D / B)", { x: MARGIN, y, size: 6, font: fonts.sansBold, color: GRAY });
  if (diagram) {
    page.drawImage(diagram, { x: MARGIN, y: y - 9 - diagramH, width: diagramW, height: diagramH });
  }

  // Right column: Legend, Remarks/Comments box, and the Evaluated-by
  // signature - all stacked together, same as the original form's layout.
  const rightColX = MARGIN + diagramW + 14;
  const rightColW = CONTENT_WIDTH - diagramW - 14;
  let ry = y;
  page.drawText("LEGEND:", { x: rightColX, y: ry, size: 7, font: fonts.sansBold, color: DARK });
  ry -= 10;
  page.drawText("S - SCRATCH     D - DENTS     B - BROKEN", { x: rightColX, y: ry, size: 6.5, font: fonts.sans, color: GRAY });
  ry -= 12;
  page.drawText("REMARKS / COMMENTS", { x: rightColX, y: ry, size: 7, font: fonts.sansBold, color: DARK });
  ry -= 5;
  const sigReserve = 32; // room below the box for "Evaluated by:" + line + role
  const remarksBoxH = Math.max(40, ry - (y - blockH) - 8 - sigReserve);
  page.drawRectangle({
    x: rightColX,
    y: ry - remarksBoxH,
    width: rightColW,
    height: remarksBoxH,
    borderColor: BORDER,
    borderWidth: 0.75,
  });
  ry -= remarksBoxH + 10;

  // Signature - blank, filled in by hand at print time (per Reymar: no
  // fixed defaults, since who evaluates/mans the shift varies visit to
  // visit - same approach as the history report's signature block).
  page.drawText("Evaluated by:", { x: rightColX, y: ry, size: 7.5, font: fonts.sansBold, color: GRAY });
  ry -= 14;
  page.drawLine({ start: { x: rightColX, y: ry }, end: { x: rightColX + rightColW, y: ry }, thickness: 0.75, color: DARK });
  ry -= 10;
  page.drawText("Mechanic on Duty", { x: rightColX, y: ry, size: 7, font: fonts.sans, color: GRAY });

  y -= blockH + 16;

  return pdfDoc.save();
}
