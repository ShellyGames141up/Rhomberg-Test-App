import { useMemo, useState } from 'react';
import { ensureLaboratoryRecord } from '../domain/certification.js';
import { laboratoryManagerCanHandle } from '../domain/laboratoryLaunch.js';
import { friendlyServiceError } from '../services/contracts.js';
import { ConfiguredUnitDetails } from './ConfiguredUnitDetails.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const date = value => value ? new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded';
const status = unit => unit.certificateId ? 'Certificate Uploaded' : 'Awaiting Certificate';
const searchable = order => [order.reference, order.internalJobNumber, order.planning?.internalJobNumber, order.salesOrderNumber, order.customerPoNumber, order.company, order.selectedRep?.name, ...(order.laboratory?.units || []).flatMap(unit => [unit.serialNumber, unit.certificateNumber])].filter(Boolean).join(' ').toLowerCase();

export function LaboratoryDashboard({ account, orders = [], laboratoryActions, onRecordsChanged }) {
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const prepared = useMemo(() => orders.map(ensureLaboratoryRecord).filter(order => order.laboratory?.units?.some(unit => laboratoryManagerCanHandle(account, unit.certificationType))), [orders, account]);
  const filtered = prepared.filter(order => {
    const complete = order.laboratory.units.every(unit => unit.certificateId);
    return (tab === 'completed' ? complete : !complete) && (!query || searchable(order).includes(query.toLowerCase()));
  }).sort((a, b) => Number(Boolean(b.priority === 'urgent' || b.emergency === 'yes')) - Number(Boolean(a.priority === 'urgent' || a.emergency === 'yes')) || String(a.laboratory?.lastUpdatedAt || a.createdAt).localeCompare(String(b.laboratory?.lastUpdatedAt || b.createdAt)));
  const order = selected ? prepared.find(item => item.id === selected) : null;

  const submit = async event => {
    event.preventDefault(); setError(''); setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const input = { file: data.get('certificateFile'), certificateNumber: data.get('certificateNumber'), issueDate: data.get('issueDate'), serialNumber: data.get('serialNumber'), certificationType: uploading.unit.certificationType, confirmAssociation: data.get('confirmAssociation') === 'on', notes: data.get('notes') };
      if (uploading.replace) await laboratoryActions.replaceCertificate(order.id, uploading.unit.id, { ...input, reason: data.get('reason') });
      else await laboratoryActions.uploadCertificate(order.id, uploading.unit.id, input);
      setMessage(uploading.replace ? 'Replacement certificate saved with full version history.' : 'Certificate uploaded. Authorised users can now access it.');
      setUploading(null); await onRecordsChanged?.();
    } catch (cause) { setError(friendlyServiceError(cause)); }
  };

  return <section className="app-screen laboratory-launch lab-control-centre" aria-labelledby="lab-title">
    <header className="section-heading"><div><span className="eyebrow">Launch certificate workflow</span><h1 id="lab-title">Laboratory Certificate Dashboard</h1><p>Upload one final PDF certificate for every SANAS or Traceable physical unit.</p></div><span className="launch-scope-note">Manager access only</span></header>
    <div className="lab-summary-grid"><article><strong>{prepared.filter(item => item.laboratory.units.some(unit => !unit.certificateId)).length}</strong><span>Active orders</span></article><article><strong>{prepared.flatMap(item => item.laboratory.units).filter(unit => !unit.certificateId).length}</strong><span>Certificates awaiting upload</span></article><article><strong>{prepared.filter(item => item.laboratory.units.every(unit => unit.certificateId)).length}</strong><span>Completed</span></article></div>
    <div className="lab-toolbar"><div className="segmented-control"><button className={tab === 'active' ? 'active' : ''} onClick={() => { setTab('active'); setSelected(null); }}>Active</button><button className={tab === 'completed' ? 'active' : ''} onClick={() => { setTab('completed'); setSelected(null); }}>Completed Certificates</button></div><input aria-label="Search Laboratory certificates" placeholder="Search order, job, customer, serial or certificate" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {message && <p className="success-message" role="status">{message}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    {!order ? <div className="laboratory-card-grid">{filtered.map(item => {
      const units = item.laboratory.units.filter(unit => laboratoryManagerCanHandle(account, unit.certificationType)); const uploaded = units.filter(unit => unit.certificateId).length;
      return <button type="button" className="laboratory-order-card" key={item.id} onClick={() => setSelected(item.id)}><span><b>{item.reference}</b><em>{item.priority === 'urgent' || item.emergency === 'yes' ? 'Urgent' : 'Standard'}</em></span><h2>{item.company}</h2><p>{item.planning?.internalJobNumber || item.internalJobNumber || 'Job number pending'} · {item.selectedRep?.name || 'Representative pending'}</p><strong>{uploaded} / {units.length} certificates uploaded</strong><small><StatusBadge status={uploaded === units.length ? 'completed' : 'pending'} label={uploaded === units.length ? 'Completed' : 'Awaiting Certificate'} /> · received {date(item.laboratory?.receivedAt || item.updatedAt)}</small></button>;
    })}{!filtered.length && <div className="empty-state"><h2>No matching Laboratory certificate tasks</h2><p>Completed work remains available in Certificate History.</p></div>}</div> : <LaboratoryOrderDetail order={order} account={account} onBack={() => { setSelected(null); setUploading(null); }} onUpload={(unit, replace = false) => setUploading({ unit, replace })} />}
    {uploading && <CertificateDialog unit={uploading.unit} replace={uploading.replace} onClose={() => setUploading(null)} onSubmit={submit} />}
  </section>;
}

function LaboratoryOrderDetail({ order, account, onBack, onUpload }) {
  const units = order.laboratory.units.filter(unit => laboratoryManagerCanHandle(account, unit.certificationType));
  return <div className="laboratory-order-detail"><button className="text-button" onClick={onBack}>← Back to certificate queue</button><header><div><span className="eyebrow">Order details</span><h2>{order.reference}</h2><p>{order.company} · {order.contact}</p></div><strong>{units.filter(unit => unit.certificateId).length} / {units.length} complete</strong></header>
    <dl className="lab-order-facts"><div><dt>Job number</dt><dd>{order.planning?.internalJobNumber || order.internalJobNumber || 'Pending'}</dd></div><div><dt>Sales Order</dt><dd>{order.salesOrderNumber || 'Pending'}</dd></div><div><dt>Customer PO</dt><dd>{order.customerPoNumber || 'Not recorded'}</dd></div><div><dt>Representative</dt><dd>{order.selectedRep?.name || 'Not assigned'}</dd></div><div><dt>Branch</dt><dd>{order.selectedRep?.branchName || order.area || 'Not recorded'}</dd></div><div><dt>Urgency</dt><dd>{order.priority === 'urgent' || order.emergency === 'yes' ? 'Urgent' : 'Standard'}</dd></div></dl>
    <div className="lab-unit-list">{units.map(unit => { const item = order.items.find(value => (value.lineId || value.id) === unit.lineItemId); const recipient = unit.certificateRecipientSnapshot || item?.certificateRecipientSnapshot; return <article key={unit.id} className="lab-unit-card"><div className="lab-unit-heading"><div><span>Unit {unit.unitNumber} of {unit.quantityInLine}</span><h3>{unit.productCode} · {unit.productName}</h3></div><b className={unit.certificateId ? 'complete' : ''}>{status(unit)}</b></div><ConfiguredUnitDetails unit={item || unit} context="Laboratory" extra={{ physicalUnit: `Unit ${unit.unitNumber}`, certificateType: unit.certificationType, serialNumber: unit.serialNumber || 'Pending', certificateNumber: unit.certificateNumber || 'Pending' }} /><div className="certificate-recipient-review"><strong>Certificate Recipient</strong><span>{recipient?.recipientType === 'customer_company' ? 'My Company' : 'My Client'}</span><span>{recipient?.recipientName || 'Recipient snapshot pending'}</span><span>{recipient?.recipientAddress || 'Address pending'}</span></div><button className="primary-button" onClick={() => onUpload(unit, Boolean(unit.certificateId))}>{unit.certificateId ? 'Replace Certificate' : 'Upload Certificate'}</button>{unit.certificateVersions?.length > 0 && <small>{unit.certificateVersions.length} superseded version(s) preserved in audit history.</small>}</article>; })}</div>
  </div>;
}

function CertificateDialog({ unit, replace, onClose, onSubmit }) {
  return <div className="modal-backdrop" role="presentation"><form className="modal-card certificate-upload-form" onSubmit={onSubmit}><header><div><span className="eyebrow">{replace ? 'Controlled replacement' : 'Final certificate'}</span><h2>{replace ? 'Replace Certificate' : 'Upload Certificate'}</h2><p>{unit.productCode} · Unit {unit.unitNumber} · {unit.certificationType.toUpperCase()}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button></header><label>Certificate PDF<input name="certificateFile" type="file" accept="application/pdf,.pdf" required /></label><label>Certificate number<input name="certificateNumber" required /></label><label>Certificate date<input name="issueDate" type="date" required /></label><label>Unit / serial number<input name="serialNumber" defaultValue={unit.serialNumber || ''} required /></label>{replace && <label>Replacement reason<textarea name="reason" required minLength="5" /></label>}<label>Internal note<textarea name="notes" /></label><label className="checkbox-row"><input name="confirmAssociation" type="checkbox" required /><span>I confirm this certificate belongs to the displayed order and physical unit.</span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{replace ? 'Save Replacement' : 'Upload Certificate'}</button></div></form></div>;
}
