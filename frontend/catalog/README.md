# Circuit Catalog — Next.js frontend

The selected quick-order layout (B) and Cobalt palette, rebuilt with Next.js App Router, React, and TypeScript. The other designs remain in `../catalog-prototype` as historical references. This implementation contains no mock product list, simulated checkout, or palette switcher.

## Local development

Requires Node.js 22 or newer. Start the backend stack from the repository root, or reuse the existing running services. If the Compose frontend is already running, first run `docker compose stop catalog-frontend` from the repository root to free port 3000; the backend services can keep running. From this directory:

```powershell
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The server defaults to the gateway at `http://127.0.0.1:8000`. To change it, copy `.env.example` to `.env.local` and set `API_GATEWAY_URL`. This is a server-only variable. No browser CORS configuration is required: browser requests use same-origin Next.js Route Handlers.

For a production build:

```powershell
npm run build
npm start
```

The repository's `docker compose up --build -d` also builds and starts `catalog-frontend` on port 3000, with the gateway's internal Compose address. The runtime uses a non-root Node.js user and Next's standalone output.

## Data and orders

- Initial rendering fetches products and stock on the server; refreshes and order operations use the allowlisted `/api/...` proxy.
- Products and prices come from `GET /catalog/products`; prices remain integer cents internally. EUR is a display assumption because the backend does not yet expose currency.
- Stock comes from `GET /inventory`. Missing inventory is treated as unavailable, never as unlimited stock.
- The basket is kept in session storage, checked against availability, and restored after reload. Stock and prices are checked again before submission; changed baskets require another review.
- Checkout sends `customer_id` and product quantities to `POST /orders`, then polls `GET /orders/{id}`. Only the order service can report confirmation or rejection.
- Pending orders are recovered after reload. Polling pauses after about a minute; the user can explicitly check again without resubmitting. Ambiguous submission failures block resubmission to avoid accidentally creating duplicate orders: the backend does not support idempotency keys yet.
- Backend errors never fall back to sample products or simulated success. A failed refresh keeps the last view but disables new orders until reconnection.
- The backend has no category/specification fields. Display filters infer Phones, Laptops, and Mice from product names; all unclassified products remain visible under Other and All products. Descriptions are displayed directly from the API.
- Product images use Catalog URLs with local device/generic fallbacks. Optional Google Fonts fall back to system fonts when unavailable.

New databases start with 15 fictional electronics: a 4K OLED monitor, keyboard, headphones, phone, laptop, mouse, SSD, processor, memory kit, graphics card, USB-C dock, webcam, speakers, controller, and tablet. Each has a EUR price (stored in cents), specifications, and matching inventory.

To replace the original fruit samples and add the full electronics catalog to an existing development database, run:

```powershell
npm run seed:electronics
```

The seed replaces only the unchanged original Appel, Banaan, and Peer samples at IDs `1`, `2`, and `3`, retaining those IDs and their stock. It adds missing electronics and inventory records while preserving customized products and all existing stock. Running it twice is safe; no volume reset is needed. It uses `API_GATEWAY_URL` from the shell when set, otherwise `http://127.0.0.1:8000`; Node does not automatically load `.env.local` for this command.

Orders are real database records in the connected environment, while no payment or delivery is implemented. Customer IDs are entered manually because the backend has no authentication or ownership checks yet. Do not expose customer orders publicly until those are implemented. Display totals are current catalog estimates; the Order API does not store a price snapshot or enforce a payment total.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Tests cover stale/corrupt baskets, integer-cent totals, malformed service contracts, and the gateway proxy's payloads, status preservation, route restrictions, and failure behavior. CI runs these commands and builds the complete Docker stack before the existing asynchronous order-flow checks.

## Structure

- `app/page.tsx`: server-rendered catalog and initial service-error handling.
- `app/api/[...path]/route.ts`: limited browser-to-gateway proxy.
- `components/catalog-store.tsx`: React UI state, catalog interaction, and order lifecycle.
- `components/`: basket, quantity controls, product imagery, and native modal dialog.
- `lib/`: API contracts, gateway access, basket and category logic.
- `public/products/`: local device illustrations from the selected design.
