import { useEffect, useMemo, useState } from 'react';
import { LeadTimeNotice } from './Layout.jsx';

const ALLOWED_PO_FILE = /\.(pdf|doc|docx|png|jpe?g|webp|gif|heic)$/i;
const normaliseQuantity = value => Math.min(9999, Math.max(1, Math.trunc(Number(value) || 1)));
const humanise = key => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
const formatValue = value => Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Yes' : 'No' : value;

export function Enquiry({ account, lines, registrationOptions, deliverySettings, onAddProducts, onEdit, onRemove, onQuantity, onSubmit, success, onCloseSuccess }) {
  const areas = registrationOptions?.areas || [];
  const areaDirectory = registrationOptions?.areaDirectory || {};
  const [poMode, setPoMode] = useState('none');
  const [poFile, setPoFile] = useState(null);
  const [area, setArea] = useState(areas.includes(account.area) ? account.area : areas[0] || account.area);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [emergency, setEmergency] = useState('no');
  const [fulfilment, setFulfilment] = useState('');
  const [error, setError] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const repSelection = useMemo(() => areaDirectory[area] || { branch: registrationOptions?.branches?.[0] || {}, representatives: [] }, [area, areaDirectory, registrationOptions]);
  const nearestBranch = repSelection.branch;

  useEffect(() => {
    if (selectedRepId && !repSelection.representatives.some(representative => representative.id === selectedRepId)) setSelectedRepId('');
  }, [repSelection, selectedRepId]);

  const selectPoFile = event => {
    const file = event.target.files?.[0] || null;
    setError('');
    setFallbackUrl('');
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
    if (file.size > (deliverySettings?.maxPoFileBytes || 4 * 1024 * 1024)) {
      event.target.value = '';
      setPoFile(null);
      setError('The Purchase Order document must be 4 MB or smaller.');
      return;
    }
    setPoFile(file);
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setFallbackUrl('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    if (!lines.length) {
      setError('Please add and configure at least one unit before submitting the RFQ.');
      return;
    }
    if (!fulfilment) {
      setError('Please choose whether the units must be delivered or collected.');
      return;
    }
    if (!selectedRepId) {
      setError(`Please select a ${repSelection.branch.name} representative for this RFQ.`);
      return;
    }
    if (fulfilment === 'delivery' && !data.deliveryAddress?.trim()) {
      setError('Please enter the delivery address.');
      return;
    }
    if (poMode === 'number' && !data.poNumber?.trim()) {
      setError('Please enter the Purchase Order number or choose another PO option.');
      return;
    }
    if (poMode === 'upload' && !poFile) {
      setError('Please select the Purchase Order document to upload.');
      return;
    }

    const selectedRepresentative = repSelection.representatives.find(representative => representative.id === selectedRepId);
    setIsSubmitting(true);
    let result;
    try {
      result = await onSubmit({
        application: data.application?.trim(),
        medium: data.medium?.trim(),
        area,
        selectedRep: {
          ...selectedRepresentative,
          branchName: repSelection.branch.name,
        },
        emergency,
        fulfilment,
        deliveryAddress: fulfilment === 'delivery' ? data.deliveryAddress.trim() : '',
        collectionBranch: fulfilment === 'collect' ? `${nearestBranch.name} - ${nearestBranch.address}` : '',
        notes: data.notes?.trim(),
        poMode,
        poNumber: poMode === 'number' ? data.poNumber.trim() : '',
        poFileName: poMode === 'upload' ? poFile.name : '',
        poFile,
      });
    } catch {
      result = { ok: false, message: 'The RFQ could not be submitted. Your configured units are still here, so please try again.' };
    } finally {
      setIsSubmitting(false);
    }

    if (!result.ok) {
      setError(result.message);
      setFallbackUrl(result.fallbackUrl || '');
      return;
    }
    form.reset();
    setPoMode('none');
    setPoFile(null);
    setSelectedRepId('');
    setEmergency('no');
    setFulfilment('');
  };

  return (
    <section className="app-screen enquiry-screen" aria-labelledby="enquiry-title">
      <header className="screen-heading enquiry-heading"><span className="eyebrow">Request for quotation</span><h1 id="enquiry-title">Your <em>RFQ</em></h1><p>Configure each unit, tell Rhomberg about the application and choose delivery or collection.</p></header>
      <LeadTimeNotice />

      <div className="enquiry-progress"><span><b>1</b><small>Configured units</small></span><i /><span><b>2</b><small>Application</small></span><i /><span><b>3</b><small>Submit RFQ</small></span></div>

      <section className="enquiry-section unit-builder-section">
        {lines.length ? (
          <>
            <div className="enquiry-section-title"><div><span className="eyebrow">Selected units</span><h2>{lines.length} configured product{lines.length === 1 ? '' : 's'}</h2></div></div>
            <div className="configured-units-panel">
              <div className="enquiry-lines">{lines.map(line => <EnquiryLine key={line.lineId} line={line} onEdit={() => onEdit(line)} onRemove={() => onRemove(line.lineId)} onQuantity={value => onQuantity(line.lineId, value)} />)}</div>
              <button className="add-different-unit" type="button" onClick={onAddProducts}><span>+</span><strong>Add a different unit</strong><small>Choose another category or product</small></button>
            </div>
            <div className="quantity-summary"><span>Total physical units</span><strong>{totalQuantity}</strong></div>
          </>
        ) : (
          <div className="empty-unit-action">
            <button className="add-unit-button" type="button" onClick={onAddProducts}><span>+</span><strong>Add unit</strong><small>Select a product and configure it</small></button>
          </div>
        )}
      </section>

      <form className="enquiry-form" onSubmit={submit}>
        <section className="enquiry-section form-panel">
          <div className="panel-index"><span>01</span><div><strong>Application & fulfilment</strong><small>Help us understand the process and how you want the units supplied</small></div></div>
          <label className="form-field"><span>What is the application?</span><textarea name="application" required rows="4" placeholder="Tell us what the instruments will measure and where they will be used..." /></label>
          <label className="form-field"><span>Process medium or product <i>Optional</i></span><input name="medium" placeholder="e.g. Water, steam, hydraulic oil or chemical" /></label>
          <label className="form-field"><span>Area</span><select name="area" required value={area} onChange={event => setArea(event.target.value)}>{areas.map(item => <option key={item}>{item}</option>)}</select></label>
          <div className="rep-selection-card">
            <span className="rep-branch-mark">R</span>
            <div className="rep-selection-copy"><small>Representatives for your nearest branch</small><strong>{repSelection.branch.name}</strong><p>Only representatives assigned to this branch are shown.</p></div>
            <label className="form-field rep-select"><span>Select your representative</span><select required value={selectedRepId} onChange={event => setSelectedRepId(event.target.value)}><option value="" disabled>Choose a representative</option>{repSelection.representatives.map(representative => <option key={representative.id} value={representative.id}>{representative.name} · Code {representative.code}</option>)}</select></label>
          </div>

          <fieldset className="rfq-choice-field">
            <legend>Is this an emergency request?</legend>
            <div className="compact-choice" role="radiogroup" aria-label="Emergency request">
              <button type="button" role="radio" aria-checked={emergency === 'no'} className={emergency === 'no' ? 'selected' : ''} onClick={() => setEmergency('no')}><span>{emergency === 'no' ? '✓' : ''}</span><strong>No</strong></button>
              <button type="button" role="radio" aria-checked={emergency === 'yes'} className={emergency === 'yes' ? 'selected emergency' : ''} onClick={() => setEmergency('yes')}><span>{emergency === 'yes' ? '✓' : ''}</span><strong>Yes</strong></button>
            </div>
            {emergency === 'yes' && <p className="fee-notice emergency-fee"><span>!</span><span><strong>Emergency pricing is assessed by the representative.</strong> Rhomberg will confirm feasibility and charges before processing.</span></p>}
          </fieldset>

          <fieldset className="rfq-choice-field fulfilment-field">
            <legend>Delivery or collection?</legend>
            <div className="fulfilment-options" role="radiogroup" aria-label="Delivery or collection">
              <button type="button" role="radio" aria-checked={fulfilment === 'delivery'} className={fulfilment === 'delivery' ? 'selected' : ''} onClick={() => setFulfilment('delivery')}><span>⇢</span><strong>Deliver</strong><small>Send to my address</small></button>
              <button type="button" role="radio" aria-checked={fulfilment === 'collect'} className={fulfilment === 'collect' ? 'selected' : ''} onClick={() => setFulfilment('collect')}><span>⌖</span><strong>Collect</strong><small>Nearest Rhomberg branch</small></button>
            </div>
            {fulfilment === 'delivery' && <div className="fulfilment-result"><p className="fee-notice"><span>i</span><span><strong>A delivery fee will apply.</strong> The amount will be confirmed with the quotation.</span></p><label className="form-field"><span>Delivery address</span><textarea name="deliveryAddress" required rows="3" placeholder="Street address, suburb, city and postal code" /></label></div>}
            {fulfilment === 'collect' && <div className="nearest-branch-card"><span>⌖</span><div><small>Nearest branch based on {area}</small><strong>{nearestBranch.name}</strong><p>{nearestBranch.address}</p><a href={`tel:${nearestBranch.phone.replace(/\s/g, '')}`}>{nearestBranch.phone}</a></div></div>}
          </fieldset>

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
          {poMode === 'upload' && <label className={`po-upload ${poFile ? 'has-file' : ''}`}><input type="file" accept=".pdf,.doc,.docx,image/*" required onChange={selectPoFile} /><span>↑</span><div><strong>{poFile ? poFile.name : 'Choose Purchase Order document'}</strong><small>{poFile ? 'Ready to submit with the RFQ' : 'PDF, DOCX, DOC or image · maximum 4 MB'}</small></div></label>}
          {poMode === 'none' && <p className="po-none-note"><span>i</span> You may submit the enquiry without a PO. The 3-10 working day review notice applies after Rhomberg receives the Purchase Order.</p>}
        </section>

        <section className="enquiry-section submit-panel">
          <div className="client-summary"><span className="client-avatar">{account.company.slice(0, 1)}</span><div><strong>{account.company}</strong><small>{account.contact} · {account.email} · {account.phone}</small></div></div>
          <label className="consent-row"><input type="checkbox" required /><span>{deliverySettings?.emailRecipient ? 'I confirm this is an RFQ and agree that these details, the structured RFQ PDF and any PO attachment may be emailed to Rhomberg through the test delivery service.' : 'I confirm this is an RFQ and agree that these details and any PO attachment may be securely submitted to Rhomberg for processing.'}</span></label>
          {error && <p className="form-error submit-error" role="alert">{error}</p>}
          {fallbackUrl && <a className="email-fallback" href={fallbackUrl}>Open my email app with this RFQ summary <span>→</span></a>}
          <button className="primary-button full submit-enquiry" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending RFQ email…' : 'Submit RFQ'} <span>{isSubmitting ? '•••' : '→'}</span></button>
          <p className="preview-submit-note">{deliverySettings?.emailRecipient ? <>Test RFQs are sent to {deliverySettings.emailRecipient}. The protected service adds rep-only price-list estimates to the PDF; the public fallback never exposes pricing to the client.</> : <>RFQs are submitted to the private company service and routed according to the customer’s authorised company and representative assignment.</>}</p>
        </section>
      </form>

      {success && <SuccessDialog success={success} onClose={onCloseSuccess} persistenceLabel={deliverySettings?.persistenceLabel || 'this browser'} />}
    </section>
  );
}

function EnquiryLine({ line, onEdit, onRemove, onQuantity }) {
  const highlights = Object.entries(line.configuration || {})
    .filter(([, value]) => value !== '' && value !== false && (!Array.isArray(value) || value.length))
    .slice(0, 6);
  return (
    <article className="enquiry-line">
      <div className="enquiry-line-head"><span className="line-image"><img src={line.image} alt="" /></span><div><strong>{line.code}</strong><small>{line.name}</small></div><button type="button" onClick={onRemove} aria-label={`Remove ${line.code}`}>×</button></div>
      <p className="line-description">{line.description || line.name}</p>
      <div className="line-config-summary">{highlights.map(([key, value]) => <span key={key}><b>{humanise(key)}:</b> {formatValue(value)}</span>)}</div>
      {line.configuration?.chemicalSeal && <p className="line-seal-note"><span>i</span> Chemical seal requires representative review.</p>}
      <div className="enquiry-line-tools"><button type="button" className="edit-line" onClick={onEdit}>Edit configuration</button><div className="line-quantity"><button type="button" onClick={() => onQuantity(normaliseQuantity(line.quantity - 1))} aria-label={`Decrease ${line.code} quantity`}>−</button><label><span>Quantity</span><input type="number" min="1" max="9999" value={line.quantity} onChange={event => onQuantity(normaliseQuantity(event.target.value))} aria-label={`${line.code} quantity`} /></label><button type="button" onClick={() => onQuantity(normaliseQuantity(line.quantity + 1))} aria-label={`Increase ${line.code} quantity`}>+</button></div></div>
    </article>
  );
}

function SuccessDialog({ success, onClose, persistenceLabel }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title">
        <span className="success-icon">✓</span>
        <small>{success.emailFailed ? 'RFQ saved to account' : 'RFQ email submitted'}</small>
        <h2 id="success-title">Thank you, {success.firstName}.</h2>
        <p>{success.emailFailed ? <>Your RFQ is safely stored in {persistenceLabel} and remains visible in Order Tracking. The email delivery still needs attention.</> : <>Your RFQ was accepted for <strong>{success.recipient}</strong> and saved in {persistenceLabel}.</>}</p>
        <strong className="success-reference">{success.reference}</strong>
        {success.pricedPdfAttached ? <p className="priced-pdf-note"><span>PDF</span> A protected rep-only PDF with internal price-list estimates was attached.</p> : !success.emailFailed && <p className="activation-note"><span>i</span> The public test fallback sent an unpriced RFQ PDF. Pricing remains private and must be added by the protected service.</p>}
        {success.warning && <p className="activation-note"><span>!</span>{success.warning}</p>}
        {success.fallbackUrl && <a className="email-fallback" href={success.fallbackUrl}>Open my email app with the saved RFQ <span>→</span></a>}
        {success.activationMayBeRequired && <p className="activation-note"><span>i</span> First test only: open the FormSubmit activation email in {success.recipient}. Once confirmed, the queued RFQ will be forwarded.</p>}
        <button className="primary-button full" type="button" onClick={onClose}>View order tracking <span>→</span></button>
      </section>
    </div>
  );
}
