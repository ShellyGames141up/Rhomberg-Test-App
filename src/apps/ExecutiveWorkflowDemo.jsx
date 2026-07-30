import { executiveDemoProgress } from '../domain/executiveDemo.js';

export function ExecutiveDemoLauncher({ catalogue, state, onScenario, onStart, busy, error }) {
  const progress = executiveDemoProgress(state);
  return (
    <main className="executive-demo-launcher">
      <div className="executive-demo-fabricated-banner">Executive Demo Mode - Fabricated Data Only</div>
      <header>
        <img src="assets/images/rhomberg-gauge-mark.svg" alt="" />
        <span className="eyebrow">Rhomberg Platform · Guided presentation</span>
        <h1>One workflow.<br /><em>Every accountable handover.</em></h1>
        <p>Select a scenario and begin from any authorised role. Progress, fabricated records, notifications and audit history remain available after refresh in this browser.</p>
      </header>
      {error && <p className="operations-message is-error" role="alert">{error}</p>}
      <section className="executive-scenario-selector" aria-labelledby="scenario-heading">
        <div className="operations-section-title"><div><span className="eyebrow">Presentation storyline</span><h2 id="scenario-heading">Choose a scenario</h2></div><small>{catalogue.scenarios.length} guided scenarios</small></div>
        <div className="executive-scenario-grid">
          {catalogue.scenarios.map(scenario => (
            <button key={scenario.id} type="button" className={scenario.id === progress.scenario.id ? 'active' : ''} onClick={() => onScenario(scenario.id)}>
              <span>{scenario.steps.length} steps</span><strong>{scenario.label}</strong><small>{scenario.summary}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="executive-role-selector" aria-labelledby="role-heading">
        <div className="operations-section-title"><div><span className="eyebrow">Controlled role switch</span><h2 id="role-heading">Open the first workspace</h2></div><small>No password required inside this fabricated demo route</small></div>
        <div className="executive-role-grid">
          {catalogue.roles.map(role => (
            <button key={role.role} type="button" disabled={Boolean(busy)} onClick={() => onStart(role.role)}>
              <span>{role.device}</span><strong>{role.label}</strong><small>{role.stage}</small>
            </button>
          ))}
        </div>
      </section>
      <footer><a href="../../">Return to Preview Centre</a><span>Shared mock services · Company-scoped records · Audited workflow actions</span></footer>
    </main>
  );
}

export function ExecutiveDemoControls({
  catalogue,
  state,
  account,
  busy,
  error,
  onScenario,
  onStep,
  onRole,
  onPresentationMode,
  onReset,
  onOpenNotifications,
  onOpenRecords,
  onOpenAudit,
  canOpenAudit,
}) {
  const progress = executiveDemoProgress(state);
  const role = catalogue.roles.find(item => item.role === account?.role);
  return (
    <aside className={`executive-demo-controls ${state.presentationMode ? 'is-presenting' : ''}`} aria-label="Executive demonstration controls">
      <div className="executive-demo-fabricated-banner">Executive Demo Mode - Fabricated Data Only</div>
      <div className="executive-control-main">
        <div className="executive-control-identity">
          <span className="eyebrow">{role?.device || 'Rhomberg Platform'}</span>
          <strong>{role?.label || account?.role}</strong>
          <small>{role?.stage || 'Guided workflow'}</small>
        </div>
        <label><span>Scenario</span><select value={progress.scenario.id} disabled={Boolean(busy)} onChange={event => onScenario(event.target.value)}>{catalogue.scenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Active role</span><select value={account?.role || ''} disabled={Boolean(busy)} onChange={event => onRole(event.target.value)}>{catalogue.roles.map(item => <option key={item.role} value={item.role}>{item.label}</option>)}</select></label>
        <div className="executive-progress-copy"><span>Step {state.stepIndex + 1} of {progress.scenario.steps.length}</span><strong>{progress.currentStep}</strong><small>Next: {progress.nextStep}</small></div>
        <div className="executive-progress-bar" aria-label={`${progress.progressPercent}% complete`}><i style={{ width: `${progress.progressPercent}%` }} /></div>
        <div className="executive-step-buttons">
          <button type="button" disabled={Boolean(busy) || state.stepIndex === 0} onClick={() => onStep(state.stepIndex - 1)}>Previous</button>
          <button type="button" disabled={Boolean(busy) || state.stepIndex >= progress.scenario.steps.length - 1} onClick={() => onStep(state.stepIndex + 1)}>Next step</button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="executive-control-links">
        <button type="button" onClick={onOpenRecords}>Records / documents</button>
        <button type="button" onClick={onOpenNotifications}>Notifications</button>
        {canOpenAudit && <button type="button" onClick={onOpenAudit}>Audit history</button>}
        <button type="button" onClick={() => onPresentationMode(!state.presentationMode)}>{state.presentationMode ? 'Exit presentation' : 'Presentation mode'}</button>
        <button type="button" onClick={onReset}>Restart scenario</button>
        <a href="../../">All previews</a>
      </div>
    </aside>
  );
}
