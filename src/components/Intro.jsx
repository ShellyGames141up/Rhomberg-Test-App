import { useEffect, useState } from 'react';

export function Intro({ onComplete }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => finish(), 6800);
    return () => window.clearTimeout(timer);
  }, []);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onComplete, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
  };

  return (
    <section className={`intro ${leaving ? 'is-leaving' : ''}`} aria-label="Rhomberg Instruments introduction">
      <button className="intro-skip" type="button" onClick={finish}>Skip introduction</button>
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-orbit orbit-a" aria-hidden="true" />
      <div className="intro-orbit orbit-b" aria-hidden="true" />
      <div className="intro-content">
        <div className="intro-brand">
          <img src="assets/images/rhomberg-gauge-mark.svg" alt="" />
          <img src="assets/images/rhomberg-wordmark-transparent.png" alt="Rhomberg Instruments" />
        </div>
        <IntroMessage number="01" title="Precision engineered" copy="for every application" className="message-one" />
        <IntroMessage number="02" title="Configure with confidence" copy="guided instrument selection" className="message-two" />
        <IntroMessage number="03" title="Your quote portal." copy="Rhomberg expertise in your pocket" className="message-three" />
        <p className="intro-welcome">Welcome to Rhomberg Quote Portal</p>
      </div>
      <div className="intro-progress" aria-hidden="true"><span /></div>
    </section>
  );
}

function IntroMessage({ number, title, copy, className }) {
  return (
    <div className={`intro-message ${className}`}>
      <span>{number}</span>
      <strong>{title}</strong>
      <small>{copy}</small>
    </div>
  );
}
