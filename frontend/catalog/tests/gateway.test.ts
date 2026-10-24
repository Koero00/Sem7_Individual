import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { GET, POST } from "../app/api/[...path]/route";

async function gateway(t: TestContext) {
  const requests: { path: string; method: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url!, method: req.method!, body });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") { res.writeHead(202); res.end(JSON.stringify({ id: "10000000-0000-4000-8000-000000000001", status: "pending" })); }
    else if (req.url?.startsWith("/orders/")) { res.writeHead(404); res.end(JSON.stringify({ detail: "Order not found" })); }
    else { res.end("[]"); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.API_GATEWAY_URL;
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    if (previous === undefined) delete process.env.API_GATEWAY_URL; else process.env.API_GATEWAY_URL = previous;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  return requests;
}

test("order submission forwards the exact payload and preserves 202 rather than claiming confirmation", async t => {
  const requests = await gateway(t);
  const payload = { customer_id: "test-customer", items: [{ product_id: "phone", quantity: 2 }] };
  const response = await POST(new Request("http://frontend/api/orders", { method: "POST", body: JSON.stringify(payload) }), { params: Promise.resolve({ path: ["orders"] }) });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, "pending");
  assert.deepEqual(JSON.parse(requests[0].body), payload);
  assert.equal(requests[0].path, "/orders");
});

test("backend errors retain their status and detail for meaningful UI feedback", async t => {
  await gateway(t);
  const id = "10000000-0000-4000-8000-000000000001";
  const response = await GET(new Request(`http://frontend/api/orders/${id}`), { params: Promise.resolve({ path: ["orders", id] }) });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: "Order not found" });
});

test("the browser proxy cannot mutate products or request arbitrary gateway routes", async t => {
  const requests = await gateway(t);
  const response = await POST(new Request("http://frontend/api/catalog/products", { method: "POST", body: "{}" }), { params: Promise.resolve({ path: ["catalog", "products"] }) });
  assert.equal(response.status, 404);
  assert.equal(requests.length, 0);
});

test("an unreachable gateway returns a service error without a fabricated successful order", async t => {
  const previous = process.env.API_GATEWAY_URL;
  process.env.API_GATEWAY_URL = "http://127.0.0.1:1";
  t.after(() => { if (previous === undefined) delete process.env.API_GATEWAY_URL; else process.env.API_GATEWAY_URL = previous; });
  const response = await GET(new Request("http://frontend/api/inventory"), { params: Promise.resolve({ path: ["inventory"] }) });
  assert.equal(response.status, 502);
  assert.match((await response.json()).detail, /could not be reached/);
});
