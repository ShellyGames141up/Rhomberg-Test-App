export function MockAdministrationControls({ busy, onRun, administrationActions }) {
  const resetDemo = () => {
    if (!globalThis.confirm?.('Reset the fabricated workflow, audit, notification and document records to their seeded demo state?')) return;
    onRun(
      'reset-demo',
      () => administrationActions.resetDemoData(),
      'Fabricated demonstration data was reset and audited.',
    );
  };

  return (
    <article className="administrator-panel is-warning">
      <span className="eyebrow">Preview maintenance</span>
      <h2>Fabricated demo data</h2>
      <p>Reset only the browser-local workflow data. This control is excluded from the private-cloud production experience.</p>
      <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={resetDemo}>{busy === 'reset-demo' ? 'Resetting…' : 'Reset fabricated data'}</button>
    </article>
  );
}
