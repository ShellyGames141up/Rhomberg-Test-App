import { buildRfqPdf, rfqPdfFilename } from './rfqPdf.js';

export const RFQ_EMAIL_RECIPIENT = 'Ericuv@Rhom.co.za';
export const MAX_EMAIL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const RFQ_ENDPOINT = `https://formsubmit.co/ajax/${RFQ_EMAIL_RECIPIENT}`;
const PRIVATE_RFQ_ENDPOINT = '/api/submit-rfq';

const humanise = key => key
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, character => character.toUpperCase());

const formatValue = value => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
};

const formatItems = items => items.length
  ? items.map((item, index) => {
    const configuration = Object.entries(item.configuration || {})
      .filter(([, value]) => value !== '' && value !== false && (!Array.isArray(value) || value.length))
      .map(([key, value]) => `   - ${humanise(key)}: ${formatValue(value)}`)
      .join('\n');
    return `${index + 1}. ${item.code} - ${item.name}\n   Quantity: ${item.quantity}${configuration ? `\n${configuration}` : ''}`;
  }).join('\n\n')
  : 'General enquiry - no configured units were attached.';

const buildPlainTextSummary = enquiry => [
  `RFQ reference: ${enquiry.reference}`,
  `Company: ${enquiry.company}`,
  `Contact: ${enquiry.contact}`,
  `Telephone: ${enquiry.phone}`,
  `Email: ${enquiry.email}`,
  `Area: ${enquiry.area}`,
  `Emergency: ${enquiry.emergency === 'yes' ? 'Yes - representative to determine emergency pricing' : 'No'}`,
  `Fulfilment: ${enquiry.fulfilment === 'collect' ? `Collect from ${enquiry.collectionBranch}` : `Delivery to ${enquiry.deliveryAddress}`}`,
  `Application: ${enquiry.application}`,
  `Medium: ${enquiry.medium || 'Not supplied'}`,
  `Additional notes: ${enquiry.notes || 'None'}`,
  `Purchase Order: ${enquiry.poNumber || enquiry.poFileName || 'Not supplied'}`,
  '',
  'CONFIGURED UNITS',
  formatItems(enquiry.items),
].join('\n');

export function buildRfqMailto(enquiry) {
  const subject = `[${enquiry.reference}] Rhomberg RFQ - ${enquiry.company}`;
  const body = buildPlainTextSummary(enquiry).slice(0, 6500);
  return `mailto:${RFQ_EMAIL_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const privateEndpointAvailableHere = () => {
  if (!/^https?:$/.test(window.location.protocol)) return false;
  if (/\.github\.io$/i.test(window.location.hostname)) return false;
  return true;
};

async function tryPrivateDelivery(enquiry, poFile, signal) {
  if (!privateEndpointAvailableHere()) return { available: false };
  try {
    const form = new FormData();
    form.append('payload', JSON.stringify(enquiry));
    if (poFile) form.append('purchaseOrder', poFile, poFile.name);
    const response = await fetch(PRIVATE_RFQ_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
      signal,
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    if (response.status === 404 || !isJson) return { available: false };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || `Private RFQ service returned ${response.status}.`);
    return {
      available: true,
      ok: true,
      recipient: payload.recipient || RFQ_EMAIL_RECIPIENT,
      pricedPdfAttached: Boolean(payload.pricedPdfAttached),
      deliveryMode: 'protected',
      activationMayBeRequired: false,
      message: 'RFQ emailed with a protected representative PDF.',
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { available: true, ok: false, message: error?.message || 'The protected RFQ service is unavailable.' };
  }
}

async function sendPublicTestFallback(enquiry, poFile, signal) {
  const form = new FormData();
  const summary = buildPlainTextSummary(enquiry);
  const sourceUrl = /^https?:$/.test(window.location.protocol) ? window.location.href : 'https://rhomberginstruments.co.za/';

  form.append('_subject', `[${enquiry.reference}] Rhomberg RFQ - ${enquiry.company}`);
  form.append('_template', 'table');
  form.append('_captcha', 'false');
  form.append('_url', sourceUrl);
  form.append('_replyto', enquiry.email);
  form.append('email', enquiry.email);
  form.append('RFQ reference', enquiry.reference);
  form.append('Company', enquiry.company);
  form.append('Contact person', enquiry.contact);
  form.append('Telephone', enquiry.phone);
  form.append('Area', enquiry.area);
  form.append('Application', enquiry.application);
  form.append('Process medium', enquiry.medium || 'Not supplied');
  form.append('Emergency request', enquiry.emergency === 'yes' ? 'YES - emergency pricing to be determined by the representative' : 'No');
  form.append('Delivery or collection', enquiry.fulfilment === 'collect' ? `Collect - ${enquiry.collectionBranch}` : `Deliver - ${enquiry.deliveryAddress}`);
  form.append('Purchase Order', enquiry.poNumber || enquiry.poFileName || 'Not supplied');
  form.append('Additional notes', enquiry.notes || 'None');
  form.append('Configured units', formatItems(enquiry.items));
  form.append('Complete RFQ summary', summary);

  try {
    const pdfBytes = await buildRfqPdf(enquiry);
    form.append('RFQ PDF', new Blob([pdfBytes], { type: 'application/pdf' }), rfqPdfFilename(enquiry, false));
  } catch {
    // The complete text summary still reaches the rep if a browser cannot create the PDF.
  }
  if (poFile) form.append('Purchase Order attachment', poFile, poFile.name);

  const response = await fetch(RFQ_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  const accepted = response.ok && payload.success !== false && payload.success !== 'false';
  if (!accepted) throw new Error(payload.message || `The test email service returned status ${response.status}.`);
  return {
    ok: true,
    recipient: RFQ_EMAIL_RECIPIENT,
    pricedPdfAttached: false,
    deliveryMode: 'public-test-fallback',
    activationMayBeRequired: true,
    message: payload.message || 'RFQ accepted by the public test email service.',
  };
}

export async function sendRfqEmail(enquiry, poFile) {
  if (poFile && poFile.size > MAX_EMAIL_ATTACHMENT_BYTES) {
    return {
      ok: false,
      message: 'The secure test service accepts Purchase Order attachments up to 4 MB. Please choose a smaller file.',
      fallbackUrl: buildRfqMailto(enquiry),
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35000);

  try {
    const privateResult = await tryPrivateDelivery(enquiry, poFile, controller.signal);
    if (privateResult.available && privateResult.ok) return privateResult;
    const fallback = await sendPublicTestFallback(enquiry, poFile, controller.signal);
    return privateResult.available && !privateResult.ok
      ? { ...fallback, warning: `Protected pricing service unavailable: ${privateResult.message}` }
      : fallback;
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return {
      ok: false,
      message: timedOut
        ? 'Email delivery timed out. Your configured units are still here, so you can try again.'
        : `Email delivery failed: ${error?.message || 'Please check the connection and try again.'}`,
      fallbackUrl: buildRfqMailto(enquiry),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
