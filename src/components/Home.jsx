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
  return (
    <div className="hero-gauge" aria-hidden="true">
      <div className="hero-gauge-face">
        <span className="hero-needle" /><i className="hero-pin" /><b>RHOMBERG</b><small>bar</small>
      </div>
      <span className="steam steam-one" /><span className="steam steam-two" /><span className="steam steam-three" />
    </div>
  );
}
