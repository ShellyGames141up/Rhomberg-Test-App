import { useEffect, useMemo, useState } from 'react';
import { friendlyServiceError } from '../services/contracts.js';
import { MockAdministrationControls } from './MockAdministrationControls.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export function AdministratorDashboard({
  account,
  administrationActions,
  serviceMode,
  onOpenManagement,
  onOpenAudit,
  onOpenArchive,
  onRecordsChanged,
}) {
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setOverview(await administrationActions.getOverview());
    } catch (loadError) {
      setError(friendlyServiceError(loadError, 'Administration data could not be loaded.'));
    }
  };

  useEffect(() => { load(); }, []);

  const users = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (overview?.users || []).filter(user => !term || [
      user.contact, user.email, user.company, user.role, user.area,
    ].some(value => String(value || '').toLowerCase().includes(term)));
  }, [overview, query]);

  const run = async (key, operation, success) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await operation();
      await load();
      await onRecordsChanged?.();
      setMessage(success);
    } catch (runError) {
      setError(friendlyServiceError(runError, 'The administrator action could not be completed.'));
    } finally {
      setBusy('');
    }
  };

  const setAccountStatus = user => run(
    `status-${user.id}`,
    () => administrationActions.setAccountStatus(user.id, user.status === 'suspended' ? 'active' : 'suspended'),
    `${user.contact} is now ${user.status === 'suspended' ? 'active' : 'suspended'}.`,
  );

  const assignRepresentative = (companyId, representativeId) => run(
    `assignment-${companyId}`,
    () => administrationActions.assignRepresentative(companyId, representativeId),
    'The customer-company representative assignment was updated.',
  );

  return (
    <section className="app-screen operations-desktop administrator-screen" aria-labelledby="administrator-title">
      <header className="operations-hero administrator-hero">
        <div>
          <span className="eyebrow">{serviceMode === 'mock' ? 'Fabricated data · ' : ''}Administration</span>
          <h1 id="administrator-title">Platform control.<br /><em>One accountable view.</em></h1>
          <p>Manage authorised accounts, company assignments and operational configuration through the shared permission and audit services.</p>
        </div>
        <div className="operations-owner"><span>{account.contact}</span><small>Administrator · Internal desktop</small></div>
      </header>

      {overview && (
        <div className="operations-metrics administrator-metrics">
          <Metric label="Users" value={overview.summary.users} />
          <Metric label="Customer companies" value={overview.summary.customerCompanies} />
          <Metric label="Internal accounts" value={overview.summary.internalAccounts} />
          <Metric label="RFQs / orders" value={`${overview.summary.rfqs} / ${overview.summary.orders}`} />
          <Metric label="Audit events" value={overview.summary.auditEvents} />
          <Metric label="Documents" value={overview.summary.documents} />
        </div>
      )}

      <nav className="administrator-tabs" aria-label="Administration sections">
        {[
          ['overview', 'Overview'],
          ['users', 'Accounts'],
          ['companies', 'Companies'],
          ['roles', 'Roles & permissions'],
          ['configuration', 'Operational setup'],
          ['integrations', 'IT integrations'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
      {!overview && !error && <div className="operations-empty"><strong>Loading administration</strong><p>Preparing the permission-controlled platform overview.</p></div>}

      {overview && tab === 'overview' && (
        <div className="administrator-overview-grid">
          <article className="administrator-panel">
            <span className="eyebrow">Workflow control</span>
            <h2>Operational oversight</h2>
            <p>Open the existing management dashboard for workflow measures, representative reassignment, approved overrides and report exports.</p>
            <div className="administrator-action-row">
              <button className="primary-button" type="button" onClick={onOpenManagement}>Open management</button>
              <button className="secondary-button" type="button" onClick={onOpenAudit}>Audit history</button>
              <button className="secondary-button" type="button" onClick={onOpenArchive}>Archive controls</button>
            </div>
          </article>
          <article className="administrator-panel">
            <span className="eyebrow">Delivery simulation</span>
            <h2>Notifications & documents</h2>
            <dl className="administrator-definition-list">
              {Object.entries(overview.notificationDeliveryStatus).map(([status, count]) => <div key={status}><dt>{humanise(status)}</dt><dd>{count}</dd></div>)}
              <div><dt>Registered documents</dt><dd>{overview.summary.documents}</dd></div>
            </dl>
          </article>
          <article className="administrator-panel">
            <span className="eyebrow">Retention</span>
            <h2>Archive policy</h2>
            <dl className="administrator-definition-list">
              {Object.entries(overview.retentionPolicy || {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).slice(0, 6).map(([key, value]) => <div key={key}><dt>{humanise(key)}</dt><dd>{String(value)}</dd></div>)}
            </dl>
          </article>
          <MockAdministrationControls busy={busy} onRun={run} administrationActions={administrationActions} />
        </div>
      )}

      {overview && tab === 'users' && (
        <section className="administrator-panel">
          <div className="operations-section-title"><div><span className="eyebrow">Customer and internal identities</span><h2>Authorised accounts</h2></div><small>{users.length} matching</small></div>
          <label className="administrator-search"><span>Search accounts</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, company, email, role or area…" /></label>
          <div className="administrator-table-wrap">
            <table className="administrator-table">
              <thead><tr><th>User</th><th>Company</th><th>Role</th><th>Realm</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td><strong>{user.contact}</strong><small>{user.email}</small></td>
                    <td>{user.company}</td>
                    <td>{humanise(user.role)}</td>
                    <td>{user.category}</td>
                    <td><StatusBadge status={user.status} label={humanise(user.status)} className="status-pill" /></td>
                    <td><button className="text-button" type="button" disabled={Boolean(busy) || user.id === account.id} onClick={() => setAccountStatus(user)}>{user.status === 'suspended' ? 'Activate' : 'Suspend'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {overview && tab === 'companies' && (
        <section className="administrator-card-grid">
          {overview.companies.map(company => (
            <article className="administrator-panel" key={company.id}>
              <span className="eyebrow">{company.area}</span>
              <h2>{company.name}</h2>
              <p>{company.industry} · {company.contacts} authorised contact{company.contacts === 1 ? '' : 's'}</p>
              <label><span>Assigned representative</span>
                <select value={company.representativeId} disabled={Boolean(busy)} onChange={event => assignRepresentative(company.id, event.target.value)}>
                  <option value="">Choose representative</option>
                  {overview.representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · {rep.branch}</option>)}
                </select>
              </label>
            </article>
          ))}
        </section>
      )}

      {overview && tab === 'roles' && (
        <section className="administrator-card-grid role-permission-grid">
          {overview.roles.map(role => (
            <article className="administrator-panel" key={role.id}>
              <span className="eyebrow">{role.permissions.length} permissions</span>
              <h2>{role.label}</h2>
              <div className="administrator-token-list">{role.permissions.map(permission => <span key={permission}>{humanise(permission)}</span>)}</div>
            </article>
          ))}
        </section>
      )}

      {overview && tab === 'configuration' && (
        <section className="administrator-card-grid">
          {Object.entries(overview.configurations).map(([department, configuration]) => (
            <article className="administrator-panel" key={department}>
              <span className="eyebrow">Controlled reference data</span>
              <h2>{humanise(department)}</h2>
              {Object.entries(configuration).map(([key, values]) => (
                <div className="administrator-config-row" key={key}><strong>{humanise(key)}</strong><span>{values.map(humanise).join(' · ')}</span></div>
              ))}
            </article>
          ))}
          <article className="administrator-panel">
            <span className="eyebrow">Branch directory</span>
            <h2>Production locations</h2>
            {overview.branches.map(branch => <div className="administrator-config-row" key={branch.id}><strong>{branch.name}</strong><span>{branch.role}</span></div>)}
          </article>
        </section>
      )}

      {overview && tab === 'integrations' && (
        <section className="administrator-panel">
          <span className="eyebrow">Production placeholders</span>
          <h2>IT-managed services still required</h2>
          <div className="administrator-integration-list">
            {overview.integrationPlaceholders.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong><small>Not connected in this browser-local preview</small></div>)}
          </div>
        </section>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <article><strong>{value ?? 0}</strong><span>{label}</span></article>;
}
