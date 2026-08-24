const clone = value => structuredClone(value);

const notificationPreferences = Object.freeze({
  schemaVersion: 1,
  channels: Object.freeze({ inApp: true, email: true, push: true }),
  categories: Object.freeze({
    rfqUpdates: true,
    quotationNotifications: true,
    orderProgress: true,
    delayNotifications: true,
    fulfilmentNotifications: true,
    accountSecurity: true,
    maintenanceNotices: true,
    companyAnnouncements: true,
  }),
  updatedAt: '',
});

const userSettings = Object.freeze({
  schemaVersion: 1,
  app: Object.freeze({ defaultLandingPage: 'role_default', rememberLastSection: true, confirmImportantSubmissions: true, automaticDocumentOpening: false, language: 'en-ZA' }),
  sounds: Object.freeze({ enabled: true, volume: 0.48, categories: Object.freeze({ navigation: true, buttons: true, success: true, warning: true, error: true, notifications: true, transfers: true, rfqSubmission: true, startup: true }) }),
  haptics: Object.freeze({ enabled: true, strength: 'light', categories: Object.freeze({ buttons: true, success: true, warning: true, error: true, importantWorkflow: true }) }),
  appearance: Object.freeze({ mode: 'light', increasedText: false, highContrast: false, reducedTransparency: false }),
  accessibility: Object.freeze({ reduceMotion: false, decorativeAnimations: true, screenReaderOptimisation: false }),
  onboarding: Object.freeze({ welcomeCompleted: false, tutorialCompleted: false, tutorialProgress: 0, tutorialKind: 'full' }),
  roleNotifications: Object.freeze({}),
  updatedAt: '',
});

// These responses describe the capabilities available in the current Phase 1
// schema. They contain no operational records and never substitute mock data.
export function createPhase1WorkspaceService({ maxUploadBytes }) {
  return Object.freeze({
    getCurrentDraft: () => ({ items: [] }),
    listOrders: () => [],
    listNotifications: () => [],
    listAuditEvents: () => [],
    getNotificationPreferences: () => clone(notificationPreferences),
    getUserSettings: () => clone(userSettings),
    getPlanningOptions: () => ({ users: [], locations: [], priorities: ['standard', 'high', 'urgent'] }),
    getExpeditingOptions: () => ({ progressSteps: [], requiredStepIds: [], documentTypes: [], approachingCompletionDays: 3 }),
    getDispatchOptions: () => ({ methods: [], proofTypes: [], maxProofBytes: maxUploadBytes }),
    getLaboratoryOptions: () => ({ certificationTypes: [], releaseDestinations: [], maxCertificateBytes: maxUploadBytes }),
    getQualityOptions: () => ({ problemCategories: [], severities: [], reworkDestinations: [] }),
  });
}
