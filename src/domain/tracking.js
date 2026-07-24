import {
  progressForWorkflowStatus,
  workflowStatusById,
  workflowStatuses,
} from './workflow.js';

// Compatibility presentation helpers. Workflow decisions live only in workflow.js.
export const trackingStatuses = workflowStatuses;

export const statusById = (id, entityType) => workflowStatusById(id, entityType)
  || { id, label: 'Unknown status', customerDescription: 'Status unavailable.', internalDescription: 'Unrecognised workflow status.', customerVisible: false, progress: 5 };

export const progressForStatus = (id, entityType) => progressForWorkflowStatus(id, entityType);
