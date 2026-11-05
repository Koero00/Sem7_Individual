# ADR 004: Route client requests through a thin HTTP API gateway

- Status: Proposed; original rationale confirmed, future responsibilities unresolved
- Recorded: 2026-10-09
- Basis: Implementation evidence and the project author's explanation on 2026-10-09

## Context

Clients need access to Catalog, Inventory, and Order, which run at different
addresses. Exposing those addresses directly would require clients to know the
service topology. A common entry point can centralize routing, but it adds a
process and an extra network hop to requests.

## Decision observed in the implementation

A FastAPI gateway on port 8000 forwards client HTTP requests to the three services
using HTTPX. Upstream addresses come from environment variables. The public
`/catalog/products` path maps to Catalog's `/products`; Inventory and Order use
their corresponding paths. The gateway forwards request bodies and query parameters
and preserves upstream status codes, response bodies, and selected headers
(`content-type` and `location`). It returns 502 when an upstream request fails.

The gateway implements routing rather than order or reservation rules, and has
no database. Business validation and state changes belong to the services.
Internal reservation processing uses RabbitMQ under
[ADR 001](001-rabbitmq-order-inventory.md).

## Confirmed original rationale and alternatives

The project author initially considered a gateway unnecessary complexity for a
small application. Interest in keeping the project scalable later motivated its
inclusion. FastAPI was selected for perceived ease of use and to keep the API
implementation in Python. ASP.NET was mentioned as a possible framework
alternative, not as a framework that had been tested and rejected.

A common client base URL and configurable upstream addresses are benefits of the
implemented gateway: they keep service addresses out of client configuration.
However, adding a gateway does not by itself provide service replication, load
balancing, or additional processing capacity. Scalability is the author's intended
goal, not a measured result or a demonstrated gateway capability.

Choosing FastAPI over ASP.NET explains the framework/language preference; it
does not establish why a custom gateway was preferred over a configured reverse
proxy. A proxy remains an alternative for review, with no reported original
evaluation. The current component is an HTTP gateway, not a business-workflow
orchestrator: it does not coordinate reservation steps or determine order outcomes.

## Consequences

- Gateway availability affects all client API access, and requests incur an
  additional hop. Availability and latency targets have not been demonstrated
  by the routing tests.
- New service routes and supported HTTP methods require gateway configuration or
  code changes. It forwards selected headers rather than acting as a fully
  transparent general-purpose proxy.
- Service ports remain published for local debugging. The gateway is the intended
  client entry point, but the local network configuration does not enforce it as
  the only reachable entry point.
- The current gateway does not implement authentication, authorization, rate
  limiting, or TLS termination. Its health endpoint reports gateway liveness;
  it does not check upstream availability.

## Evidence and question to resolve

See [gateway implementation](../../gateway/main.py),
[gateway documentation](../../gateway/README.md),
[routing tests](../../gateway/test_main.py), and
[Compose configuration](../../docker-compose.yml).

Which concrete scalability need should the gateway address, and should it remain
a thin router or acquire additional responsibilities? Authentication, aggregation,
and workflow orchestration have not been confirmed as original planned features.
