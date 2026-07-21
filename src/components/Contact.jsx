export function Contact() {
  return (
    <section className="app-screen contact-screen" aria-labelledby="contact-title">
      <header className="contact-hero"><div className="contact-orbit" aria-hidden="true" /><span className="eyebrow">Talk to an expert</span><h1 id="contact-title">We’re here to <em>help.</em></h1><p>Speak directly to the Rhomberg team for selection guidance, calibration or a quotation.</p></header>
      <div className="contact-cards">
        <a className="contact-card primary-contact" href="tel:+27219057041"><span>☎</span><div><small>Call us</small><strong>+27 21 905 7041</strong></div><i>→</i></a>
        <a className="contact-card" href="mailto:info@rhom.co.za"><span>✉</span><div><small>Email us</small><strong>info@rhom.co.za</strong></div><i>→</i></a>
        <a className="contact-card" href="https://rhomberginstruments.co.za/" target="_blank" rel="noopener"><span>◎</span><div><small>Official website</small><strong>rhomberginstruments.co.za</strong></div><i>↗</i></a>
      </div>
      <div className="branch-section"><span className="eyebrow">National support</span><h2>Our locations</h2><div className="branch-grid"><span>Cape Town<small>Manufacturing & Head Office</small></span><span>Johannesburg<small>Sales support</small></span><span>Durban<small>Regional support</small></span><span>Port Elizabeth<small>Regional support</small></span></div></div>
    </section>
  );
}
