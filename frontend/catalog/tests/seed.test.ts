import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";

type RecordBody = Record<string, string | number | null>;

async function seedGateway(t: TestContext, catalog = new Map<string, RecordBody>(), stock = new Map<string, RecordBody>()) {
  let writes = 0;
  const server = createServer(async (req, res) => {
    const isCatalog = req.url!.startsWith("/catalog/products");
    const records = isCatalog ? catalog : stock;
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      const record = records.get(req.url!.split("/").at(-1)!);
      res.statusCode = record ? 200 : 404;
      res.end(JSON.stringify(record || { detail: "Not found" }));
    } else if (req.method === "POST" || req.method === "PUT") {
      let text = "";
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      records.set(isCatalog ? body.id : body.product_id, body);
      writes++;
      res.writeHead(req.method === "POST" ? 201 : 200); res.end(JSON.stringify(body));
    } else {
      res.writeHead(405); res.end("{}");
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const env = { ...process.env, API_GATEWAY_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  const script = fileURLToPath(new URL("../../../scripts/seed-electronics.mjs", import.meta.url));
  const run = () => promisify(execFile)(process.execPath, [script], { env, windowsHide: true });
  return { catalog, stock, run, writes: () => writes };
}

test("the electronics seed is repeatable and preserves existing products and stock", async t => {
  const catalog = new Map<string, RecordBody>([["circuit-nova-phone", { id: "circuit-nova-phone", name: "Existing custom phone" }]]);
  const stock = new Map<string, RecordBody>([["circuit-nova-phone", { product_id: "circuit-nova-phone", quantity: 3 }]]);
  const { run, writes } = await seedGateway(t, catalog, stock);
  await run();
  assert.equal(writes(), 28);
  assert.equal(catalog.size, 15);
  assert.equal(stock.size, 15);
  await run();
  assert.equal(writes(), 28);
  assert.deepEqual(catalog.get("circuit-nova-phone"), { id: "circuit-nova-phone", name: "Existing custom phone" });
  assert.deepEqual(stock.get("circuit-nova-phone"), { product_id: "circuit-nova-phone", quantity: 3 });
});

test("original fruits become electronics without changing their IDs or depleted stock", async t => {
  const catalog = new Map<string, RecordBody>([
    ["1", { id: "1", name: "Appel", description: "Een heerlijke appel", price: 100, image_url: "https://via.placeholder.com/150" }],
    ["2", { id: "2", name: "Banaan", description: "Een heerlijke banaan", price: 200, image_url: "https://via.placeholder.com/150" }],
    ["3", { id: "3", name: "Peer", description: "Een heerlijke peer", price: 300, image_url: "https://via.placeholder.com/150" }],
  ]);
  const stock = new Map<string, RecordBody>([
    ["1", { product_id: "1", quantity: 0 }],
    ["2", { product_id: "2", quantity: 4 }],
    ["3", { product_id: "3", quantity: 5 }],
  ]);
  const { run, writes } = await seedGateway(t, catalog, stock);
  await run();
  assert.equal(catalog.size, 15);
  assert.equal(catalog.get("1")?.name, "Horizon 32 OLED Monitor");
  assert.equal(catalog.get("1")?.price, 239900);
  assert.equal(catalog.get("2")?.name, "Pulse Mechanical Keyboard");
  assert.equal(catalog.get("3")?.name, "Echo Wireless Headphones");
  assert.deepEqual([stock.get("1")?.quantity, stock.get("2")?.quantity, stock.get("3")?.quantity], [0, 4, 5]);
  assert.equal(writes(), 27);
  await run();
  assert.equal(writes(), 27);
});

test("edited fruit samples and unrelated products are preserved", async t => {
  const edited = { id: "1", name: "Appel", description: "Custom description", price: 100, image_url: "https://via.placeholder.com/150" };
  const unrelated = { id: "custom", name: "Custom product", price: 500 };
  const catalog = new Map<string, RecordBody>([["1", edited], ["custom", unrelated]]);
  const { run } = await seedGateway(t, catalog);
  await run();
  assert.deepEqual(catalog.get("1"), edited);
  assert.deepEqual(catalog.get("custom"), unrelated);
});

test("fresh database SQL and the gateway seed provide the same 15 products and stock", async t => {
  const { run, catalog, stock } = await seedGateway(t);
  await run();
  const catalogSql = await readFile(new URL("../../../services/catalog/db/init.sql", import.meta.url), "utf8");
  const stockSql = await readFile(new URL("../../../services/inventory/db/init.sql", import.meta.url), "utf8");
  assert.equal(catalog.size, 15);
  assert.equal(stock.size, 15);
  assert.equal((catalogSql.match(/^    \('/gm) || []).length, 15);
  assert.equal((stockSql.match(/^    \('/gm) || []).length, 15);
  const sqlValue = (value: string | number | null) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
  for (const product of catalog.values()) {
    assert.ok(Number.isSafeInteger(product.price) && Number(product.price) > 0);
    assert.ok(catalogSql.includes(`(${[product.id, product.name, product.description, product.price, product.image_url].map(sqlValue).join(", ")})`));
    const inventory = stock.get(String(product.id))!;
    assert.ok(Number.isSafeInteger(inventory.quantity) && Number(inventory.quantity) > 0);
    assert.ok(stockSql.includes(`(${sqlValue(product.id)}, ${inventory.quantity})`));
  }
});
