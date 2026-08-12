import { useEffect, useMemo, useRef, useState } from 'react';
import { optionsForField, shouldShowField, toggleMultiChoiceOption } from '../domain/productConfiguration.js';
import { friendlyServiceError } from '../services/contracts.js';
import { LeadTimeNotice } from './Layout.jsx';

const newSubmissionKey = () => globalThis.crypto?.randomUUID?.()
  || `representative-order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);
const emptyValues = Object.freeze({
  companyId: '',
  customerContactId: '',
  branchId: '',
  representativeId: '',
  orderSource: '',
  orderSourceOther: '',
  application: '',
  fulfilment: '',
  deliveryAddress: '',
  customerNotes: '',
  internalRepresentativeNotes: '',
  requiredDate: '',
  priority: 'standard',
  quotationNumber: '',
  quotationDate: today(),
  quotationRevision: '',
  purchaseOrderNumber: '',
  purchaseOrderDate: today(),
  confirmationNote: '',
  sourceConfirmed: false,
  duplicateConfirmed: false,
});

const fieldValue = value => Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '');
const humanise = value => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());

export function RepresentativeOrderLoader({ actions, maxDocumentBytes, onCreated, onClose }) {
  const [options, setOptions] = useState({ companies: [], contacts: [], branches: [], representatives: [], products: [], orderSources: [], priorities: [] });
  const [values, setValues] = useState(emptyValues);
  const [quotationFile, setQuotationFile] = useState(null);
  const [purchaseOrderFile, setPurchaseOrderFile] = useState(null);
  const [supportingDocuments, setSupportingDocuments] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQuantity, setLineQuantity] = useState(1);
  const [configuration, setConfiguration] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const submissionKey = useRef(newSubmissionKey());

  useEffect(() => {
    let active = true;
    actions.getOptions()
      .then(result => {
        if (!active) return;
        setOptions(result);
        const soleRepresentative = result.representatives.length === 1 ? result.representatives[0] : null;
        if (soleRepresentative) setValues(current => ({ ...current, representativeId: soleRepresentative.id, branchId: soleRepresentative.branchId }));
        setLoading(false);
      })
      .catch(loadError => {
        if (!active) return;
        setError(friendlyServiceError(loadError, 'The representative order form could not load.'));
        setLoading(false);
      });
    return () => { active = false; };
  }, [actions]);

  const selectedProduct = options.products.find(product => product.id === selectedProductId) || null;
  const companyContacts = options.contacts.filter(contact => contact.companyId === values.companyId);
  const branchRepresentatives = options.representatives.filter(representative => representative.branchId === values.branchId);
  const selectedCompany = options.companies.find(company => company.id === values.companyId);
  const selectedContact = options.contacts.find(contact => contact.id === values.customerContactId);
  const selectedRepresentative = options.representatives.find(representative => representative.id === values.representativeId);
  const visibleConfigurationFields = useMemo(
    () => selectedProduct?.configurations?.filter(field => shouldShowField(field, configuration)) || [],
    [configuration, selectedProduct],
  );

  const update = (key, value) => {
    setError('');
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setValues(current => {
      const next = { ...current, [key]: value };
      if (key === 'companyId') next.customerContactId = '';
      if (key === 'branchId' && !options.representatives.some(rep => rep.id === next.representativeId && rep.branchId === value)) next.representativeId = '';
      if (key === 'representativeId') {
        const representative = options.representatives.find(rep => rep.id === value);
        if (representative) next.branchId = representative.branchId;
      }
      if (key === 'orderSource' && value !== 'other_approved_source') next.orderSourceOther = '';
      if (key === 'fulfilment' && value !== 'delivery') next.deliveryAddress = '';
      return next;
    });
  };

  const updateConfiguration = (field, value) => {
    setConfiguration(current => {
      const next = { ...current, [field.key]: value };
      selectedProduct.configurations.forEach(candidate => {
        if (candidate.key === field.key) return;
        if (!shouldShowField(candidate, next)) delete next[candidate.key];
        else if (candidate.optionsBy && next[candidate.key] !== undefined && !optionsForField(candidate, next).includes(next[candidate.key])) delete next[candidate.key];
      });
      return next;
    });
  };

  const addLine = () => {
    setError('');
    if (!selectedProduct) {
      setError('Choose a product before adding the line.');
      return;
    }
    const missing = visibleConfigurationFields.find(field => field.required && (configuration[field.key] === undefined || configuration[field.key] === '' || (Array.isArray(configuration[field.key]) && !configuration[field.key].length)));
    if (missing) {
      setError(`Complete “${missing.label}” for ${selectedProduct.code}.`);
      return;
    }
    const quantity = Math.trunc(Number(lineQuantity));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      setError('Enter a quantity between 1 and 9,999.');
      return;
    }
    setLines(current => [...current, {
      lineId: `${selectedProduct.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      description: selectedProduct.description,
      image: selectedProduct.image,
      category: selectedProduct.category,
      quantity,
      configuration: Object.fromEntries(visibleConfigurationFields
        .filter(field => configuration[field.key] !== undefined && configuration[field.key] !== '')
        .map(field => [field.key, configuration[field.key]])),
    }]);
    setSelectedProductId('');
    setLineQuantity(1);
    setConfiguration({});
  };

  const chooseFile = (setter, multiple = false) => event => {
    const files = [...(event.target.files || [])];
    setError('');
    if (!files.length) {
      setter(multiple ? [] : null);
      return;
    }
    const invalid = files.find(file => file.size < 1 || file.size > maxDocumentBytes);
    if (invalid) {
      event.target.value = '';
      setter(multiple ? [] : null);
      setError(`Choose non-empty documents no larger than ${Math.round(maxDocumentBytes / 1024 / 1024)} MB each.`);
      return;
    }
    setter(multiple ? files : files[0]);
  };

  const submit = async event => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await actions.create({
        ...values,
        submissionKey: submissionKey.current,
        items: lines,
        quotationFile,
        purchaseOrderFile,
        supportingDocuments,
      });
      setCreatedOrder(result.order);
      setDuplicateCheck(null);
      await onCreated(result.order);
    } catch (submitError) {
      setFieldErrors(submitError?.fieldErrors || {});
      setError(friendlyServiceError(submitError, 'The customer order could not be created. Check the form and try again.'));
      if (submitError?.code === 'LIKELY_DUPLICATE_ORDER') setDuplicateCheck(submitError.details?.duplicateCheck || { likelyDuplicate: true, matches: [] });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <section className="app-screen representative-order-screen"><div className="app-state-card"><span className="state-spinner" /><h1>Preparing customer order form</h1></div></section>;
  if (createdOrder) return (
    <section className="app-screen representative-order-screen" aria-labelledby="representative-order-success">
      <div className="representative-order-success">
        <span>✓</span><small>Order loaded by Sales Representative</small>
        <h1 id="representative-order-success">Order sent to Planning.</h1>
        <strong>{createdOrder.reference}</strong>
        <p>{createdOrder.company} can now see the customer-safe order summary, quotation and Purchase Order metadata in Rhomberg Connect.</p>
        <button className="primary-button" type="button" onClick={onClose}>Return to workspace <span>→</span></button>
      </div>
    </section>
  );

  return (
    <section className="app-screen representative-order-screen" aria-labelledby="representative-order-title">
      <header className="expeditor-hero representative-order-hero">
        <span className="eyebrow">Controlled offline-order intake</span>
        <h1 id="representative-order-title">Load Customer Order</h1>
        <p>Create an order received outside Rhomberg Connect. A matching customer quotation and Purchase Order are mandatory.</p>
      </header>
      <LeadTimeNotice compact />

      <form className="representative-order-form" onSubmit={submit} noValidate>
        <OrderSection index="01" title="Customer and assignment" help="Select an existing authorised account before entering order details.">
          <div className="form-grid representative-order-grid">
            <Field label="Customer company" error={fieldErrors.companyId}><select value={values.companyId} onChange={event => update('companyId', event.target.value)} required><option value="">Choose company</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.area}</option>)}</select></Field>
            <Field label="Authorised customer contact" error={fieldErrors.customerContactId}><select value={values.customerContactId} onChange={event => update('customerContactId', event.target.value)} required disabled={!values.companyId}><option value="">Choose contact</option>{companyContacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email}</option>)}</select></Field>
            <Field label="Assigned branch" error={fieldErrors.branchId}><select value={values.branchId} onChange={event => update('branchId', event.target.value)} required><option value="">Choose branch</option>{options.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
            <Field label="Dedicated representative" error={fieldErrors.representativeId}><select value={values.representativeId} onChange={event => update('representativeId', event.target.value)} required disabled={!values.branchId}><option value="">Choose representative</option>{branchRepresentatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · Code {rep.code}</option>)}</select></Field>
            <Field label="Order source" error={fieldErrors.orderSource}><select value={values.orderSource} onChange={event => update('orderSource', event.target.value)} required><option value="">Choose approved source</option>{options.orderSources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}</select></Field>
            {values.orderSource === 'other_approved_source' && <Field label="Other approved source" error={fieldErrors.orderSourceOther}><input value={values.orderSourceOther} onChange={event => update('orderSourceOther', event.target.value)} placeholder="Explain how the order was received" required /></Field>}
          </div>
          {selectedCompany && selectedContact && <p className="representative-order-selection"><strong>{selectedCompany.name}</strong><span>{selectedContact.name} · {selectedContact.email}</span>{selectedRepresentative && <span>{selectedRepresentative.name} · {selectedRepresentative.branchName}</span>}</p>}
        </OrderSection>

        <OrderSection index="02" title="Configured products" help="Each product line stores its own quantity and configuration snapshot.">
          <div className="representative-product-builder">
            <div className="form-grid representative-order-grid">
              <Field label="Product"><select value={selectedProductId} onChange={event => { setSelectedProductId(event.target.value); setConfiguration({}); }}><option value="">Choose product</option>{options.products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></Field>
              <Field label="Quantity"><input type="number" min="1" max="9999" value={lineQuantity} onChange={event => setLineQuantity(event.target.value)} /></Field>
            </div>
            {selectedProduct && <div className="representative-configuration-grid">{visibleConfigurationFields.map(field => <ConfigurationField key={field.key} field={field} configuration={configuration} onChange={value => updateConfiguration(field, value)} />)}</div>}
            <button className="secondary-button representative-add-line" type="button" onClick={addLine} disabled={!selectedProduct}>Add configured product <span>+</span></button>
          </div>
          <div className="representative-order-lines">{lines.map((line, index) => <article key={line.lineId}><img src={line.image} alt="" /><div><small>Line {index + 1}</small><strong>{line.code} · {line.name}</strong><p>{Object.entries(line.configuration).map(([key, value]) => `${humanise(key)}: ${fieldValue(value)}`).join(' · ') || 'Standard product configuration'}</p></div><b>× {line.quantity}</b><button type="button" onClick={() => setLines(current => current.filter(item => item.lineId !== line.lineId))} aria-label={`Remove ${line.code}`}>×</button></article>)}</div>
          {fieldErrors.items && <p className="field-error" role="alert">{fieldErrors.items}</p>}
        </OrderSection>

        <OrderSection index="03" title="Application and fulfilment" help="Customer-safe detail is kept separate from internal representative notes.">
          <div className="form-grid representative-order-grid">
            <Field label="Customer application or requirement" error={fieldErrors.application} wide><textarea rows="4" value={values.application} onChange={event => update('application', event.target.value)} placeholder="Describe what the instruments will measure and where they will be used" required /></Field>
            <Field label="Required date" error={fieldErrors.requiredDate}><input type="date" min={today()} value={values.requiredDate} onChange={event => update('requiredDate', event.target.value)} /></Field>
            <Field label="Internal priority" error={fieldErrors.priority}><select value={values.priority} onChange={event => update('priority', event.target.value)}>{options.priorities.map(priority => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></Field>
            <Field label="Supply method" error={fieldErrors.fulfilment}><select value={values.fulfilment} onChange={event => update('fulfilment', event.target.value)} required><option value="">Choose delivery or collection</option><option value="delivery">Delivery</option><option value="collect">Collection</option></select></Field>
            {values.fulfilment === 'delivery' && <Field label="Delivery address" error={fieldErrors.deliveryAddress} wide><textarea rows="3" value={values.deliveryAddress} onChange={event => update('deliveryAddress', event.target.value)} required /></Field>}
            <Field label="Customer notes" error={fieldErrors.customerNotes} wide><textarea rows="3" value={values.customerNotes} onChange={event => update('customerNotes', event.target.value)} placeholder="Visible to the authorised customer" /></Field>
            <Field label="Internal representative notes" error={fieldErrors.internalRepresentativeNotes} wide><textarea rows="3" value={values.internalRepresentativeNotes} onChange={event => update('internalRepresentativeNotes', event.target.value)} placeholder="Internal only · never shown to customers" /></Field>
          </div>
        </OrderSection>

        <OrderSection index="04" title="Quotation and Purchase Order" help="Both customer documents are mandatory. PDF is preferred; approved DOCX, DOC or image files are also supported in the preview.">
          <div className="representative-document-columns">
            <DocumentPanel title="Customer quotation" file={quotationFile} onFile={chooseFile(setQuotationFile)} error={fieldErrors.quotationFile}>
              <Field label="Quotation number" error={fieldErrors.quotationNumber}><input value={values.quotationNumber} onChange={event => update('quotationNumber', event.target.value)} required /></Field>
              <Field label="Quotation date" error={fieldErrors.quotationDate}><input type="date" max={today()} value={values.quotationDate} onChange={event => update('quotationDate', event.target.value)} required /></Field>
              <Field label="Version or revision (optional)" error={fieldErrors.quotationRevision}><input value={values.quotationRevision} onChange={event => update('quotationRevision', event.target.value)} /></Field>
            </DocumentPanel>
            <DocumentPanel title="Customer Purchase Order" file={purchaseOrderFile} onFile={chooseFile(setPurchaseOrderFile)} error={fieldErrors.purchaseOrderFile}>
              <Field label="Purchase Order number" error={fieldErrors.purchaseOrderNumber}><input value={values.purchaseOrderNumber} onChange={event => update('purchaseOrderNumber', event.target.value)} required /></Field>
              <Field label="Purchase Order date" error={fieldErrors.purchaseOrderDate}><input type="date" max={today()} value={values.purchaseOrderDate} onChange={event => update('purchaseOrderDate', event.target.value)} required /></Field>
            </DocumentPanel>
          </div>
          <label className="representative-supporting-upload"><span>Supporting documents <i>Optional</i></span><input type="file" multiple accept=".pdf,.doc,.docx,image/*" onChange={chooseFile(setSupportingDocuments, true)} /><small>{supportingDocuments.length ? `${supportingDocuments.length} supporting file(s) selected` : 'Up to eight approved documents · metadata only in mock mode'}</small></label>
        </OrderSection>

        <OrderSection index="05" title="Representative confirmation" help="This confirmation becomes part of the immutable order-origin audit record.">
          <ul className="representative-confirmation-list"><li>The quotation was sent to and accepted by the customer.</li><li>The uploaded PO belongs to the selected customer.</li><li>The quotation and PO relate to the same order.</li><li>Product details and quantities were checked.</li><li>I am authorised to load this order.</li></ul>
          <label className="consent-row"><input type="checkbox" checked={values.sourceConfirmed} onChange={event => update('sourceConfirmed', event.target.checked)} required /><span>I confirm all five checks above are accurate.</span></label>
          <Field label="Internal confirmation note (optional)" error={fieldErrors.confirmationNote}><textarea rows="3" value={values.confirmationNote} onChange={event => update('confirmationNote', event.target.value)} /></Field>
          {duplicateCheck?.likelyDuplicate && <div className="representative-duplicate-warning" role="alert"><strong>Possible duplicate detected</strong><p>{duplicateCheck.matches?.length ? `Matching order: ${duplicateCheck.matches.map(match => match.orderReference).join(', ')}` : 'A similar recent order or matching reference already exists.'}</p><label><input type="checkbox" checked={values.duplicateConfirmed} onChange={event => update('duplicateConfirmed', event.target.checked)} /><span>I reviewed the warning and confirm this is a separate authorised order.</span></label></div>}
        </OrderSection>

        {error && <p className="form-error submit-error" role="alert">{error}</p>}
        <div className="representative-order-submit"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating order…' : duplicateCheck ? 'Confirm and create order' : 'Create order and send to Planning'} <span>→</span></button></div>
      </form>
    </section>
  );
}

function OrderSection({ index, title, help, children }) {
  return <section className="enquiry-section form-panel representative-order-section"><div className="panel-index"><span>{index}</span><div><strong>{title}</strong><small>{help}</small></div></div>{children}</section>;
}

function Field({ label, error, wide = false, children }) {
  return <label className={`form-field ${wide ? 'representative-field-wide' : ''}`}><span>{label}</span>{children}{error && <small className="field-error" role="alert">{error}</small>}</label>;
}

function DocumentPanel({ title, file, onFile, error, children }) {
  return <section className="representative-document-panel"><h3>{title}</h3><div className="representative-document-fields">{children}</div><label className={`po-upload ${file ? 'has-file' : ''}`}><input type="file" accept=".pdf,.doc,.docx,image/*" onChange={onFile} required /><span>↑</span><div><strong>{file?.name || `Attach ${title.toLowerCase()}`}</strong><small>{file ? `${Math.ceil(file.size / 1024)} KB · ready for validation` : 'PDF preferred · maximum 4 MB'}</small></div></label>{error && <p className="field-error" role="alert">{error}</p>}</section>;
}

function ConfigurationField({ field, configuration, onChange }) {
  const value = configuration[field.key];
  const choices = optionsForField(field, configuration);
  if (field.type === 'toggle') return <label className="representative-config-toggle"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.type === 'multiChoice') return <fieldset className="representative-config-multi"><legend>{field.label}{field.required ? ' *' : ''}</legend>{choices.map(choice => <label key={choice}><input type="checkbox" checked={(value || []).includes(choice)} onChange={() => onChange(toggleMultiChoiceOption(field, value || [], choice))} /><span>{choice}</span></label>)}</fieldset>;
  if (field.type === 'textarea') return <Field label={`${field.label}${field.required ? ' *' : ''}`}><textarea rows="3" value={value || ''} onChange={event => onChange(event.target.value)} /></Field>;
  if (field.type === 'text') return <Field label={`${field.label}${field.required ? ' *' : ''}`}><input value={value || ''} onChange={event => onChange(event.target.value)} /></Field>;
  return <Field label={`${field.label}${field.required ? ' *' : ''}`}><select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">Choose option</option>{choices.map(choice => <option key={choice}>{choice}</option>)}</select></Field>;
}
