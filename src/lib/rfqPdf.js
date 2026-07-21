import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE = { width: 595.28, height: 841.89, margin: 42, footer: 40 };
const COLORS = {
  navy: rgb(0.025, 0.235, 0.325),
  blue: rgb(0.025, 0.42, 0.61),
  cyan: rgb(0.02, 0.68, 0.74),
  pale: rgb(0.93, 0.97, 0.98),
  lightBlue: rgb(0.9, 0.96, 0.98),
  line: rgb(0.78, 0.85, 0.88),
  ink: rgb(0.05, 0.16, 0.21),
  muted: rgb(0.32, 0.43, 0.47),
  white: rgb(1, 1, 1),
  amber: rgb(0.96, 0.67, 0.12),
  amberPale: rgb(1, 0.96, 0.84),
  green: rgb(0.09, 0.49, 0.38),
  greenPale: rgb(0.9, 0.97, 0.94),
  red: rgb(0.72, 0.19, 0.19),
};

const safeText = value => String(value ?? '')
  .replace(/\u00b0/g, ' deg ')
  .replace(/[\u2010-\u2015]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u2022/g, '-')
  .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const humanise = key => safeText(key)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, character => character.toUpperCase());

const formatValue = value => {
  if (Array.isArray(value)) return value.map(safeText).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return safeText(value);
};

const formatMoney = (value, currency = 'ZAR') => {
  if (!Number.isFinite(Number(value))) return 'Rep review';
  return `${currency === 'ZAR' ? 'R' : `${currency} `}${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function wrapText(text, font, size, maxWidth) {
  const cleanText = safeText(text);
  if (!cleanText) return ['-'];
  const words = cleanText.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let fragment = '';
    for (const character of word) {
      if (font.widthOfTextAtSize(fragment + character, size) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else fragment += character;
    }
    line = fragment;
  }
  if (line) lines.push(line);
  return lines;
}

function drawGaugeMark(page, x, y, fonts) {
  page.drawCircle({ x, y, size: 22, color: COLORS.navy, borderColor: COLORS.cyan, borderWidth: 2 });
  for (let index = 0; index < 7; index += 1) {
    const angle = Math.PI * (0.12 + (0.76 * index) / 6);
    const start = { x: x - Math.cos(angle) * 15, y: y + Math.sin(angle) * 15 };
    const end = { x: x - Math.cos(angle) * 18, y: y + Math.sin(angle) * 18 };
    page.drawLine({ start, end, thickness: 1, color: COLORS.white, opacity: 0.85 });
  }
  page.drawLine({ start: { x, y }, end: { x: x + 10, y: y + 9 }, thickness: 1.8, color: COLORS.amber });
  page.drawCircle({ x, y, size: 2.2, color: COLORS.white });
  page.drawText('R', { x: x - 4.5, y: y - 15, size: 7.5, font: fonts.bold, color: COLORS.white });
}

function drawPageHeader(state, label) {
  const { page, fonts } = state;
  page.drawRectangle({ x: 0, y: PAGE.height - 78, width: PAGE.width, height: 78, color: COLORS.navy });
  page.drawRectangle({ x: 0, y: PAGE.height - 82, width: PAGE.width, height: 4, color: COLORS.cyan });
  drawGaugeMark(page, PAGE.margin + 22, PAGE.height - 38, fonts);
  page.drawText('RHOMBERG', { x: PAGE.margin + 55, y: PAGE.height - 34, size: 17, font: fonts.bold, color: COLORS.white, characterSpacing: 0.6 });
  page.drawText('INSTRUMENTS', { x: PAGE.margin + 56, y: PAGE.height - 50, size: 8, font: fonts.regular, color: COLORS.cyan, characterSpacing: 2.1 });
  const labelWidth = fonts.bold.widthOfTextAtSize(label, 8);
  page.drawRectangle({ x: PAGE.width - PAGE.margin - labelWidth - 18, y: PAGE.height - 48, width: labelWidth + 18, height: 23, color: COLORS.blue, borderColor: COLORS.cyan, borderWidth: 0.8 });
  page.drawText(label, { x: PAGE.width - PAGE.margin - labelWidth - 9, y: PAGE.height - 40.5, size: 8, font: fonts.bold, color: COLORS.white });
  state.y = PAGE.height - 104;
}

function addPage(state, label) {
  state.page = state.document.addPage([PAGE.width, PAGE.height]);
  state.pages.push(state.page);
  drawPageHeader(state, label);
}

function ensureSpace(state, height, label) {
  if (state.y - height < PAGE.footer + 15) addPage(state, label);
}

function drawLines(state, text, options = {}) {
  const {
    x = PAGE.margin,
    width = PAGE.width - PAGE.margin * 2,
    size = 9,
    font = state.fonts.regular,
    color = COLORS.ink,
    lineHeight = size * 1.35,
    maxLines,
  } = options;
  let lines = wrapText(text, font, size, width);
  if (maxLines && lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, -3)}...`];
  for (const line of lines) {
    state.page.drawText(line, { x, y: state.y, size, font, color });
    state.y -= lineHeight;
  }
  return lines.length * lineHeight;
}

function drawSectionTitle(state, eyebrow, title, label) {
  ensureSpace(state, 52, label);
  state.page.drawText(safeText(eyebrow).toUpperCase(), { x: PAGE.margin, y: state.y, size: 7.5, font: state.fonts.bold, color: COLORS.blue, characterSpacing: 1.2 });
  state.y -= 18;
  state.page.drawText(safeText(title), { x: PAGE.margin, y: state.y, size: 16, font: state.fonts.bold, color: COLORS.navy });
  state.y -= 10;
  state.page.drawLine({ start: { x: PAGE.margin, y: state.y }, end: { x: PAGE.width - PAGE.margin, y: state.y }, thickness: 1, color: COLORS.line });
  state.y -= 17;
}

function drawInfoGrid(state, rows, label) {
  const gap = 12;
  const columnWidth = (PAGE.width - PAGE.margin * 2 - gap) / 2;
  for (let index = 0; index < rows.length; index += 2) {
    const pair = [rows[index], rows[index + 1]].filter(Boolean);
    const heights = pair.map(([, value]) => wrapText(value || '-', state.fonts.regular, 8.7, columnWidth - 22).length * 11.7 + 30);
    const height = Math.max(52, ...heights);
    ensureSpace(state, height + 8, label);
    pair.forEach(([key, value], pairIndex) => {
      const x = PAGE.margin + pairIndex * (columnWidth + gap);
      state.page.drawRectangle({ x, y: state.y - height + 10, width: columnWidth, height, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
      state.page.drawText(safeText(key).toUpperCase(), { x: x + 11, y: state.y - 8, size: 6.7, font: state.fonts.bold, color: COLORS.blue, characterSpacing: 0.8 });
      const previousY = state.y;
      state.y -= 24;
      drawLines(state, value || '-', { x: x + 11, width: columnWidth - 22, size: 8.7, lineHeight: 11.7 });
      state.y = previousY;
    });
    state.y -= height + 8;
  }
}

function drawParagraphCard(state, title, text, tone, label) {
  const background = tone === 'amber' ? COLORS.amberPale : tone === 'green' ? COLORS.greenPale : COLORS.lightBlue;
  const accent = tone === 'amber' ? COLORS.amber : tone === 'green' ? COLORS.green : COLORS.cyan;
  const lines = wrapText(text || '-', state.fonts.regular, 8.8, PAGE.width - PAGE.margin * 2 - 28);
  const height = 34 + lines.length * 12;
  ensureSpace(state, height + 7, label);
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - height + 8, width: PAGE.width - PAGE.margin * 2, height, color: background, borderColor: accent, borderWidth: 0.8 });
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - height + 8, width: 4, height, color: accent });
  state.page.drawText(safeText(title).toUpperCase(), { x: PAGE.margin + 14, y: state.y - 10, size: 7, font: state.fonts.bold, color: COLORS.navy, characterSpacing: 0.9 });
  state.y -= 27;
  drawLines(state, text || '-', { x: PAGE.margin + 14, width: PAGE.width - PAGE.margin * 2 - 28, size: 8.8, lineHeight: 12 });
  state.y -= 12;
}

function drawConfiguration(state, configuration, label) {
  const entries = Object.entries(configuration || {})
    .filter(([, value]) => value !== '' && value !== false && value !== undefined && (!Array.isArray(value) || value.length));
  if (!entries.length) {
    drawParagraphCard(state, 'Configuration', 'No model-specific selections supplied.', 'blue', label);
    return;
  }
  entries.forEach(([key, value], entryIndex) => {
    const keyWidth = 154;
    const valueWidth = PAGE.width - PAGE.margin * 2 - keyWidth - 20;
    const lines = wrapText(formatValue(value), state.fonts.regular, 8.4, valueWidth);
    const height = Math.max(26, lines.length * 11 + 13);
    ensureSpace(state, height, label);
    state.page.drawRectangle({ x: PAGE.margin, y: state.y - height + 5, width: PAGE.width - PAGE.margin * 2, height, color: entryIndex % 2 ? COLORS.white : COLORS.pale });
    state.page.drawText(humanise(key), { x: PAGE.margin + 8, y: state.y - 11, size: 7.8, font: state.fonts.bold, color: COLORS.muted });
    const startY = state.y - 11;
    lines.forEach((line, index) => state.page.drawText(line, { x: PAGE.margin + keyWidth, y: startY - index * 11, size: 8.4, font: state.fonts.regular, color: COLORS.ink }));
    state.y -= height;
  });
  state.y -= 6;
}

function drawPricingPanel(state, linePricing, currency, label) {
  if (!linePricing) return;
  const knownRows = [];
  if (linePricing.base) knownRows.push(['Base instrument', linePricing.base.description, linePricing.base.unitPrice]);
  for (const extra of linePricing.extras || []) knownRows.push(['Option', extra.description, extra.total]);
  const height = 45 + Math.max(1, knownRows.length) * 25 + (linePricing.manualReview?.length || 0) * 25 + 42;
  ensureSpace(state, Math.min(height, 240), label);
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - 24, width: PAGE.width - PAGE.margin * 2, height: 24, color: COLORS.navy });
  state.page.drawText('INTERNAL PRICE REFERENCE', { x: PAGE.margin + 10, y: state.y - 16, size: 7.2, font: state.fonts.bold, color: COLORS.white, characterSpacing: 0.8 });
  state.page.drawText(linePricing.status === 'estimated' ? 'MATCHED' : linePricing.status === 'partial' ? 'PARTIAL - VERIFY' : 'REP REVIEW', { x: PAGE.width - PAGE.margin - 95, y: state.y - 16, size: 7.2, font: state.fonts.bold, color: linePricing.status === 'estimated' ? COLORS.cyan : COLORS.amber });
  state.y -= 32;
  if (!knownRows.length) {
    drawLines(state, 'No reliable automatic price match. The representative must price this line manually.', { x: PAGE.margin + 8, width: PAGE.width - PAGE.margin * 2 - 16, size: 8.5, color: COLORS.red });
    state.y -= 7;
  } else {
    for (const [type, description, amount] of knownRows) {
      const lines = wrapText(description, state.fonts.regular, 7.8, 330);
      const rowHeight = Math.max(23, lines.length * 10 + 9);
      ensureSpace(state, rowHeight, label);
      state.page.drawText(type, { x: PAGE.margin + 8, y: state.y - 11, size: 7, font: state.fonts.bold, color: COLORS.blue });
      lines.forEach((line, index) => state.page.drawText(line, { x: PAGE.margin + 82, y: state.y - 11 - index * 10, size: 7.8, font: state.fonts.regular, color: COLORS.ink }));
      const amountText = formatMoney(amount, currency);
      state.page.drawText(amountText, { x: PAGE.width - PAGE.margin - state.fonts.bold.widthOfTextAtSize(amountText, 8), y: state.y - 11, size: 8, font: state.fonts.bold, color: COLORS.navy });
      state.y -= rowHeight;
      state.page.drawLine({ start: { x: PAGE.margin + 8, y: state.y + 3 }, end: { x: PAGE.width - PAGE.margin - 8, y: state.y + 3 }, thickness: 0.45, color: COLORS.line });
    }
  }
  if (linePricing.manualReview?.length) {
    state.y -= 4;
    for (const note of linePricing.manualReview) {
      const noteLines = wrapText(`Rep action: ${note}`, state.fonts.regular, 7.7, PAGE.width - PAGE.margin * 2 - 24);
      const noteHeight = noteLines.length * 10.5 + 8;
      ensureSpace(state, noteHeight, label);
      noteLines.forEach((line, index) => state.page.drawText(line, { x: PAGE.margin + 12, y: state.y - 9 - index * 10.5, size: 7.7, font: state.fonts.regular, color: COLORS.red }));
      state.y -= noteHeight;
    }
  }
  if (linePricing.unitEstimate !== null) {
    state.y -= 3;
    const totalText = `${formatMoney(linePricing.unitEstimate, currency)} each  x  ${linePricing.quantity}  =  ${formatMoney(linePricing.extendedEstimate, currency)}`;
    state.page.drawRectangle({ x: PAGE.margin, y: state.y - 25, width: PAGE.width - PAGE.margin * 2, height: 25, color: COLORS.greenPale });
    state.page.drawText('KNOWN CATALOGUE ESTIMATE', { x: PAGE.margin + 10, y: state.y - 17, size: 7.3, font: state.fonts.bold, color: COLORS.green });
    state.page.drawText(totalText, { x: PAGE.width - PAGE.margin - state.fonts.bold.widthOfTextAtSize(totalText, 8.3) - 10, y: state.y - 17, size: 8.3, font: state.fonts.bold, color: COLORS.navy });
    state.y -= 34;
  }
  state.y -= 8;
}

function drawUnit(state, item, index, linePricing, currency, label) {
  ensureSpace(state, 82, label);
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - 43, width: PAGE.width - PAGE.margin * 2, height: 43, color: COLORS.lightBlue, borderColor: COLORS.cyan, borderWidth: 0.8 });
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - 43, width: 38, height: 43, color: COLORS.blue });
  state.page.drawText(String(index + 1).padStart(2, '0'), { x: PAGE.margin + 10, y: state.y - 28, size: 13, font: state.fonts.bold, color: COLORS.white });
  state.page.drawText(safeText(`${item.code} - ${item.name}`), { x: PAGE.margin + 50, y: state.y - 18, size: 10.5, font: state.fonts.bold, color: COLORS.navy });
  state.page.drawText(`Quantity: ${item.quantity}`, { x: PAGE.margin + 50, y: state.y - 33, size: 8, font: state.fonts.bold, color: COLORS.blue });
  state.y -= 55;
  drawConfiguration(state, item.configuration, label);
  if (linePricing) drawPricingPanel(state, linePricing, currency, label);
  state.y -= 6;
}

function drawPricingSummary(state, pricing, label) {
  drawSectionTitle(state, 'Representative pricing', 'Internal estimate summary', label);
  const currency = pricing.currency || 'ZAR';
  const subtotal = formatMoney(pricing.knownSubtotal, currency);
  ensureSpace(state, 80, label);
  state.page.drawRectangle({ x: PAGE.margin, y: state.y - 66, width: PAGE.width - PAGE.margin * 2, height: 66, color: COLORS.navy });
  state.page.drawText('KNOWN CATALOGUE SUBTOTAL', { x: PAGE.margin + 16, y: state.y - 23, size: 8, font: state.fonts.bold, color: COLORS.cyan, characterSpacing: 0.8 });
  state.page.drawText(subtotal, { x: PAGE.margin + 16, y: state.y - 50, size: 22, font: state.fonts.bold, color: COLORS.white });
  const review = pricing.unpricedLineCount ? `${pricing.unpricedLineCount} unpriced unit line(s)` : 'All base unit lines matched';
  state.page.drawText(review, { x: PAGE.width - PAGE.margin - state.fonts.regular.widthOfTextAtSize(review, 8) - 16, y: state.y - 40, size: 8, font: state.fonts.regular, color: COLORS.white });
  state.y -= 79;
  drawParagraphCard(state, 'Price source', `${pricing.sourceLabel}. ${pricing.priceBasis}.`, 'blue', label);
  for (const item of pricing.manualItems || []) drawParagraphCard(state, 'Representative action', item, 'amber', label);
  drawParagraphCard(state, 'Important', pricing.disclaimer, 'amber', label);
}

export async function buildRfqPdf(enquiry, options = {}) {
  const pricing = options.pricing || null;
  const label = pricing ? 'REP-ONLY PRICED RFQ' : 'RFQ SUBMISSION';
  const document = await PDFDocument.create();
  document.setTitle(`Rhomberg RFQ ${safeText(enquiry.reference)}`);
  document.setAuthor('Rhomberg Instruments');
  document.setSubject('Request for quotation');
  document.setCreator('Rhomberg Instruments Mobile App');
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    italic: await document.embedFont(StandardFonts.HelveticaOblique),
  };
  const state = { document, fonts, pages: [], page: null, y: 0 };
  addPage(state, label);

  state.page.drawText('REQUEST FOR QUOTATION', { x: PAGE.margin, y: state.y, size: 21, font: fonts.bold, color: COLORS.navy });
  state.y -= 22;
  state.page.drawText(`Reference ${safeText(enquiry.reference)}`, { x: PAGE.margin, y: state.y, size: 10, font: fonts.bold, color: COLORS.blue });
  const submitted = new Date(enquiry.createdAt || Date.now()).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  state.page.drawText(safeText(submitted), { x: PAGE.width - PAGE.margin - fonts.regular.widthOfTextAtSize(safeText(submitted), 8.5), y: state.y, size: 8.5, font: fonts.regular, color: COLORS.muted });
  state.y -= 25;

  drawParagraphCard(state, pricing ? 'Internal use' : 'Submission copy', pricing
    ? 'Pricing appears only in this representative copy. It is an internal estimate and is not a customer quotation.'
    : 'This structured RFQ records the customer requirements. Pricing is intentionally excluded from the customer-facing submission.', pricing ? 'amber' : 'blue', label);

  drawSectionTitle(state, '01 - Customer', 'Client and company details', label);
  drawInfoGrid(state, [
    ['Company', enquiry.company], ['Contact person', enquiry.contact],
    ['Email', enquiry.email], ['Telephone', enquiry.phone],
    ['Area', enquiry.area], ['Selected representative', enquiry.selectedRep?.name || 'Not selected'],
    ['Representative branch', enquiry.selectedRep?.branchName || 'Not assigned'], ['RFQ reference', enquiry.reference],
  ], label);

  drawSectionTitle(state, '02 - Requirement', 'Application and fulfilment', label);
  drawParagraphCard(state, 'Application', enquiry.application, 'blue', label);
  drawInfoGrid(state, [
    ['Process medium', enquiry.medium || 'Not supplied'],
    ['Emergency', enquiry.emergency === 'yes' ? 'YES - fee and feasibility to be determined by the representative' : 'No'],
    ['Fulfilment', enquiry.fulfilment === 'collect' ? `Collect - ${enquiry.collectionBranch}` : `Deliver - ${enquiry.deliveryAddress}`],
    ['Purchase order', enquiry.poNumber || enquiry.poFileName || 'Not supplied'],
  ], label);
  if (enquiry.notes) drawParagraphCard(state, 'Additional notes', enquiry.notes, 'blue', label);

  drawSectionTitle(state, '03 - Units', `${(enquiry.items || []).length} configured product line${(enquiry.items || []).length === 1 ? '' : 's'}`, label);
  (enquiry.items || []).forEach((item, index) => {
    const linePricing = pricing?.lines?.find(line => line.lineId === item.lineId) || pricing?.lines?.[index] || null;
    drawUnit(state, item, index, linePricing, pricing?.currency || 'ZAR', label);
  });

  if (pricing) drawPricingSummary(state, pricing, label);
  else drawParagraphCard(state, 'Representative note', 'Review every configured option against the application before preparing the quotation.', 'amber', label);

  const totalPages = state.pages.length;
  state.pages.forEach((page, index) => {
    page.drawLine({ start: { x: PAGE.margin, y: 29 }, end: { x: PAGE.width - PAGE.margin, y: 29 }, thickness: 0.6, color: COLORS.line });
    page.drawText(pricing ? 'CONFIDENTIAL INTERNAL PRICING - NOT A QUOTATION' : 'RHOMBERG RFQ SUBMISSION', { x: PAGE.margin, y: 16, size: 6.4, font: fonts.bold, color: pricing ? COLORS.red : COLORS.muted, characterSpacing: 0.5 });
    const pageText = `Page ${index + 1} of ${totalPages}`;
    page.drawText(pageText, { x: PAGE.width - PAGE.margin - fonts.regular.widthOfTextAtSize(pageText, 6.8), y: 16, size: 6.8, font: fonts.regular, color: COLORS.muted });
  });

  return document.save();
}

export function rfqPdfFilename(enquiry, priced = false) {
  const reference = safeText(enquiry.reference || 'RFQ').replace(/[^a-z0-9-]+/gi, '-');
  return `${reference}-${priced ? 'REP-PRICED-' : ''}RFQ.pdf`;
}
