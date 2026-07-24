import { useEffect, useMemo, useState } from 'react';
import { optionsForField, shouldShowField, toggleMultiChoiceOption } from '../domain/productConfiguration.js';
import { LeadTimeNotice } from './Layout.jsx';

const normaliseQuantity = value => Math.min(9999, Math.max(1, Math.trunc(Number(value) || 1)));

export function Configurator({ product, existingLine, onSave, onCancel }) {
  const [values, setValues] = useState(existingLine?.configuration || {});
  const [quantity, setQuantity] = useState(existingLine?.quantity || 1);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');

  const steps = useMemo(() => [
    { key: '__quantity', label: 'Quantity', type: 'quantity', required: true },
    ...product.configurations.filter(field => shouldShowField(field, values)),
    { key: '__review', label: 'Review configuration', type: 'review' },
  ], [product, values]);

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1);
  }, [steps.length, stepIndex]);

  const field = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const update = value => {
    setError('');
    setValues(current => {
      const next = { ...current, [field.key]: value };
      product.configurations.forEach(candidate => {
        if (candidate.key === field.key) return;
        if (!shouldShowField(candidate, next)) {
          delete next[candidate.key];
          return;
        }
        if (candidate.optionsBy && next[candidate.key] !== undefined) {
          const allowed = optionsForField(candidate, next);
          if (!allowed.includes(next[candidate.key])) delete next[candidate.key];
        }
      });
      return next;
    });
  };

  const validateCurrent = () => {
    if (field.type === 'quantity') return Number(quantity) >= 1;
    const value = values[field.key];
    if (field.required && (value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === ''))) return false;
    return true;
  };

  const next = () => {
    if (!validateCurrent()) {
      setError(field.type === 'quantity' ? 'Quantity must be at least one.' : `Please complete “${field.label}” before continuing.`);
      return;
    }
    setError('');
    setStepIndex(index => Math.min(index + 1, steps.length - 1));
  };

  const save = () => {
    const line = {
      lineId: existingLine?.lineId || `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      image: product.image,
      category: product.category,
      variant: product.variant || '',
      quantity: normaliseQuantity(quantity),
      configuration: Object.fromEntries(product.configurations
        .filter(configField => shouldShowField(configField, values))
        .filter(configField => values[configField.key] !== undefined)
        .map(configField => [configField.key, values[configField.key]])),
      updatedAt: new Date().toISOString(),
    };
    onSave(line);
  };

  return (
    <section className="app-screen configurator-screen" aria-labelledby="configurator-title">
      <header className="configurator-hero">
        <span className="config-product-image"><img src={product.image} alt="" /><b>{product.code}</b></span>
        <div><span className="eyebrow">Guided enquiry builder</span><h1 id="configurator-title">Configure <em>{product.code}</em></h1><p>{product.name}</p></div>
      </header>
      <div className="config-progress"><span style={{ width: `${progress}%` }} /><small>Step {stepIndex + 1} of {steps.length}</small></div>
      <LeadTimeNotice compact />

      <div className="config-stage" key={field.key}>
        <div className="config-stage-number">{String(stepIndex + 1).padStart(2, '0')}</div>
        {field.type === 'quantity' && <QuantityStep quantity={quantity} setQuantity={setQuantity} product={product} />}
        {field.type === 'choice' && <ChoiceStep field={field} options={optionsForField(field, values)} value={values[field.key]} onChange={update} />}
        {field.type === 'multiChoice' && <MultiChoiceStep field={field} options={optionsForField(field, values)} value={values[field.key] || []} onChange={update} />}
        {field.type === 'select' && <SelectStep field={field} options={optionsForField(field, values)} value={values[field.key]} onChange={update} />}
        {field.type === 'text' && <TextStep field={field} value={values[field.key] || ''} onChange={update} />}
        {field.type === 'textarea' && <TextAreaStep field={field} value={values[field.key] || ''} onChange={update} />}
        {field.type === 'toggle' && <ToggleStep field={field} value={Boolean(values[field.key])} onChange={update} />}
        {field.type === 'review' && <ReviewStep product={product} quantity={quantity} values={values} fields={product.configurations} />}
        {error && <p className="config-error" role="alert">{error}</p>}
      </div>

      <div className="config-actions">
        <button type="button" className="secondary-button" onClick={stepIndex === 0 ? onCancel : () => { setError(''); setStepIndex(index => Math.max(0, index - 1)); }}>{stepIndex === 0 ? 'Cancel' : '← Back'}</button>
        {field.type === 'review' ? <button type="button" className="primary-button" onClick={save}>{existingLine ? 'Update unit' : product.consultationOnly ? 'Add consultation' : 'Add to enquiry'} <span>→</span></button> : <button type="button" className="primary-button" onClick={next}>Continue <span>→</span></button>}
      </div>
    </section>
  );
}

function QuantityStep({ quantity, setQuantity, product }) {
  return (
    <div className="config-question">
      <span className="eyebrow">Per configured unit</span><h2>How many {product.code} units do you need?</h2><p>Quantity is stored on this product line. Every other product in the enquiry keeps its own quantity.</p>
      <div className="large-quantity"><button type="button" onClick={() => setQuantity(normaliseQuantity(quantity - 1))} aria-label="Decrease quantity">−</button><input type="number" min="1" max="9999" value={quantity} onChange={event => setQuantity(normaliseQuantity(event.target.value))} aria-label="Quantity" /><button type="button" onClick={() => setQuantity(normaliseQuantity(quantity + 1))} aria-label="Increase quantity">+</button></div>
    </div>
  );
}

function QuestionHeader({ field }) {
  return <><span className="eyebrow">Product configuration</span><h2>{field.label}</h2>{field.help && <p>{field.help}</p>}</>;
}

function ChoiceStep({ field, options, value, onChange }) {
  return <div className="config-question"><QuestionHeader field={field} /><div className="choice-grid">{options.map(option => <button key={option} type="button" className={value === option ? 'selected' : ''} onClick={() => onChange(option)}><span>{value === option ? '✓' : ''}</span><strong>{option}</strong></button>)}</div></div>;
}

function MultiChoiceStep({ field, options, value, onChange }) {
  const toggleOption = option => onChange(toggleMultiChoiceOption(field, value, option));
  return <div className="config-question"><QuestionHeader field={field} /><div className="choice-grid multi-choice-grid">{options.map(option => <button key={option} type="button" className={value.includes(option) ? 'selected' : ''} onClick={() => toggleOption(option)}><span>{value.includes(option) ? '✓' : ''}</span><strong>{option}</strong></button>)}</div><p className="multi-choice-hint">{field.exclusiveOption ? `Choose any extras that apply, or select “${field.exclusiveOption}”.` : 'Choose any options that apply.'}</p></div>;
}

function SelectStep({ field, options, value, onChange }) {
  return <div className="config-question"><QuestionHeader field={field} /><label className="config-select"><span>Select an option</span><select value={value || ''} onChange={event => onChange(event.target.value)}><option value="" disabled>Choose {field.label.toLowerCase()}</option>{options.map(option => <option key={option}>{option}</option>)}</select></label></div>;
}

function TextStep({ field, value, onChange }) {
  return <div className="config-question"><QuestionHeader field={field} /><label className="config-input"><span>{field.label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} /></label></div>;
}

function TextAreaStep({ field, value, onChange }) {
  return <div className="config-question"><QuestionHeader field={field} />{field.key === 'chemicalSealNotes' && <div className="seal-contact-message"><span>i</span><p>Our sales representative will contact you to discuss the correct chemical seal for your application.</p></div>}<label className="config-input"><span>{field.label}</span><textarea value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} rows="5" /></label></div>;
}

function ToggleStep({ field, value, onChange }) {
  const isSeal = field.key === 'chemicalSeal';
  return (
    <div className="config-question"><QuestionHeader field={field} />
      <div className="toggle-choice"><button type="button" className={!value ? 'selected' : ''} onClick={() => onChange(false)}><span>{!value ? '✓' : ''}</span><strong>No</strong><small>Not required</small></button><button type="button" className={value ? 'selected' : ''} onClick={() => onChange(true)}><span>{value ? '✓' : ''}</span><strong>Yes</strong><small>Request sales review</small></button></div>
      {isSeal && value && <div className="seal-contact-message"><span>i</span><p><strong>Rhomberg will select the seal.</strong> Our sales representative will contact you to discuss the correct chemical seal for your application.</p></div>}
    </div>
  );
}

function ReviewStep({ product, quantity, values, fields }) {
  const rows = fields
    .filter(field => shouldShowField(field, values))
    .filter(field => values[field.key] !== undefined && values[field.key] !== '');
  return (
    <div className="config-question review-question"><span className="eyebrow">Final check</span><h2>Review this configured unit</h2><p>You can edit it again from the enquiry page before submission.</p>
      <div className="review-product"><img src={product.image} alt="" /><div><strong>{product.code}</strong><small>{product.name}</small></div><b>Qty {quantity}</b></div>
      <dl className="review-config-list">{rows.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{formatConfigurationValue(values[field.key])}</dd></div>)}</dl>
    </div>
  );
}

function formatConfigurationValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}
