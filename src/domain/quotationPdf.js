const LATIN1 = new TextDecoder('latin1');

const decodeLiteral = value => String(value || '')
  .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)))
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t')
  .replace(/\\b/g, '\b')
  .replace(/\\f/g, '\f')
  .replace(/\\([()\\])/g, '$1');

const normaliseLabel = value => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const numberValue = value => {
  const cleaned = String(value || '').replace(/[^\d.,-]/g, '').replaceAll(',', '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const dateOnly = value => {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const extractPlacements = content => {
  const placements = [];
  const expression = /BT\b[\s\S]*?(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td\s+\(((?:\\.|[^\\)])*)\)\s+Tj[\s\S]*?ET/g;
  for (const match of String(content || '').matchAll(expression)) {
    placements.push({
      x: Number(match[1]),
      y: Number(match[2]),
      text: decodeLiteral(match[3]).replace(/\s+/g, ' ').trim(),
    });
  }
  return placements.filter(item => item.text);
};

const inflate = async bytes => {
  if (typeof DecompressionStream !== 'function') throw new Error('PDF decompression is unavailable in this browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const extractPdfTextPlacements = async arrayBuffer => {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const source = LATIN1.decode(bytes);
  const placements = [];
  let cursor = 0;
  while (cursor < source.length) {
    const marker = source.indexOf('stream', cursor);
    if (marker < 0) break;
    const lineEnd = source.indexOf('\n', marker);
    if (lineEnd < 0) break;
    const streamStart = lineEnd + 1;
    const end = source.indexOf('endstream', streamStart);
    if (end < 0) break;
    const headerStart = Math.max(0, source.lastIndexOf('obj', marker) - 50);
    const header = source.slice(headerStart, marker);
    let streamEnd = end;
    while (streamEnd > streamStart && (bytes[streamEnd - 1] === 10 || bytes[streamEnd - 1] === 13)) streamEnd -= 1;
    let streamBytes = bytes.slice(streamStart, streamEnd);
    try {
      if (/\/FlateDecode\b/.test(header)) streamBytes = await inflate(streamBytes);
      const content = LATIN1.decode(streamBytes);
      if (/\bBT\b/.test(content) && /\bTj\b/.test(content)) placements.push(...extractPlacements(content));
    } catch {
      // Image streams and unsupported filters are intentionally ignored.
    }
    cursor = end + 9;
  }
  if (!placements.length) placements.push(...extractPlacements(source));
  return placements;
};

const valueOnSameLine = (placements, labels, { rightOf = true, tolerance = 2.5 } = {}) => {
  const label = placements.find(item => labels.includes(normaliseLabel(item.text)));
  if (!label) return '';
  const matches = placements
    .filter(item => item !== label && Math.abs(item.y - label.y) <= tolerance)
    .filter(item => !rightOf || item.x > label.x)
    .sort((left, right) => Math.abs(left.y - label.y) - Math.abs(right.y - label.y) || left.x - right.x);
  return matches[0]?.text || '';
};

export const extractQuotationDetailsFromPlacements = placements => {
  const quoteNumber = valueOnSameLine(placements, ['QUOTE NUMBER:', 'QUOTE NUMBER'])
    || valueOnSameLine(placements, ['QUOTE:', 'QUOTE']);
  const quotationDateText = valueOnSameLine(placements, ['DATE:', 'DATE']);
  const expiryDateText = valueOnSameLine(placements, ['EXPIRY:', 'EXPIRY']);
  const subtotalText = valueOnSameLine(placements, ['SUBTOTAL']);
  const vatText = valueOnSameLine(placements, ['TOTAL VAT']);
  const totalText = valueOnSameLine(placements, ['TOTAL ZAR']);
  const commercialTotal = numberValue(totalText);
  const fieldsRead = [quoteNumber, quotationDateText, totalText].filter(Boolean).length;
  return {
    quoteNumber: String(quoteNumber || '').replace(/^ZAR\s*/i, '').trim(),
    quotationDate: dateOnly(quotationDateText),
    expiryDate: dateOnly(expiryDateText),
    subtotal: numberValue(subtotalText),
    vatTotal: numberValue(vatText),
    commercialTotal,
    currency: 'ZAR',
    extractionStatus: fieldsRead === 3 && commercialTotal > 0 ? 'verified_fields_found' : 'review_required',
    extractionConfidence: fieldsRead === 3 && commercialTotal > 0 ? 'high' : fieldsRead >= 2 ? 'medium' : 'low',
  };
};

export const readRhombergQuotationPdf = async file => {
  if (!file || !/\.pdf$/i.test(file.name || '') || file.type && file.type !== 'application/pdf') {
    throw new Error('Choose a Rhomberg quotation PDF.');
  }
  const details = extractQuotationDetailsFromPlacements(await extractPdfTextPlacements(await file.arrayBuffer()));
  if (!details.commercialTotal || details.commercialTotal <= 0) {
    throw new Error('The TOTAL ZAR value could not be read. Enter and verify the quotation total manually.');
  }
  return details;
};
