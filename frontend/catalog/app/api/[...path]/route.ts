import { NextResponse } from "next/server";
import { gatewayRequest } from "@/lib/gateway";

export const dynamic = "force-dynamic";

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const allowed = request.method === "GET"
    ? route === "catalog/products" || route === "inventory" || /^orders\/[0-9a-f-]{36}$/i.test(route)
    : request.method === "POST" && route === "orders";
  if (!allowed) return NextResponse.json({ detail: "Route not found" }, { status: 404 });
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 64_000) return NextResponse.json({ detail: "Order request is too large" }, { status: 413 });
    const upstream = await gatewayRequest(`/${route}`, { method: request.method, body });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "The API gateway could not be reached. Please check that the backend is running." }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
