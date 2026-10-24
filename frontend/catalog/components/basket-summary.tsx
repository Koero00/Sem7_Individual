import { availableStock, cartTotal, money } from "@/lib/catalog";
import type { Cart, InventoryItem, Product } from "@/lib/types";
import { Icon } from "./icon";
import { ProductImage } from "./product-image";
import { QuantityControl } from "./quantity-control";

export function BasketSummary({ products, inventory, cart, locked, onChange, onCheckout }: {
  products: Product[]; inventory: InventoryItem[]; cart: Cart; locked: boolean;
  onChange: (id: string, quantity: number) => void; onCheckout: () => void;
}) {
  const items = products.filter(p => cart[p.id]);
  const count = Object.values(cart).reduce((sum, q) => sum + q, 0);
  return <>
    <div className="summary-heading"><h2>Your basket <span>{count}</span></h2><Icon name="bag" size={23} /></div>
    {items.length ? <div className="cart-lines">{items.map(p => <div key={p.id} className="cart-line">
      <div className="cart-thumb"><ProductImage product={p} /></div>
      <div className="cart-line-info"><strong>{p.name}</strong><small>{money(p.price)} each</small><QuantityControl name={p.name} quantity={cart[p.id]} maximum={availableStock(inventory, p.id)} disabled={locked} onChange={q => onChange(p.id, q)} /></div>
      <strong>{money(p.price * cart[p.id])}</strong>
    </div>)}</div> : <div className="empty-cart"><Icon name="bag" size={38} /><h3>A little empty, for now.</h3><p>Find your next upgrade.<br />Your gear will appear here.</p></div>}
    <div className="summary-totals"><div><span>Subtotal</span><strong>{money(cartTotal(cart, products))}</strong></div><div><span>Delivery</span><span className="muted">Not calculated</span></div><div className="total-line"><strong>Items total</strong><strong>{money(cartTotal(cart, products))}</strong></div></div>
    <button className="primary checkout-button" disabled={!items.length || locked} onClick={onCheckout}>Review order <Icon name="arrow" size={18} /></button>
    <p className="fine-print">Availability is confirmed when your order is processed.<br />No payment is collected by this store yet.</p>
  </>;
}
