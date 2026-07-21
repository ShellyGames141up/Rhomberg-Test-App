import { THEME_PREFERENCE_KEY } from '../serviceKeys.js';

export const STORE_KEYS = Object.freeze({
  accounts: 'rhombergPreviewAccountsV2',
  session: 'rhombergPreviewSessionV2',
  draft: 'rhombergPreviewDraftV2',
  enquiries: 'rhombergPreviewEnquiriesV2',
  theme: THEME_PREFERENCE_KEY,
  seedVersion: 'rhombergPreviewSeedV4',
});

export const LEGACY_STORE_KEYS = Object.freeze({
  accounts: 'rhombergPreviewAccountsV1',
  session: 'rhombergPreviewSessionV1',
  enquiries: 'rhombergPreviewEnquiriesV1',
});

export const DEMO_ACCOUNT = Object.freeze({
  id: 'company-demo-mining',
  companyId: 'company-demo-mining',
  company: 'Demo Mining Solutions',
  contact: 'Thabo Client',
  email: 'demo@client.co.za',
  phone: '+27 82 000 0000',
  area: 'Gauteng',
  industry: 'Mining',
  role: 'customer',
  password: 'Demo123!',
  createdAt: '2026-07-20T08:00:00.000Z',
});

export const EXPEDITOR_ACCOUNT = Object.freeze({
  id: 'staff-expeditor-preview',
  companyId: 'company-rhomberg',
  company: 'Rhomberg Instruments',
  contact: 'Expeditor Test',
  email: 'expeditor.test@rhom.co.za',
  phone: 'Internal test account',
  area: 'National',
  industry: 'Internal operations',
  role: 'expeditor',
  password: 'Expedite123!',
  createdAt: '2026-07-21T08:00:00.000Z',
});

export const EXTRA_DEMO_ACCOUNTS = Object.freeze([
  {
    id: 'company-demo-cape', companyId: 'company-demo-cape', company: 'Cape Process Demo', contact: 'Lerato Test', email: 'cape.demo@client.test',
    phone: '+27 21 000 0101', area: 'Western Cape', industry: 'Food & Beverage', role: 'customer', password: 'Demo123!', createdAt: '2026-07-18T09:00:00.000Z',
  },
  {
    id: 'company-demo-kzn', companyId: 'company-demo-kzn', company: 'KZN Water Demo', contact: 'Ayesha Test', email: 'kzn.demo@client.test',
    phone: '+27 31 000 0202', area: 'KwaZulu-Natal', industry: 'Water & Wastewater', role: 'customer', password: 'Demo123!', createdAt: '2026-07-18T09:30:00.000Z',
  },
]);

export const DEMO_LOGINS = Object.freeze([
  {
    id: 'customer',
    label: 'Use demo company',
    description: DEMO_ACCOUNT.company,
    avatar: 'D',
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
  },
  {
    id: 'expeditor',
    label: 'Use expeditor test login',
    description: 'Search and update customer orders',
    avatar: 'E',
    email: EXPEDITOR_ACCOUNT.email,
    password: EXPEDITOR_ACCOUNT.password,
  },
]);

export const DEMO_ENQUIRIES = Object.freeze([
  {
    id: 'enquiry-demo-jhb-001', reference: 'RQ-TEST-0001', version: 5, accountId: DEMO_ACCOUNT.id, companyId: DEMO_ACCOUNT.companyId,
    company: DEMO_ACCOUNT.company, contact: DEMO_ACCOUNT.contact, email: DEMO_ACCOUNT.email, phone: DEMO_ACCOUNT.phone,
    area: 'Gauteng', application: 'Mine dewatering pump discharge pressure monitoring.', medium: 'Process water', emergency: 'no',
    fulfilment: 'delivery', deliveryAddress: 'Demo mine site, Gauteng', collectionBranch: '', notes: 'Public preview sample only.',
    poMode: 'number', poNumber: 'PO-DEMO-1042', poFileName: '',
    selectedRep: { id: 'J-21', code: '21', name: 'Danny', branchId: 'johannesburg', branchName: 'Johannesburg' },
    items: [{ lineId: 'demo-line-pbb', productId: 'pbb', code: 'PBB', name: 'Stainless steel process gauge', quantity: 6, image: 'assets/images/products/pbb.webp', configuration: { dialSize: '100 mm', material: '316L stainless steel system', range: '0 to 16 bar', connectionPosition: 'Bottom entry' } }],
    trackingStatus: 'in-production', status: 'In production', createdAt: '2026-07-16T08:20:00.000Z', updatedAt: '2026-07-21T07:35:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-1a', status: 'rfq-submitted', note: 'RFQ received from the customer.', actor: 'Customer', createdAt: '2026-07-16T08:20:00.000Z' },
      { id: 'event-demo-1b', status: 'po-received', note: 'Purchase Order checked and accepted.', actor: 'Expeditor Test', createdAt: '2026-07-18T09:10:00.000Z' },
      { id: 'event-demo-1c', status: 'in-production', note: 'Gauge assembly is in progress.', actor: 'Expeditor Test', createdAt: '2026-07-21T07:35:00.000Z' },
    ],
  },
  {
    id: 'enquiry-demo-cape-001', reference: 'RQ-TEST-0002', version: 5, accountId: 'company-demo-cape', companyId: 'company-demo-cape',
    company: 'Cape Process Demo', contact: 'Lerato Test', email: 'cape.demo@client.test', phone: '+27 21 000 0101',
    area: 'Western Cape', application: 'Steam line temperature indication for a packaging plant.', medium: 'Steam', emergency: 'yes',
    fulfilment: 'collect', deliveryAddress: '', collectionBranch: 'Cape Town - Head Office', notes: 'Public preview sample only.',
    poMode: 'none', poNumber: '', poFileName: '',
    selectedRep: { id: 'C-27', code: '27', name: 'Ericu Vercuiel', branchId: 'cape-town', branchName: 'Cape Town' },
    items: [{ lineId: 'demo-line-tps', productId: 'tps', code: 'TPS', name: 'Bi-metal dial thermometer', quantity: 2, image: 'assets/images/products/tps.webp', configuration: { dialSize: '100 mm', range: '0 to 200 °C', mounting: 'Bottom entry', stemLength: '150 mm' } }],
    trackingStatus: 'under-review', status: 'Under review', createdAt: '2026-07-20T10:10:00.000Z', updatedAt: '2026-07-21T06:55:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-2a', status: 'rfq-submitted', note: 'Emergency RFQ received.', actor: 'Customer', createdAt: '2026-07-20T10:10:00.000Z' },
      { id: 'event-demo-2b', status: 'under-review', note: 'Checking range and emergency feasibility with production.', actor: 'Expeditor Test', createdAt: '2026-07-21T06:55:00.000Z' },
    ],
  },
  {
    id: 'enquiry-demo-kzn-001', reference: 'RQ-TEST-0003', version: 5, accountId: 'company-demo-kzn', companyId: 'company-demo-kzn',
    company: 'KZN Water Demo', contact: 'Ayesha Test', email: 'kzn.demo@client.test', phone: '+27 31 000 0202',
    area: 'KwaZulu-Natal', application: 'Reservoir level transmitter replacement.', medium: 'Potable water', emergency: 'no',
    fulfilment: 'delivery', deliveryAddress: 'Demo water works, Durban', collectionBranch: '', notes: 'Public preview sample only.',
    poMode: 'number', poNumber: 'PO-DEMO-2099', poFileName: '',
    selectedRep: { id: 'J-21', code: '21', name: 'Danny', branchId: 'johannesburg', branchName: 'Johannesburg' },
    items: [{ lineId: 'demo-line-rpt', productId: 'rpt200-level', code: 'RPT200', name: 'Submersible level transmitter', quantity: 1, image: 'assets/images/products/rpt200-level.webp', configuration: { range: '0 to 10 mH2O', output: '4-20 mA', cableLength: '15 m' } }],
    trackingStatus: 'ready', status: 'Ready for dispatch', createdAt: '2026-07-12T12:15:00.000Z', updatedAt: '2026-07-21T07:15:00.000Z', isDemo: true,
    trackingHistory: [
      { id: 'event-demo-3a', status: 'rfq-submitted', note: 'RFQ received.', actor: 'Customer', createdAt: '2026-07-12T12:15:00.000Z' },
      { id: 'event-demo-3b', status: 'quotation-sent', note: 'Quotation sent to customer.', actor: 'Expeditor Test', createdAt: '2026-07-13T09:40:00.000Z' },
      { id: 'event-demo-3c', status: 'ready', note: 'Unit calibrated and ready for dispatch.', actor: 'Expeditor Test', createdAt: '2026-07-21T07:15:00.000Z' },
    ],
  },
]);
