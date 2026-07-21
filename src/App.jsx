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
import { OrderTracking } from './components/OrderTracking.jsx';
import { ProductDetail } from './components/ProductDetail.jsx';
import { friendlyServiceError, PERMISSIONS, roleCan, services, USER_ROLES } from './services/index.js';

const EMPTY_CATALOGUE = { categories: [], products: [], recommendedCategories: {} };
const EMPTY_REGISTRATION = { areas: [], industries: [], branches: [], areaDirectory: {} };

export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [appStatus, setAppStatus] = useState('loading');
  const [appError, setAppError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [account, setAccount] = useState(null);
  const [view, setView] = useState('home');
  const [theme, setTheme] = useState('light');
  const [catalogue, setCatalogue] = useState(EMPTY_CATALOGUE);
  const [registrationOptions, setRegistrationOptions] = useState(EMPTY_REGISTRATION);
  const [demoLogins, setDemoLogins] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [productId, setProductId] = useState(null);
  const [configOrigin, setConfigOrigin] = useState('product');
  const [editingLine, setEditingLine] = useState(null);
  const [draft, setDraft] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
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
        const [savedTheme, loadedCatalogue, loadedRegistration, loadedDemoLogins, session] = await Promise.all([
          services.preferences.getTheme(),
          services.products.getCatalogue(),
          services.accounts.getRegistrationOptions(),
          services.auth.getDemoLogins(),
          services.auth.getSession(),
        ]);
        if (!active) return;

        let loadedDraft = [];
        let loadedEnquiries = [];
        if (session) {
          [loadedDraft, loadedEnquiries] = await Promise.all([
            session.role === USER_ROLES.CUSTOMER ? services.enquiries.getDraft() : Promise.resolve([]),
            services.enquiries.list(),
          ]);
        }
        if (!active) return;

        setTheme(savedTheme);
        setCatalogue(loadedCatalogue);
        setRegistrationOptions(loadedRegistration);
        setDemoLogins(loadedDemoLogins);
        setAccount(session);
        setDraft(loadedDraft);
        setEnquiries(loadedEnquiries);
        setView(session && session.role !== USER_ROLES.CUSTOMER ? 'expeditor' : 'home');
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
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  const isStaff = Boolean(account && account.role !== USER_ROLES.CUSTOMER);
  const canUpdateTracking = Boolean(account && roleCan(account.role, PERMISSIONS.UPDATE_TRACKING));
  const selectedProduct = catalogue.products.find(product => product.id === productId) || null;
  const selectedCategory = selectedProduct ? catalogue.categories.find(category => category.id === selectedProduct.category) || null : null;
  const accountEnquiries = useMemo(() => {
    if (!account || isStaff) return [];
    return enquiries.filter(enquiry => enquiry.companyId === account.companyId || enquiry.accountId === account.id);
  }, [account, enquiries, isStaff]);
  const totalQuantity = draft.reduce((sum, line) => sum + line.quantity, 0);
  const detailView = !isStaff && (view === 'product' || view === 'configurator');

  const loadAccountWorkspace = async signedInAccount => {
    const [loadedDraft, loadedEnquiries] = await Promise.all([
      signedInAccount.role === USER_ROLES.CUSTOMER ? services.enquiries.getDraft() : Promise.resolve([]),
      services.enquiries.list(),
    ]);
    setAccount(signedInAccount);
    setDraft(loadedDraft);
    setEnquiries(loadedEnquiries);
    setView(signedInAccount.role !== USER_ROLES.CUSTOMER ? 'expeditor' : 'home');
  };

  const login = async (email, password) => {
    try {
      const signedInAccount = await services.auth.signIn({ email, password });
      await loadAccountWorkspace(signedInAccount);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyServiceError(error, 'The app could not sign you in. Please try again.'), fieldErrors: error?.fieldErrors || {} };
    }
  };

  const register = async data => {
    try {
      const created = await services.auth.register(data);
      await loadAccountWorkspace(created);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyServiceError(error, 'The company account could not be created. Please try again.'), fieldErrors: error?.fieldErrors || {} };
    }
  };

  const navigate = target => {
    const destination = isStaff && !['expeditor', 'account'].includes(target) ? 'expeditor' : target;
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
      const updatedEnquiries = await services.enquiries.list();
      setEnquiries(updatedEnquiries);
      setDraft([]);
      const delivery = result.delivery || { ok: true };
      setSuccess({
        reference: result.enquiry.reference,
        firstName: account.contact.split(/\s+/)[0],
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

  const updateTracking = async (enquiryId, status, note, actor) => {
    const updated = await services.tracking.updateStatus(enquiryId, { status, note, actor });
    setEnquiries(current => current.map(enquiry => enquiry.id === updated.id ? updated : enquiry));
    notify(`${updated.reference} updated to ${updated.status}`);
    return updated;
  };

  const signOut = async () => {
    try {
      await services.auth.signOut();
      setAccount(null);
      setDraft([]);
      setEnquiries([]);
      setCategoryId(null);
      setProductId(null);
      setView('home');
    } catch (error) {
      notify(friendlyServiceError(error, 'Sign-out could not be completed. Please try again.'));
    }
  };

  if (!introComplete) return <Intro onComplete={() => setIntroComplete(true)} />;
  if (appStatus === 'loading') return <AppLoading theme={theme} onToggleTheme={toggleTheme} />;
  if (appStatus === 'error') return <AppLoadError message={appError} onRetry={() => setRetryToken(value => value + 1)} />;
  if (!account) return <Auth onSignIn={login} onCreateAccount={register} theme={theme} onToggleTheme={toggleTheme} registrationOptions={registrationOptions} demoLogins={demoLogins} serviceMode={services.mode} />;

  const backFromDetail = () => {
    if (view === 'configurator') {
      setView(configOrigin === 'enquiry' ? 'enquiry' : 'product');
      setEditingLine(null);
    } else {
      setCategoryId(selectedProduct?.category || null);
      setView('catalogue');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-canvas">
      <span className="desktop-caption">RHOMBERG INSTRUMENTS · {services.mode === 'mock' ? 'CONNECTED APP TEST' : 'PRIVATE CLOUD'}</span>
      <div className={`app-shell ${isStaff ? 'expeditor-shell' : ''}`}>
        <AppHeader account={account} onNavigate={navigate} onBack={detailView ? backFromDetail : null} backLabel={view === 'configurator' ? 'Product configuration' : selectedProduct?.code || 'Catalogue'} theme={theme} onToggleTheme={toggleTheme} serviceMode={services.mode} />
        <main className="app-main">
          {isStaff ? (
            <>
              {view === 'expeditor' && <ExpeditorDashboard account={account} enquiries={enquiries} onUpdate={updateTracking} canUpdate={canUpdateTracking} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={enquiries} onSignOut={signOut} serviceMode={services.mode} />}
            </>
          ) : (
            <>
              {view === 'home' && <Home account={account} enquiries={accountEnquiries} categories={catalogue.categories} recommendedCategories={catalogue.recommendedCategories} onNavigate={navigate} onCategory={openCategory} />}
              {view === 'catalogue' && <Catalogue categories={catalogue.categories} products={catalogue.products} categoryId={categoryId} onCategory={setCategoryId} onProduct={openProduct} />}
              {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} category={selectedCategory} onConfigure={() => startConfigurator(null, 'product')} />}
              {view === 'configurator' && selectedProduct && <Configurator product={selectedProduct} existingLine={editingLine} onSave={saveConfiguredLine} onCancel={backFromDetail} />}
              {view === 'enquiry' && <Enquiry account={account} lines={draft} registrationOptions={registrationOptions} deliverySettings={services.preview} onAddProducts={() => navigate('catalogue')} onEdit={line => startConfigurator(line, 'enquiry')} onRemove={removeLine} onQuantity={updateQuantity} onSubmit={submitEnquiry} success={success} onCloseSuccess={() => { setSuccess(null); navigate('tracking'); }} />}
              {view === 'tracking' && <OrderTracking account={account} enquiries={accountEnquiries} onStartEnquiry={() => navigate('enquiry')} serviceMode={services.mode} />}
              {view === 'account' && <Account account={account} enquiries={accountEnquiries} onSignOut={signOut} serviceMode={services.mode} />}
            </>
          )}
        </main>
        {!detailView && <BottomNav active={view} quantity={totalQuantity} role={account.role} onNavigate={navigate} />}
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
