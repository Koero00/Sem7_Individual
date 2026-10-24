// Opt-in development seed: adds namespaced records and never overwrites existing
// products or resets stock. Safe to rerun against the same development gateway.
const base = (process.env.API_GATEWAY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const products = [
  { id: "circuit-nova-phone", name: "Nova Phone", description: "128 GB · Midnight · 6.1-inch smartphone", price: 69900, image_url: null, stock: 12 },
  { id: "circuit-atlas-laptop", name: "Atlas Laptop 14", description: "16 GB RAM · 512 GB SSD · 14-inch display", price: 109900, image_url: null, stock: 8 },
  { id: "circuit-arc-mouse", name: "Arc Wireless Mouse", description: "Bluetooth · Graphite · Wireless mouse", price: 4900, image_url: null, stock: 25 },
];

async function request(path, init) {
  return fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000) });
}

async function addIfMissing(path, collection, body) {
  const existing = await request(path);
  if (existing.ok) return "already exists";
  if (existing.status !== 404) throw new Error(`${path}: ${existing.status}`);
  const created = await request(collection, { method: "POST", body: JSON.stringify(body) });
  if (!created.ok && created.status !== 409) throw new Error(`${collection}: ${created.status}`);
  return "added";
}

try {
  for (const { stock, ...product } of products) {
    const catalog = await addIfMissing(`/catalog/products/${product.id}`, "/catalog/products", product);
    const inventory = await addIfMissing(`/inventory/${product.id}`, "/inventory", { product_id: product.id, quantity: stock });
    console.log(`${product.name}: catalog ${catalog}; inventory ${inventory}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
