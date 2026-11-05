# CloudProject agent guidance

## Code Review Rules

These hosted-review rules adapt Matt Pocock's `code-review` skill (Standards and
Spec). See `docs/codex-pr-reviews.md` for the source and execution differences.

Review the pull request diff against its base branch. Read the affected callers,
tests, and contracts before reporting a finding. Review only; leave fixes and
merging to a separately requested task.

### Standards and architecture

- Use the applicable nested `AGENTS.md`, service documentation, and accepted
  decisions in `docs/adr/` as standards sources. Cite the specific rule when a
  violation causes a concrete defect. Keep formatting, lint, and type checks in CI.
- For Order/Inventory changes, preserve the guarantees in
  `docs/adr/001-rabbitmq-order-inventory.md`: an order and its reservation command
  commit atomically; inventory reserves all requested stock or none; duplicate
  message delivery cannot reserve stock twice or apply an outcome twice. Flag
  changes that acknowledge a message before its durable processing commits, or
  lose outbox records before confirmed publication. Trace the failure or retry
  path and describe the resulting stock or order inconsistency.
- Preserve service-owned persistence as described in
  `docs/adr/003-service-owned-postgresql-databases.md`. Cross-service access uses
  explicit HTTP/message contracts rather than another service's database. For
  schema changes, check upgrades of existing data as well as fresh initialization;
  changing `db/init.sql` alone does not upgrade an existing database volume.
- For HTTP, message, or frontend changes, trace affected producers and consumers.
  Preserve the asynchronous order contract (`202 Accepted`, initially `pending`,
  then `confirmed` or `rejected`) unless the PR explicitly changes it and updates
  the affected clients. Check that gateway/frontend proxies preserve the status,
  body, and required headers of supported routes. Treat database and RabbitMQ
  addresses as server-side configuration, not browser configuration.

### Specification

- Find the intended requirements in the PR description and linked issue/spec;
  use commit references and matching files under `docs/specs/` and `docs/tickets/`
  for additional context. Compare only requirements relevant to this PR's scope.
- Respect document status. `docs/specs/order-management.md` is a proposed future
  feature, not an obligation for every order-related PR. Enforce its requirements
  only when the PR explicitly adopts them. Proposed ADR questions are not accepted
  requirements. When intent cannot be established, describe the uncertainty rather
  than inventing missing requirements or blocking the review to ask for a spec.

### Findings

- Keep Standards and Specification distinct in the reasoning. In a finding's
  explanation, name the relevant axis and cite its source when one exists.
- Report actionable defects introduced by the diff with a triggering scenario,
  impact, and the smallest useful changed-line location. Existing limitations
  (including the documented local-development access model) are context, not new
  defects unless the PR creates or worsens a concrete risk.
- Treat code smells as investigation prompts, not automatic findings. Explain a
  demonstrable consequence before reporting duplication, naming, indirection,
  or an abstraction; avoid speculative refactors and lint-only comments.
- Follow the review service's severity threshold and output format. If no
  qualifying findings remain, report that without inventing issues. State any
  material verification limitation; distinguish inspected tests from tests run.
