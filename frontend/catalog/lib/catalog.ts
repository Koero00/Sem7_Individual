import type { Cart, Category, InventoryItem, Product } from "./types";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

// The current Catalog contract has no category field. These are display-only
// groupings; unknown products remain visible under All products and Other.
export function categoryFor(product: Product): Category {
  const name = product.name.toLowerCase();
  if (/\b(phone|smartphone|iphone)\b/.test(name)) return "phones";
  if (/\b(laptop|notebook|macbook)\b/.test(name)) return "laptops";
  if (/\b(mouse|mice)\b/.test(name)) return "mice";
  return "other";
}

export function availableStock(inventory: InventoryItem[], id: string): number {
  return inventory.find(item => item.product_id === id)?.quantity ?? 0;
}

export function reconcileCart(cart: Cart, products: Product[], inventory: InventoryItem[]): Cart {
  const next: Cart = {};
  for (const product of products) {
    const requested = cart[product.id];
    if (!Number.isSafeInteger(requested) || requested <= 0) continue;
    const quantity = Math.min(requested, availableStock(inventory, product.id));
    if (quantity > 0) next[product.id] = quantity;
  }
  return next;
}

export function cartTotal(cart: Cart, products: Product[]): number {
  return products.reduce((total, product) => total + product.price * (cart[product.id] ?? 0), 0);
}
