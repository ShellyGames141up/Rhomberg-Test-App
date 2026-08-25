import { useEffect, useMemo, useRef, useState } from 'react';
import { Account } from './components/Account.jsx';
import { AdministratorDashboard } from './components/AdministratorDashboard.jsx';
import { ArchivedOrders } from './components/ArchivedOrders.jsx';
import { AuditTrail } from './components/AuditTrail.jsx';
import { Auth } from './components/Auth.jsx';
import { Catalogue } from './components/Catalogue.jsx';
import { Configurator } from './components/Configurator.jsx';
import { Enquiry } from './components/Enquiry.jsx';
import { DispatchDashboard } from './components/DispatchDashboard.jsx';
import { ExpeditorDashboard } from './components/ExpeditorDashboard.jsx';
import { Home } from './components/Home.jsx';
import { Intro } from './components/Intro.jsx';
import { AppHeader, BottomNav, Toast } from './components/Layout.jsx';
import { ManagementDashboard } from './components/ManagementDashboard.jsx';
import { LaboratoryDashboard } from './components/LaboratoryDashboard.jsx';
import { Notifications } from './components/Notifications.jsx';
import { OperationalDashboard } from './components/OperationalDashboard.jsx';
import { OrderTracking } from './components/OrderTracking.jsx';
import { PlanningDashboard } from './components/PlanningDashboard.jsx';
import { QualityDashboard } from './components/QualityDashboard.jsx';
import { ProductDetail } from './components/ProductDetail.jsx';
import { RepresentativeOrderLoader } from './components/RepresentativeOrderLoader.jsx';
import { SalesRepresentativeDashboard } from './components/SalesRepresentativeDashboard.jsx';
import { TechnicalSupportWorkspace } from './components/TechnicalSupport.jsx';
import { Settings } from './components/Settings.jsx';
import { CustomerTutorial, FirstCustomerWelcome } from './components/CustomerOnboarding.jsx';
import { ClientVisitsDashboard } from './components/ClientVisitsDashboard.jsx';
import { PreviewLanding } from './apps/PreviewLanding.jsx';
import { ExecutiveDemoControls, ExecutiveDemoLauncher } from './apps/ExecutiveWorkflowDemo.jsx';
import { createDefaultNotificationPreferences } from './domain/notifications.js';
import { createDefaultCustomerPersonalisation, normaliseCustomerPersonalisation } from './shared/personalisation/personalisation.js';
import { createDefaultUserSettings, normaliseUserSettings } from './domain/userSettings.js';
import { playUiSound, provideFeedback, triggerHaptic } from './shared/experience/feedback.js';
import {
  filterDemoLoginsForPreview,
  PREVIEW_BY_ID,
  previewAllowsRole,
  previewContextForPath,
  previewNavigationAllowed,
} from './shared/platform/previewConfig.js';
import {
  accountCan,
  accountCanPerformWorkflow,
  canListOrders,
  canListRfqs,
  defaultViewForRole,
  friendlyServiceError,
  isCustomerAccount,
  isInternalAccount,
  normaliseViewForRole,
  PERMISSIONS,
  services,
  usesDispatchWorkspace,
  usesExpeditorWorkspace,
  usesLaboratoryWorkspace,
  usesPlanningWorkspace,
  usesQualityWorkspace,
  usesRepresentativeInbox,
} from './services/index.js';

const EMPTY_CATALOGUE = { categories: [], products: [], recommendedCategories: {} };
const EMPTY_REGISTRATION = { areas: [], industries: [], branches: [], areaDirectory: {} };
const EMPTY_PLANNING_OPTIONS = { users: [], locations: [], priorities: [] };
const EMPTY_EXPEDITING_OPTIONS = { progressSteps: [], requiredStepIds: [], documentTypes: [], approachingCompletionDays: 3 };
const EMPTY_DISPATCH_OPTIONS = { methods: [], proofTypes: [], maxProofBytes: 4 * 1024 * 1024 };
const EMPTY_LAB_OPTIONS = { certificationTypes: [], releaseDestinations: [], maxCertificateBytes: 12 * 1024 * 1024 };
const EMPTY_QA_OPTIONS = { problemCategories: [], severities: [], reworkDestinations: [] };
const EMPTY_EXECUTIVE_DEMO = { scenarios: [], roles: [], current: null, currentScenario: null };
const PUBLIC_PREVIEW = __PUBLIC_PREVIEW__;
const DOCUMENT_PREVIEW_ID = globalThis.document?.querySelector?.('meta[name="rhomberg-preview"]')?.content || '';
const PREVIEW_CONTEXT = __PUBLIC_PREVIEW__
  ? (PREVIEW_BY_ID[DOCUMENT_PREVIEW_ID] || previewContextForPath(globalThis.location?.pathname || '/'))
  : previewContextForPath(globalThis.location?.pathname || '/');
const SHOW_PREVIEW_NAVIGATION = previewNavigationAllowed({ publicPreview: __PUBLIC_PREVIEW__, preview: PREVIEW_CONTEXT });
const isFabricatedPreviewIdentity = account => /\.(?:invalid|test)$/i.test(String(account?.email || account?.username || ''));
const normalPublicRouteRejectsDemoIdentity = account => __PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.unified && isFabricatedPreviewIdentity(account);
const listEnquiriesForAccount = signedInAccount => {
  if (!canListRfqs(signedInAccount)) return Promise.resolve([]);
  return usesRepresentativeInbox(signedInAccount)
    ? services.enquiries.listRepresentativeInbox()
    : services.enquiries.list();
};
const listOrdersForAccount = signedInAccount => (
  canListOrders(signedInAccount)
    ? services.orders.list()
    : Promise.resolve([])
);
const canLoadExpeditingOptions = signedInAccount => (
  accountCan(signedInAccount, PERMISSIONS.VIEW_EXPEDITING_QUEUE)
  || accountCan(signedInAccount, PERMISSIONS.UPDATE_ORDER_PROGRESS)
  || accountCan(signedInAccount, PERMISSIONS.MOVE_TO_DISPATCH)
);
const canLoadDispatchOptions = signedInAccount => (
  accountCan(signedInAccount, PERMISSIONS.VIEW_DISPATCH_QUEUE)
  || accountCan(signedInAccount, PERMISSIONS.CONFIRM_DELIVERY)
  || accountCan(signedInAccount, PERMISSIONS.CONFIRM_COLLECTION)
);
const canLoadLaboratoryOptions = signedInAccount => accountCan(signedInAccount, PERMISSIONS.VIEW_LAB_QUEUE);
const canLoadQualityOptions = signedInAccount => accountCan(signedInAccount, PERMISSIONS.VIEW_QA_QUEUE);
export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [appStatus, setAppStatus] = useState('loading');
  const [appError, setAppError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [account, setAccount] = useState(null);
  const [view, setView] = useState('home');
  const [theme, setTheme] = useState('light');
  const [customerPersonalisation, setCustomerPersonalisation] = useState(createDefaultCustomerPersonalisation);
  const [userSettings, setUserSettings] = useState(createDefaultUserSettings);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [tutorialSession, setTutorialSession] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [catalogue, setCatalogue] = useState(EMPTY_CATALOGUE);
  const [registrationOptions, setRegistrationOptions] = useState(EMPTY_REGISTRATION);
  const [demoLogins, setDemoLogins] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [productId, setProductId] = useState(null);
  const [configOrigin, setConfigOrigin] = useState('product');
  const [editingLine, setEditingLine] = useState(null);
  const [draft, setDraft] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(createDefaultNotificationPreferences);
  const [notificationTarget, setNotificationTarget] = useState(null);
  const [planningOptions, setPlanningOptions] = useState(EMPTY_PLANNING_OPTIONS);
  const [expeditingOptions, setExpeditingOptions] = useState(EMPTY_EXPEDITING_OPTIONS);
  const [dispatchOptions, setDispatchOptions] = useState(EMPTY_DISPATCH_OPTIONS);
  const [laboratoryOptions, setLaboratoryOptions] = useState(EMPTY_LAB_OPTIONS);
  const [qualityOptions, setQualityOptions] = useState(EMPTY_QA_OPTIONS);
  const [executiveDemoCatalogue, setExecutiveDemoCatalogue] = useState(EMPTY_EXECUTIVE_DEMO);
  const [executiveDemoState, setExecutiveDemoState] = useState(null);
  const [executiveDemoBusy, setExecutiveDemoBusy] = useState('');
  const [executiveDemoError, setExecutiveDemoError] = useState('');
  const [success, setSuccess] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    let active = true;
    setAppStatus('loading');
    setAppError('');

    (async () => {
      try {
        await services.initialize();
        const [savedTheme, loadedCatalogue, loadedRegistration, loadedDemoLogins, savedSession, loadedExecutiveDemo] = await Promise.all([
          services.preferences.getTheme(),
          services.products.getCatalogue(),
          services.accounts.getRegistrationOptions(),
          services.auth.getDemoLogins(),
          services.auth.getSession(),
          __PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo
            ? services.executiveDemo.getCatalogue()
            : Promise.resolve(EMPTY_EXECUTIVE_DEMO),
        ]);
        if (!active) return;

        let session = PREVIEW_CONTEXT.landing ? null : savedSession;
        let previewAccessError = '';
        if (session && normalPublicRouteRejectsDemoIdentity(session)) {
          await services.auth.signOut();
          previewAccessError = __PUBLIC_PREVIEW__
            ? 'Fabricated demonstration accounts are available only in the separate Preview Centre. The normal application requires an approved private account and production identity service.'
            : 'This account is not authorised for this application. Contact your administrator.';
          session = null;
        } else if (session && !previewAllowsRole(PREVIEW_CONTEXT, session.role)) {
          await services.auth.signOut();
          previewAccessError = PREVIEW_CONTEXT.unified
            ? `This account is not authorised for the ${PREVIEW_CONTEXT.platform}. Use an approved application surface or contact your administrator.`
            : __PUBLIC_PREVIEW__
              ? `${session.role.replaceAll('_', ' ')} accounts cannot enter ${PREVIEW_CONTEXT.displayName}. Choose a compatible demonstration preview.`
              : 'This account is not authorised for this application. Contact your administrator.';
          session = null;
        }
        let loadedDraft = [];
        let loadedEnquiries = [];
        let loadedOrders = [];
        let loadedNotifications = [];
        let loadedAuditEvents = [];
        let loadedNotificationPreferences = createDefaultNotificationPreferences();
        let loadedPlanningOptions = EMPTY_PLANNING_OPTIONS;
        let loadedExpeditingOptions = EMPTY_EXPEDITING_OPTIONS;
        let loadedDispatchOptions = EMPTY_DISPATCH_OPTIONS;
        let loadedLaboratoryOptions = EMPTY_LAB_OPTIONS;
        let loadedQualityOptions = EMPTY_QA_OPTIONS;
        let loadedPersonalisation = createDefaultCustomerPersonalisation();
        let loadedUserSettings = createDefaultUserSettings();
        if (session && !session.forcePasswordChange) {
          [loadedDraft, loadedEnquiries, loadedOrders, loadedNotifications, loadedAuditEvents, loadedNotificationPreferences, loadedPlanningOptions, loadedExpeditingOptions, loadedDispatchOptions, loadedLaboratoryOptions, loadedQualityOptions, loadedPersonalisation, loadedUserSettings] = await Promise.all([
            accountCan(session, PERMISSIONS.CREATE_RFQ) ? services.enquiries.getDraft() : Promise.resolve([]),
            listEnquiriesForAccount(session),
            listOrdersForAccount(session),
            services.notifications.list(),
            accountCan(session, PERMISSIONS.READ_AUDIT_HISTORY)
              ? services.audit.list()
              : Promise.resolve([]),
            services.notifications.getPreferences(),
            accountCan(session, PERMISSIONS.ADD_PLANNING_INFORMATION)
              ? services.planning.getWorkspaceOptions()
              : Promise.resolve(EMPTY_PLANNING_OPTIONS),
            canLoadExpeditingOptions(session)
              ? services.expediting.getWorkspaceOptions()
              : Promise.resolve(EMPTY_EXPEDITING_OPTIONS),
            canLoadDispatchOptions(session)
              ? services.dispatch.getWorkspaceOptions()
              : Promise.resolve(EMPTY_DISPATCH_OPTIONS),
            canLoadLaboratoryOptions(session)
              ? services.laboratory.getWorkspaceOptions()
              : Promise.resolve(EMPTY_LAB_OPTIONS),
            canLoadQualityOptions(session)
              ? services.qualityAssurance.getWorkspaceOptions()
              : Promise.resolve(EMPTY_QA_OPTIONS),
            isCustomerAccount(session)
              ? services.personalisation.get()
              : Promise.resolve(createDefaultCustomerPersonalisation()),
            services.userSettings.get(),
          ]);
        }
        if (!active) return;

        setTheme(savedTheme);
        setCatalogue(loadedCatalogue);
        setRegistrationOptions(loadedRegistration);
        setDemoLogins(PREVIEW_CONTEXT.landing ? loadedDemoLogins : filterDemoLoginsForPreview(loadedDemoLogins, PREVIEW_CONTEXT));
        setAccessError(previewAccessError);
        setAccount(session);
        setCustomerPersonalisation(normaliseCustomerPersonalisation(loadedPersonalisation));
        setUserSettings(normaliseUserSettings(loadedUserSettings));
        setWelcomeVisible(Boolean(session && isCustomerAccount(session) && !loadedUserSettings.onboarding?.welcomeCompleted));
        setDraft(loadedDraft);
        setEnquiries(loadedEnquiries);
        setOrders(loadedOrders);
        setNotifications(loadedNotifications);
        setAuditEvents(loadedAuditEvents);
        setNotificationPreferences(loadedNotificationPreferences);
        setPlanningOptions(loadedPlanningOptions);
        setExpeditingOptions(loadedExpeditingOptions);
        setDispatchOptions(loadedDispatchOptions);
        setLaboratoryOptions(loadedLaboratoryOptions);
        setQualityOptions(loadedQualityOptions);
        setExecutiveDemoCatalogue(loadedExecutiveDemo);
        setExecutiveDemoState(loadedExecutiveDemo.current);
        setView(session ? (session.forcePasswordChange ? 'settings' : defaultViewForRole(session.role)) : 'home');
        setAppStatus('ready');
      } catch (error) {
        if (!active) return;
        setAppError(friendlyServiceError(error, 'The app could not load its test data. Please refresh and try again.'));
        setAppStatus('error');
      }
    })();

    return () => { active = false; };
  }, [retryToken]);

  useEffect(() => {
    const systemTheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const preference = account ? userSettings.appearance.mode : theme;
      document.documentElement.dataset.theme = preference === 'system'
        ? (systemTheme?.matches ? 'dark' : 'light')
        : preference;
    };
    applyTheme();
    systemTheme?.addEventListener?.('change', applyTheme);
    return () => systemTheme?.removeEventListener?.('change', applyTheme);
  }, [account, userSettings.appearance.mode, theme]);

  useEffect(() => {
    if (!account) return undefined;
    const handleInteraction = event => {
      const control = event.target.closest?.('button, input[type="checkbox"], input[type="radio"]');
      if (!control || control.disabled || control.dataset.noFeedback === 'true') return;
      const type = control.closest('.bottom-nav,.tutorial-stage nav')
        ? 'navigation'
        : control.matches('input')
          ? 'toggle'
          : control.closest('.tutorial-interactive')
            ? 'step'
            : control.classList.contains('primary-button')
              ? 'primary'
              : control.classList.contains('secondary-button')
                ? 'secondary'
                : control.getAttribute('role') === 'radio'
                  ? 'selection'
                  : 'buttons';
      playUiSound(userSettings, type);
      if (PREVIEW_CONTEXT.platform?.toLowerCase().includes('mobile')) triggerHaptic(userSettings, 'buttons');
    };
    document.addEventListener('click', handleInteraction, true);
    return () => document.removeEventListener('click', handleInteraction, true);
  }, [account, userSettings]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const notify = message => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  };

  const toggleTheme = () => {
    const current = account ? userSettings.appearance.mode : theme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (!account) {
      setTheme(next);
      services.preferences.setTheme(next).catch(error => notify(friendlyServiceError(error, 'The theme changed, but the preference could not be saved.')));
      return;
    }
    const candidate = { ...userSettings, appearance: { ...userSettings.appearance, mode: next } };
    setUserSettings(candidate);
    services.userSettings.save(candidate).catch(error => notify(friendlyServiceError(error, 'The theme changed, but the preference could not be saved.')));
  };

  const isStaff = isInternalAccount(account);
  const isCustomerExperience = isCustomerAccount(account);
  const isPlanningWorkspace = usesPlanningWorkspace(account);
  const isExpeditorWorkspace = usesExpeditorWorkspace(account);
  const isDispatchWorkspace = usesDispatchWorkspace(account);
  const isLaboratoryWorkspace = usesLaboratoryWorkspace(account);
  const isQualityWorkspace = usesQualityWorkspace(account);
  const isManagementWorkspace = accountCan(account, PERMISSIONS.VIEW_REPORTS);
  const canPerformWorkflow = accountCanPerformWorkflow(account);
  const selectedProduct = catalogue.products.find(product => product.id === productId) || null;
  const selectedCategory = selectedProduct ? catalogue.categories.find(category => category.id === selectedProduct.category) || null : null;
  const accountRecords = useMemo(() => {
    if (!account || isStaff) return [];
    return [...enquiries, ...orders].filter(record => record.companyId === account.companyId || record.accountId === account.id);
  }, [account, enquiries, isStaff, orders]);
  const staffRecords = useMemo(() => [...enquiries, ...orders], [enquiries, orders]);
  const unreadNotifications = notifications.filter(notification => !notification.readAt).length;
  const totalQuantity = draft.reduce((sum, line) => sum + line.quantity, 0);
  const detailView = view === 'settings' || (!isStaff && (view === 'product' || view === 'configurator'));

  const loadAccountWorkspace = async signedInAccount => {
    if (!previewAllowsRole(PREVIEW_CONTEXT, signedInAccount.role)) {
      throw new Error(`This ${signedInAccount.role.replaceAll('_', ' ')} account is not supported in ${PREVIEW_CONTEXT.displayName}.`);
    }
    if (signedInAccount.forcePasswordChange) {
      setAccount(signedInAccount);
      setDraft([]); setEnquiries([]); setOrders([]); setNotifications([]); setAuditEvents([]);
      setView('settings');
      return userSettings;
    }
    const [loadedDraft, loadedEnquiries, loadedOrders, loadedNotifications, loadedAuditEvents, loadedNotificationPreferences, loadedPlanningOptions, loadedExpeditingOptions, loadedDispatchOptions, loadedLaboratoryOptions, loadedQualityOptions, loadedPersonalisation, loadedUserSettings, loadedRegistrationOptions] = await Promise.all([
      accountCan(signedInAccount, PERMISSIONS.CREATE_RFQ) ? services.enquiries.getDraft() : Promise.resolve([]),
      listEnquiriesForAccount(signedInAccount),
      listOrdersForAccount(signedInAccount),
      services.notifications.list(),
      accountCan(signedInAccount, PERMISSIONS.READ_AUDIT_HISTORY)
        ? services.audit.list()
        : Promise.resolve([]),
      services.notifications.getPreferences(),
      accountCan(signedInAccount, PERMISSIONS.ADD_PLANNING_INFORMATION)
        ? services.planning.getWorkspaceOptions()
        : Promise.resolve(EMPTY_PLANNING_OPTIONS),
      canLoadExpeditingOptions(signedInAccount)
        ? services.expediting.getWorkspaceOptions()
        : Promise.resolve(EMPTY_EXPEDITING_OPTIONS),
      canLoadDispatchOptions(signedInAccount)
        ? services.dispatch.getWorkspaceOptions()
        : Promise.resolve(EMPTY_DISPATCH_OPTIONS),
      canLoadLaboratoryOptions(signedInAccount)
        ? services.laboratory.getWorkspaceOptions()
        : Promise.resolve(EMPTY_LAB_OPTIONS),
      canLoadQualityOptions(signedInAccount)
        ? services.qualityAssurance.getWorkspaceOptions()
        : Promise.resolve(EMPTY_QA_OPTIONS),
      isCustomerAccount(signedInAccount)
        ? services.personalisation.get()
        : Promise.resolve(createDefaultCustomerPersonalisation()),
      services.userSettings.get(),
      services.accounts.getRegistrationOptions(),
    ]);
    setAccount(signedInAccount);
    setDraft(loadedDraft);
    setEnquiries(loadedEnquiries);
    setOrders(loadedOrders);
    setNotifications(loadedNotifications);
    setAuditEvents(loadedAuditEvents);
    setNotificationPreferences(loadedNotificationPreferences);
    setPlanningOptions(loadedPlanningOptions);
    setExpeditingOptions(loadedExpeditingOptions);
    setDispatchOptions(loadedDispatchOptions);
    setLaboratoryOptions(loadedLaboratoryOptions);
    setQualityOptions(loadedQualityOptions);
    setCustomerPersonalisation(normaliseCustomerPersonalisation(loadedPersonalisation));
    const normalisedSettings = normaliseUserSettings(loadedUserSettings);
    setUserSettings(normalisedSettings);
    setRegistrationOptions(loadedRegistrationOptions);
    setWelcomeVisible(Boolean(isCustomerAccount(signedInAccount) && !loadedUserSettings.onboarding?.welcomeCompleted));
    setTutorialSession(null);
    setView(signedInAccount.forcePasswordChange ? 'settings' : defaultViewForRole(signedInAccount.role));
    return normalisedSettings;
  };

  const login = async (email, password) => {
    try {
      const signedInAccount = await services.auth.signIn({
        email,
        password,
        realm: PREVIEW_CONTEXT.executiveDemo || PREVIEW_CONTEXT.unified ? undefined : PREVIEW_CONTEXT.customer ? 'customer' : 'internal',
      });
      if (normalPublicRouteRejectsDemoIdentity(signedInAccount)) {
        await services.auth.signOut();
        return {
          ok: false,
          message: __PUBLIC_PREVIEW__
            ? 'Fabricated demonstration accounts are available only in the separate Preview Centre. The normal application requires an approved private account and production identity service.'
            : 'This account is not authorised for this application. Contact your administrator.',
          fieldErrors: {},
        };
      }
      if (!previewAllowsRole(PREVIEW_CONTEXT, signedInAccount.role)) {
        await services.auth.signOut();
        return {
          ok: false,
          message: PREVIEW_CONTEXT.unified
            ? `This account is not authorised for the ${PREVIEW_CONTEXT.platform}. Use an approved application surface or contact your administrator.`
            : __PUBLIC_PREVIEW__
              ? `${signedInAccount.role.replaceAll('_', ' ')} accounts cannot enter ${PREVIEW_CONTEXT.displayName}. Return to the Preview Centre and choose a compatible demonstration interface.`
              : 'This account is not authorised for this application. Contact your administrator.',
          fieldErrors: {},
        };
      }
      const signedInSettings = await loadAccountWorkspace(signedInAccount);
      provideFeedback(signedInSettings, 'startup', 'success');
      setAccessError('');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyServiceError(error, 'The app could not sign you in. Please try again.'), fieldErrors: error?.fieldErrors || {} };
    }
  };

  const register = async data => {
    try {
      if (__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.unified) {
        return { ok: false, message: 'Public account creation is disabled on the normal application route. Account activation will be provided by the approved production identity service.', fieldErrors: {} };
      }
      if (!PREVIEW_CONTEXT.customer && !PREVIEW_CONTEXT.unified) {
        return { ok: false, message: 'Company account registration is available only in a Rhomberg Connect customer preview.', fieldErrors: {} };
      }
      const created = await services.auth.register(data);
      await loadAccountWorkspace(created);
      setAccessError('');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyServiceError(error, 'The company account could not be created. Please try again.'), fieldErrors: error?.fieldErrors || {} };
    }
  };

  const navigate = target => {
    if (account?.forcePasswordChange && target !== 'settings') {
      setView('settings');
      notify('Change the temporary password before continuing.');
      return;
    }
    const destination = account ? normaliseViewForRole(account.role, target) : 'home';
    if (destination === 'catalogue') setCategoryId(null);
    setNotificationTarget(null);
    setView(destination);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCategory = id => {
    setCategoryId(id);
    setView('catalogue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProduct = id => {
    setProductId(id);
    setView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startConfigurator = (line = null, origin = 'product') => {
    if (line) setProductId(line.productId);
    setEditingLine(line);
    setConfigOrigin(origin);
    setView('configurator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const persistDraft = next => {
    setDraft(next);
    services.enquiries.saveDraft(next).catch(error => notify(friendlyServiceError(error, 'The draft could not be saved. Your current screen has not been cleared.')));
  };

  const saveConfiguredLine = line => {
    const exists = draft.some(item => item.lineId === line.lineId);
    const next = exists ? draft.map(item => item.lineId === line.lineId ? line : item) : [...draft, line];
    persistDraft(next);
    setEditingLine(null);
    setView('enquiry');
    notify(`${line.code} ${exists ? 'updated' : 'added to enquiry'}`);
  };

  const updateQuantity = (lineId, quantity) => {
    const safeQuantity = Math.min(9999, Math.max(1, Math.trunc(Number(quantity) || 1)));
    persistDraft(draft.map(line => line.lineId === lineId ? { ...line, quantity: safeQuantity } : line));
  };

  const removeLine = lineId => persistDraft(draft.filter(line => line.lineId !== lineId));

  const submitEnquiry = async details => {
    provideFeedback(userSettings, 'rfqSubmission', 'importantWorkflow');
    try {
      const result = await services.enquiries.submit(details, draft);
      const [updatedEnquiries, updatedNotifications, updatedRegistrationOptions] = await Promise.all([
        listEnquiriesForAccount(account),
        services.notifications.list(),
        services.accounts.getRegistrationOptions(),
      ]);
      setEnquiries(updatedEnquiries);
      setNotifications(updatedNotifications);
      setRegistrationOptions(updatedRegistrationOptions);
      setDraft([]);
      const delivery = result.delivery || { ok: true };
      setSuccess({
        reference: result.enquiry.reference,
        firstName: account.contact.split(/\s+/)[0],
        representative: result.enquiry.selectedRep?.name || 'your Rhomberg representative',
        submittedAt: result.enquiry.submittedAt || result.enquiry.createdAt,
        recipient: delivery.recipient || 'Rhomberg sales',
        activationMayBeRequired: delivery.activationMayBeRequired,
        pricedPdfAttached: delivery.pricedPdfAttached,
        emailFailed: delivery.ok === false,
        fallbackUrl: delivery.fallbackUrl,
        warning: delivery.warning || (delivery.ok === false ? delivery.message : ''),
      });
      provideFeedback(userSettings, 'success', 'success');
      return { ok: true, enquiry: result.enquiry };
    } catch (error) {
      provideFeedback(userSettings, 'error', 'error');
      return {
        ok: false,
        message: friendlyServiceError(error, 'The RFQ could not be submitted. Your configured units are still here, so please try again.'),
        fieldErrors: error?.fieldErrors || {},
        fallbackUrl: error?.fallbackUrl || '',
      };
    }
  };

  const performWorkflowAction = async (recordId, action, comment, data, entityType, expectedVersion) => {
    const result = await services.workflow.performAction(recordId, { action, comment, data, entityType, expectedVersion });
    const { createdOrder, ...updated } = result;
    if (updated.workflowType === 'order') {
      setOrders(current => current.map(order => order.id === updated.id ? updated : order));
    } else {
      setEnquiries(current => current.map(enquiry => enquiry.id === updated.id ? updated : enquiry));
    }
    if (createdOrder) setOrders(current => [createdOrder, ...current.filter(order => order.id !== createdOrder.id)]);
    services.notifications.list().then(setNotifications).catch(() => undefined);
    if (accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)) {
      services.audit.list().then(setAuditEvents).catch(() => undefined);
    }
    notify(createdOrder ? `${updated.reference} converted to ${createdOrder.reference}` : `${updated.reference} updated to ${updated.status}`);
    return result;
  };

  const markNotificationRead = async notificationId => {
    const updated = await services.notifications.markRead(notificationId);
    setNotifications(current => current.map(notification => notification.id === updated.id ? updated : notification));
    return updated;
  };

  const markAllNotificationsRead = async () => {
    const result = await services.notifications.markAllRead();
    setNotifications(await services.notifications.list());
    notify(result.updatedCount ? `${result.updatedCount} notification${result.updatedCount === 1 ? '' : 's'} marked as read` : 'Inbox already up to date');
    return result;
  };

  const saveNotificationPreferences = async candidate => {
    const saved = await services.notifications.savePreferences(candidate);
    setNotificationPreferences(saved);
    setNotifications(await services.notifications.list());
    if (isCustomerAccount(account)) {
      setCustomerPersonalisation(current => normaliseCustomerPersonalisation({
        ...current,
        notificationPreferences: saved.categories,
      }));
    }
    notify('Notification preferences saved');
    return saved;
  };

  const retryNotificationDelivery = async (notificationId, deliveryId) => {
    const delivery = await services.notifications.retryDelivery(notificationId, deliveryId);
    setNotifications(await services.notifications.list());
    notify(delivery.status.endsWith('_sent') ? 'Demo delivery retry completed' : 'Demo delivery is still queued for retry');
    return delivery;
  };

  const orderDocumentActions = useMemo(() => ({
    onGetOptions: orderId => services.orderDocuments.getSharingOptions(orderId),
    onGenerate: async (orderId, copyType) => {
      const document = await services.orderDocuments.generate(orderId, { copyType });
      if (accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)) {
        services.audit.list().then(setAuditEvents).catch(() => undefined);
      }
      notify(`${document.classification} generated`);
      return document;
    },
    onEmail: async (orderId, input) => {
      const delivery = await services.orderDocuments.email(orderId, input);
      if (accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)) {
        services.audit.list().then(setAuditEvents).catch(() => undefined);
      }
      notify(services.mode === 'mock' ? 'Demo PDF email recorded' : 'PDF email request submitted');
      return delivery;
    },
  }), [account]);

  const refreshAfterRetentionAction = async () => {
    const [loadedOrders, loadedAuditEvents] = await Promise.all([
      listOrdersForAccount(account),
      accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY) ? services.audit.list() : Promise.resolve([]),
    ]);
    setOrders(loadedOrders);
    setAuditEvents(loadedAuditEvents);
  };

  const refreshAfterManagementAction = async () => {
    const [loadedEnquiries, loadedOrders, loadedAuditEvents] = await Promise.all([
      listEnquiriesForAccount(account),
      listOrdersForAccount(account),
      accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY) ? services.audit.list() : Promise.resolve([]),
    ]);
    setEnquiries(loadedEnquiries);
    setOrders(loadedOrders);
    setAuditEvents(loadedAuditEvents);
  };

  const refreshOperationalRecords = async () => {
    const [loadedOrders, loadedNotifications, loadedAuditEvents] = await Promise.all([
      listOrdersForAccount(account),
      services.notifications.list(),
      accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY) ? services.audit.list() : Promise.resolve([]),
    ]);
    setOrders(loadedOrders);
    setNotifications(loadedNotifications);
    setAuditEvents(loadedAuditEvents);
  };

  const refreshTechnicalRecords = async () => {
    const [loadedEnquiries, loadedNotifications, loadedAuditEvents] = await Promise.all([
      listEnquiriesForAccount(account),
      services.notifications.list(),
      accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY) ? services.audit.list() : Promise.resolve([]),
    ]);
    setEnquiries(loadedEnquiries);
    setNotifications(loadedNotifications);
    setAuditEvents(loadedAuditEvents);
  };

  const representativeOrderCreated = async order => {
    await refreshOperationalRecords();
    notify(`${order.reference} created and sent to Planning`);
  };

  const openNotificationRecord = notification => {
    setNotificationTarget({
      entityId: notification.entityId,
      entityType: notification.entityType,
      reference: notification.reference,
      openedAt: Date.now(),
    });
    setView(isStaff ? notification.link?.internalView || 'expeditor' : notification.link?.customerView || 'tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveUserSettings = async candidate => {
    try {
      const saved = await services.userSettings.save(candidate);
      setUserSettings(normaliseUserSettings(saved));
      notify('Rhomberg Connect settings saved');
      return saved;
    } catch (error) {
      throw new Error(friendlyServiceError(error, 'Your settings could not be saved. Please review the choices and try again.'));
    }
  };

  const switchWorkspace = async role => {
    const switchedAccount = await services.auth.switchWorkspace(role);
    await loadAccountWorkspace(switchedAccount);
    setToast(`Switched to ${role.replaceAll('_', ' ')} workspace.`);
  };

  const resetUserSettings = async () => {
    const saved = await services.userSettings.reset();
    setUserSettings(normaliseUserSettings(saved));
    return saved;
  };

  const replayTutorial = async kind => {
    if (!isCustomerAccount(account)) return;
    if (kind === 'reset') {
      const saved = await services.userSettings.resetTutorial();
      setUserSettings(normaliseUserSettings(saved));
      notify('Tutorial progress reset');
      return;
    }
    const saved = await services.userSettings.saveTutorialProgress({ step: 0, tutorialKind: kind, completed: false });
    setUserSettings(normaliseUserSettings(saved));
    setTutorialSession({ kind, step: saved.onboarding.tutorialProgress || 0 });
    setView('home');
  };

  const completeWelcome = async () => {
    const saved = await services.userSettings.completeWelcome();
    setUserSettings(normaliseUserSettings(saved));
    setWelcomeVisible(false);
    provideFeedback(saved, 'startup', 'success');
    if (!saved.onboarding.tutorialCompleted) setTutorialSession({ kind: 'full', step: saved.onboarding.tutorialProgress || 0 });
  };

  const saveTutorialProgress = async (step, kind) => {
    const saved = await services.userSettings.saveTutorialProgress({ step, tutorialKind: kind, completed: false });
    setUserSettings(normaliseUserSettings(saved));
  };

  const finishTutorial = async () => {
    const saved = await services.userSettings.saveTutorialProgress({ step: 0, tutorialKind: tutorialSession?.kind || 'full', completed: true });
    setUserSettings(normaliseUserSettings(saved));
    setTutorialSession(null);
    provideFeedback(saved, 'success', 'success');
    notify('Tutorial completed');
  };

  const skipTutorial = async () => {
    const saved = await services.userSettings.saveTutorialProgress({
      step: tutorialSession?.step || 0,
      tutorialKind: tutorialSession?.kind || 'full',
      completed: true,
    });
    setUserSettings(normaliseUserSettings(saved));
    setTutorialSession(null);
    notify('Tutorial skipped. You can replay it from Settings.');
  };

  const runExecutiveDemoAction = __PUBLIC_PREVIEW__ ? async (key, operation) => {
    setExecutiveDemoBusy(key);
    setExecutiveDemoError('');
    try {
      return await operation();
    } catch (error) {
      setExecutiveDemoError(friendlyServiceError(error, 'The executive demonstration control could not be updated.'));
      return null;
    } finally {
      setExecutiveDemoBusy('');
    }
  } : null;

  const selectExecutiveScenario = __PUBLIC_PREVIEW__ ? scenarioId => runExecutiveDemoAction('scenario', async () => {
    const updated = await services.executiveDemo.selectScenario(scenarioId);
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const setExecutiveStep = __PUBLIC_PREVIEW__ ? stepIndex => runExecutiveDemoAction('step', async () => {
    const updated = await services.executiveDemo.setStep(stepIndex);
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const setExecutivePresentationMode = __PUBLIC_PREVIEW__ ? enabled => runExecutiveDemoAction('presentation', async () => {
    const updated = await services.executiveDemo.setPresentationMode(enabled);
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const setExecutiveLayoutMode = __PUBLIC_PREVIEW__ ? layoutMode => runExecutiveDemoAction('layout', async () => {
    const updated = await services.executiveDemo.setLayoutMode(layoutMode);
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const setExecutiveDevicePreview = __PUBLIC_PREVIEW__ ? devicePreview => runExecutiveDemoAction('device', async () => {
    const updated = await services.executiveDemo.setDevicePreview(devicePreview);
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const resetExecutiveScenario = __PUBLIC_PREVIEW__ ? () => runExecutiveDemoAction('reset', async () => {
    const updated = await services.executiveDemo.resetScenario();
    setExecutiveDemoState(updated);
    return updated;
  }) : null;

  const switchExecutiveRole = __PUBLIC_PREVIEW__ ? role => runExecutiveDemoAction(`role-${role}`, async () => {
    const signedInAccount = await services.executiveDemo.switchRole(role);
    await loadAccountWorkspace(signedInAccount);
    setExecutiveDemoState(await services.executiveDemo.getState());
    setAccessError('');
    return signedInAccount;
  }) : null;

  const clearSignedInState = () => {
      setAccount(null);
      setDraft([]);
      setEnquiries([]);
      setOrders([]);
      setNotifications([]);
      setAuditEvents([]);
      setNotificationPreferences(createDefaultNotificationPreferences());
      setNotificationTarget(null);
      setCustomerPersonalisation(createDefaultCustomerPersonalisation());
      setUserSettings(createDefaultUserSettings());
      setWelcomeVisible(false);
      setTutorialSession(null);
      setPlanningOptions(EMPTY_PLANNING_OPTIONS);
      setExpeditingOptions(EMPTY_EXPEDITING_OPTIONS);
      setDispatchOptions(EMPTY_DISPATCH_OPTIONS);
      setLaboratoryOptions(EMPTY_LAB_OPTIONS);
      setQualityOptions(EMPTY_QA_OPTIONS);
      setCategoryId(null);
      setProductId(null);
      setView('home');
  };

  const signOut = async () => {
    try {
      await services.auth.signOut();
      clearSignedInState();
    } catch (error) {
      notify(friendlyServiceError(error, 'Sign-out could not be completed. Please try again.'));
    }
  };

  const finishCredentialChange = result => result.sessionEnded ? clearSignedInState() : setAccount(result.account);

  if (appStatus === 'loading') return <AppLoading theme={theme} onToggleTheme={toggleTheme} />;
  if (appStatus === 'error') return <AppLoadError message={appError} onRetry={() => setRetryToken(value => value + 1)} />;
  if (__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.landing) return <PreviewLanding demoLogins={demoLogins} serviceMode={services.mode} theme={theme} onToggleTheme={toggleTheme} />;
  if (__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.unsupported) return <UnsupportedPreview />;
  if (__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo && !account) {
    return (
      <ExecutiveDemoLauncher
        catalogue={executiveDemoCatalogue}
        state={executiveDemoState}
        busy={executiveDemoBusy}
        error={executiveDemoError}
        onScenario={selectExecutiveScenario}
        onStart={switchExecutiveRole}
      />
    );
  }
  if (!(__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo) && !introComplete) return <Intro onComplete={() => setIntroComplete(true)} />;
  if (!account) return <Auth onSignIn={login} onCreateAccount={register} theme={theme} onToggleTheme={toggleTheme} registrationOptions={registrationOptions} serviceMode={services.mode} preview={PREVIEW_CONTEXT} allowRegistration={services.mode === 'mock' && Boolean((PREVIEW_CONTEXT.customer || PREVIEW_CONTEXT.unified) && !(__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.unified))} accessError={accessError} />;
  if (isCustomerExperience && !(__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo) && welcomeVisible) return <FirstCustomerWelcome account={account} reduceMotion={userSettings.accessibility.reduceMotion} onComplete={completeWelcome} />;

  const backFromDetail = () => {
    if (view === 'settings') {
      setView('account');
    } else if (view === 'configurator') {
      setView(configOrigin === 'enquiry' ? 'enquiry' : 'product');
      setEditingLine(null);
    } else {
      setCategoryId(selectedProduct?.category || null);
      setView('catalogue');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`app-canvas platform-preview preview-${PREVIEW_CONTEXT.id} ${!__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.desktop ? 'production-desktop-surface' : ''} ${!__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.mobile ? 'production-mobile-surface' : ''} ${isCustomerExperience ? 'preview-connect' : 'preview-operations'} ${__PUBLIC_PREVIEW__ && executiveDemoState?.presentationMode ? 'executive-presentation-mode' : ''} ${__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo ? `executive-layout-${executiveDemoState?.layoutMode || 'full'} executive-device-${executiveDemoState?.devicePreview || 'desktop'}` : ''}`}
      data-font-size={userSettings.appearance.increasedText ? 'large' : 'medium'}
      data-reduce-motion={userSettings.accessibility.reduceMotion ? 'true' : 'false'}
      data-decorative-animations={userSettings.accessibility.decorativeAnimations ? 'true' : 'false'}
      data-high-contrast={userSettings.appearance.highContrast ? 'true' : 'false'}
      data-reduced-transparency={userSettings.appearance.reducedTransparency ? 'true' : 'false'}
      data-screen-reader={userSettings.accessibility.screenReaderOptimisation ? 'optimised' : undefined}
      data-executive-layout={__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo ? executiveDemoState?.layoutMode || 'full' : undefined}
      data-executive-device={__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo ? executiveDemoState?.devicePreview || 'desktop' : undefined}
    >
      {__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.executiveDemo && (
        <ExecutiveDemoControls
          catalogue={executiveDemoCatalogue}
          state={executiveDemoState}
          account={account}
          busy={executiveDemoBusy}
          error={executiveDemoError}
          onScenario={selectExecutiveScenario}
          onStep={setExecutiveStep}
          onRole={switchExecutiveRole}
          onPresentationMode={setExecutivePresentationMode}
          onLayoutMode={setExecutiveLayoutMode}
          onDevicePreview={setExecutiveDevicePreview}
          onReset={resetExecutiveScenario}
          onOpenNotifications={() => navigate('notifications')}
          onOpenRecords={() => navigate(isStaff ? 'expeditor' : 'tracking')}
          onOpenAudit={() => navigate('audit')}
          canOpenAudit={accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)}
        />
      )}
      {__PUBLIC_PREVIEW__ && SHOW_PREVIEW_NAVIGATION && <span className="desktop-caption">{PREVIEW_CONTEXT.product.toUpperCase()} · {PREVIEW_CONTEXT.platform.toUpperCase()} · DEMO PREVIEW</span>}
      <div className={`app-shell ${isStaff ? 'expeditor-shell' : ''} ${isPlanningWorkspace ? 'planning-shell' : ''} ${isExpeditorWorkspace ? 'expediting-workspace-shell' : ''} ${isLaboratoryWorkspace ? 'laboratory-workspace-shell' : ''} ${isQualityWorkspace ? 'quality-workspace-shell' : ''} ${isDispatchWorkspace ? 'dispatch-workspace-shell' : ''}`}>
        {__PUBLIC_PREVIEW__ && SHOW_PREVIEW_NAVIGATION && <div className="platform-preview-banner"><span><strong>{PREVIEW_CONTEXT.product}</strong> {PREVIEW_CONTEXT.platform}</span><a href={PREVIEW_CONTEXT.executiveDemo ? '../../' : './'}>All previews</a></div>}
        <AppHeader account={account} onNavigate={navigate} onBack={detailView ? backFromDetail : null} backLabel={view === 'settings' ? 'Settings' : view === 'configurator' ? 'Product configuration' : selectedProduct?.code || 'Catalogue'} theme={document.documentElement.dataset.theme || theme} onToggleTheme={toggleTheme} serviceMode={services.mode} preview={PREVIEW_CONTEXT} showThemeToggle={!isCustomerExperience} personalisation={isCustomerExperience ? customerPersonalisation : null} />
        <main className="app-main">
          {isStaff ? (
            <>
              {view === 'administration' && <AdministratorDashboard account={account} administrationActions={services.administration} serviceMode={services.mode} onOpenManagement={() => navigate('expeditor')} onOpenAudit={() => navigate('audit')} onOpenArchive={() => navigate('archive')} onRecordsChanged={refreshAfterManagementAction} />}
              {view === 'load-order' && <RepresentativeOrderLoader actions={services.representativeOrders} maxDocumentBytes={services.preview.maxRepresentativeOrderDocumentBytes} onCreated={representativeOrderCreated} onClose={() => navigate('expeditor')} />}
              {view === 'expeditor' && (accountCan(account, PERMISSIONS.VIEW_ASSIGNED_RFQS)
                && notificationTarget?.entityType !== 'order'
                ? <SalesRepresentativeDashboard account={account} rfqs={enquiries} onAction={performWorkflowAction} onLoadCustomerOrder={() => navigate('load-order')} technicalSupportActions={services.technicalSupport} onRecordsChanged={refreshTechnicalRecords} serviceMode={services.mode} focusRecordId={notificationTarget?.entityId} />
                : isPlanningWorkspace
                  ? <PlanningDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} planningOptions={planningOptions} focusRecordId={notificationTarget?.entityId} documentActions={orderDocumentActions} />
                  : isExpeditorWorkspace
                    ? <ExpeditorDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} expeditingOptions={expeditingOptions} focusRecordId={notificationTarget?.entityId} documentActions={orderDocumentActions} />
                    : isLaboratoryWorkspace
                      ? <LaboratoryDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} laboratoryActions={services.laboratory} laboratoryOptions={laboratoryOptions} onRecordsChanged={refreshOperationalRecords} focusRecordId={notificationTarget?.entityId} />
                      : isQualityWorkspace
                        ? <QualityDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} options={qualityOptions} focusRecordId={notificationTarget?.entityId} />
                    : isDispatchWorkspace
                      ? <DispatchDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} dispatchOptions={dispatchOptions} focusRecordId={notificationTarget?.entityId} documentActions={orderDocumentActions} />
                    : isManagementWorkspace
                      ? <ManagementDashboard account={account} managementActions={services.management} serviceMode={services.mode} onRecordsChanged={refreshAfterManagementAction} onOpenAudit={() => navigate('audit')} />
                      : <OperationalDashboard account={account} enquiries={staffRecords} onAction={performWorkflowAction} canUpdate={canPerformWorkflow} serviceMode={services.mode} planningOptions={planningOptions} expeditingOptions={expeditingOptions} dispatchOptions={dispatchOptions} focusRecordId={notificationTarget?.entityId} documentActions={orderDocumentActions} />)}
              {view === 'technical' && <TechnicalSupportWorkspace account={account} actions={services.technicalSupport} onChanged={refreshTechnicalRecords} focusRecordId={notificationTarget?.entityId} />}
              {view === 'clients' && <ClientVisitsDashboard account={account} actions={services.clientVisits} serviceMode={services.mode} />}
              {view === 'notifications' && <Notifications notifications={notifications} preferences={notificationPreferences} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} onSavePreferences={saveNotificationPreferences} onOpenNotification={openNotificationRecord} onRetryDelivery={retryNotificationDelivery} canRetryDelivery={accountCan(account, PERMISSIONS.RETRY_NOTIFICATION_DELIVERY)} serviceMode={services.mode} />}
              {view === 'archive' && <ArchivedOrders account={account} archiveActions={services.archive} serviceMode={services.mode} onRecordsChanged={refreshAfterRetentionAction} />}
              {view === 'audit' && <AuditTrail events={auditEvents} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={staffRecords} onSignOut={signOut} serviceMode={services.mode} onOpenSettings={() => navigate('settings')} credentialActions={services.mode === 'mock' ? services.credentials : null} onCredentialChanged={finishCredentialChange} />}
              {view === 'settings' && <Settings account={account} initialValue={userSettings} notificationPreferences={notificationPreferences} serviceMode={services.mode} credentialActions={services.mode === 'mock' ? services.credentials : null} onChangeTemporaryPassword={services.mode === 'api' ? services.auth.changePassword : null} onCredentialChanged={finishCredentialChange} onSwitchWorkspace={switchWorkspace} onSignOut={signOut} onSave={saveUserSettings} onSaveNotifications={saveNotificationPreferences} onReset={resetUserSettings} onReplayTutorial={replayTutorial} onTestSound={value => provideFeedback(value, 'success', 'success')} onTestHaptic={value => triggerHaptic(value, 'success')} onClose={() => navigate('account')} />}
            </>
          ) : (
            <>
              {view === 'home' && <Home account={account} enquiries={accountRecords} categories={catalogue.categories} recommendedCategories={catalogue.recommendedCategories} onNavigate={navigate} onCategory={openCategory} />}
              {view === 'catalogue' && <Catalogue categories={catalogue.categories} products={catalogue.products} categoryId={categoryId} onCategory={setCategoryId} onProduct={openProduct} />}
              {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} category={selectedCategory} onConfigure={() => startConfigurator(null, 'product')} />}
              {view === 'configurator' && selectedProduct && <Configurator product={selectedProduct} existingLine={editingLine} account={account} onSave={saveConfiguredLine} onCancel={backFromDetail} />}
              {view === 'enquiry' && <Enquiry account={account} lines={draft} registrationOptions={registrationOptions} deliverySettings={services.preview} onAddProducts={() => navigate('catalogue')} onEdit={line => startConfigurator(line, 'enquiry')} onRemove={removeLine} onQuantity={updateQuantity} onSubmit={submitEnquiry} success={success} onCloseSuccess={() => { setSuccess(null); navigate('tracking'); }} />}
              {view === 'tracking' && <OrderTracking account={account} enquiries={accountRecords} onStartEnquiry={() => navigate('enquiry')} onAction={performWorkflowAction} serviceMode={services.mode} certificateActions={services.laboratory} sourceDocumentActions={services.representativeOrders} technicalSupportActions={services.technicalSupport} onRecordsChanged={refreshTechnicalRecords} focusRecordId={notificationTarget?.entityId} />}
              {view === 'notifications' && <Notifications notifications={notifications} preferences={notificationPreferences} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} onSavePreferences={saveNotificationPreferences} onOpenNotification={openNotificationRecord} onRetryDelivery={retryNotificationDelivery} canRetryDelivery={accountCan(account, PERMISSIONS.RETRY_NOTIFICATION_DELIVERY)} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={accountRecords} onSignOut={signOut} serviceMode={services.mode} onOpenSettings={() => navigate('settings')} personalisation={customerPersonalisation} credentialActions={services.mode === 'mock' ? services.credentials : null} onCredentialChanged={finishCredentialChange} />}
              {view === 'settings' && <Settings account={account} initialValue={userSettings} notificationPreferences={notificationPreferences} serviceMode={services.mode} credentialActions={services.mode === 'mock' ? services.credentials : null} onChangeTemporaryPassword={services.mode === 'api' ? services.auth.changePassword : null} onCredentialChanged={finishCredentialChange} onSwitchWorkspace={switchWorkspace} onSignOut={signOut} onSave={saveUserSettings} onSaveNotifications={saveNotificationPreferences} onReset={resetUserSettings} onReplayTutorial={replayTutorial} onTestSound={value => provideFeedback(value, 'success', 'success')} onTestHaptic={value => triggerHaptic(value, 'success')} onClose={() => navigate('account')} />}
            </>
          )}
        </main>
        {!detailView && <BottomNav active={view} quantity={totalQuantity} role={account.role} unreadCount={unreadNotifications} onNavigate={navigate} />}
      </div>
      {tutorialSession && isCustomerExperience && <CustomerTutorial kind={tutorialSession.kind} startAt={tutorialSession.step} onProgress={saveTutorialProgress} onFinish={finishTutorial} onSkip={skipTutorial} />}
      <Toast message={toast} />
    </div>
  );
}

function AppLoading({ theme, onToggleTheme }) {
  return (
    <main className="app-state-view" aria-busy="true">
      <button className="auth-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
      <section className="app-state-card"><img src="assets/images/rhomberg-connect-logo-loading.png" alt="Rhomberg Connect" /><span className="state-spinner" /><h1>Preparing Rhomberg Connect</h1><p>Loading the catalogue and secure service boundary…</p></section>
    </main>
  );
}

function AppLoadError({ message, onRetry }) {
  return (
    <main className="app-state-view">
      <section className="app-state-card is-error"><span className="state-error-mark">!</span><h1>{__PUBLIC_PREVIEW__ ? 'The preview could not start' : 'Rhomberg Connect staging services are currently unavailable'}</h1><p role="alert">{message}</p><button className="primary-button" type="button" onClick={onRetry}>Try again <span>→</span></button></section>
    </main>
  );
}

function UnsupportedPreview() {
  return (
    <main className="app-state-view">
      <section className="app-state-card is-error">
        <span className="state-error-mark">!</span>
        <h1>This preview route is not supported</h1>
        <p>The requested interface is not one of the five controlled Rhomberg test previews.</p>
        <a className="primary-button" href="./">Return to the preview centre <span>→</span></a>
      </section>
    </main>
  );
}
