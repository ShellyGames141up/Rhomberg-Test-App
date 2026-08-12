import { USER_ROLES } from '../../services/contracts.js';

const PRODUCTION_CONTEXT = Object.freeze({
  id: 'private-cloud',
  product: 'Rhomberg Connect',
  platform: 'Application',
  displayName: 'Rhomberg Connect',
  allowedRoles: Object.freeze(Object.values(USER_ROLES)),
  unified: true,
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
