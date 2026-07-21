import { statusById } from '../data/tracking.js';

export const STORAGE = {
  accounts: 'rhombergPreviewAccountsV2',
  session: 'rhombergPreviewSessionV2',
  draft: 'rhombergPreviewDraftV2',
  enquiries: 'rhombergPreviewEnquiriesV2',
  theme: 'rhombergPreviewThemeV1',
  seedVersion: 'rhombergPreviewSeedV3',
};

const LEGACY = {
  accounts: 'rhombergPreviewAccountsV1',
  session: 'rhombergPreviewSessionV1',
  enquiries: 'rhombergPreviewEnquiriesV1',
};

export const DEMO_ACCOUNT = {
  id: 'company-demo-mining',
  company: 'Demo Mining Solutions',
  contact: 'Thabo Client',
  email: 'demo@client.co.za',
  phone: '+27 82 000 0000',
  area: 'Gauteng',
  industry: 'Mining',
  role: 'customer',
  password: 'Demo123!',
  createdAt: '2026-07-20T08:00:00.000Z',
};

export const EXPEDITOR_ACCOUNT = {
  id: 'staff-expeditor-preview',
  company: 'Rhomberg Instruments',
  contact: 'Expeditor Test',
  email: 'expeditor.test@rhom.co.za',
  phone: 'Internal test account',
  area: 'National',
  industry: 'Internal operations',
  role: 'expeditor',
  password: 'Expedite123!',
  createdAt: '2026-07-21T08:00:00.000Z',
};

const EXTRA_DEMO_ACCOUNTS = [
  {
    id: 'company-demo-cape', company: 'Cape Process Demo', contact: 'Lerato Test', email: 'cape.demo@client.test',
    phone: '+27 21 000 0101', area: 'Western Cape', industry: 'Food & Beverage', role: 'customer', password: 'Demo123!', createdAt: '2026-07-18T09:00:00.000Z',
  },
  {
    id: 'company-demo-kzn', company: 'KZN Water Demo', contact: 'Ayesha Test', email: 'kzn.demo@client.test',
    phone: '+27 31 000 0202', area: 'KwaZulu-Natal', industry: 'Water & Wastewater', role: 'customer', password: 'Demo123!', createdAt: '2026-07-18T09:30:00.000Z',
  },
];

const DEMO_ENQUIRIES = [
  {
    id: 'enquiry-demo-jhb-001', reference: 'RQ-TEST-0001', version: 4, accountId: DEMO_ACCOUNT.id,
    company: DEMO_ACCOUNT.company, contact: DEMO_ACCOUNT.contact, email: DEMO_ACCOUNT.email, phone: DEMO_ACCOUNT.phone,
    area: 'Gauteng', application: 'Mine dewatering pump discharge pressure monitoring.', medium: 'Process water', emergency: 'no',
    fulfilment: 'delivery', deliveryAddress: 'Demo mine site, Gauteng', collectionBranch: '', notes: 'Public preview sample only.',
    poMode: 'number', poNumber: 'PO-DEMO-1042', poFileName: '',
    selectedRep: { id: 'J-20', code: '20', name: 'Tammy Landey', branchId: 'johannesburg', branchName: 'Johannesburg' },
    items: [{ lineId: 'demo-line-pbb', productId: 'pbb', code: 'PBB', name: 'Stainless steel process gauge', quantity: 6, image: 'assets/images/products/pbb.webp', configuration: { dialSize: '100 mm', material: '316L stainless steel system', range: '0 to 16 bar', connectionPosition: 'Bottom entry' } }],
    trackingStatus: 'in-production', status: 'In production', createdAt: '2026-07-16T08:20:00.000Z', updatedAt: '2026-07-21T07:35:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-1a', status: 'rfq-submitted', note: 'RFQ received from the customer.', actor: 'Customer', createdAt: '2026-07-16T08:20:00.000Z' },
      { id: 'event-demo-1b', status: 'po-received', note: 'Purchase Order checked and accepted.', actor: 'Expeditor Test', createdAt: '2026-07-18T09:10:00.000Z' },
      { id: 'event-demo-1c', status: 'in-production', note: 'Gauge assembly is in progress.', actor: 'Expeditor Test', createdAt: '2026-07-21T07:35:00.000Z' },
    ],
  },
  {
    id: 'enquiry-demo-cape-001', reference: 'RQ-TEST-0002', version: 4, accountId: 'company-demo-cape',
    company: 'Cape Process Demo', contact: 'Lerato Test', email: 'cape.demo@client.test', phone: '+27 21 000 0101',
    area: 'Western Cape', application: 'Steam line temperature indication for a packaging plant.', medium: 'Steam', emergency: 'yes',
    fulfilment: 'collect', deliveryAddress: '', collectionBranch: 'Cape Town - Head Office', notes: 'Public preview sample only.',
    poMode: 'none', poNumber: '', poFileName: '',
    selectedRep: { id: 'C-27', code: '27', name: 'Ericu Vercuiel', branchId: 'cape-town', branchName: 'Cape Town' },
    items: [{ lineId: 'demo-line-tps', productId: 'tps', code: 'TPS', name: 'Bi-metal dial thermometer', quantity: 2, image: 'assets/images/products/tps.webp', configuration: { dialSize: '100 mm', range: '0 to 200 deg C', mounting: 'Bottom entry', stemLength: '150 mm' } }],
    trackingStatus: 'under-review', status: 'Under review', createdAt: '2026-07-20T10:10:00.000Z', updatedAt: '2026-07-21T06:55:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-2a', status: 'rfq-submitted', note: 'Emergency RFQ received.', actor: 'Customer', createdAt: '2026-07-20T10:10:00.000Z' },
      { id: 'event-demo-2b', status: 'under-review', note: 'Checking range and emergency feasibility with production.', actor: 'Expeditor Test', createdAt: '2026-07-21T06:55:00.000Z' },
    ],
  },
  {
    id: 'enquiry-demo-kzn-001', reference: 'RQ-TEST-0003', version: 4, accountId: 'company-demo-kzn',
    company: 'KZN Water Demo', contact: 'Ayesha Test', email: 'kzn.demo@client.test', phone: '+27 31 000 0202',
    area: 'KwaZulu-Natal', application: 'Reservoir level transmitter replacement.', medium: 'Potable water', emergency: 'no',
    fulfilment: 'delivery', deliveryAddress: 'Demo water works, Durban', collectionBranch: '', notes: 'Public preview sample only.',
    poMode: 'number', poNumber: 'PO-DEMO-2099', poFileName: '',
    selectedRep: { id: 'D-21', code: '21', name: 'Amy Riley', branchId: 'durban', branchName: 'Durban' },
    items: [{ lineId: 'demo-line-rpt', productId: 'rpt200-level', code: 'RPT200', name: 'Submersible level transmitter', quantity: 1, image: 'assets/images/products/rpt200-level.webp', configuration: { range: '0 to 10 mH2O', output: '4-20 mA', cableLength: '15 m' } }],
    trackingStatus: 'ready', status: 'Ready for dispatch', createdAt: '2026-07-12T12:15:00.000Z', updatedAt: '2026-07-21T07:15:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-3a', status: 'rfq-submitted', note: 'RFQ received.', actor: 'Customer', createdAt: '2026-07-12T12:15:00.000Z' },
      { id: 'event-demo-3b', status: 'quotation-sent', note: 'Quotation sent to customer.', actor: 'Expeditor Test', createdAt: '2026-07-13T09:40:00.000Z' },
      { id: 'event-demo-3c', status: 'ready', note: 'Unit calibrated and ready for dispatch.', actor: 'Expeditor Test', createdAt: '2026-07-21T07:15:00.000Z' },
    ],
  },
];

export const readStore = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const makeId = prefix => {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${token}`;
};

const normaliseEnquiry = enquiry => {
  const trackingStatus = enquiry.trackingStatus || 'rfq-submitted';
  const createdAt = enquiry.createdAt || new Date().toISOString();
  return {
    ...enquiry,
    version: Math.max(4, Number(enquiry.version) || 0),
    trackingStatus,
    status: statusById(trackingStatus).label,
    trackingHistory: enquiry.trackingHistory?.length ? enquiry.trackingHistory : [{
      id: makeId('event'), status: trackingStatus, note: 'RFQ saved to the customer account.', actor: 'Customer', createdAt,
    }],
  };
};

export function seedPreview() {
  let accounts = readStore(STORAGE.accounts, null);
  if (!accounts) accounts = readStore(LEGACY.accounts, []);
  const seededAccounts = [DEMO_ACCOUNT, EXPEDITOR_ACCOUNT, ...EXTRA_DEMO_ACCOUNTS];
  for (const seed of seededAccounts) {
    const index = accounts.findIndex(account => account.id === seed.id || account.email?.toLowerCase() === seed.email.toLowerCase());
    if (index >= 0) accounts[index] = { role: 'customer', ...accounts[index], ...seed };
    else accounts.push(seed);
  }
  accounts = accounts.map(account => ({ role: 'customer', ...account }));
  writeStore(STORAGE.accounts, accounts);

  let enquiries = readStore(STORAGE.enquiries, null);
  if (!enquiries) enquiries = readStore(LEGACY.enquiries, []);
  enquiries = enquiries.map(normaliseEnquiry);
  if (!readStore(STORAGE.seedVersion, false)) {
    for (const demo of DEMO_ENQUIRIES) if (!enquiries.some(enquiry => enquiry.id === demo.id)) enquiries.push(demo);
    writeStore(STORAGE.seedVersion, true);
  }
  writeStore(STORAGE.enquiries, enquiries);

  if (!localStorage.getItem(STORAGE.session)) {
    const legacySession = readStore(LEGACY.session, null);
    if (legacySession) writeStore(STORAGE.session, legacySession);
  }
}

export const getAccounts = () => readStore(STORAGE.accounts, []);
export const getEnquiries = () => readStore(STORAGE.enquiries, []).map(normaliseEnquiry);
export const getDraft = accountId => {
  const stored = readStore(STORAGE.draft, {});
  if (Array.isArray(stored)) return stored;
  return accountId ? stored[accountId] || [] : [];
};

export const saveDraft = (accountId, lines) => {
  const stored = readStore(STORAGE.draft, {});
  const drafts = Array.isArray(stored) ? {} : stored;
  drafts[accountId] = lines;
  writeStore(STORAGE.draft, drafts);
};

export const accountFromSession = () => {
  const session = readStore(STORAGE.session, null);
  return session ? getAccounts().find(account => account.id === session.accountId) || null : null;
};

export const setSession = account => writeStore(STORAGE.session, { accountId: account.id, signedInAt: new Date().toISOString() });
export const clearSession = () => localStorage.removeItem(STORAGE.session);

export const authenticate = (email, password) => getAccounts().find(account => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password) || null;

export function createAccount(data) {
  const accounts = getAccounts();
  const email = data.email.trim().toLowerCase();
  if (accounts.some(account => account.email.toLowerCase() === email)) throw new Error('An account with this email address already exists on this device.');
  const account = {
    id: makeId('company'),
    company: data.company.trim(),
    contact: data.contact.trim(),
    email,
    phone: data.phone.trim(),
    area: data.area,
    industry: data.industry,
    role: 'customer',
    password: data.password,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  writeStore(STORAGE.accounts, accounts);
  return account;
}

export function saveEnquiry(enquiry) {
  const enquiries = getEnquiries();
  const normalised = normaliseEnquiry(enquiry);
  const index = enquiries.findIndex(item => item.id === normalised.id);
  if (index >= 0) enquiries[index] = normalised;
  else enquiries.unshift(normalised);
  writeStore(STORAGE.enquiries, enquiries);
  return normalised;
}

export function updateEnquiryTracking(enquiryId, { status, note, actor }) {
  const enquiries = getEnquiries();
  const index = enquiries.findIndex(enquiry => enquiry.id === enquiryId);
  if (index < 0) return null;
  const updatedAt = new Date().toISOString();
  const current = enquiries[index];
  const event = {
    id: makeId('event'),
    status,
    note: String(note || statusById(status).description).trim(),
    actor: String(actor || 'Expeditor').trim(),
    createdAt: updatedAt,
  };
  const updated = {
    ...current,
    trackingStatus: status,
    status: statusById(status).label,
    updatedAt,
    trackingHistory: [...(current.trackingHistory || []), event],
  };
  enquiries[index] = updated;
  writeStore(STORAGE.enquiries, enquiries);
  return updated;
}

export const getTheme = () => readStore(STORAGE.theme, null) || (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const saveTheme = theme => writeStore(STORAGE.theme, theme === 'dark' ? 'dark' : 'light');
