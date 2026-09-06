# Small contributions with a clear review route

These are repository-local task briefs prepared for the developer-first candidate. They are not published GitHub issues, assigned community work or evidence of outside contributors. Before starting, check [current issues](https://github.com/strobl/virtual-corporation-manager/issues) for overlap or open a focused issue containing the brief. Maintainer [@strobl](https://github.com/strobl) owns scope and review for each task. An internal 8090 reference is optional; every public issue must be understandable without it.

Follow [CONTRIBUTING](../CONTRIBUTING.md) for the reviewed checkout, supported Node versions and checks. Use temporary workspaces and fictional inputs. No provider credentials are needed for the tasks below. The maintainer reviews changes before merge and verifies installed artifacts for a release; there is no guaranteed response time or paid support SLA.

The [singular/plural contribution exercise](contribution-exercise.md) follows an actual UI finding from the imported Patchwork example through a focused source fix and verification. It is an internal agent exercise with a prepared local issue, not a published issue or outside PR.

## D-01: A portable peer-team example

**Status:** implemented in this local candidate; ready for independent review, not an external contribution claim.

**Problem / reproduction:** without a small inspectable file, a developer must reverse-engineer a large template or create/export a workspace just to learn the accepted JSON shape. Start from an empty workspace and open Settings import.

**Change:** `docs/examples/three-agent-studio.json`, its README and `verify.mjs` provide one fictional corporation with a department, three peer roles and useful responsibilities. The quickstart explains the UI import path and fresh-ID semantics.

**Acceptance:** run `npm run build` and `node docs/examples/verify.mjs`; inspect a real UI import and exported definition. Three agents retain their responsibilities across edit/restart/recovery, with no mandatory manager, booked hours or execution. The JSON validates through the actual product, not a parallel example schema. Submit findings with the exact source/archive and check output. This is a complete example of a bounded issue-to-change route without private planning access.

## D-02: Explain one failed import with a small fixture

**Status:** proposed follow-up; no product defect asserted.

**Problem / reproduction:** copy the three-agent JSON into an isolated workspace's import text field, add an unsupported top-level field, then choose **Review import**. The server refuses it; a new contributor needs to understand what to correct.

**Scope:** extend `docs/examples/README.md` with a minimal invalid fragment, the actual current message and a corrected fragment. Keep the real import file valid; do not weaken `validateDefinition` or add a new format.

**Acceptance:** capture the failure and corrected review through the current UI, verify no company is created before Apply, and run `node docs/examples/verify.mjs`. Include only fictional content. Maintainer review checks that the documentation matches the displayed error and explains a useful next action.

## D-03: Verify long agent context at narrow widths

**Status:** proposed reproduction task; fix only a demonstrated defect.

**Problem / reproduction:** in a temporary copy of the example, give one agent a long realistic role, several responsibilities and multiline instructions. Open its placement/details at desktop width and 390 px, then keyboard-navigate the controls.

**Scope:** record any inaccessible control, clipped essential content or lost context in a public issue, with viewport, steps and a redacted screenshot. A fix should stay in the affected `src/web/AgentPlacement.tsx`, `TextDisclosure.tsx` or associated CSS; coordinate ownership before editing. If no defect is found, report the checked case rather than inventing one.

**Acceptance:** preserve corporation/department/manager context and full readable instructions; all edit/cancel/review actions remain reachable by keyboard. Recheck the actual before/after viewport, run the relevant frontend tests and `npm run check`. No data model or runtime changes are part of this task.

## D-04: Make the first recovery error actionable

**Status:** proposed documentation follow-up.

**Problem / reproduction:** in a disposable example workspace, stop VCM, export to a new filename, then repeat the same export. The CLI refuses the existing destination. Also try a maintenance command while that workspace is running; its lock must be respected.

**Scope:** add concise examples of those two real messages and safe next actions to the developer quickstart/recovery documentation. Use the canonical `vcm` invocation and preserve the legacy alias's identical behavior. Do not overwrite files, bypass a lock or change backup semantics.

**Acceptance:** record the exact commands/messages from the installed candidate and show that the original exported bytes and company IDs remain unchanged. Use a new filename or stop the owning process to recover, then run the example verifier. Maintainer review checks that the steps work from only public repository context.

## Before opening the PR

Put the problem, bounded change and acceptance in the issue or PR itself. Include the exact commands run, source revision, observed platform and any UI evidence. Historical CI and agent QA are not a substitute for an observed check on your candidate. Use the repository PR template; omit private customer data, databases and credentials. Maintainer triage distinguishes installation, product, optional-runtime and documentation issues, prioritizing data loss and security reports. Sensitive vulnerabilities use [private security reporting](../SECURITY.md).
