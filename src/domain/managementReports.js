import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatDurationDaysHours } from './salesAnalytics.js';

export const MANAGEMENT_REPORT_SECTIONS = Object.freeze([
  Object.freeze({ id: 'executive_summary', label: 'Executive summary' }),
  Object.freeze({ id: 'quotation_values', label: 'Quotation and converted-order values' }),
  Object.freeze({ id: 'conversion_performance', label: 'Quote-to-order and quote-loss ratios' }),
  Object.freeze({ id: 'overdue_promises', label: 'Orders overdue against delay promise dates' }),
  Object.freeze({ id: 'client_growth', label: 'New-client growth' }),
  Object.freeze({ id: 'stage_times', label: 'Average stage times' }),
  Object.freeze({ id: 'quantity_demand', label: 'Quantity-based demand' }),
  Object.freeze({ id: 'representative_branch', label: 'Representative and branch performance' }),
  Object.freeze({ id: 'operational_records', label: 'Authorised operational records' }),
]);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const NAVY = rgb(0.025, 0.20, 0.28);
const CYAN = rgb(0.05, 0.65, 0.72);
const PALE = rgb(0.93, 0.97, 0.975);
const INK = rgb(0.08, 0.16, 0.20);
const MUTED = rgb(0.34, 0.45, 0.49);
const LINE = rgb(0.78, 0.86, 0.88);
const WHITE = rgb(1, 1, 1);
const WARNING = rgb(0.78, 0.25, 0.12);

const cleanText = value => String(value ?? '')
  .replaceAll('\u00a0', ' ')
  .replaceAll('\u2013', '-')
  .replaceAll('\u2014', '-')
  .replaceAll('\u2022', '-')
  .replace(/[^\x20-\x7e]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const money = value => `ZAR ${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = value => `${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
const humanise = value => cleanText(value).replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const dateLabel = value => {
  const date = new Date(String(value || '').length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? cleanText(value) || 'Not recorded' : date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const wrapText = (text, font, size, width) => {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
};

export const validateManagementReportOptions = (input = {}) => {
  const allowed = new Set(MANAGEMENT_REPORT_SECTIONS.map(section => section.id));
  const sections = [...new Set(Array.isArray(input.sections) ? input.sections.filter(section => allowed.has(section)) : [])];
  if (!sections.length) throw new Error('Select at least one report section.');
  const representativeId = String(input.representativeId || 'all');
  const branchId = String(input.branchId || 'all');
  return {
    periodMode: input.periodMode === 'date_range' ? 'date_range' : 'rolling_months',
    rollingMonths: Math.min(60, Math.max(1, Number(input.rollingMonths) || 12)),
    startDate: String(input.startDate || ''),
    endDate: String(input.endDate || ''),
    representativeId,
    branchId,
    sections,
  };
};

export async function generateManagementPdfReport({ dashboard, options, generatedAt, generatedBy, roleLabel }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rhomberg management report - ${dashboard.salesPerformance?.period?.label || generatedAt.slice(0, 10)}`);
  pdf.setAuthor('Rhomberg Instruments');
  pdf.setSubject('Restricted management performance report');
  pdf.setKeywords(['Rhomberg', 'management', 'sales performance', 'internal']);
  pdf.setCreationDate(new Date(generatedAt));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page;
  let y;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 92, width: PAGE_WIDTH, height: 92, color: NAVY });
    page.drawText('RHOMBERG', { x: MARGIN, y: PAGE_HEIGHT - 48, font: bold, size: 20, color: WHITE });
    page.drawText('INSTRUMENTS', { x: MARGIN, y: PAGE_HEIGHT - 65, font: bold, size: 8, color: CYAN });
    const classification = 'RESTRICTED MANAGEMENT REPORT';
    page.drawText(classification, { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(classification, 8), y: PAGE_HEIGHT - 48, font: bold, size: 8, color: WHITE });
    page.drawText(cleanText(roleLabel), { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(cleanText(roleLabel), 8), y: PAGE_HEIGHT - 64, font: regular, size: 8, color: rgb(0.72, 0.86, 0.88) });
    y = PAGE_HEIGHT - 120;
  };

  const ensure = height => {
    if (y - height < 65) addPage();
  };

  const heading = title => {
    ensure(38);
    page.drawText(cleanText(title).toUpperCase(), { x: MARGIN, y, font: bold, size: 9, color: CYAN });
    page.drawLine({ start: { x: MARGIN, y: y - 7 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 7 }, thickness: 0.8, color: LINE });
    y -= 25;
  };

  const paragraph = (text, { boldText = false, color = INK } = {}) => {
    const font = boldText ? bold : regular;
    const lines = wrapText(text, font, 9, PAGE_WIDTH - MARGIN * 2);
    ensure(lines.length * 13 + 5);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, font, size: 9, color });
      y -= 13;
    }
    y -= 4;
  };

  const metrics = items => {
    for (let index = 0; index < items.length; index += 3) {
      const row = items.slice(index, index + 3);
      ensure(68);
      row.forEach((item, column) => {
        const x = MARGIN + column * 170;
        page.drawRectangle({ x, y: y - 50, width: 157, height: 58, color: PALE });
        page.drawText(cleanText(item.value), { x: x + 9, y: y - 18, font: bold, size: 15, color: NAVY });
        wrapText(item.label, regular, 7.5, 138).slice(0, 2).forEach((line, lineIndex) => page.drawText(line, { x: x + 9, y: y - 34 - lineIndex * 9, font: regular, size: 7.5, color: MUTED }));
      });
      y -= 70;
    }
  };

  const table = (headers, rows, widths) => {
    const totalWidth = widths.reduce((sum, value) => sum + value, 0);
    const drawHeader = () => {
      ensure(26);
      page.drawRectangle({ x: MARGIN, y: y - 18, width: totalWidth, height: 23, color: NAVY });
      let x = MARGIN;
      headers.forEach((header, index) => {
        page.drawText(cleanText(header), { x: x + 5, y: y - 10, font: bold, size: 7, color: WHITE });
        x += widths[index];
      });
      y -= 24;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const cells = row.map((value, index) => wrapText(value, regular, 7.5, widths[index] - 10));
      const rowHeight = Math.max(22, Math.max(...cells.map(lines => lines.length)) * 10 + 8);
      if (y - rowHeight < 65) {
        addPage();
        drawHeader();
      }
      if (rowIndex % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowHeight + 3, width: totalWidth, height: rowHeight, color: PALE });
      let x = MARGIN;
      cells.forEach((lines, index) => {
        lines.slice(0, 4).forEach((line, lineIndex) => page.drawText(line, { x: x + 5, y: y - 9 - lineIndex * 10, font: regular, size: 7.5, color: INK }));
        x += widths[index];
      });
      y -= rowHeight;
    });
    y -= 9;
  };

  const selected = new Set(options.sections);
  const sales = dashboard.salesPerformance || { overall: {}, monthly: [], byRepresentative: [], byBranch: [], newClients: {}, overduePromises: [] };
  const operations = dashboard.phase21?.operations || {};

  addPage();
  page.drawText('Management performance report', { x: MARGIN, y, font: bold, size: 25, color: NAVY });
  y -= 32;
  page.drawText(cleanText(sales.period?.label || ''), { x: MARGIN, y, font: bold, size: 12, color: CYAN });
  y -= 26;
  paragraph(`Generated for ${generatedBy} (${roleLabel}). Scope: representative ${sales.scope?.representativeId || 'all'}, branch ${sales.scope?.branchId || 'all'}.`);
  paragraph('Commercial totals come from the TOTAL ZAR field stored with uploaded quotation PDFs. Report values exclude line-level pricing and are restricted to the Company Owner and Sales Manager.', { boldText: true });
  metrics([
    { label: 'Total quotations', value: String(sales.overall?.quotations || 0) },
    { label: 'Converted order value', value: money(sales.overall?.totalOrderValue) },
    { label: 'Quote-to-order ratio', value: percent(sales.overall?.quoteToOrderRatio) },
    { label: 'Quote-loss ratio', value: percent(sales.overall?.quoteLossRatio) },
    { label: 'New clients', value: String(sales.newClients?.total || 0) },
    { label: 'Overdue promises', value: String(sales.overduePromises?.length || 0) },
  ]);

  if (selected.has('executive_summary')) {
    heading('Executive summary');
    metrics([
      { label: 'Open RFQs', value: String(dashboard.metrics?.openRfqs || 0) },
      { label: 'Orders completed', value: String(dashboard.metrics?.completed || 0) },
      { label: 'Orders delayed', value: String(dashboard.metrics?.delayed || 0) },
      { label: 'Average stage time', value: dashboard.metrics?.averageStageDuration || '0 hours' },
      { label: 'Ordered units', value: String(dashboard.phase21?.products?.totalUnits || 0) },
      { label: 'Archived orders', value: String(dashboard.metrics?.archived || 0) },
    ]);
  }

  if (selected.has('quotation_values')) {
    heading('Quotation and converted-order values');
    paragraph(`Converted-order value coverage: ${percent(sales.overall?.valueCoverage)} (${sales.overall?.valuedOrders || 0} converted orders with a verified total).`);
    table(['Month', 'Quotes', 'Orders', 'Order value', 'Coverage'], sales.monthly.map(row => [row.label, row.quotations, row.convertedOrders, money(row.totalOrderValue), percent(row.valueCoverage)]), [78, 62, 62, 180, 128]);
  }

  if (selected.has('conversion_performance')) {
    heading('Quote-to-order and quote-loss ratios');
    table(['Representative', 'Quotes', 'Orders', 'Order ratio', 'Lost', 'Loss ratio'], sales.byRepresentative.map(row => [row.label, row.quotations, row.convertedOrders, percent(row.quoteToOrderRatio), row.lostQuotes, percent(row.quoteLossRatio)]), [140, 55, 55, 85, 55, 80]);
  }

  if (selected.has('overdue_promises')) {
    heading('Orders overdue against delay promise dates');
    if (!sales.overduePromises.length) paragraph('No delayed orders are currently beyond their recorded promise date.');
    else table(['Order', 'Customer', 'Representative', 'Promise', 'Overdue', 'Reason'], sales.overduePromises.map(item => [item.reference, item.company, item.representative, dateLabel(item.promiseDate), `${item.daysOverdue}d`, item.reason]), [74, 102, 92, 70, 48, 125]);
  }

  if (selected.has('client_growth')) {
    heading('New-client growth');
    table(['Month', 'New clients'], (sales.newClients?.monthly || []).map(row => [row.label, row.count]), [250, 241]);
    table(['Representative', 'New clients'], (sales.newClients?.byRepresentative || []).map(row => [row.label, row.count]), [250, 241]);
  }

  if (selected.has('stage_times')) {
    heading('Average stage times');
    table(['Stage', 'Average duration'], [
      ['Quotation', formatDurationDaysHours(operations.averageQuotationHours)],
      ['Planning', formatDurationDaysHours(operations.averagePlanningHours)],
      ['Expediting', formatDurationDaysHours(operations.averageExpeditingHours)],
      ['Laboratory', formatDurationDaysHours(operations.averageLaboratoryHours)],
      ['Quality Assurance', formatDurationDaysHours(operations.averageQaHours)],
      ['Dispatch', formatDurationDaysHours(operations.averageDispatchHours)],
      ['Total order', formatDurationDaysHours(operations.averageTotalOrderHours)],
    ], [300, 191]);
  }

  if (selected.has('quantity_demand')) {
    heading('Quantity-based demand');
    table(['Product', 'Units'], (dashboard.phase21?.products?.byProduct || []).slice(0, 20).map(row => [row.label, row.quantity]), [390, 101]);
    table(['Month', 'Units'], (dashboard.phase21?.products?.byMonth || []).map(row => [row.label, row.quantity]), [300, 191]);
  }

  if (selected.has('representative_branch')) {
    heading('Representative and branch performance');
    table(['Representative', 'Orders', 'Order value', 'New clients'], sales.byRepresentative.map(row => [row.label, row.convertedOrders, money(row.totalOrderValue), row.newClients]), [190, 70, 160, 71]);
    table(['Branch', 'Orders', 'Order value'], sales.byBranch.map(row => [row.label, row.convertedOrders, money(row.totalOrderValue)]), [220, 90, 181]);
  }

  if (selected.has('operational_records')) {
    if (y < PAGE_HEIGHT - 180) addPage();
    heading('Authorised operational records');
    table(['Type', 'Reference', 'Customer', 'Representative', 'Status', 'Updated'], (dashboard.records || []).slice(0, 80).map(record => [record.workflowType, record.reference, record.company, record.selectedRep?.name || 'Unassigned', humanise(record.trackingStatus), dateLabel(record.updatedAt || record.createdAt)]), [45, 80, 115, 90, 95, 66]);
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.7, color: LINE });
    currentPage.drawText(`Generated ${dateLabel(generatedAt)} by ${cleanText(generatedBy)}`, { x: MARGIN, y: 23, font: regular, size: 7, color: MUTED });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    currentPage.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 7), y: 23, font: regular, size: 7, color: MUTED });
    if (sales.overduePromises?.length) currentPage.drawText('OVERDUE PROMISES INCLUDED', { x: MARGIN, y: 48, font: bold, size: 6.5, color: WARNING });
  });
  return pdf.saveAsBase64();
}
