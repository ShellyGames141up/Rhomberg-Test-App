import { useState } from 'react';

export function Auth({ onSignIn, onCreateAccount, theme, onToggleTheme, registrationOptions, demoLogins, serviceMode }) {
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const areas = registrationOptions?.areas || [];
  const industries = registrationOptions?.industries || [];

  const resetErrors = () => {
    setError('');
    setFieldErrors({});
  };

  const submitSignIn = async event => {
    event.preventDefault();
    resetErrors();
    setIsSubmitting(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await onSignIn(data.email, data.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors || {});
    }
  };

  const submitRegister = async event => {
    event.preventDefault();
    resetErrors();
    setIsSubmitting(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await onCreateAccount(data);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors || {});
    }
  };

  const useDemo = async login => {
    resetErrors();
    setIsSubmitting(true);
    const result = await onSignIn(login.email, login.password);
    setIsSubmitting(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <main className="auth-view">
      <button className="auth-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><span>{theme === 'dark' ? '☀' : '☾'}</span>{theme === 'dark' ? 'Light' : 'Dark'}</button>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img src="assets/images/rhomberg-gauge-mark.svg" alt="" />
          <img src="assets/images/rhomberg-wordmark-transparent.png" alt="Rhomberg Instruments" />
        </div>
        <span className="preview-chip">{serviceMode === 'mock' ? 'Public test preview' : 'Private company service'}</span>
        <h1 id="auth-title">{tab === 'signin' ? <>Welcome to Rhomberg<br /><em>Instruments.</em></> : <>Create your company<br /><em>workspace.</em></>}</h1>
        <p className="auth-intro">Find the right instrument, submit clear RFQs and follow every saved request or order from one place.</p>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'active' : ''} onClick={() => { setTab('signin'); resetErrors(); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); resetErrors(); }}>Create account</button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={submitSignIn} noValidate>
            <FormField label="Email address" error={fieldErrors.email}><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} placeholder="name@company.co.za" /></FormField>
            <PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(value => !value)} error={fieldErrors.password} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'} <span>{isSubmitting ? '•••' : '→'}</span></button>
            {demoLogins.map(login => (
              <div className="demo-login-wrap" key={login.id}>
                <button className={`demo-account ${!login.id.includes('customer') ? 'internal-demo' : ''}`} type="button" disabled={isSubmitting} onClick={() => useDemo(login)}>
                  <span className="demo-avatar">{login.avatar}</span><span><strong>{login.label}</strong><small>{login.description}</small></span><i>›</i>
                </button>
                <p className="demo-credentials">{login.id.includes('customer') ? 'Customer demo' : 'Internal test'}: {login.email} · {login.password}</p>
              </div>
            ))}
          </form>
        ) : (
          <form className="auth-form register-grid" onSubmit={submitRegister} noValidate>
            <FormField label="Company name" error={fieldErrors.company}><input name="company" required aria-invalid={Boolean(fieldErrors.company)} placeholder="Your company" /></FormField>
            <FormField label="Contact person" error={fieldErrors.contact}><input name="contact" autoComplete="name" required aria-invalid={Boolean(fieldErrors.contact)} placeholder="Full name" /></FormField>
            <FormField label="Email address" error={fieldErrors.email}><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} placeholder="name@company.co.za" /></FormField>
            <FormField label="Telephone" error={fieldErrors.phone}><input name="phone" type="tel" autoComplete="tel" required aria-invalid={Boolean(fieldErrors.phone)} placeholder="+27 ..." /></FormField>
            <FormField label="Area" error={fieldErrors.area}><select name="area" required defaultValue="" aria-invalid={Boolean(fieldErrors.area)}><option value="" disabled>Select area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></FormField>
            <FormField label="Industry / field" error={fieldErrors.industry}><select name="industry" required defaultValue="" aria-invalid={Boolean(fieldErrors.industry)}><option value="" disabled>Select your field</option>{industries.map(industry => <option key={industry}>{industry}</option>)}</select></FormField>
            <PasswordField name="password" label="Create password" show={showPassword} onToggle={() => setShowPassword(value => !value)} placeholder="Minimum 8 characters" error={fieldErrors.password} />
            <label className="consent-row"><input name="consent" type="checkbox" required /><span>I agree to use this test preview and understand that its account data is stored on this device.</span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create company account'} <span>{isSubmitting ? '•••' : '→'}</span></button>
          </form>
        )}

        <p className="preview-note"><span>i</span> {serviceMode === 'mock' ? 'Public test preview: use sample data only and do not upload confidential Purchase Orders. Accounts, RFQs and order updates are stored locally on this device.' : 'Private-cloud mode: access is controlled by the company service. Contact IT if you cannot access your authorised company.'}</p>
      </section>
    </main>
  );
}

function FormField({ label, error, children }) {
  return <label className={`form-field ${error ? 'has-error' : ''}`}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>;
}

function PasswordField({ name, label, show, onToggle, placeholder = 'Your password', error }) {
  return (
    <FormField label={label} error={error}>
      <span className="password-wrap"><input name={name} type={show ? 'text' : 'password'} autoComplete={name === 'password' && label.startsWith('Create') ? 'new-password' : 'current-password'} required aria-invalid={Boolean(error)} placeholder={placeholder} /><button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
    </FormField>
  );
}
