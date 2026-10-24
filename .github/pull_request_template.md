## Summary

<!-- Explain the problem and resulting behavior. Link the related issue or approved
specification when applicable. For a small change, one or two sentences are enough. -->

## Verification

<!-- List the checks actually run, their results, and the service directories used.
For application behavior or bug fixes, include the failing/passing test evidence.
For documentation or infrastructure, describe the relevant document/configuration
or runtime checks. Note checks not run, pre-existing failures, and limitations. -->

## Review checklist

<!-- Check completed items. For an item that does not apply, replace its checkbox
with "N/A" and a brief reason. Leave outstanding work unchecked.
Use docs/testing.md and docs/infrastructure.md for detailed checks where relevant. -->

- [ ] **Requirements:** The change meets the approved acceptance criteria.
- [ ] **Design:** Service ownership and domain boundaries are respected.
- [ ] **Correctness:** Transactions, duplicate messages, concurrency, and failure
  recovery are handled where relevant.
- [ ] **Verification:** Tests or appropriate checks demonstrate the behavior;
  actual results and any verification gaps are recorded above.
- [ ] **Deployment:** Migrations, HTTP/message contract compatibility,
  configuration, and security are addressed where affected.

## Risks and deployment

<!-- Include this section when the change needs special review or deployment steps;
otherwise remove it. Address only applicable points:
- Affected services and HTTP/message contract compatibility.
- Database migrations, existing data, and rollout/rollback order.
- Configuration, secrets, or infrastructure changes (never include secret values).
- Messaging retries, duplicate delivery, concurrency, or failure recovery.
Link updated ADRs or operational instructions where relevant. -->
