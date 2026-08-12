import { useEffect, useMemo, useState } from 'react';
import {
  isValidRecipientEmail,
  ORDER_COPY_TYPES,
  ORDER_RECIPIENT_TYPES,
} from '../domain/orderDocuments.js';

const documentUrl = document => {
  if (document.previewUrl || document.downloadUrl) return document.previewUrl || document.downloadUrl;
  const binary = globalThis.atob(document.bytesBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
};

export function OrderSummaryPanel({ order, onGenerate, onEmail, onGetOptions, serviceMode }) {
  const [copyType, setCopyType] = useState(ORDER_COPY_TYPES.CUSTOMER);
  const [document, setDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [options, setOptions] = useState({ canEmail: false, representative: null, internalRecipients: [] });
  const [recipientType, setRecipientType] = useState(ORDER_RECIPIENT_TYPES.MANUAL);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [confirmedExternal, setConfirmedExternal] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    onGetOptions(order.id).then(value => {
      if (active) setOptions(value);
    }).catch(loadError => {
      if (active) setError(loadError?.message || 'PDF sharing options could not be loaded.');
    });
    return () => { active = false; };
  }, [onGetOptions, order.id]);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    setDocument(null);
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setMessage('');
    setError('');
  }, [copyType]);

  const effectiveRecipientEmail = recipientType === ORDER_RECIPIENT_TYPES.REPRESENTATIVE
    ? options.representative?.email || ''
    : recipientEmail;
  const external = useMemo(() => {
    const email = effectiveRecipientEmail.toLowerCase();
    if (!email) return false;
    return options.representative?.email?.toLowerCase() !== email
      && !options.internalRecipients.some(item => item.email.toLowerCase() === email);
  }, [effectiveRecipientEmail, options]);

  const generate = async action => {
    setBusyAction(action);
    setError('');
    setMessage('');
    try {
      const generated = await onGenerate(order.id, copyType);
      const nextUrl = documentUrl(generated);
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setDocument(generated);
      setPreviewUrl(nextUrl);
      setMessage(`${generated.classification} generated at ${new Date(generated.generatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}.`);
      if (action === 'download') {
        const link = globalThis.document.createElement('a');
        link.href = nextUrl;
        link.download = generated.fileName;
        link.click();
      }
    } catch (generationError) {
      setError(generationError?.message || 'The order summary PDF could not be generated.');
    } finally {
      setBusyAction('');
    }
  };

  const send = async () => {
    if (!document) {
      setError('Generate the PDF copy you want to send first.');
      return;
    }
    if (!isValidRecipientEmail(effectiveRecipientEmail)) {
      setError('Enter or select a valid recipient email address.');
      return;
    }
    if (external && !confirmedExternal) {
      setError('Confirm that the external recipient is correct before sending.');
      return;
    }
    setBusyAction('email');
    setError('');
    setMessage('');
    try {
      const delivery = await onEmail(order.id, {
        documentId: document.id,
        recipientType,
        recipientEmail: effectiveRecipientEmail,
        confirmedExternal,
      });
      setMessage(`${serviceMode === 'mock' ? 'Simulated email' : 'Email request'} recorded for ${delivery.recipientEmail}.`);
      setConfirmedExternal(false);
    } catch (sendError) {
      setError(sendError?.message || 'The order summary email could not be prepared.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <section className="order-summary-panel" aria-label={`PDF summary for ${order.reference}`}>
      <header>
        <div><span className="eyebrow">Controlled document export</span><h3>Order-summary PDF</h3><p>Create a branded customer-safe copy or an authorised internal operational copy.</p></div>
        <span className="order-summary-format">PDF</span>
      </header>

      <div className="order-summary-controls">
        <label><span>Document classification</span><select value={copyType} onChange={event => setCopyType(event.target.value)}><option value={ORDER_COPY_TYPES.CUSTOMER}>Customer-safe copy</option><option value={ORDER_COPY_TYPES.INTERNAL}>Internal operational copy</option></select></label>
        <div className="order-summary-actions">
          <button type="button" onClick={() => generate('preview')} disabled={Boolean(busyAction)}>{busyAction === 'preview' ? 'Generating...' : 'Generate & preview'}</button>
          <button type="button" onClick={() => generate('download')} disabled={Boolean(busyAction)}>{busyAction === 'download' ? 'Preparing...' : 'Download fresh copy'}</button>
          {document && <button type="button" onClick={() => generate('fresh')} disabled={Boolean(busyAction)}>{busyAction === 'fresh' ? 'Generating...' : 'Generate fresh copy'}</button>}
        </div>
      </div>

      {document && (
        <div className="order-summary-current">
          <span><strong>{document.fileName}</strong><small>{document.classification} · {Math.max(1, Math.round(document.sizeBytes / 1024))} KB</small></span>
          <button type="button" onClick={() => setPreviewUrl(documentUrl(document))}>Preview current PDF</button>
        </div>
      )}

      {options.canEmail && (
        <details className="order-summary-email">
          <summary>Email this generated PDF</summary>
          <div>
            <label><span>Recipient</span><select value={recipientType} onChange={event => { setRecipientType(event.target.value); setRecipientEmail(''); setConfirmedExternal(false); }}><option value={ORDER_RECIPIENT_TYPES.MANUAL}>Manually entered recipient</option><option value={ORDER_RECIPIENT_TYPES.REPRESENTATIVE}>Assigned representative</option><option value={ORDER_RECIPIENT_TYPES.INTERNAL}>Authorised internal address</option></select></label>
            {recipientType === ORDER_RECIPIENT_TYPES.INTERNAL
              ? <label><span>Internal address</span><select value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)}><option value="">Select an authorised address</option>{options.internalRecipients.map(item => <option key={item.id} value={item.email}>{item.name} · {item.email}</option>)}</select></label>
              : recipientType === ORDER_RECIPIENT_TYPES.REPRESENTATIVE
                ? <p className="order-summary-recipient"><strong>{options.representative?.name}</strong>{options.representative?.email}</p>
                : <label><span>Recipient email</span><input type="email" value={recipientEmail} onChange={event => { setRecipientEmail(event.target.value); setConfirmedExternal(false); }} placeholder="name@example.com" /></label>}
            {external && (
              <label className="order-summary-confirm"><input type="checkbox" checked={confirmedExternal} onChange={event => setConfirmedExternal(event.target.checked)} /><span><strong>Confirm external recipient</strong>I have checked this address and confirm that this document is approved for external sharing.</span></label>
            )}
            <button className="order-summary-send" type="button" onClick={send} disabled={Boolean(busyAction) || !document}>{busyAction === 'email' ? 'Recording simulated delivery...' : serviceMode === 'mock' ? 'Simulate email send' : 'Send through secure email service'}</button>
            <p className="order-summary-mock-note">{serviceMode === 'mock' ? 'Demonstration only: no email will be sent.' : 'Confirm the recipient before sending this document.'}</p>
          </div>
        </details>
      )}

      {error && <p className="form-error order-summary-feedback" role="alert">{error}</p>}
      {message && <p className="order-summary-feedback is-success" role="status">{message}</p>}

      {previewUrl && (
        <div className="order-summary-preview" role="dialog" aria-modal="true" aria-label={`${document?.classification || 'Order summary'} preview`}>
          <div><strong>{document?.fileName}</strong><button type="button" onClick={() => setPreviewUrl('')} aria-label="Close PDF preview">Close</button></div>
          <iframe src={previewUrl} title={`${order.reference} PDF preview`} />
        </div>
      )}
    </section>
  );
}
