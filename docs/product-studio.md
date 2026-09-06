# Product Studio workflow

The **`0.1.0-alpha.8` corporation-management technical prerelease** retains **PS-001: stock alert export** as an optional fixed workflow. The primary [company-management loop](product/corporation-management.md) creates an empty corporation from a name and optional purpose, then adds its actual people and agents. It requires no template, model connection, job or stock-alert deliverable. This guide describes the separate workflow contract; alpha.5/alpha.6 and earlier candidate evidence remains historical.

Select the intended company and open **Tools → Agent runs & records → Workflow examples**. When the five required roles are present, choose **Set up example**. Otherwise **Preview Product Studio** lets you review and create the example company first. **Product Studio (5 seats)** and **100-agent Product Studio** provide the fixed role mapping; applying a template opens its company without starting work. Review the PS-001 inputs and permissions, name the **Acceptance owner**, then explicitly choose **Start job**. Existing scoped jobs also offer **Run example** to open the setup. The 100-agent template contains five operational workflow seats; it does not launch 100 concurrent agents. The 20-agent template remains configuration-only.

**Observed result remains incomplete:** v2 intake and its one retry each timed out after 300 seconds at `ultra`. No v2 delivery bundle or owner acceptance exists. The earlier v1 ZIP remains rejected for its missing `EXPECTED-REFERENCE.json`. The implemented contract below is not a claim that these stages completed on a real v2 run. Preserve those attempts and their original evidence; the documentation/product update authorizes no new provider attempt or reasoning change. See [acceptance](acceptance.md#technical-prerelease--6-september-2026).

## What Start authorizes

Starting PS-001 permits local file production and checks for the synthetic inventory brief, followed by independent review and a handoff. The optional Codex CLI uses your signed-in account and allowance. VCM itself has no account, billing or mandatory hosted inference.

The chosen company must have exactly one active AI agent for each required role and five distinct member IDs. The [workflow service](../src/jobs/service.ts) checks current company assignments and excludes human members from those execution seats. The named acceptance owner is the person or responsible role who will review the result; naming them does not execute a human member or create their acceptance. Shared membership, reporting lines and company ownership remain independent of this fixed stage order.

Each stage runs in a new isolated directory and a new observed Codex session. The runtime may write there and execute local commands. Shell network, web, apps and other connected tools are disabled. The workspace sandbox restricts writes; it is not complete read isolation. Do not place confidential files beside experimental jobs; use a dedicated OS account when stronger isolation is needed. No publishing, messaging, spending, deployment or automatic owner decision is granted.

The checker results below are historical platform evidence. They do not establish a passing check on the exact alpha.7 archive or a successful model-produced deliverable.

Python 3.8 or newer, using only the standard library, and the local Codex sandbox must pass a prerequisite check before any model stage starts. `GITFLASH_PYTHON_PATH` and `GITFLASH_CODEX_PATH` may specify absolute local executables. Native Windows supports the local core and Time Tracker; this workflow's fixed sandbox checker requires macOS or Linux. The fixed checker has run successfully on macOS with Node 24.19.0 and 26.0.0. The stock Ubuntu 24 runner currently refuses the native sandbox with `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`, before Python starts. Linux requires compatible user/network namespace permissions; VCM does not change host security policy or bypass a failed prerequisite. The pinned checker passed its actual Ubuntu 22.04 CI fixture on Node 24.20.0/Python 3.10, including output files, ordinary failing checks, read-only host paths and network denial. The Linux restricted-read sandbox also provides a private temporary filesystem: writing there does not modify the host. Stock Ubuntu 24.04 with its AppArmor namespace restriction is an unsupported optional-workflow configuration; the local core remains supported. Its separate compatibility fixture must prove prerequisite refusal, no provider dispatch and unchanged company/time data. See [acceptance evidence](acceptance.md) for exact revisions and remaining review gates.

## Five required stages

1. **Delivery Manager** creates `INTAKE.md` with the bounded job and authority, assigned producer/reviewer seats and reserved review capacity. Actual producer/reviewer execution independence remains NOT VERIFIED until those stages run; a future session ID is not an intake prerequisite.
2. **Requirements Analyst** creates `SCOPE.md` against the shipped PS-A1–PS-A5 criteria.
3. **Software Builder** writes `stock_alert.py`, `test_stock_alert.py`, `expected.json` and `USAGE.md`, and runs its local checks.
4. A **fixed independent oracle** checks an exact copy of that candidate. **Quality Reviewer**, under a different seat and observed session, examines the same immutable bytes, runs checks and writes `QA.json` and `QA.md`.
5. **Handoff Editor** writes `HANDOFF.md` for the exact reviewed candidate. The job stops at **Waiting for owner**.

Choose **Download reviewed files (.zip)**, inspect the files and usage, then use **Accept candidate** or **Reject candidate** with a **Review note**. A passed test, a handoff document or a different agent name cannot create owner acceptance. Provenance includes actual runtime session IDs, command receipts, captured role/context hashes, candidate file hashes and the oracle receipt. The original expected-output input is supplied as `EXPECTED-REFERENCE.json` so the deliverable is independently created.

New completed workflows use bundle format 2. The ZIP includes that pinned reference, the current candidate's required and supporting files, and the QA/handoff outputs at their original relative paths. QA and handoff receive the complete producer file set; a previous pass that did not receive a support dependency cannot seal a new reviewed bundle. Runtime bookkeeping is kept under `STAGE-EVIDENCE/<stage-kind>/<stage-id>/`, with its mapping explained in `BUNDLE-README.md`. Original agent documents and their recorded hashes are preserved. Existing format-1 downloads and owner-decision hashes remain unchanged, including any known omissions; a rejected historical candidate is never silently repackaged.

Every non-QA stage also writes `STAGE.json` with a ready, blocked or severe-stop decision. QA writes its criterion decisions in `QA.json`. These control records can stop the workflow before downstream work begins. `WORKFLOW-EXECUTION.json` is a receipt of the runtime's observed session identity, not a role's self-declared identity. QA must use the supplied trusted Python test command as a dedicated invocation; an echo, file-writing command or error-masking shell expression does not prove tests ran.

## Failure, repair and recovery

A normal verified defect permits at most **two repair candidates after the initial candidate**. Every repaired candidate returns to independent QA. A QA PASS contradicted by the exact fixed oracle is a severe evidence stop, not an ordinary repair. Severe findings, absent essential evidence and blocked permission route to owner attention; an unexecuted check is **NOT RUN**, never PASS. Missing Python or sandbox capability is a prerequisite failure before any model stage, not a failed utility test.

A failed or interrupted runtime can be explicitly retried at most twice. A retry resumes the incomplete stage with a fresh session and directory, retaining previous completed evidence. It does not silently replay completed provider calls. On server restart, queued and interrupted jobs become failed and require an explicit retry. Cancel stops queued work or aborts the active stage. Completed stage files remain available.

A workflow stage has a five-minute runtime limit, bounded command/output evidence and a 5 MB/100-file artifact limit. At most one company workflow runs at a time, with three jobs allowed active/queued. The existing individual-task queue is separate and runs at most one additional task. Configuration capacity is not runtime concurrency.

## Persistent evidence and Time Tracker

Real file bytes are captured into SQLite. The runtime reply is not converted into files. Full workspace backup/restore preserves jobs, artifacts, command evidence, company configuration and delivery-hours records; disposable stage folders are not the backup source. The JSON company-definition export intentionally contains configuration only.

Time Tracker remains separate. Book and correct human-equivalent delivery hours explicitly, using the shared reference catalog or a clear override. Job completion and elapsed runtime never create hours automatically. A workflow acceptance note does not claim human customer usefulness, deployment, revenue or saved money.

Use [the first-company guide](first-company.md), [recovery instructions](recovery.md), and [support intake](support.md) when needed. An internal engineering exercise is not a human pilot.
