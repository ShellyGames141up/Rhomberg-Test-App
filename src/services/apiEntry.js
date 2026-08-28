import { createApiServices } from './api/createApiServices.js';
import { runtimeConfig } from './runtimeConfig.js';

export const services = createApiServices(runtimeConfig);

export {
  accountCan,
  accountCanPerformWorkflow,
  friendlyServiceError,
  PERMISSIONS,
  permissionsForRole,
  ROLE_PERMISSIONS,
  roleCan,
  roleCanAny,
  ServiceError,
  USER_ROLES,
  WORKFLOW_ACTION_PERMISSIONS,
} from './contracts.js';
export {
  canListOrders,
  canListRfqs,
  defaultViewForRole,
  isCustomerAccount,
  isInternalAccount,
  navigationItemsForRole,
  normaliseViewForRole,
  roleProfileFor,
  usesDispatchWorkspace,
  usesExpeditorWorkspace,
  usesLaboratoryWorkspace,
  usesPlanningWorkspace,
  usesQualityWorkspace,
  usesRepresentativeInbox,
  usesSalesWorkspace,
} from '../domain/accessControl.js';
export { MAX_PO_FILE_BYTES } from './validation.js';
