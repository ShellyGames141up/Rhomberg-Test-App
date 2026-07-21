import { useMemo, useState } from 'react';
import { categories, categoryById, products, productsForCategory } from '../data/catalogue.js';
import { LeadTimeNotice } from './Layout.jsx';

export function Catalogue({ categoryId, onCategory, onProduct }) {
  const [query, setQuery] = useState('');
  const category = categoryById(categoryId);
  const visibleProducts = useMemo(() => {
    const source = category ? productsForCategory(category.id) : products;
    const term = query.trim().toLowerCase();
    if (!term) return source;
    return source.filter(product => `${product.code} ${product.name} ${product.description} ${product.measuringRange}`.toLowerCase().includes(term));
  }, [category, query]);

  if (!category) {
    return (
      <section className="app-screen catalogue-screen" aria-labelledby="catalogue-title">
        <header className="screen-heading catalogue-heading">
          <span className="eyebrow">Product finder</span>
          <h1 id="catalogue-title">Instrument <em>catalogue</em></h1>
          <p>Select a measurement category, then compare the available units and open a full product page.</p>
        </header>
        <div className="catalogue-search"><span>⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search all products" placeholder="Search model, range or application" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
        <LeadTimeNotice />
        {query ? (
          <div className="product-grid search-product-grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} onOpen={() => onProduct(product.id)} />)}{!visibleProducts.length && <EmptySearch />}</div>
        ) : (
          <div className="category-overview-grid">{categories.map(categoryItem => <CategoryCard key={categoryItem.id} category={categoryItem} count={productsForCategory(categoryItem.id).length} onOpen={() => onCategory(categoryItem.id)} />)}</div>
        )}
      </section>
    );
  }

  return (
    <section className="app-screen catalogue-screen category-screen" aria-labelledby="category-title">
      <header className="category-hero">
        <button type="button" className="inline-back" onClick={() => { onCategory(null); setQuery(''); }}>← All categories</button>
        <span className="category-number">{category.number}</span>
        <img src={category.image} alt="" />
        <div><span className="eyebrow">{category.short}</span><h1 id="category-title">{category.name}</h1><p>{category.description}</p><small>{productsForCategory(category.id).length} available {productsForCategory(category.id).length === 1 ? 'unit' : 'units'} and product families</small></div>
      </header>
      <div className="catalogue-search category-search"><span>⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={`Search ${category.name}`} placeholder={`Search ${category.name.toLowerCase()} units`} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
      <LeadTimeNotice compact />
      <div className="list-label"><span>Available units</span><b>{visibleProducts.length}</b></div>
      <div className="product-grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} onOpen={() => onProduct(product.id)} />)}{!visibleProducts.length && <EmptySearch />}</div>
    </section>
  );
}

function CategoryCard({ category, count, onOpen }) {
  return (
    <button className="category-overview-card" type="button" onClick={onOpen} aria-label={`Open ${category.name}`}>
      <span className="category-card-top"><b>{category.number}</b><span>{category.icon}</span><i>→</i></span>
      <img src={category.image} alt="" />
      <span className="category-card-copy"><strong>{category.name}</strong><small>{category.description}</small><em>{count} {count === 1 ? 'unit' : 'units'}</em></span>
    </button>
  );
}

export function ProductCard({ product, onOpen }) {
  const isGauge = product.category === 'pressure' && product.variant === 'gauge';
  return (
    <button className="unit-card" type="button" onClick={onOpen} aria-label={`Open ${product.code} ${product.name}`}>
      <span className="unit-card-visual"><img src={product.image} alt="" /><b>{product.code}</b><i>→</i></span>
      <span className="unit-card-copy">
        <strong>{product.name}</strong>
        <small>{product.description}</small>
        <span className="unit-spec-groups">
          {isGauge ? <><span className="unit-spec cyan"><em>Pressure capability</em><b>{product.pressureRange}</b></span><span className="unit-spec blue"><em>Measuring ranges</em><b>{product.measuringRange}</b></span></> : <><span className="unit-spec cyan"><em>Measuring range</em><b>{product.measuringRange}</b></span><span className="unit-spec blue"><em>Accuracy</em><b>{product.accuracy}</b></span></>}
          <span className="unit-spec steel"><em>Product</em><b>{product.code}</b></span>
        </span>
      </span>
    </button>
  );
}

function EmptySearch() {
  return <div className="empty-state"><span>⌕</span><strong>No matching units found</strong><p>Try a model code, measurement type or range.</p></div>;
}
