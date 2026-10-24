import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the optional electronics seed is repeatable and preserves existing products and stock", async t => {
  const catalog = new Map<string, unknown>([["circuit-nova-phone", { id: "circuit-nova-phone", name: "Existing custom phone" }]]);
  const stock = new Map<string, unknown>([["circuit-nova-phone", { product_id: "circuit-nova-phone", quantity: 3 }]]);
  let writes = 0;
  const server = createServer(async (req, res) => {
    const isCatalog = req.url!.startsWith("/catalog/products");
    const records = isCatalog ? catalog : stock;
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      const record = records.get(req.url!.split("/").at(-1)!);
      res.statusCode = record ? 200 : 404;
      res.end(JSON.stringify(record || { detail: "Not found" }));
    } else {
      let text = "";
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      records.set(isCatalog ? body.id : body.product_id, body);
      writes++;
      res.writeHead(201); res.end(JSON.stringify(body));
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const env = { ...process.env, API_GATEWAY_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  const script = fileURLToPath(new URL("../../../scripts/seed-electronics.mjs", import.meta.url));
  const run = () => promisify(execFile)(process.execPath, [script], { env, windowsHide: true });
  await run();
  assert.equal(writes, 4);
  await run();
  assert.equal(writes, 4);
  assert.deepEqual(catalog.get("circuit-nova-phone"), { id: "circuit-nova-phone", name: "Existing custom phone" });
  assert.deepEqual(stock.get("circuit-nova-phone"), { product_id: "circuit-nova-phone", quantity: 3 });
});
