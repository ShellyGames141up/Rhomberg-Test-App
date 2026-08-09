import { USER_ROLES } from '../../services/contracts.js';

export const PREVIEW_IDS = Object.freeze({
  LANDING: 'preview-landing',
  CUSTOMER_DESKTOP: 'customer-desktop',
  CUSTOMER_MOBILE: 'customer-mobile',
  INTERNAL_MOBILE: 'internal-mobile',
  INTERNAL_DESKTOP: 'internal-desktop',
  EXECUTIVE_DEMO: 'executive-demo',
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
  route,
  sourcePath,
  executiveDemo = false,
}) => Object.freeze({
  id,
  product,
  platform,
  displayName,
  shortName,
  description,
  intendedUsers,
  device,
  route: route || `/preview/${id}/`,
  sourcePath: sourcePath || `preview/${id}`,
  allowedRoles: Object.freeze([...allowedRoles]),
  customer,
  internal: !customer,
  mobile,
  desktop: !mobile,
  executiveDemo,
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
    product: 'Rhomberg Connect',
    platform: 'Rep & Expeditor Mobile',
    displayName: 'Rhomberg Connect — Rep & Expeditor Mobile',
    shortName: 'Connect Mobile',
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
    product: 'Rhomberg Connect',
    platform: 'Internal Desktop',
    displayName: 'Rhomberg Connect — Internal Desktop',
    shortName: 'Connect Desktop',
    description: 'Desktop operational workspace for Sales, Planning, Expediting, Laboratory, Quality, Dispatch and management.',
    intendedUsers: 'Authorised Rhomberg operational staff',
    device: 'Desktop / PWA',
    allowedRoles: [
      USER_ROLES.SALES_REPRESENTATIVE,
      USER_ROLES.TECHNICAL_SUPPORT,
      USER_ROLES.TECHNICAL_DIRECTOR,
      USER_ROLES.MANAGER,
      USER_ROLES.EXPEDITOR,
      USER_ROLES.PLANNING,
      USER_ROLES.LABORATORY_USER,
      USER_ROLES.LABORATORY_MANAGER,
      USER_ROLES.QUALITY_ASSURANCE,
      USER_ROLES.QUALITY_MANAGER,
      USER_ROLES.DISPATCH,
      USER_ROLES.BUYER,
      USER_ROLES.SALES_MANAGER,
      USER_ROLES.COMPANY_OWNER,
      USER_ROLES.ADMINISTRATOR,
    ],
  }),
  preview({
    id: PREVIEW_IDS.EXECUTIVE_DEMO,
    product: 'Rhomberg Connect',
    platform: 'Executive Workflow Demo',
    displayName: 'Rhomberg Connect — Executive Workflow Demo',
    shortName: 'Executive Demo',
    description: 'A guided, fabricated-data presentation across the complete customer and internal workflow.',
    intendedUsers: 'Company owner, management, IT and authorised demonstration presenters',
    device: 'Desktop presentation',
    route: '/demo/executive-workflow/',
    sourcePath: 'demo/executive-workflow',
    executiveDemo: true,
    allowedRoles: Object.values(USER_ROLES),
  }),
]);

export const PREVIEW_BY_ID = Object.freeze(Object.fromEntries(PREVIEW_DEFINITIONS.map(item => [item.id, item])));

const normalisePath = pathname => {
  const value = String(pathname || '/').replaceAll('\\', '/');
  return value.startsWith('/') ? value : `/${value}`;
};

export const previewIdFromPath = pathname => {
  const path = normalisePath(pathname);
  if (/\/demo\/executive-workflow(?:\/|\/index\.html)?$/i.test(path)) return PREVIEW_IDS.EXECUTIVE_DEMO;
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
      product: 'Rhomberg Connect',
      platform: 'Preview selector',
      displayName: 'Rhomberg Connect Preview Centre',
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
  const executiveMarker = '/demo/executive-workflow';
  const executiveIndex = path.toLowerCase().indexOf(executiveMarker);
  if (executiveIndex >= 0) return `${path.slice(0, executiveIndex)}/`;
  const marker = '/preview/';
  const index = path.toLowerCase().indexOf(marker);
  return index >= 0 ? `${path.slice(0, index)}/` : './';
};
