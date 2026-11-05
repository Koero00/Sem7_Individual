# Codex pull request reviews

This repository uses the built-in Codex GitHub review integration. The project
rules live in [AGENTS.md](../AGENTS.md). Adding these files prepares the repository;
it does not connect GitHub or activate reviews in your account.

## Activate for this repository

1. Commit and push `AGENTS.md`, this guide, and the README link to GitHub through
   your normal PR process. Keep the rules on branches that will receive future PRs.
2. Sign in to the ChatGPT account whose Codex access you want to use. Open
   [Codex code review settings](https://chatgpt.com/codex/settings/code-review).
3. Connect GitHub if needed and select `Koero00/Sem7_Individual`. If it is missing,
   check that the GitHub connection includes this repository. Configuring repository
   review settings requires GitHub push or admin permission.
4. Enable code review for the repository. Start with manually requested reviews;
   leave automatic triggers disabled while verifying access and usage.
5. On a representative PR containing these rules, add this comment:

   ```text
   @codex review
   ```

   Codex should react and then submit its review on GitHub. Read the feedback
   and check the usage dashboard in your Codex account before requesting more.
6. If desired, enable **Automatic review** and choose **Review trigger** in Codex
   settings. Check the repository setting and personal preferences, including
   whose PRs are covered. Choose the least frequent trigger that meets your needs.

The initial account connection and activation must be completed by someone with
the necessary account access. This guide does not assert that activation has
already happened or that a live review has passed.

## Review skill and project rules

The rules adapt [Matt Pocock's `code-review` skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md),
which is already installed locally as `code-review`. It is a third-party skill
available to Codex, not an OpenAI-authored built-in skill. Its two review axes are:

- **Standards:** does the change preserve documented project conventions and
  architectural guarantees?
- **Specification:** does the change implement the requirements adopted by this PR?

The hosted GitHub reviewer is explicitly documented to follow `AGENTS.md`.
A skill installed only on a developer's computer is not part of this repository.
These rules therefore contain the relevant review guidance directly, without a
dependency on a local skill, an issue-tracker setup command, or parallel subagents.
The hosted service determines its own execution and review output format; this
setup does not promise the local skill's full orchestration or side-by-side report.

### Run Matt Pocock's complete skill

For a local review, explicitly invoke `$code-review` in Codex and provide the
comparison ref (commit, branch, or tag). Supply the relevant spec path if it is
not discoverable through the project's issue-tracker configuration. For example,
replace the placeholders in:

```text
Use $code-review to review changes since <base-ref>, using <spec-path> as the specification.
```

That invokes the installed skill's workflow, including its Standards and Spec
subagents and separate reports. Its Fowler smell baseline treats design concerns
as judgement calls; these can be useful even when they do not meet the hosted
reviewer's high-severity threshold.

The built-in `@codex review` integration is still the hosted reviewer with these
adapted project rules. The documented settings do not offer a switch that replaces
its execution with an arbitrary local skill. Automatically running the complete
Matt Pocock workflow on GitHub would require separately configured automation
with the skill and its dependencies available; an API-backed workflow would have
separate API costs. Such automation has not been added here.

To change the review policy, edit `AGENTS.md` in a PR. To use a different review
skill, adapt its relevant checks there and make every referenced resource available
in the repository. For a one-off focus, use a comment such as:

```text
@codex review for transaction and duplicate-message bugs in the inventory changes
```

The hosted reviewer currently reports high-priority issues (P0/P1). An empty
review is not proof that all requirements or low-priority design concerns passed.
Keep CI and human review as part of the PR process.

## Usage and costs

This setup uses Codex through your ChatGPT plan. It adds no API key or GitHub
Actions review job. Availability and included usage depend on the account and
workspace; check current limits in the usage dashboard and paid-credit settings
before enabling automatic reviews. API token prices do not describe how many
reviews your subscription includes.

If you later choose a custom API-backed workflow, budget for that separately.

## Verify and troubleshoot

- Confirm the PR contains the applicable root `AGENTS.md`; frontend changes also
  have guidance in `frontend/catalog/AGENTS.md`.
- Use a small real change. Confirm Codex reacts to `@codex review` and completes
  its review. A reaction alone is not a completed review.
- For reported issues, check whether they identify a real triggering scenario,
  the affected changed lines, and the relevant project rule or requirement.
- A clean PR may yield no findings. To assess a specific custom rule, compare a
  deliberately faulty change and its corrected version in a disposable draft PR;
  close it afterward without merging the faulty change.
- If Codex stays silent, check repository access, code review enablement, the
  exact comment trigger, and account usage limits. For automatic reviews, also
  check personal preferences, whose PRs are covered, and the selected event.
- Missing features in a proposed spec are not findings unless this PR commits
  to implementing them. Repeated irrelevant feedback is a reason to narrow the
  relevant rule in `AGENTS.md`.

## Official references

- [GitHub review setup, triggers, and custom rules](https://learn.chatgpt.com/docs/third-party/github)
- [AGENTS.md discovery and review instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Codex availability, pricing, and usage limits](https://learn.chatgpt.com/docs/pricing)
