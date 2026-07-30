import {
  defaultViewForRole,
  isInternalRole,
  navigationItemsForRole,
} from '../domain/accessControl.js';

export function AppHeader({ account, onNavigate, onBack, backLabel, theme, onToggleTheme, serviceMode, preview, showThemeToggle = true, personalisation }) {
  const initials = account.contact.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <header className="app-header">
      {onBack ? (
        <button className="header-back" type="button" onClick={onBack} aria-label={backLabel || 'Go back'}><span>←</span></button>
      ) : (
        <button className="mini-brand" type="button" onClick={() => onNavigate(defaultViewForRole(account.role))} aria-label="Rhomberg home">
          <img src={personalisation?.companyLogo?.previewUrl || 'assets/images/rhomberg-gauge-mark.svg'} alt="" className={personalisation?.companyLogo?.previewUrl ? 'customer-company-logo' : ''} />
          <span><strong>RHOMBERG</strong><small>INSTRUMENTS</small></span>
        </button>
      )}
      {onBack && <span className="header-context">{backLabel || 'Catalogue'}</span>}
      <div className="header-tools">
        {showThemeToggle && <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><span>{theme === 'dark' ? '☀' : '☾'}</span></button>}
        {__PUBLIC_PREVIEW__ ? <a className="preview-status" href={preview?.executiveDemo ? '../../' : './'} title="Back to all test previews"><i /> {serviceMode === 'mock' ? 'Demo Preview' : 'Secure'}{preview?.platform ? ` · ${preview.platform}` : ''}</a> : <span className="preview-status"><i /> Secure</span>}
        <button className="header-avatar" type="button" onClick={() => onNavigate('account')} aria-label="Open account">{personalisation?.profileImage?.previewUrl ? <img src={personalisation.profileImage.previewUrl} alt="" style={{ objectPosition: `${personalisation.profileImage.position?.x || 50}% ${personalisation.profileImage.position?.y || 50}%` }} /> : initials}</button>
      </div>
    </header>
  );
}

export function BottomNav({ active, quantity, role, unreadCount = 0, onNavigate }) {
  const isStaff = isInternalRole(role);
  const items = navigationItemsForRole(role);
  return (
    <nav className={`bottom-nav ${isStaff ? 'expeditor-nav' : ''}`} aria-label="Main navigation" style={{ '--nav-item-count': items.length }}>
      {items.map(({ id, glyph, label }) => (
        <button key={id} type="button" className={`${active === id ? 'active' : ''} ${id === 'enquiry' ? 'nav-primary' : ''}`} onClick={() => onNavigate(id)}>
          <span className="nav-icon">{glyph}</span><small>{label}</small>
          {id === 'enquiry' && quantity > 0 && <b className="nav-badge">{quantity}</b>}
          {id === 'notifications' && unreadCount > 0 && <b className="nav-badge notification-nav-badge">{Math.min(unreadCount, 99)}</b>}
        </button>
      ))}
    </nav>
  );
}

export function LeadTimeNotice({ compact = false }) {
  return (
    <aside className={`lead-time-notice ${compact ? 'compact' : ''}`} aria-label="Lead time notice">
      <span className="lead-clock" aria-hidden="true">◷</span>
      <p><strong>Lead Time</strong><small>Orders are normally reviewed within 3–10 working days after receipt of your Purchase Order.</small></p>
    </aside>
  );
}

export function SectionHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="section-heading">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Toast({ message }) {
  return <div className={`toast ${message ? 'show' : ''}`} role="status"><span>✓</span><p>{message || 'Updated'}</p></div>;
}
