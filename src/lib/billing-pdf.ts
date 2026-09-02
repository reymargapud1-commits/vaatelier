import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { personalClients, personalClientCustomers, deliveryTrips, billingBatches } from "@/db/schema";

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

type PersonalClient = typeof personalClients.$inferSelect;
type Customer = typeof personalClientCustomers.$inferSelect;
type Trip = typeof deliveryTrips.$inferSelect;
type Batch = typeof billingBatches.$inferSelect;

function peso(n: number): string {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

async function loadFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  const loraBytes = fs.readFileSync(path.join(FONTS_DIR, "Lora-Variable.ttf"));
  const serif = await pdfDoc.embedFont(loraBytes);
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { serif, sans, sansBold };
}

// Shared column layout for the trip table used by both documents - keeps
// the two PDFs visually consistent since they describe the same trips.
interface Column {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

const TRIP_COLUMNS: Column[] = [
  { key: "sn", label: "SN", width: 16, align: "center" },
  { key: "date", label: "Date", width: 46, align: "center" },
  { key: "plate", label: "Plate #", width: 42, align: "center" },
  { key: "driver", label: "Driver's Name", width: 75 },
  { key: "helpers", label: "Helper's Name", width: 115 },
  { key: "from", label: "From", width: 88 },
  { key: "to", label: "To", width: 62 },
  { key: "gatepass", label: "Gate Pass #", width: 40, align: "center" },
  { key: "drsi", label: "DR/SI #", width: 65, align: "center" },
  { key: "waybill", label: "Waybill #", width: 42, align: "center" },
  { key: "remarks", label: "Remarks", width: 79 },
];

// pdf-lib's drawText will happily overflow past its box - and with
// maxWidth set, it WRAPS onto a second line instead of clipping, which
// then collides with the row drawn underneath it. Since these cells are
// short, single-line data (names, plate numbers, reference numbers), the
// right fix is truncating with an ellipsis rather than wrapping, so a long
// value never bleeds into the next row.
function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(truncated + "…", size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

function drawTripTableHeader(
  page: PDFPage,
  x0: number,
  y: number,
  columns: Column[],
  font: PDFFont,
  headerColor: RGB,
  textColor: RGB
) {
  let x = x0;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  page.drawRectangle({ x: x0, y: y - 16, width: totalWidth, height: 16, color: headerColor });
  for (const col of columns) {
    page.drawText(col.label, { x: x + 3, y: y - 11, size: 7, font, color: textColor });
    x += col.width;
  }
  return totalWidth;
}

function drawRow(
  page: PDFPage,
  x0: number,
  y: number,
  values: string[],
  columns: Column[],
  font: PDFFont,
  color: RGB,
  rowHeight: number
) {
  let x = x0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const size = 7;
    const text = fitText(font, values[i] ?? "", size, col.width - 4);
    let drawX = x + 3;
    if (col.align === "center") {
      const w = font.widthOfTextAtSize(text, size);
      drawX = x + (col.width - w) / 2;
    } else if (col.align === "right") {
      const w = font.widthOfTextAtSize(text, size);
      drawX = x + col.width - w - 3;
    }
    page.drawText(text, { x: drawX, y: y - rowHeight + 5, size, font, color });
    x += col.width;
  }
}

/**
 * The Billing Statement 5RJSL sends to Paintplas (or whichever customer) -
 * landscape, replicating the layout of the paper template Reymar sent as a
 * sample: letterhead, trip table, Subtotal / 12% VAT / Total, and the same
 * three-signature block (Prepared By / Confirmed By / Received By).
 */
export async function generateBillingStatementPdf(
  batch: Batch,
  client: PersonalClient,
  customer: Customer,
  trips: Trip[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const { sans, sansBold } = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const ink = rgb(0.1, 0.1, 0.12);
  const navy = rgb(0.09, 0.14, 0.28);
  const gold = rgb(0.85, 0.62, 0.15);
  const gray = rgb(0.4, 0.4, 0.42);
  const lineColor = rgb(0.75, 0.75, 0.78);
  const white = rgb(1, 1, 1);

  const marginX = 30;
  let y = height - 32;

  // Letterhead - recreated as clean type (the source is a low-res phone
  // photo of a printed logo, too blurry to embed directly at print
  // quality) rather than an embedded raster.
  page.drawText(client.name.toUpperCase().replace(/\.$/, ""), {
    x: marginX,
    y,
    size: 18,
    font: sansBold,
    color: navy,
  });
  const nameWidth = sansBold.widthOfTextAtSize(client.name.toUpperCase().replace(/\.$/, ""), 18);
  page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: marginX + nameWidth, y: y - 4 }, thickness: 1, color: navy });
  y -= 16;
  page.drawText((client.industry || "").toUpperCase() + (client.industry ? " CORPORATION" : ""), {
    x: marginX,
    y,
    size: 8,
    font: sansBold,
    color: gold,
  });
  y -= 13;
  if (client.businessAddress) {
    page.drawText(client.businessAddress, { x: marginX, y, size: 7.5, font: sans, color: gray });
    y -= 10;
  }
  if (client.email) {
    page.drawText(`Email: ${client.email}`, { x: marginX, y, size: 7.5, font: sans, color: gray });
    y -= 10;
  }
  if (client.tin) {
    page.drawText(`TIN: ${client.tin}`, { x: marginX, y, size: 7.5, font: sans, color: gray });
  }

  // Right-aligned BS # / Date
  const bsLabel = `BS #: ${batch.bsNumber}`;
  const dateLabel = `Date: ${formatDate(batch.batchDate)}`;
  page.drawText(bsLabel, { x: width - marginX - sansBold.widthOfTextAtSize(bsLabel, 11), y: height - 32, size: 11, font: sansBold, color: ink });
  page.drawText(dateLabel, { x: width - marginX - sans.widthOfTextAtSize(dateLabel, 9), y: height - 48, size: 9, font: sans, color: gray });

  // Title
  const title = "BILLING STATEMENT";
  page.drawText(title, { x: (width - sansBold.widthOfTextAtSize(title, 16)) / 2, y: height - 78, size: 16, font: sansBold, color: navy });

  // Client line
  y = height - 100;
  page.drawText("CLIENT: ", { x: marginX, y, size: 9.5, font: sansBold, color: ink });
  const clientLabelWidth = sansBold.widthOfTextAtSize("CLIENT: ", 9.5);
  page.drawText(customer.name.toUpperCase(), { x: marginX + clientLabelWidth, y, size: 9.5, font: sansBold, color: ink });
  const custNameWidth = sansBold.widthOfTextAtSize(customer.name.toUpperCase(), 9.5);
  page.drawLine({
    start: { x: marginX + clientLabelWidth, y: y - 2 },
    end: { x: marginX + clientLabelWidth + custNameWidth, y: y - 2 },
    thickness: 0.75,
    color: ink,
  });

  // Table
  const tableTop = y - 24;
  const rowHeight = 15.5;
  let rowY = tableTop;
  const tableX = marginX;
  const tableWidth = drawTripTableHeader(page, tableX, rowY, TRIP_COLUMNS, sansBold, navy, white);
  rowY -= 16;

  let subtotal = 0;
  trips.forEach((t, idx) => {
    subtotal += t.amountRate;
    if (idx % 2 === 1) {
      page.drawRectangle({ x: tableX, y: rowY - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.96, 0.96, 0.97) });
    }
    drawRow(
      page,
      tableX,
      rowY,
      [
        String(idx + 1),
        formatDate(t.tripDate),
        t.plateNumber,
        t.driverName,
        [t.helper1Name, t.helper2Name].filter(Boolean).join(" "),
        t.routeFrom,
        t.routeTo,
        t.gatePassNumber,
        t.drSiNumber,
        t.waybillNumber,
        t.remarks,
      ],
      TRIP_COLUMNS,
      sans,
      ink,
      rowHeight
    );
    // Amount column drawn separately (right-aligned, outside the shared
    // column set so it can carry its own header/number formatting).
    const amtText = peso(t.amountRate);
    const amtX = tableX + tableWidth + 90 - 3 - sans.widthOfTextAtSize(amtText, 7);
    page.drawText(amtText, { x: amtX, y: rowY - rowHeight + 5, size: 7, font: sans, color: ink });
    rowY -= rowHeight;
    page.drawLine({ start: { x: tableX, y: rowY }, end: { x: tableX + tableWidth + 90, y: rowY }, thickness: 0.4, color: lineColor });
  });

  // Amount column header (drawn after rows so it sits above them, aligned
  // with the header band already drawn for the other columns)
  page.drawRectangle({ x: tableX + tableWidth, y: tableTop - 16, width: 90, height: 16, color: navy });
  const amtHeader = "Amount (Rate)";
  page.drawText(amtHeader, {
    x: tableX + tableWidth + 90 - 3 - sansBold.widthOfTextAtSize(amtHeader, 7),
    y: tableTop - 11,
    size: 7,
    font: sansBold,
    color: white,
  });

  // Outer table border
  page.drawRectangle({
    x: tableX,
    y: rowY,
    width: tableWidth + 90,
    height: tableTop - rowY,
    borderColor: lineColor,
    borderWidth: 0.75,
  });
  // Vertical column separators
  let vx = tableX;
  for (const col of TRIP_COLUMNS) {
    page.drawLine({ start: { x: vx, y: tableTop }, end: { x: vx, y: rowY }, thickness: 0.5, color: lineColor });
    vx += col.width;
  }
  page.drawLine({ start: { x: vx, y: tableTop }, end: { x: vx, y: rowY }, thickness: 0.5, color: lineColor });

  // Totals
  const vat = subtotal * 0.12;
  const total = subtotal + vat;
  const totalsX = tableX + tableWidth - 20;
  let totalsY = rowY - 18;
  const totalLine = (label: string, amount: number, bold = false) => {
    const f = bold ? sansBold : sans;
    const size = bold ? 10 : 9;
    page.drawText(label, { x: totalsX, y: totalsY, size, font: f, color: ink });
    const amtText = peso(amount);
    page.drawText(amtText, {
      x: tableX + tableWidth + 90 - 3 - f.widthOfTextAtSize(amtText, size),
      y: totalsY,
      size,
      font: f,
      color: ink,
    });
    totalsY -= 15;
  };
  totalLine("Subtotal:", subtotal);
  totalLine("VAT (12%):", vat);
  page.drawLine({ start: { x: totalsX, y: totalsY + 10 }, end: { x: tableX + tableWidth + 90, y: totalsY + 10 }, thickness: 0.75, color: ink });
  totalLine("Total:", total, true);

  // Signature block - "Prepared by" gets a blank line for Reymar to sign
  // in person (no simulated cursive signature printed for him); "Received
  // by" is left for the customer to sign upon receipt.
  const sigY = 52;
  page.drawText("Prepared by:", { x: marginX, y: sigY + 40, size: 8.5, font: sans, color: gray });
  page.drawLine({ start: { x: marginX, y: sigY + 10 }, end: { x: marginX + 180, y: sigY + 10 }, thickness: 0.75, color: gray });
  page.drawText(client.preparedByName, { x: marginX, y: sigY - 4, size: 8.5, font: sansBold, color: ink });
  page.drawText(client.preparedByTitle, { x: marginX, y: sigY - 15, size: 7.5, font: sans, color: gray });

  const receivedX = marginX + 460;
  page.drawText("Received by:", { x: receivedX, y: sigY + 40, size: 8.5, font: sans, color: gray });
  page.drawLine({ start: { x: receivedX, y: sigY + 10 }, end: { x: receivedX + 180, y: sigY + 10 }, thickness: 0.75, color: gray });
  page.drawText("Signature over Printed Name / Customer", { x: receivedX, y: sigY - 4, size: 7.5, font: sans, color: gray });

  page.drawText(`Trips billed: ${trips.length}`, { x: marginX, y: 20, size: 7, font: sans, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Reymar's own Service Invoice/Receipt to 5RJSL (or whichever personal
 * client) for his flat per-trip agent commission - branded as The VA
 * Atelier. Lists the same trips as the Billing Statement above (so 5RJSL
 * can cross-check it against what they billed Paintplas) but the amount
 * column shows the flat commission per trip instead of the original rate,
 * and there's no VAT line since the commission rate is fixed.
 */
export async function generateCommissionInvoicePdf(
  batch: Batch,
  client: PersonalClient,
  customer: Customer,
  trips: Trip[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const { serif, sans, sansBold } = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const wine = rgb(0.169, 0.086, 0.125);
  const gold = rgb(0.78, 0.643, 0.392);
  const gray = rgb(0.42, 0.38, 0.4);
  const white = rgb(1, 1, 1);
  const lineColor = rgb(0.82, 0.78, 0.75);
  const ink = rgb(0.1, 0.1, 0.12);

  const marginX = 30;

  // Brand mark (same monogram used on certificates, drawn at its native
  // 32x32 unit size so its own coordinates don't need rescaling) + wordmark,
  // given its own clear column so neither collides with the other.
  page.drawSvgPath("M28 60 L28 28 L44 52 L60 28 L60 60", {
    x: marginX - 28,
    y: height,
    borderColor: wine,
    borderWidth: 3,
  });
  page.drawText("The VA Atelier", { x: marginX + 38, y: height - 40, size: 16, font: serif, color: wine });
  page.drawText("VA SERVICES & AGENT COMMISSION BILLING", { x: marginX + 38, y: height - 53, size: 7, font: sansBold, color: gold });

  const invLabel = `Invoice #: ${batch.invoiceNumber}`;
  const dateLabel = `Date: ${formatDate(batch.batchDate)}`;
  page.drawText(invLabel, { x: width - marginX - sansBold.widthOfTextAtSize(invLabel, 11), y: height - 32, size: 11, font: sansBold, color: ink });
  page.drawText(dateLabel, { x: width - marginX - sans.widthOfTextAtSize(dateLabel, 9), y: height - 48, size: 9, font: sans, color: gray });

  const title = "SERVICE INVOICE";
  page.drawText(title, { x: (width - sansBold.widthOfTextAtSize(title, 16)) / 2, y: height - 78, size: 16, font: sansBold, color: wine });

  let y = height - 100;
  page.drawText("BILLED TO: ", { x: marginX, y, size: 9.5, font: sansBold, color: ink });
  const billedLabelWidth = sansBold.widthOfTextAtSize("BILLED TO: ", 9.5);
  page.drawText(client.name.toUpperCase(), { x: marginX + billedLabelWidth, y, size: 9.5, font: sansBold, color: ink });
  const billedWidth = sansBold.widthOfTextAtSize(client.name.toUpperCase(), 9.5);
  page.drawLine({
    start: { x: marginX + billedLabelWidth, y: y - 2 },
    end: { x: marginX + billedLabelWidth + billedWidth, y: y - 2 },
    thickness: 0.75,
    color: ink,
  });
  y -= 12;
  page.drawText(`For: trucking services rendered to ${customer.name} (Billing Statement #${batch.bsNumber})`, {
    x: marginX,
    y,
    size: 8,
    font: sans,
    color: gray,
  });

  const tableTop = y - 20;
  const rowHeight = 15.5;
  let rowY = tableTop;
  const tableX = marginX;
  const tableWidth = drawTripTableHeader(page, tableX, rowY, TRIP_COLUMNS, sansBold, wine, white);
  rowY -= 16;

  const rate = client.commissionRatePerTrip;
  trips.forEach((t, idx) => {
    if (idx % 2 === 1) {
      page.drawRectangle({ x: tableX, y: rowY - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.97, 0.96, 0.95) });
    }
    drawRow(
      page,
      tableX,
      rowY,
      [
        String(idx + 1),
        formatDate(t.tripDate),
        t.plateNumber,
        t.driverName,
        [t.helper1Name, t.helper2Name].filter(Boolean).join(" "),
        t.routeFrom,
        t.routeTo,
        t.gatePassNumber,
        t.drSiNumber,
        t.waybillNumber,
        t.remarks,
      ],
      TRIP_COLUMNS,
      sans,
      ink,
      rowHeight
    );
    const amtText = peso(rate);
    const amtX = tableX + tableWidth + 90 - 3 - sans.widthOfTextAtSize(amtText, 7);
    page.drawText(amtText, { x: amtX, y: rowY - rowHeight + 5, size: 7, font: sans, color: ink });
    rowY -= rowHeight;
    page.drawLine({ start: { x: tableX, y: rowY }, end: { x: tableX + tableWidth + 90, y: rowY }, thickness: 0.4, color: lineColor });
  });

  page.drawRectangle({ x: tableX + tableWidth, y: tableTop - 16, width: 90, height: 16, color: wine });
  const amtHeader = "Commission";
  page.drawText(amtHeader, {
    x: tableX + tableWidth + 90 - 3 - sansBold.widthOfTextAtSize(amtHeader, 7),
    y: tableTop - 11,
    size: 7,
    font: sansBold,
    color: white,
  });

  page.drawRectangle({
    x: tableX,
    y: rowY,
    width: tableWidth + 90,
    height: tableTop - rowY,
    borderColor: lineColor,
    borderWidth: 0.75,
  });
  let vx = tableX;
  for (const col of TRIP_COLUMNS) {
    page.drawLine({ start: { x: vx, y: tableTop }, end: { x: vx, y: rowY }, thickness: 0.5, color: lineColor });
    vx += col.width;
  }
  page.drawLine({ start: { x: vx, y: tableTop }, end: { x: vx, y: rowY }, thickness: 0.5, color: lineColor });

  const totalsY = rowY - 18;
  page.drawText(`${trips.length} trip(s) x ${peso(rate)} flat commission per trip`, {
    x: marginX,
    y: totalsY,
    size: 8,
    font: sans,
    color: gray,
  });
  const totalDueLabel = "TOTAL DUE:";
  const totalsX = tableX + tableWidth + 90 - 3 - sansBold.widthOfTextAtSize(totalDueLabel + "   Php 000,000.00", 11);
  page.drawText(totalDueLabel, { x: totalsX, y: totalsY, size: 11, font: sansBold, color: wine });
  const totalText = `Php ${peso(batch.commissionTotal)}`;
  page.drawText(totalText, {
    x: tableX + tableWidth + 90 - 3 - sansBold.widthOfTextAtSize(totalText, 11),
    y: totalsY,
    size: 11,
    font: sansBold,
    color: wine,
  });

  const sigY = 52;
  page.drawText("Prepared by:", { x: marginX, y: sigY + 40, size: 8.5, font: sans, color: gray });
  page.drawLine({ start: { x: marginX, y: sigY + 10 }, end: { x: marginX + 180, y: sigY + 10 }, thickness: 0.75, color: gray });
  page.drawText("Reymar Gapud", { x: marginX, y: sigY - 4, size: 8.5, font: sansBold, color: ink });
  page.drawText("The VA Atelier", { x: marginX, y: sigY - 15, size: 7.5, font: sans, color: gray });

  const recX = marginX + 460;
  page.drawText("Received by:", { x: recX, y: sigY + 40, size: 8.5, font: sans, color: gray });
  page.drawLine({ start: { x: recX, y: sigY + 10 }, end: { x: recX + 180, y: sigY + 10 }, thickness: 0.75, color: gray });
  page.drawText("Signature over Printed Name", { x: recX, y: sigY - 4, size: 7.5, font: sans, color: gray });
  page.drawText(client.name, { x: recX, y: sigY - 15, size: 7.5, font: sans, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
