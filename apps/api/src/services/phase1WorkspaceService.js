import { validationError } from '../errors.js';
import { requirePermission } from '../authorization/permissions.js';
import { averageHours, buildOperationalStatistics, reportRecord } from '../domain/operationalStatistics.js';
import { QA_PROBLEM_CATEGORIES, QA_SEVERITIES, QA_REWORK_DESTINATIONS } from '../domain/qualityOptions.js';
import { EXPEDITOR_PROGRESS_STEPS, REQUIRED_EXPEDITOR_STEP_IDS, EXPEDITOR_DOCUMENT_TYPES } from '../domain/expeditingOptions.js';
import { DISPATCH_METHODS, DISPATCH_PROOF_TYPES } from '../domain/dispatchWorkflow.js';
import { buildSalesPerformanceAnalytics, formatDurationDaysHours, resolveManagementPeriod } from '../domain/salesAnalytics.js';
import { MANAGEMENT_REPORT_SECTIONS, generateManagementPdfReport } from '../domain/managementReports.js';

const clone = value => structuredClone(value);
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const commercialAccess = actor => ['company_owner','sales_manager'].some(role => (actor.roles || [actor.role]).includes(role)) && actor.permissions.includes('view_commercial_analytics');

function reportOptions(input = {}) {
  const errors = {};
  if (input.periodMode && !['last_31_days','date_range','rolling_months'].includes(input.periodMode)) errors.periodMode = 'Select a supported period.';
  if (input.rollingMonths !== undefined && (!Number.isInteger(Number(input.rollingMonths)) || Number(input.rollingMonths) < 1 || Number(input.rollingMonths) > 60)) errors.rollingMonths = 'Select 1 to 60 months.';
  if (input.periodMode === 'date_range') {
    for (const key of ['startDate','endDate']) if (!/^\d{4}-\d{2}-\d{2}$/.test(input[key] || '') || !Number.isFinite(Date.parse(input[key])) || new Date(input[key]).toISOString().slice(0,10) !== input[key]) errors[key] = 'Enter a valid date.';
    if (input.startDate > input.endDate) errors.startDate = 'Start date must not follow end date.';
  }
  const sections = input.sections || MANAGEMENT_REPORT_SECTIONS.map(item => item.id);
  if (!Array.isArray(sections) || !sections.length || sections.some(id => !MANAGEMENT_REPORT_SECTIONS.some(item => item.id === id))) errors.sections = 'Select approved report sections.';
  if (Object.keys(errors).length) throw validationError(errors);
  return { ...input, periodMode: input.periodMode || 'last_31_days', sections };
}

const notificationPreferences = Object.freeze({
  schemaVersion: 1,
  channels: Object.freeze({ inApp: true, email: true, push: true }),
  categories: Object.freeze({
    rfqUpdates: true, quotationNotifications: true, orderProgress: true,
    delayNotifications: true, fulfilmentNotifications: true, accountSecurity: true,
    maintenanceNotices: true, companyAnnouncements: true,
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

const deepMerge = (base, candidate) => {
  if (!isObject(base) || !isObject(candidate)) return candidate === undefined ? clone(base) : clone(candidate);
  return Object.fromEntries([
    ...Object.keys(base).map(key => [key, deepMerge(base[key], candidate[key])]),
    ...Object.keys(candidate).filter(key => !(key in base)).map(key => [key, clone(candidate[key])]),
  ]);
};

function validateSettings(candidate) {
  if (!isObject(candidate)) throw validationError({ settings: 'Settings must be a JSON object.' });
  if (candidate.appearance?.mode && !['light', 'dark', 'system'].includes(candidate.appearance.mode)) {
    throw validationError({ 'appearance.mode': 'Choose light, dark or system appearance.' });
  }
  if (candidate.sounds?.volume !== undefined && (!Number.isFinite(Number(candidate.sounds.volume)) || Number(candidate.sounds.volume) < 0 || Number(candidate.sounds.volume) > 1)) {
    throw validationError({ 'sounds.volume': 'Sound volume must be between 0 and 1.' });
  }
  return deepMerge(userSettings, candidate);
}

function validatePreferences(candidate) {
  if (!isObject(candidate)) throw validationError({ preferences: 'Notification preferences must be a JSON object.' });
  const merged = deepMerge(notificationPreferences, candidate);
  merged.channels.inApp = true;
  return merged;
}

export function createPhase1WorkspaceService({ repository, maxUploadBytes, clock = () => new Date() }) {
  const service = {
    async getCurrentDraft(actor) {
      const row = await repository.getEnquiryDraft(actor);
      return { items: row?.items || [], updatedAt: row?.updated_at || '' };
    },
    async saveCurrentDraft(actor, items) {
      if (!Array.isArray(items) || items.length > 100) throw validationError({ items: 'The RFQ draft must contain no more than 100 line items.' });
      const row = await repository.saveEnquiryDraft(actor, items);
      return { items: row.items, updatedAt: row.updated_at };
    },
    listOrders: actor => repository.listOrders(actor),
    listNotifications: actor => repository.listNotifications(actor),
    markNotificationRead: (actor, id, correlationId) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) throw validationError({ notification: 'Choose a valid notification.' });
      return repository.markNotificationRead(actor, id, correlationId);
    },
    markAllNotificationsRead: (actor, correlationId) => repository.markAllNotificationsRead(actor, correlationId),
    getWorkspaceRevision: actor => repository.getWorkspaceRevision(actor),
    listAuditEvents: actor => repository.listAuditEvents(actor),
    async getNotificationPreferences(actor) {
      const row = await repository.getNotificationPreferences(actor);
      return { ...deepMerge(notificationPreferences, row?.preferences || {}), updatedAt: row?.updated_at || '' };
    },
    async saveNotificationPreferences(actor, candidate) {
      const row = await repository.saveNotificationPreferences(actor, validatePreferences(candidate));
      return { ...row.preferences, updatedAt: row.updated_at };
    },
    async getUserSettings(actor) {
      const row = await repository.getUserSettings(actor);
      return { ...deepMerge(userSettings, row?.settings || {}), updatedAt: row?.updated_at || '', rowVersion: row?.row_version || 0 };
    },
    async saveUserSettings(actor, candidate) {
      const row = await repository.saveUserSettings(actor, validateSettings(candidate));
      return { ...row.settings, updatedAt: row.updated_at, rowVersion: row.row_version };
    },
    async updateOnboarding(actor, patch) {
      const current = await service.getUserSettings(actor);
      return service.saveUserSettings(actor, { ...current, onboarding: { ...current.onboarding, ...patch } });
    },
    async resetUserSettings(actor) {
      const row = await repository.saveUserSettings(actor, clone(userSettings));
      return { ...row.settings, updatedAt: row.updated_at, rowVersion: row.row_version };
    },
    async getPlanningOptions(actor) {
      const locations = await repository.listLocations(actor);
      return { users: [{ id: actor.id, name: actor.contact, displayName: actor.contact }], locations, priorities: ['standard', 'high', 'urgent'] };
    },
    getExpeditingOptions: () => ({
      progressSteps: clone(EXPEDITOR_PROGRESS_STEPS),
      requiredStepIds: [...REQUIRED_EXPEDITOR_STEP_IDS],
      documentTypes: clone(EXPEDITOR_DOCUMENT_TYPES), approachingCompletionDays: 3,
    }),
    getDispatchOptions: () => ({ methods: DISPATCH_METHODS, proofTypes: DISPATCH_PROOF_TYPES, maxProofBytes: maxUploadBytes }),
    getLaboratoryOptions: () => ({ certificationTypes: ['SANAS', 'Traceable'], releaseDestinations: ['expediting', 'dispatch'], maxCertificateBytes: maxUploadBytes }),
    getQualityOptions: () => ({ problemCategories: clone(QA_PROBLEM_CATEGORIES), severities: clone(QA_SEVERITIES), reworkDestinations: clone(QA_REWORK_DESTINATIONS) }),
    getLocations: actor => repository.listLocations(actor),
    async saveLocation(actor, candidate, correlationId) {
      if (!isObject(candidate)) throw validationError({ location: 'Location details are required.' });
      const name = String(candidate.name || candidate.branch || '').trim();
      const branchCode = String(candidate.branchCode || candidate.branchId || '').trim();
      const address = String(candidate.address || '').trim();
      const latitude = Number(candidate.latitude);
      const longitude = Number(candidate.longitude);
      const radiusMetres = Math.trunc(Number(candidate.radiusMetres));
      const errors = {};
      if (name.length < 2) errors.name = 'Enter the location name.';
      if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(branchCode)) errors.branchId = 'Choose a valid branch code.';
      if (address.length < 5) errors.address = 'Enter the office address.';
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'Enter a valid latitude.';
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = 'Enter a valid longitude.';
      if (!Number.isInteger(radiusMetres) || radiusMetres < 25 || radiusMetres > 100000) errors.radiusMetres = 'Enter a radius between 25 and 100,000 metres.';
      if (Object.keys(errors).length) throw validationError(errors);
      return repository.saveLocation(actor, { id: candidate.id || null, name, branchCode, address, latitude, longitude, radiusMetres, status: candidate.active === false ? 'inactive' : 'active', correlationId });
    },
    listTechnicalRequests: actor => repository.listTechnicalRequests(actor),
    async getManagementDashboard(actor, filters = {}) {
      if (!actor.permissions.includes('view_reports')) requirePermission(actor, 'view_all_orders');
      const options = reportOptions(filters);
      const period = resolveManagementPeriod(options, clock());
      const [allRfqs, allOrders] = await Promise.all([repository.listEnquiries(actor, { forReporting: true }), repository.listOrders(actor, { forReporting: true })]);
      const sourceById = new Map(allRfqs.map(item => [item.id, item]));
      for (const order of allOrders) if (order.sourceRfqId) order.sourceRfqReference = sourceById.get(order.sourceRfqId)?.reference || order.sourceRfqId;
      const scope = item => (!options.representativeId || options.representativeId === 'all' || item.selectedRep?.id === options.representativeId)
        && (!options.branchId || options.branchId === 'all' || item.selectedRep?.branchId === options.branchId);
      const inPeriod = item => { const timestamp = Date.parse(item.createdAt); if (!Number.isFinite(timestamp)) return false; const date = new Date(timestamp).toISOString().slice(0,10); return date >= period.startDate && date <= period.endDate; };
      const filtered = Boolean(options.periodMode || options.rollingMonths);
      const rfqs = allRfqs.filter(scope).filter(item => !filtered || inPeriod(item));
      const orders = allOrders.filter(scope).filter(item => !filtered || inPeriod(item));
      let salesPerformance = { authorised: false };
      if (commercialAccess(actor)) {
        const values = new Map((await repository.listCommercialQuotations(actor)).map(item => [item.id, item.quotation]));
        const inputs = [...allRfqs, ...allOrders].map(item => ({ ...item, quotation: values.get(item.id) || item.quotation }));
        salesPerformance = buildSalesPerformanceAnalytics(inputs, { ...options, now: clock() });
      }
      const audits = actor.permissions.includes('read_audit_history') ? await repository.listAuditEvents(actor) : [];
      const records = [...rfqs, ...orders];
      const group = (items, selector) => [...items.reduce((map, item) => {
        const label = selector(item) || 'Unassigned';
        map.set(label, (map.get(label) || 0) + 1); return map;
      }, new Map())].map(([label, count]) => ({ label, count }));
      const status = String(filters.status || 'all');
      const branch = String(filters.branch || 'all');
      const search = String(filters.search || '').trim().toLowerCase();
      const searchText = item => [item.reference,item.sourceRfqReference,item.internalJobNumber,item.salesOrderNumber,item.customerPoNumber,item.company,item.contact,item.selectedRep?.name,item.selectedRep?.code,item.trackingStatus].filter(Boolean).join(' ').toLowerCase();
      const visibleRecords = records.filter(item => status === 'all' || item.trackingStatus === status)
        .filter(item => branch === 'all' || item.selectedRep?.branchId === branch)
        .filter(item => !search || searchText(item).includes(search));
      const terminalRfqs = new Set(['cancelled','expired','converted_to_order']);
      const terminalOrders = new Set(['completed','cancelled','archived']);
      const activeOrders = orders.filter(item => !terminalOrders.has(item.trackingStatus));
      const now = clock();
      const stageHours = averageHours(records.flatMap(record => (record.trackingHistory || []).slice(1).map((event, index) => [record.trackingHistory[index].createdAt, event.createdAt])));
      const ageing = visibleRecords.filter(item => item.workflowType === 'rfq' ? !terminalRfqs.has(item.trackingStatus) : !terminalOrders.has(item.trackingStatus))
        .map(item => ({ ...reportRecord(item), ageDays: Math.max(0,Math.floor((now-new Date(item.updatedAt || item.createdAt || now))/86400000)) }))
        .sort((left,right) => right.ageDays-left.ageDays);
      return {
        generatedAt: now.toISOString(), period,
        metrics: {
          openRfqs: rfqs.filter(item => !terminalRfqs.has(item.trackingStatus)).length,
          awaitingRepresentativeAction: rfqs.filter(item => ['assigned_to_rep','under_rep_review'].includes(item.trackingStatus)).length,
          quotedRfqs: rfqs.filter(item => ['quoted','awaiting_customer_acceptance'].includes(item.trackingStatus)).length,
          awaitingPlanning: orders.filter(item => item.trackingStatus === 'awaiting_planning').length,
          inExpediting: orders.filter(item => ['submitted_to_expediting','expediting_in_progress'].includes(item.trackingStatus)).length,
          inLaboratory: orders.filter(item => String(item.trackingStatus || '').includes('lab') || String(item.trackingStatus || '').includes('calibration')).length,
          inQualityAssurance: orders.filter(item => String(item.trackingStatus || '').includes('qa')).length,
          onHold: orders.filter(item => item.trackingStatus === 'on_hold').length,
          delayed: activeOrders.filter(item => item.expediting?.currentDelayReason || item.dispatch?.currentProblemReason).length,
          inDispatch: orders.filter(item => ['awaiting_dispatch','ready_for_collection','out_for_delivery','delivered','collected'].includes(item.trackingStatus)).length,
          completed: orders.filter(item => item.trackingStatus === 'completed').length,
          archived: orders.filter(item => item.trackingStatus === 'archived').length,
          emergency: activeOrders.filter(item => item.priority === 'urgent' || item.emergency === 'yes').length,
          averageStageHours: stageHours, averageStageDuration: formatDurationDaysHours(stageHours),
        },
        records: visibleRecords.map(reportRecord), ageing,
        recentActivity: audits.slice(0, 20).map(event => ({ id: event.id, eventType: event.eventType, action: event.action, timestamp: event.timestamp || event.createdAt, actingUser: typeof event.actingUser === 'string' ? event.actingUser : event.actingUser?.displayName || 'System' })),
        ordersByRepresentative: group(orders, item => item.selectedRep?.name),
        ordersByBranch: group(orders, item => item.selectedRep?.branchName),
        ordersByStatus: group(orders, item => item.trackingStatus),
        phase21: buildOperationalStatistics(rfqs, orders, now),
        salesPerformance,
        filters: {
          statuses: [...new Set(records.map(item => item.trackingStatus).filter(Boolean))].sort(),
          branches: [...new Map(records.filter(item => item.selectedRep?.branchId).map(item => [item.selectedRep.branchId,{ id:item.selectedRep.branchId,name:item.selectedRep.branchName || item.selectedRep.branchId }])).values()].sort((left,right) => left.name.localeCompare(right.name)),
        },
      };
    },
    async getPerformanceReportOptions(actor) {
      requirePermission(actor, 'export_management_pdf');
      if (!commercialAccess(actor)) { const error = new Error('Restricted management reporting is not authorised.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error; }
      const records = [...await repository.listEnquiries(actor, { forReporting: true }), ...await repository.listOrders(actor, { forReporting: true })];
      return {
        representatives: [...new Map(records.filter(item => item.selectedRep?.id).map(item => [item.selectedRep.id, item.selectedRep])).values()],
        branches: [...new Map(records.filter(item => item.selectedRep?.branchId).map(item => [item.selectedRep.branchId, { id:item.selectedRep.branchId, name:item.selectedRep.branchName || item.selectedRep.branchId }])).values()],
        rollingMonthOptions: [1,3,6,12,24,36], sections: MANAGEMENT_REPORT_SECTIONS,
      };
    },
    async createPerformanceReport(actor, input, correlationId) {
      requirePermission(actor, 'export_management_pdf');
      if (!commercialAccess(actor)) { const error = new Error('Restricted management reporting is not authorised.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error; }
      const options = reportOptions(input);
      const dashboard = await service.getManagementDashboard(actor, options);
      const bytesBase64 = await generateManagementPdfReport({ dashboard, options, generatedAt: dashboard.generatedAt, generatedBy: actor.contact || actor.displayName || 'Authorised manager', roleLabel: actor.role.replaceAll('_',' ') });
      await repository.appendAudit({ eventType:'management.pdf_exported',actorUserId:actor.id,actorRole:actor.role,action:'export_management_pdf',entityType:'report',entityId:correlationId,outcome:'success',correlationId,details:{recordCount:dashboard.records.length,sections:options.sections,period:dashboard.period} });
      return { bytesBase64, mimeType:'application/pdf', period: dashboard.period, fileName:`rhomberg-management-${dashboard.period.startDate}-to-${dashboard.period.endDate}.pdf` };
    },
    async listArchivedOrders(actor) {
      const orders = await repository.listOrders(actor);
      return orders.filter(order => ['completed','archived'].includes(order.trackingStatus)).map(order => ({ ...order, retentionStatus: order.trackingStatus === 'archived' ? 'archived' : 'archive_eligible', archiveEligibleAt: order.completedAt || order.updatedAt, legalHold: order.details?.legalHold || { active: false }, allowedArchiveActions: { archive: order.trackingStatus === 'completed', restore: order.trackingStatus === 'archived', approve: false, export: true, legalHold: true } }));
    },
    async getPolicy(actor, code, fallback) {
      const row = await repository.getPolicy(actor, code);
      return row ? { ...row.value, updatedAt: row.updated_at } : clone(fallback);
    },
    async savePolicy(actor, code, value) {
      if (!isObject(value)) throw validationError({ policy: 'Policy settings must be a JSON object.' });
      const row = await repository.savePolicy(actor, code, value);
      return { ...row.value, updatedAt: row.updated_at };
    },
  };
  return Object.freeze(service);
}
