import { parseInventory, parseProducts } from "./contracts";
import type { CatalogData } from "./types";

export async function gatewayRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const base = (process.env.API_GATEWAY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json" },
  });
}

export async function loadCatalog(): Promise<CatalogData> {
  const [products, inventory] = await Promise.all([
    gatewayRequest("/catalog/products"),
    gatewayRequest("/inventory"),
  ]);
  if (!products.ok || !inventory.ok) throw new Error("Catalog or inventory is unavailable. Please try again.");
  return {
    products: parseProducts(await products.json()),
    inventory: parseInventory(await inventory.json()),
  };
}
