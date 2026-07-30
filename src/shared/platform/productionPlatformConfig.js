import { USER_ROLES } from '../../services/contracts.js';

const PRODUCTION_CONTEXT = Object.freeze({
  id: 'private-cloud',
  product: 'Rhomberg Operations',
  platform: 'Internal Desktop',
  displayName: 'Rhomberg Operations',
  allowedRoles: Object.freeze([
    USER_ROLES.SALES_REPRESENTATIVE,
    USER_ROLES.PLANNING,
    USER_ROLES.EXPEDITOR,
    USER_ROLES.LABORATORY_USER,
    USER_ROLES.LABORATORY_MANAGER,
    USER_ROLES.QUALITY_ASSURANCE,
    USER_ROLES.QUALITY_MANAGER,
    USER_ROLES.DISPATCH,
    USER_ROLES.BUYER,
    USER_ROLES.SALES_MANAGER,
    USER_ROLES.COMPANY_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.ADMINISTRATOR,
  ]),
  customer: false,
  internal: true,
  landing: false,
  unsupported: false,
  mobile: false,
  desktop: true,
});

export const PREVIEW_BY_ID = Object.freeze({});
export const previewContextForPath = () => PRODUCTION_CONTEXT;
export const previewAllowsRole = (context, role) => Boolean(context?.allowedRoles?.includes(role));
export const filterDemoLoginsForPreview = () => [];
