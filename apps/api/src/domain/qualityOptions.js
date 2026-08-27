// Shared, non-operational reference data for API and public-demo forms.
export const QA_PROBLEM_CATEGORIES = Object.freeze([
  { id: 'incorrect_assembly', label: 'Incorrect assembly' },
  { id: 'incorrect_configuration', label: 'Incorrect configuration' },
  { id: 'calibration_issue', label: 'Calibration issue' },
  { id: 'physical_damage', label: 'Physical damage' },
  { id: 'labelling_issue', label: 'Labelling issue' },
  { id: 'functional_test_failure', label: 'Functional test failure' },
  { id: 'leakage', label: 'Leakage' },
  { id: 'electrical_issue', label: 'Electrical issue' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'missing_component', label: 'Missing component' },
  { id: 'incorrect_product', label: 'Incorrect product' },
  { id: 'other', label: 'Other' },
]);

export const QA_SEVERITIES = Object.freeze([
  { id: 'minor', label: 'Minor' },
  { id: 'major', label: 'Major' },
  { id: 'critical', label: 'Critical' },
]);

export const QA_REWORK_DESTINATIONS = Object.freeze([
  { id: 'planning', label: 'Planning' },
  { id: 'materials', label: 'Materials' },
  { id: 'stores', label: 'Stores' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'production', label: 'Production' },
  { id: 'calibration_testing', label: 'Calibration or Testing' },
  { id: 'expediting', label: 'Expediting' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'other', label: 'Other' },
]);

export const QA_QUEUE_STATUSES = Object.freeze(['awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_expediting', 'qa_reinspection_required', 'qa_passed']);
