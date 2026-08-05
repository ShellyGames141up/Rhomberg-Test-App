import { accountCan, PERMISSIONS, roleCan, USER_ROLES } from '../services/contracts.js';
import { orderRequiresLaboratory } from './certification.js';

const navItem = (id, glyph, label) => Object.freeze({ id, glyph, label });

const CUSTOMER_NAVIGATION = Object.freeze([
  navItem('home', '⌂', 'Home'),
  navItem('catalogue', '◇', 'Catalogue'),
  navItem('enquiry', '+', 'Enquire'),
  navItem('tracking', '◎', 'Orders'),
  navItem('notifications', '!', 'Alerts'),
]);

const internalNavigation = (workspaceLabel, includeAudit = false, includeArchive = false) => Object.freeze([
  navItem('expeditor', '↻', workspaceLabel),
  navItem('notifications', '!', 'Alerts'),
  ...(includeArchive ? [navItem('archive', '□', 'Archive')] : []),
  ...(includeAudit ? [navItem('audit', '≡', 'Audit')] : []),
  navItem('account', '○', 'Account'),
]);

const representativeOrderNavigation = (workspaceLabel, includeAudit = false) => Object.freeze([
  navItem('expeditor', 'R', workspaceLabel),
  navItem('load-order', '+', 'Load order'),
  navItem('notifications', '!', 'Alerts'),
  ...(includeAudit ? [navItem('audit', 'A', 'Audit')] : []),
  navItem('account', 'O', 'Account'),
]);

const CUSTOMER_VIEWS = Object.freeze(['home', 'catalogue', 'product', 'configurator', 'enquiry', 'tracking', 'notifications', 'account', 'settings']);
const INTERNAL_VIEWS = Object.freeze(['expeditor', 'notifications', 'account']);
const REPRESENTATIVE_ORDER_VIEWS = Object.freeze([...INTERNAL_VIEWS, 'load-order']);
const OVERSIGHT_VIEWS = Object.freeze([...INTERNAL_VIEWS, 'archive', 'audit']);
const ADMIN_VIEWS = Object.freeze(['administration', 'load-order', ...OVERSIGHT_VIEWS]);
const ADMIN_NAVIGATION = Object.freeze([
  navItem('administration', 'A', 'Admin'),
  navItem('expeditor', '\u25C7', 'Overview'),
  navItem('load-order', '+', 'Load order'),
  navItem('notifications', '!', 'Alerts'),
  navItem('archive', '\u25A1', 'Archive'),
  navItem('audit', '\u2261', 'Audit'),
  navItem('account', '\u25CB', 'Account'),
]);

const profile = ({
  role,
  label,
  workspaceLabel,
  defaultView = 'expeditor',
  navigation = internalNavigation(workspaceLabel),
  allowedViews = INTERNAL_VIEWS,
  dashboard,
  commercialReporting = null,
}) => Object.freeze({
  role,
  label,
  workspaceLabel,
  defaultView,
  navigation,
  allowedViews,
  dashboard: dashboard ? Object.freeze(dashboard) : null,
  commercialReporting: commercialReporting ? Object.freeze(commercialReporting) : null,
});

export const ROLE_PROFILES = Object.freeze({
  [USER_ROLES.CUSTOMER]: profile({
    role: USER_ROLES.CUSTOMER,
    label: 'Customer',
    workspaceLabel: 'Company account',
    defaultView: 'home',
    navigation: CUSTOMER_NAVIGATION,
    allowedViews: CUSTOMER_VIEWS,
  }),
  [USER_ROLES.SALES_REPRESENTATIVE]: profile({
    role: USER_ROLES.SALES_REPRESENTATIVE,
    label: 'Sales representative',
    workspaceLabel: 'RFQs',
    navigation: representativeOrderNavigation('RFQs'),
    allowedViews: REPRESENTATIVE_ORDER_VIEWS,
    dashboard: {
      eyebrow: 'Sales representative inbox',
      headline: 'Your RFQs are ready.',
      description: 'Open newly assigned requests, start the review and keep every quotation moving through the controlled RFQ workflow.',
      queue: 'Representative inbox',
    },
  }),
  [USER_ROLES.PLANNING]: profile({
    role: USER_ROLES.PLANNING,
    label: 'Planning',
    workspaceLabel: 'Planning',
    dashboard: {
      eyebrow: 'Planning workspace',
      headline: 'Accepted orders need a plan.',
      description: 'Add the internal job and customer PO references before handing each accepted order to Expediting.',
      queue: 'Planning queue',
    },
  }),
  [USER_ROLES.EXPEDITOR]: profile({
    role: USER_ROLES.EXPEDITOR,
    label: 'Expeditor',
    workspaceLabel: 'Orders',
    dashboard: {
      eyebrow: 'Expediting workspace',
      headline: 'Orders need an update.',
      description: 'Keep production and fulfilment stages current, then hand completed work to Dispatch.',
      queue: 'Daily expediting queue',
    },
  }),
  [USER_ROLES.LABORATORY_USER]: profile({
    role: USER_ROLES.LABORATORY_USER,
    label: 'Laboratory user',
    workspaceLabel: 'Laboratory',
    dashboard: {
      eyebrow: 'Laboratory workspace',
      headline: 'Calibration work, unit by unit.',
      description: 'Receive SANAS and Traceable orders, maintain one controlled task per physical unit and prepare certificates for release.',
      queue: 'Laboratory queue',
    },
  }),
  [USER_ROLES.LABORATORY_TECHNICIAN]: profile({
    role: USER_ROLES.LABORATORY_TECHNICIAN,
    label: 'Laboratory technician',
    workspaceLabel: 'Laboratory',
    dashboard: {
      eyebrow: 'Technician workspace',
      headline: 'Measure, calculate and preserve the raw record.',
      description: 'Complete receipt, inspection, booking, method-specific readings, labelling and transfer without access to management-only certificate controls.',
      queue: 'Assigned Laboratory jobs',
    },
  }),
  [USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN]: profile({
    role: USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN,
    label: 'Temperature technician',
    workspaceLabel: 'Laboratory',
    dashboard: {
      eyebrow: 'Temperature Laboratory',
      headline: 'Temperature work, point by point.',
      description: 'Capture repeated temperature measurements and approved reference-standard data in a structured worksheet.',
      queue: 'Temperature calibration jobs',
    },
  }),
  [USER_ROLES.LABORATORY_MANAGER]: profile({
    role: USER_ROLES.LABORATORY_MANAGER,
    label: 'Laboratory manager',
    workspaceLabel: 'Laboratory',
    navigation: internalNavigation('Laboratory', true),
    allowedViews: Object.freeze([...INTERNAL_VIEWS, 'audit']),
    dashboard: {
      eyebrow: 'Laboratory control',
      headline: 'Calibration and certificates under control.',
      description: 'Review unit results, verify certificate completeness and authorise controlled Laboratory release.',
      queue: 'Laboratory release queue',
    },
  }),
  [USER_ROLES.TECHNICAL_SIGNATORY]: profile({
    role: USER_ROLES.TECHNICAL_SIGNATORY,
    label: 'Technical signatory',
    workspaceLabel: 'Laboratory review',
    navigation: internalNavigation('Laboratory', true),
    allowedViews: Object.freeze([...INTERNAL_VIEWS, 'audit']),
    dashboard: {
      eyebrow: 'Technical signatory review',
      headline: 'Approve the evidence before release.',
      description: 'Review calculations, certificate values and immutable signing records without overwriting technician raw data.',
      queue: 'Certificates awaiting signature',
    },
  }),
  [USER_ROLES.LABORATORY_ADMINISTRATOR]: profile({
    role: USER_ROLES.LABORATORY_ADMINISTRATOR,
    label: 'Laboratory administrator',
    workspaceLabel: 'Laboratory control',
    navigation: internalNavigation('Laboratory', true),
    allowedViews: Object.freeze([...INTERNAL_VIEWS, 'audit']),
    dashboard: {
      eyebrow: 'Laboratory administration',
      headline: 'Templates and standards under control.',
      description: 'Maintain approved Laboratory configuration and reference-standard metadata without changing raw measurements or signed certificates.',
      queue: 'Laboratory configuration',
    },
  }),
  [USER_ROLES.QUALITY_ASSURANCE]: profile({
    role: USER_ROLES.QUALITY_ASSURANCE,
    label: 'Quality assurance',
    workspaceLabel: 'Quality',
    dashboard: {
      eyebrow: 'Quality Assurance workspace',
      headline: 'Inspect, correct and release with confidence.',
      description: 'Inspect non-Laboratory orders, record controlled findings and preserve every rework and reinspection cycle.',
      queue: 'QA inspection queue',
    },
  }),
  [USER_ROLES.QUALITY_MANAGER]: profile({
    role: USER_ROLES.QUALITY_MANAGER,
    label: 'Quality manager',
    workspaceLabel: 'Quality',
    navigation: internalNavigation('Quality', true),
    allowedViews: Object.freeze([...INTERNAL_VIEWS, 'audit']),
    dashboard: {
      eyebrow: 'Quality management',
      headline: 'Quality performance and exceptions.',
      description: 'Manage inspection queues, failures, corrective work and controlled release to Dispatch.',
      queue: 'QA oversight',
    },
  }),
  [USER_ROLES.DISPATCH]: profile({
    role: USER_ROLES.DISPATCH,
    label: 'Dispatch',
    workspaceLabel: 'Dispatch',
    dashboard: {
      eyebrow: 'Dispatch workspace',
      headline: 'Ready orders need handover.',
      description: 'Release collection or delivery orders and confirm the final customer handover.',
      queue: 'Dispatch queue',
    },
  }),
  [USER_ROLES.BUYER]: profile({
    role: USER_ROLES.BUYER,
    label: 'Buyer',
    workspaceLabel: 'Buyer',
    dashboard: {
      eyebrow: 'Buyer workspace',
      headline: 'Procurement workflow is prepared.',
      description: 'The Buyer role is available for secure sign-in, but its procurement queue and actions remain inactive until that workflow is approved.',
      queue: 'Buyer workflow inactive',
    },
  }),
  [USER_ROLES.SALES_MANAGER]: profile({
    role: USER_ROLES.SALES_MANAGER,
    label: 'Sales manager',
    workspaceLabel: 'Sales analytics',
    navigation: representativeOrderNavigation('Sales', true),
    allowedViews: Object.freeze([...REPRESENTATIVE_ORDER_VIEWS, 'audit']),
    commercialReporting: { representativeFilterLabel: 'Representative' },
    dashboard: {
      eyebrow: 'Sales management',
      headline: 'Customer activity and unit demand.',
      description: 'Review representative workload, RFQ movement and product quantities without exposing protected pricing.',
      queue: 'Sales overview',
    },
  }),
  [USER_ROLES.COMPANY_OWNER]: profile({
    role: USER_ROLES.COMPANY_OWNER,
    label: 'Company owner',
    workspaceLabel: 'Executive',
    navigation: internalNavigation('Executive', true, true),
    allowedViews: OVERSIGHT_VIEWS,
    commercialReporting: { representativeFilterLabel: 'Representative scope' },
    dashboard: {
      eyebrow: 'Executive overview',
      headline: 'Operations, demand and service performance.',
      description: 'Review company-wide workflow health, laboratory throughput, quality performance and unit-volume trends.',
      queue: 'Executive dashboard',
    },
  }),
  [USER_ROLES.MANAGER]: profile({
    role: USER_ROLES.MANAGER,
    label: 'Manager',
    workspaceLabel: 'Oversight',
    navigation: internalNavigation('Oversight', true, true),
    allowedViews: OVERSIGHT_VIEWS,
    dashboard: {
      eyebrow: 'Management oversight',
      headline: 'Workflow health at a glance.',
      description: 'Review activity across RFQs and orders. Controlled overrides remain separately authorised and audited.',
      queue: 'Operational oversight',
    },
  }),
  [USER_ROLES.ADMINISTRATOR]: profile({
    role: USER_ROLES.ADMINISTRATOR,
    label: 'Administrator',
    workspaceLabel: 'Admin',
    defaultView: 'administration',
    navigation: ADMIN_NAVIGATION,
    allowedViews: ADMIN_VIEWS,
    dashboard: {
      eyebrow: 'Administration workspace',
      headline: 'Controlled workflow oversight.',
      description: 'Review the complete test workflow with all important actions recorded in the audit history.',
      queue: 'Administration queue',
    },
  }),
});

const UNKNOWN_ROLE_PROFILE = profile({
  role: 'unknown',
  label: 'Unknown role',
  workspaceLabel: 'Account',
  defaultView: 'account',
  navigation: Object.freeze([navItem('account', '○', 'Account')]),
  allowedViews: Object.freeze(['account']),
  dashboard: {
    eyebrow: 'Restricted workspace',
    headline: 'No operational access is assigned.',
    description: 'Ask an administrator to review this account role.',
    queue: 'No authorised queue',
  },
});

export const roleProfileFor = role => ROLE_PROFILES[role] || UNKNOWN_ROLE_PROFILE;
export const navigationItemsForRole = role => roleProfileFor(role).navigation;
export const defaultViewForRole = role => roleProfileFor(role).defaultView;
export const normaliseViewForRole = (role, requestedView) => {
  const currentProfile = roleProfileFor(role);
  return currentProfile.allowedViews.includes(requestedView) ? requestedView : currentProfile.defaultView;
};
export const isInternalRole = role => roleCan(role, PERMISSIONS.ACCESS_INTERNAL_WORKSPACE);
export const isInternalAccount = account => accountCan(account, PERMISSIONS.ACCESS_INTERNAL_WORKSPACE);
export const isCustomerAccount = account => (
  accountCan(account, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE)
  && !accountCan(account, PERMISSIONS.ACCESS_INTERNAL_WORKSPACE)
);
export const usesRepresentativeInbox = account => (
  accountCan(account, PERMISSIONS.VIEW_ASSIGNED_RFQS)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_RFQS)
  && Boolean(account?.representativeId)
);
export const usesPlanningWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_PLANNING_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);
export const usesExpeditorWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_EXPEDITING_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);
export const usesDispatchWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_DISPATCH_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);
export const usesLaboratoryWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_LAB_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);
export const usesQualityWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_QA_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);

export const ORDER_QUEUE_SCOPES = Object.freeze({
  [PERMISSIONS.VIEW_PLANNING_QUEUE]: Object.freeze(['awaiting_planning', 'planning_in_progress', 'planned']),
  [PERMISSIONS.VIEW_EXPEDITING_QUEUE]: Object.freeze([
    'awaiting_lab_receipt_expediting', 'submitted_to_expediting', 'expediting_in_progress',
    'qa_failed', 'returned_to_expediting', 'awaiting_qa', 'awaiting_dispatch',
  ]),
  [PERMISSIONS.VIEW_LAB_QUEUE]: Object.freeze([
    'awaiting_lab', 'lab_received', 'calibration_in_progress', 'calibration_on_hold',
    'calibration_completed', 'awaiting_lab_release', 'released_from_lab',
  ]),
  [PERMISSIONS.VIEW_QA_QUEUE]: Object.freeze([
    'awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_expediting',
    'qa_reinspection_required', 'qa_passed',
  ]),
  [PERMISSIONS.VIEW_DISPATCH_QUEUE]: Object.freeze([
    'awaiting_lab_receipt_dispatch', 'awaiting_dispatch', 'ready_for_collection',
    'out_for_delivery', 'delivered', 'collected',
  ]),
});

const representativeIdFor = record => record?.representativeId || record?.selectedRep?.id || '';
const orderStageForScope = record => record?.trackingStatus === 'on_hold'
  ? record?.workflowContext?.resumeStatus || ''
  : record?.trackingStatus || '';

export const orderMatchesQueuePermission = (record, permission) => {
  const statuses = ORDER_QUEUE_SCOPES[permission] || [];
  return statuses.includes(orderStageForScope(record));
};

export const canAccessRecord = (account, record) => {
  if (!account || !record) return false;
  const isOrder = record.workflowType === 'order';
  if (
    Array.isArray(account.authorisedCompanyIds)
    && account.authorisedCompanyIds.length
    && !account.authorisedCompanyIds.includes(record.companyId)
  ) return false;

  if (isOrder && roleCan(account.role, PERMISSIONS.VIEW_ALL_ORDERS)) return true;
  if (!isOrder && roleCan(account.role, PERMISSIONS.VIEW_ALL_RFQS)) return true;

  if (isOrder && roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_ORDERS)) {
    return Boolean(account.companyId) && record.companyId === account.companyId;
  }
  if (!isOrder && roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_RFQS)) {
    return Boolean(account.companyId) && record.companyId === account.companyId;
  }

  if (isOrder && roleCan(account.role, PERMISSIONS.VIEW_ASSIGNED_ORDERS)) {
    return Boolean(account.representativeId) && representativeIdFor(record) === account.representativeId;
  }
  if (!isOrder && roleCan(account.role, PERMISSIONS.VIEW_ASSIGNED_RFQS)) {
    return Boolean(account.representativeId) && representativeIdFor(record) === account.representativeId;
  }

  if (
    isOrder
    && roleCan(account.role, PERMISSIONS.VIEW_LAB_QUEUE)
    && orderRequiresLaboratory(record)
  ) return true;

  if (isOrder) {
    return Object.keys(ORDER_QUEUE_SCOPES).some(permission => (
      roleCan(account.role, permission) && orderMatchesQueuePermission(record, permission)
    ));
  }
  return false;
};

export const canAccessNotification = (account, notification) => {
  if (!account || !notification) return false;
  if (
    Array.isArray(account.authorisedCompanyIds)
    && account.authorisedCompanyIds.length
    && !account.authorisedCompanyIds.includes(notification.companyId)
  ) return false;
  const recipients = notification.recipients || [];
  if (roleCan(account.role, PERMISSIONS.VIEW_ALL_RFQS) || roleCan(account.role, PERMISSIONS.VIEW_ALL_ORDERS)) return true;
  if (
    roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_RFQS)
    || roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_ORDERS)
  ) {
    return notification.customerVisible !== false
      && notification.companyId === account.companyId
      && recipients.includes('customer');
  }
  if (
    roleCan(account.role, PERMISSIONS.VIEW_ASSIGNED_RFQS)
    || roleCan(account.role, PERMISSIONS.VIEW_ASSIGNED_ORDERS)
  ) {
    return notification.representativeId === account.representativeId
      && recipients.some(recipient => ['assigned_representative', 'selected_representative'].includes(recipient));
  }
  return isInternalRole(account.role) && recipients.includes(account.role);
};
