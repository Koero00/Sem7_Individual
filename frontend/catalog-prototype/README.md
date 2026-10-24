# Catalog UI prototype — throwaway

Question: should ordering start with visual browsing, a quick quantity list, or a guided basket?

**Preferred direction: B, the quick-order list, themed as an electronics store.**

Three structurally different layouts share the same in-memory basket. No real orders or payments are sent. The prototype now uses fictional electronics demo products rather than the backend's fruit seed data:

| Product | Example specification | Demo unit price | Demo stock |
| --- | --- | --- | --- |
| Nova Phone | 128 GB, Midnight | €699 | 12 |
| Atlas Laptop 14 | 16 GB RAM, 512 GB SSD | €1,099 | 8 |
| Arc Wireless Mouse | Bluetooth, Graphite | €49 | 25 |

Names, specifications, prices, and stock are illustrative. Backend seed data has not been migrated. Phones, Laptops, and Mice are local demo categories; the Catalog API currently has no category or specification fields. Currency is an EUR display assumption for this prototype; the backend stores integer cents without a currency field.

## Run

With Node.js 20 or newer, from this directory:

```powershell
npm run prototype
```

No dependencies need installing. Open <http://localhost:5173/prototype/catalog?variant=B>.

| Variant | Design | Ordering approach |
| --- | --- | --- |
| `?variant=A` | The storefront | Editorial hero and product cards, with a basket drawer |
| `?variant=B` | The quick order | Compact product list with quantities and a persistent basket summary |
| `?variant=C` | The guided basket | Large product spotlight, then pick → review → order |

Use the bottom switcher or left/right arrow keys to compare. Arrow keys leave form inputs alone. The selected variant stays in the URL across reloads. Search, filters, sorting, quantity limits, the basket, and checkout work locally. Checkout accepts a customer ID, simulates `pending` → `confirmed`, and clears the basket after submitting. Refreshing resets session data. Stock is a static snapshot, not depleted by demo orders.

The `{ }` button exposes the current state and prospective order payload. The switcher and keyboard shortcuts are hidden when the server runs with `NODE_ENV=production`. This remains prototype code and is not intended for deployment.

Artwork is local SVG; optional Google Fonts fall back to system fonts when offline.

## Check

```powershell
npm run check
```

This checks JavaScript syntax. Browser checks cover the interactive journey; this throwaway prototype deliberately has no test suite.

## Next step after choosing a design

Rebuild the chosen layout as the real frontend and use the existing gateway at `http://localhost:8000`:

- `GET /catalog/products` for products (`price` is integer cents).
- `GET /inventory` for available quantities.
- `POST /orders` with `{ "customer_id": "customer-1", "items": [{ "product_id": "1", "quantity": 2 }] }`.
- `GET /orders/{id}` to observe `pending`, `confirmed`, or `rejected`.

The real frontend will need a same-origin API proxy or gateway CORS configuration, async order status handling, failed reservation feedback, and unavailable/loading states. None of those backend changes are part of this design comparison.

Created on branch `codex/FE_Catalog`, based on `dev`. Design decision: **B selected as the direction; refine it as an electronics store before production implementation.** The other two examples use the same electronics demo data for consistent comparison. Keep the examples on this prototype branch until the selected layout is rebuilt for production.
