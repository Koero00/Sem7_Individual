// Development seed: replaces only the three original fruit samples, adds missing
// electronics, and preserves customized products and existing stock on reruns.
const base = (process.env.API_GATEWAY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const products = [
  { id: "1", name: "Horizon 32 OLED Monitor", description: "32-inch widescreen · 3840 × 2160 4K OLED · 240 Hz · HDMI 2.1", price: 239900, image_url: null, stock: 25 },
  { id: "2", name: "Pulse Mechanical Keyboard", description: "75% layout · Hot-swappable linear switches · RGB · USB-C", price: 14900, image_url: null, stock: 30 },
  { id: "3", name: "Echo Wireless Headphones", description: "Active noise cancellation · Bluetooth · 40-hour battery · Graphite", price: 19900, image_url: null, stock: 20 },
  { id: "circuit-nova-phone", name: "Nova Phone", description: "128 GB · Midnight · 6.1-inch smartphone", price: 69900, image_url: null, stock: 12 },
  { id: "circuit-atlas-laptop", name: "Atlas Laptop 14", description: "16 GB RAM · 512 GB SSD · 14-inch display", price: 109900, image_url: null, stock: 8 },
  { id: "circuit-arc-mouse", name: "Arc Wireless Mouse", description: "Bluetooth · Graphite · Wireless mouse", price: 4900, image_url: null, stock: 25 },
  { id: "circuit-velocity-ssd", name: "Velocity NVMe SSD 2 TB", description: "PCIe 4.0 · M.2 2280 · Up to 7,000 MB/s read speed", price: 15900, image_url: null, stock: 35 },
  { id: "circuit-core-processor", name: "Core X8 Desktop Processor", description: "8 cores · 16 threads · Up to 5.2 GHz · AM5 socket", price: 32900, image_url: null, stock: 16 },
  { id: "circuit-flux-memory", name: "Flux DDR5 Memory 32 GB", description: "2 × 16 GB kit · 6,000 MT/s · CL30 · Low-profile heat spreaders", price: 11900, image_url: null, stock: 40 },
  { id: "circuit-prism-graphics", name: "Prism G16 Graphics Card", description: "16 GB GDDR6 · Triple-fan cooling · DisplayPort 2.1 · HDMI 2.1", price: 79900, image_url: null, stock: 7 },
  { id: "circuit-link-dock", name: "Link USB-C Dock", description: "8-in-1 hub · 4K HDMI · Gigabit Ethernet · 100 W power delivery", price: 8900, image_url: null, stock: 28 },
  { id: "circuit-focus-webcam", name: "Focus 4K Webcam", description: "3840 × 2160 at 30 fps · Autofocus · Dual microphones · Privacy shutter", price: 12900, image_url: null, stock: 22 },
  { id: "circuit-wave-speakers", name: "Wave Desktop Speakers", description: "Stereo pair · 40 W RMS · Bluetooth · USB-C audio", price: 9900, image_url: null, stock: 18 },
  { id: "circuit-vector-controller", name: "Vector Wireless Controller", description: "Hall-effect sticks · Bluetooth · USB-C charging · PC compatible", price: 6900, image_url: null, stock: 32 },
  { id: "circuit-slate-tablet", name: "Slate Tablet 11", description: "11-inch 2560 × 1600 display · 128 GB · Wi-Fi 6 · Stylus included", price: 44900, image_url: null, stock: 14 },
];

// Match the complete original records so an edited product with the same ID
// is never mistaken for a disposable sample. Keep IDs to retain order references.
const originalFruits = {
  "1": { name: "Appel", description: "Een heerlijke appel", price: 100, image_url: "https://via.placeholder.com/150" },
  "2": { name: "Banaan", description: "Een heerlijke banaan", price: 200, image_url: "https://via.placeholder.com/150" },
  "3": { name: "Peer", description: "Een heerlijke peer", price: 300, image_url: "https://via.placeholder.com/150" },
};

async function request(path, init) {
  return fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000) });
}

async function addIfMissing(path, collection, body, original) {
  const existing = await request(path);
  if (existing.ok) {
    if (original) {
      const record = await existing.json();
      if (Object.entries(original).every(([key, value]) => record[key] === value)) {
        const updated = await request(path, { method: "PUT", body: JSON.stringify(body) });
        if (!updated.ok) throw new Error(`${path}: ${updated.status}`);
        return "replaced fruit sample";
      }
    }
    return "already exists";
  }
  if (existing.status !== 404) throw new Error(`${path}: ${existing.status}`);
  const created = await request(collection, { method: "POST", body: JSON.stringify(body) });
  if (!created.ok && created.status !== 409) throw new Error(`${collection}: ${created.status}`);
  return "added";
}

try {
  for (const { stock, ...product } of products) {
    const catalog = await addIfMissing(`/catalog/products/${product.id}`, "/catalog/products", product, originalFruits[product.id]);
    const inventory = await addIfMissing(`/inventory/${product.id}`, "/inventory", { product_id: product.id, quantity: stock });
    console.log(`${product.name}: catalog ${catalog}; inventory ${inventory}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
