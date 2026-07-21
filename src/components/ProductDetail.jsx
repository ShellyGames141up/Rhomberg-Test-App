import { useState } from 'react';
import { LeadTimeNotice } from './Layout.jsx';

export function ProductDetail({ product, category, onConfigure }) {
  const [tab, setTab] = useState('overview');
  const tabs = [['overview', 'Overview'], ['specs', 'Technical specs'], ['config', 'Configurations'], ['datasheets', 'Datasheets']];

  return (
    <section className="app-screen product-detail" aria-labelledby="product-title">
      <div className="product-hero">
        <span className="product-category-chip">{category?.name}</span>
        <div className="product-image-stage"><span className="product-code-watermark">{product.code}</span><img src={product.image} alt={product.name} /></div>
        <div className="product-hero-copy"><span className="eyebrow">Product information</span><h1 id="product-title"><em>{product.code}</em> {product.name}</h1><p>{product.description}</p></div>
        <div className="product-key-specs">
          <span><small>{product.category === 'pressure' && product.variant === 'gauge' ? 'Pressure capability' : 'Measuring range'}</small><strong>{product.category === 'pressure' && product.variant === 'gauge' ? product.pressureRange : product.measuringRange}</strong></span>
          <span><small>Selectable range</small><strong>{product.measuringRange}</strong></span>
          <span><small>Accuracy</small><strong>{product.accuracy}</strong></span>
        </div>
      </div>

      <div className="product-tabs" role="tablist" aria-label="Product information sections">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      <div className="product-tab-panel">
        {tab === 'overview' && <Overview product={product} />}
        {tab === 'specs' && <Specifications groups={product.specGroups} />}
        {tab === 'config' && <ConfigurationOverview product={product} />}
        {tab === 'datasheets' && <Datasheets product={product} />}
      </div>

      <div className="product-detail-lead"><LeadTimeNotice compact /></div>
      <div className="product-sticky-cta">
        <div><small>{product.consultationOnly ? 'Application review' : 'Ready to continue?'}</small><strong>{product.consultationOnly ? 'Let Rhomberg select the correct seal' : 'Configure this unit'}</strong></div>
        <button type="button" onClick={onConfigure}>{product.consultationOnly ? 'Request consultation' : 'Configure'} <span>→</span></button>
      </div>
    </section>
  );
}

function Overview({ product }) {
  return (
    <div className="overview-panel">
      <span className="eyebrow">Built for the application</span>
      <h2>Product overview</h2>
      <p>{product.description}</p>
      <div className="overview-feature-grid">
        <Feature icon="⌁" title="Application" copy={product.application} />
        <Feature icon="◎" title="Measurement" copy={product.measuringRange} />
        <Feature icon="◇" title="Construction" copy={product.caseMaterial} />
        <Feature icon="✓" title="Specification review" copy="Rhomberg confirms the final configuration and availability with every quotation." />
      </div>
      {product.consultationOnly && <div className="seal-policy"><span>i</span><p><strong>Seal selection is handled by Rhomberg.</strong> Customers provide application details only. A sales representative will recommend the correct diaphragm, material and connection.</p></div>}
    </div>
  );
}

function Feature({ icon, title, copy }) {
  return <article className="overview-feature"><span>{icon}</span><div><strong>{title}</strong><small>{copy}</small></div></article>;
}

function Specifications({ groups }) {
  return <div className="specification-panel"><span className="eyebrow">Organised by specification group</span><h2>Technical specifications</h2><div className="spec-group-grid">{groups.map(group => <SpecGroup key={group.title} group={group} />)}</div></div>;
}

function SpecGroup({ group }) {
  return <article className={`spec-group ${group.tone}`}><h3>{group.title}</h3><dl>{group.items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>;
}

function ConfigurationOverview({ product }) {
  const visibleFields = product.configurations.filter(field => !['customRange', 'chemicalSealNotes'].includes(field.key));
  return (
    <div className="configuration-overview">
      <span className="eyebrow">Only relevant choices</span><h2>Available configurations</h2>
      <p>The guided enquiry builder presents these options one at a time. Rules automatically hide SANAS outside Pressure and Traceability outside Temperature.</p>
      <div className="configuration-list">{visibleFields.map((field, index) => {
        const selectionCount = field.options?.length || 1;
        return <article key={field.key}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{field.label}</strong><small>{field.help || `${selectionCount} available selection${selectionCount === 1 ? '' : 's'}`}{field.showWhen ? ' · shown only when applicable' : ''}</small></div></article>;
      })}</div>
      {product.rules.chemicalSealRequest && <div className="seal-policy"><span>✓</span><p><strong>Chemical seal request, not self-configuration.</strong> Selecting the seal toggle asks for application notes and alerts a Rhomberg representative.</p></div>}
    </div>
  );
}

function Datasheets({ product }) {
  return (
    <div className="datasheet-panel"><span className="eyebrow">Technical documents</span><h2>Datasheets & guides</h2>
      {product.datasheets.length ? <div className="datasheet-list">{product.datasheets.map(sheet => <a key={sheet.url} href={sheet.url} target="_blank" rel="noopener"><span>PDF</span><div><strong>{sheet.label}</strong><small>Open product information document</small></div><i>↗</i></a>)}</div> : <div className="datasheet-empty"><span>PDF</span><strong>Datasheet available on request</strong><p>Add the product to an enquiry and the relevant document can be supplied with the quotation.</p></div>}
    </div>
  );
}
