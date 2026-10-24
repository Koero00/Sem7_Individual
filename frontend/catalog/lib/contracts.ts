import type { InventoryItem, Order, Product } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown) => typeof value === "string" && value.length > 0;

export function parseProducts(value: unknown): Product[] {
  if (!Array.isArray(value) || !value.every(p => record(p) && text(p.id) && text(p.name) && typeof p.description === "string" && integer(p.price) && (p.image_url === null || typeof p.image_url === "string"))) {
    throw new Error("The catalog returned an unexpected response.");
  }
  return value;
}

export function parseInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value) || !value.every(item => record(item) && text(item.product_id) && integer(item.quantity))) {
    throw new Error("Inventory returned an unexpected response.");
  }
  return value;
}

export function parseOrder(value: unknown): Order {
  if (!record(value) || !text(value.id) || !text(value.customer_id) || !["pending", "confirmed", "rejected"].includes(String(value.status)) || !Array.isArray(value.items) || value.items.length === 0 || !value.items.every(item => record(item) && text(item.product_id) && integer(item.quantity) && Number(item.quantity) > 0) || typeof value.created_at !== "string" || typeof value.updated_at !== "string" || !(value.rejection_reason === null || typeof value.rejection_reason === "string") || !(value.rejection_details === null || record(value.rejection_details))) {
    throw new Error("The order service returned an unexpected response.");
  }
  // Validated at the network boundary above; the service owns this contract.
  return value as Order;
}
