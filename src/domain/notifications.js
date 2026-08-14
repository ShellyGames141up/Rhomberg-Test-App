const freezeList = values => Object.freeze([...values]);

export const NOTIFICATION_CHANNELS = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
});

export const NOTIFICATION_DELIVERY_STATUSES = Object.freeze({
  IN_APP: 'in_app',
  EMAIL_PENDING: 'email_pending',
  EMAIL_SENT: 'email_sent',
  EMAIL_FAILED: 'email_failed',
  PUSH_PENDING: 'push_pending',
  PUSH_SENT: 'push_sent',
  PUSH_FAILED: 'push_failed',
});

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  RFQ_SUBMITTED: 'rfq_submitted',
  RFQ_ASSIGNED: 'rfq_assigned',
  RFQ_UNDER_REVIEW: 'rfq_under_review',
  RFQ_QUOTED: 'rfq_quoted',
  CUSTOMER_ACKNOWLEDGEMENT: 'customer_acknowledgement',
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_CREATED: 'order_created',
  REPRESENTATIVE_ORDER_SUBMITTED: 'representative_order_submitted',
  CUSTOMER_ORDER_AVAILABLE: 'customer_order_available',
  PLANNING_ORDER_RECEIVED: 'planning_order_received',
  REPRESENTATIVE_ORDER_DUPLICATE_CONFIRMED: 'representative_order_duplicate_confirmed',
  ORDER_SENT_TO_PLANNING: 'order_sent_to_planning',
  ORDER_SENT_TO_EXPEDITING: 'order_sent_to_expediting',
  ORDER_SENT_TO_LABORATORY: 'order_sent_to_laboratory',
  LABORATORY_PROGRESS: 'laboratory_progress',
  LABORATORY_RELEASED: 'laboratory_released',
  CERTIFICATE_UPLOADED: 'certificate_uploaded',
  ORDER_SENT_TO_QA: 'order_sent_to_qa',
  QA_FAILED: 'qa_failed',
  QA_REWORK: 'qa_rework',
  QA_PASSED: 'qa_passed',
  CUSTOMER_PROGRESS_UPDATE: 'customer_progress_update',
  ORDER_DELAYED: 'order_delayed',
  ORDER_ON_HOLD: 'order_on_hold',
  ORDER_RESUMED: 'order_resumed',
  ORDER_SENT_TO_DISPATCH: 'order_sent_to_dispatch',
  DISPATCH_RECEIVED: 'dispatch_received',
  READY_FOR_COLLECTION: 'ready_for_collection',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERY_PROBLEM_REPORTED: 'delivery_problem_reported',
  DELIVERED: 'delivered',
  COLLECTED: 'collected',
  COMPLETED: 'completed',
  ORDER_CANCELLED: 'order_cancelled',
  RFQ_CANCELLED: 'rfq_cancelled',
  RFQ_EXPIRED: 'rfq_expired',
  WORKFLOW_OVERRIDE: 'workflow_override',
  TECHNICAL_REQUEST_SUBMITTED: 'technical_request_submitted',
  TECHNICAL_REQUEST_ASSIGNED: 'technical_request_assigned',
  TECHNICAL_INFORMATION_REQUIRED: 'technical_information_required',
  TECHNICAL_INFORMATION_RECEIVED: 'technical_information_received',
  TECHNICAL_CUSTOMER_INFORMATION_REQUESTED: 'technical_customer_information_requested',
  TECHNICAL_HIGH_PRIORITY: 'technical_high_priority',
  TECHNICAL_APPROACHING_DUE: 'technical_approaching_due',
  TECHNICAL_REQUEST_OVERDUE: 'technical_request_overdue',
  TECHNICAL_RESPONSE_SUBMITTED: 'technical_response_submitted',
  TECHNICAL_REVIEW_COMPLETED: 'technical_review_completed',
  TECHNICAL_DEADLINE_EXTENDED: 'technical_deadline_extended',
  TECHNICAL_OVERRIDE_USED: 'technical_override_used',
});

export const NOTIFICATION_PREFERENCE_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'rfqUpdates', label: 'RFQ updates', critical: false }),
  Object.freeze({ id: 'quotationNotifications', label: 'Quotation notifications', critical: false }),
  Object.freeze({ id: 'orderProgress', label: 'Order-progress notifications', critical: false }),
  Object.freeze({ id: 'delayNotifications', label: 'Delay notifications', critical: false }),
  Object.freeze({ id: 'fulfilmentNotifications', label: 'Collection or delivery notifications', critical: false }),
  Object.freeze({ id: 'accountSecurity', label: 'Account and security notifications', critical: true }),
  Object.freeze({ id: 'maintenanceNotices', label: 'Maintenance notices', critical: true }),
  Object.freeze({ id: 'companyAnnouncements', label: 'General company announcements', critical: false }),
]);

export const DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES = Object.freeze(Object.fromEntries(
  NOTIFICATION_PREFERENCE_CATEGORIES.map(category => [category.id, true]),
));

export const createDefaultNotificationPreferences = () => ({
  schemaVersion: 1,
  channels: {
    inApp: true,
    email: true,
    push: true,
  },
  categories: { ...DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES },
  updatedAt: '',
});

export const normaliseNotificationPreferences = candidate => {
  const defaults = createDefaultNotificationPreferences();
  const value = candidate || {};
  return {
    schemaVersion: 1,
    channels: {
      inApp: true,
      email: value.channels?.email ?? defaults.channels.email,
      push: value.channels?.push ?? defaults.channels.push,
    },
    categories: {
      ...defaults.categories,
      ...(value.categories || {}),
    },
    updatedAt: String(value.updatedAt || ''),
  };
};

export const validateNotificationPreferences = candidate => {
  const value = candidate || {};
  const errors = {};
  if (value.channels?.inApp === false) {
    errors['channels.inApp'] = 'In-app workflow notifications must remain enabled.';
  }
  for (const channel of ['email', 'push']) {
    if (typeof value.channels?.[channel] !== 'boolean') {
      errors[`channels.${channel}`] = `Choose whether ${channel} delivery should be simulated.`;
    }
  }
  for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
    if (typeof value.categories?.[category.id] !== 'boolean') {
      errors[`categories.${category.id}`] = `Choose a preference for ${category.label.toLowerCase()}.`;
    }
    if (category.critical && value.categories?.[category.id] === false) {
      errors[`categories.${category.id}`] = `${category.label} must remain enabled.`;
    }
  }
  return errors;
};

const eventDefinition = ({
  type,
  title,
  category,
  status,
  recipients,
  customerVisible = true,
  priority = 'normal',
  messages,
}) => Object.freeze({
  type,
  title,
  category,
  status,
  recipients: freezeList(recipients),
  customerVisible,
  priority,
  messages: Object.freeze({ ...messages }),
});

const referenceText = record => record?.reference || 'this record';
const companyText = record => record?.company || 'the customer';
const publicUpdateText = (record, fallback) => (
  record?.dispatch?.updates?.at(-1)?.customerMessage
  || record?.dispatch?.customerMessage
  || record?.expediting?.updates?.at(-1)?.customerMessage
  || record?.laboratory?.updates?.at(-1)?.customerMessage
  || record?.qualityAssurance?.customerMessage
  || record?.trackingHistory?.at(-1)?.note
  || fallback
);

export const NOTIFICATION_EVENT_CATALOG = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.RFQ_SUBMITTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_SUBMITTED,
    title: 'RFQ submitted',
    category: 'rfqUpdates',
    status: 'submitted',
    recipients: ['customer'],
    messages: {
      customer: record => `${referenceText(record)} was submitted successfully and is being routed to your selected representative.`,
      internal: record => `${referenceText(record)} was submitted by ${companyText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED,
    title: 'RFQ assigned',
    category: 'rfqUpdates',
    status: 'assigned_to_rep',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `${referenceText(record)} was routed to your selected Rhomberg representative.`,
      assigned_representative: record => `New RFQ ${referenceText(record)} from ${companyText(record)} is ready in your representative inbox.`,
      internal: record => `${referenceText(record)} was assigned to its selected representative.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.RFQ_UNDER_REVIEW]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_UNDER_REVIEW,
    title: 'RFQ review started',
    category: 'rfqUpdates',
    status: 'under_rep_review',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `Your representative has started reviewing ${referenceText(record)}.`,
      assigned_representative: record => `${referenceText(record)} is now in your review queue.`,
      internal: record => `${referenceText(record)} is under representative review.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.RFQ_QUOTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_QUOTED,
    title: 'Quotation sent separately',
    category: 'quotationNotifications',
    status: 'quoted',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `Your quotation for ${referenceText(record)} was emailed separately. Open the RFQ to acknowledge that you received it.`,
      assigned_representative: record => `The quotation confirmation for ${referenceText(record)} was saved and the customer was notified to acknowledge receipt.`,
      internal: record => `${referenceText(record)} was marked as quoted.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.CUSTOMER_ACKNOWLEDGEMENT]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.CUSTOMER_ACKNOWLEDGEMENT,
    title: 'Quotation receipt acknowledged',
    category: 'quotationNotifications',
    status: 'awaiting_customer_acceptance',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `You acknowledged receiving the quotation for ${referenceText(record)}. This is not order acceptance.`,
      assigned_representative: record => `The customer acknowledged receiving the quotation for ${referenceText(record)}. This acknowledgement is not order acceptance.`,
      internal: record => `Quotation receipt was acknowledged for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_ACCEPTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_ACCEPTED,
    title: 'Order acceptance confirmed',
    category: 'orderProgress',
    status: 'accepted',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `Rhomberg confirmed the external acceptance for ${referenceText(record)}.`,
      assigned_representative: record => `Your acceptance confirmation for ${referenceText(record)} was recorded.`,
      internal: record => `External acceptance was verified for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_CREATED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_CREATED,
    title: 'Order created',
    category: 'orderProgress',
    status: 'converted_to_order',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `${referenceText(record)} was converted into an order.`,
      assigned_representative: record => `${referenceText(record)} was converted into an order and routed to Planning.`,
      internal: record => `${referenceText(record)} was converted into an order.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_SUBMITTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_SUBMITTED,
    title: 'Order loaded by Sales Representative',
    category: 'orderProgress',
    status: 'awaiting_planning',
    recipients: ['assigned_representative'],
    customerVisible: false,
    messages: {
      assigned_representative: record => `${referenceText(record)} was loaded successfully and routed to Planning.`,
      internal: record => `${referenceText(record)} was loaded by a Sales Representative.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.CUSTOMER_ORDER_AVAILABLE]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.CUSTOMER_ORDER_AVAILABLE,
    title: 'Customer order available',
    category: 'orderProgress',
    status: 'awaiting_planning',
    recipients: ['customer'],
    messages: {
      customer: record => `${referenceText(record)} is now available in your account and has been sent to Planning.`,
      internal: record => `The customer can now see ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.PLANNING_ORDER_RECEIVED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.PLANNING_ORDER_RECEIVED,
    title: 'New representative-loaded order',
    category: 'orderProgress',
    status: 'awaiting_planning',
    recipients: ['planning'],
    customerVisible: false,
    messages: {
      planning: record => `${referenceText(record)} from ${companyText(record)} is ready in the Planning queue.`,
      internal: record => `${referenceText(record)} entered Planning from the representative order workflow.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_DUPLICATE_CONFIRMED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_DUPLICATE_CONFIRMED,
    title: 'Possible duplicate order confirmed',
    category: 'orderProgress',
    status: 'awaiting_planning',
    recipients: ['sales_manager', 'manager', 'administrator'],
    customerVisible: false,
    priority: 'high',
    messages: {
      sales_manager: record => `${referenceText(record)} was created after an explicit possible-duplicate confirmation.`,
      manager: record => `${referenceText(record)} was created after an explicit possible-duplicate confirmation.`,
      administrator: record => `${referenceText(record)} was created after an explicit possible-duplicate confirmation.`,
      internal: record => `${referenceText(record)} requires duplicate-review awareness.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_PLANNING]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_PLANNING,
    title: 'Order sent to Planning',
    category: 'orderProgress',
    status: 'awaiting_planning',
    recipients: ['assigned_representative', 'planning'],
    customerVisible: false,
    messages: {
      assigned_representative: record => `${referenceText(record)} is now in the Planning queue.`,
      planning: record => `${referenceText(record)} from ${companyText(record)} is ready for Planning.`,
      internal: record => `${referenceText(record)} entered the Planning queue.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_EXPEDITING]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_EXPEDITING,
    title: 'Order sent to Expediting',
    category: 'orderProgress',
    status: 'submitted_to_expediting',
    recipients: ['customer', 'assigned_representative', 'expeditor'],
    messages: {
      customer: record => `Planning has processed ${referenceText(record)} and it has entered the fulfilment queue.`,
      assigned_representative: record => `Planning submitted ${referenceText(record)} to Expediting.`,
      expeditor: record => `${referenceText(record)} is ready in the Expediting queue.`,
      internal: record => `${referenceText(record)} entered Expediting.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_LABORATORY]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_LABORATORY,
    title: 'Order sent to Laboratory',
    category: 'orderProgress',
    status: 'awaiting_lab',
    recipients: ['customer', 'assigned_representative', 'laboratory_manager'],
    messages: {
      customer: record => `${referenceText(record)} requires controlled calibration and is queued with the Laboratory.`,
      assigned_representative: record => `${referenceText(record)} was routed to the Laboratory.`,
      laboratory_manager: record => `${referenceText(record)} is ready in the Laboratory certificate queue.`,
      internal: record => `${referenceText(record)} entered the Laboratory route.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS,
    title: 'Laboratory progress updated',
    category: 'orderProgress',
    status: 'calibration_in_progress',
    recipients: ['customer', 'assigned_representative', 'expeditor'],
    messages: {
      customer: record => publicUpdateText(record, `Laboratory progress on ${referenceText(record)} was updated.`),
      assigned_representative: record => `Laboratory progress on ${referenceText(record)} was updated.`,
      expeditor: record => `${referenceText(record)} is currently controlled by the Calibration Laboratory.`,
      internal: record => `Laboratory progress was updated for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.LABORATORY_RELEASED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.LABORATORY_RELEASED,
    title: 'Laboratory order released',
    category: 'orderProgress',
    status: 'released_from_lab',
    recipients: ['customer', 'assigned_representative', 'expeditor', 'dispatch'],
    messages: {
      customer: record => `${referenceText(record)} was released by the Laboratory. Any pending certificate remains tracked and will be shared when ready.`,
      assigned_representative: record => `${referenceText(record)} was released by the Laboratory.`,
      expeditor: record => `${referenceText(record)} is awaiting receipt from the Laboratory.`,
      dispatch: record => `${referenceText(record)} may be awaiting Dispatch receipt from the Laboratory.`,
      internal: record => `${referenceText(record)} was released from Laboratory control.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.CERTIFICATE_UPLOADED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.CERTIFICATE_UPLOADED,
    title: 'Calibration certificate ready',
    category: 'orderProgress',
    status: 'certificate_uploaded',
    recipients: ['customer', 'assigned_representative', 'laboratory_manager'],
    messages: {
      customer: record => publicUpdateText(record, 'Your calibration certificate is now available.'),
      assigned_representative: record => `A unit certificate for ${referenceText(record)} was uploaded and the customer was notified.`,
      laboratory_manager: record => `A unit certificate for ${referenceText(record)} was uploaded.`,
      internal: record => `A unit certificate was uploaded for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_QA]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_QA,
    title: 'Order sent to Quality Assurance',
    category: 'orderProgress',
    status: 'awaiting_qa',
    recipients: ['customer', 'assigned_representative', 'expeditor', 'quality_assurance', 'quality_manager'],
    messages: {
      customer: record => `${referenceText(record)} is queued for final quality checks.`,
      assigned_representative: record => `${referenceText(record)} entered Quality Assurance.`,
      expeditor: record => `${referenceText(record)} entered Quality Assurance.`,
      quality_assurance: record => `${referenceText(record)} is ready in the QA inspection queue.`,
      quality_manager: record => `${referenceText(record)} is ready in the QA inspection queue.`,
      internal: record => `${referenceText(record)} entered Quality Assurance.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.QA_FAILED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.QA_FAILED,
    title: 'Quality correction required',
    category: 'delayNotifications',
    status: 'qa_failed',
    recipients: ['customer', 'assigned_representative', 'expeditor', 'quality_manager'],
    priority: 'high',
    messages: {
      customer: record => publicUpdateText(record, `A quality concern on ${referenceText(record)} is being corrected before release.`),
      assigned_representative: record => `${referenceText(record)} requires a controlled QA correction.`,
      expeditor: record => `${referenceText(record)} requires corrective work after QA inspection.`,
      quality_manager: record => `${referenceText(record)} has a failed QA inspection.`,
      internal: record => `${referenceText(record)} failed QA inspection.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.QA_REWORK]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.QA_REWORK,
    title: 'Quality corrective work updated',
    category: 'orderProgress',
    status: 'qa_reinspection_required',
    recipients: ['customer', 'assigned_representative', 'quality_assurance'],
    messages: {
      customer: record => publicUpdateText(record, `Corrective work on ${referenceText(record)} is progressing.`),
      assigned_representative: record => `QA corrective work on ${referenceText(record)} was updated.`,
      quality_assurance: record => `${referenceText(record)} is ready for reinspection.`,
      internal: record => `QA corrective work was updated for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.QA_PASSED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.QA_PASSED,
    title: 'Quality checks passed',
    category: 'orderProgress',
    status: 'qa_passed',
    recipients: ['customer', 'assigned_representative', 'expeditor', 'quality_manager', 'dispatch'],
    messages: {
      customer: record => `${referenceText(record)} passed final quality checks.`,
      assigned_representative: record => `${referenceText(record)} passed QA.`,
      expeditor: record => `${referenceText(record)} passed QA.`,
      quality_manager: record => `${referenceText(record)} passed QA.`,
      dispatch: record => `${referenceText(record)} passed QA and will be released to Dispatch.`,
      internal: record => `${referenceText(record)} passed QA.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE,
    title: 'Order progress updated',
    category: 'orderProgress',
    status: 'expediting_in_progress',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `Progress on ${referenceText(record)} was updated.`),
      assigned_representative: record => publicUpdateText(record, `Progress on ${referenceText(record)} was updated.`),
      internal: record => `A customer-visible progress update was added to ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_DELAYED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_DELAYED,
    title: 'Order delay recorded',
    category: 'delayNotifications',
    status: '',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} has a revised progress update.`),
      assigned_representative: record => `A delay was recorded for ${referenceText(record)}. Open the order for the authorised details.`,
      internal: record => `A delay was recorded for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_ON_HOLD]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_ON_HOLD,
    title: 'Order placed on hold',
    category: 'delayNotifications',
    status: 'on_hold',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} needs information or action before work can continue.`),
      assigned_representative: record => `${referenceText(record)} was placed on hold.`,
      internal: record => `${referenceText(record)} was placed on hold.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_RESUMED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_RESUMED,
    title: 'Order resumed',
    category: 'orderProgress',
    status: '',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `Work on ${referenceText(record)} has resumed.`,
      assigned_representative: record => `${referenceText(record)} resumed at its controlled workflow stage.`,
      internal: record => `${referenceText(record)} resumed.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH,
    title: 'Order sent to Dispatch',
    category: 'fulfilmentNotifications',
    status: 'awaiting_dispatch',
    recipients: ['customer', 'assigned_representative', 'dispatch'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} is being prepared for handover.`),
      assigned_representative: record => `${referenceText(record)} was submitted to Dispatch.`,
      dispatch: record => `${referenceText(record)} is ready in the Dispatch queue.`,
      internal: record => `${referenceText(record)} entered Dispatch.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.DISPATCH_RECEIVED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.DISPATCH_RECEIVED,
    title: 'Received by Dispatch',
    category: 'fulfilmentNotifications',
    status: 'awaiting_dispatch',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} has been received by Dispatch and is being prepared for handover.`),
      assigned_representative: record => `Dispatch confirmed receipt of ${referenceText(record)}.`,
      internal: record => `Dispatch receipt was confirmed for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.READY_FOR_COLLECTION]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.READY_FOR_COLLECTION,
    title: 'Ready for collection',
    category: 'fulfilmentNotifications',
    status: 'ready_for_collection',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} is ready for collection.`),
      assigned_representative: record => `${referenceText(record)} is ready for customer collection.`,
      internal: record => `${referenceText(record)} is ready for collection.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.OUT_FOR_DELIVERY]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.OUT_FOR_DELIVERY,
    title: 'Out for delivery',
    category: 'fulfilmentNotifications',
    status: 'out_for_delivery',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} is out for delivery.`),
      assigned_representative: record => `${referenceText(record)} is out for delivery.`,
      internal: record => `${referenceText(record)} is out for delivery.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.DELIVERY_PROBLEM_REPORTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.DELIVERY_PROBLEM_REPORTED,
    title: 'Delivery problem reported',
    category: 'delayNotifications',
    status: 'out_for_delivery',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => publicUpdateText(record, `A delivery problem was recorded for ${referenceText(record)} and Dispatch is following up.`),
      assigned_representative: record => `Dispatch reported a delivery problem for ${referenceText(record)}. Open the order for the customer-safe update.`,
      internal: record => `A delivery problem was recorded for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.DELIVERED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.DELIVERED,
    title: 'Order delivered',
    category: 'fulfilmentNotifications',
    status: 'delivered',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} was delivered.`),
      assigned_representative: record => `Delivery was confirmed for ${referenceText(record)}.`,
      internal: record => `${referenceText(record)} was delivered.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.COLLECTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.COLLECTED,
    title: 'Order collected',
    category: 'fulfilmentNotifications',
    status: 'collected',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} was collected.`),
      assigned_representative: record => `Collection was confirmed for ${referenceText(record)}.`,
      internal: record => `${referenceText(record)} was collected.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.COMPLETED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.COMPLETED,
    title: 'Order completed',
    category: 'fulfilmentNotifications',
    status: 'completed',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => publicUpdateText(record, `${referenceText(record)} is complete.`),
      assigned_representative: record => `${referenceText(record)} was completed.`,
      internal: record => `${referenceText(record)} was completed.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.ORDER_CANCELLED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.ORDER_CANCELLED,
    title: 'Order cancelled',
    category: 'orderProgress',
    status: 'cancelled',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => `${referenceText(record)} was cancelled. Contact your representative if you need assistance.`,
      assigned_representative: record => `${referenceText(record)} was cancelled.`,
      internal: record => `${referenceText(record)} was cancelled.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.RFQ_CANCELLED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_CANCELLED,
    title: 'RFQ cancelled',
    category: 'rfqUpdates',
    status: 'cancelled',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => `${referenceText(record)} was cancelled.`,
      assigned_representative: record => `${referenceText(record)} was cancelled.`,
      internal: record => `${referenceText(record)} was cancelled.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.RFQ_EXPIRED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.RFQ_EXPIRED,
    title: 'RFQ expired',
    category: 'quotationNotifications',
    status: 'expired',
    recipients: ['customer', 'assigned_representative'],
    messages: {
      customer: record => `${referenceText(record)} expired. Contact your representative if you need a new quotation.`,
      assigned_representative: record => `${referenceText(record)} expired.`,
      internal: record => `${referenceText(record)} expired.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.WORKFLOW_OVERRIDE]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.WORKFLOW_OVERRIDE,
    title: 'Workflow corrected',
    category: 'orderProgress',
    status: '',
    recipients: ['customer', 'assigned_representative'],
    priority: 'high',
    messages: {
      customer: record => `An authorised workflow correction was recorded for ${referenceText(record)}.`,
      assigned_representative: record => `An authorised workflow correction was recorded for ${referenceText(record)}.`,
      internal: record => `An authorised workflow correction was recorded for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_SUBMITTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_SUBMITTED,
    title: 'Technical review required', category: 'rfqUpdates', status: 'technical_support_requested',
    recipients: ['customer', 'assigned_representative', 'technical_support', 'sales_manager'],
    messages: {
      customer: record => `Technical review is required for ${referenceText(record)}. Your representative remains your point of contact.`,
      assigned_representative: record => `The Technical Support request for ${referenceText(record)} was submitted.`,
      technical_support: record => `New Technical Support request for ${referenceText(record)} is ready in the queue.`,
      sales_manager: record => `Technical review was requested for ${referenceText(record)}.`,
      internal: record => `Technical review was requested for ${referenceText(record)}.`,
    },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_ASSIGNED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_ASSIGNED,
    title: 'Technical request assigned', category: 'rfqUpdates', status: 'technical_support_assigned',
    recipients: ['assigned_representative', 'technical_support'], customerVisible: false,
    messages: { internal: record => `The Technical Support request for ${referenceText(record)} was assigned.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_REQUIRED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_REQUIRED,
    title: 'More technical information required', category: 'rfqUpdates', status: 'awaiting_representative_information',
    recipients: ['assigned_representative', 'technical_support'], customerVisible: false,
    messages: { assigned_representative: record => `Technical Support needs more information for ${referenceText(record)}.`, internal: record => `More information is required for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_RECEIVED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_RECEIVED,
    title: 'Technical information received', category: 'rfqUpdates', status: 'technical_review_in_progress',
    recipients: ['assigned_representative', 'technical_support'], customerVisible: false,
    messages: { internal: record => `New information was received for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_CUSTOMER_INFORMATION_REQUESTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_CUSTOMER_INFORMATION_REQUESTED,
    title: 'Additional information required', category: 'rfqUpdates', status: 'awaiting_customer_information',
    recipients: ['customer', 'assigned_representative', 'technical_support'],
    messages: { customer: record => `Your representative needs additional information to complete the technical review for ${referenceText(record)}.`, assigned_representative: record => `A customer-safe information request is active for ${referenceText(record)}.`, internal: record => `Customer information was requested for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_HIGH_PRIORITY]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_HIGH_PRIORITY,
    title: 'High-priority technical request', category: 'rfqUpdates', status: 'technical_support_requested',
    recipients: ['technical_support', 'sales_manager', 'manager'], customerVisible: false, priority: 'high',
    messages: { internal: record => `High-priority Technical Support is required for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_APPROACHING_DUE]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_APPROACHING_DUE,
    title: 'Technical request approaching due date', category: 'delayNotifications', status: '',
    recipients: ['assigned_representative', 'technical_support'], customerVisible: false, priority: 'high',
    messages: { internal: record => `Technical Support for ${referenceText(record)} is approaching its revised quotation target.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_OVERDUE]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_OVERDUE,
    title: 'Technical request overdue', category: 'delayNotifications', status: '',
    recipients: ['assigned_representative', 'technical_support', 'sales_manager', 'manager'], customerVisible: false, priority: 'high',
    messages: { assigned_representative: record => `Technical Support for ${referenceText(record)} is overdue.`, internal: record => `Technical Support for ${referenceText(record)} is overdue.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_RESPONSE_SUBMITTED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_RESPONSE_SUBMITTED,
    title: 'Technical response received', category: 'rfqUpdates', status: 'technical_response_submitted',
    recipients: ['assigned_representative', 'technical_support'], customerVisible: false,
    messages: { assigned_representative: record => `Technical Support responded on ${referenceText(record)}.`, internal: record => `A Technical Support response was submitted for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_REVIEW_COMPLETED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_REVIEW_COMPLETED,
    title: 'Technical review completed', category: 'rfqUpdates', status: 'technical_support_completed',
    recipients: ['customer', 'assigned_representative', 'technical_support'],
    messages: { customer: record => `The technical review for ${referenceText(record)} is complete and quotation preparation may continue.`, assigned_representative: record => `Technical review is complete for ${referenceText(record)}.`, internal: record => `Technical review completed for ${referenceText(record)}.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_DEADLINE_EXTENDED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_DEADLINE_EXTENDED,
    title: 'Quotation timeline revised', category: 'quotationNotifications', status: 'technical_support_requested',
    recipients: ['customer', 'assigned_representative', 'technical_support', 'sales_manager', 'manager'],
    messages: { customer: record => `Technical review is required for ${referenceText(record)}. The quotation timeframe has been extended by up to 24 hours.`, internal: record => `The quotation target for ${referenceText(record)} was extended by 24 hours.` },
  }),
  [NOTIFICATION_EVENT_TYPES.TECHNICAL_OVERRIDE_USED]: eventDefinition({
    type: NOTIFICATION_EVENT_TYPES.TECHNICAL_OVERRIDE_USED,
    title: 'Technical quotation block overridden', category: 'quotationNotifications', status: '',
    recipients: ['assigned_representative', 'technical_support', 'sales_manager', 'manager'], customerVisible: false, priority: 'high',
    messages: { internal: record => `An authorised Technical Support quotation override was recorded for ${referenceText(record)}.` },
  }),
});

const ACTION_EVENT_TYPES = Object.freeze({
  submit_rfq: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_SUBMITTED]),
  assign_representative: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED]),
  start_rep_review: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_UNDER_REVIEW]),
  mark_quoted: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_QUOTED]),
  acknowledge_quotation: freezeList([NOTIFICATION_EVENT_TYPES.CUSTOMER_ACKNOWLEDGEMENT]),
  accept_order: freezeList([
    NOTIFICATION_EVENT_TYPES.ORDER_ACCEPTED,
    NOTIFICATION_EVENT_TYPES.ORDER_CREATED,
    NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_PLANNING,
  ]),
  create_representative_order: freezeList([
    NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_SUBMITTED,
    NOTIFICATION_EVENT_TYPES.CUSTOMER_ORDER_AVAILABLE,
    NOTIFICATION_EVENT_TYPES.PLANNING_ORDER_RECEIVED,
  ]),
  confirm_representative_order_duplicate: freezeList([
    NOTIFICATION_EVENT_TYPES.REPRESENTATIVE_ORDER_DUPLICATE_CONFIRMED,
  ]),
  submit_to_expediting: freezeList([]),
  start_expediting: freezeList([NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE]),
  add_expediting_update: freezeList([NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE]),
  complete_expediting: freezeList([]),
  receive_lab_order: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]),
  start_lab_calibration: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]),
  hold_lab_calibration: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_ON_HOLD]),
  resume_lab_calibration: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_RESUMED]),
  complete_lab_calibration: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]),
  mark_lab_ready_for_release: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]),
  release_from_lab: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_RELEASED]),
  confirm_lab_receipt_expediting: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_EXPEDITING]),
  confirm_lab_receipt_dispatch: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH]),
  confirm_dispatch_receipt: freezeList([NOTIFICATION_EVENT_TYPES.DISPATCH_RECEIVED]),
  laboratory_progress_updated: freezeList([NOTIFICATION_EVENT_TYPES.LABORATORY_PROGRESS]),
  certificate_uploaded: freezeList([NOTIFICATION_EVENT_TYPES.CERTIFICATE_UPLOADED]),
  start_qa: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_QA]),
  start_qa_reinspection: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_QA]),
  fail_qa: freezeList([NOTIFICATION_EVENT_TYPES.QA_FAILED]),
  start_qa_rework: freezeList([NOTIFICATION_EVENT_TYPES.QA_REWORK]),
  resubmit_to_qa: freezeList([NOTIFICATION_EVENT_TYPES.QA_REWORK]),
  pass_qa: freezeList([NOTIFICATION_EVENT_TYPES.QA_PASSED]),
  release_qa_order: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH]),
  place_on_hold: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_ON_HOLD]),
  resume_order: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_RESUMED]),
  mark_ready_for_collection: freezeList([NOTIFICATION_EVENT_TYPES.READY_FOR_COLLECTION]),
  start_delivery: freezeList([NOTIFICATION_EVENT_TYPES.OUT_FOR_DELIVERY]),
  report_delivery_problem: freezeList([NOTIFICATION_EVENT_TYPES.DELIVERY_PROBLEM_REPORTED]),
  confirm_delivery: freezeList([NOTIFICATION_EVENT_TYPES.DELIVERED]),
  confirm_collection: freezeList([NOTIFICATION_EVENT_TYPES.COLLECTED]),
  complete_delivery: freezeList([NOTIFICATION_EVENT_TYPES.COMPLETED]),
  complete_collection: freezeList([NOTIFICATION_EVENT_TYPES.COMPLETED]),
  cancel_order: freezeList([NOTIFICATION_EVENT_TYPES.ORDER_CANCELLED]),
  cancel_rfq: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_CANCELLED]),
  expire_rfq: freezeList([NOTIFICATION_EVENT_TYPES.RFQ_EXPIRED]),
  override_workflow: freezeList([NOTIFICATION_EVENT_TYPES.WORKFLOW_OVERRIDE]),
  request_technical_support: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_SUBMITTED, NOTIFICATION_EVENT_TYPES.TECHNICAL_DEADLINE_EXTENDED]),
  assign_technical_support: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_ASSIGNED]),
  request_technical_information: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_REQUIRED]),
  request_customer_technical_information: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_CUSTOMER_INFORMATION_REQUESTED]),
  technical_information_received: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_INFORMATION_RECEIVED]),
  submit_technical_response: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_RESPONSE_SUBMITTED]),
  complete_technical_support: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_REVIEW_COMPLETED]),
  override_technical_support: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_OVERRIDE_USED]),
  technical_support_approaching_due: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_APPROACHING_DUE]),
  technical_support_overdue: freezeList([NOTIFICATION_EVENT_TYPES.TECHNICAL_REQUEST_OVERDUE]),
});

const delayReasonFor = (record, input) => (
  input?.expeditingUpdate?.delayReason
  || record?.expediting?.updates?.at(-1)?.delayReason
  || ''
);

export const notificationRequestsForWorkflowAction = ({
  action,
  record,
  createdOrder = null,
  input = {},
}) => {
  const eventTypes = [...(ACTION_EVENT_TYPES[action] || [])];
  if (action === 'request_technical_support' && ['high', 'urgent'].includes(record?.technicalSupport?.priority)) {
    eventTypes.push(NOTIFICATION_EVENT_TYPES.TECHNICAL_HIGH_PRIORITY);
  }
  if (action === 'submit_to_expediting') {
    eventTypes.push(
      record?.trackingStatus === 'awaiting_lab'
        ? NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_LABORATORY
        : NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_EXPEDITING,
    );
  }
  if (action === 'complete_expediting') {
    eventTypes.push(
      record?.trackingStatus === 'awaiting_qa'
        ? NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_QA
        : NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH,
    );
  }
  if (['start_expediting', 'add_expediting_update'].includes(action) && delayReasonFor(record, input)) {
    eventTypes.push(NOTIFICATION_EVENT_TYPES.ORDER_DELAYED);
  }
  return eventTypes.map(eventType => ({
    eventType,
    record: [
      NOTIFICATION_EVENT_TYPES.ORDER_CREATED,
      NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_PLANNING,
    ].includes(eventType)
      ? createdOrder || record
      : record,
    sourceAction: action,
    statusOverride: eventType === NOTIFICATION_EVENT_TYPES.ORDER_ACCEPTED ? 'accepted' : '',
    relatedOrderId: createdOrder?.id || record?.orderId || '',
  })).filter(request => request.record);
};

const deterministicNumber = value => [...String(value || '')]
  .reduce((total, character) => ((total * 31) + character.charCodeAt(0)) % 2147483647, 7);

const simulatedStatusFor = (notificationId, recipient, channel) => {
  const variant = deterministicNumber(`${notificationId}:${recipient}:${channel}`) % 3;
  if (channel === NOTIFICATION_CHANNELS.EMAIL) {
    return [
      NOTIFICATION_DELIVERY_STATUSES.EMAIL_PENDING,
      NOTIFICATION_DELIVERY_STATUSES.EMAIL_SENT,
      NOTIFICATION_DELIVERY_STATUSES.EMAIL_FAILED,
    ][variant];
  }
  return [
    NOTIFICATION_DELIVERY_STATUSES.PUSH_PENDING,
    NOTIFICATION_DELIVERY_STATUSES.PUSH_SENT,
    NOTIFICATION_DELIVERY_STATUSES.PUSH_FAILED,
  ][variant];
};

const deliveryRecord = ({
  notificationId,
  recipient,
  channel,
  status,
  occurredAt,
}) => ({
  id: `${notificationId}-${recipient}-${channel}`,
  recipient,
  channel,
  status,
  attemptCount: status.endsWith('_pending') ? 0 : 1,
  maxAttempts: 3,
  retryable: status.endsWith('_failed'),
  nextRetryAt: status.endsWith('_failed') ? occurredAt : '',
  lastAttemptAt: status.endsWith('_pending') ? '' : occurredAt,
  deliveredAt: status.endsWith('_sent') || status === NOTIFICATION_DELIVERY_STATUSES.IN_APP ? occurredAt : '',
  providerMessageId: '',
  lastErrorCode: status.endsWith('_failed') ? 'MOCK_DELIVERY_FAILURE' : '',
  lastErrorMessage: status.endsWith('_failed') ? 'Simulated delivery failure. No external service was contacted.' : '',
});

export const createNotificationDeliveries = ({
  notificationId,
  recipients,
  occurredAt,
}) => recipients.flatMap(recipient => [
  deliveryRecord({
    notificationId,
    recipient,
    channel: NOTIFICATION_CHANNELS.IN_APP,
    status: NOTIFICATION_DELIVERY_STATUSES.IN_APP,
    occurredAt,
  }),
  deliveryRecord({
    notificationId,
    recipient,
    channel: NOTIFICATION_CHANNELS.EMAIL,
    status: simulatedStatusFor(notificationId, recipient, NOTIFICATION_CHANNELS.EMAIL),
    occurredAt,
  }),
  deliveryRecord({
    notificationId,
    recipient,
    channel: NOTIFICATION_CHANNELS.PUSH,
    status: simulatedStatusFor(notificationId, recipient, NOTIFICATION_CHANNELS.PUSH),
    occurredAt,
  }),
]);

const messageMapFor = (definition, record) => Object.fromEntries(
  Object.entries(definition.messages).map(([recipient, message]) => [
    recipient,
    typeof message === 'function' ? message(record) : String(message || ''),
  ]),
);

export const createNotificationRecord = ({
  id,
  eventType,
  record,
  actor,
  occurredAt,
  sourceAction = '',
  statusOverride = '',
  relatedOrderId = '',
}) => {
  const definition = NOTIFICATION_EVENT_CATALOG[eventType];
  if (!definition) throw new Error(`Unsupported notification event type: ${eventType}`);
  const notificationId = id;
  const recipients = [...definition.recipients];
  const messages = messageMapFor(definition, record);
  const entityType = record.workflowType || 'rfq';
  return {
    id: notificationId,
    schemaVersion: 2,
    eventType,
    category: definition.category,
    title: definition.title,
    priority: definition.priority,
    entityId: record.id,
    entityType,
    reference: record.reference,
    relatedOrderId,
    companyId: record.companyId,
    representativeId: record.selectedRep?.id || record.representativeId || '',
    status: statusOverride || definition.status || record.trackingStatus,
    recipients,
    customerVisible: definition.customerVisible,
    messages,
    message: messages.customer || messages.internal || Object.values(messages)[0] || definition.title,
    link: {
      entityType,
      entityId: record.id,
      reference: record.reference,
      customerView: 'tracking',
      internalView: eventType.startsWith('technical_') ? 'technical' : 'expeditor',
    },
    audit: {
      sourceAction,
      actorId: actor?.id || 'workflow-service',
      actorRole: actor?.role || 'system',
      actorDisplayName: actor?.displayName || 'Workflow service',
      createdAt: occurredAt,
    },
    deliveries: createNotificationDeliveries({
      notificationId,
      recipients,
      occurredAt,
    }),
    retryPolicy: {
      maxAttempts: 3,
      strategy: 'exponential_backoff',
      initialDelaySeconds: 60,
    },
    createdAt: occurredAt,
    readBy: [],
    readAtBy: {},
  };
};

const inferLegacyEventType = notification => {
  const byStatus = {
    submitted: NOTIFICATION_EVENT_TYPES.RFQ_SUBMITTED,
    assigned_to_rep: NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED,
    under_rep_review: NOTIFICATION_EVENT_TYPES.RFQ_UNDER_REVIEW,
    quoted: NOTIFICATION_EVENT_TYPES.RFQ_QUOTED,
    awaiting_customer_acceptance: NOTIFICATION_EVENT_TYPES.CUSTOMER_ACKNOWLEDGEMENT,
    converted_to_order: NOTIFICATION_EVENT_TYPES.ORDER_CREATED,
    awaiting_planning: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_PLANNING,
    submitted_to_expediting: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_EXPEDITING,
    expediting_in_progress: NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE,
    awaiting_dispatch: NOTIFICATION_EVENT_TYPES.ORDER_SENT_TO_DISPATCH,
    ready_for_collection: NOTIFICATION_EVENT_TYPES.READY_FOR_COLLECTION,
    out_for_delivery: NOTIFICATION_EVENT_TYPES.OUT_FOR_DELIVERY,
    delivered: NOTIFICATION_EVENT_TYPES.DELIVERED,
    collected: NOTIFICATION_EVENT_TYPES.COLLECTED,
    completed: NOTIFICATION_EVENT_TYPES.COMPLETED,
    cancelled: notification.entityType === 'order'
      ? NOTIFICATION_EVENT_TYPES.ORDER_CANCELLED
      : NOTIFICATION_EVENT_TYPES.RFQ_CANCELLED,
    expired: NOTIFICATION_EVENT_TYPES.RFQ_EXPIRED,
    on_hold: NOTIFICATION_EVENT_TYPES.ORDER_ON_HOLD,
  };
  return byStatus[notification.status] || NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE;
};

export const normaliseNotificationRecord = notification => {
  const eventType = notification.eventType || inferLegacyEventType(notification);
  const definition = NOTIFICATION_EVENT_CATALOG[eventType] || NOTIFICATION_EVENT_CATALOG[NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE];
  const occurredAt = notification.createdAt || new Date(0).toISOString();
  const recipients = notification.recipients?.length ? [...notification.recipients] : [...definition.recipients];
  const id = notification.id || `notification-${deterministicNumber(JSON.stringify(notification))}`;
  const messages = { ...(notification.messages || {}) };
  if (!messages.customer && notification.customerVisible !== false && recipients.includes('customer')) messages.customer = notification.message || definition.title;
  if (!messages.internal && notification.message) messages.internal = notification.message;
  return {
    ...notification,
    id,
    schemaVersion: 2,
    eventType,
    category: notification.category || definition.category,
    title: notification.title || definition.title,
    priority: notification.priority || definition.priority,
    recipients,
    customerVisible: notification.customerVisible ?? definition.customerVisible,
    messages,
    link: notification.link || {
      entityType: notification.entityType || 'rfq',
      entityId: notification.entityId,
      reference: notification.reference,
      customerView: 'tracking',
      internalView: 'expeditor',
    },
    audit: notification.audit || {
      sourceAction: notification.sourceAction || 'legacy_notification',
      actorId: '',
      actorRole: 'system',
      actorDisplayName: 'Workflow service',
      createdAt: occurredAt,
    },
    deliveries: notification.deliveries?.length
      ? notification.deliveries
      : createNotificationDeliveries({ notificationId: id, recipients, occurredAt }),
    retryPolicy: notification.retryPolicy || {
      maxAttempts: 3,
      strategy: 'exponential_backoff',
      initialDelaySeconds: 60,
    },
    createdAt: occurredAt,
    readBy: [...(notification.readBy || [])],
    readAtBy: { ...(notification.readAtBy || {}) },
  };
};

export const messageForNotificationRecipient = (notification, accountRole) => {
  if (accountRole === 'customer') return notification.messages?.customer || notification.message;
  if (accountRole === 'sales_representative') {
    return notification.messages?.assigned_representative || notification.messages?.internal || notification.message;
  }
  return notification.messages?.[accountRole] || notification.messages?.internal || notification.message;
};

export const notificationMatchesPreferences = (notification, preferences) => {
  const normalised = normaliseNotificationPreferences(preferences);
  return normalised.channels.inApp !== false && normalised.categories[notification.category] !== false;
};

export const deliveryLabel = delivery => ({
  [NOTIFICATION_DELIVERY_STATUSES.IN_APP]: 'In app',
  [NOTIFICATION_DELIVERY_STATUSES.EMAIL_PENDING]: 'Email pending (simulated)',
  [NOTIFICATION_DELIVERY_STATUSES.EMAIL_SENT]: 'Email sent (simulated)',
  [NOTIFICATION_DELIVERY_STATUSES.EMAIL_FAILED]: 'Email failed (simulated)',
  [NOTIFICATION_DELIVERY_STATUSES.PUSH_PENDING]: 'Push pending (simulated)',
  [NOTIFICATION_DELIVERY_STATUSES.PUSH_SENT]: 'Push sent (simulated)',
  [NOTIFICATION_DELIVERY_STATUSES.PUSH_FAILED]: 'Push failed (simulated)',
}[delivery?.status] || 'Delivery status unavailable');

export const retryMockDelivery = (delivery, occurredAt) => {
  if (![NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.PUSH].includes(delivery?.channel)) {
    throw new Error('Only simulated email or push deliveries can be retried.');
  }
  const attemptCount = Number(delivery.attemptCount || 0) + 1;
  const maxAttempts = Number(delivery.maxAttempts || 3);
  const prefix = delivery.channel === NOTIFICATION_CHANNELS.EMAIL ? 'email' : 'push';
  const succeeded = attemptCount >= 2 || deterministicNumber(`${delivery.id}:${attemptCount}`) % 2 === 0;
  const status = succeeded ? `${prefix}_sent` : `${prefix}_failed`;
  return {
    ...delivery,
    status,
    attemptCount,
    retryable: !succeeded && attemptCount < maxAttempts,
    nextRetryAt: !succeeded && attemptCount < maxAttempts ? occurredAt : '',
    lastAttemptAt: occurredAt,
    deliveredAt: succeeded ? occurredAt : '',
    lastErrorCode: succeeded ? '' : 'MOCK_DELIVERY_FAILURE',
    lastErrorMessage: succeeded ? '' : 'Simulated retry failed. No external service was contacted.',
  };
};
