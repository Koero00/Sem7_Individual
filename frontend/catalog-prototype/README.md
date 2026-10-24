# Catalog UI prototype — throwaway

Question: should ordering start with visual browsing, a quick quantity list, or a guided basket?

**Selected design: B, the electronics quick-order list, with the Cobalt palette.**

Option B has three color studies with the same layout and functionality:

| Palette | Preview |
| --- | --- |
| Cobalt | <http://localhost:5173/prototype/catalog?variant=B&palette=blue> |
| Warm amber | <http://localhost:5173/prototype/catalog?variant=B&palette=amber> |
| Midnight violet | <http://localhost:5173/prototype/catalog?variant=B&palette=midnight> |

In B, use the bottom swatches or arrow keys to revisit the color comparison. Basket contents, filters, quantities, and scroll position stay intact. The palette is stored in the URL and survives reloads. Checkout and the basket drawer follow the selected palette too. Cobalt is the selected palette and the default. The older layout examples remain accessible through their direct variant URLs below.

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

The bottom switcher compares colors in B and layouts in A/C. Arrow keys leave form inputs alone. The selected variant stays in the URL across reloads. Search, filters, sorting, quantity limits, the basket, and checkout work locally. Checkout accepts a customer ID, simulates `pending` → `confirmed`, and clears the basket after submitting. Refreshing resets session data. Stock is a static snapshot, not depleted by demo orders.

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

Created on branch `codex/FE_Catalog`, based on `dev`. Design decision: **B selected as an electronics store, with Cobalt as the chosen palette.** The layout keeps products, quantities, and the basket visible together; the palette was selected after comparing three color studies. The other examples remain available as design references. Keep the examples on this prototype branch until the selected layout is rebuilt for production.
