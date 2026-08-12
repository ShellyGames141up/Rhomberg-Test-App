import { USER_ROLES } from '../services/contracts.js';

export const APPEARANCE_MODES = Object.freeze(['light', 'dark', 'system']);
export const SETTINGS_SECTIONS = Object.freeze([
  'home', 'app', 'sounds', 'notifications', 'appearance', 'accessibility',
  'security', 'tutorials', 'privacy', 'about',
]);

export const SOUND_CATEGORIES = Object.freeze([
  'navigation', 'buttons', 'success', 'warning', 'error', 'notifications',
  'transfers', 'rfqSubmission', 'startup',
]);

export const HAPTIC_CATEGORIES = Object.freeze([
  'buttons', 'success', 'warning', 'error', 'importantWorkflow',
]);

export const showsDefaultLandingPageForRole = role => role !== USER_ROLES.SALES_REPRESENTATIVE;

export const CUSTOMER_NOTIFICATION_GROUPS = Object.freeze([
  { id: 'rfqs', label: 'RFQs', items: ['RFQ Submitted', 'RFQ Under Review', 'Technical Review Required', 'RFQ Updates'] },
  { id: 'quotations', label: 'Quotations', items: ['Quotation Available', 'Amended Quotation', 'Quotation Expiring', 'PO Required'] },
  { id: 'orders', label: 'Orders', items: ['Order Accepted', 'Planning Updates', 'Production Updates', 'Delay Updates', 'Laboratory Updates', 'QA Updates', 'Dispatch Updates', 'Delivery or Collection Updates', 'Order Completed'] },
  { id: 'documents', label: 'Documents', items: ['Certificate Available', 'Delivery Note Available', 'Courier Note Available', 'Document Correction Required'] },
  { id: 'account', label: 'Account', items: ['Security Alerts', 'Username Changed', 'Password Changed', 'Account Notices'] },
  { id: 'general', label: 'General', items: ['Maintenance Notices', 'Important Company Announcements', 'Optional Product Updates'] },
]);

const INTERNAL_NOTIFICATION_GROUPS = Object.freeze({
  [USER_ROLES.SALES_REPRESENTATIVE]: ['New RFQ', 'Customer Response', 'Quotation Rejected', 'PO Uploaded', 'Technical Support Response', 'Order Updates'],
  [USER_ROLES.PLANNING]: ['New Planning Order', 'Planning Overdue', 'Returned Order'],
  [USER_ROLES.LABORATORY_USER]: ['New Lab Job', 'Urgent Lab Job', 'Job Returned', 'Certificate Review Required', 'Signature Required'],
  [USER_ROLES.LABORATORY_TECHNICIAN]: ['New Lab Job', 'Urgent Lab Job', 'Job Returned', 'Certificate Review Required'],
  [USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN]: ['New Lab Job', 'Urgent Lab Job', 'Job Returned', 'Certificate Review Required'],
  [USER_ROLES.LABORATORY_MANAGER]: ['New Lab Job', 'Urgent Lab Job', 'Certificate Review Required', 'Signature Required'],
  [USER_ROLES.EXPEDITOR]: ['New Production Order', 'Delay', 'QA Failure', 'Lab Release', 'Dispatch Receipt'],
  [USER_ROLES.QUALITY_ASSURANCE]: ['New Inspection', 'Reinspection', 'Quality Escalation'],
  [USER_ROLES.QUALITY_MANAGER]: ['New Inspection', 'Reinspection', 'Quality Escalation'],
  [USER_ROLES.DISPATCH]: ['Incoming Dispatch Order', 'Ready for Delivery', 'Delivery Problem'],
  [USER_ROLES.MANAGER]: ['Exceptions', 'Delays', 'Approvals', 'Performance Summaries'],
  [USER_ROLES.SALES_MANAGER]: ['New RFQ', 'Quotation Rejected', 'Exceptions', 'Approvals', 'Performance Summaries'],
  [USER_ROLES.COMPANY_OWNER]: ['Exceptions', 'Delays', 'Approvals', 'Performance Summaries'],
  [USER_ROLES.ADMINISTRATOR]: ['Security Alerts', 'Permission Changes', 'Platform Exceptions', 'Maintenance Notices'],
  [USER_ROLES.TECHNICAL_SUPPORT]: ['New Technical Request', 'Customer Response', 'Technical Review Due', 'Technical Review Overdue'],
  [USER_ROLES.TECHNICAL_DIRECTOR]: ['New Technical Request', 'Technical Review Due', 'Technical Review Overdue', 'Overrides'],
});

export const notificationGroupsForRole = role => role === USER_ROLES.CUSTOMER
  ? CUSTOMER_NOTIFICATION_GROUPS
  : [{ id: 'role', label: 'Role notifications', items: INTERNAL_NOTIFICATION_GROUPS[role] || ['Assigned work', 'Workflow updates', 'Exceptions'] }];

export const settingsSectionsForRole = role => SETTINGS_SECTIONS.filter(section => (
  section !== 'privacy' || role === USER_ROLES.CUSTOMER
));

const enabledMap = keys => Object.fromEntries(keys.map(key => [key, true]));

export const createDefaultUserSettings = () => ({
  schemaVersion: 1,
  app: {
    defaultLandingPage: 'role_default',
    rememberLastSection: true,
    confirmImportantSubmissions: true,
    automaticDocumentOpening: false,
    language: 'en-ZA',
  },
  sounds: {
    enabled: true,
    volume: 0.48,
    categories: enabledMap(SOUND_CATEGORIES),
  },
  haptics: {
    enabled: true,
    strength: 'light',
    categories: enabledMap(HAPTIC_CATEGORIES),
  },
  appearance: {
    mode: 'light',
    increasedText: false,
    highContrast: false,
    reducedTransparency: false,
  },
  accessibility: {
    reduceMotion: false,
    decorativeAnimations: true,
    screenReaderOptimisation: false,
  },
  onboarding: {
    welcomeCompleted: false,
    tutorialCompleted: false,
    tutorialProgress: 0,
    tutorialKind: 'full',
  },
  roleNotifications: {},
  updatedAt: '',
});

const booleanValue = (value, fallback) => typeof value === 'boolean' ? value : fallback;

export const normaliseUserSettings = candidate => {
  const defaults = createDefaultUserSettings();
  const value = candidate || {};
  const mode = APPEARANCE_MODES.includes(value.appearance?.mode) ? value.appearance.mode : defaults.appearance.mode;
  return {
    ...defaults,
    ...value,
    app: { ...defaults.app, ...(value.app || {}) },
    sounds: {
      ...defaults.sounds,
      ...(value.sounds || {}),
      enabled: booleanValue(value.sounds?.enabled, defaults.sounds.enabled),
      volume: Math.min(1, Math.max(0, Number(value.sounds?.volume ?? defaults.sounds.volume))),
      categories: { ...defaults.sounds.categories, ...(value.sounds?.categories || {}) },
    },
    haptics: {
      ...defaults.haptics,
      ...(value.haptics || {}),
      enabled: booleanValue(value.haptics?.enabled, defaults.haptics.enabled),
      categories: { ...defaults.haptics.categories, ...(value.haptics?.categories || {}) },
    },
    appearance: {
      ...defaults.appearance,
      ...(value.appearance || {}),
      mode,
    },
    accessibility: { ...defaults.accessibility, ...(value.accessibility || {}) },
    onboarding: {
      ...defaults.onboarding,
      ...(value.onboarding || {}),
      tutorialProgress: Math.max(0, Math.trunc(Number(value.onboarding?.tutorialProgress) || 0)),
    },
    roleNotifications: { ...defaults.roleNotifications, ...(value.roleNotifications || {}) },
  };
};

export const validateUserSettings = candidate => {
  const value = normaliseUserSettings(candidate);
  const errors = {};
  if (!APPEARANCE_MODES.includes(value.appearance.mode)) errors['appearance.mode'] = 'Choose Light, Dark or System Default.';
  if (value.sounds.volume < 0 || value.sounds.volume > 1) errors['sounds.volume'] = 'Choose a sound volume between 0 and 100 percent.';
  if (!['light', 'medium'].includes(value.haptics.strength)) errors['haptics.strength'] = 'Choose light or medium haptic feedback.';
  return errors;
};

export const TUTORIALS = Object.freeze([
  { id: 'full', label: 'Replay Full Tutorial', startStep: 0 },
  { id: 'catalogue', label: 'Product Catalogue Tutorial', startStep: 1 },
  { id: 'rfq', label: 'RFQ Tutorial', startStep: 6 },
  { id: 'tracking', label: 'Tracking Tutorial', startStep: 10 },
]);

export const TUTORIAL_STEPS = Object.freeze([
  { target: 'welcome', title: 'Learn by creating a fake RFQ', copy: 'This guided journey asks you to perform each step yourself. The example stays completely separate from real records.' },
  { target: 'catalogue', title: 'Open the Catalogue', copy: 'Select the highlighted Catalogue control to begin choosing an instrument.' },
  { target: 'category', title: 'Choose Pressure', copy: 'Select the highlighted Pressure family to see suitable units.' },
  { target: 'unit', title: 'Choose a unit', copy: 'Choose the PBG pressure gauge for this fabricated water-line application.' },
  { target: 'product', title: 'Open the configurator', copy: 'Review the product summary, then select Configure this unit.' },
  { target: 'configuration', title: 'Configure the instrument', copy: 'Choose a pressure range and process connection, then add the configured unit.' },
  { target: 'rfq', title: 'Review the configured unit', copy: 'Confirm the product and continue to the RFQ details.' },
  { target: 'details', title: 'Complete the RFQ details', copy: 'Describe the application, confirm collection or delivery, and notice the remembered representative.' },
  { target: 'review', title: 'Review before submitting', copy: 'Check every field and confirm that this is a fabricated tutorial RFQ.' },
  { target: 'submit', title: 'Submit the fake RFQ', copy: 'Use the highlighted control. No operational service call is made.' },
  { target: 'confirmation', title: 'Open tracking', copy: 'The fake reference demonstrates a successful result. Select Track this fake RFQ.' },
  { target: 'tracking', title: 'Follow customer-safe progress', copy: 'Review the fabricated timeline and finish. You can replay this tutorial from Settings at any time.' },
]);

export const tutorialDraftForStep = step => ({
  range: step > 5 ? '0 to 10 bar' : '',
  connection: step > 5 ? '1/2 inch BSP' : '',
  application: step > 7 ? 'Water-line pressure monitoring tutorial' : '',
  fulfilment: step > 7 ? 'collect' : '',
  consent: step > 8,
});
