import { useEffect, useMemo, useRef, useState } from 'react';
import { Account } from './components/Account.jsx';
import { Auth } from './components/Auth.jsx';
import { Catalogue } from './components/Catalogue.jsx';
import { Configurator } from './components/Configurator.jsx';
import { Contact } from './components/Contact.jsx';
import { Enquiry } from './components/Enquiry.jsx';
import { Home } from './components/Home.jsx';
import { Intro } from './components/Intro.jsx';
import { AppHeader, BottomNav, Toast } from './components/Layout.jsx';
import { ProductDetail } from './components/ProductDetail.jsx';
import { productById } from './data/catalogue.js';
import {
  accountFromSession,
  authenticate,
  clearSession,
  createAccount,
  getDraft,
  getEnquiries,
  makeId,
  saveDraft,
  saveEnquiry,
  seedPreview,
  setSession,
} from './lib/storage.js';

seedPreview();

export default function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [account, setAccount] = useState(() => accountFromSession());
  const [view, setView] = useState('home');
  const [categoryId, setCategoryId] = useState(null);
  const [productId, setProductId] = useState(null);
  const [configOrigin, setConfigOrigin] = useState('product');
  const [editingLine, setEditingLine] = useState(null);
  const [draft, setDraft] = useState(() => account ? getDraft(account.id) : []);
  const [enquiries, setEnquiries] = useState(() => getEnquiries());
  const [success, setSuccess] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const selectedProduct = productById(productId);
  const accountEnquiries = useMemo(() => account ? enquiries.filter(enquiry => enquiry.accountId === account.id) : [], [account, enquiries]);
  const totalQuantity = draft.reduce((sum, line) => sum + line.quantity, 0);
  const detailView = view === 'product' || view === 'configurator';

  const notify = message => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  };

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const login = (email, password) => {
    const matched = authenticate(email, password);
    if (!matched) return { ok: false, message: 'The email address or password does not match a preview account.' };
    setSession(matched);
    setAccount(matched);
    setDraft(getDraft(matched.id));
    setView('home');
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
    if (target === 'catalogue') setCategoryId(null);
    setView(target);
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

  const submitEnquiry = details => {
    if (!details.application) return { ok: false, message: 'Please describe the application before submitting the request.' };
    const allEnquiries = getEnquiries();
    const reference = `RQ-PREVIEW-${String(allEnquiries.length + 1).padStart(4, '0')}`;
    const enquiry = {
      id: makeId('enquiry'),
      reference,
      version: 2,
      accountId: account.id,
      company: account.company,
      contact: account.contact,
      email: account.email,
      phone: account.phone,
      ...details,
      items: draft.map(line => ({ ...line })),
      status: 'Preview saved',
      createdAt: new Date().toISOString(),
    };
    saveEnquiry(enquiry);
    setEnquiries(getEnquiries());
    persistDraft([]);
    setSuccess({ reference, firstName: account.contact.split(/\s+/)[0] });
    return { ok: true, enquiry };
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
  if (!account) return <Auth onSignIn={login} onCreateAccount={register} />;

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
      <span className="desktop-caption">RHOMBERG INSTRUMENTS · INTERNAL MOBILE APP PREVIEW</span>
      <div className="app-shell">
        <AppHeader account={account} onNavigate={navigate} onBack={detailView ? backFromDetail : null} backLabel={view === 'configurator' ? 'Product configuration' : selectedProduct?.code || 'Catalogue'} />
        <main className="app-main">
          {view === 'home' && <Home account={account} enquiryCount={accountEnquiries.length} onNavigate={navigate} onCategory={openCategory} />}
          {view === 'catalogue' && <Catalogue categoryId={categoryId} onCategory={setCategoryId} onProduct={openProduct} />}
          {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} onConfigure={() => startConfigurator(null, 'product')} />}
          {view === 'configurator' && selectedProduct && <Configurator product={selectedProduct} existingLine={editingLine} onSave={saveConfiguredLine} onCancel={backFromDetail} />}
          {view === 'enquiry' && <Enquiry account={account} lines={draft} onAddProducts={() => navigate('catalogue')} onEdit={line => startConfigurator(line, 'enquiry')} onRemove={removeLine} onQuantity={updateQuantity} onSubmit={submitEnquiry} success={success} onCloseSuccess={() => { setSuccess(null); navigate('home'); }} />}
          {view === 'contact' && <Contact />}
          {view === 'account' && <Account account={account} enquiries={accountEnquiries} onSignOut={signOut} />}
        </main>
        {!detailView && <BottomNav active={view} quantity={totalQuantity} onNavigate={navigate} />}
      </div>
      <Toast message={toast} />
    </div>
  );
}
