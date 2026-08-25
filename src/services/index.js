import { createMockServices } from './mock/createMockServices.js';

export const services = createMockServices();

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
  usesTechnicalWorkspace,
} from '../domain/accessControl.js';
export { MAX_PO_FILE_BYTES } from './validation.js';
