import { areas, branches } from '../../data/branches.js';
import { categories, industries, products, recommendedCategories } from '../../data/catalogue.js';
import { representativesForArea } from '../../data/representatives.js';
import {
  createDeniedWorkflowAudit,
  createWorkflowActor,
  getAllowedWorkflowActions,
  inferWorkflowEntityType,
  ORDER_STATUSES,
  performWorkflowTransition,
  RFQ_STATUSES,
  SYSTEM_ACTOR_ROLE,
  workflowStatusById,
} from '../../domain/workflow.js';
import { optionsForField, shouldShowField } from '../../domain/productConfiguration.js';
import { RFQ_EMAIL_RECIPIENT, sendRfqEmail } from '../../lib/rfqEmail.js';
import { PERMISSIONS, ServiceError, USER_ROLES, roleCan, toPublicAccount } from '../contracts.js';
import { MAX_PO_FILE_BYTES, validateEnquiry, validateRegistration, validateSignIn, validateWorkflowActionRequest } from '../validation.js';
import { createBrowserStore } from '../browserStore.js';
import {
  DEMO_ACCOUNT,
  DEMO_ENQUIRIES,
  DEMO_LOGINS,
  EXPEDITOR_ACCOUNT,
  EXTRA_DEMO_ACCOUNTS,
  LEGACY_STORE_KEYS,
  STORE_KEYS,
} from './seedData.js';

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const makeId = prefix => {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${token}`;
};

const normaliseAccount = account => {
  const role = account.role || USER_ROLES.CUSTOMER;
  return {
    ...account,
    role,
    companyId: account.companyId || (role === USER_ROLES.CUSTOMER ? account.id : 'company-rhomberg'),
  };
};

const LEGACY_STATUS_MAP = Object.freeze({
  'rfq-submitted': 'submitted',
  'under-review': 'under_rep_review',
  'quotation-sent': 'awaiting_customer_acceptance',
  'po-received': 'awaiting_planning',
  scheduled: 'submitted_to_expediting',
  'in-production': 'expediting_in_progress',
  'quality-check': 'expediting_in_progress',
  ready: 'awaiting_dispatch',
  dispatched: 'out_for_delivery',
  completed: 'completed',
  'on-hold': 'on_hold',
});

const migrateStatus = value => LEGACY_STATUS_MAP[value] || value;

const normaliseHistoryEvent = (event, fallbackCreatedAt) => {
  const toStatus = migrateStatus(event.toStatus || event.status || 'submitted');
  const eventEntityType = ORDER_STATUSES.includes(toStatus) ? 'order' : 'rfq';
  const definition = workflowStatusById(toStatus, eventEntityType);
  return {
    ...event,
    entityType: event.entityType || eventEntityType,
    action: event.action || 'legacy_status_imported',
    fromStatus: migrateStatus(event.fromStatus || ''),
    toStatus,
    status: toStatus,
    label: event.label || definition?.label || 'Workflow update',
    note: event.note || definition?.customerDescription || 'Workflow status updated.',
    customerVisible: event.customerVisible ?? definition?.customerVisible ?? false,
    createdAt: event.createdAt || fallbackCreatedAt,
  };
};

const normaliseEnquiry = enquiry => {
  let trackingStatus = migrateStatus(enquiry.trackingStatus || 'submitted');
  if (!RFQ_STATUSES.includes(trackingStatus) && !ORDER_STATUSES.includes(trackingStatus)) trackingStatus = 'submitted';
  const createdAt = enquiry.createdAt || new Date().toISOString();
  const workflowType = enquiry.workflowType || (ORDER_STATUSES.includes(trackingStatus) ? 'order' : 'rfq');
  const definition = workflowStatusById(trackingStatus, workflowType);
  const isLegacyOrder = workflowType === 'order';
  return {
    ...enquiry,
    version: Math.max(0, Number(enquiry.version) || 0),
    companyId: enquiry.companyId || enquiry.accountId,
    workflowType,
    trackingStatus,
    status: definition?.label || 'Workflow update',
    sourceRfqStatus: enquiry.sourceRfqStatus || (isLegacyOrder ? 'converted_to_order' : ''),
    acceptedAt: enquiry.acceptedAt || (isLegacyOrder ? createdAt : ''),
    trackingHistory: enquiry.trackingHistory?.length
      ? enquiry.trackingHistory.map(event => normaliseHistoryEvent(event, createdAt))
      : [normaliseHistoryEvent({ id: makeId('event'), status: trackingStatus, note: 'RFQ saved to the customer account.', actor: 'Customer', createdAt }, createdAt)],
  };
};

const isCustomerVisibleEvent = event => event.customerVisible !== false
  && workflowStatusById(event.toStatus || event.status, event.entityType)?.customerVisible !== false;

const toCustomerVisibleRecord = enquiry => {
  const history = (enquiry.trackingHistory || []).filter(isCustomerVisibleEvent);
  const lastVisible = history.at(-1);
  const visibleStatus = lastVisible?.toStatus || lastVisible?.status || (workflowStatusById(enquiry.trackingStatus, enquiry.workflowType)?.customerVisible ? enquiry.trackingStatus : 'submitted');
  const definition = workflowStatusById(visibleStatus);
  return {
    ...enquiry,
    trackingStatus: visibleStatus,
    status: definition?.label || enquiry.status,
    trackingHistory: history,
    allowedWorkflowActions: [],
  };
};

const isEmpty = value => value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === '');

const validateConfiguredProducts = lines => {
  const fieldErrors = {};
  lines.forEach((line, lineIndex) => {
    const product = products.find(item => item.id === line.productId);
    if (!product) {
      fieldErrors[`items.${lineIndex}.productId`] = `The product on line ${lineIndex + 1} is no longer available.`;
      return;
    }
    const configuration = line.configuration || {};
    for (const field of product.configurations || []) {
      const visible = shouldShowField(field, configuration);
      const value = configuration[field.key];
      if (!visible && !isEmpty(value) && value !== false) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `${field.label} is not available with the other selections on line ${lineIndex + 1}.`;
        continue;
      }
      if (visible && field.required && isEmpty(value)) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `Complete “${field.label}” for ${product.code}.`;
        continue;
      }
      if (!visible || isEmpty(value) || value === false || !['choice', 'select', 'multiChoice'].includes(field.type)) continue;
      const allowed = optionsForField(field, configuration);
      const selections = Array.isArray(value) ? value : [value];
      if (selections.some(selection => !allowed.includes(selection))) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `Review “${field.label}” for ${product.code}; one selection is not available.`;
      }
    }
    if (configuration.sanas && product.category !== 'pressure') fieldErrors[`items.${lineIndex}.configuration.sanas`] = 'SANAS calibration is available only for Pressure instruments.';
    if (configuration.traceability && product.category !== 'temperature') fieldErrors[`items.${lineIndex}.configuration.traceability`] = 'Traceability is available only for Temperature units.';
  });
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], { code: 'INVALID_PRODUCT_CONFIGURATION', status: 422, fieldErrors });
  }
};

export function createMockServices({ storage, emailSender = sendRfqEmail, now = () => new Date() } = {}) {
  const store = createBrowserStore(storage);

  const readAccounts = () => store.get(STORE_KEYS.accounts, []).map(normaliseAccount);
  const writeAccounts = accounts => store.set(STORE_KEYS.accounts, accounts.map(normaliseAccount));
  const readAllEnquiries = () => store.get(STORE_KEYS.enquiries, []).map(normaliseEnquiry);
  const writeAllEnquiries = enquiries => store.set(STORE_KEYS.enquiries, enquiries.map(normaliseEnquiry));
  const readAuditEvents = () => store.get(STORE_KEYS.audit, []);
  const appendAuditEvent = event => store.set(STORE_KEYS.audit, [...readAuditEvents(), event]);
  const readNotifications = () => store.get(STORE_KEYS.notifications, []);
  const appendNotification = notification => store.set(STORE_KEYS.notifications, [...readNotifications(), notification]);

  const currentStoredAccount = () => {
    const session = store.get(STORE_KEYS.session, null);
    return session ? readAccounts().find(account => account.id === session.accountId) || null : null;
  };

  const requireAccount = () => {
    const account = currentStoredAccount();
    if (!account) throw new ServiceError('Your session has ended. Please sign in again.', { code: 'UNAUTHENTICATED', status: 401 });
    return account;
  };

  const canReadEnquiry = (account, enquiry) => {
    const isOrder = inferWorkflowEntityType(enquiry) === 'order';
    if (isOrder && roleCan(account.role, PERMISSIONS.READ_ALL_ORDERS)) return true;
    if (!isOrder && roleCan(account.role, PERMISSIONS.READ_ALL_ENQUIRIES)) return true;
    if (isOrder && roleCan(account.role, PERMISSIONS.READ_OWN_ORDERS)) return enquiry.companyId === account.companyId;
    if (!isOrder && roleCan(account.role, PERMISSIONS.READ_OWN_ENQUIRIES)) return enquiry.companyId === account.companyId;
    if (isOrder && roleCan(account.role, PERMISSIONS.READ_ASSIGNED_ORDERS)) return enquiry.selectedRep?.id === account.representativeId;
    if (!isOrder && roleCan(account.role, PERMISSIONS.READ_ASSIGNED_ENQUIRIES)) return enquiry.selectedRep?.id === account.representativeId;
    return false;
  };

  const presentEnquiry = (account, enquiry) => {
    if (account.role === USER_ROLES.CUSTOMER) return toCustomerVisibleRecord(enquiry);
    return { ...enquiry, allowedWorkflowActions: getAllowedWorkflowActions(enquiry, createWorkflowActor(account)) };
  };

  const saveEnquiry = enquiry => {
    const enquiries = readAllEnquiries();
    const saved = normaliseEnquiry(enquiry);
    const index = enquiries.findIndex(item => item.id === saved.id);
    if (index >= 0) enquiries[index] = saved;
    else enquiries.unshift(saved);
    writeAllEnquiries(enquiries);
    return saved;
  };

  const initialize = async () => {
    let accounts = store.get(STORE_KEYS.accounts, null);
    if (!accounts) accounts = store.get(LEGACY_STORE_KEYS.accounts, []);
    accounts = accounts.map(normaliseAccount);
    for (const seed of [DEMO_ACCOUNT, EXPEDITOR_ACCOUNT, ...EXTRA_DEMO_ACCOUNTS]) {
      const index = accounts.findIndex(account => account.id === seed.id || account.email?.toLowerCase() === seed.email.toLowerCase());
      if (index >= 0) accounts[index] = normaliseAccount({ ...accounts[index], ...seed });
      else accounts.push(normaliseAccount(seed));
    }
    writeAccounts(accounts);

    let enquiries = store.get(STORE_KEYS.enquiries, null);
    if (!enquiries) enquiries = store.get(LEGACY_STORE_KEYS.enquiries, []);
    enquiries = enquiries.map(normaliseEnquiry);
    if (!store.has(STORE_KEYS.seedVersion)) {
      for (const demo of DEMO_ENQUIRIES) if (!enquiries.some(enquiry => enquiry.id === demo.id)) enquiries.push(normaliseEnquiry(demo));
      store.set(STORE_KEYS.seedVersion, true);
    }
    writeAllEnquiries(enquiries);
    if (!store.has(STORE_KEYS.audit)) store.set(STORE_KEYS.audit, []);
    if (!store.has(STORE_KEYS.notifications)) store.set(STORE_KEYS.notifications, []);

    if (!store.has(STORE_KEYS.session)) {
      const legacySession = store.get(LEGACY_STORE_KEYS.session, null);
      if (legacySession) store.set(STORE_KEYS.session, legacySession);
    }
  };

  const auth = {
    async getSession() {
      return toPublicAccount(currentStoredAccount());
    },

    async signIn(credentials) {
      validateSignIn(credentials);
      const email = credentials.email.trim().toLowerCase();
      const matched = readAccounts().find(account => account.email.toLowerCase() === email && account.password === credentials.password);
      if (!matched) throw new ServiceError('The email address or password does not match a preview account.', { code: 'INVALID_CREDENTIALS', status: 401 });
      store.set(STORE_KEYS.session, { accountId: matched.id, signedInAt: now().toISOString() });
      return toPublicAccount(matched);
    },

    async register(data) {
      validateRegistration(data);
      const accounts = readAccounts();
      const email = data.email.trim().toLowerCase();
      if (accounts.some(account => account.email.toLowerCase() === email)) {
        throw new ServiceError('An account with this email address already exists on this device.', { code: 'ACCOUNT_EXISTS', status: 409, fieldErrors: { email: 'This email is already registered.' } });
      }
      const accountId = makeId('account');
      const account = normaliseAccount({
        id: accountId,
        companyId: makeId('company'),
        company: data.company.trim(),
        contact: data.contact.trim(),
        email,
        phone: data.phone.trim(),
        area: data.area,
        industry: data.industry,
        role: USER_ROLES.CUSTOMER,
        password: data.password,
        createdAt: now().toISOString(),
      });
      writeAccounts([...accounts, account]);
      store.set(STORE_KEYS.session, { accountId: account.id, signedInAt: now().toISOString() });
      return toPublicAccount(account);
    },

    async signOut() {
      store.remove(STORE_KEYS.session);
    },

    async getDemoLogins() {
      return clone(DEMO_LOGINS);
    },
  };

  const accounts = {
    async getCurrent() {
      return toPublicAccount(requireAccount());
    },

    async getRegistrationOptions() {
      const areaDirectory = Object.fromEntries(areas.map(area => {
        const { branch, representatives } = representativesForArea(area);
        return [area, { branch: clone(branch), representatives: clone(representatives) }];
      }));
      return { areas: clone(areas), industries: clone(industries), branches: clone(branches), areaDirectory };
    },

    async listCompanies() {
      const account = requireAccount();
      if (account.role === USER_ROLES.CUSTOMER) {
        return [{ id: account.companyId, name: account.company, area: account.area, industry: account.industry }];
      }
      if (!roleCan(account.role, PERMISSIONS.READ_ALL_COMPANIES)) {
        throw new ServiceError('Your role is not permitted to view company accounts.', { code: 'FORBIDDEN', status: 403 });
      }
      return readAccounts()
        .filter(item => item.role === USER_ROLES.CUSTOMER)
        .map(item => ({ id: item.companyId, name: item.company, area: item.area, industry: item.industry }));
    },
  };

  const productService = {
    async getCatalogue() {
      return { categories: clone(categories), products: clone(products), recommendedCategories: clone(recommendedCategories) };
    },

    async list({ categoryId, query } = {}) {
      const term = String(query || '').trim().toLowerCase();
      return clone(products.filter(product => (!categoryId || product.category === categoryId) && (!term || `${product.code} ${product.name} ${product.description} ${product.measuringRange}`.toLowerCase().includes(term))));
    },

    async getById(productId) {
      const product = products.find(item => item.id === productId);
      if (!product) throw new ServiceError('That product could not be found.', { code: 'PRODUCT_NOT_FOUND', status: 404 });
      return clone(product);
    },
  };

  const enquiries = {
    async list() {
      const account = requireAccount();
      return clone(readAllEnquiries().filter(enquiry => canReadEnquiry(account, enquiry)).map(enquiry => presentEnquiry(account, enquiry)));
    },

    async getById(enquiryId) {
      const account = requireAccount();
      const enquiry = readAllEnquiries().find(item => item.id === enquiryId);
      if (!enquiry || !canReadEnquiry(account, enquiry)) throw new ServiceError('The RFQ was not found or is outside your authorised company account.', { code: 'ENQUIRY_NOT_FOUND', status: 404 });
      return clone(presentEnquiry(account, enquiry));
    },

    async getDraft() {
      const account = requireAccount();
      if (account.role !== USER_ROLES.CUSTOMER) return [];
      const drafts = store.get(STORE_KEYS.draft, {});
      return clone(Array.isArray(drafts) ? drafts : drafts[account.id] || []);
    },

    async saveDraft(lines) {
      const account = requireAccount();
      if (account.role !== USER_ROLES.CUSTOMER) throw new ServiceError('Only customer accounts can save an RFQ draft.', { code: 'FORBIDDEN', status: 403 });
      const stored = store.get(STORE_KEYS.draft, {});
      const drafts = Array.isArray(stored) ? {} : stored;
      drafts[account.id] = clone(lines);
      store.set(STORE_KEYS.draft, drafts);
      return clone(lines);
    },

    async submit(details, lines) {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.CREATE_ENQUIRY)) throw new ServiceError('This account cannot submit customer RFQs.', { code: 'FORBIDDEN', status: 403 });
      validateEnquiry(details, lines);
      validateConfiguredProducts(lines);
      const { poFile, ...serialisableDetails } = details;
      const existing = readAllEnquiries();
      const reference = `RQ-PREVIEW-${String(existing.length + 1).padStart(4, '0')}`;
      const createdAt = now().toISOString();
      const baseEnquiry = {
        id: makeId('enquiry'),
        reference,
        version: 0,
        accountId: account.id,
        companyId: account.companyId,
        company: account.company,
        contact: account.contact,
        email: account.email,
        phone: account.phone,
        ...serialisableDetails,
        items: clone(lines),
        workflowType: 'rfq',
        trackingStatus: 'draft',
        status: 'Draft',
        trackingHistory: [],
        emailDeliveryStatus: 'sending',
        createdAt,
        updatedAt: createdAt,
      };
      const customerActor = createWorkflowActor(account);
      const submitted = performWorkflowTransition({
        entity: baseEnquiry,
        action: 'submit_rfq',
        actor: customerActor,
        input: { comment: 'RFQ submitted by the customer and saved to the account.' },
        now,
      });
      const assigned = performWorkflowTransition({
        entity: submitted.entity,
        action: 'assign_representative',
        actor: { id: 'mock-workflow-system', role: SYSTEM_ACTOR_ROLE, displayName: 'Workflow service' },
        input: {},
        now,
      });
      appendAuditEvent(submitted.auditEvent);
      appendAuditEvent(assigned.auditEvent);
      for (const result of [submitted, assigned]) {
        if (!result.notification.required) continue;
        appendNotification({
          id: makeId('notification'),
          entityId: baseEnquiry.id,
          entityType: 'rfq',
          companyId: account.companyId,
          status: result.entity.trackingStatus,
          recipients: result.notification.recipients,
          message: result.notification.message,
          createdAt: now().toISOString(),
          readAt: '',
        });
      }
      let enquiry = saveEnquiry(assigned.entity);

      let delivery;
      try {
        delivery = await emailSender(enquiry, poFile);
      } catch (error) {
        delivery = { ok: false, message: 'The RFQ is saved, but the test email could not be sent. Please use the email fallback or try again later.', warning: error?.message || '' };
      }
      delivery ||= { ok: false, message: 'The RFQ is saved, but the email service returned no result.' };

      enquiry = saveEnquiry({
        ...enquiry,
        emailDeliveryStatus: delivery.ok ? 'submitted' : 'pending',
        emailRecipient: delivery.recipient || '',
        deliveryMode: delivery.deliveryMode || 'saved-locally',
        pricedPdfAttached: Boolean(delivery.pricedPdfAttached),
        emailSubmittedAt: delivery.ok ? now().toISOString() : '',
        emailError: delivery.ok ? '' : delivery.message,
      });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'rfq.email_delivery_requested',
        outcome: delivery.ok ? 'success' : 'failed',
        entityType: 'rfq',
        entityId: enquiry.id,
        companyId: enquiry.companyId,
        actorId: account.id,
        actorRole: account.role,
        createdAt: now().toISOString(),
      });
      await enquiries.saveDraft([]);
      return { enquiry: clone(presentEnquiry(account, enquiry)), delivery: clone(delivery) };
    },
  };

  const workflow = {
    async list() {
      return enquiries.list();
    },

    async getAllowedActions(enquiryId) {
      const account = requireAccount();
      const enquiry = readAllEnquiries().find(item => item.id === enquiryId);
      if (!enquiry || !canReadEnquiry(account, enquiry)) throw new ServiceError('The RFQ or order could not be found.', { code: 'ENQUIRY_NOT_FOUND', status: 404 });
      return clone(getAllowedWorkflowActions(enquiry, createWorkflowActor(account)));
    },

    async performAction(enquiryId, input) {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.PERFORM_WORKFLOW_ACTION)) throw new ServiceError('Your role cannot perform workflow actions.', { code: 'FORBIDDEN', status: 403 });
      const request = validateWorkflowActionRequest(input);
      const all = readAllEnquiries();
      const index = all.findIndex(enquiry => enquiry.id === enquiryId);
      if (index < 0) throw new ServiceError('The RFQ or order could not be found.', { code: 'ENQUIRY_NOT_FOUND', status: 404 });
      const existing = all[index];
      const actor = createWorkflowActor(account);
      if (!canReadEnquiry(account, existing)) {
        const error = new ServiceError('The RFQ or order could not be found.', { code: 'ENQUIRY_NOT_FOUND', status: 404 });
        appendAuditEvent(createDeniedWorkflowAudit({ entity: existing, action: request.action, actor, error, now }));
        throw error;
      }
      let result;
      try {
        result = performWorkflowTransition({
          entity: existing,
          action: request.action,
          actor,
          input: { ...request.data, comment: request.comment },
          expectedVersion: request.expectedVersion,
          now,
        });
      } catch (error) {
        appendAuditEvent(createDeniedWorkflowAudit({ entity: existing, action: request.action, actor, error, now }));
        throw error;
      }
      const updated = normaliseEnquiry(result.entity);
      all[index] = updated;
      writeAllEnquiries(all);
      appendAuditEvent(result.auditEvent);
      if (result.notification.required) {
        appendNotification({
          id: makeId('notification'),
          entityId: updated.id,
          entityType: updated.workflowType,
          companyId: updated.companyId,
          status: updated.trackingStatus,
          recipients: result.notification.recipients,
          message: result.notification.message,
          createdAt: now().toISOString(),
          readAt: '',
        });
      }
      return clone(presentEnquiry(account, updated));
    },
  };

  const audit = {
    async list({ entityId } = {}) {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.READ_AUDIT_HISTORY)) throw new ServiceError('Your role cannot view audit history.', { code: 'FORBIDDEN', status: 403 });
      return clone(readAuditEvents().filter(event => !entityId || event.entityId === entityId));
    },
  };

  const notifications = {
    async list() {
      const account = requireAccount();
      const readableIds = new Set(readAllEnquiries().filter(enquiry => canReadEnquiry(account, enquiry)).map(enquiry => enquiry.id));
      const items = readNotifications().filter(item => readableIds.has(item.entityId));
      return clone(items);
    },

    async markRead(notificationId) {
      const account = requireAccount();
      const readableIds = new Set(readAllEnquiries().filter(enquiry => canReadEnquiry(account, enquiry)).map(enquiry => enquiry.id));
      const items = readNotifications();
      const index = items.findIndex(item => item.id === notificationId && readableIds.has(item.entityId));
      if (index < 0) throw new ServiceError('The notification could not be found.', { code: 'NOTIFICATION_NOT_FOUND', status: 404 });
      items[index] = { ...items[index], readAt: now().toISOString() };
      store.set(STORE_KEYS.notifications, items);
      return clone(items[index]);
    },
  };

  const preferences = {
    async getTheme() {
      return store.get(STORE_KEYS.theme, null) || (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },

    async setTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      store.set(STORE_KEYS.theme, safeTheme);
      return safeTheme;
    },
  };

  return {
    mode: 'mock',
    initialize,
    auth,
    accounts,
    enquiries,
    workflow,
    tracking: workflow,
    audit,
    notifications,
    products: productService,
    preferences,
    preview: {
      emailRecipient: RFQ_EMAIL_RECIPIENT,
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      persistenceLabel: 'this browser',
    },
  };
}
