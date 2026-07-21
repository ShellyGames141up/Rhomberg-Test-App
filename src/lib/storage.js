export const STORAGE = {
  accounts: 'rhombergPreviewAccountsV2',
  session: 'rhombergPreviewSessionV2',
  draft: 'rhombergPreviewDraftV2',
  enquiries: 'rhombergPreviewEnquiriesV2',
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
  password: 'Demo123!',
  createdAt: '2026-07-20T08:00:00.000Z',
};

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
  } catch {
    // The preview remains usable for the current session if storage is unavailable.
  }
};

export const makeId = prefix => {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${token}`;
};

export function seedPreview() {
  let accounts = readStore(STORAGE.accounts, null);
  if (!accounts) accounts = readStore(LEGACY.accounts, []);
  if (!accounts.some(account => account.email?.toLowerCase() === DEMO_ACCOUNT.email)) accounts.unshift(DEMO_ACCOUNT);
  writeStore(STORAGE.accounts, accounts);

  if (!localStorage.getItem(STORAGE.enquiries)) {
    const legacy = readStore(LEGACY.enquiries, []);
    writeStore(STORAGE.enquiries, legacy.map(item => ({ ...item, version: 2 })));
  }

  if (!localStorage.getItem(STORAGE.session)) {
    const legacySession = readStore(LEGACY.session, null);
    if (legacySession) writeStore(STORAGE.session, legacySession);
  }
}

export const getAccounts = () => readStore(STORAGE.accounts, []);
export const getEnquiries = () => readStore(STORAGE.enquiries, []);
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
    password: data.password,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  writeStore(STORAGE.accounts, accounts);
  return account;
}

export function saveEnquiry(enquiry) {
  const enquiries = getEnquiries();
  enquiries.unshift(enquiry);
  writeStore(STORAGE.enquiries, enquiries);
  return enquiry;
}
