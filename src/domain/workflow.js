import { ServiceError, USER_ROLES } from '../services/contracts.js';

export const WORKFLOW_ENTITY_TYPES = Object.freeze({
  RFQ: 'rfq',
  ORDER: 'order',
});

export const SYSTEM_ACTOR_ROLE = 'system';

export const RFQ_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'assigned_to_rep',
  'under_rep_review',
  'quoted',
  'awaiting_customer_acceptance',
  'accepted',
  'cancelled',
  'expired',
  'converted_to_order',
]);

export const ORDER_STATUSES = Object.freeze([
  'awaiting_planning',
  'planning_in_progress',
  'planned',
  'submitted_to_expediting',
  'expediting_in_progress',
  'awaiting_dispatch',
  'ready_for_collection',
  'out_for_delivery',
  'delivered',
  'collected',
  'completed',
  'on_hold',
  'cancelled',
  'archived',
]);

const status = (id, entityType, label, customerDescription, internalDescription, customerVisible, progress) => Object.freeze({
  id,
  entityType,
  label,
  customerDescription,
  internalDescription,
  customerVisible,
  progress,
});

export const WORKFLOW_STATUS_DEFINITIONS = Object.freeze({
  [WORKFLOW_ENTITY_TYPES.RFQ]: Object.freeze({
    draft: status('draft', 'rfq', 'Draft', 'Your RFQ has not been submitted yet.', 'Customer-owned draft; no internal processing may begin.', false, 5),
    submitted: status('submitted', 'rfq', 'RFQ submitted', 'Your RFQ has been received.', 'RFQ received and awaiting representative assignment.', true, 15),
    assigned_to_rep: status('assigned_to_rep', 'rfq', 'Assigned to representative', 'Your RFQ has been routed to the appropriate sales team.', 'RFQ has an assigned representative but review has not started.', false, 25),
    under_rep_review: status('under_rep_review', 'rfq', 'Under representative review', 'Your representative is reviewing the application and configuration.', 'Assigned representative is preparing the external quotation.', true, 40),
    quoted: status('quoted', 'rfq', 'Quotation sent', 'Your quotation has been sent using the agreed contact channel.', 'Representative confirmed that the external quotation was sent.', true, 60),
    awaiting_customer_acceptance: status('awaiting_customer_acceptance', 'rfq', 'Awaiting customer acceptance', 'Rhomberg is waiting for your acceptance, payment or Purchase Order.', 'Quotation is awaiting external acceptance evidence.', true, 70),
    accepted: status('accepted', 'rfq', 'RFQ accepted', 'Your acceptance has been confirmed and the order can now be created.', 'Representative confirmed acceptance evidence.', true, 85),
    cancelled: status('cancelled', 'rfq', 'RFQ cancelled', 'This RFQ has been cancelled.', 'RFQ is terminal and cannot be processed without an authorised override.', true, 100),
    expired: status('expired', 'rfq', 'RFQ expired', 'This RFQ has expired. Please contact your representative if it is still required.', 'RFQ expired under the configured validity policy.', true, 100),
    converted_to_order: status('converted_to_order', 'rfq', 'Converted to order', 'Your accepted RFQ has been converted into an order.', 'RFQ is terminal and linked to a newly created order.', true, 100),
  }),
  [WORKFLOW_ENTITY_TYPES.ORDER]: Object.freeze({
    awaiting_planning: status('awaiting_planning', 'order', 'Awaiting planning', 'Your order has been accepted and is waiting to be planned.', 'Accepted order is queued for Planning.', true, 8),
    planning_in_progress: status('planning_in_progress', 'order', 'Planning in progress', 'Your order is being prepared for production or fulfilment.', 'Planning is assigning the internal job and validating the customer PO.', true, 18),
    planned: status('planned', 'order', 'Planning completed', 'Planning for your order has been completed.', 'Internal job and customer PO references are complete.', false, 28),
    submitted_to_expediting: status('submitted_to_expediting', 'order', 'Submitted to expediting', 'Your order has entered the fulfilment queue.', 'Planning handed the order to Expediting.', true, 36),
    expediting_in_progress: status('expediting_in_progress', 'order', 'In progress', 'Your instruments are being manufactured or prepared.', 'Expeditor owns daily production and fulfilment updates.', true, 52),
    awaiting_dispatch: status('awaiting_dispatch', 'order', 'Awaiting dispatch', 'Your order has completed fulfilment and is being prepared for handover.', 'Expediting completed and Dispatch owns the next action.', true, 68),
    ready_for_collection: status('ready_for_collection', 'order', 'Ready for collection', 'Your order is ready for collection from the confirmed branch.', 'Dispatch has released a collection order.', true, 80),
    out_for_delivery: status('out_for_delivery', 'order', 'Out for delivery', 'Your order has left Rhomberg and is on its way.', 'Dispatch released the delivery order.', true, 82),
    delivered: status('delivered', 'order', 'Delivered', 'Your order has been delivered.', 'Dispatch recorded delivery; completion confirmation remains.', true, 92),
    collected: status('collected', 'order', 'Collected', 'Your order has been collected.', 'Dispatch recorded collection; completion confirmation remains.', true, 92),
    completed: status('completed', 'order', 'Completed', 'Your order is complete.', 'Operational workflow is complete and the retention clock may begin.', true, 100),
    on_hold: status('on_hold', 'order', 'On hold', 'Your order needs information or action before work can continue.', 'Workflow is paused; the previous status is retained for controlled resumption.', true, 50),
    cancelled: status('cancelled', 'order', 'Order cancelled', 'This order has been cancelled.', 'Order is terminal and cannot continue without an authorised override.', true, 100),
    archived: status('archived', 'order', 'Archived', 'This completed order has been archived.', 'Order was archived under the configured retention policy.', false, 100),
  }),
});

const required = (path, label) => Object.freeze({ path, label });
const INTERNAL_MANAGEMENT = Object.freeze([USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR]);
const REP_ACTION_ROLES = Object.freeze([USER_ROLES.SALES_REPRESENTATIVE, ...INTERNAL_MANAGEMENT]);
const PLANNING_ACTION_ROLES = Object.freeze([USER_ROLES.PLANNING, ...INTERNAL_MANAGEMENT]);
const EXPEDITING_ACTION_ROLES = Object.freeze([USER_ROLES.EXPEDITOR, ...INTERNAL_MANAGEMENT]);
const DISPATCH_ACTION_ROLES = Object.freeze([USER_ROLES.DISPATCH, ...INTERNAL_MANAGEMENT]);

const transition = ({
  action,
  entityType,
  from,
  to,
  roles,
  label,
  requiredFields = [],
  customerDescription,
  internalDescription,
  generatesNotification = false,
  notificationRecipients = [],
  requiresComment = false,
  timestampField = '',
  customerVisible,
  requiresAssignedRepresentative = false,
  guard = '',
  persistInputFields = [],
}) => Object.freeze({
  action,
  entityType,
  from,
  to,
  roles: Object.freeze([...roles]),
  requiredFields: Object.freeze([...requiredFields]),
  label,
  customerDescription,
  internalDescription,
  generatesNotification,
  notificationRecipients: Object.freeze([...notificationRecipients]),
  requiresComment,
  recordsTimestamp: Boolean(timestampField),
  timestampField,
  customerVisible: customerVisible ?? WORKFLOW_STATUS_DEFINITIONS[entityType]?.[to]?.customerVisible ?? false,
  requiresAssignedRepresentative,
  guard,
  persistInputFields: Object.freeze([...persistInputFields]),
});

const rfqTransition = config => transition({ entityType: WORKFLOW_ENTITY_TYPES.RFQ, ...config });
const orderTransition = config => transition({ entityType: WORKFLOW_ENTITY_TYPES.ORDER, ...config });

const transitions = [
  rfqTransition({
    action: 'submit_rfq', from: 'draft', to: 'submitted', roles: [USER_ROLES.CUSTOMER], label: 'Submit RFQ',
    requiredFields: [required('entity.companyId', 'Authorised company account'), required('entity.application', 'Application'), required('entity.items', 'Configured units')],
    customerDescription: 'Your RFQ was submitted successfully.', internalDescription: 'Customer submitted the RFQ.',
    generatesNotification: true, notificationRecipients: ['selected_representative'], timestampField: 'submittedAt', customerVisible: true,
  }),
  rfqTransition({
    action: 'assign_representative', from: 'submitted', to: 'assigned_to_rep', roles: [SYSTEM_ACTOR_ROLE, ...INTERNAL_MANAGEMENT], label: 'Assign representative',
    requiredFields: [required('entity.selectedRep.id', 'Assigned representative')],
    customerDescription: 'Your RFQ was routed to the sales team.', internalDescription: 'RFQ assigned to its selected representative.',
    generatesNotification: true, notificationRecipients: ['assigned_representative'], timestampField: 'assignedAt', customerVisible: false,
  }),
  rfqTransition({
    action: 'start_rep_review', from: 'assigned_to_rep', to: 'under_rep_review', roles: REP_ACTION_ROLES, label: 'Start representative review',
    customerDescription: 'Your representative started reviewing the RFQ.', internalDescription: 'Assigned representative accepted the RFQ into their review queue.',
    requiresAssignedRepresentative: true, timestampField: 'reviewStartedAt', customerVisible: true,
  }),
  rfqTransition({
    action: 'mark_quoted', from: 'under_rep_review', to: 'quoted', roles: REP_ACTION_ROLES, label: 'Mark quotation as sent',
    requiredFields: [required('input.quotationSentAt', 'Quotation sent date and time')],
    customerDescription: 'Your quotation has been sent.', internalDescription: 'Representative confirmed external quotation delivery.',
    generatesNotification: true, notificationRecipients: ['customer'], requiresAssignedRepresentative: true, timestampField: 'quotedAt', customerVisible: true,
    persistInputFields: ['quotationSentAt', 'quotationReference'],
  }),
  rfqTransition({
    action: 'await_customer_acceptance', from: 'quoted', to: 'awaiting_customer_acceptance', roles: [SYSTEM_ACTOR_ROLE, ...REP_ACTION_ROLES], label: 'Await customer acceptance',
    customerDescription: 'Rhomberg is waiting for your acceptance, payment or Purchase Order.', internalDescription: 'Quotation moved to the external acceptance stage.',
    requiresAssignedRepresentative: true, timestampField: 'awaitingAcceptanceAt', customerVisible: true,
  }),
  rfqTransition({
    action: 'accept_rfq', from: 'awaiting_customer_acceptance', to: 'accepted', roles: REP_ACTION_ROLES, label: 'Confirm acceptance',
    requiredFields: [required('input.acceptanceBasis', 'Acceptance basis')],
    customerDescription: 'Your acceptance has been confirmed.', internalDescription: 'Representative confirmed external payment or Purchase Order evidence.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true,
    requiresAssignedRepresentative: true, timestampField: 'acceptedAt', customerVisible: true, persistInputFields: ['acceptanceBasis'],
  }),
  rfqTransition({
    action: 'convert_to_order', from: 'accepted', to: 'converted_to_order', roles: [SYSTEM_ACTOR_ROLE, ...REP_ACTION_ROLES], label: 'Convert to order',
    requiredFields: [required('input.orderId', 'Created order identifier')],
    customerDescription: 'Your accepted RFQ was converted into an order.', internalDescription: 'The RFQ was linked to the newly created order.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative', 'planning'], requiresAssignedRepresentative: true,
    timestampField: 'convertedToOrderAt', customerVisible: true, persistInputFields: ['orderId'],
  }),
  ...['draft', 'submitted', 'assigned_to_rep', 'under_rep_review', 'quoted', 'awaiting_customer_acceptance'].map(from => rfqTransition({
    action: 'cancel_rfq', from, to: 'cancelled',
    roles: from === 'draft' || from === 'submitted' || from === 'awaiting_customer_acceptance'
      ? [USER_ROLES.CUSTOMER, ...INTERNAL_MANAGEMENT]
      : INTERNAL_MANAGEMENT,
    label: 'Cancel RFQ', customerDescription: 'This RFQ was cancelled.', internalDescription: 'RFQ cancelled before conversion.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'cancelledAt', customerVisible: true,
  })),
  ...['submitted', 'assigned_to_rep', 'under_rep_review', 'quoted', 'awaiting_customer_acceptance'].map(from => rfqTransition({
    action: 'expire_rfq', from, to: 'expired', roles: [SYSTEM_ACTOR_ROLE, ...INTERNAL_MANAGEMENT], label: 'Expire RFQ',
    customerDescription: 'This RFQ expired.', internalDescription: 'RFQ validity period elapsed.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'expiredAt', customerVisible: true,
  })),
  orderTransition({
    action: 'start_planning', from: 'awaiting_planning', to: 'planning_in_progress', roles: PLANNING_ACTION_ROLES, label: 'Start planning',
    customerDescription: 'Planning has started for your order.', internalDescription: 'Planning accepted the order into its work queue.',
    guard: 'accepted_order', timestampField: 'planningStartedAt', customerVisible: true,
  }),
  orderTransition({
    action: 'complete_planning', from: 'planning_in_progress', to: 'planned', roles: PLANNING_ACTION_ROLES, label: 'Complete planning',
    requiredFields: [required('input.internalJobNumber', 'Internal job number'), required('input.customerPoNumber', 'Customer Purchase Order number')],
    customerDescription: 'Planning for your order is complete.', internalDescription: 'Planning recorded the job and customer PO references.',
    timestampField: 'plannedAt', customerVisible: false, persistInputFields: ['internalJobNumber', 'customerPoNumber'],
  }),
  orderTransition({
    action: 'submit_to_expediting', from: 'planned', to: 'submitted_to_expediting', roles: PLANNING_ACTION_ROLES, label: 'Submit to expediting',
    requiredFields: [required('entity.internalJobNumber', 'Internal job number'), required('entity.customerPoNumber', 'Customer Purchase Order number')],
    customerDescription: 'Your order entered the fulfilment queue.', internalDescription: 'Planning handed the completed order plan to Expediting.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative', 'expeditor'], timestampField: 'submittedToExpeditingAt', customerVisible: true,
  }),
  orderTransition({
    action: 'start_expediting', from: 'submitted_to_expediting', to: 'expediting_in_progress', roles: EXPEDITING_ACTION_ROLES, label: 'Start expediting',
    customerDescription: 'Work has started on your instruments.', internalDescription: 'Expeditor accepted the planned order into the daily update queue.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], timestampField: 'expeditingStartedAt', customerVisible: true,
  }),
  orderTransition({
    action: 'complete_expediting', from: 'expediting_in_progress', to: 'awaiting_dispatch', roles: EXPEDITING_ACTION_ROLES, label: 'Send to dispatch',
    requiredFields: [required('input.completionCheckConfirmed', 'Completion check confirmation')],
    customerDescription: 'Your order is being prepared for handover.', internalDescription: 'Expeditor completed fulfilment and handed the order to Dispatch.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative', 'dispatch'], requiresComment: true,
    timestampField: 'submittedToDispatchAt', customerVisible: true,
  }),
  orderTransition({
    action: 'mark_ready_for_collection', from: 'awaiting_dispatch', to: 'ready_for_collection', roles: DISPATCH_ACTION_ROLES, label: 'Mark ready for collection',
    customerDescription: 'Your order is ready for collection.', internalDescription: 'Dispatch released the collection order.', guard: 'collection_order',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], timestampField: 'readyForCollectionAt', customerVisible: true,
  }),
  orderTransition({
    action: 'start_delivery', from: 'awaiting_dispatch', to: 'out_for_delivery', roles: DISPATCH_ACTION_ROLES, label: 'Start delivery',
    customerDescription: 'Your order is out for delivery.', internalDescription: 'Dispatch released the delivery order.', guard: 'delivery_order',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'outForDeliveryAt', customerVisible: true,
  }),
  orderTransition({
    action: 'confirm_delivery', from: 'out_for_delivery', to: 'delivered', roles: DISPATCH_ACTION_ROLES, label: 'Confirm delivery',
    customerDescription: 'Your order was delivered.', internalDescription: 'Dispatch recorded successful delivery.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'deliveredAt', customerVisible: true,
  }),
  orderTransition({
    action: 'confirm_collection', from: 'ready_for_collection', to: 'collected', roles: DISPATCH_ACTION_ROLES, label: 'Confirm collection',
    customerDescription: 'Your order was collected.', internalDescription: 'Dispatch recorded successful collection.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'collectedAt', customerVisible: true,
  }),
  orderTransition({
    action: 'complete_delivery', from: 'delivered', to: 'completed', roles: DISPATCH_ACTION_ROLES, label: 'Complete delivered order',
    customerDescription: 'Your order is complete.', internalDescription: 'Dispatch closed the delivered order.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], timestampField: 'completedAt', customerVisible: true,
  }),
  orderTransition({
    action: 'complete_collection', from: 'collected', to: 'completed', roles: DISPATCH_ACTION_ROLES, label: 'Complete collected order',
    customerDescription: 'Your order is complete.', internalDescription: 'Dispatch closed the collected order.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], timestampField: 'completedAt', customerVisible: true,
  }),
  ...[
    ['awaiting_planning', PLANNING_ACTION_ROLES], ['planning_in_progress', PLANNING_ACTION_ROLES], ['planned', PLANNING_ACTION_ROLES],
    ['submitted_to_expediting', EXPEDITING_ACTION_ROLES], ['expediting_in_progress', EXPEDITING_ACTION_ROLES],
    ['awaiting_dispatch', DISPATCH_ACTION_ROLES], ['ready_for_collection', DISPATCH_ACTION_ROLES], ['out_for_delivery', DISPATCH_ACTION_ROLES],
  ].map(([from, roles]) => orderTransition({
    action: 'place_on_hold', from, to: 'on_hold', roles, label: 'Place order on hold',
    customerDescription: 'Your order needs information or action before work can continue.', internalDescription: 'Order workflow was paused.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'heldAt', customerVisible: true,
  })),
  orderTransition({
    action: 'resume_order', from: 'on_hold', to: '__resume__', roles: [USER_ROLES.PLANNING, USER_ROLES.EXPEDITOR, USER_ROLES.DISPATCH, ...INTERNAL_MANAGEMENT], label: 'Resume order',
    requiredFields: [required('entity.workflowContext.resumeStatus', 'Previous workflow status')],
    customerDescription: 'Work on your order has resumed.', internalDescription: 'Order resumed at its controlled pre-hold status.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'resumedAt', customerVisible: true,
  }),
  ...ORDER_STATUSES.filter(value => !['completed', 'cancelled', 'archived'].includes(value)).map(from => orderTransition({
    action: 'cancel_order', from, to: 'cancelled', roles: INTERNAL_MANAGEMENT, label: 'Cancel order',
    customerDescription: 'This order was cancelled.', internalDescription: 'Manager or administrator cancelled the active order.',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'], requiresComment: true, timestampField: 'cancelledAt', customerVisible: true,
  })),
  ...['completed', 'cancelled'].map(from => orderTransition({
    action: 'archive_order', from, to: 'archived', roles: [SYSTEM_ACTOR_ROLE, USER_ROLES.ADMINISTRATOR], label: 'Archive order',
    requiredFields: [required('input.retentionPolicyId', 'Retention policy identifier')],
    customerDescription: 'This order was archived.', internalDescription: 'Order archived under the configured retention policy.',
    timestampField: 'archivedAt', customerVisible: false, persistInputFields: ['retentionPolicyId'],
  })),
];

export const WORKFLOW_TRANSITIONS = Object.freeze(transitions);

const OVERRIDE_TRANSITION = Object.freeze({
  action: 'override_workflow',
  from: '*',
  to: '__input__',
  roles: Object.freeze([USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR]),
  requiredFields: Object.freeze([required('input.targetStatus', 'Target status'), required('input.overrideReason', 'Override reason')]),
  label: 'Authorised workflow override',
  customerDescription: 'The workflow was corrected by an authorised manager.',
  internalDescription: 'Mandatory sequence overridden by an authorised manager or administrator.',
  generatesNotification: true,
  notificationRecipients: Object.freeze(['customer', 'assigned_representative']),
  requiresComment: true,
  recordsTimestamp: true,
  timestampField: 'workflowOverriddenAt',
  customerVisible: true,
  requiresAssignedRepresentative: false,
  guard: 'authorised_override',
  persistInputFields: Object.freeze([]),
});

const getPath = (root, path) => path.split('.').reduce((value, key) => value?.[key], root);
const isPresent = value => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

export const inferWorkflowEntityType = entity => {
  if (entity?.workflowType === WORKFLOW_ENTITY_TYPES.RFQ || entity?.workflowType === WORKFLOW_ENTITY_TYPES.ORDER) return entity.workflowType;
  if (ORDER_STATUSES.includes(entity?.trackingStatus)) return WORKFLOW_ENTITY_TYPES.ORDER;
  if (RFQ_STATUSES.includes(entity?.trackingStatus)) return WORKFLOW_ENTITY_TYPES.RFQ;
  return null;
};

export const workflowStatusById = (statusId, entityType) => {
  if (entityType) return WORKFLOW_STATUS_DEFINITIONS[entityType]?.[statusId] || null;
  return WORKFLOW_STATUS_DEFINITIONS.rfq[statusId] || WORKFLOW_STATUS_DEFINITIONS.order[statusId] || null;
};

export const workflowStatuses = Object.freeze([
  ...Object.values(WORKFLOW_STATUS_DEFINITIONS.rfq),
  ...Object.values(WORKFLOW_STATUS_DEFINITIONS.order),
]);

export const progressForWorkflowStatus = (statusId, entityType) => workflowStatusById(statusId, entityType)?.progress ?? 5;

const representativeIdFor = entity => entity?.representativeId || entity?.selectedRep?.id || '';

const assertCompanyBoundary = (entity, actor) => {
  if (actor.role !== USER_ROLES.CUSTOMER) return;
  if (!actor.companyId || actor.companyId !== entity.companyId) {
    throw new ServiceError('This record is outside your authorised company account.', { code: 'COMPANY_SCOPE_VIOLATION', status: 403 });
  }
};

const assertAssignedRepresentative = (entity, actor, transitionDefinition) => {
  if (!transitionDefinition.requiresAssignedRepresentative || actor.role !== USER_ROLES.SALES_REPRESENTATIVE) return;
  const assignedId = representativeIdFor(entity);
  if (!assignedId || assignedId !== actor.representativeId) {
    throw new ServiceError('Only the representative assigned to this RFQ can perform that action.', { code: 'REPRESENTATIVE_ASSIGNMENT_REQUIRED', status: 403 });
  }
};

const assertGuard = (entity, actor, transitionDefinition) => {
  if (transitionDefinition.guard === 'accepted_order' && !(entity.sourceRfqStatus === 'converted_to_order' && entity.acceptedAt)) {
    throw new ServiceError('Planning cannot start until the source RFQ has been accepted and converted to an order.', { code: 'ORDER_NOT_ACCEPTED', status: 409 });
  }
  if (transitionDefinition.guard === 'collection_order' && entity.fulfilment !== 'collect') {
    throw new ServiceError('Only a collection order can be marked ready for collection.', { code: 'INVALID_FULFILMENT_TRANSITION', status: 409 });
  }
  if (transitionDefinition.guard === 'delivery_order' && entity.fulfilment !== 'delivery') {
    throw new ServiceError('Only a delivery order can be sent out for delivery.', { code: 'INVALID_FULFILMENT_TRANSITION', status: 409 });
  }
  if (transitionDefinition.action === 'resume_order') {
    const resumeStatus = entity.workflowContext?.resumeStatus;
    const ownerRoles = {
      awaiting_planning: [USER_ROLES.PLANNING], planning_in_progress: [USER_ROLES.PLANNING], planned: [USER_ROLES.PLANNING],
      submitted_to_expediting: [USER_ROLES.EXPEDITOR], expediting_in_progress: [USER_ROLES.EXPEDITOR],
      awaiting_dispatch: [USER_ROLES.DISPATCH], ready_for_collection: [USER_ROLES.DISPATCH], out_for_delivery: [USER_ROLES.DISPATCH],
    };
    const allowedOwnerRoles = ownerRoles[resumeStatus] || [];
    if (!INTERNAL_MANAGEMENT.includes(actor.role) && !allowedOwnerRoles.includes(actor.role)) {
      throw new ServiceError('This role cannot resume the order at its previous workflow stage.', { code: 'WORKFLOW_ROLE_FORBIDDEN', status: 403 });
    }
  }
};

const resolveTargetStatus = (entity, transitionDefinition, input) => {
  if (transitionDefinition.to === '__resume__') return entity.workflowContext?.resumeStatus || '';
  if (transitionDefinition.to === '__input__') return String(input.targetStatus || '').trim();
  return transitionDefinition.to;
};

const findTransition = (entityType, fromStatus, action) => {
  if (action === OVERRIDE_TRANSITION.action) return { ...OVERRIDE_TRANSITION, entityType };
  return WORKFLOW_TRANSITIONS.find(item => item.entityType === entityType && item.from === fromStatus && item.action === action) || null;
};

const makeId = (prefix, idFactory) => `${prefix}-${idFactory?.() || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const validateTransition = ({ entity, action, actor, input = {}, expectedVersion }) => {
  if (!entity?.id) throw new ServiceError('The RFQ or order could not be found.', { code: 'WORKFLOW_ENTITY_NOT_FOUND', status: 404 });
  if (!actor?.id || !actor?.role) throw new ServiceError('A signed-in workflow actor is required.', { code: 'WORKFLOW_ACTOR_REQUIRED', status: 401 });
  const entityType = inferWorkflowEntityType(entity);
  if (!entityType) throw new ServiceError('This record does not have a recognised workflow type.', { code: 'INVALID_WORKFLOW_ENTITY', status: 422 });
  const currentStatus = entity.trackingStatus;
  const transitionDefinition = findTransition(entityType, currentStatus, action);
  if (!transitionDefinition) {
    throw new ServiceError('That workflow action is not available at the current stage.', { code: 'INVALID_WORKFLOW_TRANSITION', status: 409 });
  }
  if (!transitionDefinition.roles.includes(actor.role)) {
    throw new ServiceError('Your role is not permitted to perform that workflow action.', { code: 'WORKFLOW_ROLE_FORBIDDEN', status: 403 });
  }
  assertCompanyBoundary(entity, actor);
  assertAssignedRepresentative(entity, actor, transitionDefinition);
  assertGuard(entity, actor, transitionDefinition);
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(entity.version || 0)) {
    throw new ServiceError('This record changed after it was opened. Refresh it before trying again.', { code: 'WORKFLOW_VERSION_CONFLICT', status: 409 });
  }
  if (transitionDefinition.requiresComment && !String(input.comment || '').trim()) {
    throw new ServiceError('Add a comment explaining this workflow action.', { code: 'WORKFLOW_COMMENT_REQUIRED', status: 422, fieldErrors: { comment: 'A comment is required.' } });
  }
  const context = { entity, input };
  const fieldErrors = {};
  for (const requirement of transitionDefinition.requiredFields) {
    if (!isPresent(getPath(context, requirement.path))) fieldErrors[requirement.path.replace(/^input\./, '')] = `${requirement.label} is required for this action.`;
  }
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], { code: 'WORKFLOW_REQUIRED_FIELD_MISSING', status: 422, fieldErrors });
  }
  const targetStatus = resolveTargetStatus(entity, transitionDefinition, input);
  const validTargets = entityType === WORKFLOW_ENTITY_TYPES.RFQ ? RFQ_STATUSES : ORDER_STATUSES;
  if (!validTargets.includes(targetStatus) || targetStatus === currentStatus) {
    throw new ServiceError('Select a different valid status for this workflow.', { code: 'INVALID_WORKFLOW_TARGET', status: 422, fieldErrors: { targetStatus: 'Choose a valid target status.' } });
  }
  if (action === 'override_workflow' && currentStatus === 'archived') {
    throw new ServiceError('Archived records cannot be reopened from the preview workflow.', { code: 'ARCHIVED_WORKFLOW_LOCKED', status: 409 });
  }
  return { entityType, currentStatus, targetStatus, transitionDefinition };
};

export function performWorkflowTransition({ entity, action, actor, input = {}, expectedVersion, now = () => new Date(), idFactory } = {}) {
  const validated = validateTransition({ entity, action, actor, input, expectedVersion });
  const occurredAt = now().toISOString();
  const targetDefinition = workflowStatusById(validated.targetStatus, validated.entityType);
  const isOverride = action === 'override_workflow';
  const description = String(input.comment || validated.transitionDefinition.customerDescription || targetDefinition.customerDescription).trim();
  const workflowContext = { ...(entity.workflowContext || {}) };
  if (action === 'place_on_hold') workflowContext.resumeStatus = validated.currentStatus;
  if (action === 'resume_order') delete workflowContext.resumeStatus;

  const updatedEntity = {
    ...entity,
    workflowType: validated.entityType,
    trackingStatus: validated.targetStatus,
    status: targetDefinition.label,
    workflowContext,
    version: Number(entity.version || 0) + 1,
    updatedAt: occurredAt,
  };
  for (const field of validated.transitionDefinition.persistInputFields) {
    if (input[field] !== undefined) updatedEntity[field] = input[field];
  }
  if (validated.transitionDefinition.timestampField) updatedEntity[validated.transitionDefinition.timestampField] = occurredAt;

  const workflowEvent = {
    id: makeId('workflow-event', idFactory),
    entityType: validated.entityType,
    action,
    fromStatus: validated.currentStatus,
    toStatus: validated.targetStatus,
    status: validated.targetStatus,
    label: targetDefinition.label,
    note: description,
    customerDescription: validated.transitionDefinition.customerDescription,
    internalDescription: validated.transitionDefinition.internalDescription,
    customerVisible: validated.transitionDefinition.customerVisible,
    actorId: actor.id,
    actorRole: actor.role,
    actor: actor.displayName || actor.contact || actor.role,
    isOverride,
    overrideReason: isOverride ? String(input.overrideReason || '').trim() : '',
    createdAt: occurredAt,
  };
  updatedEntity.trackingHistory = [...(entity.trackingHistory || []), workflowEvent];

  const auditEvent = {
    id: makeId('audit', idFactory),
    action: `workflow.${action}`,
    outcome: 'success',
    entityType: validated.entityType,
    entityId: entity.id,
    companyId: entity.companyId,
    actorId: actor.id,
    actorRole: actor.role,
    fromStatus: validated.currentStatus,
    toStatus: validated.targetStatus,
    comment: String(input.comment || '').trim(),
    isOverride,
    createdAt: occurredAt,
  };

  return {
    entity: updatedEntity,
    workflowEvent,
    auditEvent,
    notification: validated.transitionDefinition.generatesNotification ? {
      required: true,
      recipients: [...validated.transitionDefinition.notificationRecipients],
      customerVisible: validated.transitionDefinition.customerVisible,
      status: validated.targetStatus,
      message: validated.transitionDefinition.customerDescription,
    } : { required: false, recipients: [] },
    transition: { ...validated.transitionDefinition, to: validated.targetStatus },
  };
}

export function getAllowedWorkflowActions(entity, actor) {
  if (!entity?.id || !actor?.id || !actor?.role) return [];
  const entityType = inferWorkflowEntityType(entity);
  if (!entityType) return [];
  const candidates = [
    ...WORKFLOW_TRANSITIONS.filter(item => item.entityType === entityType && item.from === entity.trackingStatus),
    ...(entity.trackingStatus !== 'archived' ? [{ ...OVERRIDE_TRANSITION, entityType }] : []),
  ];
  return candidates.filter(candidate => {
    try {
      if (!candidate.roles.includes(actor.role)) return false;
      assertCompanyBoundary(entity, actor);
      assertAssignedRepresentative(entity, actor, candidate);
      assertGuard(entity, actor, candidate);
      const targetStatus = resolveTargetStatus(entity, candidate, { targetStatus: candidate.to });
      return candidate.action === 'override_workflow' || Boolean(workflowStatusById(targetStatus, entityType));
    } catch {
      return false;
    }
  }).map(candidate => ({
    action: candidate.action,
    label: candidate.label,
    fromStatus: entity.trackingStatus,
    toStatus: candidate.action === 'override_workflow' ? '' : resolveTargetStatus(entity, candidate, { targetStatus: candidate.to }),
    requiredFields: candidate.requiredFields.map(field => ({ ...field })),
    requiresComment: candidate.requiresComment,
    generatesNotification: candidate.generatesNotification,
    customerVisible: candidate.customerVisible,
  }));
}

export const createWorkflowActor = account => ({
  id: account?.id || '',
  role: account?.role || '',
  companyId: account?.companyId || '',
  representativeId: account?.representativeId || '',
  displayName: account?.contact || account?.company || account?.role || '',
});

export function createDeniedWorkflowAudit({ entity, action, actor, error, now = () => new Date(), idFactory } = {}) {
  return {
    id: makeId('audit', idFactory),
    action: `workflow.${action || 'unknown'}`,
    outcome: 'denied',
    entityType: inferWorkflowEntityType(entity) || 'unknown',
    entityId: entity?.id || '',
    companyId: entity?.companyId || '',
    actorId: actor?.id || '',
    actorRole: actor?.role || '',
    fromStatus: entity?.trackingStatus || '',
    toStatus: '',
    errorCode: error?.code || 'WORKFLOW_ACTION_FAILED',
    createdAt: now().toISOString(),
  };
}
