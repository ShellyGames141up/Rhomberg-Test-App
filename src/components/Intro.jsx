import { useEffect, useState } from 'react';

export function Intro({ onComplete }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => finish(), 2850);
    return () => window.clearTimeout(timer);
  }, []);
  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onComplete, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  };
  return <section className={`intro brand-splash ${leaving ? 'is-leaving' : ''}`} aria-label="Rhomberg Connect introduction">
    <button className="intro-skip" type="button" onClick={finish}>Skip</button>
    <div className="intro-grid" aria-hidden="true" />
    <div className="splash-glow" aria-hidden="true" />
    <div className="splash-lockup">
      <div className="animated-gauge" aria-hidden="true"><img src="assets/images/rhomberg-connect-symbol.png" alt="" /><i /></div>
      <picture><source media="(max-width: 600px)" srcSet="assets/images/rhomberg-connect-logo-compact.png" /><img src="assets/images/rhomberg-connect-logo-splash.png" alt="Rhomberg Connect" /></picture>
      <p>Connecting customers, Sales and Operations</p>
      <span className="splash-loader"><i /></span>
    </div>
  </section>;
}
