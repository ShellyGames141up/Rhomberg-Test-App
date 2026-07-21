import { useState } from 'react';
import { areas } from '../data/branches.js';
import { industries } from '../data/catalogue.js';
import { DEMO_ACCOUNT } from '../lib/storage.js';

export function Auth({ onSignIn, onCreateAccount }) {
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submitSignIn = event => {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = onSignIn(data.email, data.password);
    if (!result.ok) setError(result.message);
  };

  const submitRegister = event => {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password.length < 8) {
      setError('Please create a password with at least eight characters.');
      return;
    }
    const result = onCreateAccount(data);
    if (!result.ok) setError(result.message);
  };

  return (
    <main className="auth-view">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img src="assets/images/rhomberg-gauge-mark.svg" alt="" />
          <img src="assets/images/rhomberg-wordmark-transparent.png" alt="Rhomberg Instruments" />
        </div>
        <span className="preview-chip">Public test preview</span>
        <h1 id="auth-title">{tab === 'signin' ? <>Welcome to your<br /><em>quote portal.</em></> : <>Create your company<br /><em>workspace.</em></>}</h1>
        <p className="auth-intro">Find the right instrument, configure your requirements and send Rhomberg a clear quote request.</p>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'active' : ''} onClick={() => { setTab('signin'); setError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); }}>Create account</button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={submitSignIn}>
            <FormField label="Email address"><input name="email" type="email" autoComplete="email" required placeholder="name@company.co.za" /></FormField>
            <PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(value => !value)} />
            <p className="form-error" role="alert">{error}</p>
            <button className="primary-button full" type="submit">Sign in <span>→</span></button>
            <button className="demo-account" type="button" onClick={() => onSignIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)}>
              <span className="demo-avatar">D</span><span><strong>Use demo company</strong><small>Demo Mining Solutions</small></span><i>›</i>
            </button>
            <p className="demo-credentials">Demo: {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}</p>
          </form>
        ) : (
          <form className="auth-form register-grid" onSubmit={submitRegister}>
            <FormField label="Company name"><input name="company" required placeholder="Your company" /></FormField>
            <FormField label="Contact person"><input name="contact" autoComplete="name" required placeholder="Full name" /></FormField>
            <FormField label="Email address"><input name="email" type="email" autoComplete="email" required placeholder="name@company.co.za" /></FormField>
            <FormField label="Telephone"><input name="phone" type="tel" autoComplete="tel" required placeholder="+27 ..." /></FormField>
            <FormField label="Area"><select name="area" required defaultValue=""><option value="" disabled>Select area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></FormField>
            <FormField label="Industry / field"><select name="industry" required defaultValue=""><option value="" disabled>Select your field</option>{industries.map(industry => <option key={industry}>{industry}</option>)}</select></FormField>
            <PasswordField name="password" label="Create password" show={showPassword} onToggle={() => setShowPassword(value => !value)} placeholder="Minimum 8 characters" />
            <label className="consent-row"><input name="consent" type="checkbox" required /><span>I agree to use this test preview and understand that its account data is stored on this device.</span></label>
            <p className="form-error" role="alert">{error}</p>
            <button className="primary-button full" type="submit">Create company account <span>→</span></button>
          </form>
        )}

        <p className="preview-note"><span>i</span> Public test preview: use sample data only and do not upload confidential Purchase Orders. Accounts and enquiry history are stored locally on this device.</p>
      </section>
    </main>
  );
}

function FormField({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function PasswordField({ name, label, show, onToggle, placeholder = 'Your password' }) {
  return (
    <FormField label={label}>
      <span className="password-wrap"><input name={name} type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder={placeholder} /><button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
    </FormField>
  );
}
