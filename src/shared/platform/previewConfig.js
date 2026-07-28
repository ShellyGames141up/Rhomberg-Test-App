import { USER_ROLES } from '../../services/contracts.js';

export const PREVIEW_IDS = Object.freeze({
  LANDING: 'preview-landing',
  CUSTOMER_DESKTOP: 'customer-desktop',
  CUSTOMER_MOBILE: 'customer-mobile',
  INTERNAL_MOBILE: 'internal-mobile',
  INTERNAL_DESKTOP: 'internal-desktop',
});

const preview = ({
  id,
  product,
  platform,
  displayName,
  shortName,
  description,
  intendedUsers,
  device,
  allowedRoles,
  customer = false,
  mobile = false,
}) => Object.freeze({
  id,
  product,
  platform,
  displayName,
  shortName,
  description,
  intendedUsers,
  device,
  route: `/preview/${id}/`,
  allowedRoles: Object.freeze([...allowedRoles]),
  customer,
  internal: !customer,
  mobile,
  desktop: !mobile,
});

export const PREVIEW_DEFINITIONS = Object.freeze([
  preview({
    id: PREVIEW_IDS.CUSTOMER_DESKTOP,
    product: 'Rhomberg Connect',
    platform: 'Customer Desktop',
    displayName: 'Rhomberg Connect — Customer Desktop',
    shortName: 'Connect Desktop',
    description: 'Desktop customer experience for catalogue browsing, RFQs, quotations, tracking, documents and account settings.',
    intendedUsers: 'Customers and authorised customer-company contacts',
    device: 'Desktop / PWA',
    allowedRoles: [USER_ROLES.CUSTOMER],
    customer: true,
  }),
  preview({
    id: PREVIEW_IDS.CUSTOMER_MOBILE,
    product: 'Rhomberg Connect',
    platform: 'Customer Mobile',
    displayName: 'Rhomberg Connect — Customer Mobile',
    shortName: 'Connect Mobile',
    description: 'Touch-first customer experience for fast RFQ creation, quotation responses, order tracking and notifications.',
    intendedUsers: 'Customers and authorised customer-company contacts',
    device: 'Mobile / touch',
    allowedRoles: [USER_ROLES.CUSTOMER],
    customer: true,
    mobile: true,
  }),
  preview({
    id: PREVIEW_IDS.INTERNAL_MOBILE,
    product: 'Rhomberg Operations',
    platform: 'Rep & Expeditor Mobile',
    displayName: 'Rhomberg Operations — Rep & Expeditor Mobile',
    shortName: 'Operations Mobile',
    description: 'Fast mobile workflow for representatives, authorised management and Expeditors. Planning and Dispatch are desktop-only.',
    intendedUsers: 'Sales representatives, authorised management and Expeditors',
    device: 'Mobile / touch',
    allowedRoles: [
      USER_ROLES.SALES_REPRESENTATIVE,
      USER_ROLES.MANAGER,
      USER_ROLES.EXPEDITOR,
    ],
    mobile: true,
  }),
  preview({
    id: PREVIEW_IDS.INTERNAL_DESKTOP,
    product: 'Rhomberg Operations',
    platform: 'Internal Desktop',
    displayName: 'Rhomberg Operations — Internal Desktop',
    shortName: 'Operations Desktop',
    description: 'Desktop operational workspace for representatives, management, Expeditors, Planning and Dispatch.',
    intendedUsers: 'Authorised Rhomberg operational staff',
    device: 'Desktop / PWA',
    allowedRoles: [
      USER_ROLES.SALES_REPRESENTATIVE,
      USER_ROLES.MANAGER,
      USER_ROLES.EXPEDITOR,
      USER_ROLES.PLANNING,
      USER_ROLES.DISPATCH,
      USER_ROLES.BUYER,
      USER_ROLES.ADMINISTRATOR,
    ],
  }),
]);

export const PREVIEW_BY_ID = Object.freeze(Object.fromEntries(PREVIEW_DEFINITIONS.map(item => [item.id, item])));

const normalisePath = pathname => {
  const value = String(pathname || '/').replaceAll('\\', '/');
  return value.startsWith('/') ? value : `/${value}`;
};

export const previewIdFromPath = pathname => {
  const path = normalisePath(pathname);
  const match = path.match(/\/preview\/([^/]+)(?:\/|\/index\.html)?$/i);
  if (match) return PREVIEW_BY_ID[match[1]] ? match[1] : 'unsupported';
  if (/\/preview\/?$/i.test(path)) return PREVIEW_IDS.LANDING;
  return PREVIEW_IDS.LANDING;
};

export const previewContextForPath = pathname => {
  const id = previewIdFromPath(pathname);
  if (id === PREVIEW_IDS.LANDING) {
    return Object.freeze({
      id,
      product: 'Rhomberg Preview Centre',
      platform: 'Preview selector',
      displayName: 'Rhomberg Platform Preview Centre',
      route: '/',
      landing: true,
      allowedRoles: Object.freeze([]),
    });
  }
  if (id === 'unsupported') {
    return Object.freeze({
      id,
      displayName: 'Unsupported preview',
      route: '/',
      unsupported: true,
      allowedRoles: Object.freeze([]),
    });
  }
  return PREVIEW_BY_ID[id];
};

export const previewAllowsRole = (previewContext, role) => (
  Boolean(previewContext && !previewContext.landing && !previewContext.unsupported)
  && previewContext.allowedRoles.includes(role)
);

export const filterDemoLoginsForPreview = (logins, previewContext) => (
  (logins || []).filter(login => previewAllowsRole(previewContext, login.role))
);

export const previewUrl = (previewId, { origin = '', repositoryBase = '' } = {}) => {
  const definition = PREVIEW_BY_ID[previewId];
  if (!definition) return `${origin}${repositoryBase || '/'}`;
  const base = repositoryBase ? `/${String(repositoryBase).replace(/^\/+|\/+$/g, '')}` : '';
  return `${origin}${base}${definition.route}`;
};

export const landingUrlFromPath = pathname => {
  const path = normalisePath(pathname);
  const marker = '/preview/';
  const index = path.toLowerCase().indexOf(marker);
  return index >= 0 ? `${path.slice(0, index)}/` : './';
};
