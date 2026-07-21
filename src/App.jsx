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
import { productById } from './data/catalogue.js';
import { sendRfqEmail } from './lib/rfqEmail.js';
import {
  accountFromSession,
  authenticate,
  clearSession,
  createAccount,
  getDraft,
  getEnquiries,
  getTheme,
  makeId,
  saveDraft,
  saveEnquiry,
  saveTheme,
  seedPreview,
  setSession,
  updateEnquiryTracking,
} from './lib/storage.js';

seedPreview();

export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [account, setAccount] = useState(() => accountFromSession());
  const [view, setView] = useState(() => accountFromSession()?.role === 'expeditor' ? 'expeditor' : 'home');
  const [theme, setTheme] = useState(() => getTheme());
  const [categoryId, setCategoryId] = useState(null);
  const [productId, setProductId] = useState(null);
  const [configOrigin, setConfigOrigin] = useState('product');
  const [editingLine, setEditingLine] = useState(null);
  const [draft, setDraft] = useState(() => account?.role === 'customer' ? getDraft(account.id) : []);
  const [enquiries, setEnquiries] = useState(() => getEnquiries());
  const [success, setSuccess] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const isExpeditor = account?.role === 'expeditor';
  const selectedProduct = productById(productId);
  const accountEnquiries = useMemo(() => account && !isExpeditor ? enquiries.filter(enquiry => enquiry.accountId === account.id) : [], [account, enquiries, isExpeditor]);
  const totalQuantity = draft.reduce((sum, line) => sum + line.quantity, 0);
  const detailView = !isExpeditor && (view === 'product' || view === 'configurator');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');

  const notify = message => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const login = (email, password) => {
    const matched = authenticate(email, password);
    if (!matched) return { ok: false, message: 'The email address or password does not match a preview account.' };
    setSession(matched);
    setAccount(matched);
    setDraft(matched.role === 'customer' ? getDraft(matched.id) : []);
    setView(matched.role === 'expeditor' ? 'expeditor' : 'home');
    return { ok: true };
  };

  const register = data => {
    try {
      const created = createAccount(data);
      setSession(created);
      setAccount(created);
      setDraft([]);
      setView('home');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const navigate = target => {
    const destination = isExpeditor && !['expeditor', 'account'].includes(target) ? 'expeditor' : target;
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
    saveDraft(account.id, next);
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
    if (!details.application) return { ok: false, message: 'Please describe the application before submitting the request.' };
    if (!draft.length) return { ok: false, message: 'Please add and configure at least one unit before submitting the RFQ.' };
    const { poFile, ...serialisableDetails } = details;
    const allEnquiries = getEnquiries();
    const reference = `RQ-PREVIEW-${String(allEnquiries.length + 1).padStart(4, '0')}`;
    const createdAt = new Date().toISOString();
    const enquiry = {
      id: makeId('enquiry'),
      reference,
      version: 4,
      accountId: account.id,
      company: account.company,
      contact: account.contact,
      email: account.email,
      phone: account.phone,
      ...serialisableDetails,
      items: draft.map(line => ({ ...line })),
      trackingStatus: 'rfq-submitted',
      status: 'RFQ submitted',
      trackingHistory: [{ id: makeId('event'), status: 'rfq-submitted', note: 'RFQ submitted by the customer and saved to the account.', actor: account.contact, createdAt }],
      emailDeliveryStatus: 'sending',
      createdAt,
      updatedAt: createdAt,
    };

    saveEnquiry(enquiry);
    setEnquiries(getEnquiries());
    const emailResult = await sendRfqEmail(enquiry, poFile);
    const saved = saveEnquiry({
      ...enquiry,
      emailDeliveryStatus: emailResult.ok ? 'submitted' : 'pending',
      emailRecipient: emailResult.recipient || '',
      deliveryMode: emailResult.deliveryMode || 'saved-locally',
      pricedPdfAttached: Boolean(emailResult.pricedPdfAttached),
      emailSubmittedAt: emailResult.ok ? new Date().toISOString() : '',
      emailError: emailResult.ok ? '' : emailResult.message,
    });
    setEnquiries(getEnquiries());
    persistDraft([]);
    setSuccess({
      reference,
      firstName: account.contact.split(/\s+/)[0],
      recipient: emailResult.recipient || 'Rhomberg sales',
      activationMayBeRequired: emailResult.activationMayBeRequired,
      pricedPdfAttached: emailResult.pricedPdfAttached,
      emailFailed: !emailResult.ok,
      fallbackUrl: emailResult.fallbackUrl,
      warning: emailResult.warning || (!emailResult.ok ? emailResult.message : ''),
    });
    return { ok: true, enquiry: saved };
  };

  const updateTracking = (enquiryId, status, note, actor) => {
    const updated = updateEnquiryTracking(enquiryId, { status, note, actor });
    if (!updated) return null;
    setEnquiries(getEnquiries());
    notify(`${updated.reference} updated to ${updated.status}`);
    return updated;
  };

  const signOut = () => {
    clearSession();
    setAccount(null);
    setDraft([]);
    setCategoryId(null);
    setProductId(null);
    setView('home');
  };

  if (!introComplete) return <Intro onComplete={() => setIntroComplete(true)} />;
  if (!account) return <Auth onSignIn={login} onCreateAccount={register} theme={theme} onToggleTheme={toggleTheme} />;

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
      <span className="desktop-caption">RHOMBERG INSTRUMENTS · CONNECTED APP TEST</span>
      <div className={`app-shell ${isExpeditor ? 'expeditor-shell' : ''}`}>
        <AppHeader account={account} onNavigate={navigate} onBack={detailView ? backFromDetail : null} backLabel={view === 'configurator' ? 'Product configuration' : selectedProduct?.code || 'Catalogue'} theme={theme} onToggleTheme={toggleTheme} />
        <main className="app-main">
          {isExpeditor ? (
            <>
              {view === 'expeditor' && <ExpeditorDashboard account={account} enquiries={enquiries} onUpdate={updateTracking} />}
              {view === 'account' && <Account account={account} enquiries={enquiries} onSignOut={signOut} />}
            </>
          ) : (
            <>
              {view === 'home' && <Home account={account} enquiries={accountEnquiries} onNavigate={navigate} onCategory={openCategory} />}
              {view === 'catalogue' && <Catalogue categoryId={categoryId} onCategory={setCategoryId} onProduct={openProduct} />}
              {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} onConfigure={() => startConfigurator(null, 'product')} />}
              {view === 'configurator' && selectedProduct && <Configurator product={selectedProduct} existingLine={editingLine} onSave={saveConfiguredLine} onCancel={backFromDetail} />}
              {view === 'enquiry' && <Enquiry account={account} lines={draft} onAddProducts={() => navigate('catalogue')} onEdit={line => startConfigurator(line, 'enquiry')} onRemove={removeLine} onQuantity={updateQuantity} onSubmit={submitEnquiry} success={success} onCloseSuccess={() => { setSuccess(null); navigate('tracking'); }} />}
              {view === 'tracking' && <OrderTracking account={account} enquiries={accountEnquiries} onStartEnquiry={() => navigate('enquiry')} />}
              {view === 'account' && <Account account={account} enquiries={accountEnquiries} onSignOut={signOut} />}
            </>
          )}
        </main>
        {!detailView && <BottomNav active={view} quantity={totalQuantity} role={account.role} onNavigate={navigate} />}
      </div>
      <Toast message={toast} />
    </div>
  );
}
