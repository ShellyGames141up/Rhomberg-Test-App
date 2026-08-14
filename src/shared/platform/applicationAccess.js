import { USER_ROLES } from '../../services/contracts.js';

export const APPLICATION_SURFACES = Object.freeze({
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
});

const access = (desktop, mobile, status = 'active') => Object.freeze({ desktop, mobile, status });

// This is the single device-access authority for normal Rhomberg Connect routes.
// Workflow permissions remain owned by services/contracts.js and are not duplicated here.
export const APPLICATION_ACCESS_MATRIX = Object.freeze({
  [USER_ROLES.CUSTOMER]: access(true, true),
  [USER_ROLES.SALES_REPRESENTATIVE]: access(true, true),
  [USER_ROLES.EXPEDITOR]: access(true, true),
  [USER_ROLES.MANAGER]: access(true, true),
  [USER_ROLES.PLANNING]: access(true, false),
  [USER_ROLES.DISPATCH]: access(true, false),
  [USER_ROLES.LABORATORY_USER]: access(false, false, 'future_inactive'),
  [USER_ROLES.LABORATORY_TECHNICIAN]: access(false, false, 'future_inactive'),
  [USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN]: access(false, false, 'future_inactive'),
  [USER_ROLES.LABORATORY_MANAGER]: access(true, false),
  [USER_ROLES.TECHNICAL_SIGNATORY]: access(false, false, 'future_inactive'),
  [USER_ROLES.LABORATORY_ADMINISTRATOR]: access(false, false, 'future_inactive'),
  [USER_ROLES.QUALITY_ASSURANCE]: access(true, false),
  [USER_ROLES.QUALITY_MANAGER]: access(true, false),
  [USER_ROLES.TECHNICAL_SUPPORT]: access(true, false),
  [USER_ROLES.TECHNICAL_DIRECTOR]: access(true, false),
  [USER_ROLES.SALES_MANAGER]: access(true, false),
  [USER_ROLES.COMPANY_OWNER]: access(true, false),
  [USER_ROLES.ADMINISTRATOR]: access(true, false),
  [USER_ROLES.BUYER]: access(true, false, 'prepared_inactive'),
});

export const rolesForApplicationSurface = surface => Object.freeze(
  Object.entries(APPLICATION_ACCESS_MATRIX)
    .filter(([, rule]) => rule.status === 'active' && rule[surface] === true)
    .map(([role]) => role),
);

export const applicationSurfaceAllowsRole = (surface, role) => (
  APPLICATION_ACCESS_MATRIX[role]?.status === 'active'
  && APPLICATION_ACCESS_MATRIX[role]?.[surface] === true
);

export const applicationAccessForRole = role => APPLICATION_ACCESS_MATRIX[role] || access(false, false, 'unknown');
