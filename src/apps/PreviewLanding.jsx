import { PREVIEW_DEFINITIONS, landingUrlFromPath } from '../shared/platform/previewConfig.js';

const loginForPreview = (logins, definition) => (
  (logins || []).find(login => definition.allowedRoles.includes(login.role))
);

export function PreviewLanding({ demoLogins = [], serviceMode = 'mock' }) {
  const landing = landingUrlFromPath(globalThis.location?.pathname || '/');
  return (
    <main className="preview-landing">
      <header className="preview-landing-hero">
        <div className="preview-landing-brand">
          <img src={`${landing}assets/images/rhomberg-gauge-mark.svg`} alt="" />
          <span><strong>RHOMBERG</strong><small>PLATFORM PREVIEW CENTRE</small></span>
        </div>
        <span className="preview-landing-chip">Demo Preview · {serviceMode === 'mock' ? 'Mock data' : 'Private service'}</span>
        <h1>Two products.<br /><em>Four focused experiences.</em></h1>
        <p>Choose the customer or internal Rhomberg interface and the device format you want to review. Every preview uses the same shared workflow, permissions, services and fabricated test records.</p>
      </header>

      <section className="preview-launch-grid" aria-label="Available Rhomberg previews">
        {PREVIEW_DEFINITIONS.map((definition, index) => {
          const demo = loginForPreview(demoLogins, definition);
          return (
            <article className={`preview-launch-card ${definition.customer ? 'is-connect' : 'is-operations'}`} key={definition.id}>
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
