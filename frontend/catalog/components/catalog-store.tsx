"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { availableStock, cartTotal, categoryFor, money, reconcileCart } from "@/lib/catalog";
import { parseInventory, parseOrder, parseProducts } from "@/lib/contracts";
import type { Cart, CatalogData, Category, Order, OrderRequest } from "@/lib/types";
import { BasketSummary } from "./basket-summary";
import { Dialog } from "./dialog";
import { Icon } from "./icon";
import { ProductImage } from "./product-image";
import { QuantityControl } from "./quantity-control";

class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    ...init, headers: { "Content-Type": "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new ApiError(typeof body.detail === "string" ? body.detail : "Please check your customer ID and quantities.", response.status);
  return body;
}

async function readCatalog(): Promise<CatalogData> {
  const [products, inventory] = await Promise.all([api("/catalog/products"), api("/inventory")]);
  return { products: parseProducts(products), inventory: parseInventory(inventory) };
}

const CART_KEY = "circuit.cart.v1";
const ORDER_KEY = "circuit.order.v1";
const categories: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "All products" }, { key: "phones", label: "Phones" },
  { key: "laptops", label: "Laptops" }, { key: "mice", label: "Mice" }, { key: "other", label: "Other" },
];

export function CatalogStore({ initialData, initialError }: { initialData: CatalogData; initialError: string | null }) {
  const [data, setData] = useState(initialData);
  const [catalogError, setCatalogError] = useState(initialError);
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [sort, setSort] = useState("featured");
  const [dialog, setDialog] = useState<"basket" | "checkout" | "order" | "help" | null>(null);
  const [customer, setCustomer] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState("");
  const [pollingPaused, setPollingPaused] = useState(false);
  const submissionLock = useRef(false);
  const locked = submitting || refreshing || Boolean(catalogError) || uncertain || Boolean(trackedId && (!order || order.status === "pending"));
  const count = Object.values(cart).reduce((sum, q) => sum + q, 0);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        // Entries are checked against products and live stock before use.
        const safe = Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === "number" && Number.isSafeInteger(value) && value > 0));
        setCart(initialError ? safe : reconcileCart(safe, initialData.products, initialData.inventory));
      }
      const last = sessionStorage.getItem(ORDER_KEY);
      if (last && /^[0-9a-f-]{36}$/i.test(last)) { setTrackedId(last); setDialog("order"); }
    } catch { /* Session storage is optional. */ }
    setHydrated(true);
  }, [initialData, initialError]);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* In-memory basket still works. */ }
  }, [cart, hydrated]);

  useEffect(() => {
    if (!trackedId || pollingPaused || (order && order.status !== "pending")) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 60_000;
    async function check() {
      try {
        const next = parseOrder(await api(`/orders/${encodeURIComponent(trackedId!)}`));
        if (!active) return;
        setOrder(next); setOrderError("");
        if (next.status !== "pending") {
          setNotice(next.status === "confirmed" ? "Your order is confirmed." : "Your order was rejected. Review availability before trying again.");
          // A failed stock refresh does not change the authoritative order result.
          try {
            const updated = await readCatalog();
            if (active) {
              setData(updated); setCatalogError(null);
              setCart(current => reconcileCart(next.status === "rejected" ? Object.fromEntries(next.items.map(item => [item.product_id, item.quantity])) : current, updated.products, updated.inventory));
            }
          } catch { if (active) setCatalogError("Order status is available, but stock could not be refreshed. Refresh before ordering again."); }
          return;
        }
      } catch (error) {
        if (active && error instanceof ApiError && error.status === 404) {
          setTrackedId(null); setOrder(null); setDialog(null);
          try { sessionStorage.removeItem(ORDER_KEY); } catch { /* Optional storage. */ }
          setNotice("The previous order is no longer available in this environment.");
          return;
        }
        if (active) setOrderError("We couldn’t check the order status. Your order may still be processing. Do not submit it again.");
      }
      if (!active) return;
      if (Date.now() >= deadline) { setPollingPaused(true); return; }
      timer = setTimeout(check, 2000);
    }
    void check();
    return () => { active = false; clearTimeout(timer); };
    // Polling follows the order ID and status, not each returned order object.
  }, [trackedId, order?.status, pollingPaused]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = data.products.filter(p => (category === "all" || categoryFor(p) === category) && `${p.name} ${p.description}`.toLowerCase().includes(query));
    if (sort === "low") result.sort((a, b) => a.price - b.price);
    if (sort === "high") result.sort((a, b) => b.price - a.price);
    return result;
  }, [data.products, search, category, sort]);

  async function refreshCatalog() {
    setRefreshing(true);
    try {
      const updated = await readCatalog();
      setData(updated); setCatalogError(null);
      setCart(current => {
        const next = reconcileCart(current, updated.products, updated.inventory);
        return next;
      });
      setNotice("Catalog and stock refreshed. Basket quantities were checked against availability.");
    } catch { setCatalogError("We couldn’t refresh the catalog and stock. Please try again. Ordering is paused until we reconnect."); }
    finally { setRefreshing(false); }
  }

  function changeQuantity(id: string, requested: number) {
    if (locked) return;
    const quantity = Math.max(0, Math.min(availableStock(data.inventory, id), requested));
    setCart(current => {
      const next = { ...current };
      if (quantity) next[id] = quantity; else delete next[id];
      return next;
    });
    const product = data.products.find(p => p.id === id);
    setNotice(`${product?.name}: ${quantity} in your basket.`);
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || locked || !count || !customer.trim()) return;
    submissionLock.current = true;
    setSubmitting(true); setCheckoutError("");
    let posting = false;
    try {
      const latest = await readCatalog();
      const checked = reconcileCart(cart, latest.products, latest.inventory);
      const priceChanged = data.products.some(p => cart[p.id] && latest.products.find(next => next.id === p.id)?.price !== p.price);
      setData(latest);
      const quantitiesChanged = Object.keys(checked).length !== Object.keys(cart).length || Object.entries(cart).some(([id, q]) => checked[id] !== q);
      if (quantitiesChanged || priceChanged) {
        setCart(checked);
        setCheckoutError("Prices or availability changed. Your basket has been updated; please review it before submitting.");
        return;
      }
      const payload: OrderRequest = { customer_id: customer.trim(), items: Object.entries(checked).map(([product_id, quantity]) => ({ product_id, quantity })) };
      posting = true;
      const created = parseOrder(await api("/orders", { method: "POST", body: JSON.stringify(payload) }));
      setOrder(created); setTrackedId(created.id); setPollingPaused(false); setOrderError("");
      try { sessionStorage.setItem(ORDER_KEY, created.id); } catch { /* Status remains available in this session. */ }
      setDialog("order");
      if (created.status !== "rejected") setCart({});
      setNotice("Order submitted. Waiting for inventory confirmation.");
    } catch (error) {
      if (posting && (!(error instanceof ApiError) || error.status >= 500)) {
        setUncertain(true);
        setCheckoutError("We couldn’t verify whether your order was accepted. Do not resubmit: that could create a duplicate. Check the order service before trying again.");
      } else {
        setCheckoutError(error instanceof ApiError ? error.message : "We couldn’t check current availability. Please try again.");
      }
    } finally { setSubmitting(false); submissionLock.current = false; }
  }

  const summary = <BasketSummary products={data.products} inventory={data.inventory} cart={cart} locked={locked} onChange={changeQuantity} onCheckout={() => { setCheckoutError(""); setDialog("checkout"); }} />;

  return <>
    <div className="quick-order">
      <aside className="quick-rail"><a className="rail-logo" href="/" aria-label="Circuit catalog"><Icon name="bolt" size={29} /></a><a className="rail-item selected" href="#products" aria-label="Catalog"><Icon name="list" size={23} /></a><button className="rail-item" aria-label={`View basket, ${count} items`} onClick={() => setDialog("basket")}><Icon name="bag" size={23} />{count > 0 && <span className="rail-count">{count}</span>}</button><span className="rail-bottom">C.</span></aside>
      <div className="quick-main"><header className="quick-header"><a href="/">CIRCUIT <span className="header-slash">/</span> EVERYDAY ELECTRONICS</a><button className="nav-link" onClick={() => setDialog("help")}>How it works <Icon name="arrow" size={15} /></button></header>
        <main className="quick-layout"><section className="quick-catalog" id="products" aria-labelledby="catalog-title">
          <div className="eyebrow">THE RIGHT TECH. LESS FUSS.</div><h1 id="catalog-title">Your next<br /><span>upgrade.</span></h1><p className="quick-intro">Phones, laptops, and the little things that connect them.<br />Set your quantities and you’re ready to go.</p>
          <div className="quick-tools"><label className="search-box"><Icon name="search" size={18} /><input type="search" placeholder="Search your next upgrade…" aria-label="Search products" value={search} onChange={e => setSearch(e.target.value)} /></label><button className="stock-refresh" disabled={refreshing || submitting} onClick={() => void refreshCatalog()} aria-label="Refresh catalog and stock"><Icon name="refresh" size={14} />{refreshing ? "Refreshing…" : catalogError ? "Reconnect" : "Refresh stock"}</button></div>
          <div className="quick-filter-row"><div className="filter-pills" role="group" aria-label="Filter products">{categories.filter(c => c.key !== "other" || data.products.some(p => categoryFor(p) === "other")).map(c => <button key={c.key} className={category === c.key ? "active" : ""} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</button>)}</div><label className="sort-label">Sort by <select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div>
          {catalogError && <div className="error-banner" role="alert"><strong>We’re having trouble connecting.</strong><p>{catalogError}</p><button className="text-button" disabled={refreshing} onClick={() => void refreshCatalog()}>Try again <Icon name="arrow" size={15} /></button></div>}
          <div className="market-table"><div className="market-table-head" aria-hidden="true"><span>PRODUCT</span><span>UNIT PRICE</span><span>QUANTITY</span><span>SUBTOTAL</span></div>
            {visible.map(p => {
              const stock = availableStock(data.inventory, p.id);
              return <article className="market-row" key={p.id}><div className="market-product"><div className="market-thumbnail"><ProductImage key={p.image_url} product={p} /></div><div><h2>{p.name}</h2><p>{p.description}<br /><span className={stock === 0 ? "out-of-stock" : ""}>{stock ? `${stock} available` : "Out of stock"}</span></p><small className="mobile-unit">{money(p.price)} / unit</small></div></div><strong className="market-unit">{money(p.price)}</strong><QuantityControl name={p.name} quantity={cart[p.id] ?? 0} maximum={stock} disabled={locked} onChange={q => changeQuantity(p.id, q)} /><strong className="market-subtotal">{money(p.price * (cart[p.id] ?? 0))}</strong></article>;
            })}
            {!visible.length && <div className="empty-results"><Icon name="search" size={30} /><h2>{data.products.length ? "No products found" : catalogError ? "Catalog unavailable" : "The catalog is empty"}</h2><p>{data.products.length ? "Try another search or category." : "Products will appear here when they’re available."}</p>{data.products.length > 0 && <button className="text-button" onClick={() => { setSearch(""); setCategory("all"); }}>Show all products <Icon name="arrow" size={16} /></button>}</div>}
          </div>
          <div className="quick-tip"><span className="tip-icon"><Icon name="check" size={19} /></span><p><strong>Your list, your pace.</strong>Adjust quantities here. Review everything before you order.</p></div>
          <footer className="quick-bottom"><span>SMALL CATALOG. GOOD CHOICES.</span><span>{visible.length} / {data.products.length} PRODUCTS</span></footer>
        </section><aside className="quick-summary" aria-label="Basket summary">{summary}</aside></main>
      </div>
    </div>
    <div className="sr-only" role="status" aria-live="polite">{notice}</div>
    {order && !dialog && <button className="order-tracker" onClick={() => setDialog("order")}><span className={`status-dot ${order.status}`} />Order {order.status}<Icon name="arrow" size={15} /></button>}
    {dialog === "basket" && <Dialog title="Your basket" drawer onClose={() => setDialog(null)}>{summary}</Dialog>}
    {dialog === "help" && <Dialog title="How ordering works" onClose={() => setDialog(null)}><div className="eyebrow">FROM CATALOG TO BASKET</div><h2>Three simple steps.</h2><ol className="how-steps"><li><strong>Find your next upgrade.</strong><p>Browse products and availability from the store.</p></li><li><strong>Build your basket.</strong><p>Choose quantities and review the item prices.</p></li><li><strong>Place your order.</strong><p>Your order is initially pending. Inventory then confirms or rejects the reservation.</p></li></ol><p className="modal-note">Orders are saved to the order service. No payment or delivery is arranged by this version. Customer IDs are entered manually because account sign-in is not available yet.</p></Dialog>}
    {dialog === "checkout" && <Dialog title="Review order" onClose={() => { if (!submitting) setDialog(null); }}>
      <div className="eyebrow">ONE LAST LOOK</div><h2>Good choices.</h2><p className="checkout-intro">Review your basket before placing your order.</p>
      <div className="checkout-items">{data.products.filter(p => cart[p.id]).map(p => <div key={p.id}><span>{p.name} <small>× {cart[p.id]}</small></span><strong>{money(p.price * cart[p.id])}</strong></div>)}</div><div className="checkout-total"><span>Items total</span><strong>{money(cartTotal(cart, data.products))}</strong></div>
      <form onSubmit={submitOrder}><label className="customer-label" htmlFor="customer-id">Customer ID</label><input id="customer-id" required maxLength={100} value={customer} disabled={submitting} onChange={e => setCustomer(e.target.value)} placeholder="e.g. customer-1" autoComplete="off" /><p className="field-note">Use the customer ID you want to associate with this order.</p>{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}<button type="submit" className="primary checkout-button" disabled={!count || locked || !customer.trim()}>{submitting ? "Submitting your order…" : `Place order · ${money(cartTotal(cart, data.products))}`}<Icon name="arrow" size={18} /></button></form><p className="fine-print">This creates a real order in this environment.<br />No payment is collected. Delivery is not included.</p>
    </Dialog>}
    {dialog === "order" && <Dialog title="Order status" onClose={() => setDialog(null)}>
      <div className={`order-status-icon ${!order || order.status === "pending" ? "pending" : order.status}`}>
        {!order || order.status === "pending" ? <span className="spinner" /> : <Icon name={order.status === "confirmed" ? "check" : "close"} size={30} />}
      </div><div className="eyebrow">{order?.status === "confirmed" ? "ALL SET" : order?.status === "rejected" ? "RESERVATION UNSUCCESSFUL" : "ORDER RECEIVED"}</div>
      <h2>{order?.status === "confirmed" ? "Your order is confirmed." : order?.status === "rejected" ? "Your order wasn’t reserved." : "Checking your order…"}</h2>
      <p className="order-status-copy">{order?.status === "confirmed" ? "Inventory has reserved your items. Your order is saved." : order?.status === "rejected" ? "Availability changed or an item could not be reserved. Your order has been recorded as rejected." : "We’re waiting for inventory to confirm your reservation. You can close this panel while it processes."}</p>
      {orderError && <p className="form-error" role="alert">{orderError}</p>}
      <div className="order-receipt"><div><span>Order ID</span><strong>{trackedId}</strong></div>{order && <><div><span>Customer</span><strong>{order.customer_id}</strong></div><div><span>Status</span><strong className={`status-label ${order.status}`}>{order.status}</strong></div>{order.items.map(item => <div key={item.product_id}><span>{data.products.find(p => p.id === item.product_id)?.name ?? item.product_id}</span><strong>× {item.quantity}</strong></div>)}{order.rejection_reason && <div><span>Reason</span><strong>{order.rejection_reason.replaceAll("_", " ")}</strong></div>}</>}</div>
      {pollingPaused && <><p className="modal-note">The order is still being checked. Keep this order ID; do not submit the same basket again.</p><button className="primary checkout-button" onClick={() => { setOrderError(""); setPollingPaused(false); }}>Check status again <Icon name="refresh" size={17} /></button></>}
      <button className="text-button" onClick={() => setDialog(null)}>Back to catalog <Icon name="arrow" size={17} /></button>
    </Dialog>}
  </>;
}
