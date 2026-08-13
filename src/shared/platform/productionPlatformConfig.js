import { APPLICATION_SURFACES, rolesForApplicationSurface } from './applicationAccess.js';

const contextForSurface = surface => Object.freeze({
  id: 'private-cloud',
  product: 'Rhomberg Connect',
  platform: 'Application',
  displayName: 'Rhomberg Connect',
  allowedRoles: rolesForApplicationSurface(surface),
  unified: true,
  customer: false,
  internal: true,
  landing: false,
  unsupported: false,
  mobile: surface === APPLICATION_SURFACES.MOBILE,
  desktop: surface === APPLICATION_SURFACES.DESKTOP,
});

export const PREVIEW_BY_ID = Object.freeze({});
export const previewContextForPath = pathname => contextForSurface(/\/mobile(?:\/|\/index\.html)?$/i.test(String(pathname || '')) ? APPLICATION_SURFACES.MOBILE : APPLICATION_SURFACES.DESKTOP);
export const previewAllowsRole = (context, role) => Boolean(context?.allowedRoles?.includes(role));
export const previewNavigationAllowed = () => false;
export const filterDemoLoginsForPreview = () => [];
