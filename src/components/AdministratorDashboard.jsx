import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { accountCan, friendlyServiceError, PERMISSIONS, USER_ROLES } from '../services/contracts.js';
import { MockAdministrationControls } from './MockAdministrationControls.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const emptyDialog = () => ({ mode: '', target: null, values: {}, reason: '', verification: '' });

export function AdministratorDashboard({ account, administrationActions, serviceMode, onOpenManagement, onOpenAudit, onOpenArchive, onRecordsChanged }) {
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(emptyDialog);

  const load = async () => {
    setError('');
    try { setOverview(await administrationActions.getOverview()); }
    catch (loadError) { setError(friendlyServiceError(loadError, 'Administration data could not be loaded.')); }
  };
  useEffect(() => { load(); }, [account.id]);

  const run = async (key, operation, success) => {
    setBusy(key); setError(''); setMessage('');
    try {
      await operation(); await load(); await onRecordsChanged?.(); setDialog(emptyDialog()); setMessage(success);
    } catch (runError) { setError(friendlyServiceError(runError, 'The administrator action could not be completed.')); }
    finally { setBusy(''); }
  };

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (overview?.users || []).filter(user => statusFilter === 'all' || user.status === statusFilter).filter(user => !term || [
      user.contact, user.email, user.signInName, user.company, user.role, user.area, user.phone,
    ].some(value => String(value || '').toLowerCase().includes(term)));
  }, [overview, query, statusFilter]);

  const openUser = user => setDialog({ mode: 'user', target: user, values: { contact: user.contact, email: user.email, signInName: user.signInName || '', phone: user.phone || '', area: user.area || '', branchId: user.branchId || '', role: user.role }, reason: '', verification: '' });
  const openCompany = company => setDialog({ mode: 'company', target: company, values: { name: company.name, area: company.area, industry: company.industry, branchId: company.branchId || '' }, reason: '', verification: '' });
  const openRepresentative = company => setDialog({ mode: 'representative', target: company, values: { representativeId: company.representativeId || '' }, reason: '', verification: '' });
  const openPermissions = user => setDialog({ mode: 'permissions', target: user, values: { permissions: [...(user.permissions || [])] }, reason: '', verification: '' });
  const openNotifications = user => setDialog({ mode: 'notifications', target: user, values: structuredClone(user.notificationPreferences), reason: '', verification: '' });
  const openCatalogue = (kind, item) => setDialog({ mode: 'catalogue', target: { ...item, kind }, values: { ...item }, reason: '', verification: '' });
  const openCorrection = record => setDialog({ mode: 'correction', target: record, values: { contact: record.contact || '', internalJobNumber: record.internalJobNumber || '', customerPoNumber: record.customerPoNumber || '' }, reason: '', verification: '' });
  const openStatus = user => setDialog({ mode: 'status', target: user, values: { status: user.status === 'suspended' ? 'active' : 'suspended' }, reason: '', verification: '' });

  const submitDialog = () => {
    const { mode, target, values, reason, verification } = dialog;
    if (mode === 'user') return run(`user-${target.id}`, () => administrationActions.updateAccount(target.id, { values, reason, verification }), 'The account details were updated and audited.');
    if (mode === 'company') return run(`company-${target.id}`, () => administrationActions.updateCompany(target.id, { values, reason }), 'The customer company was updated and audited.');
    if (mode === 'representative') return run(`rep-${target.id}`, () => administrationActions.assignRepresentative(target.id, { representativeId: values.representativeId, reason }), 'The dedicated representative assignment was updated.');
    if (mode === 'permissions') return run(`permissions-${target.id}`, () => administrationActions.setAccountPermissions(target.id, { permissions: values.permissions, reason, verification }), 'The internal permissions were updated and audited.');
    if (mode === 'notifications') return run(`notifications-${target.id}`, () => administrationActions.updateNotificationPreferences(target.id, { preferences: values, reason }), 'The notification preferences were updated.');
    if (mode === 'catalogue') return run(`catalogue-${target.id}`, () => administrationActions.saveCatalogueItem(target.kind, target.id, { values, reason }), 'The catalogue item was updated and audited.');
    if (mode === 'correction') {
      const allowed = target.workflowType === 'order' ? ['contact', 'internalJobNumber', 'customerPoNumber'] : ['contact'];
      const correctionValues = Object.fromEntries(allowed.filter(key => String(values[key] || '').trim() && String(values[key] || '').trim() !== String(target[key] || '').trim()).map(key => [key, values[key]]));
      return run(`correction-${target.id}`, () => administrationActions.correctRecord(target.id, { values: correctionValues, reason, verification, expectedVersion: target.version }), 'The approved correction was appended to the audit history.');
    }
    if (mode === 'status') return run(`status-${target.id}`, () => administrationActions.setAccountStatus(target.id, { status: values.status, reason, verification }), `The account is now ${values.status}.`);
    return undefined;
  };

  const customerUsers = filteredUsers.filter(user => user.category === 'customer');
  const internalUsers = filteredUsers.filter(user => user.category === 'internal');
  const tabs = [
    ['overview', 'Overview'], ['customers', 'Customers'], ['staff', 'Internal staff'], ['companies', 'Companies'],
    ['catalogue', 'Catalogue'], ['roles', 'Roles & permissions'], ['records', 'Corrections & archive'], ['configuration', 'Platform setup'],
  ];

  return (
    <section className="app-screen operations-desktop administrator-screen" aria-labelledby="administrator-title">
      <header className="operations-hero administrator-hero"><div><span className="eyebrow">{serviceMode === 'mock' ? 'Fabricated data · ' : ''}Secure administration</span><h1 id="administrator-title">Platform control.<br /><em>Every change accountable.</em></h1><p>Manage approved customer, staff, catalogue and workflow reference data through permission-controlled services. Immutable history and signed records remain protected.</p></div><div className="operations-owner"><span>{account.contact}</span><small>Administrator · Internal desktop</small></div></header>

      {overview && <div className="operations-metrics administrator-metrics"><Metric label="Users" value={overview.summary.users} /><Metric label="Customer companies" value={overview.summary.customerCompanies} /><Metric label="Internal accounts" value={overview.summary.internalAccounts} /><Metric label="Archived records" value={overview.archivedRecords.length} /><Metric label="Audit events" value={overview.summary.auditEvents} /><Metric label="Catalogue products" value={overview.catalogue.products.length} /></div>}

      <nav className="administrator-tabs" aria-label="Administration sections">{tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
      {!overview && !error && <div className="operations-empty"><strong>Loading secure administration</strong><p>Preparing the permission-controlled platform overview.</p></div>}

      {overview && tab === 'overview' && <div className="administrator-overview-grid">
        <article className="administrator-panel"><span className="eyebrow">Protected operations</span><h2>Controlled administration</h2><p>Components never write browser storage directly. Each confirmed change goes through the administration service, validates scope and appends immutable before-and-after evidence.</p><div className="administrator-action-row"><button className="primary-button" type="button" onClick={onOpenManagement}>Management dashboard</button><button className="secondary-button" type="button" onClick={onOpenAudit}>Audit history</button><button className="secondary-button" type="button" onClick={onOpenArchive}>Archive controls</button></div></article>
        <article className="administrator-panel"><span className="eyebrow">Safety boundaries</span><h2>Administrators cannot</h2><ul><li>Edit signed certificates or quotation history</li><li>Alter immutable audit events</li><li>Delete active orders</li><li>Change workflow status through corrections</li><li>Override workflow without separate authority</li></ul></article>
        <article className="administrator-panel"><span className="eyebrow">Delivery simulation</span><h2>Notification channels</h2><dl className="administrator-definition-list">{Object.entries(overview.notificationDeliveryStatus).map(([status, count]) => <div key={status}><dt>{humanise(status)}</dt><dd>{count}</dd></div>)}</dl></article>
        <MockAdministrationControls busy={busy} onRun={run} administrationActions={administrationActions} />
      </div>}

      {overview && ['customers', 'staff'].includes(tab) && <AccountTable title={tab === 'customers' ? 'Customer contacts and sign-in identities' : 'Internal staff accounts'} users={tab === 'customers' ? customerUsers : internalUsers} query={query} onQuery={setQuery} status={statusFilter} onStatus={setStatusFilter} account={account} canEdit={tab === 'customers' ? accountCan(account, PERMISSIONS.MANAGE_CUSTOMER_CONTACTS) : accountCan(account, PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS)} canPermissions={tab === 'staff' && accountCan(account, PERMISSIONS.MANAGE_ROLES_PERMISSIONS)} canNotifications={accountCan(account, PERMISSIONS.MANAGE_NOTIFICATION_PREFERENCES)} onEdit={openUser} onStatusAction={openStatus} onPermissions={openPermissions} onNotifications={openNotifications} />}

      {overview && tab === 'companies' && <section className="administrator-card-grid">{overview.companies.map(company => <article className="administrator-panel" key={company.id}><span className="eyebrow">{company.area}</span><h2>{company.name}</h2><p>{company.industry} · {company.contacts} authorised contact{company.contacts === 1 ? '' : 's'}</p><dl className="administrator-definition-list"><div><dt>Branch</dt><dd>{overview.branches.find(branch => branch.id === company.branchId)?.name || 'Not assigned'}</dd></div><div><dt>Representative</dt><dd>{overview.representatives.find(rep => rep.id === company.representativeId)?.name || 'Not assigned'}</dd></div></dl>{accountCan(account, PERMISSIONS.MANAGE_CUSTOMER_COMPANIES) && <div className="administrator-action-row"><button className="secondary-button" type="button" onClick={() => openCompany(company)}>Edit company</button><button className="text-button" type="button" onClick={() => openRepresentative(company)}>Assign representative</button></div>}</article>)}</section>}

      {overview && tab === 'catalogue' && <section className="administrator-catalogue-grid"><div className="administrator-panel"><span className="eyebrow">Product categories</span><h2>Approved navigation</h2>{overview.catalogue.categories.map(item => <AdminListRow key={item.id} title={item.name} detail={`${item.number} · ${humanise(item.status)}`} onEdit={accountCan(account, PERMISSIONS.MANAGE_PRODUCTS) ? () => openCatalogue('category', item) : null} />)}</div><div className="administrator-panel"><span className="eyebrow">Product catalogue</span><h2>Customer-visible information</h2><label className="administrator-search"><span>Find a product</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Code, name or category…" /></label>{overview.catalogue.products.filter(item => !query || `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())).slice(0, 60).map(item => <AdminListRow key={item.id} title={`${item.code} · ${item.name}`} detail={`${humanise(item.category)} · ${humanise(item.status)}`} onEdit={accountCan(account, PERMISSIONS.MANAGE_PRODUCTS) ? () => openCatalogue('product', item) : null} />)}</div></section>}

      {overview && tab === 'roles' && <section className="administrator-card-grid role-permission-grid">{overview.roles.map(role => <article className="administrator-panel" key={role.id}><span className="eyebrow">{role.permissions.length} default permissions</span><h2>{role.label}</h2><div className="administrator-token-list">{role.permissions.map(permission => <span key={permission}>{humanise(permission)}</span>)}</div></article>)}</section>}

      {overview && tab === 'records' && <div className="administrator-catalogue-grid"><section className="administrator-panel"><span className="eyebrow">Approved corrections only</span><h2>RFQ and order references</h2><p>Corrections create new audit evidence. Workflow status, signed certificates, quotation versions and historical events are blocked.</p>{overview.correctionRecords.slice(0, 80).map(record => <AdminListRow key={record.id} title={`${record.reference} · ${record.company}`} detail={`${humanise(record.workflowType)} · ${humanise(record.trackingStatus)}`} onEdit={accountCan(account, PERMISSIONS.CORRECT_APPROVED_RECORDS) ? () => openCorrection(record) : null} />)}</section><section className="administrator-panel"><span className="eyebrow">Retention controls</span><h2>{overview.archivedRecords.length} archived records</h2>{overview.archivedRecords.map(record => <AdminListRow key={record.id} title={record.reference} detail={`${record.company} · ${record.legalHold ? 'Legal hold' : 'No legal hold'}`} />)}<button className="primary-button" type="button" onClick={onOpenArchive}>Open archive management</button></section></div>}

      {overview && tab === 'configuration' && <section className="administrator-card-grid">{Object.entries(overview.configurations).map(([department, configuration]) => <article className="administrator-panel" key={department}><span className="eyebrow">Controlled reference data</span><h2>{humanise(department)}</h2>{Object.entries(configuration).map(([key, values]) => <div className="administrator-config-row" key={key}><strong>{humanise(key)}</strong><span>{values.map(humanise).join(' · ')}</span></div>)}</article>)}<article className="administrator-panel"><span className="eyebrow">Branch directory</span><h2>Production locations</h2>{overview.branches.map(branch => <div className="administrator-config-row" key={branch.id}><strong>{branch.name}</strong><span>{branch.role}</span></div>)}</article></section>}

      {dialog.mode && createPortal(<AdministrationDialog dialog={dialog} onChange={setDialog} overview={overview} busy={busy} onCancel={() => setDialog(emptyDialog())} onSubmit={submitDialog} />, document.body)}
    </section>
  );
}

function AccountTable({ title, users, query, onQuery, status, onStatus, account, canEdit, canPermissions, canNotifications, onEdit, onStatusAction, onPermissions, onNotifications }) {
  return <section className="administrator-panel"><div className="operations-section-title"><div><span className="eyebrow">Separated identity realm</span><h2>{title}</h2></div><small>{users.length} matching</small></div><div className="administrator-filter-row"><label className="administrator-search"><span>Search accounts</span><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Name, company, username, email or phone…" /></label><label><span>Status</span><select value={status} onChange={event => onStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label></div><div className="administrator-table-wrap"><table className="administrator-table"><thead><tr><th>User</th><th>Company / branch</th><th>Role</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.contact}</strong><small>{user.signInName || 'No username'}<br />{user.email}</small></td><td>{user.company}<small>{user.area}</small></td><td>{humanise(user.role)}</td><td>{user.phone || 'Not recorded'}</td><td><StatusBadge status={user.status} label={humanise(user.status)} className="status-pill" /></td><td><div className="administrator-row-actions">{canEdit && <button className="text-button" type="button" onClick={() => onEdit(user)}>Edit</button>}{canNotifications && <button className="text-button" type="button" onClick={() => onNotifications(user)}>Notifications</button>}{canPermissions && user.id !== account.id && <button className="text-button" type="button" onClick={() => onPermissions(user)}>Permissions</button>}{canEdit && user.id !== account.id && <button className="text-button" type="button" onClick={() => onStatusAction(user)}>{user.status === 'suspended' ? 'Activate' : 'Suspend'}</button>}</div></td></tr>)}</tbody></table></div></section>;
}

function AdministrationDialog({ dialog, onChange, overview, busy, onCancel, onSubmit }) {
  const setValue = (key, value) => onChange(current => ({ ...current, values: { ...current.values, [key]: value } }));
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));
  const highRisk = ['permissions', 'correction'].includes(dialog.mode) || dialog.mode === 'status' && dialog.values.status === 'suspended' || dialog.mode === 'user' && dialog.target.category === 'internal';
  const title = { user: 'Edit account', company: 'Edit customer company', representative: 'Assign dedicated representative', permissions: 'Change account permissions', notifications: 'Change notification preferences', catalogue: 'Edit catalogue information', correction: 'Record approved correction', status: `${humanise(dialog.values.status)} account` }[dialog.mode];
  return <div className="administrator-dialog-backdrop" role="presentation"><section className="administrator-dialog" role="dialog" aria-modal="true" aria-labelledby="administrator-dialog-title"><div className="operations-section-title"><div><span className="eyebrow">Confirmation required</span><h2 id="administrator-dialog-title">{title}</h2></div><button type="button" className="text-button" onClick={onCancel}>Close</button></div><p>This action uses the administration service and creates immutable before-and-after audit evidence.</p>
    {dialog.mode === 'user' && <div className="administrator-form-grid"><Field label="Full name" value={dialog.values.contact} onChange={value => setValue('contact', value)} /><Field label="Email address" type="email" value={dialog.values.email} onChange={value => setValue('email', value)} /><Field label="Username" value={dialog.values.signInName} onChange={value => setValue('signInName', value)} /><Field label="Phone number" value={dialog.values.phone} onChange={value => setValue('phone', value)} /><SelectField label="Area" value={dialog.values.area} options={overview.areas || []} onChange={value => setValue('area', value)} /><SelectField label="Branch" value={dialog.values.branchId} options={overview.branches.map(item => ({ value: item.id, label: item.name }))} onChange={value => setValue('branchId', value)} />{dialog.target.category === 'internal' && <SelectField label="Role" value={dialog.values.role} options={overview.roles.filter(item => item.id !== USER_ROLES.CUSTOMER).map(item => ({ value: item.id, label: item.label }))} onChange={value => setValue('role', value)} />}</div>}
    {dialog.mode === 'company' && <div className="administrator-form-grid"><Field label="Company name" value={dialog.values.name} onChange={value => setValue('name', value)} /><SelectField label="Area" value={dialog.values.area} options={overview.areas || []} onChange={value => setValue('area', value)} /><Field label="Industry" value={dialog.values.industry} onChange={value => setValue('industry', value)} /><SelectField label="Branch" value={dialog.values.branchId} options={overview.branches.map(item => ({ value: item.id, label: item.name }))} onChange={value => setValue('branchId', value)} /></div>}
    {dialog.mode === 'representative' && <SelectField label="Dedicated sales representative" value={dialog.values.representativeId} options={overview.representatives.map(item => ({ value: item.id, label: `${item.name} · ${item.branch}` }))} onChange={value => setValue('representativeId', value)} />}
    {dialog.mode === 'permissions' && <div className="administrator-permission-editor">{Object.values(PERMISSIONS).map(permission => <label key={permission}><input type="checkbox" checked={dialog.values.permissions.includes(permission)} onChange={event => setValue('permissions', event.target.checked ? [...dialog.values.permissions, permission] : dialog.values.permissions.filter(item => item !== permission))} /><span>{humanise(permission)}</span></label>)}</div>}
    {dialog.mode === 'notifications' && <div className="administrator-form-grid">{['inApp', 'email', 'push'].map(channel => <label className="administrator-check" key={channel}><input type="checkbox" checked={dialog.values.channels[channel]} disabled={channel === 'inApp'} onChange={event => setValue('channels', { ...dialog.values.channels, [channel]: event.target.checked })} /><span>{humanise(channel)}</span></label>)}</div>}
    {dialog.mode === 'catalogue' && <div className="administrator-form-grid"><Field label={dialog.target.kind === 'product' ? 'Product name' : 'Category name'} value={dialog.values.name} onChange={value => setValue('name', value)} />{dialog.target.kind === 'product' && <><Field label="Product code" value={dialog.values.code} onChange={value => setValue('code', value)} /><SelectField label="Category" value={dialog.values.category} options={overview.catalogue.categories.map(item => ({ value: item.id, label: item.name }))} onChange={value => setValue('category', value)} /></>}<Field label="Description" value={dialog.values.description} onChange={value => setValue('description', value)} /><SelectField label="Status" value={dialog.values.status} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={value => setValue('status', value)} /></div>}
    {dialog.mode === 'correction' && <div className="administrator-form-grid"><Field label="Contact person" value={dialog.values.contact} onChange={value => setValue('contact', value)} />{dialog.target.workflowType === 'order' && <><Field label="Internal job number" value={dialog.values.internalJobNumber} onChange={value => setValue('internalJobNumber', value)} /><Field label="Customer PO number" value={dialog.values.customerPoNumber} onChange={value => setValue('customerPoNumber', value)} /></>}</div>}
    {dialog.mode === 'status' && <p className="administrator-risk-note">You are about to <strong>{dialog.values.status}</strong> {dialog.target.contact}. Suspension immediately blocks sign-in.</p>}
    <label><span>Reason for change</span><textarea value={dialog.reason} onChange={event => set('reason', event.target.value)} placeholder="Explain why this approved change is required…" /></label>{highRisk && <Field label="Current administrator password" type="password" value={dialog.verification} onChange={value => set('verification', value)} />}
    <div className="administrator-action-row"><button type="button" className="primary-button" disabled={Boolean(busy) || dialog.reason.trim().length < 8 || highRisk && !dialog.verification} onClick={onSubmit}>{busy ? 'Saving…' : 'Confirm and record change'}</button><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button></div></section></div>;
}

function Field({ label, value, onChange, type = 'text' }) { return <label><span>{label}</span><input type={type} value={value || ''} onChange={event => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, onChange }) { const normalised = options.map(item => typeof item === 'string' ? { value: item, label: item } : item); return <label><span>{label}</span><select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">Choose…</option>{normalised.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>; }
function AdminListRow({ title, detail, onEdit }) { return <div className="administrator-list-row"><div><strong>{title}</strong><small>{detail}</small></div>{onEdit && <button type="button" className="text-button" onClick={onEdit}>Edit</button>}</div>; }
function Metric({ label, value }) { return <article><strong>{value ?? 0}</strong><span>{label}</span></article>; }
