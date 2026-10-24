// THROWAWAY: Which of three ordering layouts should become the Catalog frontend?
// B is the preferred layout. All variants share fictional electronics demo data.
// Prices and stock are illustrative; checkout is simulated and makes no API writes.
const products = [
  { id: '1', name: 'Nova Phone', type: 'Phone', category: 'phones', specs: '128 GB · Midnight', description: 'A 6.1-inch smartphone with 128 GB storage in Midnight.', copy: 'Everything you need, right in your pocket.', price: 69900, stock: 12, kind: 'phone', note: 'Your everyday connection' },
  { id: '2', name: 'Atlas Laptop 14', type: 'Laptop', category: 'laptops', specs: '16 GB RAM · 512 GB SSD', description: 'A 14-inch laptop with 16 GB RAM and a 512 GB SSD.', copy: 'Room for your work. Power for your ideas.', price: 109900, stock: 8, kind: 'laptop', note: 'Make room for your next idea' },
  { id: '3', name: 'Arc Wireless Mouse', type: 'Mouse', category: 'mice', specs: 'Bluetooth · Graphite', description: 'A compact wireless Bluetooth mouse in Graphite.', copy: 'A smoother way to get things done.', price: 4900, stock: 25, kind: 'mouse', note: 'A better everyday setup' },
];
const variants = { A: 'The storefront', B: 'The quick order', C: 'The guided basket' };
// Same B layout, three color studies. Palette changes preserve all ordering state.
const palettes = { blue: 'Cobalt', amber: 'Warm amber', midnight: 'Midnight violet' };
const initialVariant = new URL(location.href).searchParams.get('variant');
const initialPalette = new URL(location.href).searchParams.get('palette');
const state = {
  variant: Object.hasOwn(variants, initialVariant) ? initialVariant : 'B',
  palette: Object.hasOwn(palettes, initialPalette) ? initialPalette : 'blue',
  cart: {}, search: '', filter: 'all', sort: 'featured', selected: '1',
  customer: 'customer-1', order: null, dialog: null, review: false, details: false,
};
let returnFocus = null;
let orderTimer = null;
const money = cents => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const quantity = id => state.cart[id] || 0;
const count = () => Object.values(state.cart).reduce((sum, value) => sum + value, 0);
const total = () => products.reduce((sum, p) => sum + p.price * quantity(p.id), 0);
const cartProducts = () => products.filter(p => quantity(p.id));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name, size = 20) => {
  const shapes = {
    bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8L21 9h-8l1-7Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.bolt}</svg>`;
};

// Local vector artwork keeps every prototype self-contained and available offline.
function productArtwork(kind, suffix = '') {
  const id = `${kind}-${suffix}`;
  const defs = `<defs>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a5abb4"/><stop offset=".45" stop-color="#616b79"/><stop offset="1" stop-color="#303846"/></linearGradient>
    <linearGradient id="${id}-screen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#182e43"/><stop offset=".5" stop-color="#5a8193"/><stop offset="1" stop-color="#b5caba"/></linearGradient>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#68717e"/><stop offset=".55" stop-color="#3a4451"/><stop offset="1" stop-color="#222a36"/></linearGradient>
  </defs>`;
  const phone = `<ellipse cx="150" cy="270" rx="64" ry="9" fill="#162435" opacity=".1"/>
    <g transform="rotate(-10 150 150)"><rect x="87" y="27" width="126" height="238" rx="23" fill="url(#${id}-metal)"/><rect x="91" y="30" width="118" height="232" rx="20" fill="#151e29"/>
    <rect x="97" y="37" width="106" height="218" rx="16" fill="url(#${id}-screen)"/><path d="M97 176c26-62 51-58 106-96v120c-40-20-72 0-106 40Z" fill="#b7d2bd" opacity=".55"/><path d="M97 220c25-46 61-44 106-101v62c-32 45-65 34-106 68Z" fill="#d9e2bf" opacity=".5"/>
    <rect x="130" y="44" width="40" height="11" rx="6" fill="#18232e"/><rect x="136" y="244" width="28" height="3" rx="2" fill="#f4f7ef" opacity=".8"/><path d="M85 81v24m0 9v16m130-36v31" stroke="#53606e" stroke-width="3" stroke-linecap="round"/></g>`;
  const laptop = `<ellipse cx="150" cy="249" rx="110" ry="9" fill="#162435" opacity=".1"/>
    <rect x="39" y="62" width="222" height="151" rx="9" fill="url(#${id}-metal)"/><rect x="44" y="67" width="212" height="140" rx="5" fill="#18212d"/><rect x="50" y="74" width="200" height="126" rx="2" fill="url(#${id}-screen)"/>
    <path d="M50 160c64-91 117 26 200-68v108H50Z" fill="#adcbba" opacity=".6"/><path d="M50 187c70-69 135 20 200-46v59H50Z" fill="#d5e2bf" opacity=".65"/><circle cx="150" cy="70" r="1.5" fill="#728390"/>
    <path d="m39 213-23 25c0 7 9 11 18 11h232c9 0 18-4 18-11l-23-25Z" fill="url(#${id}-metal)"/><path d="m46 216-12 16h232l-12-16Z" fill="#8f99a4"/><path d="M121 216h58l5 13h-68Z" fill="#aeb6bf"/><path d="M16 238h268" stroke="#c8cfd6" stroke-width="2"/>`;
  const mouse = `<ellipse cx="150" cy="259" rx="65" ry="10" fill="#162435" opacity=".1"/>
    <g transform="rotate(-15 150 150)"><path d="M150 45c-43 0-70 35-70 91v45c0 48 28 76 70 76s70-28 70-76v-45c0-56-27-91-70-91Z" fill="url(#${id}-body)"/>
    <path d="M150 45v98m-68 7c43 13 93 13 136 0" stroke="#192433" stroke-width="2"/><path d="M93 132c1-41 13-65 37-75" stroke="#a2acb6" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
    <rect x="143" y="82" width="14" height="37" rx="7" fill="#222c38" stroke="#7f8c99" stroke-width="2"/><path d="M146 91h8m-8 6h8m-8 6h8m-8 6h8" stroke="#5e6e7c" stroke-width="1.5"/><path d="M140 235h20" stroke="#9eacbd" stroke-width="2" stroke-linecap="round" opacity=".45"/></g>`;
  return `<svg class="product-art" viewBox="0 0 300 300" fill="none" aria-hidden="true">${defs}${kind === 'phone' ? phone : kind === 'laptop' ? laptop : mouse}</svg>`;
}

function logo(extra = '') {
  return `<a class="brand ${extra}" href="?variant=${state.variant}" aria-label="Circuit catalog">${icon('bolt', 29)}<span>circuit<span class="brand-dot">.</span></span></a>`;
}
function stepper(p, context = '') {
  const q = quantity(p.id);
  return `<div class="stepper ${context}" aria-label="Quantity of ${p.name}">
    <button data-action="subtract" data-id="${p.id}" aria-label="Remove one ${p.name}" ${q === 0 ? 'disabled' : ''}>${icon('minus', 15)}</button>
    <output aria-label="${p.name} quantity">${q}</output>
    <button data-action="add" data-id="${p.id}" aria-label="Add one ${p.name}" ${q >= p.stock ? 'disabled' : ''}>${icon('plus', 15)}</button>
  </div>`;
}
function basketButton() {
  return `<button class="basket-button" data-action="basket">${icon('bag', 18)}<span>Your basket</span><span class="basket-count">${count()}</span></button>`;
}
function filteredProducts() {
  let visible = products.filter(p => (state.filter === 'all' || p.category === state.filter) && `${p.name} ${p.type} ${p.specs} ${p.description}`.toLowerCase().includes(state.search.toLowerCase()));
  if (state.sort === 'price-low') visible = visible.toSorted((a, b) => a.price - b.price);
  if (state.sort === 'price-high') visible = visible.toSorted((a, b) => b.price - a.price);
  return visible;
}
function filters() {
  return `<div class="filter-pills" role="group" aria-label="Filter products">
    ${[['all', 'All tech'], ['phones', 'Phones'], ['laptops', 'Laptops'], ['mice', 'Mice']].map(([id, label]) => `<button data-action="filter" data-id="${id}" class="${state.filter === id ? 'active' : ''}" aria-pressed="${state.filter === id}">${label}</button>`).join('')}
  </div>`;
}
function search() {
  return `<label class="search-box">${icon('search', 18)}<input type="search" data-input="search" placeholder="Search your next upgrade…" aria-label="Search products" value="${escape(state.search)}"></label>`;
}
function sort() {
  return `<label class="sort-label">Sort by <select data-input="sort" aria-label="Sort products"><option value="featured" ${state.sort === 'featured' ? 'selected' : ''}>Featured</option><option value="price-low" ${state.sort === 'price-low' ? 'selected' : ''}>Price: low to high</option><option value="price-high" ${state.sort === 'price-high' ? 'selected' : ''}>Price: high to low</option></select></label>`;
}
function emptyResults() {
  return `<div class="empty-results">${icon('search', 30)}<h3>No products found</h3><p>Try another search or browse the whole catalog.</p><button class="text-button" data-action="reset-filters">Show all products ${icon('arrow', 16)}</button></div>`;
}
function cartLines() {
  return cartProducts().map(p => `<div class="cart-line"><div class="cart-thumb ${p.kind}">${productArtwork(p.kind, `cart-${p.id}`)}</div><div class="cart-line-info"><strong>${p.name}</strong><small>${money(p.price)} each</small>${stepper(p, 'small')}</div><strong>${money(p.price * quantity(p.id))}</strong></div>`).join('');
}
function orderSummary(compact = false) {
  return `<div class="summary-heading"><h2>Your basket<span>${count()}</span></h2>${icon('bag', 23)}</div>
    ${count() ? `<div class="cart-lines">${cartLines()}</div>` : `<div class="empty-cart">${icon('bag', 38)}<h3>A little empty, for now.</h3><p>Find your next upgrade.<br>Your gear will appear here.</p></div>`}
    <div class="summary-totals"><div><span>Subtotal</span><strong>${money(total())}</strong></div><div><span>Delivery</span><span class="muted">Not included in this demo</span></div><div class="total-line"><strong>Total</strong><strong>${money(total())}</strong></div></div>
    <button class="primary checkout-button" data-action="checkout" ${!count() ? 'disabled' : ''}>${compact ? 'Review order' : 'Continue to checkout'} ${icon('arrow', 18)}</button>
    <p class="demo-note">Prototype checkout · No payment required</p>`;
}

function VariantA() {
  const visible = filteredProducts();
  return `<div class="storefront">
    <div class="announcement">Good tech. A simpler choice. <span>Meet your everyday essentials.</span> ${icon('bolt', 13)}</div>
    <header class="site-header page-width">${logo()}<nav aria-label="Main navigation"><a class="nav-active" href="#products">The catalog</a><button class="nav-link" data-action="how">How it works</button></nav>${basketButton()}</header>
    <main class="page-width">
      <section class="store-hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="eyebrow"><span class="tiny-dot"></span> SMART PICKS. EVERYDAY TECH.</div><h1 id="hero-title">Good tech,<br><em>made simple.</em></h1><p>A focused collection of everyday electronics.<br>Pick your favourites. We’ll take it from there.</p><a class="primary hero-cta" href="#products">Explore the catalog ${icon('arrow', 18)}</a><div class="hero-footnote">${icon('bolt', 17)} Useful tech. Nothing complicated.</div></div>
      <div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-device hero-laptop">${productArtwork('laptop', 'hero')}</div><div class="hero-device hero-mouse">${productArtwork('mouse', 'hero')}</div><div class="hero-device hero-phone">${productArtwork('phone', 'hero')}</div><div class="round-stamp">A smarter<br><span>everyday</span><br>setup.</div><span class="art-caption">THE EVERYDAY COLLECTION — 01 / 03</span><span class="art-spark">✳</span></div></section>
      <section id="products" class="catalog-section"><div class="section-title"><div class="title-row"><h2>Find your next upgrade</h2><span class="item-label">${products.length} everyday essentials</span></div>${search()}</div><div class="catalog-toolbar">${filters()}${sort()}</div>
      <div class="product-grid">${visible.length ? visible.map((p, i) => `<article class="product-card"><div class="product-image ${p.kind}"><span class="product-number">0${i + 1}</span>${productArtwork(p.kind, `card-${p.id}`)}<span class="stock-pill"><span class="tiny-dot"></span> In stock</span></div><div class="product-heading"><div><h3>${p.name}</h3><span class="product-english">${p.type}</span></div><div class="product-price">${money(p.price)}<small>/ unit</small></div></div><p class="product-copy">${p.copy}</p><div class="product-action"><span>${p.stock} available</span>${quantity(p.id) ? stepper(p) : `<button class="add-button" data-action="add" data-id="${p.id}">Add to basket ${icon('plus', 17)}</button>`}</div></article>`).join('') : emptyResults()}</div></section>
      <footer class="store-footer"><span>${icon('bolt', 17)} Everyday tech. A simpler kind of shop.</span><span>Circuit / The Catalog</span></footer>
    </main>
  </div>`;
}

function VariantB() {
  const visible = filteredProducts();
  return `<div class="quick-order">
    <aside class="quick-rail"><a class="rail-logo" href="?variant=B" aria-label="Circuit catalog">${icon('bolt', 29)}</a><a class="rail-item selected" href="#quick-products" aria-label="Catalog">${icon('list', 23)}</a><button class="rail-item" data-action="basket" aria-label="View basket">${icon('bag', 23)}${count() ? `<span class="rail-count">${count()}</span>` : ''}</button><span class="rail-bottom">C.</span></aside>
    <div class="quick-main"><header class="quick-header"><span>CIRCUIT <span class="header-slash">/</span> EVERYDAY ELECTRONICS</span><button class="nav-link" data-action="how">How it works ${icon('right', 15)}</button></header>
    <main class="quick-layout"><section class="quick-catalog" id="quick-products"><div class="eyebrow">THE RIGHT TECH. LESS FUSS.</div><h1>Your next<br><span>upgrade.</span></h1><p class="quick-intro">Phones, laptops, and the little things that connect them.<br>Set your quantities and you’re ready to go.</p><div class="quick-tools">${search()}<span class="live-stock"><span class="tiny-dot"></span> Demo stock</span></div><div class="quick-filter-row">${filters()}${sort()}</div>
      <div class="market-table"><div class="market-table-head"><span>PRODUCT</span><span>UNIT PRICE</span><span>QUANTITY</span><span>SUBTOTAL</span></div>${visible.length ? visible.map(p => `<article class="market-row"><div class="market-product"><div class="market-thumbnail ${p.kind}">${productArtwork(p.kind, `list-${p.id}`)}</div><div><h2>${p.name}</h2><p>${p.specs}<br>${p.stock} available</p><small class="mobile-unit">${money(p.price)} / unit</small></div></div><strong class="market-unit">${money(p.price)}</strong>${stepper(p)}<strong class="market-subtotal">${money(p.price * quantity(p.id))}</strong></article>`).join('') : emptyResults()}</div>
      <div class="quick-tip"><span class="tip-icon">${icon('check', 19)}</span><p><strong>Your list, your pace.</strong> Adjust quantities here. Review everything before you order.</p></div>
      <div class="quick-bottom"><span>SMALL CATALOG. GOOD CHOICES.</span><span>01 — 03</span></div></section>
      <aside class="quick-summary">${orderSummary(true)}</aside>
    </main></div>
  </div>`;
}

function VariantC() {
  const selected = products.find(p => p.id === state.selected);
  return `<div class="guided">
    <header class="guided-header">${logo()}<span class="guided-header-note">GOOD TECH. YOUR WAY.</span>${basketButton()}</header>
    <main class="guided-layout"><section class="guided-feature ${selected.kind}"><div class="feature-top"><span>THE EVERYDAY COLLECTION</span><span>0${products.indexOf(selected) + 1} / 03</span></div><div class="feature-title"><span class="eyebrow">${selected.note}</span><h1>${selected.type}<span>.</span></h1></div><div class="feature-device">${productArtwork(selected.kind, 'feature')}</div><span class="feature-script">built for your everyday</span><div class="feature-bottom"><div><span>${selected.name}</span><p>${selected.copy}</p></div><strong>${money(selected.price)}<small>/ unit</small></strong></div></section>
    <section class="guided-builder"><div class="step-track"><span class="${!state.review ? 'current' : 'complete'}"><b>${state.review ? icon('check', 12) : '1'}</b> Pick your tech</span><i></i><span class="${state.review ? 'current' : ''}"><b>2</b> Review & order</span></div>
      ${state.review ? `<div class="guided-review"><button class="back-link" data-action="back-to-picks">${icon('left', 16)} Back to your picks</button><div class="eyebrow">LOOKING GOOD</div><h2>A basket<br>with your name on it.</h2>${orderSummary(true)}</div>` : `<div class="builder-heading"><div class="eyebrow">MAKE IT YOURS</div><h2>A few good things.<br><em>Picked by you.</em></h2><p>Build your basket, one little favourite at a time.</p></div><div class="guided-picks">${products.map(p => `<article class="pick-row ${state.selected === p.id ? 'is-selected' : ''}"><button class="pick-select" data-action="select-product" data-id="${p.id}" aria-label="View ${p.name}" aria-pressed="${state.selected === p.id}"><span class="pick-dot ${p.kind}"></span><span><strong>${p.name}</strong><small>${p.type} · ${money(p.price)} / unit</small></span></button>${stepper(p)}</article>`).join('')}</div><div class="builder-hint">${icon('bolt', 17)} A small selection. All the good stuff.</div><div class="builder-total"><span>Your basket <small>${count()} ${count() === 1 ? 'unit' : 'units'}</small></span><strong>${money(total())}</strong></div><button class="primary guided-continue" data-action="review" ${!count() ? 'disabled' : ''}>Review your basket ${icon('arrow', 18)}</button><p class="demo-note">Just exploring? Everything stays in this session.</p>`}
    </section></main>
    <footer class="guided-footer"><span>CIRCUIT — SIMPLY CONNECTED.</span><span>Small choices. A good day.</span></footer>
  </div>`;
}

function PaletteControls() {
  return `<div class="prototype-bar palette-bar" aria-label="Color palette switcher"><span class="prototype-tag">COLOR STUDY</span><button data-action="previous-palette" aria-label="Previous color palette">${icon('left', 17)}</button><span class="variant-name">${palettes[state.palette]}</span><button data-action="next-palette" aria-label="Next color palette">${icon('right', 17)}</button><div class="variant-dots palette-swatches">${Object.entries(palettes).map(([key, label], i) => `<button class="palette-swatch swatch-${key} ${key === state.palette ? 'active' : ''}" data-action="palette" data-id="${key}" aria-label="Palette ${i + 1}: ${label}" aria-pressed="${key === state.palette}" title="${label}">${i + 1}</button>`).join('')}</div><button class="details-toggle" data-action="details" aria-label="Prototype state" aria-expanded="${state.details}">{ }</button></div>`;
}
function PrototypeSwitcher() {
  const payload = { customer_id: state.customer, items: cartProducts().map(p => ({ product_id: p.id, quantity: quantity(p.id) })) };
  return `${state.details ? `<aside class="prototype-details"><div><strong>Prototype state</strong><button data-action="details" aria-label="Close prototype state">${icon('close', 16)}</button></div><p>In-memory demo · prices in cents · no API requests</p><pre>${escape(JSON.stringify({ variant: state.variant, palette: state.palette, layout: variants[state.variant], search: state.search, filter: state.filter, sort: state.sort, selected_product: state.selected, review: state.review, basket: state.cart, total_cents: total(), order: state.order, next_api_request: { method: 'POST', path: '/orders', body: payload } }, null, 2))}</pre></aside>` : ''}
    ${state.variant === 'B' ? PaletteControls() : `<div class="prototype-bar" aria-label="Prototype design switcher"><span class="prototype-tag">PROTOTYPE</span><button data-action="previous-variant" aria-label="Previous design">${icon('left', 17)}</button><span class="variant-name">${state.variant}<span> / </span>${variants[state.variant]}</span><button data-action="next-variant" aria-label="Next design">${icon('right', 17)}</button><div class="variant-dots">${Object.keys(variants).map(v => `<button class="${v === state.variant ? 'active' : ''}" data-action="variant" data-id="${v}" aria-label="Design ${v}: ${variants[v]}" aria-pressed="${state.variant === v}">${v}</button>`).join('')}</div><button class="details-toggle" data-action="details" aria-expanded="${state.details}">{ }</button></div>`}`;
}

function render() {
  document.body.dataset.variant = state.variant;
  document.body.dataset.palette = state.palette;
  document.getElementById('app').innerHTML = ({ A: VariantA, B: VariantB, C: VariantC })[state.variant]();
  document.getElementById('prototype-tools').innerHTML = PrototypeSwitcher();
  renderOverlay();
}
function renderOverlay() {
  const overlay = document.getElementById('overlay');
  if (!state.dialog) {
    overlay.innerHTML = '';
    document.body.classList.remove('modal-open');
    return;
  }
  document.body.classList.add('modal-open');
  let content = '';
  if (state.dialog === 'basket') content = orderSummary();
  if (state.dialog === 'how') content = `<div class="eyebrow">FROM CATALOG TO BASKET</div><h2>Three little steps.</h2><ol class="how-steps"><li><strong>Find a favourite.</strong><p>Browse sample phones, laptops, and mice. These demo products use illustrative prices and stock.</p></li><li><strong>Make it your basket.</strong><p>Add units and adjust the quantities. Your basket follows you between designs.</p></li><li><strong>Try an order.</strong><p>Review your basket and simulate an order. The demo moves from pending to confirmed.</p></li></ol><p class="modal-note">This prototype uses in-memory data. No payment is collected and no real order is sent.</p>`;
  if (state.dialog === 'checkout') content = `<div class="eyebrow">ONE LAST LOOK</div><h2>Good choices.</h2><p class="checkout-intro">Review your basket and place a demo order.</p><div class="checkout-items">${cartProducts().map(p => `<div><span>${escape(p.name)} <small>× ${quantity(p.id)}</small></span><strong>${money(p.price * quantity(p.id))}</strong></div>`).join('')}</div><div class="checkout-total"><span>Total</span><strong>${money(total())}</strong></div><form id="checkout-form"><label class="customer-label" for="customer-id">Customer ID</label><input id="customer-id" name="customer" value="${escape(state.customer)}" required maxlength="100" placeholder="e.g. customer-1" autocomplete="off"><p class="field-note">Use a demo customer ID to try the ordering flow.</p><button class="primary checkout-button" type="submit">Place demo order · ${money(total())} ${icon('arrow', 18)}</button></form><p class="demo-note">Simulated order · No payment · No backend writes</p>`;
  if (state.dialog === 'order') {
    const pending = state.order.status === 'pending';
    content = `<div class="order-status-icon ${pending ? 'pending' : ''}">${pending ? '<span class="spinner"></span>' : icon('check', 32)}</div><div class="eyebrow">${pending ? 'ORDER RECEIVED' : 'ALL SET'}</div><h2>${pending ? 'A moment, please.' : 'Your demo order is in.'}</h2><p class="order-status-copy">${pending ? 'Simulating an inventory reservation…' : 'Your demo gear is reserved. Your order is confirmed and ready to review.'}</p><div class="order-receipt"><div><span>Demo order</span><strong>${escape(state.order.id)}</strong></div><div><span>Customer</span><strong>${escape(state.order.customer_id)}</strong></div><div><span>Status</span><strong class="status-label ${pending ? 'pending' : ''}">${pending ? 'Pending' : 'Confirmed'}</strong></div>${state.order.items.map(item => `<div><span>${escape(products.find(p => p.id === item.product_id).name)} × ${item.quantity}</span><strong>${money(products.find(p => p.id === item.product_id).price * item.quantity)}</strong></div>`).join('')}<div class="receipt-total"><span>Total</span><strong>${money(state.order.total)}</strong></div></div><button class="primary checkout-button" data-action="finish" ${pending ? 'disabled' : ''}>Keep exploring ${icon('arrow', 18)}</button><p class="demo-note">This was a simulation. No real order was placed.</p>`;
  }
  overlay.innerHTML = `<div class="overlay-backdrop" data-action="close-overlay"></div><section class="modal ${state.dialog === 'basket' ? 'basket-drawer' : ''}" role="dialog" aria-modal="true" aria-label="${{ basket: 'Your basket', checkout: 'Review demo order', how: 'How it works', order: 'Demo order status' }[state.dialog]}" tabindex="-1"><button class="modal-close" data-action="close" aria-label="Close dialog">${icon('close', 21)}</button>${content}</section>`;
}
function announce(message) { document.getElementById('announcements').textContent = message; }
function openDialog(dialog) {
  returnFocus = document.activeElement;
  state.dialog = dialog;
  renderOverlay();
  document.querySelector('.modal').focus();
}
function closeDialog() {
  state.dialog = null;
  renderOverlay();
  if (returnFocus?.isConnected) returnFocus.focus();
  else document.querySelector('.basket-button, .rail-logo')?.focus();
}
function setVariant(variant) {
  state.variant = variant;
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  url.hash = '';
  history.replaceState(null, '', url);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  announce(`Design ${variant}: ${variants[variant]}. Basket contains ${count()} units, total ${money(total())}.`);
}
function cycleVariant(direction) {
  const keys = Object.keys(variants);
  setVariant(keys[(keys.indexOf(state.variant) + direction + keys.length) % keys.length]);
}
function setPalette(palette) {
  if (!Object.hasOwn(palettes, palette)) return;
  state.palette = palette;
  const url = new URL(location.href);
  url.searchParams.set('palette', palette);
  history.replaceState(null, '', url);
  document.body.dataset.palette = palette;
  document.getElementById('prototype-tools').innerHTML = PrototypeSwitcher();
  document.querySelector(`[data-action="palette"][data-id="${palette}"]`)?.focus({ preventScroll: true });
  announce(`${palettes[palette]} color palette. Basket contains ${count()} units, total ${money(total())}.`);
}
function cyclePalette(direction) {
  const keys = Object.keys(palettes);
  setPalette(keys[(keys.indexOf(state.palette) + direction + keys.length) % keys.length]);
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const { action, id } = target.dataset;
  if (action === 'add' || action === 'subtract') {
    const p = products.find(product => product.id === id);
    const next = Math.max(0, Math.min(p.stock, quantity(id) + (action === 'add' ? 1 : -1)));
    if (next) state.cart[id] = next; else delete state.cart[id];
    if (state.variant === 'C') state.selected = id;
    const dialog = state.dialog;
    render();
    const root = dialog ? document.querySelector('.modal') : document.getElementById('app');
    const focusTarget = root.querySelector(`[data-action="${action}"][data-id="${id}"]:not(:disabled)`) || root.querySelector(`[data-action="${action === 'add' ? 'subtract' : 'add'}"][data-id="${id}"]:not(:disabled)`);
    (focusTarget || document.querySelector('.modal'))?.focus({ preventScroll: true });
    announce(`${p.name}: ${next}. Basket total ${money(total())}.`);
  } else if (action === 'palette') setPalette(id);
  else if (action === 'previous-palette') cyclePalette(-1);
  else if (action === 'next-palette') cyclePalette(1);
  else if (action === 'variant') setVariant(id);
  else if (action === 'previous-variant') cycleVariant(-1);
  else if (action === 'next-variant') cycleVariant(1);
  else if (action === 'basket') openDialog('basket');
  else if (action === 'how') openDialog('how');
  else if (action === 'checkout' && count()) openDialog('checkout');
  else if (action === 'close' || action === 'close-overlay') closeDialog();
  else if (action === 'finish') { state.review = false; closeDialog(); render(); }
  else if (action === 'filter') { state.filter = id; render(); document.querySelector(`[data-action="filter"][data-id="${id}"]`)?.focus({ preventScroll: true }); }
  else if (action === 'reset-filters') { state.filter = 'all'; state.search = ''; render(); }
  else if (action === 'select-product') { state.selected = id; render(); document.querySelector(`[data-action="select-product"][data-id="${id}"]`)?.focus({ preventScroll: true }); }
  else if (action === 'review' && count()) { state.review = true; render(); }
  else if (action === 'back-to-picks') { state.review = false; render(); }
  else if (action === 'details') { state.details = !state.details; document.getElementById('prototype-tools').innerHTML = PrototypeSwitcher(); }
});

document.addEventListener('input', event => {
  if (event.target.dataset.input === 'search') {
    state.search = event.target.value;
    render();
    const input = document.querySelector('[data-input="search"]');
    input.focus({ preventScroll: true });
  } else if (event.target.id === 'customer-id') {
    state.customer = event.target.value;
    document.getElementById('prototype-tools').innerHTML = PrototypeSwitcher();
  }
});
document.addEventListener('change', event => {
  if (event.target.dataset.input === 'sort') { state.sort = event.target.value; render(); document.querySelector('[data-input="sort"]')?.focus({ preventScroll: true }); }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'checkout-form') return;
  event.preventDefault();
  const customer = new FormData(event.target).get('customer').trim();
  if (!customer || !count()) {
    const input = document.getElementById('customer-id');
    input.setCustomValidity('Enter a customer ID.');
    input.reportValidity();
    input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
    return;
  }
  state.customer = customer;
  state.order = { id: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customer_id: customer, items: cartProducts().map(p => ({ product_id: p.id, quantity: quantity(p.id) })), total: total(), status: 'pending' };
  state.cart = {};
  state.dialog = 'order';
  render();
  document.querySelector('.modal').focus();
  announce('Demo order received. Reservation pending.');
  clearTimeout(orderTimer);
  orderTimer = setTimeout(() => {
    state.order.status = 'confirmed';
    document.getElementById('prototype-tools').innerHTML = PrototypeSwitcher();
    if (state.dialog === 'order') { renderOverlay(); document.querySelector('.modal').focus(); }
    announce('Demo order confirmed. No real order was placed.');
  }, 1400);
});

document.addEventListener('keydown', event => {
  if (state.dialog) {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    if (event.key === 'Tab') {
      const focusable = [...document.querySelectorAll('.modal button:not(:disabled), .modal input, .modal a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement.matches('.modal'))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    return;
  }
  if (document.body.dataset.prototype !== 'true' || event.target.closest('input, textarea, select, [contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); (state.variant === 'B' ? cyclePalette : cycleVariant)(event.key === 'ArrowRight' ? 1 : -1); }
});
window.addEventListener('popstate', () => {
  const variant = new URL(location.href).searchParams.get('variant');
  state.variant = Object.hasOwn(variants, variant) ? variant : 'B';
  const palette = new URL(location.href).searchParams.get('palette');
  state.palette = Object.hasOwn(palettes, palette) ? palette : 'blue';
  render();
});
render();
