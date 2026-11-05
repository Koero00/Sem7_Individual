# Domain Docs

Configured layout: **single-context**.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if it exists.
- Relevant architecture decision records in `docs/adr/`.

If these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. The `domain-modeling` skill creates them when terms or decisions actually get resolved.

## File structure

- `CONTEXT.md` contains the project's domain context and glossary.
- `docs/adr/` contains architecture decision records.

Preserve existing ADRs, including `docs/adr/001-rabbitmq-order-inventory.md`.

## Use the glossary's vocabulary

When naming a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Avoid synonyms the glossary explicitly rejects.

If a concept is missing, reconsider whether it belongs to the project's vocabulary or note the gap for `domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why the decision may need to be reopened. Do not silently override existing decisions.
