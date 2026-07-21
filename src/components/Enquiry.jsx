import { useState } from 'react';
import { LeadTimeNotice } from './Layout.jsx';

const MAX_PO_SIZE = 15 * 1024 * 1024;
const ALLOWED_PO_FILE = /\.(pdf|doc|docx|png|jpe?g|webp|gif|heic)$/i;
const normaliseQuantity = value => Math.min(9999, Math.max(1, Math.trunc(Number(value) || 1)));

export function Enquiry({ account, lines, onAddProducts, onEdit, onRemove, onQuantity, onSubmit, success, onCloseSuccess }) {
  const [poMode, setPoMode] = useState('none');
  const [poFile, setPoFile] = useState(null);
  const [error, setError] = useState('');
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  const selectPoFile = event => {
    const file = event.target.files?.[0] || null;
    setError('');
    if (!file) {
      setPoFile(null);
      return;
    }
    if (!ALLOWED_PO_FILE.test(file.name)) {
      event.target.value = '';
      setPoFile(null);
      setError('Please choose a PDF, DOCX, DOC or image Purchase Order.');
      return;
    }
    if (file.size > MAX_PO_SIZE) {
      event.target.value = '';
      setPoFile(null);
      setError('The Purchase Order document must be 15 MB or smaller.');
      return;
    }
    setPoFile(file);
  };

  const submit = event => {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (poMode === 'number' && !data.poNumber?.trim()) {
      setError('Please enter the Purchase Order number or choose another PO option.');
      return;
    }
    if (poMode === 'upload' && !poFile) {
      setError('Please select the Purchase Order document to upload.');
      return;
    }
    const result = onSubmit({
      application: data.application?.trim(),
      medium: data.medium?.trim(),
      area: data.area?.trim(),
      requiredBy: data.requiredBy,
      notes: data.notes?.trim(),
      poMode,
      poNumber: poMode === 'number' ? data.poNumber.trim() : '',
      poFileName: poMode === 'upload' ? poFile.name : '',
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    form.reset();
    setPoMode('none');
    setPoFile(null);
  };

  return (
    <section className="app-screen enquiry-screen" aria-labelledby="enquiry-title">
      <header className="screen-heading enquiry-heading"><span className="eyebrow">Quote request</span><h1 id="enquiry-title">Your <em>enquiry</em></h1><p>Review each configured unit and tell Rhomberg about the application.</p></header>
      <LeadTimeNotice />

      <div className="enquiry-progress"><span><b>1</b><small>Configured units</small></span><i /><span><b>2</b><small>Application</small></span><i /><span><b>3</b><small>Purchase Order</small></span></div>

      <section className="enquiry-section">
        <div className="enquiry-section-title"><div><span className="eyebrow">Selected units</span><h2>{lines.length ? `${lines.length} configured product${lines.length === 1 ? '' : 's'}` : 'No units selected'}</h2></div><button type="button" onClick={onAddProducts}>+ Add units</button></div>
        {lines.length ? <div className="enquiry-lines">{lines.map(line => <EnquiryLine key={line.lineId} line={line} onEdit={() => onEdit(line)} onRemove={() => onRemove(line.lineId)} onQuantity={value => onQuantity(line.lineId, value)} />)}</div> : <div className="empty-basket"><span>+</span><strong>Build a configured enquiry</strong><p>Browse the catalogue and configure units one at a time, or continue below with a general enquiry.</p><button type="button" onClick={onAddProducts}>Browse catalogue</button></div>}
        {lines.length > 0 && <div className="quantity-summary"><span>Total physical units</span><strong>{totalQuantity}</strong></div>}
      </section>

      <form className="enquiry-form" onSubmit={submit}>
        <section className="enquiry-section form-panel">
          <div className="panel-index"><span>01</span><div><strong>Application details</strong><small>Help us understand your process</small></div></div>
          <label className="form-field"><span>What is the application?</span><textarea name="application" required rows="4" placeholder="Tell us what the instruments will measure and where they will be used..." /></label>
          <label className="form-field"><span>Process medium or product <i>Optional</i></span><input name="medium" placeholder="e.g. Water, steam, hydraulic oil or chemical" /></label>
          <div className="form-two-col"><label className="form-field"><span>Area</span><input name="area" required defaultValue={account.area} /></label><label className="form-field"><span>Required by <i>Optional</i></span><input name="requiredBy" type="date" min={new Date().toISOString().slice(0, 10)} /></label></div>
          <label className="form-field"><span>Additional specifications <i>Optional</i></span><textarea name="notes" rows="3" placeholder="Plant standards, environment, urgency or other requirements..." /></label>
        </section>

        <section className="enquiry-section form-panel po-panel">
          <div className="panel-index"><span>02</span><div><strong>Purchase Order</strong><small>Provide a number, upload a document, or continue without one</small></div></div>
          <div className="po-options" role="radiogroup" aria-label="Purchase Order method">
            <button type="button" role="radio" aria-checked={poMode === 'number'} className={poMode === 'number' ? 'selected' : ''} onClick={() => setPoMode('number')}><span>#</span><strong>PO number</strong><small>Enter the reference</small></button>
            <button type="button" role="radio" aria-checked={poMode === 'upload'} className={poMode === 'upload' ? 'selected' : ''} onClick={() => setPoMode('upload')}><span>↑</span><strong>Upload PO</strong><small>PDF, DOCX or image</small></button>
            <button type="button" role="radio" aria-checked={poMode === 'none'} className={poMode === 'none' ? 'selected' : ''} onClick={() => setPoMode('none')}><span>—</span><strong>No PO yet</strong><small>Submit a quote request</small></button>
          </div>
          {poMode === 'number' && <label className="form-field po-detail"><span>Purchase Order number</span><input name="poNumber" required placeholder="Example: PO-450021" /></label>}
          {poMode === 'upload' && <label className={`po-upload ${poFile ? 'has-file' : ''}`}><input type="file" accept=".pdf,.doc,.docx,image/*" required onChange={selectPoFile} /><span>↑</span><div><strong>{poFile ? poFile.name : 'Choose Purchase Order document'}</strong><small>{poFile ? 'Document selected for this preview request' : 'PDF, DOCX, DOC or image · maximum 15 MB'}</small></div></label>}
          {poMode === 'none' && <p className="po-none-note"><span>i</span> You may submit the enquiry without a PO. The 3-10 working day review notice applies after Rhomberg receives the Purchase Order.</p>}
        </section>

        <section className="enquiry-section submit-panel">
          <div className="client-summary"><span className="client-avatar">{account.company.slice(0, 1)}</span><div><strong>{account.company}</strong><small>{account.contact} · {account.email} · {account.phone}</small></div></div>
          <label className="consent-row"><input type="checkbox" required /><span>I confirm this is a quote request. Rhomberg must review the final configuration, lead time and availability.</span></label>
          {error && <p className="form-error submit-error" role="alert">{error}</p>}
          <button className="primary-button full submit-enquiry" type="submit">Submit quote request <span>→</span></button>
          <p className="preview-submit-note">Preview submissions are stored on this device. Live submissions will be emailed to Ericuv@Rhom.co.za.</p>
        </section>
      </form>

      {success && <SuccessDialog success={success} onClose={onCloseSuccess} />}
    </section>
  );
}

function EnquiryLine({ line, onEdit, onRemove, onQuantity }) {
  const highlights = Object.entries(line.configuration || {}).filter(([, value]) => value !== '' && value !== false).slice(0, 4);
  return (
    <article className="enquiry-line">
      <div className="enquiry-line-head"><span className="line-image"><img src={line.image} alt="" /></span><div><strong>{line.code}</strong><small>{line.name}</small></div><button type="button" onClick={onRemove} aria-label={`Remove ${line.code}`}>×</button></div>
      <div className="line-config-summary">{highlights.map(([key, value]) => <span key={key}>{typeof value === 'boolean' ? 'Chemical seal requested' : value}</span>)}</div>
      {line.configuration?.chemicalSeal && <p className="line-seal-note"><span>i</span> Chemical seal requires representative review.</p>}
      <div className="enquiry-line-tools"><button type="button" className="edit-line" onClick={onEdit}>Edit configuration</button><div className="line-quantity"><button type="button" onClick={() => onQuantity(normaliseQuantity(line.quantity - 1))} aria-label={`Decrease ${line.code} quantity`}>−</button><label><span>Quantity</span><input type="number" min="1" max="9999" value={line.quantity} onChange={event => onQuantity(normaliseQuantity(event.target.value))} aria-label={`${line.code} quantity`} /></label><button type="button" onClick={() => onQuantity(normaliseQuantity(line.quantity + 1))} aria-label={`Increase ${line.code} quantity`}>+</button></div></div>
    </article>
  );
}

function SuccessDialog({ success, onClose }) {
  return <div className="dialog-backdrop" role="presentation"><section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title"><span className="success-icon">✓</span><small>Request saved</small><h2 id="success-title">Thank you, {success.firstName}.</h2><p>Your preview quote request and product-level quantities have been stored on this device.</p><strong className="success-reference">{success.reference}</strong><button className="primary-button full" type="button" onClick={onClose}>Return home <span>→</span></button></section></div>;
}
