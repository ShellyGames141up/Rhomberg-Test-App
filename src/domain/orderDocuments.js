import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const ORDER_COPY_TYPES = Object.freeze({
  CUSTOMER: 'customer',
  INTERNAL: 'internal',
});

export const ORDER_RECIPIENT_TYPES = Object.freeze({
  MANUAL: 'manual',
  REPRESENTATIVE: 'representative',
  INTERNAL: 'internal',
});

const PRIVATE_CONFIGURATION_KEY = /(price|cost|margin|engine|supplier|private|internal|raw)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = value => String(value ?? '')
  .replaceAll('\u00a0', ' ')
  .replaceAll('\u00b0', ' deg ')
  .replaceAll('\u2013', '-')
  .replaceAll('\u2014', '-')
  .replaceAll('\u2018', "'")
  .replaceAll('\u2019', "'")
  .replaceAll('\u201c', '"')
  .replaceAll('\u201d', '"')
  .replaceAll('\u2022', '-')
  .replaceAll('\u2192', '->')
  .replace(/[^\x20-\x7e\n]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const displayValue = value => {
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return value.customerVisible === false ? '' : displayValue(value.value ?? value.label ?? '');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return cleanText(value);
};

const humanise = value => cleanText(value)
  .replaceAll('_', ' ')
  .replace(/\b\w/g, character => character.toUpperCase());

const safeConfiguration = configuration => Object.entries(configuration || {})
  .filter(([key, value]) => !PRIVATE_CONFIGURATION_KEY.test(key) && value?.customerVisible !== false)
  .map(([key, value]) => ({
    label: cleanText(key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')),
    value: displayValue(value),
  }))
  .filter(item => item.value);

const publicTimeline = order => (order.customerTimeline || order.trackingHistory || [])
  .filter(event => event.customerVisible !== false)
  .map(event => ({
    date: event.createdAt,
    status: event.label || event.toStatus || event.status || 'Order update',
    note: event.customerDescription || event.note || '',
    actor: event.actorRole === 'customer' ? 'Customer' : 'Rhomberg Instruments',
  }));

export const buildOrderSummaryModel = ({ order, copyType, generatedAt, generatedBy }) => {
  const internal = copyType === ORDER_COPY_TYPES.INTERNAL;
  const planning = order.planning || {};
  const expediting = order.expediting || {};
  const dispatch = order.dispatch || {};
  return {
    copyType,
    classification: internal ? 'INTERNAL - OPERATIONAL COPY' : 'CUSTOMER COPY',
    title: 'Order Summary',
    orderReference: order.reference,
    rfqReference: order.sourceRfqReference || order.sourceEnquiryReference || 'Not recorded',
    status: order.status || order.trackingStatus,
    customer: {
      company: order.company,
      contact: order.contact,
      email: order.email,
      phone: order.phone,
      address: order.fulfilment === 'delivery' ? order.deliveryAddress : '',
    },
    representative: {
      name: order.selectedRep?.name || 'Not assigned',
      branch: order.selectedRep?.branchName || order.area || 'Not recorded',
      code: order.selectedRep?.code || '',
    },
    references: {
      jobNumber: planning.internalJobNumber || order.internalJobNumber || 'Not assigned',
      purchaseOrder: planning.customerPoNumber || order.customerPoNumber || order.poNumber || order.poFileName || 'Not supplied',
    },
    requirements: [
      { label: 'Application', value: order.application || 'Not recorded' },
      { label: 'Process medium', value: order.medium || 'Not recorded' },
      { label: 'Priority', value: order.priority || planning.priority || (order.emergency === 'yes' ? 'Emergency' : 'Standard') },
      { label: 'Fulfilment', value: order.fulfilment === 'collect' ? `Collection - ${order.collectionBranch || 'branch to be confirmed'}` : 'Delivery' },
      ...(order.customerNotes ? [{ label: 'Customer requirements', value: order.customerNotes }] : []),
    ],
    items: (order.items || []).map(item => ({
      code: item.code,
      name: item.name,
      quantity: Number(item.quantity || 1),
      configuration: safeConfiguration(item.configuration),
    })),
    planning: {
      owner: planning.assignedPlanningUserName || 'Not assigned',
      productionLocation: planning.productionLocationName || 'Not recorded',
      plannedStartDate: planning.plannedStartDate || '',
      estimatedCompletionDate: planning.estimatedCompletionDate || '',
      submissionDate: planning.submissionDate || '',
      priority: planning.priority || order.priority || '',
    },
    expediting: {
      currentStep: humanise(expediting.currentStep || 'Not started'),
      estimatedCompletionDate: expediting.estimatedCompletionDate || '',
      delayReason: expediting.currentDelayReason || '',
      customerUpdates: (expediting.updates || []).filter(update => update.customerVisible !== false).map(update => ({
        date: update.createdAt,
        step: humanise(update.progressStep),
        message: update.customerMessage,
      })),
    },
    dispatch: {
      method: humanise(dispatch.method || (order.fulfilment === 'collect' ? 'collection' : 'Not assigned')),
      readyDate: dispatch.readyDate || '',
      collectionDate: dispatch.collectionDate || '',
      deliveryDate: dispatch.deliveryDate || '',
      courierOrDriver: dispatch.courierOrDriver || '',
      trackingReference: dispatch.trackingReference || '',
      numberOfPackages: dispatch.numberOfPackages || '',
      deliveryNoteNumber: dispatch.deliveryNoteNumber || '',
      recipientName: dispatch.recipientName || '',
      customerMessage: dispatch.customerMessage || '',
    },
    dates: {
      created: order.createdAt,
      accepted: order.acceptedAt,
      updated: order.updatedAt,
      planningCompleted: order.plannedAt,
      dispatchReceived: order.submittedToDispatchAt || dispatch.receivedAt,
      completed: order.completedAt,
    },
    timeline: publicTimeline(order),
    internal: internal ? {
      orderNotes: order.notes || '',
      planningNotes: planning.notes || '',
      planningDocuments: planning.documentReferences || [],
      expeditingNotes: (expediting.updates || []).map(update => update.internalNote).filter(Boolean),
      dispatchNotes: dispatch.internalNotes || '',
      dispatchProblems: dispatch.currentProblemReason || '',
      operationalDocuments: (expediting.updates || []).map(update => update.document).filter(Boolean).map(document => document.reference || document.fileName || document.type),
    } : null,
    generatedAt,
    generatedBy,
  };
};

export const isValidRecipientEmail = value => EMAIL_PATTERN.test(String(value || '').trim());

export const validateOrderEmailRequest = (input, options) => {
  const recipientType = Object.values(ORDER_RECIPIENT_TYPES).includes(input?.recipientType)
    ? input.recipientType
    : ORDER_RECIPIENT_TYPES.MANUAL;
  let recipientEmail = String(input?.recipientEmail || '').trim().toLowerCase();
  if (recipientType === ORDER_RECIPIENT_TYPES.REPRESENTATIVE) recipientEmail = options.representative?.email || '';
  if (recipientType === ORDER_RECIPIENT_TYPES.INTERNAL) {
    const internalMatch = options.internalRecipients.find(item => item.email.toLowerCase() === recipientEmail);
    if (!internalMatch) throw new Error('Select an authorised internal recipient.');
  }
  if (!isValidRecipientEmail(recipientEmail)) throw new Error('Enter a valid recipient email address.');
  const recognisedInternal = options.internalRecipients.some(item => item.email.toLowerCase() === recipientEmail)
    || options.representative?.email?.toLowerCase() === recipientEmail;
  const external = !recognisedInternal;
  if (external && input?.confirmedExternal !== true) {
    throw new Error('Confirm the external recipient before sending this order summary.');
  }
  return { recipientType, recipientEmail, external };
};

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

const formatDate = value => {
  if (!value) return 'Not recorded';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? cleanText(value) : date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const wrapText = (text, font, size, maxWidth) => {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not recorded'];
};

export async function generateOrderSummaryPdf(model) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${model.orderReference} ${model.classification}`);
  pdf.setAuthor('Rhomberg Instruments');
  pdf.setSubject('Controlled order summary');
  pdf.setKeywords(['Rhomberg', 'order summary', model.copyType]);
  pdf.setCreationDate(new Date(model.generatedAt));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page;
  let y;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 92, width: PAGE_WIDTH, height: 92, color: NAVY });
    page.drawText('RHOMBERG', { x: MARGIN, y: PAGE_HEIGHT - 48, font: bold, size: 20, color: WHITE });
    page.drawText('INSTRUMENTS', { x: MARGIN, y: PAGE_HEIGHT - 65, font: bold, size: 8, color: CYAN });
    page.drawText(model.classification, { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(model.classification, 8), y: PAGE_HEIGHT - 48, font: bold, size: 8, color: WHITE });
    page.drawText(`${model.title}  |  ${cleanText(model.orderReference)}`, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(`${model.title}  |  ${cleanText(model.orderReference)}`, 8), y: PAGE_HEIGHT - 64, font: regular, size: 8, color: rgb(0.72, 0.86, 0.88) });
    y = PAGE_HEIGHT - 120;
  };

  const ensure = height => {
    if (y - height < 70) addPage();
  };

  const heading = title => {
    ensure(75);
    page.drawText(cleanText(title).toUpperCase(), { x: MARGIN, y, font: bold, size: 9, color: CYAN });
    page.drawLine({ start: { x: MARGIN, y: y - 7 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 7 }, thickness: 0.8, color: LINE });
    y -= 25;
  };

  const paragraph = (text, { boldText = false, indent = 0 } = {}) => {
    const font = boldText ? bold : regular;
    const lines = wrapText(text, font, 9, PAGE_WIDTH - (MARGIN * 2) - indent);
    ensure(lines.length * 13 + 6);
    lines.forEach(line => {
      page.drawText(line, { x: MARGIN + indent, y, font, size: 9, color: INK });
      y -= 13;
    });
    y -= 4;
  };

  const keyValues = items => {
    const rows = items.filter(item => item.value !== undefined && item.value !== '');
    for (let index = 0; index < rows.length; index += 2) {
      const pair = rows.slice(index, index + 2);
      const maxLines = Math.max(...pair.map(item => wrapText(item.value, regular, 9, 190).length));
      const rowHeight = 23 + maxLines * 12;
      ensure(rowHeight);
      pair.forEach((item, column) => {
        const x = MARGIN + column * 255;
        page.drawText(cleanText(item.label).toUpperCase(), { x, y, font: bold, size: 7, color: MUTED });
        wrapText(item.value, regular, 9, 190).forEach((line, lineIndex) => page.drawText(line, { x, y: y - 13 - lineIndex * 12, font: regular, size: 9, color: INK }));
      });
      y -= rowHeight;
    }
  };

  addPage();
  page.drawText(cleanText(model.orderReference), { x: MARGIN, y, font: bold, size: 26, color: NAVY });
  page.drawText(cleanText(model.status), { x: MARGIN, y: y - 23, font: bold, size: 11, color: CYAN });
  y -= 53;
  keyValues([
    { label: 'Original RFQ', value: model.rfqReference },
    { label: 'Job number', value: model.references.jobNumber },
    { label: 'Purchase order', value: model.references.purchaseOrder },
    { label: 'Last updated', value: formatDate(model.dates.updated) },
  ]);

  heading('Customer and representative');
  keyValues([
    { label: 'Customer company', value: model.customer.company },
    { label: 'Assigned representative', value: `${model.representative.name} - ${model.representative.branch}` },
    { label: 'Authorised contact', value: model.customer.contact },
    { label: 'Contact details', value: [model.customer.email, model.customer.phone].filter(Boolean).join(' | ') },
    { label: 'Delivery address', value: model.customer.address },
  ]);

  heading('Customer requirements');
  keyValues(model.requirements);

  heading('Product line items and configuration');
  model.items.forEach((item, index) => {
    ensure(42);
    page.drawRectangle({ x: MARGIN, y: y - 25, width: PAGE_WIDTH - MARGIN * 2, height: 32, color: PALE });
    page.drawText(`${index + 1}. ${cleanText(item.code)} - ${cleanText(item.name)}`, { x: MARGIN + 10, y: y - 8, font: bold, size: 10, color: NAVY });
    page.drawText(`Qty ${item.quantity}`, { x: PAGE_WIDTH - MARGIN - 55, y: y - 8, font: bold, size: 9, color: CYAN });
    y -= 38;
    if (item.configuration.length) {
      item.configuration.forEach(setting => paragraph(`${setting.label}: ${setting.value}`, { indent: 10 }));
    } else paragraph('No approved configuration detail recorded.', { indent: 10 });
  });

  heading('Planning information');
  keyValues([
    { label: 'Planning owner', value: model.planning.owner },
    { label: 'Production location', value: model.planning.productionLocation },
    { label: 'Planned start', value: formatDate(model.planning.plannedStartDate) },
    { label: 'Estimated completion', value: formatDate(model.planning.estimatedCompletionDate) },
    { label: 'Submission date', value: formatDate(model.planning.submissionDate) },
    { label: 'Priority', value: model.planning.priority || 'Not recorded' },
  ]);

  heading('Expeditor progress');
  keyValues([
    { label: 'Current step', value: model.expediting.currentStep },
    { label: 'Estimated completion', value: formatDate(model.expediting.estimatedCompletionDate) },
    { label: 'Customer-visible delay', value: model.expediting.delayReason || 'None recorded' },
  ]);
  model.expediting.customerUpdates.slice(-6).forEach(update => paragraph(`${formatDate(update.date)} | ${update.step}: ${update.message}`));

  heading('Dispatch information');
  keyValues([
    { label: 'Method', value: model.dispatch.method },
    { label: 'Packages', value: model.dispatch.numberOfPackages || 'Not recorded' },
    { label: 'Ready date', value: formatDate(model.dispatch.readyDate) },
    { label: 'Collection date', value: formatDate(model.dispatch.collectionDate) },
    { label: 'Delivery date', value: formatDate(model.dispatch.deliveryDate) },
    { label: 'Courier or driver', value: model.dispatch.courierOrDriver || 'Not recorded' },
    { label: 'Tracking reference', value: model.dispatch.trackingReference || 'Not recorded' },
    { label: 'Delivery note', value: model.dispatch.deliveryNoteNumber || 'Not recorded' },
    { label: 'Recipient', value: model.dispatch.recipientName || 'Not recorded' },
    { label: 'Customer message', value: model.dispatch.customerMessage || 'No Dispatch message recorded' },
  ]);

  heading('Relevant dates');
  keyValues(Object.entries(model.dates).map(([label, value]) => ({ label: humanise(label), value: formatDate(value) })));

  heading('Customer-visible timeline');
  if (model.timeline.length) model.timeline.forEach(event => paragraph(`${formatDate(event.date)} | ${humanise(event.status)} | ${event.note}`));
  else paragraph('No customer-visible timeline events recorded.');

  if (model.internal) {
    heading('Authorised internal operational section');
    paragraph('This section is restricted to authorised Rhomberg staff and must not be shared as a customer copy.', { boldText: true });
    const internalFields = [
      { label: 'Order notes', value: model.internal.orderNotes || 'None recorded' },
      { label: 'Planning notes', value: model.internal.planningNotes || 'None recorded' },
      { label: 'Dispatch notes', value: model.internal.dispatchNotes || 'None recorded' },
      { label: 'Dispatch problem', value: model.internal.dispatchProblems || 'None recorded' },
    ];
    if (model.internal.planningDocuments.length) {
      internalFields.push({ label: 'Planning documents', value: model.internal.planningDocuments.join(', ') });
    }
    if (model.internal.operationalDocuments.length) {
      internalFields.push({ label: 'Operational documents', value: model.internal.operationalDocuments.join(', ') });
    }
    keyValues(internalFields);
    model.internal.expeditingNotes.forEach(note => paragraph(`Expediting note: ${note}`));
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.7, color: LINE });
    currentPage.drawText(`Generated ${formatDate(model.generatedAt)} by ${cleanText(model.generatedBy)}`, { x: MARGIN, y: 23, font: regular, size: 7, color: MUTED });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    currentPage.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 7), y: 23, font: regular, size: 7, color: MUTED });
  });
  return pdf.saveAsBase64();
}
