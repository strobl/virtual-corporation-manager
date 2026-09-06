# Your first Product Studio result

Create a small Product Studio and run its included stock-alert job. The job uses fictional Meadow Tools inventory. It produces a local Python utility, tests, expected output and usage instructions; it does not connect to an inventory system or place orders.

## Install and check prerequisites

This guide accompanies candidate **0.1.0-alpha.6**. Use Node.js **24.14 or newer in the 24.x line, or 26.x**. Check `node --version` before installing. Download the matching archive supplied with this candidate, then run these commands from the folder containing it:

```sh
npm install --offline --ignore-scripts --prefix ./vcm-preview ./gitflash-0.1.0-alpha.6.tgz
npm exec --offline --prefix ./vcm-preview -- vcm --version
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./vcm-first-company --no-open
```

The version must print `0.1.0-alpha.6`. Keep it for any support report. Use a new data directory for this first exercise; open the local URL printed in the terminal. If its port is occupied, add `--port 4311` to the start command. Keep that process running while the job works. Use the matching release archive after publication or the exact supplied review candidate; earlier public downloads are separate artifacts. [Release acceptance](../../acceptance.md#branding-maintenance-release--6-september-2026) records the current checks and remaining PS-001 limitations.

Company setup needs no VCM account. The PS-001 workflow requires **macOS or Linux**, the local Codex sandbox, a supported Codex CLI with a saved login, and **Python 3.8 or newer**. Native Windows supports the local core and Time Tracker, but this workflow's sandbox checker does not support it yet. In a terminal, check `codex login status` and `python3 --version`. If login is missing, run `codex login` and complete its sign-in. Use **Integrations → Check connections** to confirm readiness. Model execution uses your provider allowance; free VCM software does not mean free model usage.

## Create the team

Open **Your corporations → Browse company templates**, choose **Product Studio (5 seats)** and **Preview structure**, review the company, responsibilities and reporting lines, then choose **Apply changes**. This configures five seats: delivery manager, requirements analyst, builder, independent quality reviewer and handoff editor. Creating them starts no model work.

Select this company before starting its job. If a required role is missing or duplicated, resolve the displayed role mapping instead of assigning an arbitrary agent. Additional 20/100-role organizations remain separate configurations.

## Start the included job

Open **Work → Company jobs**, select your Product Studio, then choose **Set up first job**. The **Start a Product Studio job** dialog identifies PS-001, the stock-alert exercise and all five assigned roles. Expand **Prerequisites and included files** and review the listed deliverables, platform requirements and resource notice. Enter the **Acceptance owner**: the person or clearly responsible role who will make the final decision, such as your company owner. Naming that responsibility does not record approval or acceptance. Choose **Start job** when ready. The action authorizes the listed local workflow and at most two corrective candidates after the initial candidate. It does not authorize external messages, purchases, deployment or changing the acceptance rules.

The installed job supplies the prompts and synthetic input. You do not need private project files, a prepared implementation or copied code blocks. The delivery manager records the intake, the requirements analyst writes the scope, the builder creates the candidate files, an independent QA step checks that exact candidate, and the handoff editor prepares its delivery record. A role listed on the screen is not proof that it executed: use the job's retained stage and run evidence.

Allow the job to finish or report a specific blocker. Do not repeatedly start the same job while waiting. If the evidence is missing, a tool fails or the bounded repairs are exhausted, preserve the partial result and follow the displayed next action. A severe contradiction in test or acceptance evidence stops ordinary repair and requires manager review.

## Inspect the result and decide

Open the completed job's artifacts and QA record. The usable result must include:

- `stock_alert.py`, exporting `reorder_items(products)`.
- `test_stock_alert.py`, runnable standard-library tests.
- `expected.json`, the expected replenishment list.
- `USAGE.md`, explaining local use and limitations.

The supplied example must produce A-100 quantity 4, then M-300 quantity 5. Equal/above-threshold inventory is omitted. Invalid values, including booleans, are rejected; the input remains unchanged. Review PS-A1–PS-A5 with the actual candidate hashes, check commands and results. An unverified report is not an observed test failure; missing evidence cannot become PASS.

The job also retains `INTAKE.md`, `SCOPE.md`, `QA.json`, `QA.md` and `HANDOFF.md` as the team's working records. The supplied expected-output reference is separate from the builder's submitted `expected.json`; reference data alone does not prove that the candidate ran successfully.

Download the artifact bundle directly from the job. You should not need to create Python files by copying text from a model response. If the download is missing, incomplete or inconsistent with the reviewed version, retain the job reference and report that blocker.

QA success leaves the result awaiting your decision. Use the job's owner-review action only after inspecting the exact result and its limitations. Accepting this synthetic result records your decision about this exercise; it does not establish customer success, external release or real savings. If you cannot assess the result, leave it awaiting review and request appropriate help.

## Keep time and outcome separate

Time Tracker records booked human-equivalent delivery hours, with explicit, catalog or fallback-estimate basis. Starting or accepting this job must not silently create or change those bookings. Runtime duration is a separate technical measurement. No time, money or labor saving is inferred from this example.

## Get help

Use the included [support instructions](SUPPORT.md). Preserve the release version, job reference, failing step, expected/actual behavior and a minimal synthetic reproduction. Do not upload your whole workspace, credentials, provider login files or private work. A report about possible security exposure belongs in the repository's private security-report route.
