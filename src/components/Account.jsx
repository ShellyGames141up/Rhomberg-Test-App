export function Account({ account, enquiries, onSignOut }) {
  const initials = account.contact.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <section className="app-screen account-screen" aria-labelledby="account-title">
      <div className="profile-hero"><span className="profile-avatar">{initials}</span><span className="eyebrow">Company account</span><h1 id="account-title">Your <em>workspace</em></h1><strong>{account.company}</strong><small>{account.industry}</small></div>
      <dl className="profile-details"><div><dt>Contact</dt><dd>{account.contact}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Telephone</dt><dd>{account.phone}</dd></div><div><dt>Area</dt><dd>{account.area}</dd></div></dl>
      <section className="history-section"><div className="history-heading"><div><span className="eyebrow">Saved locally</span><h2>Quote request history</h2></div><b>{enquiries.length}</b></div>{enquiries.length ? <div className="history-list">{enquiries.slice(0, 10).map(enquiry => <HistoryRow key={enquiry.id} enquiry={enquiry} />)}</div> : <p className="empty-history">No quote requests saved yet.</p>}</section>
      <div className="account-preview-note"><span>i</span><div><strong>Internal preview storage</strong><p>This account and its enquiry history are stored only in this browser. Production will move them to secure domain storage.</p></div></div>
      <button className="sign-out" type="button" onClick={onSignOut}>Sign out</button>
    </section>
  );
}

function HistoryRow({ enquiry }) {
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const date = new Date(enquiry.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  return <article className="history-row"><div><strong>{enquiry.reference}</strong><small>{quantity ? `${quantity} unit${quantity === 1 ? '' : 's'}` : 'General enquiry'} · {date}</small></div><span>{enquiry.status || 'Preview saved'}</span></article>;
}
