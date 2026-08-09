import { useEffect, useMemo, useState } from 'react';
import { tutorialDraftForStep, TUTORIAL_STEPS, TUTORIALS } from '../domain/userSettings.js';

const FAKE_RFQ = Object.freeze({ reference: 'RQ-TUTORIAL-0001', productCode: 'PBG', productName: 'Bourdon Tube Pressure Gauge', representative: 'Ericu' });

export function FirstCustomerWelcome({ account, reduceMotion, onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, reduceMotion ? 900 : 2850);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);
  const firstName = account.contact.split(/\s+/)[0];
  return <section className={`first-welcome ${reduceMotion ? 'reduce-motion' : ''}`} aria-label={`Welcome, ${firstName}`}>
    <div className="first-welcome-glow" aria-hidden="true" />
    <div className="animated-gauge"><img src="assets/images/rhomberg-connect-symbol.png" alt="" /><i /></div>
    <p>Welcome, {firstName}</p><h1>Welcome to Rhomberg Connect</h1><span>Your customer journey is ready.</span>
  </section>;
}

export function CustomerTutorial({ kind = 'full', startAt, onProgress, onFinish, onSkip }) {
  const configuredStart = useMemo(() => TUTORIALS.find(item => item.id === kind)?.startStep || 0, [kind]);
  const initialStep = Math.min(TUTORIAL_STEPS.length - 1, Math.max(configuredStart, Number(startAt) || 0));
  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState(() => tutorialDraftForStep(initialStep));
  const current = TUTORIAL_STEPS[step];
  const move = next => {
    const safe = Math.min(TUTORIAL_STEPS.length - 1, Math.max(0, next));
    setStep(safe);
    setDraft(existing => ({ ...tutorialDraftForStep(safe), ...existing }));
    onProgress?.(safe, kind);
  };
  const previous = () => {
    const next = Math.max(0, step - 1);
    setDraft(tutorialDraftForStep(next));
    move(next);
  };

  return <section className="tutorial-overlay tutorial-interactive" aria-modal="true" role="dialog" aria-labelledby="tutorial-title">
    <div className="tutorial-dim" />
    <div className={`tutorial-stage tutorial-app target-${current.target}`} data-tutorial-step={step + 1}>
      <header><img src="assets/images/rhomberg-connect-logo-compact.png" alt="Rhomberg Connect" /><span>Tutorial Example</span></header>
      <nav aria-label="Tutorial navigation"><button type="button" disabled>Home</button><button type="button" className={step === 1 ? 'tutorial-target is-pulsing' : step >= 2 && step <= 5 ? 'is-active' : ''} disabled={step !== 1} onClick={() => move(2)}>Catalogue</button><button type="button" className={step >= 6 && step <= 9 ? 'is-active' : ''} disabled>RFQs</button><button type="button" className={step >= 10 ? 'is-active' : ''} disabled>Tracking</button></nav>
      <main>{renderTutorialScreen(step, draft, setDraft, move, onFinish)}</main>
    </div>
    <article className="tutorial-tooltip"><span>Step {step + 1} of {TUTORIAL_STEPS.length}</span><h2 id="tutorial-title">{current.title}</h2><p>{current.copy}</p><small>Tutorial Example · fabricated and excluded from operational records</small><div><button className="text-button" type="button" onClick={onSkip}>Skip tutorial</button>{step > 0 && step < TUTORIAL_STEPS.length - 1 && <button className="secondary-button" type="button" onClick={previous}>Previous</button>}{step === 0 && <button className="primary-button" type="button" onClick={() => move(1)}>Start guided RFQ</button>}</div></article>
  </section>;
}

function renderTutorialScreen(step, draft, setDraft, move, onFinish) {
  if (step <= 1) return <section className="tutorial-home"><p>Good day, Tutorial Customer</p><h3>What can we help you measure?</h3><div className="tutorial-home-actions"><button type="button" disabled={step !== 1} className={step === 1 ? 'tutorial-target is-pulsing' : ''} onClick={() => move(2)}><span>⌕</span><strong>Catalogue</strong><small>Browse measurement instruments</small></button><button type="button" disabled><span>◎</span><strong>Track RFQs</strong><small>Follow safe progress</small></button></div></section>;
  if (step === 2) return <section className="tutorial-catalogue"><p className="eyebrow">Product catalogue</p><h3>Choose what you need to measure</h3><div className="tutorial-category-grid"><button type="button" className="tutorial-target is-pulsing" onClick={() => move(3)}><span>P</span><strong>Pressure</strong><small>Gauges and transmitters</small></button>{['Temperature', 'Flow', 'Level'].map((label, index) => <button type="button" disabled key={label}><span>{['T', 'F', 'L'][index]}</span><strong>{label}</strong></button>)}</div></section>;
  if (step === 3) return <section className="tutorial-products"><p className="eyebrow">Pressure instruments</p><h3>Select a unit</h3><article className="tutorial-product-card tutorial-target is-pulsing"><div className="tutorial-gauge-visual">PBG</div><div><small>Mechanical pressure gauge</small><strong>{FAKE_RFQ.productName}</strong><p>Reliable local pressure indication for industrial applications.</p></div><button type="button" onClick={() => move(4)}>Choose PBG</button></article></section>;
  if (step === 4) return <section className="tutorial-product-detail"><div className="tutorial-gauge-visual is-large">PBG</div><div><p className="eyebrow">Pressure · PBG</p><h3>{FAKE_RFQ.productName}</h3><p>Configure a fabricated 100 mm gauge for a water-line training example.</p><button className="primary-button tutorial-target is-pulsing" type="button" onClick={() => move(5)}>Configure this unit</button></div></section>;
  if (step === 5) {
    const ready = Boolean(draft.range && draft.connection);
    return <section className="tutorial-configurator"><p className="eyebrow">Configure PBG</p><h3>Choose the required options</h3><label><span>Pressure range</span><select aria-label="Tutorial pressure range" value={draft.range} onChange={event => setDraft(value => ({ ...value, range: event.target.value }))}><option value="">Choose a range</option><option>0 to 10 bar</option><option>0 to 16 bar</option></select></label><label><span>Process connection</span><select aria-label="Tutorial process connection" value={draft.connection} onChange={event => setDraft(value => ({ ...value, connection: event.target.value }))}><option value="">Choose a connection</option><option>1/2 inch BSP</option><option>1/4 inch NPT</option></select></label><aside><strong>Your safe configuration</strong><span>{draft.range || 'Range not selected'}</span><span>{draft.connection || 'Connection not selected'}</span></aside><button className={`primary-button ${ready ? 'tutorial-target is-pulsing' : ''}`} type="button" disabled={!ready} onClick={() => move(6)}>Add configured unit to RFQ</button></section>;
  }
  if (step === 6) return <section className="tutorial-rfq"><p className="eyebrow">New fabricated RFQ</p><h3>Review your configured unit</h3><article><div className="tutorial-gauge-visual">PBG</div><div><strong>{FAKE_RFQ.productName}</strong><span>{draft.range} · {draft.connection}</span><small>Quantity 1</small></div></article><button className="primary-button tutorial-target is-pulsing" type="button" onClick={() => move(7)}>Continue with RFQ details</button></section>;
  if (step === 7) {
    const ready = draft.application.trim().length >= 8 && Boolean(draft.fulfilment);
    return <section className="tutorial-details"><p className="eyebrow">Application and fulfilment</p><h3>Tell Rhomberg how the unit will be used</h3><label><span>Application</span><textarea aria-label="Tutorial application" value={draft.application} onChange={event => setDraft(value => ({ ...value, application: event.target.value }))} placeholder="Example: Water-line pressure monitoring" /></label><div className="tutorial-rep-memory"><span>R</span><div><small>Remembered company representative</small><strong>{FAKE_RFQ.representative}</strong><p>You will not need to select your representative again on future RFQs.</p></div></div><fieldset><legend>Delivery or collection?</legend><button type="button" aria-pressed={draft.fulfilment === 'delivery'} onClick={() => setDraft(value => ({ ...value, fulfilment: 'delivery' }))}>Delivery</button><button type="button" aria-pressed={draft.fulfilment === 'collect'} onClick={() => setDraft(value => ({ ...value, fulfilment: 'collect' }))}>Collection</button></fieldset><button className={`primary-button ${ready ? 'tutorial-target is-pulsing' : ''}`} type="button" disabled={!ready} onClick={() => move(8)}>Review fake RFQ</button></section>;
  }
  if (step === 8) return <section className="tutorial-review"><p className="eyebrow">Final review</p><h3>Check before submitting</h3><dl><div><dt>Product</dt><dd>PBG · Quantity 1</dd></div><div><dt>Configuration</dt><dd>{draft.range} · {draft.connection}</dd></div><div><dt>Application</dt><dd>{draft.application}</dd></div><div><dt>Representative</dt><dd>{FAKE_RFQ.representative} · remembered</dd></div><div><dt>Fulfilment</dt><dd>{draft.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</dd></div></dl><label className="tutorial-consent"><input type="checkbox" checked={draft.consent} onChange={event => setDraft(value => ({ ...value, consent: event.target.checked }))} /> I confirm this is a fabricated tutorial RFQ.</label><button className={`primary-button ${draft.consent ? 'tutorial-target is-pulsing' : ''}`} type="button" disabled={!draft.consent} onClick={() => move(9)}>Continue to submit</button></section>;
  if (step === 9) return <section className="tutorial-submit"><span className="tutorial-lock">✓</span><p className="eyebrow">Safe tutorial submission</p><h3>Ready to create the fake RFQ</h3><p>This demonstrates submission behaviour but does not call the RFQ service, create notifications or enter any operational queue.</p><button className="primary-button tutorial-target is-pulsing" type="button" onClick={() => move(10)}>Submit fake RFQ</button></section>;
  if (step === 10) return <section className="tutorial-confirmation"><span>✓</span><p className="eyebrow">Tutorial RFQ created</p><h3>{FAKE_RFQ.reference}</h3><p>The fabricated request is ready for the tracking demonstration.</p><button className="primary-button tutorial-target is-pulsing" type="button" onClick={() => move(11)}>Track this fake RFQ</button></section>;
  return <section className="tutorial-tracking"><p className="eyebrow">Customer-safe RFQ tracking</p><h3>{FAKE_RFQ.reference}</h3><div className="tutorial-timeline"><span className="is-complete"><b>✓</b><strong>RFQ submitted</strong><small>Fabricated tutorial event</small></span><span className="is-current"><b>2</b><strong>Assigned to {FAKE_RFQ.representative}</strong><small>Ready for representative review</small></span><span><b>3</b><strong>Quotation</strong><small>Future workflow stage</small></span></div><p className="tutorial-isolation-note">Nothing from this tutorial was saved to customer records, reports, notifications or representative queues.</p><button className="primary-button tutorial-target is-pulsing" type="button" onClick={onFinish}>Finish tutorial</button></section>;
}
