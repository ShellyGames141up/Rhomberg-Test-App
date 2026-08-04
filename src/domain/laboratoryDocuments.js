import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

export const LAB_DOCUMENT_KINDS = Object.freeze({
  REVIEW: 'calculation_review',
  DRAFT_CERTIFICATE: 'draft_certificate',
  UNSIGNED_CERTIFICATE: 'unsigned_certificate',
});

const PAGE = Object.freeze({ width: 595.28, height: 841.89, margin: 42 });
const COLOURS = Object.freeze({
  navy: rgb(0.025, 0.20, 0.28),
  cyan: rgb(0.05, 0.65, 0.72),
  pale: rgb(0.93, 0.97, 0.975),
  ink: rgb(0.08, 0.16, 0.20),
  muted: rgb(0.34, 0.45, 0.49),
  line: rgb(0.78, 0.86, 0.88),
  red: rgb(0.72, 0.11, 0.11),
  white: rgb(1, 1, 1),
});

const clean = value => String(value ?? '')
  .replaceAll('\u00b0', ' deg ')
  .replaceAll('\u2013', '-')
  .replaceAll('\u2014', '-')
  .replace(/[^\x20-\x7e]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const formatDate = value => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? clean(value) || 'Not recorded' : date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const wrap = (text, font, size, width) => {
  const words = clean(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not recorded'];
};

export async function generateLaboratoryPdf({ kind, order, unit, generatedAt, generatedBy }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const workflow = unit.labWork || {};
  const booking = workflow.booking || {};
  const calculation = workflow.calculation || {};
  const worksheet = workflow.worksheet || {};
  const internal = kind === LAB_DOCUMENT_KINDS.REVIEW;
  const draft = kind === LAB_DOCUMENT_KINDS.DRAFT_CERTIFICATE;
  const title = internal ? 'Laboratory Raw Data and Calculation Review' : 'Certificate of Calibration';
  const classification = internal ? 'INTERNAL - LABORATORY REVIEW' : draft ? 'DRAFT - NOT VALID' : 'FINAL UNSIGNED - SIGNATURE REQUIRED';
  pdf.setTitle(`${order.reference} ${title}`);
  pdf.setAuthor('Rhomberg Instruments');
  pdf.setSubject(classification);
  pdf.setCreationDate(new Date(generatedAt));

  let page;
  let y;
  const addPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    page.drawRectangle({ x: 0, y: PAGE.height - 88, width: PAGE.width, height: 88, color: COLOURS.navy });
    page.drawText('RHOMBERG', { x: PAGE.margin, y: PAGE.height - 45, font: bold, size: 21, color: COLOURS.white });
    page.drawText('INSTRUMENTS  |  CALIBRATION LABORATORY', { x: PAGE.margin, y: PAGE.height - 63, font: bold, size: 7.5, color: COLOURS.cyan });
    const classificationWidth = bold.widthOfTextAtSize(classification, 8);
    page.drawText(classification, { x: PAGE.width - PAGE.margin - classificationWidth, y: PAGE.height - 46, font: bold, size: 8, color: draft ? rgb(1, 0.7, 0.7) : COLOURS.white });
    y = PAGE.height - 116;
    if (draft) page.drawText('DRAFT', { x: 150, y: 360, font: bold, size: 76, rotate: degrees(35), color: rgb(0.91, 0.84, 0.84), opacity: 0.28 });
  };
  const ensure = height => { if (y - height < 65) addPage(); };
  const heading = value => {
    ensure(34);
    page.drawText(clean(value).toUpperCase(), { x: PAGE.margin, y, font: bold, size: 9, color: COLOURS.cyan });
    page.drawLine({ start: { x: PAGE.margin, y: y - 7 }, end: { x: PAGE.width - PAGE.margin, y: y - 7 }, thickness: 0.8, color: COLOURS.line });
    y -= 24;
  };
  const row = (label, value, options = {}) => {
    const lines = wrap(value, regular, 8.5, 335);
    ensure(Math.max(22, lines.length * 11 + 8));
    page.drawText(clean(label), { x: PAGE.margin, y, font: bold, size: 8.3, color: COLOURS.muted });
    lines.forEach((line, index) => page.drawText(line, { x: 185, y: y - (index * 11), font: options.bold ? bold : regular, size: 8.5, color: COLOURS.ink }));
    y -= Math.max(22, lines.length * 11 + 7);
  };
  const table = (headers, rows, widths) => {
    const total = widths.reduce((sum, width) => sum + width, 0);
    const scale = (PAGE.width - (PAGE.margin * 2)) / total;
    const columnWidths = widths.map(width => width * scale);
    const drawLine = (values, isHeader = false) => {
      ensure(24);
      let x = PAGE.margin;
      page.drawRectangle({ x, y: y - 16, width: PAGE.width - (PAGE.margin * 2), height: 22, color: isHeader ? COLOURS.navy : COLOURS.pale, borderColor: COLOURS.line, borderWidth: 0.5 });
      values.forEach((value, index) => {
        page.drawText(clean(value).slice(0, 30), { x: x + 4, y: y - 8, font: isHeader ? bold : regular, size: 7.2, color: isHeader ? COLOURS.white : COLOURS.ink });
        x += columnWidths[index];
        if (index < values.length - 1) page.drawLine({ start: { x, y: y + 6 }, end: { x, y: y - 16 }, thickness: 0.5, color: COLOURS.line });
      });
      y -= 22;
    };
    drawLine(headers, true);
    rows.forEach(values => drawLine(values));
    y -= 8;
  };

  addPage();
  page.drawText(title, { x: PAGE.margin, y, font: bold, size: 17, color: COLOURS.navy });
  y -= 31;
  heading('Controlled references');
  row('Order reference', order.reference);
  row('Laboratory job number', unit.jobNumber || booking.jobNumber || 'Not assigned');
  row('Certificate number', unit.certificateNumber || booking.certificateNumber || 'Not assigned');
  row('Unit', `${unit.productName || unit.productCode} - physical unit ${unit.unitNumber}`);
  row('Customer', order.company);
  row('Method and version', `${worksheet.methodId || booking.methodId || 'Not selected'} / ${calculation.methodVersion || 'Not calculated'}`);
  row('Generated', `${formatDate(generatedAt)} by ${generatedBy}`);

  heading('Instrument details');
  row('Description', booking.instrumentDescription || unit.productName);
  row('Manufacturer / model', `${booking.manufacturer || 'Not recorded'} / ${booking.model || 'Not recorded'}`);
  row('Serial number', booking.serialNumber || unit.serialNumber || 'Not recorded');
  row('Range / resolution', `${booking.rangeMinimum ?? ''} to ${booking.rangeMaximum ?? ''} ${booking.unit || ''}; resolution ${booking.resolution ?? 'Not recorded'}`);
  row('Calibration location', workflow.branchId || order.laboratory?.branchId || 'Not assigned');

  heading('Measurement results');
  const resultRows = (calculation.points || []).map(point => [
    point.direction || 'temperature',
    point.applied,
    point.mean,
    point.indicationError,
    point.correction,
  ]);
  table(['Direction', 'Applied', 'Mean', 'Error', 'Correction'], resultRows.length ? resultRows : [['-', '-', '-', '-', '-']], [1.2, 1, 1, 1, 1]);
  row('Expanded uncertainty', calculation.uncertainty?.expandedUncertainty ?? 'Not calculated', { bold: true });
  row('Coverage factor', calculation.uncertainty?.coverageFactor ?? 'Not calculated');
  row('Technical validation', calculation.certificateApprovalBlocked ? 'FORMAL METHOD APPROVAL REQUIRED' : 'Approved method version recorded');

  if (internal) {
    heading('Raw readings');
    (worksheet.testPoints || []).forEach((point, index) => row(`Point ${index + 1}`, `Applied ${point.applied}; readings ${(point.readings || []).join(', ')}`));
    heading('Uncertainty budget');
    table(
      ['Source', 'Type', 'Std uncertainty', 'Sensitivity', 'Contribution'],
      (calculation.uncertainty?.contributions || []).map(item => [item.source || '-', item.type || item.distribution || '-', item.standardUncertainty, item.sensitivity, item.contribution]),
      [1.8, 1, 1.2, 1, 1.2],
    );
    heading('Validation and audit summary');
    (calculation.warnings || ['No calculation run recorded.']).forEach((warning, index) => row(`Warning ${index + 1}`, warning));
    row('Reference standards', (worksheet.standardIds || []).join(', ') || 'Not recorded');
    row('Technician', unit.updatedBy?.contact || unit.updatedBy?.name || 'Not recorded');
    row('Internal note', unit.internalNote || 'None recorded');
  } else {
    heading('Traceability and statement');
    row('Reference standards', (worksheet.standardIds || []).join(', ') || 'To be confirmed before approval');
    row('Calibration date', formatDate(unit.completedAt || generatedAt));
    row('Certificate issue / revision', unit.certificateWorkflow?.issue || 'Issue 1');
    row('Authorised signatory', unit.certificateWorkflow?.signatoryName || 'Signature pending');
    row('Statement', 'Results relate only to the instrument identified above. Certificate wording and uncertainty remain subject to the approved Rhomberg method and authorised signatory review.');
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: PAGE.margin, y: 48 }, end: { x: PAGE.width - PAGE.margin, y: 48 }, thickness: 0.6, color: COLOURS.line });
    currentPage.drawText(`Page ${index + 1} of ${pages.length}`, { x: PAGE.width - PAGE.margin - 62, y: 31, font: regular, size: 7.5, color: COLOURS.muted });
    currentPage.drawText(classification, { x: PAGE.margin, y: 31, font: bold, size: 7.5, color: draft ? COLOURS.red : COLOURS.muted });
  });

  const bytes = await pdf.save();
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
