import assert from "node:assert/strict";
import test from "node:test";
import { cartTotal, categoryFor, reconcileCart } from "../lib/catalog";
import { parseInventory, parseOrder, parseProducts } from "../lib/contracts";

const products = [
  { id: "phone", name: "Nova Phone", description: "128 GB", price: 69900, image_url: null },
  { id: "mouse", name: "Wireless Mouse", description: "Bluetooth", price: 4900, image_url: null },
];

test("stock refresh caps a stale basket and removes deleted or unavailable products", () => {
  assert.deepEqual(reconcileCart({ phone: 5, mouse: 2, removed: 1 }, products, [{ product_id: "phone", quantity: 2 }]), { phone: 2 });
});

test("corrupt stored quantities cannot create negative, fractional, or excessive orders", () => {
  assert.deepEqual(reconcileCart({ phone: -1, mouse: 1.5 }, products, [{ product_id: "phone", quantity: 10 }, { product_id: "mouse", quantity: 10 }]), {});
});

test("API prices remain integer cents in basket calculations", () => {
  assert.equal(cartTotal({ phone: 1, mouse: 2 }, products), 79700);
});

test("products without electronics keywords remain browsable", () => {
  assert.equal(categoryFor({ ...products[0], name: "Appel" }), "other");
  assert.equal(categoryFor(products[1]), "mice");
});

test("malformed or negative backend prices and stock are rejected, not displayed as valid stock", () => {
  assert.deepEqual(parseProducts(products), products);
  assert.throws(() => parseProducts([{ ...products[0], price: "69900" }]));
  assert.throws(() => parseInventory([{ product_id: "phone", quantity: -1 }]));
});

test("a rejected reservation stays rejected with its reason; unknown statuses fail validation", () => {
  const order = { id: "10000000-0000-4000-8000-000000000001", customer_id: "customer-1", items: [{ product_id: "phone", quantity: 1 }], status: "rejected", rejection_reason: "insufficient_stock", rejection_details: {}, created_at: "2026-10-24T10:00:00Z", updated_at: "2026-10-24T10:00:01Z" };
  assert.equal(parseOrder(order).rejection_reason, "insufficient_stock");
  assert.throws(() => parseOrder({ ...order, status: "paid" }));
});
