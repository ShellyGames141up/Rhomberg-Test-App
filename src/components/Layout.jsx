export function AppHeader({ account, onNavigate, onBack, backLabel, theme, onToggleTheme }) {
  const initials = account.contact.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <header className="app-header">
      {onBack ? (
        <button className="header-back" type="button" onClick={onBack} aria-label={backLabel || 'Go back'}><span>←</span></button>
      ) : (
        <button className="mini-brand" type="button" onClick={() => onNavigate(account.role === 'expeditor' ? 'expeditor' : 'home')} aria-label="Rhomberg home">
          <img src="assets/images/rhomberg-gauge-mark.svg" alt="" />
          <span><strong>RHOMBERG</strong><small>INSTRUMENTS</small></span>
        </button>
      )}
      {onBack && <span className="header-context">{backLabel || 'Catalogue'}</span>}
      <div className="header-tools">
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><span>{theme === 'dark' ? '☀' : '☾'}</span></button>
        <span className="preview-status"><i /> Test</span>
        <button className="header-avatar" type="button" onClick={() => onNavigate('account')} aria-label="Open account">{initials}</button>
      </div>
    </header>
  );
}

export function BottomNav({ active, quantity, role, onNavigate }) {
  const items = role === 'expeditor'
    ? [['expeditor', '↻', 'Orders'], ['account', '○', 'Account']]
    : [
      ['home', '⌂', 'Home'],
      ['catalogue', '◇', 'Catalogue'],
      ['enquiry', '+', 'Enquire'],
      ['tracking', '◎', 'Orders'],
      ['account', '○', 'Account'],
    ];
  return (
    <nav className={`bottom-nav ${role === 'expeditor' ? 'expeditor-nav' : ''}`} aria-label="Main navigation">
      {items.map(([id, glyph, label]) => (
        <button key={id} type="button" className={`${active === id ? 'active' : ''} ${id === 'enquiry' ? 'nav-primary' : ''}`} onClick={() => onNavigate(id)}>
          <span className="nav-icon">{glyph}</span><small>{label}</small>
          {id === 'enquiry' && quantity > 0 && <b className="nav-badge">{quantity}</b>}
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
