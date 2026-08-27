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
  const [uploadPanel, setUploadPanel] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const prepared = useMemo(() => orders.map(ensureLaboratoryRecord).filter(order => order.laboratory?.units?.some(unit => laboratoryManagerCanHandle(account, unit.certificationType))), [orders, account]);
  const filtered = prepared.filter(order => {
    const complete = order.laboratory.units.every(unit => unit.certificateId);
    return (tab === 'completed' ? complete : !complete) && (!query || searchable(order).includes(query.toLowerCase()));
  }).sort((a, b) => Number(Boolean(b.priority === 'urgent' || b.emergency === 'yes')) - Number(Boolean(a.priority === 'urgent' || a.emergency === 'yes')) || String(a.laboratory?.lastUpdatedAt || a.createdAt).localeCompare(String(b.laboratory?.lastUpdatedAt || b.createdAt)));
  const order = selected ? prepared.find(item => item.id === selected) : null;

  const submitCertificates = async entries => {
    setError('');
    setMessage('');
    try {
      if (uploadPanel?.replace) {
        const entry = entries[0];
        await laboratoryActions.replaceCertificate(order.id, entry.unitId, entry);
        setMessage('Replacement certificate saved with full version history.');
      } else if (laboratoryActions.uploadCertificatesBatch) {
        await laboratoryActions.uploadCertificatesBatch(order.id, entries);
        setMessage(`${entries.length} certificate${entries.length === 1 ? '' : 's'} uploaded successfully. Customer downloads remain subject to document security checks.`);
      } else {
        for (const entry of entries) await laboratoryActions.uploadCertificate(order.id, entry.unitId, entry);
        setMessage(`${entries.length} certificate${entries.length === 1 ? '' : 's'} uploaded successfully.`);
      }
      setUploadPanel(null);
      await onRecordsChanged?.();
    } catch (cause) {
      const friendly = friendlyServiceError(cause);
      setError(friendly);
      throw new Error(friendly);
    }
  };

  return <section className="app-screen laboratory-launch lab-control-centre" aria-labelledby="lab-title">
    <header className="section-heading"><div><span className="eyebrow">Launch certificate workflow</span><h1 id="lab-title">Laboratory Certificate Dashboard</h1><p>Upload one final PDF certificate for every SANAS or Traceable physical unit.</p></div><span className="launch-scope-note">Manager access only</span></header>
    <div className="lab-summary-grid"><article><strong>{prepared.filter(item => item.laboratory.units.some(unit => !unit.certificateId)).length}</strong><span>Active orders</span></article><article><strong>{prepared.flatMap(item => item.laboratory.units).filter(unit => !unit.certificateId).length}</strong><span>Certificates awaiting upload</span></article><article><strong>{prepared.filter(item => item.laboratory.units.every(unit => unit.certificateId)).length}</strong><span>Completed</span></article></div>
    <div className="lab-toolbar"><div className="segmented-control"><button className={tab === 'active' ? 'active' : ''} onClick={() => { setTab('active'); setSelected(null); setUploadPanel(null); }}>Active</button><button className={tab === 'completed' ? 'active' : ''} onClick={() => { setTab('completed'); setSelected(null); setUploadPanel(null); }}>Completed Certificates</button></div><input aria-label="Search Laboratory certificates" placeholder="Search order, job, customer, serial or certificate" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {message && <p className="success-message" role="status">{message}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    {!order ? <div className="laboratory-card-grid">{filtered.map(item => {
      const units = item.laboratory.units.filter(unit => laboratoryManagerCanHandle(account, unit.certificationType)); const uploaded = units.filter(unit => unit.certificateId).length;
      return <button type="button" className="laboratory-order-card" key={item.id} onClick={() => setSelected(item.id)}><span><b>{item.reference}</b><em>{item.priority === 'urgent' || item.emergency === 'yes' ? 'Urgent' : 'Standard'}</em></span><h2>{item.company}</h2><p>{item.planning?.internalJobNumber || item.internalJobNumber || 'Job number pending'} · {item.selectedRep?.name || 'Representative pending'}</p><strong>{uploaded} / {units.length} certificates uploaded</strong><small><StatusBadge status={uploaded === units.length ? 'completed' : 'pending'} label={uploaded === units.length ? 'Completed' : 'Awaiting Certificate'} /> · received {date(item.laboratory?.receivedAt || item.updatedAt)}</small></button>;
    })}{!filtered.length && <div className="empty-state"><h2>No matching Laboratory certificate tasks</h2><p>Completed work remains available in Certificate History.</p></div>}</div> : <LaboratoryOrderDetail
      order={order}
      account={account}
      uploadPanel={uploadPanel}
      onBack={() => { setSelected(null); setUploadPanel(null); }}
      onOpenUpload={(unit = null, replace = false) => { setError(''); setMessage(''); setUploadPanel({ preferredUnitId: unit?.id || '', replace }); }}
      onCloseUpload={() => setUploadPanel(null)}
      onSubmitUpload={submitCertificates}
      onDownload={async unit => {
        setError('');
        try {
          const result = await laboratoryActions.downloadCertificate(unit.certificateId);
          const href = result.downloadUrl || result.dataUrl;
          if (!href) throw new Error('The certificate download is not available.');
          const link = document.createElement('a'); link.href = href; link.download = result.fileName || `${unit.certificateNumber}.pdf`;
          document.body.appendChild(link); link.click(); link.remove();
        } catch (cause) { setError(friendlyServiceError(cause)); }
      }}
    />}
  </section>;
}

function LaboratoryOrderDetail({ order, account, uploadPanel, onBack, onOpenUpload, onCloseUpload, onSubmitUpload, onDownload }) {
  const units = order.laboratory.units.filter(unit => laboratoryManagerCanHandle(account, unit.certificationType));
  const pendingUnits = units.filter(unit => !unit.certificateId);
  return <div className="laboratory-order-detail">
    <button className="text-button lab-back-button" onClick={onBack}>← Back to certificate queue</button>
    <header><div><span className="eyebrow">Order details</span><h2>{order.reference}</h2><p>{order.company} · {order.contact}</p></div><div className="lab-order-progress"><strong>{units.filter(unit => unit.certificateId).length} / {units.length} complete</strong>{pendingUnits.length > 0 && <button className="primary-button" onClick={() => onOpenUpload()} aria-expanded={Boolean(uploadPanel) && !uploadPanel.replace}>Upload Certificates</button>}</div></header>
    <dl className="lab-order-facts"><div><dt>Job number</dt><dd>{order.planning?.internalJobNumber || order.internalJobNumber || 'Pending'}</dd></div><div><dt>Sales Order</dt><dd>{order.salesOrderNumber || 'Pending'}</dd></div><div><dt>Customer PO</dt><dd>{order.customerPoNumber || 'Not recorded'}</dd></div><div><dt>Representative</dt><dd>{order.selectedRep?.name || 'Not assigned'}</dd></div><div><dt>Branch</dt><dd>{order.selectedRep?.branchName || order.area || 'Not recorded'}</dd></div><div><dt>Urgency</dt><dd>{order.priority === 'urgent' || order.emergency === 'yes' ? 'Urgent' : 'Standard'}</dd></div></dl>
    {uploadPanel && <CertificateUploadPanel key={`${uploadPanel.replace}-${uploadPanel.preferredUnitId}`} units={units} preferredUnitId={uploadPanel.preferredUnitId} replace={uploadPanel.replace} onClose={onCloseUpload} onSubmit={onSubmitUpload} />}
    <div className="lab-unit-list">{units.map(unit => {
      const item = order.items.find(value => (value.lineId || value.id) === unit.lineItemId);
      const recipient = unit.certificateRecipientSnapshot || item?.certificateRecipientSnapshot;
      return <article key={unit.id} className="lab-unit-card"><div className="lab-unit-heading"><div><span>Unit {unit.unitNumber} of {unit.quantityInLine}</span><h3>{unit.productCode} · {unit.productName}</h3></div><b className={unit.certificateId ? 'complete' : ''}>{status(unit)}</b></div><ConfiguredUnitDetails unit={item || unit} context="Laboratory" extra={{ physicalUnit: `Unit ${unit.unitNumber}`, certificateType: unit.certificationType, serialNumber: unit.serialNumber || 'Pending', certificateNumber: unit.certificateNumber || 'Pending' }} /><div className="certificate-recipient-review"><strong>Certificate Recipient</strong><span>{recipient?.recipientType === 'customer_company' ? 'My Company' : 'My Client'}</span><span>{recipient?.recipientName || 'Recipient snapshot pending'}</span><span>{recipient?.recipientAddress || 'Address pending'}</span></div><div className="form-actions"><button className={unit.certificateId ? 'secondary-button' : 'primary-button'} onClick={() => onOpenUpload(unit, Boolean(unit.certificateId))}>{unit.certificateId ? 'Replace Certificate' : 'Upload Certificate'}</button>{unit.certificateId && <button type="button" className="secondary-button" onClick={() => onDownload(unit)}>Download Certificate</button>}</div>{unit.certificateVersions?.length > 0 && <small>{unit.certificateVersions.length} superseded version(s) preserved in audit history.</small>}</article>;
    })}</div>
  </div>;
}

const createEntry = (unit, selected) => ({
  unit,
  selected,
  file: null,
  certificateNumber: '',
  issueDate: '',
  serialNumber: unit.serialNumber || '',
  notes: '',
  reason: '',
  confirmAssociation: false,
});

function CertificateUploadPanel({ units, preferredUnitId, replace, onClose, onSubmit }) {
  const availableUnits = replace ? units.filter(unit => unit.id === preferredUnitId) : units.filter(unit => !unit.certificateId);
  const firstUnitId = preferredUnitId || availableUnits[0]?.id;
  const [entries, setEntries] = useState(() => Object.fromEntries(availableUnits.map(unit => [unit.id, createEntry(unit, unit.id === firstUnitId)])));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const selectedCount = Object.values(entries).filter(entry => entry.selected).length;
  const update = (unitId, changes) => setEntries(current => ({ ...current, [unitId]: { ...current[unitId], ...changes } }));

  const submit = async event => {
    event.preventDefault();
    setLocalError('');
    const selectedEntries = Object.values(entries).filter(entry => entry.selected);
    if (!selectedEntries.length) { setLocalError('Select at least one physical unit to upload.'); return; }
    const invalid = selectedEntries.find(entry => !entry.file || !entry.certificateNumber.trim() || !entry.issueDate || !entry.serialNumber.trim() || !entry.confirmAssociation || (replace && entry.reason.trim().length < 5));
    if (invalid) { setLocalError(`Complete all required certificate details for ${invalid.unit.productCode}, unit ${invalid.unit.unitNumber}.`); return; }
    setBusy(true);
    try {
      await onSubmit(selectedEntries.map(entry => ({ unitId: entry.unit.id, file: entry.file, certificateNumber: entry.certificateNumber.trim(), issueDate: entry.issueDate, serialNumber: entry.serialNumber.trim(), certificationType: entry.unit.certificationType, confirmAssociation: entry.confirmAssociation, notes: entry.notes.trim(), reason: entry.reason.trim() })));
    } catch {
      setBusy(false);
    }
  };

  return <section className="certificate-upload-panel" aria-labelledby="certificate-panel-title">
    <div className="certificate-panel-heading"><div><span className="eyebrow">{replace ? 'Controlled replacement' : 'Certificate batch'}</span><h3 id="certificate-panel-title">{replace ? 'Replace Certificate' : 'Upload Certificates'}</h3><p>{replace ? 'The current file will remain preserved in version history.' : 'Select one or more physical units and attach the matching final PDF to each unit.'}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close certificate upload panel">×</button></div>
    {localError && <p className="error-message" role="alert">{localError}</p>}
    <form className="certificate-batch-form" onSubmit={submit}>
      <div className="certificate-upload-list">{availableUnits.map(unit => {
        const entry = entries[unit.id];
        const inputId = `certificate-file-${unit.id.replace(/[^a-z0-9_-]/gi, '-')}`;
        return <fieldset key={unit.id} className={`certificate-upload-entry ${entry.selected ? 'selected' : ''}`}>
          <legend className="sr-only">{unit.productCode}, unit {unit.unitNumber}</legend>
          {!replace && <label className="certificate-unit-selector"><input type="checkbox" checked={entry.selected} onChange={event => update(unit.id, { selected: event.target.checked })} /><span><strong>{unit.productCode} · Unit {unit.unitNumber}</strong><small>{unit.productName} · {unit.certificationType.toUpperCase()}</small></span></label>}
          {replace && <div className="certificate-unit-selector static"><span><strong>{unit.productCode} · Unit {unit.unitNumber}</strong><small>{unit.productName} · {unit.certificationType.toUpperCase()}</small></span></div>}
          <div className="certificate-entry-fields" aria-disabled={!entry.selected}>
            <label className="certificate-file-field" htmlFor={inputId}><span>Certificate PDF</span><span className="certificate-file-picker"><b>{entry.file ? 'Change PDF' : 'Choose PDF'}</b><small>{entry.file?.name || 'No file selected'}</small></span><input id={inputId} type="file" accept="application/pdf,.pdf" disabled={!entry.selected} onChange={event => update(unit.id, { file: event.target.files?.[0] || null })} /></label>
            <label>Certificate number<input value={entry.certificateNumber} disabled={!entry.selected} onChange={event => update(unit.id, { certificateNumber: event.target.value })} /></label>
            <label>Certificate date<input type="date" value={entry.issueDate} disabled={!entry.selected} onChange={event => update(unit.id, { issueDate: event.target.value })} /></label>
            <label>Unit / serial number<input value={entry.serialNumber} disabled={!entry.selected} onChange={event => update(unit.id, { serialNumber: event.target.value })} /></label>
            {replace && <label className="certificate-wide-field">Replacement reason<textarea value={entry.reason} disabled={!entry.selected} minLength="5" onChange={event => update(unit.id, { reason: event.target.value })} /></label>}
            <label className="certificate-wide-field">Internal note <span className="optional-label">Optional</span><textarea value={entry.notes} disabled={!entry.selected} onChange={event => update(unit.id, { notes: event.target.value })} /></label>
            <label className="checkbox-row certificate-wide-field"><input type="checkbox" checked={entry.confirmAssociation} disabled={!entry.selected} onChange={event => update(unit.id, { confirmAssociation: event.target.checked })} /><span>I confirm this certificate belongs to the displayed order and physical unit.</span></label>
          </div>
        </fieldset>;
      })}</div>
      <div className="certificate-panel-actions"><span>{replace ? '1 controlled replacement' : `${selectedCount} certificate${selectedCount === 1 ? '' : 's'} selected`}</span><div><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy || selectedCount === 0}>{busy ? 'Uploading…' : replace ? 'Save Replacement' : `Upload ${selectedCount || ''} Certificate${selectedCount === 1 ? '' : 's'}`}</button></div></div>
    </form>
  </section>;
}
