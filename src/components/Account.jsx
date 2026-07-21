export function Account({ account, enquiries, onSignOut, serviceMode }) {
  const initials = account.contact.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const isStaff = account.role !== 'customer';
  const roleLabel = account.role.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
  return (
    <section className="app-screen account-screen" aria-labelledby="account-title">
      <div className="profile-hero"><span className="profile-avatar">{initials}</span><span className="eyebrow">{isStaff ? 'Internal role access' : 'Company account'}</span><h1 id="account-title">{isStaff ? <>{roleLabel} <em>workspace</em></> : <>Your <em>workspace</em></>}</h1><strong>{account.company}</strong><small>{account.industry}</small></div>
      <dl className="profile-details"><div><dt>Contact</dt><dd>{account.contact}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Telephone</dt><dd>{account.phone}</dd></div><div><dt>Area</dt><dd>{account.area}</dd></div></dl>
      <section className="history-section"><div className="history-heading"><div><span className="eyebrow">{serviceMode === 'mock' ? 'Saved locally' : 'Company records'}</span><h2>{isStaff ? 'Visible order queue' : 'RFQ & order history'}</h2></div><b>{enquiries.length}</b></div>{enquiries.length ? <div className="history-list">{enquiries.slice(0, 10).map(enquiry => <HistoryRow key={enquiry.id} enquiry={enquiry} showCompany={isStaff} />)}</div> : <p className="empty-history">No quote requests saved yet.</p>}</section>
      <div className="account-preview-note"><span>i</span><div><strong>{serviceMode === 'mock' ? 'Same-device test storage' : 'Secure service account'}</strong><p>{serviceMode === 'mock' ? (isStaff ? 'Updates made here are visible to test customer accounts in this browser. Production will use the prepared secure API and staff roles.' : 'This account, its RFQs and order updates remain available after closing and reopening this browser. Production will move them to secure domain storage.') : 'The private-cloud API is responsible for identity, role checks and company-level record isolation.'}</p></div></div>
      <button className="sign-out" type="button" onClick={onSignOut}>Sign out</button>
    </section>
  );
}

function HistoryRow({ enquiry, showCompany }) {
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const date = new Date(enquiry.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  return <article className="history-row"><div><strong>{showCompany ? enquiry.company : enquiry.reference}</strong><small>{showCompany ? `${enquiry.reference} · ${enquiry.selectedRep?.name || 'Unassigned rep'}` : `${quantity ? `${quantity} unit${quantity === 1 ? '' : 's'}` : 'General enquiry'} · ${date}`}</small></div><span>{enquiry.status || 'Preview saved'}</span></article>;
}
