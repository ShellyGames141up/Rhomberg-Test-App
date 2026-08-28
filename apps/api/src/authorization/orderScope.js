// SQL narrows the rows already protected by RLS. Grants are additive: an
// assigned-Sales grant must never subtract an independently granted queue.
const queues = Object.freeze({
  view_planning_queue: ['awaiting_planning', 'planning_in_progress', 'planned'],
  view_expediting_queue: ['awaiting_lab_receipt_expediting', 'submitted_to_expediting', 'expediting_in_progress', 'qa_failed', 'returned_to_expediting', 'awaiting_qa', 'awaiting_dispatch', 'on_hold'],
  view_lab_queue: ['awaiting_lab', 'lab_received', 'calibration_in_progress', 'calibration_on_hold', 'calibration_completed', 'awaiting_lab_release', 'released_from_lab'],
  view_qa_queue: ['awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_expediting', 'qa_reinspection_required', 'qa_passed'],
  view_dispatch_queue: ['awaiting_lab_receipt_dispatch', 'awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected'],
});
const certificateTasks = "o.status <> 'cancelled' AND (EXISTS (SELECT 1 FROM app.order_items li WHERE li.order_id=o.id AND (li.configuration->>'sanas' ~* '^(yes|required)' OR li.configuration->>'traceability' ~* '^(yes|required)')) OR o.details ? 'laboratory')";

// A second department role is additive, even while Sales is the selected workspace.
export function hasDepartmentActionScope(actor, action, permission) {
  if (!actor.permissions.includes(permission)) return false;
  const groups = {
    view_planning_queue: ['start_planning','complete_planning','submit_to_expediting'],
    view_expediting_queue: ['start_expediting','add_expediting_update','complete_expediting'],
    view_qa_queue: ['start_qa','start_qa_reinspection','pass_qa','fail_qa','start_qa_rework','resubmit_to_qa','release_qa_order'],
    view_lab_queue: ['receive_lab_order','release_from_lab'],
    view_dispatch_queue: ['confirm_dispatch_receipt','confirm_lab_receipt_dispatch','mark_ready_for_collection','start_delivery','confirm_collection','confirm_delivery','complete_collection','complete_delivery','report_delivery_problem'],
  };
  return Object.entries(groups).some(([queue, actions]) => actor.permissions.includes(queue) && actions.includes(action));
}

export function orderScope(actor, { forLaboratory = false } = {}) {
  const has = permission => actor.permissions.includes(permission);
  if (forLaboratory) return { predicate: has('view_lab_queue') ? '(' + certificateTasks + ')' : 'FALSE', values: [] };
  if (has('view_all_orders')) return { predicate: 'TRUE', values: [] };
  const conditions = [], values = [];
  const parameter = value => { values.push(value); return '$' + values.length; };
  if (has('view_own_company_orders')) conditions.push('o.company_id = ANY(' + parameter(actor.companyIds || []) + '::uuid[])');
  if (has('view_assigned_orders') && actor.representativeId) conditions.push('o.representative_id = ' + parameter(actor.representativeId) + '::uuid');
  const statuses = [...new Set(Object.entries(queues).filter(([permission]) => has(permission)).flatMap(([, stages]) => stages))];
  if (statuses.length) conditions.push('o.status = ANY(' + parameter(statuses) + '::text[])');
  // Certificate preparation remains independent of physical fulfilment.
  if (has('view_lab_queue')) conditions.push('(' + certificateTasks + ')');
  return { predicate: conditions.length ? '(' + conditions.join(' OR ') + ')' : 'FALSE', values };
}
