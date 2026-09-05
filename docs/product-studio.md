# Product Studio workflow

Review candidate **0.1.0-alpha.3-local.3** ships a bounded software job, **PS-001: stock alert export**. Create **Product Studio (5 seats)** or **100-agent Product Studio**, then open **Work → Company jobs → Set up first job → Start job**. The 100-agent template contains five operational workflow seats; it does not launch 100 concurrent agents. The 20-agent template remains a lightweight configuration template.

## What Start authorizes

Starting PS-001 permits local file production and checks for the synthetic inventory brief, followed by independent review and a handoff. The optional Codex CLI uses your signed-in account and allowance. GitFlash itself has no account, billing or mandatory hosted inference.

Each stage runs in a new isolated directory and a new observed Codex session. The runtime may write there and execute local commands. Shell network, web, apps and other connected tools are disabled. The workspace sandbox restricts writes; it is not complete read isolation. Do not place confidential files beside experimental jobs; use a dedicated OS account when stronger isolation is needed. No publishing, messaging, spending, deployment or automatic owner decision is granted.

Python 3.8 or newer, using only the standard library, and the local Codex sandbox must pass a prerequisite check before any model stage starts. `GITFLASH_PYTHON_PATH` and `GITFLASH_CODEX_PATH` may specify absolute local executables. Native Windows supports the local core and Time Tracker; this workflow's fixed sandbox checker requires macOS or Linux. An earlier macOS adapter/sandbox observation is available; final-candidate Linux sandbox and cross-platform acceptance remain pending until linked in [acceptance evidence](acceptance.md). An available code path is not a verified platform result.

## Five real stages

1. **Delivery Manager** creates `INTAKE.md` with the bounded job and authority.
2. **Requirements Analyst** creates `SCOPE.md` against the shipped PS-A1–PS-A5 criteria.
3. **Software Builder** writes `stock_alert.py`, `test_stock_alert.py`, `expected.json` and `USAGE.md`, and runs its local checks.
4. A **fixed independent oracle** checks an exact copy of that candidate. **Quality Reviewer**, under a different seat and observed session, examines the same immutable bytes, runs checks and writes `QA.json` and `QA.md`.
5. **Handoff Editor** writes `HANDOFF.md` for the exact reviewed candidate. The job stops at **Waiting for owner**.

Choose **Download reviewed files (.zip)**, inspect the files and usage, then use **Accept candidate** or **Reject candidate** with a **Review note**. A passed test, a handoff document or a different agent name cannot create owner acceptance. Provenance includes actual runtime session IDs, command receipts, captured role/context hashes, candidate file hashes and the oracle receipt. The original expected-output input is supplied as `EXPECTED-REFERENCE.json` so the deliverable is independently created.

Every non-QA stage also writes `STAGE.json` with a ready, blocked or severe-stop decision. QA writes its criterion decisions in `QA.json`. These control records can stop the workflow before downstream work begins. `WORKFLOW-EXECUTION.json` is a receipt of the runtime's observed session identity, not a role's self-declared identity. QA must use the supplied trusted Python test command as a dedicated invocation; an echo, file-writing command or error-masking shell expression does not prove tests ran.

## Failure, repair and recovery

A normal verified defect permits at most **two repair candidates after the initial candidate**. Every repaired candidate returns to independent QA. A QA PASS contradicted by the exact fixed oracle is a severe evidence stop, not an ordinary repair. Severe findings, absent essential evidence and blocked permission route to owner attention; an unexecuted check is **NOT RUN**, never PASS. Missing Python or sandbox capability is a prerequisite failure before any model stage, not a failed utility test.

A failed or interrupted runtime can be explicitly retried at most twice. A retry resumes the incomplete stage with a fresh session and directory, retaining previous completed evidence. It does not silently replay completed provider calls. On server restart, queued and interrupted jobs become failed and require an explicit retry. Cancel stops queued work or aborts the active stage. Completed stage files remain available.

A workflow stage has a five-minute runtime limit, bounded command/output evidence and a 5 MB/100-file artifact limit. At most one company workflow runs at a time, with three jobs allowed active/queued. The existing individual-task queue is separate and runs at most one additional task. Configuration capacity is not runtime concurrency.

## Persistent evidence and Time Tracker

Real file bytes are captured into SQLite. The runtime reply is not converted into files. Full workspace backup/restore preserves jobs, artifacts, command evidence, company configuration and delivery-hours records; disposable stage folders are not the backup source. The JSON company-definition export intentionally contains configuration only.

Time Tracker remains separate. Book and correct human-equivalent delivery hours explicitly, using the shared reference catalog or a clear override. Job completion and elapsed runtime never create hours automatically. A workflow acceptance note does not claim human customer usefulness, deployment, revenue or saved money.

Use [the first-company guide](first-company.md), [recovery instructions](recovery.md), and [support intake](support.md) when needed. An internal engineering exercise is not a human pilot.
