// THROWAWAY: Which of three ordering layouts should become the Catalog frontend?
// All variants share in-memory seed data and a simulated checkout; no API writes.
const products = [
  { id: '1', name: 'Appel', english: 'Apple', description: 'Een heerlijke appel', copy: 'Crisp, sweet, and always a good idea.', price: 100, stock: 25, color: 'apple', note: 'The everyday favourite' },
  { id: '2', name: 'Banaan', english: 'Banana', description: 'Een heerlijke banaan', copy: 'A little sunshine for your everyday.', price: 200, stock: 30, color: 'banana', note: 'Your golden go-to' },
  { id: '3', name: 'Peer', english: 'Pear', description: 'Een heerlijke peer', copy: 'Soft, mellow, and naturally lovely.', price: 300, stock: 20, color: 'pear', note: 'Something a little softer' },
];
const variants = { A: 'The storefront', B: 'The quick order', C: 'The guided basket' };
const initialVariant = new URL(location.href).searchParams.get('variant');
const state = {
  variant: Object.hasOwn(variants, initialVariant) ? initialVariant : 'A',
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
    leaf: '<path d="M20 3C6 2 2 9 7 16c7 5 14 1 13-13Z"/><path d="M4 21 16 9"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.leaf}</svg>`;
};

// Local vector artwork keeps every prototype self-contained and available offline.
function fruit(kind, suffix = '') {
  const id = `${kind}-${suffix}`;
  const defs = `<defs>
    <linearGradient id="${id}-red" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f38b62"/><stop offset=".48" stop-color="#df4d35"/><stop offset="1" stop-color="#aa292b"/></linearGradient>
    <linearGradient id="${id}-yellow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe895"/><stop offset=".55" stop-color="#f2ca49"/><stop offset="1" stop-color="#d69b26"/></linearGradient>
    <linearGradient id="${id}-green" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8db78"/><stop offset=".5" stop-color="#b3bc57"/><stop offset="1" stop-color="#758841"/></linearGradient>
    <radialGradient id="${id}-light"><stop stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;
  const apple = `<ellipse cx="150" cy="253" rx="76" ry="11" fill="#382a1b" opacity=".09"/>
    <path d="M151 91c-23-26-64-17-80 11-24 43 0 118 33 139 19 12 31 1 46 1s29 11 47-2c34-24 55-99 29-139-18-29-53-35-75-10Z" fill="url(#${id}-red)"/>
    <ellipse cx="109" cy="133" rx="28" ry="45" fill="url(#${id}-light)" transform="rotate(25 109 133)"/>
    <path d="M151 96c-4-17-2-34 9-48" fill="none" stroke="#66422a" stroke-width="9" stroke-linecap="round"/>
    <path d="M154 70c20-32 48-25 61-22-9 27-31 36-61 22Z" fill="#496c3e"/><path d="m159 68 41-15" stroke="#739455" stroke-width="2"/>
    <path d="M134 99q17 10 34-1" fill="none" stroke="#aa342b" stroke-width="3" opacity=".5"/>`;
  const banana = `<ellipse cx="155" cy="253" rx="93" ry="11" fill="#382a1b" opacity=".09"/>
    <path d="M80 66c-12 78 29 153 136 125l24 4c-56 83-161 54-187-8-20-47-15-86 10-128Z" fill="url(#${id}-yellow)"/>
    <path d="M69 78c-8 92 56 147 150 125" fill="none" stroke="#f9df80" stroke-width="6" stroke-linecap="round"/>
    <path d="M80 66 68 48l-9 6 4 16" fill="#725637"/><path d="m228 195 16-2-2 12-12 1" fill="#6d5331"/>
    <path d="M112 58c-4 61 34 108 107 100l15 8c-53 49-122 29-147-18-15-29-13-59 9-94Z" fill="url(#${id}-yellow)"/>
    <path d="M101 68c-2 59 39 110 118 102" fill="none" stroke="#ffe9a0" stroke-width="5" stroke-linecap="round"/>
    <path d="m97 58-4-18 12-3 7 21" fill="#7c6439"/><path d="m222 159 14 5-4 10-12-6" fill="#725637"/>`;
  const pear = `<ellipse cx="150" cy="258" rx="75" ry="10" fill="#382a1b" opacity=".09"/>
    <path d="M146 75c-32 0-30 35-45 62-13 23-39 41-33 76 7 44 51 48 81 48 38 0 82-9 84-51 2-35-24-52-37-77-15-29-17-58-50-58Z" fill="url(#${id}-green)"/>
    <ellipse cx="115" cy="175" rx="31" ry="63" fill="url(#${id}-light)" transform="rotate(23 115 175)"/>
    <path d="M147 79c-3-18 1-32 10-43" fill="none" stroke="#6a472d" stroke-width="8" stroke-linecap="round"/>
    <path d="M151 58c18-23 42-22 58-12-14 20-35 28-58 12Z" fill="#527646"/>
    <g fill="#73833f" opacity=".38"><circle cx="105" cy="202" r="1.7"/><circle cx="163" cy="215" r="1.8"/><circle cx="184" cy="174" r="1.6"/><circle cx="140" cy="154" r="1.4"/><circle cx="127" cy="229" r="1.4"/><circle cx="198" cy="221" r="1.4"/><circle cx="168" cy="118" r="1.4"/></g>`;
  return `<svg class="fruit-art" viewBox="0 0 300 300" fill="none" aria-hidden="true">${defs}${kind === 'apple' ? apple : kind === 'banana' ? banana : pear}</svg>`;
}

function logo(extra = '') {
  return `<a class="brand ${extra}" href="?variant=${state.variant}" aria-label="Orchard catalog">${icon('leaf', 29)}<span>orchard<span class="brand-dot">.</span></span></a>`;
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
  let visible = products.filter(p => (state.filter === 'all' || p.id === state.filter) && `${p.name} ${p.english} ${p.description}`.toLowerCase().includes(state.search.toLowerCase()));
  if (state.sort === 'price-low') visible = visible.toSorted((a, b) => a.price - b.price);
  if (state.sort === 'price-high') visible = visible.toSorted((a, b) => b.price - a.price);
  return visible;
}
function filters() {
  return `<div class="filter-pills" role="group" aria-label="Filter products">
    ${[['all', 'All fruit'], ['1', 'Apples'], ['2', 'Bananas'], ['3', 'Pears']].map(([id, label]) => `<button data-action="filter" data-id="${id}" class="${state.filter === id ? 'active' : ''}" aria-pressed="${state.filter === id}">${label}</button>`).join('')}
  </div>`;
}
function search() {
  return `<label class="search-box">${icon('search', 18)}<input type="search" data-input="search" placeholder="Find your fruit…" aria-label="Search products" value="${escape(state.search)}"></label>`;
}
function sort() {
  return `<label class="sort-label">Sort by <select data-input="sort" aria-label="Sort products"><option value="featured" ${state.sort === 'featured' ? 'selected' : ''}>Featured</option><option value="price-low" ${state.sort === 'price-low' ? 'selected' : ''}>Price: low to high</option><option value="price-high" ${state.sort === 'price-high' ? 'selected' : ''}>Price: high to low</option></select></label>`;
}
function emptyResults() {
  return `<div class="empty-results">${icon('search', 30)}<h3>No fruit found</h3><p>Try another search or browse the whole catalog.</p><button class="text-button" data-action="reset-filters">Show all fruit ${icon('arrow', 16)}</button></div>`;
}
function cartLines() {
  return cartProducts().map(p => `<div class="cart-line"><div class="cart-thumb ${p.color}">${fruit(p.color, `cart-${p.id}`)}</div><div class="cart-line-info"><strong>${p.name}</strong><small>${money(p.price)} each</small>${stepper(p, 'small')}</div><strong>${money(p.price * quantity(p.id))}</strong></div>`).join('');
}
function orderSummary(compact = false) {
  return `<div class="summary-heading"><h2>Your basket<span>${count()}</span></h2>${icon('bag', 23)}</div>
    ${count() ? `<div class="cart-lines">${cartLines()}</div>` : `<div class="empty-cart">${icon('bag', 38)}<h3>A little empty, for now.</h3><p>Add something fresh.<br>Your next good thing is right here.</p></div>`}
    <div class="summary-totals"><div><span>Subtotal</span><strong>${money(total())}</strong></div><div><span>Delivery</span><span class="muted">Not included in this demo</span></div><div class="total-line"><strong>Total</strong><strong>${money(total())}</strong></div></div>
    <button class="primary checkout-button" data-action="checkout" ${!count() ? 'disabled' : ''}>${compact ? 'Review order' : 'Continue to checkout'} ${icon('arrow', 18)}</button>
    <p class="demo-note">Prototype checkout · No payment required</p>`;
}

function VariantA() {
  const visible = filteredProducts();
  return `<div class="storefront">
    <div class="announcement">A little fresh goes a long way. <span>Meet your everyday essentials.</span> ${icon('leaf', 13)}</div>
    <header class="site-header page-width">${logo()}<nav aria-label="Main navigation"><a class="nav-active" href="#products">The catalog</a><button class="nav-link" data-action="how">How it works</button></nav>${basketButton()}</header>
    <main class="page-width">
      <section class="store-hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="eyebrow"><span class="tiny-dot"></span> SIMPLE PICKS. EVERYDAY GOODNESS.</div><h1 id="hero-title">Good things,<br><em>growing daily.</em></h1><p>A small collection of feel-good fruit.<br>Pick your favourites. We’ll take it from there.</p><a class="primary hero-cta" href="#products">Explore the catalog ${icon('arrow', 18)}</a><div class="hero-footnote">${icon('leaf', 17)} Fresh choices. Nothing complicated.</div></div>
      <div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-fruit hero-pear">${fruit('pear', 'hero')}</div><div class="hero-fruit hero-banana">${fruit('banana', 'hero')}</div><div class="hero-fruit hero-apple">${fruit('apple', 'hero')}</div><div class="round-stamp">A little<br><span>naturally</span><br>good.</div><span class="art-caption">THE EVERYDAY COLLECTION — 01 / 03</span><span class="art-spark">✳</span></div></section>
      <section id="products" class="catalog-section"><div class="section-title"><div class="title-row"><h2>A fresh place to start</h2><span class="item-label">${products.length} everyday essentials</span></div>${search()}</div><div class="catalog-toolbar">${filters()}${sort()}</div>
      <div class="product-grid">${visible.length ? visible.map((p, i) => `<article class="product-card"><div class="product-image ${p.color}"><span class="product-number">0${i + 1}</span>${fruit(p.color, `card-${p.id}`)}<span class="stock-pill"><span class="tiny-dot"></span> In stock</span></div><div class="product-heading"><div><h3>${p.name}</h3><span class="product-english">${p.english}</span></div><div class="product-price">${money(p.price)}<small>/ piece</small></div></div><p class="product-copy">${p.copy}</p><div class="product-action"><span>${p.stock} available</span>${quantity(p.id) ? stepper(p) : `<button class="add-button" data-action="add" data-id="${p.id}">Add to basket ${icon('plus', 17)}</button>`}</div></article>`).join('') : emptyResults()}</div></section>
      <footer class="store-footer"><span>${icon('leaf', 17)} A few good things. A simpler kind of shop.</span><span>Orchard / The Catalog</span></footer>
    </main>
  </div>`;
}

function VariantB() {
  const visible = filteredProducts();
  return `<div class="quick-order">
    <aside class="quick-rail"><a class="rail-logo" href="?variant=B" aria-label="Orchard catalog">${icon('leaf', 29)}</a><a class="rail-item selected" href="#quick-products" aria-label="Catalog">${icon('list', 23)}</a><button class="rail-item" data-action="basket" aria-label="View basket">${icon('bag', 23)}${count() ? `<span class="rail-count">${count()}</span>` : ''}</button><span class="rail-bottom">O.</span></aside>
    <div class="quick-main"><header class="quick-header"><span>ORCHARD <span class="header-slash">/</span> THE DAILY MARKET</span><button class="nav-link" data-action="how">How it works ${icon('right', 15)}</button></header>
    <main class="quick-layout"><section class="quick-catalog" id="quick-products"><div class="eyebrow">LESS BROWSING. MORE GOOD STUFF.</div><h1>Your daily<br><span>fruit run.</span></h1><p class="quick-intro">Three good choices. One simple order.<br>Set your quantities and you’re ready to go.</p><div class="quick-tools">${search()}<span class="live-stock"><span class="tiny-dot"></span> Seed stock</span></div><div class="quick-filter-row">${filters()}${sort()}</div>
      <div class="market-table"><div class="market-table-head"><span>PRODUCT</span><span>PER PIECE</span><span>QUANTITY</span><span>SUBTOTAL</span></div>${visible.length ? visible.map(p => `<article class="market-row"><div class="market-product"><div class="market-fruit ${p.color}">${fruit(p.color, `list-${p.id}`)}</div><div><h2>${p.name}</h2><p>${p.english} <span>·</span> ${p.stock} available</p><small class="mobile-unit">${money(p.price)} / piece</small></div></div><strong class="market-unit">${money(p.price)}</strong>${stepper(p)}<strong class="market-subtotal">${money(p.price * quantity(p.id))}</strong></article>`).join('') : emptyResults()}</div>
      <div class="quick-tip"><span class="tip-icon">${icon('check', 19)}</span><p><strong>Your list, your pace.</strong> Adjust quantities here. Review everything before you order.</p></div>
      <div class="quick-bottom"><span>SMALL CATALOG. GOOD CHOICES.</span><span>01 — 03</span></div></section>
      <aside class="quick-summary">${orderSummary(true)}</aside>
    </main></div>
  </div>`;
}

function VariantC() {
  const selected = products.find(p => p.id === state.selected);
  return `<div class="guided">
    <header class="guided-header">${logo()}<span class="guided-header-note">GOOD FRUIT. YOUR WAY.</span>${basketButton()}</header>
    <main class="guided-layout"><section class="guided-feature ${selected.color}"><div class="feature-top"><span>THE EVERYDAY COLLECTION</span><span>0${products.indexOf(selected) + 1} / 03</span></div><div class="feature-title"><span class="eyebrow">${selected.note}</span><h1>${selected.english}<span>.</span></h1></div><div class="feature-fruit">${fruit(selected.color, 'feature')}</div><span class="feature-script">a little everyday good</span><div class="feature-bottom"><div><span>${selected.name}</span><p>${selected.copy}</p></div><strong>${money(selected.price)}<small>/ piece</small></strong></div></section>
    <section class="guided-builder"><div class="step-track"><span class="${!state.review ? 'current' : 'complete'}"><b>${state.review ? icon('check', 12) : '1'}</b> Pick your fruit</span><i></i><span class="${state.review ? 'current' : ''}"><b>2</b> Review & order</span></div>
      ${state.review ? `<div class="guided-review"><button class="back-link" data-action="back-to-picks">${icon('left', 16)} Back to your picks</button><div class="eyebrow">LOOKING GOOD</div><h2>A basket<br>with your name on it.</h2>${orderSummary(true)}</div>` : `<div class="builder-heading"><div class="eyebrow">MAKE IT YOURS</div><h2>A few good things.<br><em>Picked by you.</em></h2><p>Build your basket, one little favourite at a time.</p></div><div class="guided-picks">${products.map(p => `<article class="pick-row ${state.selected === p.id ? 'is-selected' : ''}"><button class="pick-select" data-action="select-product" data-id="${p.id}" aria-label="View ${p.name}" aria-pressed="${state.selected === p.id}"><span class="pick-dot ${p.color}"></span><span><strong>${p.name}</strong><small>${p.english} · ${money(p.price)} / piece</small></span></button>${stepper(p)}</article>`).join('')}</div><div class="builder-hint">${icon('leaf', 17)} A small selection. All the good stuff.</div><div class="builder-total"><span>Your basket <small>${count()} ${count() === 1 ? 'piece' : 'pieces'}</small></span><strong>${money(total())}</strong></div><button class="primary guided-continue" data-action="review" ${!count() ? 'disabled' : ''}>Review your basket ${icon('arrow', 18)}</button><p class="demo-note">Just exploring? Everything stays in this session.</p>`}
    </section></main>
    <footer class="guided-footer"><span>ORCHARD — SIMPLE BY NATURE.</span><span>Small choices. A good day.</span></footer>
  </div>`;
}

function PrototypeSwitcher() {
  const payload = { customer_id: state.customer, items: cartProducts().map(p => ({ product_id: p.id, quantity: quantity(p.id) })) };
  return `${state.details ? `<aside class="prototype-details"><div><strong>Prototype state</strong><button data-action="details" aria-label="Close prototype state">${icon('close', 16)}</button></div><p>In-memory demo · prices in cents · no API requests</p><pre>${escape(JSON.stringify({ variant: state.variant, layout: variants[state.variant], search: state.search, filter: state.filter, sort: state.sort, selected_product: state.selected, review: state.review, basket: state.cart, total_cents: total(), order: state.order, next_api_request: { method: 'POST', path: '/orders', body: payload } }, null, 2))}</pre></aside>` : ''}
    <div class="prototype-bar" aria-label="Prototype design switcher"><span class="prototype-tag">PROTOTYPE</span><button data-action="previous-variant" aria-label="Previous design">${icon('left', 17)}</button><span class="variant-name">${state.variant}<span> / </span>${variants[state.variant]}</span><button data-action="next-variant" aria-label="Next design">${icon('right', 17)}</button><div class="variant-dots">${Object.keys(variants).map(v => `<button class="${v === state.variant ? 'active' : ''}" data-action="variant" data-id="${v}" aria-label="Design ${v}: ${variants[v]}" aria-pressed="${state.variant === v}">${v}</button>`).join('')}</div><button class="details-toggle" data-action="details" aria-expanded="${state.details}">{ }</button></div>`;
}

function render() {
  document.body.dataset.variant = state.variant;
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
  if (state.dialog === 'how') content = `<div class="eyebrow">FROM CATALOG TO BASKET</div><h2>Three little steps.</h2><ol class="how-steps"><li><strong>Find a favourite.</strong><p>Browse three fruits from the Catalog service’s seed data.</p></li><li><strong>Make it your basket.</strong><p>Add pieces and adjust the quantities. Your basket follows you between designs.</p></li><li><strong>Try an order.</strong><p>Review your basket and simulate an order. The demo moves from pending to confirmed.</p></li></ol><p class="modal-note">This prototype uses in-memory data. No payment is collected and no real order is sent.</p>`;
  if (state.dialog === 'checkout') content = `<div class="eyebrow">ONE LAST LOOK</div><h2>Good choices.</h2><p class="checkout-intro">Review your basket and place a demo order.</p><div class="checkout-items">${cartProducts().map(p => `<div><span>${escape(p.name)} <small>× ${quantity(p.id)}</small></span><strong>${money(p.price * quantity(p.id))}</strong></div>`).join('')}</div><div class="checkout-total"><span>Total</span><strong>${money(total())}</strong></div><form id="checkout-form"><label class="customer-label" for="customer-id">Customer ID</label><input id="customer-id" name="customer" value="${escape(state.customer)}" required maxlength="100" placeholder="e.g. customer-1" autocomplete="off"><p class="field-note">Use a demo customer ID to try the ordering flow.</p><button class="primary checkout-button" type="submit">Place demo order · ${money(total())} ${icon('arrow', 18)}</button></form><p class="demo-note">Simulated order · No payment · No backend writes</p>`;
  if (state.dialog === 'order') {
    const pending = state.order.status === 'pending';
    content = `<div class="order-status-icon ${pending ? 'pending' : ''}">${pending ? '<span class="spinner"></span>' : icon('check', 32)}</div><div class="eyebrow">${pending ? 'ORDER RECEIVED' : 'LOOKING FRESH'}</div><h2>${pending ? 'A moment, please.' : 'Your demo order is in.'}</h2><p class="order-status-copy">${pending ? 'Simulating an inventory reservation…' : 'Your fruit is reserved. That’s the whole journey, from a little browse to a good basket.'}</p><div class="order-receipt"><div><span>Demo order</span><strong>${escape(state.order.id)}</strong></div><div><span>Customer</span><strong>${escape(state.order.customer_id)}</strong></div><div><span>Status</span><strong class="status-label ${pending ? 'pending' : ''}">${pending ? 'Pending' : 'Confirmed'}</strong></div>${state.order.items.map(item => `<div><span>${escape(products.find(p => p.id === item.product_id).name)} × ${item.quantity}</span><strong>${money(products.find(p => p.id === item.product_id).price * item.quantity)}</strong></div>`).join('')}<div class="receipt-total"><span>Total</span><strong>${money(state.order.total)}</strong></div></div><button class="primary checkout-button" data-action="finish" ${pending ? 'disabled' : ''}>Keep exploring ${icon('arrow', 18)}</button><p class="demo-note">This was a simulation. No real order was placed.</p>`;
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
  announce(`Design ${variant}: ${variants[variant]}. Basket contains ${count()} pieces, total ${money(total())}.`);
}
function cycleVariant(direction) {
  const keys = Object.keys(variants);
  setVariant(keys[(keys.indexOf(state.variant) + direction + keys.length) % keys.length]);
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
  } else if (action === 'variant') setVariant(id);
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
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycleVariant(event.key === 'ArrowRight' ? 1 : -1); }
});
window.addEventListener('popstate', () => {
  const variant = new URL(location.href).searchParams.get('variant');
  state.variant = Object.hasOwn(variants, variant) ? variant : 'A';
  render();
});
render();
