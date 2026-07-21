import { categories, recommendedCategories } from '../data/catalogue.js';
import { LeadTimeNotice, SectionHeading } from './Layout.jsx';

export function Home({ account, enquiryCount, onNavigate, onCategory }) {
  const firstName = account.contact.split(/\s+/)[0];
  const categoryIds = recommendedCategories[account.industry] || recommendedCategories.Other;
  const recommended = categoryIds.map(id => categories.find(category => category.id === id)).filter(Boolean);
  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';

  return (
    <section className="app-screen home-screen" aria-labelledby="home-title">
      <div className="home-hero">
        <div className="home-copy">
          <p>Good {greeting}, {firstName}</p>
          <h1 id="home-title">What can we help you <em>measure?</em></h1>
          <small>{account.company} · {account.area}</small>
          <button className="hero-cta" type="button" onClick={() => onNavigate('catalogue')}>Find an instrument <span>→</span></button>
        </div>
        <AnimatedGauge />
      </div>

      <div className="content-block lead-home"><LeadTimeNotice compact /></div>

      <div className="content-block">
        <SectionHeading eyebrow="Quick access" title="How can we help?" />
        <div className="quick-actions">
          <button className="quick-card cyan" type="button" onClick={() => onNavigate('catalogue')}><span className="quick-icon">⌕</span><span><strong>Browse catalogue</strong><small>Explore instruments</small></span><i>→</i></button>
          <button className="quick-card navy" type="button" onClick={() => onNavigate('enquiry')}><span className="quick-icon">+</span><span><strong>Submit enquiry</strong><small>Review configured units</small></span><i>→</i></button>
          <button className="quick-card light" type="button" onClick={() => onNavigate('contact')}><span className="quick-icon">☎</span><span><strong>Contact Rhomberg</strong><small>Speak to our team</small></span><i>→</i></button>
        </div>
      </div>

      <div className="content-block">
        <SectionHeading eyebrow="Selected for your field" title={`Recommended for ${account.industry}`} action="View all" onAction={() => onNavigate('catalogue')} />
        <div className="recommended-scroll">
          {recommended.map(category => <HomeCategoryCard key={category.id} category={category} onOpen={() => onCategory(category.id)} />)}
        </div>
      </div>

      <div className="content-block activity-block">
        <div className="activity-card"><span className="activity-icon">RQ</span><div><small>Your requests</small><strong>{enquiryCount ? `${enquiryCount} saved quote request${enquiryCount === 1 ? '' : 's'}` : 'No enquiries yet'}</strong></div><button type="button" onClick={() => onNavigate('account')} aria-label="View account activity">›</button></div>
      </div>
    </section>
  );
}

function HomeCategoryCard({ category, onOpen }) {
  return (
    <button className="home-category-card" type="button" onClick={onOpen} aria-label={`Open ${category.name}`}>
      <span className="home-category-visual"><b>{category.number}</b><img src={category.image} alt="" /></span>
      <span><small>Recommended</small><strong>{category.name}</strong><i>→</i></span>
    </button>
  );
}

function AnimatedGauge() {
  const centre = 110;
  const point = (radius, angle) => {
    const radians = angle * Math.PI / 180;
    return { x: centre + radius * Math.cos(radians), y: centre + radius * Math.sin(radians) };
  };
  const ticks = Array.from({ length: 51 }, (_, index) => {
    const angle = 135 + (270 * index / 50);
    const isMajor = index % 10 === 0;
    const isMid = index % 5 === 0;
    const outer = point(78, angle);
    const inner = point(isMajor ? 66 : isMid ? 69 : 72, angle);
    return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className={isMajor ? 'major' : isMid ? 'mid' : 'minor'} />;
  });
  const labels = [0, 2, 4, 6, 8, 10].map((value, index) => {
    const position = point(57, 135 + 54 * index);
    return <text key={value} x={position.x} y={position.y} className="hero-gauge-value">{value}</text>;
  });
  const zeroPoint = point(74, 135);

  return (
    <div className="hero-gauge" aria-hidden="true">
      <svg className="hero-gauge-svg" viewBox="0 0 220 250" focusable="false">
        <defs>
          <linearGradient id="gauge-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f8fbfb" />
            <stop offset=".24" stopColor="#89979b" />
            <stop offset=".48" stopColor="#eef3f3" />
            <stop offset=".73" stopColor="#718087" />
            <stop offset="1" stopColor="#dce5e6" />
          </linearGradient>
          <linearGradient id="gauge-brass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7b551b" />
            <stop offset=".35" stopColor="#d5ad5c" />
            <stop offset=".7" stopColor="#8f6726" />
            <stop offset="1" stopColor="#e2c474" />
          </linearGradient>
          <radialGradient id="gauge-face" cx="38%" cy="30%" r="78%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".72" stopColor="#f7f8f5" />
            <stop offset="1" stopColor="#dfe4e1" />
          </radialGradient>
          <filter id="gauge-shadow" x="-30%" y="-25%" width="170%" height="180%">
            <feDropShadow dx="-7" dy="10" stdDeviation="8" floodColor="#001e2d" floodOpacity=".38" />
          </filter>
        </defs>

        <g filter="url(#gauge-shadow)">
          <path d="M99 208h22v13H99z" fill="#7e8789" />
          <path d="M96 218h28v13H96z" fill="url(#gauge-brass)" />
          <path d="M99 230h22v17H99z" fill="url(#gauge-brass)" />
          <path d="M99 234h22M99 239h22M99 244h22" className="hero-gauge-thread" />
          <circle cx="110" cy="110" r="106" fill="url(#gauge-metal)" />
          <circle cx="110" cy="110" r="96" fill="#243337" />
          <circle cx="110" cy="110" r="91" fill="url(#gauge-face)" stroke="#d3dbd9" strokeWidth="2" />
          <path d="M183 43a8 8 0 0 1 8 8v13h-16V51a8 8 0 0 1 8-8z" fill="#aeb8ba" stroke="#657378" strokeWidth="2" />
          <circle cx="183" cy="51" r="3" fill="#647278" />
        </g>

        <g className="hero-gauge-scale">{ticks}{labels}</g>
        <text x="110" y="69" className="hero-gauge-range">0–10</text>
        <text x="110" y="127" className="hero-gauge-unit">bar</text>
        <text x="110" y="151" className="hero-gauge-brand">RHOMBERG</text>
        <text x="110" y="158" className="hero-gauge-brand-sub">INSTRUMENTS</text>
        <text x="153" y="143" className="hero-gauge-class">CL 1.6</text>
        <circle cx={zeroPoint.x} cy={zeroPoint.y} r="2.3" fill="#111c20" />

        <g className="hero-gauge-needle">
          <path d={`M${zeroPoint.x} ${zeroPoint.y} L107 114 L113 106 Z`} fill="#171e20" />
          <line x1="110" y1="110" x2={zeroPoint.x} y2={zeroPoint.y} stroke="#11191b" strokeWidth="4" strokeLinecap="round" />
          <line x1="110" y1="110" x2="124" y2="124" stroke="#11191b" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="110" cy="110" r="9" fill="#d3a84c" stroke="#34250f" strokeWidth="3" />
        <circle cx="110" cy="110" r="3" fill="#14191a" />
        <path d="M49 55c15-26 44-40 73-38" className="hero-gauge-glint" />
      </svg>
      <span className="steam steam-one" /><span className="steam steam-two" /><span className="steam steam-three" />
    </div>
  );
}
