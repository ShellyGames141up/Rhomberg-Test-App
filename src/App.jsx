import { useEffect, useMemo, useRef, useState } from 'react';
import { Account } from './components/Account.jsx';
import { Auth } from './components/Auth.jsx';
import { Catalogue } from './components/Catalogue.jsx';
import { Configurator } from './components/Configurator.jsx';
import { Enquiry } from './components/Enquiry.jsx';
import { ExpeditorDashboard } from './components/ExpeditorDashboard.jsx';
import { Home } from './components/Home.jsx';
import { Intro } from './components/Intro.jsx';
import { AppHeader, BottomNav, Toast } from './components/Layout.jsx';
import { Notifications } from './components/Notifications.jsx';
import { OperationalDashboard } from './components/OperationalDashboard.jsx';
import { OrderTracking } from './components/OrderTracking.jsx';
import { PlanningDashboard } from './components/PlanningDashboard.jsx';
import { ProductDetail } from './components/ProductDetail.jsx';
import { SalesRepresentativeDashboard } from './components/SalesRepresentativeDashboard.jsx';
import { CustomerPersonalisation } from './apps/customer/CustomerPersonalisation.jsx';
import { PreviewLanding } from './apps/PreviewLanding.jsx';
import {
  createDefaultCustomerPersonalisation,
  customerPersonalisationCss,
  normaliseCustomerPersonalisation,
} from './shared/personalisation/personalisation.js';
import {
  filterDemoLoginsForPreview,
  PREVIEW_BY_ID,
  previewAllowsRole,
  previewContextForPath,
} from './shared/platform/previewConfig.js';
import {
  accountCan,
  accountCanPerformWorkflow,
  defaultViewForRole,
  friendlyServiceError,
  isInternalAccount,
  normaliseViewForRole,
  PERMISSIONS,
  services,
  usesExpeditorWorkspace,
  usesPlanningWorkspace,
} from './services/index.js';

const EMPTY_CATALOGUE = { categories: [], products: [], recommendedCategories: {} };
const EMPTY_REGISTRATION = { areas: [], industries: [], branches: [], areaDirectory: {} };
const EMPTY_PLANNING_OPTIONS = { users: [], locations: [], priorities: [] };
const EMPTY_EXPEDITING_OPTIONS = { progressSteps: [], requiredStepIds: [], documentTypes: [], approachingCompletionDays: 3 };
const PUBLIC_PREVIEW = __PUBLIC_PREVIEW__;
const DOCUMENT_PREVIEW_ID = globalThis.document?.querySelector?.('meta[name="rhomberg-preview"]')?.content || '';
const PREVIEW_CONTEXT = PUBLIC_PREVIEW
  ? (PREVIEW_BY_ID[DOCUMENT_PREVIEW_ID] || previewContextForPath(globalThis.location?.pathname || '/'))
  : previewContextForPath('/preview/internal-desktop/');
const listEnquiriesForAccount = signedInAccount => (
  accountCan(signedInAccount, PERMISSIONS.VIEW_ASSIGNED_RFQS)
    ? services.enquiries.listRepresentativeInbox()
    : services.enquiries.list()
);
const canLoadExpeditingOptions = signedInAccount => (
  accountCan(signedInAccount, PERMISSIONS.VIEW_EXPEDITING_QUEUE)
  || accountCan(signedInAccount, PERMISSIONS.UPDATE_ORDER_PROGRESS)
  || accountCan(signedInAccount, PERMISSIONS.MOVE_TO_DISPATCH)
);

export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [appStatus, setAppStatus] = useState('loading');
  const [appError, setAppError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [account, setAccount] = useState(null);
  const [view, setView] = useState('home');
  const [theme, setTheme] = useState('light');
  const [customerPersonalisation, setCustomerPersonalisation] = useState(createDefaultCustomerPersonalisation);
  const [personalisationDeferred, setPersonalisationDeferred] = useState(false);
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
  const [planningOptions, setPlanningOptions] = useState(EMPTY_PLANNING_OPTIONS);
  const [expeditingOptions, setExpeditingOptions] = useState(EMPTY_EXPEDITING_OPTIONS);
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
        const [savedTheme, loadedCatalogue, loadedRegistration, loadedDemoLogins, savedSession] = await Promise.all([
          services.preferences.getTheme(),
          services.products.getCatalogue(),
          services.accounts.getRegistrationOptions(),
          services.auth.getDemoLogins(),
          services.auth.getSession(),
        ]);
        if (!active) return;

        let session = PREVIEW_CONTEXT.landing ? null : savedSession;
        let previewAccessError = '';
        if (session && !previewAllowsRole(PREVIEW_CONTEXT, session.role)) {
          await services.auth.signOut();
          previewAccessError = `${session.role.replaceAll('_', ' ')} accounts cannot enter ${PREVIEW_CONTEXT.displayName}. Choose a compatible preview or demo login.`;
          session = null;
        }
        let loadedDraft = [];
        let loadedEnquiries = [];
        let loadedOrders = [];
        let loadedNotifications = [];
        let loadedPlanningOptions = EMPTY_PLANNING_OPTIONS;
        let loadedExpeditingOptions = EMPTY_EXPEDITING_OPTIONS;
        let loadedPersonalisation = createDefaultCustomerPersonalisation();
        if (session) {
          [loadedDraft, loadedEnquiries, loadedOrders, loadedNotifications, loadedPlanningOptions, loadedExpeditingOptions, loadedPersonalisation] = await Promise.all([
            accountCan(session, PERMISSIONS.CREATE_RFQ) ? services.enquiries.getDraft() : Promise.resolve([]),
            listEnquiriesForAccount(session),
            services.orders.list(),
            services.notifications.list(),
            accountCan(session, PERMISSIONS.ADD_PLANNING_INFORMATION)
              ? services.planning.getWorkspaceOptions()
              : Promise.resolve(EMPTY_PLANNING_OPTIONS),
            canLoadExpeditingOptions(session)
              ? services.expediting.getWorkspaceOptions()
              : Promise.resolve(EMPTY_EXPEDITING_OPTIONS),
            PREVIEW_CONTEXT.customer
              ? services.personalisation.get()
              : Promise.resolve(createDefaultCustomerPersonalisation()),
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
        setDraft(loadedDraft);
        setEnquiries(loadedEnquiries);
        setOrders(loadedOrders);
        setNotifications(loadedNotifications);
        setPlanningOptions(loadedPlanningOptions);
        setExpeditingOptions(loadedExpeditingOptions);
        setView(session ? defaultViewForRole(session.role) : 'home');
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
      const preference = account && PREVIEW_CONTEXT.customer
        ? customerPersonalisation.appearanceMode
        : theme;
      document.documentElement.dataset.theme = preference === 'system'
        ? (systemTheme?.matches ? 'dark' : 'light')
        : preference;
    };
    applyTheme();
    systemTheme?.addEventListener?.('change', applyTheme);
    return () => systemTheme?.removeEventListener?.('change', applyTheme);
  }, [account, customerPersonalisation.appearanceMode, theme]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const notify = message => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    services.preferences.setTheme(next).catch(error => notify(friendlyServiceError(error, 'The theme changed, but the preference could not be saved.')));
  };

  const isStaff = isInternalAccount(account);
  const isPlanningWorkspace = usesPlanningWorkspace(account);
  const isExpeditorWorkspace = usesExpeditorWorkspace(account);
  const canPerformWorkflow = accountCanPerformWorkflow(account);
  const personalisationStyle = useMemo(
    () => PREVIEW_CONTEXT.customer ? customerPersonalisationCss(customerPersonalisation) : undefined,
    [customerPersonalisation],
  );
  const selectedProduct = catalogue.products.find(product => product.id === productId) || null;
  const selectedCategory = selectedProduct ? catalogue.categories.find(category => category.id === selectedProduct.category) || null : null;
  const accountRecords = useMemo(() => {
    if (!account || isStaff) return [];
    return [...enquiries, ...orders].filter(record => record.companyId === account.companyId || record.accountId === account.id);
  }, [account, enquiries, isStaff, orders]);
  const staffRecords = useMemo(() => [...enquiries, ...orders], [enquiries, orders]);
  const unreadNotifications = notifications.filter(notification => !notification.readAt).length;
  const totalQuantity = draft.reduce((sum, line) => sum + line.quantity, 0);
  const detailView = !isStaff && (view === 'product' || view === 'configurator' || view === 'settings');

  const loadAccountWorkspace = async signedInAccount => {
    if (!previewAllowsRole(PREVIEW_CONTEXT, signedInAccount.role)) {
      throw new Error(`This ${signedInAccount.role.replaceAll('_', ' ')} account is not supported in ${PREVIEW_CONTEXT.displayName}.`);
    }
    const [loadedDraft, loadedEnquiries, loadedOrders, loadedNotifications, loadedPlanningOptions, loadedExpeditingOptions, loadedPersonalisation] = await Promise.all([
      accountCan(signedInAccount, PERMISSIONS.CREATE_RFQ) ? services.enquiries.getDraft() : Promise.resolve([]),
      listEnquiriesForAccount(signedInAccount),
      services.orders.list(),
      services.notifications.list(),
      accountCan(signedInAccount, PERMISSIONS.ADD_PLANNING_INFORMATION)
        ? services.planning.getWorkspaceOptions()
        : Promise.resolve(EMPTY_PLANNING_OPTIONS),
      canLoadExpeditingOptions(signedInAccount)
        ? services.expediting.getWorkspaceOptions()
        : Promise.resolve(EMPTY_EXPEDITING_OPTIONS),
      PREVIEW_CONTEXT.customer
        ? services.personalisation.get()
        : Promise.resolve(createDefaultCustomerPersonalisation()),
    ]);
    setAccount(signedInAccount);
    setDraft(loadedDraft);
    setEnquiries(loadedEnquiries);
    setOrders(loadedOrders);
    setNotifications(loadedNotifications);
    setPlanningOptions(loadedPlanningOptions);
    setExpeditingOptions(loadedExpeditingOptions);
    setCustomerPersonalisation(normaliseCustomerPersonalisation(loadedPersonalisation));
    setPersonalisationDeferred(false);
    setView(defaultViewForRole(signedInAccount.role));
  };

  const login = async (email, password) => {
    try {
      const signedInAccount = await services.auth.signIn({ email, password });
      if (!previewAllowsRole(PREVIEW_CONTEXT, signedInAccount.role)) {
        await services.auth.signOut();
        return {
          ok: false,
          message: `${signedInAccount.role.replaceAll('_', ' ')} accounts cannot enter ${PREVIEW_CONTEXT.displayName}. Return to the preview centre and choose a compatible interface.`,
          fieldErrors: {},
        };
      }
      await loadAccountWorkspace(signedInAccount);
      setAccessError('');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyServiceError(error, 'The app could not sign you in. Please try again.'), fieldErrors: error?.fieldErrors || {} };
    }
  };

  const register = async data => {
    try {
      if (!PREVIEW_CONTEXT.customer) {
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
    const destination = account ? normaliseViewForRole(account.role, target) : 'home';
    if (destination === 'catalogue') setCategoryId(null);
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
    try {
      const result = await services.enquiries.submit(details, draft);
      const updatedEnquiries = await listEnquiriesForAccount(account);
      setEnquiries(updatedEnquiries);
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
      return { ok: true, enquiry: result.enquiry };
    } catch (error) {
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
    notify(createdOrder ? `${updated.reference} converted to ${createdOrder.reference}` : `${updated.reference} updated to ${updated.status}`);
    return result;
  };

  const markNotificationRead = async notificationId => {
    const updated = await services.notifications.markRead(notificationId);
    setNotifications(current => current.map(notification => notification.id === updated.id ? updated : notification));
    return updated;
  };

  const saveCustomerPersonalisation = async candidate => {
    try {
      const saved = candidate.setupCompleted
        ? await services.personalisation.complete(candidate)
        : await services.personalisation.save(candidate);
      setCustomerPersonalisation(normaliseCustomerPersonalisation(saved));
      setView('home');
      notify('Rhomberg Connect settings saved');
      return saved;
    } catch (error) {
      throw new Error(friendlyServiceError(error, 'Your customer settings could not be saved. Please check the highlighted choices and try again.'));
    }
  };

  const uploadCustomerImage = async (file, kind, position) => {
    try {
      return await services.personalisation.uploadImage(file, kind, position);
    } catch (error) {
      throw new Error(friendlyServiceError(error, 'The image could not be added. Please choose a supported image under 1 MB.'));
    }
  };

  const removeCustomerImage = async imageId => {
    try {
      return await services.personalisation.removeImage(imageId);
    } catch (error) {
      throw new Error(friendlyServiceError(error, 'The image could not be removed.'));
    }
  };

  const signOut = async () => {
    try {
      await services.auth.signOut();
      setAccount(null);
      setDraft([]);
      setEnquiries([]);
      setOrders([]);
      setNotifications([]);
      setCustomerPersonalisation(createDefaultCustomerPersonalisation());
      setPersonalisationDeferred(false);
      setPlanningOptions(EMPTY_PLANNING_OPTIONS);
      setExpeditingOptions(EMPTY_EXPEDITING_OPTIONS);
      setCategoryId(null);
      setProductId(null);
      setView('home');
    } catch (error) {
      notify(friendlyServiceError(error, 'Sign-out could not be completed. Please try again.'));
    }
  };

  if (appStatus === 'loading') return <AppLoading theme={theme} onToggleTheme={toggleTheme} />;
  if (appStatus === 'error') return <AppLoadError message={appError} onRetry={() => setRetryToken(value => value + 1)} />;
  if (PREVIEW_CONTEXT.landing) return <PreviewLanding demoLogins={demoLogins} serviceMode={services.mode} />;
  if (PREVIEW_CONTEXT.unsupported) return <UnsupportedPreview />;
  if (!introComplete) return <Intro onComplete={() => setIntroComplete(true)} />;
  if (!account) return <Auth onSignIn={login} onCreateAccount={register} theme={theme} onToggleTheme={toggleTheme} registrationOptions={registrationOptions} demoLogins={demoLogins} serviceMode={services.mode} preview={PREVIEW_CONTEXT} allowRegistration={Boolean(PREVIEW_CONTEXT.customer)} accessError={accessError} />;
  if (PREVIEW_CONTEXT.customer && !customerPersonalisation.setupCompleted && !personalisationDeferred) {
    return <CustomerPersonalisation account={account} initialValue={customerPersonalisation} onSave={saveCustomerPersonalisation} onDefer={() => { setPersonalisationDeferred(true); notify('Setup saved for later'); }} onUploadImage={uploadCustomerImage} onRemoveImage={removeCustomerImage} />;
  }

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
      className={`app-canvas platform-preview preview-${PREVIEW_CONTEXT.id} ${PREVIEW_CONTEXT.customer ? 'preview-connect' : 'preview-operations'}`}
      style={personalisationStyle}
      data-font-size={PREVIEW_CONTEXT.customer ? customerPersonalisation.fontSize : undefined}
      data-density={PREVIEW_CONTEXT.customer ? customerPersonalisation.density : undefined}
    >
      <span className="desktop-caption">{PREVIEW_CONTEXT.product.toUpperCase()} · {PREVIEW_CONTEXT.platform.toUpperCase()} · {__PUBLIC_PREVIEW__ ? 'DEMO PREVIEW' : 'PRIVATE CLOUD'}</span>
      <div className={`app-shell ${isStaff ? 'expeditor-shell' : ''} ${isPlanningWorkspace ? 'planning-shell' : ''} ${isExpeditorWorkspace ? 'expediting-workspace-shell' : ''}`}>
        {__PUBLIC_PREVIEW__ && <div className="platform-preview-banner"><span><strong>{PREVIEW_CONTEXT.product}</strong> {PREVIEW_CONTEXT.platform}</span><a href="./">All previews</a></div>}
        <AppHeader account={account} onNavigate={navigate} onBack={detailView ? backFromDetail : null} backLabel={view === 'settings' ? 'Customer settings' : view === 'configurator' ? 'Product configuration' : selectedProduct?.code || 'Catalogue'} theme={theme} onToggleTheme={toggleTheme} serviceMode={services.mode} preview={PREVIEW_CONTEXT} showThemeToggle={!PREVIEW_CONTEXT.customer} personalisation={PREVIEW_CONTEXT.customer ? customerPersonalisation : null} />
        <main className="app-main">
          {isStaff ? (
            <>
              {view === 'expeditor' && (accountCan(account, PERMISSIONS.VIEW_ASSIGNED_RFQS)
                ? <SalesRepresentativeDashboard account={account} rfqs={enquiries} onAction={performWorkflowAction} serviceMode={services.mode} />
                : isPlanningWorkspace
                  ? <PlanningDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} planningOptions={planningOptions} />
                  : isExpeditorWorkspace
                    ? <ExpeditorDashboard account={account} orders={orders} onAction={performWorkflowAction} serviceMode={services.mode} expeditingOptions={expeditingOptions} />
                    : <OperationalDashboard account={account} enquiries={staffRecords} onAction={performWorkflowAction} canUpdate={canPerformWorkflow} serviceMode={services.mode} planningOptions={planningOptions} expeditingOptions={expeditingOptions} />)}
              {view === 'notifications' && <Notifications notifications={notifications} onMarkRead={markNotificationRead} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={staffRecords} onSignOut={signOut} serviceMode={services.mode} />}
            </>
          ) : (
            <>
              {view === 'home' && <Home account={account} enquiries={accountRecords} categories={catalogue.categories} recommendedCategories={catalogue.recommendedCategories} onNavigate={navigate} onCategory={openCategory} />}
              {view === 'catalogue' && <Catalogue categories={catalogue.categories} products={catalogue.products} categoryId={categoryId} onCategory={setCategoryId} onProduct={openProduct} />}
              {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} category={selectedCategory} onConfigure={() => startConfigurator(null, 'product')} />}
              {view === 'configurator' && selectedProduct && <Configurator product={selectedProduct} existingLine={editingLine} onSave={saveConfiguredLine} onCancel={backFromDetail} />}
              {view === 'enquiry' && <Enquiry account={account} lines={draft} registrationOptions={registrationOptions} deliverySettings={services.preview} onAddProducts={() => navigate('catalogue')} onEdit={line => startConfigurator(line, 'enquiry')} onRemove={removeLine} onQuantity={updateQuantity} onSubmit={submitEnquiry} success={success} onCloseSuccess={() => { setSuccess(null); navigate('tracking'); }} />}
              {view === 'tracking' && <OrderTracking account={account} enquiries={accountRecords} onStartEnquiry={() => navigate('enquiry')} onAction={performWorkflowAction} serviceMode={services.mode} />}
              {view === 'notifications' && <Notifications notifications={notifications} onMarkRead={markNotificationRead} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={accountRecords} onSignOut={signOut} serviceMode={services.mode} onOpenSettings={() => navigate('settings')} personalisation={customerPersonalisation} />}
              {view === 'settings' && <CustomerPersonalisation account={account} initialValue={customerPersonalisation} mode="settings" onSave={saveCustomerPersonalisation} onCancel={() => navigate('account')} onUploadImage={uploadCustomerImage} onRemoveImage={removeCustomerImage} />}
            </>
          )}
        </main>
        {!detailView && <BottomNav active={view} quantity={totalQuantity} role={account.role} unreadCount={unreadNotifications} onNavigate={navigate} />}
      </div>
      <Toast message={toast} />
    </div>
  );
}

function AppLoading({ theme, onToggleTheme }) {
  return (
    <main className="app-state-view" aria-busy="true">
      <button className="auth-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
      <section className="app-state-card"><img src="assets/images/rhomberg-gauge-mark.svg" alt="" /><span className="state-spinner" /><h1>Preparing your workspace</h1><p>Loading the catalogue and secure service boundary…</p></section>
    </main>
  );
}

function AppLoadError({ message, onRetry }) {
  return (
    <main className="app-state-view">
      <section className="app-state-card is-error"><span className="state-error-mark">!</span><h1>The preview could not start</h1><p role="alert">{message}</p><button className="primary-button" type="button" onClick={onRetry}>Try again <span>→</span></button></section>
    </main>
  );
}

function UnsupportedPreview() {
  return (
    <main className="app-state-view">
      <section className="app-state-card is-error">
        <span className="state-error-mark">!</span>
        <h1>This preview route is not supported</h1>
        <p>The requested interface is not one of the four controlled Rhomberg test previews.</p>
        <a className="primary-button" href="./">Return to the preview centre <span>→</span></a>
      </section>
    </main>
  );
}
