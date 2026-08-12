import { useState } from 'react';
import { isInternalAccount, roleProfileFor } from '../domain/accessControl.js';
import { friendlyServiceError } from '../services/contracts.js';
import { StatusBadge } from './StatusBadge.jsx';

export function Account({
  account,
  enquiries,
  onSignOut,
  serviceMode,
  onOpenSettings,
  personalisation,
  credentialActions,
  onCredentialChanged,
}) {
  const initials = account.contact.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const isStaff = isInternalAccount(account);
  const roleLabel = roleProfileFor(account.role).label;
  return (
    <section className="app-screen account-screen" aria-labelledby="account-title">
      <div className="profile-hero">
        <span className="profile-avatar">
          {personalisation?.profileImage?.previewUrl
            ? <img src={personalisation.profileImage.previewUrl} alt="" style={{ objectPosition: `${personalisation.profileImage.position?.x || 50}% ${personalisation.profileImage.position?.y || 50}%` }} />
            : initials}
        </span>
        <span className="eyebrow">{isStaff ? 'Internal role access' : 'Company account'}</span>
        <h1 id="account-title">{isStaff ? <>{roleLabel} <em>workspace</em></> : <>Your <em>workspace</em></>}</h1>
        <strong>{account.company}</strong>
        <small>{account.industry}</small>
      </div>
      <dl className="profile-details">
        <div><dt>Contact</dt><dd>{account.contact}</dd></div>
        <div><dt>Email</dt><dd>{account.email}</dd></div>
        <div><dt>Username</dt><dd>{account.signInName || 'Email sign-in'}</dd></div>
        <div><dt>Authentication</dt><dd>{account.authRealm === 'customer' ? 'Customer realm' : 'Internal staff realm'}</dd></div>
        <div><dt>Telephone</dt><dd>{account.phone}</dd></div>
        <div><dt>Area</dt><dd>{account.area}</dd></div>
      </dl>
      <section className="history-section">
        <div className="history-heading">
          <div><span className="eyebrow">{serviceMode === 'mock' ? 'Saved locally' : 'Company records'}</span><h2>{isStaff ? 'Visible order queue' : 'RFQ & order history'}</h2></div>
          <b>{enquiries.length}</b>
        </div>
        {enquiries.length
          ? <div className="history-list">{enquiries.slice(0, 10).map(enquiry => <HistoryRow key={enquiry.id} enquiry={enquiry} showCompany={isStaff} />)}</div>
          : <p className="empty-history">No quote requests saved yet.</p>}
      </section>
      {onOpenSettings && (
        <button className="account-settings-card" type="button" onClick={onOpenSettings}>
          <span>⚙</span><div><strong>Settings</strong><small>App, sounds, notifications, appearance, accessibility, security and help</small></div><i>›</i>
        </button>
      )}
      {credentialActions && (
        <CredentialChangePanel
          account={account}
          actions={credentialActions}
          serviceMode={serviceMode}
          onChanged={onCredentialChanged}
        />
      )}
      <button className="sign-out" type="button" onClick={onSignOut}>Sign out</button>
    </section>
  );
}

export function CredentialChangePanel({ account, actions, serviceMode, onChanged }) {
  const [changeType, setChangeType] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const request = async type => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await actions.requestVerification({ changeType: type });
      setChangeType(type);
      setChallenge(result);
      setCode('');
      setValue('');
      setMessage(`A verification code was ${serviceMode === 'mock' ? 'simulated' : 'sent'} to ${result.maskedEmail}.`);
    } catch (requestError) {
      setError(friendlyServiceError(requestError, 'The verification request could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await actions.confirmChange({
        challengeId: challenge.id,
        code,
        ...(changeType === 'username' ? { newUsername: value } : { newPassword: value }),
      });
      setChallenge(null);
      setCode('');
      setValue('');
      setMessage(changeType === 'password'
        ? 'Password changed. Your preview session has been closed.'
        : 'Username changed successfully.');
      await onChanged?.(result);
    } catch (confirmError) {
      setError(friendlyServiceError(confirmError, 'The credential change could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="credential-change-card" aria-labelledby="credential-change-title">
      <div>
        <span className="eyebrow">Account security</span>
        <h2 id="credential-change-title">Sign-in credentials</h2>
        <p>Username and password changes require a short-lived one-time code sent to {account.email}. Customer and internal staff authentication remain separate.</p>
      </div>
      {!challenge ? (
        <div className="credential-change-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => request('username')}>Change username</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => request('password')}>Change password</button>
        </div>
      ) : (
        <form onSubmit={confirm} className="credential-change-form">
          {serviceMode === 'mock' && (
            <p className="demo-verification-code">
              <strong>Mock email code</strong><span>{challenge.demoVerificationCode}</span><small>No real email was sent.</small>
            </p>
          )}
          <label><span>Six-digit verification code</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
          <label>
            <span>{changeType === 'username' ? 'New username' : 'New password'}</span>
            <input type={changeType === 'password' ? 'password' : 'text'} autoComplete="new-password" value={value} onChange={event => setValue(event.target.value)} required />
            {changeType === 'password' && <small>At least 10 characters with upper-case, lower-case, number and symbol.</small>}
          </label>
          <div><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Checking…' : `Confirm ${changeType} change`}</button><button className="text-button" type="button" disabled={busy} onClick={() => setChallenge(null)}>Cancel</button></div>
        </form>
      )}
      {(message || error) && <p className={`credential-change-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
    </section>
  );
}

function HistoryRow({ enquiry, showCompany }) {
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const date = new Date(enquiry.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <article className="history-row">
      <div>
        <strong>{showCompany ? enquiry.company : enquiry.reference}</strong>
        <small>{showCompany
          ? `${enquiry.reference} · ${enquiry.selectedRep?.name || 'Unassigned rep'}`
          : `${quantity ? `${quantity} unit${quantity === 1 ? '' : 's'}` : 'General enquiry'} · ${date}`}</small>
      </div>
      <StatusBadge status={enquiry.trackingStatus} label={enquiry.status || 'Preview saved'} />
    </article>
  );
}
