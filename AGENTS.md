# Project guidance for coding agents

## Purpose and scope

CloudProject is a webshop for learning and testing microservices, Kubernetes,
and potential cloud deployments, including finite background jobs. These rules
apply throughout the repository. Apply senior software engineering discipline
while keeping changes focused, reviewable, and small enough to learn from.

## Agent workflow and decision boundaries

- Inspect the relevant code, documentation, and `git status` before editing;
  preserve existing changes outside the task's scope.
- Implement well-defined tasks directly. For complex or cross-service work,
  outline dependencies, acceptance criteria, and risks before implementation.
- Follow approved requirements and ADRs for intended behavior; use running code
  to establish what exists, not to override an approved decision. Proposals and
  backlog ideas are not automatically approved. Flag material conflicts.
- Make routine choices within the authorized task. Seek approval for architecture
  or business-rule changes beyond its scope; update affected decisions and docs
  when such changes are authorized.
- Do not reset databases or volumes, discard others' work, force-push, bypass
  quality/security checks, or deploy publicly without explicit authorization.
- When requirements are incomplete, use the smallest reversible assumption for
  low-risk details; ask when uncertainty materially affects correctness or scope.

## Project context

The stack uses Python 3.13+, FastAPI, PostgreSQL, RabbitMQ, Docker Compose, and
`uv`. Catalog owns product information and integer-cent prices; Inventory owns
stock and reservations; Order owns the order lifecycle. The gateway forwards
public HTTP requests. Each service owns its database.

Kubernetes and cloud hosting are goals, not existing deployment capabilities.
Distinguish proposals from working features.

Before changing an area, read its service README and relevant implementation.
For cross-service changes, read [the container view](docs/c4-container.md) and
[ADR 001](docs/adr/001-rabbitmq-order-inventory.md).
For order management work, consult [the specification](docs/specs/order-management.md)
and [the backlog](docs/tickets/order-management.md). Their proposed choices are
assumptions for review, not automatically approved requirements.

Read these task-specific guides before implementation:

- [Testing guide](docs/testing.md): when adding or changing tests, persistence,
  message processing, or cross-service behavior. It covers test selection,
  messaging reliability, database concurrency, and integration verification.
- [Infrastructure guide](docs/infrastructure.md): when changing containers,
  deployment configuration, Kubernetes/cloud workloads, or running scalability
  and resilience experiments.
- [Domain documentation conventions](docs/agents/domain.md): before exploring or
  naming domain concepts, read root `CONTEXT.md` if present and relevant ADRs.
  Keep the existing single-context layout: `CONTEXT.md` and `docs/adr/`.
- [Issue-tracker conventions](docs/agents/issue-tracker.md): when working with
  issues or specs, use GitHub Issues in `Koero00/Sem7_Individual` through `gh`.
- [Triage labels](docs/agents/triage-labels.md): when triaging work, use the
  configured `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
  and `wontfix` labels.

## Test-driven development

- For testable application behavior and bug fixes, identify acceptance criteria
  and the public boundary; write one focused test and confirm the expected failure.
- Implement the smallest complete change to pass it. Repeat in vertical slices;
  review and refactor with tests green. Establish regression coverage before
  behavior-preserving refactors.
- Test observable domain outcomes and invariants. Infrastructure changes need
  configuration/runtime checks; documentation changes need document checks.

## Domain-driven design

- Treat Catalog, Inventory, and Order as bounded contexts with explicit ownership.
  Keep the gateway focused on transport and routing; place business decisions in
  the owning service.
- Use consistent domain language in code, tests, APIs, and documentation. Follow
  existing specifications and ADRs; record newly agreed terms in the glossary in
  `CONTEXT.md` when ambiguity warrants it.
- Express business invariants and valid state transitions explicitly. Protect
  aggregate consistency with local transactions and database constraints.
- Keep domain decisions separate from HTTP, database, and RabbitMQ concerns as
  code evolves. Introduce entities, value objects, repositories, or application
  services where they clarify behavior; scale the structure to actual complexity.
- Integrate contexts through explicit HTTP or versioned message contracts. Access
  another service's data through its contract, never through its database or
  imported implementation modules.
- Keep persistence models private; share identifiers and contract data across contexts.
- Record significant architectural trade-offs in `docs/adr/` and update affected
  contracts and diagrams alongside implementation changes.

## Code quality and security

- Write cohesive functions, explicit interfaces, descriptive domain names, and
  useful type annotations. Use `Any` only at genuinely dynamic boundaries.
- Validate untrusted input at boundaries, use parameterized SQL, handle expected
  errors explicitly, and release connections and other resources reliably.
- Keep comments focused on intent, invariants, and trade-offs. Prefer readable
  code over cleverness and concrete designs over speculative generalization.
- Keep dependencies purposeful and update the affected `uv.lock` when they change.
  Follow the service's existing tooling and formatting conventions.
- Load deployment configuration from the environment and credentials from secret
  management. Keep secrets and customer data out of source control and logs.

## Verification and completion

Run checks from each affected service directory (`gateway`, `services/catalog`,
`services/inventory`, or `services/order`), since they have separate environments
and similarly named Python modules:

```powershell
uv sync --dev --locked
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
```

If dependencies intentionally change, update the affected `uv.lock` first and
then run locked verification. Use the linked guides for integration and deployment
checks; the end-to-end smoke test consumes seeded stock and needs an isolated stack.

A change is complete when its acceptance criteria are met, relevant checks pass,
and affected documentation and contracts agree with the implementation. Review
the final diff for unrelated edits. Summarize what changed, checks actually run,
pre-existing failures, unavailable checks, and remaining limitations.
