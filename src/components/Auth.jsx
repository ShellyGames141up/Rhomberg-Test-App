import { useState } from 'react';
import { previewNavigationAllowed } from '../shared/platform/previewConfig.js';

export function Auth({
  onSignIn,
  onCreateAccount,
  theme,
  onToggleTheme,
  registrationOptions,
  serviceMode,
  preview,
  allowRegistration = true,
  accessError = '',
}) {
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const areas = registrationOptions?.areas || [];
  const industries = registrationOptions?.industries || [];
  const showPreviewNavigation = previewNavigationAllowed({ publicPreview: __PUBLIC_PREVIEW__, preview });

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

  return (
    <main className="auth-view">
      <button className="auth-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><span>{theme === 'dark' ? '☀' : '☾'}</span>{theme === 'dark' ? 'Light' : 'Dark'}</button>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img src="assets/images/rhomberg-connect-logo-full-dark.png" alt="Rhomberg Connect" />
        </div>
        {__PUBLIC_PREVIEW__ && showPreviewNavigation && <span className="preview-chip">Demo Preview{preview?.platform ? ` · ${preview.platform}` : ''}</span>}
        <h1 id="auth-title">{tab === 'signin' ? <>Welcome to {preview?.product || 'Rhomberg'}<br /><em>{preview?.platform || 'Instruments'}.</em></> : <>Create your company<br /><em>workspace.</em></>}</h1>
        <p className="auth-intro">{preview?.customer ? 'Browse instruments, submit RFQs and follow customer-safe order progress.' : preview?.internal ? 'Open the authorised operational queue for your role and continue controlled workflow actions.' : 'Find the right instrument, submit clear RFQs and follow every saved request or order from one place.'}</p>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'active' : ''} onClick={() => { setTab('signin'); resetErrors(); }}>Sign in</button>
          {allowRegistration && <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); resetErrors(); }}>Create account</button>}
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={submitSignIn} noValidate>
            <FormField label="Email or sign-in name" error={fieldErrors.email}><input name="email" type="text" autoComplete="username" required aria-invalid={Boolean(fieldErrors.email)} placeholder="name@company.co.za or username" /></FormField>
            <PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(value => !value)} error={fieldErrors.password} />
            {(error || accessError) && <p className="form-error" role="alert">{error || accessError}</p>}
            <button className="primary-button full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'} <span>{isSubmitting ? '•••' : '→'}</span></button>
            <div className="auth-help-actions"><button type="button" onClick={() => { resetErrors(); setError(__PUBLIC_PREVIEW__ && serviceMode === 'mock' ? 'Demo password recovery is not connected. Use the fabricated credentials shown only in the Preview Centre.' : 'Contact your authorised Rhomberg administrator to recover or activate your account.'); }}>Forgot password?</button>{allowRegistration && <button type="button" onClick={() => { setTab('register'); resetErrors(); }}>Activate or create customer account</button>}</div>
          </form>
        ) : allowRegistration ? (
          <form className="auth-form register-grid" onSubmit={submitRegister} noValidate>
            <FormField label="Company name" error={fieldErrors.company}><input name="company" required aria-invalid={Boolean(fieldErrors.company)} placeholder="Your company" /></FormField>
            <FormField label="Contact person" error={fieldErrors.contact}><input name="contact" autoComplete="name" required aria-invalid={Boolean(fieldErrors.contact)} placeholder="Full name" /></FormField>
            <FormField label="Email address" error={fieldErrors.email}><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} placeholder="name@company.co.za" /></FormField>
            <FormField label="Telephone" error={fieldErrors.phone}><input name="phone" type="tel" autoComplete="tel" required aria-invalid={Boolean(fieldErrors.phone)} placeholder="+27 ..." /></FormField>
            <FormField label="Area" error={fieldErrors.area}><select name="area" required defaultValue="" aria-invalid={Boolean(fieldErrors.area)}><option value="" disabled>Select area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></FormField>
            <FormField label="Industry / field" error={fieldErrors.industry}><select name="industry" required defaultValue="" aria-invalid={Boolean(fieldErrors.industry)}><option value="" disabled>Select your field</option>{industries.map(industry => <option key={industry}>{industry}</option>)}</select></FormField>
            <PasswordField name="password" label="Create password" show={showPassword} onToggle={() => setShowPassword(value => !value)} placeholder="16+ characters with mixed character types" error={fieldErrors.password} />
            <label className="consent-row"><input name="consent" type="checkbox" required /><span>I confirm these company details are correct and agree to the authorised use of Rhomberg Connect.</span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create customer account'} <span>{isSubmitting ? '•••' : '→'}</span></button>
          </form>
        ) : null}

        <p className="preview-note"><span>i</span> {preview?.unified ? 'Use your authorised Rhomberg Connect account. Contact your administrator if you need access.' : __PUBLIC_PREVIEW__ && serviceMode === 'mock' ? 'Demonstration environment: use fabricated data only.' : 'Access is controlled by the company service. Contact IT if you cannot access your authorised company.'}</p>
        {__PUBLIC_PREVIEW__ && showPreviewNavigation && <a className="preview-back-link" href="./">Back to all test previews</a>}
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
