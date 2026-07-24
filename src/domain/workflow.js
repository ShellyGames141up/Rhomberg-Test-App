import {
  PLANNING_PRIORITY_VALUES,
  roleCan,
  RFQ_ACCEPTANCE_TYPES,
  ServiceError,
  USER_ROLES,
  WORKFLOW_ACTION_PERMISSIONS,
} from '../services/contracts.js';
import {
  EXPEDITOR_PROGRESS_STEP_IDS,
  expeditorProgressStepById,
  missingRequiredExpeditorSteps,
} from './expediting.js';

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
    quoted: status('quoted', 'rfq', 'Quoted', 'Your quotation was emailed separately. Please acknowledge when you have received it.', 'Representative recorded the external Outlook quotation and notified the customer.', true, 60),
    awaiting_customer_acceptance: status('awaiting_customer_acceptance', 'rfq', 'Awaiting customer acceptance', 'You acknowledged receiving the quotation. This does not confirm payment, a Purchase Order or order acceptance.', 'Customer acknowledged receipt; external acceptance evidence is still required.', true, 70),
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
  notificationMessages = {},
  requiresComment = false,
  timestampField = '',
  customerVisible,
  requiresAssignedRepresentative = false,
  guard = '',
  persistInputFields = [],
  customerNotePath = '',
  auditNotePath = '',
  actorField = '',
  internalOnly = false,
  displayToStatus = '',
  allowsSameStatus = false,
  permission = WORKFLOW_ACTION_PERMISSIONS[action],
}) => Object.freeze({
  action,
  entityType,
  from,
  to,
  permission,
  roles: Object.freeze([...roles]),
  requiredFields: Object.freeze([...requiredFields]),
  label,
  customerDescription,
  internalDescription,
  generatesNotification,
  notificationRecipients: Object.freeze([...notificationRecipients]),
  notificationMessages: Object.freeze({ ...notificationMessages }),
  requiresComment,
  recordsTimestamp: Boolean(timestampField),
  timestampField,
  customerVisible: customerVisible ?? WORKFLOW_STATUS_DEFINITIONS[entityType]?.[to]?.customerVisible ?? false,
  requiresAssignedRepresentative,
  guard,
  persistInputFields: Object.freeze([...persistInputFields]),
  customerNotePath,
  auditNotePath,
  actorField,
  internalOnly,
  displayToStatus,
  allowsSameStatus,
});

const rfqTransition = config => transition({ entityType: WORKFLOW_ENTITY_TYPES.RFQ, ...config });
const orderTransition = config => transition({ entityType: WORKFLOW_ENTITY_TYPES.ORDER, ...config });

const transitions = [
  rfqTransition({
    action: 'submit_rfq', from: 'draft', to: 'submitted', roles: [USER_ROLES.CUSTOMER], label: 'Submit RFQ',
    requiredFields: [required('entity.companyId', 'Authorised company account'), required('entity.application', 'Application'), required('entity.items', 'Configured units')],
    customerDescription: 'Your RFQ was submitted successfully.', internalDescription: 'Customer submitted the RFQ.',
    generatesNotification: false, timestampField: 'submittedAt', customerVisible: true,
  }),
  rfqTransition({
    action: 'assign_representative', from: 'submitted', to: 'assigned_to_rep', roles: [SYSTEM_ACTOR_ROLE, ...INTERNAL_MANAGEMENT], label: 'Assign representative',
    requiredFields: [required('entity.selectedRep.id', 'Assigned representative')],
    customerDescription: 'Your RFQ was routed to the sales team.', internalDescription: 'RFQ assigned to its selected representative.',
    generatesNotification: true, notificationRecipients: ['assigned_representative'], timestampField: 'assignedAt', customerVisible: false,
  }),
  rfqTransition({
    action: 'start_rep_review', from: 'assigned_to_rep', to: 'under_rep_review', roles: REP_ACTION_ROLES, label: 'Start Review',
    customerDescription: 'Your representative started reviewing the RFQ.', internalDescription: 'Assigned representative accepted the RFQ into their review queue.',
    requiresAssignedRepresentative: true, timestampField: 'reviewStartedAt', customerVisible: true,
  }),
  rfqTransition({
    action: 'mark_quoted', from: 'under_rep_review', to: 'quoted', roles: REP_ACTION_ROLES, label: 'Mark as Quoted',
    requiredFields: [
      required('input.quotation.number', 'Quotation number'),
      required('input.quotation.date', 'Quotation date'),
      required('input.quotation.expiryMode', 'Quotation expiry selection'),
    ],
    customerDescription: 'Your quotation was emailed separately. Please acknowledge when you have received it.',
    internalDescription: 'Assigned representative recorded the external Outlook quotation.',
    generatesNotification: true,
    notificationRecipients: ['customer', 'assigned_representative'],
    notificationMessages: {
      customer: 'Your quotation was emailed separately. Open the RFQ to acknowledge that you received it.',
      assigned_representative: 'The quotation confirmation was saved and the customer was notified to acknowledge receipt.',
    },
    requiresAssignedRepresentative: true,
    guard: 'quotation_confirmation',
    timestampField: 'quotedAt',
    customerVisible: true,
    persistInputFields: ['quotation'],
    customerNotePath: 'input.quotation.customerNote',
    auditNotePath: 'input.quotation.internalNote',
    actorField: 'quotedBy',
  }),
  rfqTransition({
    action: 'acknowledge_quotation', from: 'quoted', to: 'awaiting_customer_acceptance', roles: [USER_ROLES.CUSTOMER], label: 'I received the quotation',
    customerDescription: 'You acknowledged receiving the quotation. This does not confirm payment, a Purchase Order or order acceptance.',
    internalDescription: 'Customer acknowledged receipt of the external quotation; commercial acceptance remains outstanding.',
    generatesNotification: true,
    notificationRecipients: ['assigned_representative'],
    notificationMessages: {
      assigned_representative: 'The customer acknowledged receiving the quotation. This acknowledgement is not order acceptance.',
    },
    timestampField: 'quotationAcknowledgedAt',
    customerVisible: true,
    actorField: 'quotationAcknowledgedBy',
  }),
  rfqTransition({
    action: 'accept_order', from: 'awaiting_customer_acceptance', to: 'accepted', roles: REP_ACTION_ROLES, label: 'Accept Order',
    requiredFields: [
      required('input.acceptance.type', 'Acceptance type'),
      required('input.acceptance.date', 'Acceptance date'),
      required('input.acceptance.internalNote', 'Internal note'),
      required('input.acceptance.verified', 'Representative verification'),
    ],
    customerDescription: 'Rhomberg confirmed your external acceptance and created an order for Planning.',
    internalDescription: 'Assigned representative verified external acceptance evidence before conversion.',
    requiresAssignedRepresentative: true,
    guard: 'order_acceptance',
    timestampField: 'acceptedAt',
    customerVisible: true,
    persistInputFields: ['acceptance'],
    auditNotePath: 'input.acceptance.internalNote',
    actorField: 'acceptedBy',
    displayToStatus: 'converted_to_order',
  }),
  rfqTransition({
    action: 'convert_to_order', from: 'accepted', to: 'converted_to_order', roles: [SYSTEM_ACTOR_ROLE, ...REP_ACTION_ROLES], label: 'Convert to order',
    requiredFields: [required('input.orderId', 'Created order identifier'), required('input.orderReference', 'Permanent order reference')],
    customerDescription: 'Your accepted RFQ was converted into an order.', internalDescription: 'The RFQ was linked to the newly created order.',
    generatesNotification: true,
    notificationRecipients: ['customer', 'assigned_representative', 'planning'],
    notificationMessages: {
      customer: 'Your acceptance was confirmed and your RFQ was converted into an order for Planning.',
      assigned_representative: 'The verified RFQ acceptance was converted into an order and routed to Planning.',
      planning: 'A newly accepted customer order is waiting for Planning.',
    },
    requiresAssignedRepresentative: true,
    timestampField: 'convertedToOrderAt',
    customerVisible: true,
    persistInputFields: ['orderId', 'orderReference'],
    internalOnly: true,
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
    guard: 'accepted_order', timestampField: 'planningStartedAt', actorField: 'planningStartedBy', customerVisible: true,
  }),
  orderTransition({
    action: 'complete_planning', from: 'planning_in_progress', to: 'planned', roles: PLANNING_ACTION_ROLES, label: 'Save planning details',
    requiredFields: [
      required('input.planning.internalJobNumber', 'Internal job number'),
      required('input.planning.assignedPlanningUserId', 'Assigned Planning user'),
      required('input.planning.submissionDate', 'Planning submission date'),
      required('entity.selectedRep.id', 'Assigned representative'),
    ],
    customerDescription: 'Planning for your order is complete.',
    internalDescription: 'Planning recorded the job, customer instruction, schedule, owner and production location.',
    guard: 'planning_submission',
    timestampField: 'plannedAt',
    actorField: 'plannedBy',
    auditNotePath: 'input.planning.notes',
    customerVisible: false,
    persistInputFields: ['planning', 'internalJobNumber', 'customerPoNumber'],
  }),
  orderTransition({
    action: 'submit_to_expediting', from: 'planned', to: 'submitted_to_expediting', roles: PLANNING_ACTION_ROLES, label: 'Submit to expediting',
    requiredFields: [
      required('entity.planning.internalJobNumber', 'Internal job number'),
      required('entity.planning.assignedPlanningUserId', 'Assigned Planning user'),
      required('entity.planning.submissionDate', 'Planning submission date'),
      required('entity.selectedRep.id', 'Assigned representative'),
    ],
    customerDescription: 'Your order entered the fulfilment queue.', internalDescription: 'Planning handed the completed order plan to Expediting.',
    guard: 'planning_handoff',
    generatesNotification: true,
    notificationRecipients: ['customer', 'assigned_representative', 'expeditor'],
    notificationMessages: {
      customer: 'Planning has processed your order and it has entered the fulfilment queue.',
      assigned_representative: 'Planning has processed the order and submitted it to Expediting.',
      expeditor: 'A planned order is ready in the Expediting queue.',
    },
    timestampField: 'submittedToExpeditingAt',
    actorField: 'submittedToExpeditingBy',
    customerVisible: true,
  }),
  orderTransition({
    action: 'start_expediting', from: 'submitted_to_expediting', to: 'expediting_in_progress', roles: EXPEDITING_ACTION_ROLES, label: 'Start expediting',
    requiredFields: [
      required('input.expeditingUpdate.progressStep', 'Initial Expediting step'),
      required('input.expeditingUpdate.customerMessage', 'Customer-facing update'),
    ],
    customerDescription: 'Work has started on your instruments.', internalDescription: 'Expeditor accepted the planned order into the daily update queue.',
    guard: 'expediting_start',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative'],
    timestampField: 'expeditingStartedAt', actorField: 'expeditingStartedBy', customerVisible: true,
    customerNotePath: 'input.expeditingUpdate.customerMessage',
    auditNotePath: 'input.expeditingUpdate.internalNote',
  }),
  orderTransition({
    action: 'add_expediting_update', from: 'expediting_in_progress', to: '__same__', roles: EXPEDITING_ACTION_ROLES, label: 'Add progress update',
    requiredFields: [
      required('input.expeditingUpdate.progressStep', 'Progress step'),
      required('input.expeditingUpdate.customerMessage', 'Customer-facing update'),
    ],
    customerDescription: 'Progress on your order was updated.', internalDescription: 'Expeditor recorded a controlled production or fulfilment update.',
    guard: 'expediting_progress_update',
    generatesNotification: true,
    notificationRecipients: ['customer', 'assigned_representative'],
    timestampField: 'expeditingUpdatedAt',
    actorField: 'lastExpeditingUpdatedBy',
    customerVisible: true,
    customerNotePath: 'input.expeditingUpdate.customerMessage',
    auditNotePath: 'input.expeditingUpdate.internalNote',
    allowsSameStatus: true,
  }),
  orderTransition({
    action: 'complete_expediting', from: 'expediting_in_progress', to: 'awaiting_dispatch', roles: EXPEDITING_ACTION_ROLES, label: 'Send to dispatch',
    requiredFields: [
      required('input.completionCheckConfirmed', 'Completion check confirmation'),
      required('input.expeditingUpdate.progressStep', 'Dispatch-ready progress step'),
      required('input.expeditingUpdate.customerMessage', 'Customer-facing update'),
    ],
    customerDescription: 'Your order is being prepared for handover.', internalDescription: 'Expeditor completed fulfilment and handed the order to Dispatch.',
    guard: 'expediting_dispatch_handoff',
    generatesNotification: true, notificationRecipients: ['customer', 'assigned_representative', 'dispatch'],
    notificationMessages: {
      dispatch: 'An Expedited order is ready in the Dispatch queue.',
    },
    timestampField: 'submittedToDispatchAt', actorField: 'submittedToDispatchBy', customerVisible: true,
    customerNotePath: 'input.expeditingUpdate.customerMessage',
    auditNotePath: 'input.expeditingUpdate.internalNote',
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
  permission: WORKFLOW_ACTION_PERMISSIONS.override_workflow,
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

const assertActionPermission = (actor, transitionDefinition) => {
  if (actor.role === SYSTEM_ACTOR_ROLE) return;
  if (!transitionDefinition.permission || !roleCan(actor.role, transitionDefinition.permission)) {
    throw new ServiceError('Your account does not have permission to perform that workflow action.', {
      code: 'WORKFLOW_PERMISSION_FORBIDDEN',
      status: 403,
    });
  }
};

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

const validDateOnly = value => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
};

const assertQuotationConfirmation = input => {
  const quotation = input.quotation || {};
  const fieldErrors = {};
  const quotationNumber = String(quotation.number || '').trim();
  const internalNote = String(quotation.internalNote || '');
  const customerNote = String(quotation.customerNote || '');
  const documentReference = String(quotation.documentReference || '');

  if (quotationNumber.length > 80) fieldErrors.quotationNumber = 'Keep the quotation number below 80 characters.';
  if (quotation.date && !validDateOnly(quotation.date)) fieldErrors.quotationDate = 'Enter a valid quotation date.';
  if (quotation.expiryMode && !['dated', 'not_applicable'].includes(quotation.expiryMode)) fieldErrors.quotationExpiryMode = 'Select whether the quotation has an expiry date.';
  if (quotation.expiryMode === 'dated') {
    if (!validDateOnly(quotation.expiryDate)) fieldErrors.quotationExpiryDate = 'Enter a valid quotation expiry date.';
    else if (validDateOnly(quotation.date) && quotation.expiryDate < quotation.date) fieldErrors.quotationExpiryDate = 'The expiry date cannot be before the quotation date.';
  }
  if (internalNote.length > 2000) fieldErrors.quotationInternalNote = 'Keep the internal note below 2,000 characters.';
  if (customerNote.length > 1000) fieldErrors.quotationCustomerNote = 'Keep the customer-facing note below 1,000 characters.';
  if (documentReference.length > 240) fieldErrors.quotationDocumentReference = 'Keep the document reference below 240 characters.';
  if (['price', 'pricing', 'total', 'linePrices'].some(field => quotation[field] !== undefined)) {
    throw new ServiceError('Pricing data is not permitted in this quotation-confirmation phase.', {
      code: 'QUOTATION_PRICING_NOT_ALLOWED',
      status: 422,
      fieldErrors: { quotation: 'Remove pricing fields before confirming the quotation.' },
    });
  }
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], {
      code: 'QUOTATION_CONFIRMATION_INVALID',
      status: 422,
      fieldErrors,
    });
  }
};

const assertOrderAcceptance = input => {
  const acceptance = input.acceptance || {};
  const fieldErrors = {};
  const type = String(acceptance.type || '').trim();
  const purchaseOrderNumber = String(acceptance.purchaseOrderNumber || '').trim();
  const paymentReference = String(acceptance.paymentReference || '').trim();
  const internalNote = String(acceptance.internalNote || '').trim();
  const documentReference = String(acceptance.documentReference || '').trim();

  if (type && !RFQ_ACCEPTANCE_TYPES.includes(type)) fieldErrors.acceptanceType = 'Select a recognised acceptance type.';
  if (acceptance.date && !validDateOnly(acceptance.date)) fieldErrors.acceptanceDate = 'Enter a valid acceptance date.';
  if (type === 'purchase_order_received' && !purchaseOrderNumber) fieldErrors.acceptancePurchaseOrderNumber = 'Enter the received Purchase Order number.';
  if (type === 'payment_confirmed' && !paymentReference) fieldErrors.acceptancePaymentReference = 'Enter the external payment or transaction reference.';
  if (purchaseOrderNumber.length > 100) fieldErrors.acceptancePurchaseOrderNumber = 'Keep the Purchase Order number below 100 characters.';
  if (paymentReference.length > 160) fieldErrors.acceptancePaymentReference = 'Keep the payment reference below 160 characters.';
  if (internalNote.length > 2000) fieldErrors.acceptanceInternalNote = 'Keep the internal note below 2,000 characters.';
  if (documentReference.length > 240) fieldErrors.acceptanceDocumentReference = 'Keep the supporting-document reference below 240 characters.';
  if (acceptance.verified !== true) fieldErrors.acceptanceVerified = 'Confirm that the acceptance evidence was verified.';
  if (['price', 'pricing', 'total', 'linePrices'].some(field => acceptance[field] !== undefined)) {
    fieldErrors.acceptance = 'Remove pricing fields before accepting the order.';
  }
  const prohibitedCredentialFields = ['cardNumber', 'cvv', 'pin', 'password', 'bankAccount', 'bankingCredentials', 'routingNumber'];
  if (prohibitedCredentialFields.some(field => acceptance[field] !== undefined)) {
    throw new ServiceError('Payment cards, banking credentials and passwords must never be stored in the app.', {
      code: 'SENSITIVE_PAYMENT_DATA_NOT_ALLOWED',
      status: 422,
      fieldErrors: { acceptance: 'Remove card, banking or password information.' },
    });
  }
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], {
      code: 'ORDER_ACCEPTANCE_INVALID',
      status: 422,
      fieldErrors,
    });
  }
};

const assertPlanningDetails = planning => {
  const details = planning || {};
  const fieldErrors = {};
  const internalJobNumber = String(details.internalJobNumber || '').trim();
  const customerPoNumber = String(details.customerPoNumber || '').trim();
  const poException = details.customerPoException;
  const poExceptionReason = String(poException?.reason || '').trim();
  const notes = String(details.notes || '');
  const documentReferences = Array.isArray(details.documentReferences) ? details.documentReferences : [];

  if (!internalJobNumber) fieldErrors.planningInternalJobNumber = 'Enter the internal job number.';
  if (internalJobNumber.length > 100) fieldErrors.planningInternalJobNumber = 'Keep the internal job number below 100 characters.';
  if (customerPoNumber.length > 100) fieldErrors.planningCustomerPoNumber = 'Keep the customer Purchase Order number below 100 characters.';
  if (!customerPoNumber && poException?.authorised !== true) {
    fieldErrors.planningPoExceptionAuthorised = 'Enter the customer Purchase Order number or record an authorised exception.';
  }
  if (!customerPoNumber && poException?.authorised === true && poExceptionReason.length < 8) {
    fieldErrors.planningPoExceptionReason = 'Explain the authorised Purchase Order exception in at least 8 characters.';
  }
  if (poExceptionReason.length > 1000) fieldErrors.planningPoExceptionReason = 'Keep the Purchase Order exception reason below 1,000 characters.';
  if (!String(details.assignedPlanningUserId || '').trim()) fieldErrors.planningAssignedUserId = 'Select the Planning user responsible for this order.';
  if (!validDateOnly(details.submissionDate)) fieldErrors.planningSubmissionDate = 'Enter the Planning submission date.';
  if (details.plannedStartDate && !validDateOnly(details.plannedStartDate)) fieldErrors.planningStartDate = 'Enter a valid planned start date.';
  if (details.estimatedCompletionDate && !validDateOnly(details.estimatedCompletionDate)) {
    fieldErrors.planningEstimatedCompletionDate = 'Enter a valid estimated completion date.';
  }
  if (
    validDateOnly(details.plannedStartDate)
    && validDateOnly(details.estimatedCompletionDate)
    && details.estimatedCompletionDate < details.plannedStartDate
  ) {
    fieldErrors.planningEstimatedCompletionDate = 'The estimated completion date cannot be before the planned start date.';
  }
  if (!PLANNING_PRIORITY_VALUES.includes(details.priority)) fieldErrors.planningPriority = 'Select a valid Planning priority.';
  if (notes.length > 2000) fieldErrors.planningNotes = 'Keep Planning notes below 2,000 characters.';
  if (documentReferences.length > 10) fieldErrors.planningDocumentReferences = 'Add no more than 10 document references.';
  if (documentReferences.some(reference => String(reference).length > 240)) {
    fieldErrors.planningDocumentReferences = 'Keep each document reference below 240 characters.';
  }
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], {
      code: 'PLANNING_DETAILS_INVALID',
      status: 422,
      fieldErrors,
    });
  }
};

const assertExpeditingUpdate = (update, { expectedStep = '', requireSelectable = false } = {}) => {
  const value = update || {};
  const fieldErrors = {};
  const progressStep = String(value.progressStep || '').trim();
  const customerMessage = String(value.customerMessage || '').trim();
  const internalNote = String(value.internalNote || '');
  const estimatedCompletionDate = String(value.estimatedCompletionDate || '').trim();
  const delayReason = String(value.delayReason || '');
  const documentReference = String(value.document?.reference || '').trim();
  const stepDefinition = expeditorProgressStepById(progressStep);

  if (!EXPEDITOR_PROGRESS_STEP_IDS.includes(progressStep)) {
    fieldErrors.expeditingProgressStep = 'Select a recognised Expediting progress step.';
  } else if (expectedStep && progressStep !== expectedStep) {
    fieldErrors.expeditingProgressStep = `This action must record the ${expeditorProgressStepById(expectedStep).label} step.`;
  } else if (requireSelectable && !stepDefinition.selectableForUpdate) {
    fieldErrors.expeditingProgressStep = 'Use the controlled workflow action for this progress step.';
  }
  if (customerMessage.length < 5) fieldErrors.expeditingCustomerMessage = 'Add a clear customer-facing progress message.';
  if (customerMessage.length > 1000) fieldErrors.expeditingCustomerMessage = 'Keep the customer-facing message below 1,000 characters.';
  if (internalNote.length > 2000) fieldErrors.expeditingInternalNote = 'Keep the internal note below 2,000 characters.';
  if (estimatedCompletionDate && !validDateOnly(estimatedCompletionDate)) {
    fieldErrors.expeditingEstimatedCompletionDate = 'Enter a valid estimated completion date.';
  }
  if (delayReason.length > 1000) fieldErrors.expeditingDelayReason = 'Keep the delay reason below 1,000 characters.';
  if (documentReference.length > 240) fieldErrors.expeditingDocumentReference = 'Keep the controlled reference below 240 characters.';
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], {
      code: 'EXPEDITING_UPDATE_INVALID',
      status: 422,
      fieldErrors,
    });
  }
};

const assertExpeditingHandoff = (entity, input) => {
  assertExpeditingUpdate(input?.expeditingUpdate, { expectedStep: 'ready_for_dispatch' });
  const fieldErrors = {};
  if (input?.completionCheckConfirmed !== true) {
    fieldErrors.expeditingCompletionCheckConfirmed = 'Confirm that the Expeditor hand-off checks are complete.';
  }
  const projectedOrder = {
    ...entity,
    expediting: {
      ...(entity.expediting || {}),
      updates: [...(entity.expediting?.updates || []), input.expeditingUpdate],
    },
  };
  const missingSteps = missingRequiredExpeditorSteps(projectedOrder);
  const exception = input?.expeditingHandoff || {};
  if (missingSteps.length && exception.authorisedException !== true) {
    fieldErrors.expeditingReadyExceptionAuthorised = `Complete the required steps or record an authorised exception: ${missingSteps.map(id => expeditorProgressStepById(id).label).join(', ')}.`;
  }
  if (missingSteps.length && exception.authorisedException === true) {
    if (String(exception.exceptionReason || '').trim().length < 10) {
      fieldErrors.expeditingReadyExceptionReason = 'Explain the authorised exception in at least 10 characters.';
    }
    if (String(exception.exceptionAuthorisationReference || '').trim().length < 3) {
      fieldErrors.expeditingReadyExceptionReference = 'Record the manager or controlled authorisation reference.';
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], {
      code: 'EXPEDITING_HANDOFF_INVALID',
      status: 422,
      fieldErrors,
    });
  }
};

const assertGuard = (entity, actor, transitionDefinition, input) => {
  if (transitionDefinition.guard === 'quotation_confirmation' && input !== undefined) assertQuotationConfirmation(input);
  if (transitionDefinition.guard === 'order_acceptance' && input !== undefined) assertOrderAcceptance(input);
  if (transitionDefinition.guard === 'planning_submission' && input !== undefined) assertPlanningDetails(input.planning);
  if (transitionDefinition.guard === 'planning_handoff') assertPlanningDetails(entity.planning);
  if (transitionDefinition.guard === 'expediting_start' && input !== undefined) {
    assertExpeditingUpdate(input.expeditingUpdate, { expectedStep: 'planning_received' });
  }
  if (transitionDefinition.guard === 'expediting_progress_update' && input !== undefined) {
    assertExpeditingUpdate(input.expeditingUpdate, { requireSelectable: true });
  }
  if (transitionDefinition.guard === 'expediting_dispatch_handoff' && input !== undefined) {
    assertExpeditingHandoff(entity, input);
  }
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
    if (['submitted_to_expediting', 'expediting_in_progress'].includes(resumeStatus) && input !== undefined) {
      assertExpeditingUpdate(input.expeditingUpdate);
      if (expeditorProgressStepById(input.expeditingUpdate?.progressStep).operational) {
        throw new ServiceError('Resume the order at a normal Expediting progress step.', {
          code: 'EXPEDITING_UPDATE_INVALID',
          status: 422,
          fieldErrors: { expeditingProgressStep: 'Select the production or fulfilment step where work will resume.' },
        });
      }
    }
  }
  if (
    transitionDefinition.action === 'place_on_hold'
    && ['submitted_to_expediting', 'expediting_in_progress'].includes(entity.trackingStatus)
    && input !== undefined
  ) {
    assertExpeditingUpdate(input.expeditingUpdate, { expectedStep: 'on_hold' });
    if (String(input.expeditingUpdate?.delayReason || '').trim().length < 5) {
      throw new ServiceError('Record why the order is being placed on hold.', {
        code: 'EXPEDITING_UPDATE_INVALID',
        status: 422,
        fieldErrors: { expeditingDelayReason: 'Record why the order is being placed on hold.' },
      });
    }
  }
};

const resolveTargetStatus = (entity, transitionDefinition, input) => {
  if (transitionDefinition.to === '__resume__') return entity.workflowContext?.resumeStatus || '';
  if (transitionDefinition.to === '__input__') return String(input.targetStatus || '').trim();
  if (transitionDefinition.to === '__same__') return entity.trackingStatus || '';
  return transitionDefinition.to;
};

const findTransition = (entityType, fromStatus, action) => {
  if (action === OVERRIDE_TRANSITION.action) return { ...OVERRIDE_TRANSITION, entityType };
  return WORKFLOW_TRANSITIONS.find(item => item.entityType === entityType && item.from === fromStatus && item.action === action) || null;
};

const makeId = (prefix, idFactory) => `${prefix}-${idFactory?.() || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const validateTransition = ({ entity, action, actor, input = {}, expectedVersion, internal = false }) => {
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
  if (transitionDefinition.internalOnly && !internal) {
    throw new ServiceError('That workflow step can only be completed by the order-conversion service.', { code: 'WORKFLOW_ACTION_INTERNAL_ONLY', status: 403 });
  }
  assertActionPermission(actor, transitionDefinition);
  assertCompanyBoundary(entity, actor);
  assertAssignedRepresentative(entity, actor, transitionDefinition);
  assertGuard(entity, actor, transitionDefinition, input);
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(entity.version || 0)) {
    throw new ServiceError('This record changed after it was opened. Refresh it before trying again.', { code: 'WORKFLOW_VERSION_CONFLICT', status: 409 });
  }
  if (
    transitionDefinition.requiresComment
    && !String(input.comment || '').trim()
    && !String(input.expeditingUpdate?.customerMessage || '').trim()
  ) {
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
  if (!validTargets.includes(targetStatus) || (targetStatus === currentStatus && !transitionDefinition.allowsSameStatus)) {
    throw new ServiceError('Select a different valid status for this workflow.', { code: 'INVALID_WORKFLOW_TARGET', status: 422, fieldErrors: { targetStatus: 'Choose a valid target status.' } });
  }
  if (action === 'override_workflow' && currentStatus === 'archived') {
    throw new ServiceError('Archived records cannot be reopened from the preview workflow.', { code: 'ARCHIVED_WORKFLOW_LOCKED', status: 409 });
  }
  return { entityType, currentStatus, targetStatus, transitionDefinition };
};

export function performWorkflowTransition({ entity, action, actor, input = {}, expectedVersion, internal = false, now = () => new Date(), idFactory } = {}) {
  const validated = validateTransition({ entity, action, actor, input, expectedVersion, internal });
  const occurredAt = now().toISOString();
  const targetDefinition = workflowStatusById(validated.targetStatus, validated.entityType);
  const isOverride = action === 'override_workflow';
  const context = { entity, input };
  const customerNote = input.expeditingUpdate?.customerMessage || (validated.transitionDefinition.customerNotePath
    ? getPath(context, validated.transitionDefinition.customerNotePath)
    : input.comment);
  const auditNote = input.expeditingUpdate?.internalNote || (validated.transitionDefinition.auditNotePath
    ? getPath(context, validated.transitionDefinition.auditNotePath)
    : input.comment);
  const description = String(customerNote || validated.transitionDefinition.customerDescription || targetDefinition.customerDescription).trim();
  const workflowContext = { ...(entity.workflowContext || {}) };
  if (action === 'place_on_hold') {
    workflowContext.resumeStatus = validated.currentStatus;
    if (input.expeditingUpdate) workflowContext.expeditingResumeStep = entity.expediting?.currentStep || 'planning_received';
  }
  if (action === 'resume_order') {
    delete workflowContext.resumeStatus;
    delete workflowContext.expeditingResumeStep;
  }

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
  if (validated.transitionDefinition.actorField) {
    updatedEntity[validated.transitionDefinition.actorField] = {
      id: actor.id,
      role: actor.role,
      representativeId: actor.representativeId || '',
      displayName: actor.displayName || actor.contact || actor.role,
    };
  }
  if (input.expeditingUpdate) {
    const previousExpediting = entity.expediting || {};
    const progressStep = String(input.expeditingUpdate.progressStep || '').trim();
    const completedStepIds = new Set(previousExpediting.completedStepIds || []);
    if (!['on_hold', 'cancelled'].includes(progressStep)) completedStepIds.add(progressStep);
    const progressUpdate = {
      id: makeId('expediting-update', idFactory),
      progressStep,
      customerMessage: description,
      internalNote: String(input.expeditingUpdate.internalNote || '').trim(),
      estimatedCompletionDate: String(input.expeditingUpdate.estimatedCompletionDate || '').trim(),
      delayReason: String(input.expeditingUpdate.delayReason || '').trim(),
      document: input.expeditingUpdate.document ? { ...input.expeditingUpdate.document } : null,
      customerVisible: input.expeditingUpdate.customerVisible !== false,
      updatedBy: {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName || actor.contact || actor.role,
      },
      createdAt: occurredAt,
    };
    updatedEntity.expediting = {
      ...previousExpediting,
      currentStep: progressStep,
      completedStepIds: [...completedStepIds],
      estimatedCompletionDate: progressUpdate.estimatedCompletionDate || previousExpediting.estimatedCompletionDate || entity.planning?.estimatedCompletionDate || '',
      currentDelayReason: progressUpdate.delayReason || (action === 'resume_order' ? '' : previousExpediting.currentDelayReason || ''),
      updates: [...(previousExpediting.updates || []), progressUpdate],
      lastUpdatedAt: occurredAt,
      lastUpdatedBy: progressUpdate.updatedBy,
      ...(action === 'complete_expediting' && input.expeditingHandoff?.authorisedException ? {
        handoffException: {
          authorised: true,
          reason: String(input.expeditingHandoff.exceptionReason || '').trim(),
          authorisationReference: String(input.expeditingHandoff.exceptionAuthorisationReference || '').trim(),
          recordedBy: progressUpdate.updatedBy,
          recordedAt: occurredAt,
        },
      } : {}),
    };
  }

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
    progressStep: input.expeditingUpdate?.progressStep || '',
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
    comment: String(auditNote || '').trim(),
    progressStep: input.expeditingUpdate?.progressStep || '',
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
      message: description,
      messages: { ...validated.transitionDefinition.notificationMessages },
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
      if (candidate.internalOnly) return false;
      if (!candidate.roles.includes(actor.role)) return false;
      assertActionPermission(actor, candidate);
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
    permission: candidate.permission,
    label: candidate.label,
    fromStatus: entity.trackingStatus,
    toStatus: candidate.action === 'override_workflow' ? '' : candidate.displayToStatus || resolveTargetStatus(entity, candidate, { targetStatus: candidate.to }),
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
