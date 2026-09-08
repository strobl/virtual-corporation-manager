# Contribution exercise: readable organization counts

This is a historical record of a completed local code contribution exercise by an internal coding agent for the then-unpublished `0.1.0-alpha.5-local.1` candidate. The issue below was prepared for maintainer review; it was not posted to GitHub as part of this exercise and is not an external contributor's pull request. It used the repository's shipped example, source and checks. No private planning access, provider account or executed agent work was needed.

The current product version is `0.1.0-alpha.9`; consult its versioned release for source and package evidence. Use the [README installation route](../README.md#install-the-reviewed-archive) and [first-company guide](first-company.md) for its current setup. The reproduction labels and verification results below belong to alpha.5-local.1; they do not establish acceptance of alpha.9. In the current interface, import the example through **Settings → Import a company definition**, open **Corporations → Patchwork Studio (example)**, then use **Tools → Organization tools → Reporting lines** to inspect the organization summary.

## Historical review-ready issue

**Title:** Use singular nouns for one person, agent, team or reporting level

**Maintainer:** [Chris Strobl](https://github.com/strobl)

**Problem:** The reporting-lines summary always uses plural nouns. Importing the shipped Patchwork example displays `0 people · 3 agents · 1 teams · 1 levels`. This makes an otherwise accurate summary read incorrectly.

**Reproduce:**

1. Use the supplied candidate source and Node.js 24.14+ in the 24.x line, or 26.x. Follow [Contributing](../CONTRIBUTING.md) to install dependencies, then run `npm run build`.
2. Start an isolated workspace with `node dist/cli.js --data-dir ./contribution-workspace --no-open` and open the printed loopback URL.
3. In **Settings → Import a company definition**, choose [three-agent-studio.json](examples/three-agent-studio.json), then **Review import → Apply changes**.
4. Open **Your corporations → Patchwork Studio (example)** and inspect its reporting-lines summary. The example has three peer agents in one Product department and one reporting level.

**Actual before the fix:** `0 people · 3 agents · 1 teams · 1 levels`.

**Expected:** `0 people · 3 agents · 1 team · 1 level`.

**Acceptance:**

- Exactly one uses `person`, `agent`, `team` and `level`; zero and other counts use `people`, `agents`, `teams` and `levels`.
- Patchwork's summary matches the expected text after rebuilding and reloading.
- Counts, reporting-level numbers, selection, filters and layouts keep their existing behavior. A reporting line still represents a saved relationship, not automatic work dispatch.
- Existing frontend organization checks and TypeScript checks pass. The final rebuilt candidate receives a browser review.

**Scope:** Only the summary text in `Header` in [CorporationOrgChart.tsx](../src/components/organization/CorporationOrgChart.tsx). No model, schema, record, example, CLI or runtime changes are required.

## Focused change and verification

The fix selects the singular noun when its existing count is exactly `1`; otherwise it selects the plural. It uses the same inline conditional pattern already used for member counts in this component. It does not recompute counts or introduce a formatting dependency.

The following commands ran successfully for that historical candidate on macOS arm64 with Node.js 24.19.0:

```sh
node node_modules/vitest/vitest.mjs run tests/frontend-model.test.ts
npm run typecheck
```

All 14 existing frontend-model tests passed. These tests cover organization identity, counts, selection and reporting context; they are not a substitute for inspecting the final text in a browser. No test was added solely to duplicate the wording conditional. The final candidate's browser review and package binding are recorded separately with its acceptance evidence.

The exercise supplied this command for maintainer review of its focused diff; it is retained as historical context, not as a claim that the fix is still pending:

```sh
git diff -- src/components/organization/CorporationOrgChart.tsx docs/contribution-exercise.md
```

This exercise demonstrates that a small contribution can be understood, implemented and checked using repository context alone. It does not demonstrate external adoption, an external contribution or a published release. See [starter tasks](developer-contributing.md) for the broader contribution route.
