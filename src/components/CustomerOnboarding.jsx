import { useEffect, useMemo, useState } from 'react';
import { TUTORIAL_STEPS, TUTORIALS } from '../domain/userSettings.js';

export function FirstCustomerWelcome({ account, reduceMotion, onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, reduceMotion ? 900 : 2850);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);
  const firstName = account.contact.split(/\s+/)[0];
  return <section className={`first-welcome ${reduceMotion ? 'reduce-motion' : ''}`} aria-label={`Welcome, ${firstName}`}>
    <div className="first-welcome-glow" aria-hidden="true" />
    <div className="animated-gauge"><img src="assets/images/rhomberg-connect-symbol.png" alt="" /><i /></div>
    <p>Welcome, {firstName}</p>
    <h1>Welcome to Rhomberg Connect</h1>
    <span>Your customer journey is ready.</span>
  </section>;
}

export function CustomerTutorial({ kind = 'full', startAt, onProgress, onFinish, onSkip }) {
  const configuredStart = useMemo(() => TUTORIALS.find(item => item.id === kind)?.startStep || 0, [kind]);
  const [step, setStep] = useState(Math.min(TUTORIAL_STEPS.length - 1, Math.max(configuredStart, Number(startAt) || 0)));
  const current = TUTORIAL_STEPS[step];
  const move = next => {
    setStep(next);
    onProgress?.(next, kind);
  };
  return <section className="tutorial-overlay" aria-modal="true" role="dialog" aria-labelledby="tutorial-title">
    <div className="tutorial-dim" />
    <div className={`tutorial-stage target-${current.target}`}>
      <header><img src="assets/images/rhomberg-connect-logo-compact.png" alt="Rhomberg Connect" /><span>Tutorial Example</span></header>
      <nav><i className="is-active">Home</i><i>Catalogue</i><i>RFQs</i><i>Tracking</i><i>Alerts</i><i>Profile</i><i>Settings</i></nav>
      <main><div className="tutorial-demo-card"><span>FABRICATED GUIDED RFQ</span><strong>RQ-TUTORIAL-0001</strong><p>Pressure indication for a tutorial water line · PBG · 2 units</p></div><div className="tutorial-demo-steps"><i>Choose product</i><i>Configure</i><i>Review</i><i>Submit</i><i>Track</i></div></main>
    </div>
    <article className="tutorial-tooltip">
      <span>Step {step + 1} of {TUTORIAL_STEPS.length}</span>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.copy}</p>
      <small>Tutorial Example · fabricated and excluded from operational records</small>
      <div><button className="text-button" type="button" onClick={onSkip}>Skip</button><button className="secondary-button" type="button" disabled={step === 0} onClick={() => move(step - 1)}>Previous</button>{step === TUTORIAL_STEPS.length - 1 ? <button className="primary-button" type="button" onClick={onFinish}>Finish</button> : <button className="primary-button" type="button" onClick={() => move(step + 1)}>Next</button>}</div>
    </article>
  </section>;
}
