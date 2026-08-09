export const RFQ_DELIVERY_DESTINATION = 'Rhomberg RFQ routing service';
export const MAX_EMAIL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

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
  `Selected representative: ${enquiry.selectedRep?.name || 'Not selected'}${enquiry.selectedRep?.code ? ` (code ${enquiry.selectedRep.code}, ${enquiry.selectedRep.branchName})` : ''}`,
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
  void enquiry;
  return '';
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
      recipient: payload.recipient || RFQ_DELIVERY_DESTINATION,
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

async function simulatePublicDelivery(enquiry, poFile, signal) {
  void enquiry;
  void poFile;
  if (signal?.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
  await Promise.resolve();
  return {
    ok: true,
    recipient: RFQ_DELIVERY_DESTINATION,
    pricedPdfAttached: false,
    deliveryMode: 'mock-simulated',
    activationMayBeRequired: false,
    message: 'RFQ delivery was simulated in public mock mode. No email was sent.',
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
    const fallback = await simulatePublicDelivery(enquiry, poFile, controller.signal);
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
