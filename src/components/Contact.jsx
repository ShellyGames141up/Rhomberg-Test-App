import { branches } from '../data/branches.js';

export function Contact() {
  return (
    <section className="app-screen contact-screen" aria-labelledby="contact-title">
      <header className="contact-hero"><div className="contact-orbit" aria-hidden="true" /><span className="eyebrow">Talk to an expert</span><h1 id="contact-title">We’re here to <em>help.</em></h1><p>Speak directly to the Rhomberg team for selection guidance, calibration or a quotation.</p></header>
      <div className="contact-cards">
        <a className="contact-card primary-contact" href="tel:+27219057041"><span>☎</span><div><small>Call us</small><strong>+27 21 905 7041</strong></div><i>→</i></a>
        <a className="contact-card" href="mailto:info@rhom.co.za"><span>✉</span><div><small>Email us</small><strong>info@rhom.co.za</strong></div><i>→</i></a>
        <a className="contact-card" href="https://rhomberginstruments.co.za/" target="_blank" rel="noopener"><span>◎</span><div><small>Official website</small><strong>rhomberginstruments.co.za</strong></div><i>↗</i></a>
      </div>
      <div className="branch-section"><span className="eyebrow">National support</span><h2>Our locations</h2><div className="branch-grid">{branches.map(branch => <span key={branch.id}>{branch.name}<small>{branch.role}<br />{branch.address}<br />{branch.phone}</small></span>)}</div></div>
    </section>
  );
}
