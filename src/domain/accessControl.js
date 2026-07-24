import { accountCan, PERMISSIONS, roleCan, USER_ROLES } from '../services/contracts.js';

const navItem = (id, glyph, label) => Object.freeze({ id, glyph, label });

const CUSTOMER_NAVIGATION = Object.freeze([
  navItem('home', '⌂', 'Home'),
  navItem('catalogue', '◇', 'Catalogue'),
  navItem('enquiry', '+', 'Enquire'),
  navItem('tracking', '◎', 'Orders'),
  navItem('notifications', '!', 'Alerts'),
]);

const internalNavigation = workspaceLabel => Object.freeze([
  navItem('expeditor', '↻', workspaceLabel),
  navItem('notifications', '!', 'Alerts'),
  navItem('account', '○', 'Account'),
]);

const CUSTOMER_VIEWS = Object.freeze(['home', 'catalogue', 'product', 'configurator', 'enquiry', 'tracking', 'notifications', 'account']);
const INTERNAL_VIEWS = Object.freeze(['expeditor', 'notifications', 'account']);

const profile = ({
  role,
  label,
  workspaceLabel,
  defaultView = 'expeditor',
  navigation = internalNavigation(workspaceLabel),
  allowedViews = INTERNAL_VIEWS,
  dashboard,
}) => Object.freeze({
  role,
  label,
  workspaceLabel,
  defaultView,
  navigation,
  allowedViews,
  dashboard: dashboard ? Object.freeze(dashboard) : null,
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
  [USER_ROLES.MANAGER]: profile({
    role: USER_ROLES.MANAGER,
    label: 'Manager',
    workspaceLabel: 'Oversight',
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
export const usesPlanningWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_PLANNING_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);
export const usesExpeditorWorkspace = account => (
  accountCan(account, PERMISSIONS.VIEW_EXPEDITING_QUEUE)
  && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
);

export const ORDER_QUEUE_SCOPES = Object.freeze({
  [PERMISSIONS.VIEW_PLANNING_QUEUE]: Object.freeze(['awaiting_planning', 'planning_in_progress', 'planned']),
  [PERMISSIONS.VIEW_EXPEDITING_QUEUE]: Object.freeze(['submitted_to_expediting', 'expediting_in_progress', 'awaiting_dispatch']),
  [PERMISSIONS.VIEW_DISPATCH_QUEUE]: Object.freeze(['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected']),
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

  if (isOrder) {
    return Object.keys(ORDER_QUEUE_SCOPES).some(permission => (
      roleCan(account.role, permission) && orderMatchesQueuePermission(record, permission)
    ));
  }
  return false;
};

export const canAccessNotification = (account, notification) => {
  if (!account || !notification) return false;
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
