import { buildRfqPdf, rfqPdfFilename } from '../../src/lib/rfqPdf.js';
import { loadPrivatePriceBook, priceEnquiry } from './lib/pricing.mjs';

const MAX_PO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PO_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic',
]);

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

const safe = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const escapeHtml = value => safe(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function validateOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const configured = safe(process.env.RFQ_ALLOWED_ORIGINS || process.env.URL)
    .split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  if (!configured.length) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return configured.includes(origin.replace(/\/$/, ''));
}

function cleanEnquiry(input) {
  const items = Array.isArray(input.items) ? input.items.slice(0, 30).map(item => ({
    lineId: safe(item.lineId, 120),
    productId: safe(item.productId, 120),
    code: safe(item.code, 80),
    name: safe(item.name, 180),
    category: safe(item.category, 40),
    variant: safe(item.variant, 40),
    quantity: Math.min(9999, Math.max(1, Math.trunc(Number(item.quantity) || 1))),
    configuration: Object.fromEntries(Object.entries(item.configuration || {}).slice(0, 60).map(([key, value]) => [
      safe(key, 80),
      Array.isArray(value) ? value.slice(0, 30).map(entry => safe(entry, 400)) : typeof value === 'boolean' ? value : safe(value, 1500),
    ])),
  })) : [];

  return {
    id: safe(input.id, 160),
    reference: safe(input.reference, 80),
    company: safe(input.company, 180),
    contact: safe(input.contact, 180),
    email: safe(input.email, 240).toLowerCase(),
    phone: safe(input.phone, 80),
    area: safe(input.area, 120),
    application: safe(input.application, 6000),
    medium: safe(input.medium, 1200),
    emergency: input.emergency === 'yes' ? 'yes' : 'no',
    fulfilment: input.fulfilment === 'collect' ? 'collect' : 'delivery',
    deliveryAddress: safe(input.deliveryAddress, 1800),
    collectionBranch: safe(input.collectionBranch, 1800),
    notes: safe(input.notes, 5000),
    poMode: safe(input.poMode, 30),
    poNumber: safe(input.poNumber, 120),
    poFileName: safe(input.poFileName, 180),
    createdAt: safe(input.createdAt, 80) || new Date().toISOString(),
    website: safe(input.website, 200),
    items,
  };
}

function validateEnquiry(enquiry) {
  if (!enquiry.reference || !enquiry.company || !enquiry.contact || !enquiry.phone || !enquiry.application) return 'Required RFQ details are missing.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) return 'A valid client email address is required.';
  if (!enquiry.items.length) return 'At least one configured unit is required.';
  if (enquiry.fulfilment === 'delivery' && !enquiry.deliveryAddress) return 'A delivery address is required.';
  if (enquiry.fulfilment === 'collect' && !enquiry.collectionBranch) return 'A collection branch is required.';
  return '';
}

async function sendEmail(enquiry, pricing, pdfBytes, poFile) {
  const apiKey = safe(process.env.RESEND_API_KEY, 500);
  const from = safe(process.env.RFQ_FROM_EMAIL, 320);
  const to = safe(process.env.RFQ_TO_EMAIL || 'Ericuv@Rhom.co.za', 240);
  if (!apiKey || !from) throw new Error('The private email service has not been configured.');

  const attachments = [{
    filename: rfqPdfFilename(enquiry, true),
    content: Buffer.from(pdfBytes).toString('base64'),
  }];
  if (poFile?.size) attachments.push({
    filename: safe(poFile.name, 180).replace(/[^a-z0-9._ -]+/gi, '-'),
    content: Buffer.from(await poFile.arrayBuffer()).toString('base64'),
  });

  const manualCount = pricing.lines.filter(line => line.status !== 'estimated').length;
  const subject = `[${enquiry.reference}] RFQ - ${enquiry.company} - ${enquiry.items.length} configured line(s)`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;color:#0d2934">
      <div style="background:#073b53;color:white;padding:22px 26px;border-bottom:5px solid #10adb9">
        <h1 style="font-size:22px;margin:0">Rhomberg RFQ received</h1>
        <p style="margin:7px 0 0;color:#bdeef1">${escapeHtml(enquiry.reference)}</p>
      </div>
      <div style="padding:24px;border:1px solid #d1e0e4;border-top:0">
        <p><strong>Company:</strong> ${escapeHtml(enquiry.company)}<br>
        <strong>Contact:</strong> ${escapeHtml(enquiry.contact)} - ${escapeHtml(enquiry.phone)}<br>
        <strong>Reply to:</strong> ${escapeHtml(enquiry.email)}</p>
        <p><strong>Configured lines:</strong> ${enquiry.items.length}<br>
        <strong>Known catalogue subtotal:</strong> R${pricing.knownSubtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}<br>
        <strong>Lines needing rep review:</strong> ${manualCount}</p>
        ${enquiry.emergency === 'yes' ? '<p style="background:#fff4d7;padding:12px;border-left:4px solid #f4ab1e"><strong>Emergency request:</strong> determine feasibility and emergency charges manually.</p>' : ''}
        <p>The attached rep-only PDF contains the complete client configuration, price-list matches, known option charges and every manual-review item.</p>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `rfq-${safe(enquiry.id || enquiry.reference, 220).replace(/[^a-z0-9_-]+/gi, '-')}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: enquiry.email,
      subject,
      html,
      attachments,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error?.message || `Email service returned ${response.status}.`);
  return { id: result.id, recipient: to };
}

export default async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  if (request.method !== 'POST') return json({ success: false, message: 'Method not allowed.' }, 405, { allow: 'POST, OPTIONS' });
  if (!validateOrigin(request)) return json({ success: false, message: 'This RFQ source is not allowed.' }, 403);

  try {
    const form = await request.formData();
    const rawPayload = safe(form.get('payload'), 250000);
    const enquiry = cleanEnquiry(JSON.parse(rawPayload));
    if (enquiry.website) return json({ success: true, reference: enquiry.reference });
    const validationError = validateEnquiry(enquiry);
    if (validationError) return json({ success: false, message: validationError }, 400);

    const poFile = form.get('purchaseOrder');
    const usablePo = poFile && typeof poFile.arrayBuffer === 'function' && poFile.size ? poFile : null;
    if (usablePo && usablePo.size > MAX_PO_BYTES) return json({ success: false, message: 'The Purchase Order attachment must be 4 MB or smaller.' }, 413);
    if (usablePo && !ALLOWED_PO_TYPES.has(usablePo.type)) return json({ success: false, message: 'The Purchase Order file type is not supported.' }, 415);

    const priceBook = loadPrivatePriceBook();
    const pricing = priceEnquiry(enquiry, priceBook);
    const pdfBytes = await buildRfqPdf(enquiry, { pricing });
    const delivery = await sendEmail(enquiry, pricing, pdfBytes, usablePo);
    return json({
      success: true,
      reference: enquiry.reference,
      recipient: delivery.recipient,
      deliveryId: delivery.id,
      pricedPdfAttached: true,
    });
  } catch (error) {
    console.error('RFQ submission failed', error);
    return json({ success: false, message: error?.message || 'The RFQ could not be delivered.' }, 500);
  }
};

export const config = {
  path: '/api/submit-rfq',
  rateLimit: {
    windowLimit: 5,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
