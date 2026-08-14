import { useState } from 'react';

const label = value => String(value || '').replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, character => character.toUpperCase());
const display = value => Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? 'Not specified');
const configurationFieldIsProtected = key => /^(?:private|internal)|(?:price|pricing|audit|staff)/i.test(String(key || ''));

export function ConfiguredUnitDetails({ unit, context = 'RFQ', extra = null }) {
  const [open, setOpen] = useState(false);
  const configuration = Object.entries(unit.configuration || {}).filter(([key, value]) => !configurationFieldIsProtected(key) && value !== '' && value !== null && value !== undefined);
  const recipient = unit.certificateRecipientSnapshot;
  return <article className="configured-unit-details">
    <button className="configured-unit-summary" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className="configured-unit-image">{unit.image ? <img src={unit.image} alt="" /> : unit.code?.slice(0, 2)}</span>
      <span><small>{context} unit</small><strong>{unit.code || unit.productCode} · {unit.name || unit.productName}</strong><em>Quantity {unit.quantity || 1}</em></span>
      <b>{open ? 'Hide details' : 'Open unit details'} {open ? '−' : '+'}</b>
    </button>
    {open && <div className="configured-unit-body">
      <dl>
        <div><dt>Product</dt><dd>{unit.name || unit.productName || 'Not specified'}</dd></div>
        <div><dt>Product code</dt><dd>{unit.code || unit.productCode || 'Not specified'}</dd></div>
        <div><dt>Quantity</dt><dd>{unit.quantity || 1}</dd></div>
        {configuration.map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{display(value)}</dd></div>)}
        {recipient && <><div><dt>Certificate recipient type</dt><dd>{recipient.recipientType === 'customer_company' ? 'My Company' : 'My Client'}</dd></div><div><dt>Certificate customer name</dt><dd>{recipient.recipientName}</dd></div><div><dt>Certificate address</dt><dd>{recipient.recipientAddress}</dd></div></>}
        {extra && Object.entries(extra).filter(([, value]) => value !== '' && value !== null && value !== undefined).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{display(value)}</dd></div>)}
      </dl>
    </div>}
  </article>;
}
