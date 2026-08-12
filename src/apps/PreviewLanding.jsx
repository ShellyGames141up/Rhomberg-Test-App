import { PREVIEW_DEFINITIONS, landingUrlFromPath } from '../shared/platform/previewConfig.js';

const loginForPreview = (logins, definition) => (
  (logins || []).find(login => definition.allowedRoles.includes(login.role))
);

export function PreviewLanding({ demoLogins = [], serviceMode = 'mock', theme = 'light', onToggleTheme }) {
  const landing = landingUrlFromPath(globalThis.location?.pathname || '/');
  return (
    <main className={`preview-landing is-${theme}`}>
      <button className="preview-landing-theme" type="button" onClick={onToggleTheme} aria-label={`Switch Preview Centre to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
      <header className="preview-landing-hero">
        <div className="preview-landing-brand">
          <img src={`${landing}assets/images/rhomberg-connect-logo-full-dark.png`} alt="Rhomberg Connect" />
        </div>
        <span className="preview-landing-chip">Demo Preview · {serviceMode === 'mock' ? 'Mock data' : 'Private service'}</span>
        <h1>Preview Centre.<br /><em>Five focused experiences.</em></h1>
        <p>This separate presentation and testing environment lets authorised reviewers choose a customer or internal interface and device format. Every preview uses the same shared workflow, permissions, services and fabricated test records.</p>
        <aside className="preview-purpose" aria-label="Preview Centre purpose">
          <strong>Not the normal application entry point</strong>
          <span>For presentations · development review · showcase events · management demonstrations · IT testing</span>
        </aside>
      </header>

      <section className="preview-launch-grid" aria-label="Available Rhomberg previews">
        {PREVIEW_DEFINITIONS.map((definition, index) => {
          const demo = loginForPreview(demoLogins, definition);
          return (
            <article className={`preview-launch-card ${definition.customer ? 'is-connect' : definition.executiveDemo ? 'is-executive' : 'is-operations'}`} key={definition.id}>
              <span className="preview-card-number">0{index + 1}</span>
              <span className="preview-device" aria-hidden="true">{definition.mobile ? 'MOBILE' : 'DESKTOP'}</span>
              <div>
                <small>{definition.product}</small>
                <h2>{definition.platform}</h2>
                <p>{definition.description}</p>
              </div>
              <dl>
                <div><dt>Intended users</dt><dd>{definition.intendedUsers}</dd></div>
                <div><dt>Platform</dt><dd>{definition.device}</dd></div>
              </dl>
              <div className="preview-card-actions">
                <a href={`${landing}${definition.route.replace(/^\//, '')}`}>Launch Preview <span>→</span></a>
                {demo && (
                  <details>
                    <summary>View Demo Login</summary>
                    <p><strong>{demo.email}</strong><code>{demo.password}</code><small>Demonstration-only credentials</small></p>
                  </details>
                )}
              </div>
              <p className="preview-card-warning"><span>i</span>No real customer accounts, production authentication or cross-device synchronisation.</p>
            </article>
          );
        })}
      </section>

      <footer className="preview-landing-footer">
        <strong>Shared platform architecture</strong>
        <p>These interfaces share one logical mock system in this browser. Unrelated browsers and devices do not synchronise until the future private-cloud backend is connected.</p>
      </footer>
    </main>
  );
}
