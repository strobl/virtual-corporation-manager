# Your first corporation

Create a virtual corporation, give its agents a place, and record delivery hours. The optional Product Studio exercise below can then produce a local stock-alert utility with tests and review evidence.

## Install and check prerequisites

This guide targets **0.1.0-alpha.5** and the developer-first corporation interface. At preparation on 5 September 2026, final release checks and public availability remain pending. The earlier accepted local candidate is `0.1.0-alpha.5-local.1`; public alpha.2 is an older product without this interface, the Time Tracker or company workflow. A version string alone does not identify reviewed bytes.

Use Node.js **24.14 or newer in the 24.x line, or 26.x**. Check `node --version`. The [versioned GitHub release](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.5) is the public distribution route. Its intended asset is [gitflash-0.1.0-alpha.5.tgz](https://github.com/strobl/virtual-corporation-manager/releases/download/v0.1.0-alpha.5/gitflash-0.1.0-alpha.5.tgz); it is not claimed available until publication and an independent public download pass. For local review, use the supplied candidate archive instead. Verify the corresponding source and SHA-256 from the release or review manifest, then run:

```sh
npm install --offline --ignore-scripts --prefix ./vcm-preview ./gitflash-0.1.0-alpha.5.tgz
npm exec --offline --prefix ./vcm-preview -- vcm --version
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./vcm-first-company --no-open
```

The version must print `0.1.0-alpha.5`. Keep it with the archive checksum for any support report. Use a new data directory for this exercise; open the loopback URL printed in the terminal. If its port is occupied, add `--port 4311`. Keep that process running while using the workspace, then stop and restart with the same working directory and `--data-dir` to verify persistence.

`vcm` is the canonical command; `gitflash` remains a compatible alias for the same binary. Both preserve the existing `~/.gitflash` default, `GITFLASH_DATA_DIR` and explicit data paths. The package remains `gitflash`; no npm package named `vcm` is required.

## Create your corporation

1. Open **Your corporations**. In an empty workspace, choose **Set up a corporation**.
2. Enter the corporation name, short code and optional purpose. Continue to **Structure**. Start empty or choose **Use small team**, which adds two departments and three editable agents.
3. Add or edit departments and agents. Set each agent's name, role, department and reporting relationship; add responsibilities and instructions where useful. Back and the review screen's edit actions keep your entered fields.
4. Review the identity, counts and reporting lines. Choose **Review changes** to request the server's validated preview, then **Apply changes** to save the corporation. The saved **Company overview** opens automatically. Cancel or discard before Apply creates no company.
5. Open an agent to inspect its company, department and manager context. Use **Edit details** for a reviewed change; **Assignments** manages additional company assignments. **Manage organization** exposes the actual reporting structure, while company ownership remains separate.

If another window changes the workspace before review, VCM refreshes the revision without replacing your entered definition. If a save response is interrupted, use **Retry save** to confirm the same preview; do not start a second import. The pending receipt is retained in the tab for recovery after reload.

Return to **Your corporations** to choose among saved companies. Their overview counts and recorded hours are scoped to the company you open. Use **Add agent** or **Add department** whenever the structure needs to grow. Creating a corporation or agent starts no model work.

## Record delivery hours

Choose **Log time** from the company overview or an agent's details. A company needs an active assigned member before a new entry can be booked; the empty-company guidance links to **Add agent**. Confirm the company, member, date, description and explicit hours or reference-estimate basis, then save the entry.

Open **Time Tracker** for the weekly ledger, multiple entries on a day, entry details, corrections, void history and analytics. Correct an entry and inspect the retained history; reload the workspace to confirm the company and saved hours remain. These are human-equivalent delivery hours, separate from runtime duration or accepting a work result. See [Time Tracker](time-tracker.md) for reference definitions, estimates and export.

## Optional: run the Product Studio exercise

The included PS-001 job uses fictional Meadow Tools inventory. It produces `stock_alert.py`, tests, expected output and usage instructions; it does not connect to an inventory system or place orders. This optional execution path is separate from company setup and time logging.

Company setup needs no VCM account. The PS-001 workflow requires **macOS or compatible Linux**, the local Codex sandbox, a supported Codex CLI with a saved login, and **Python 3.8 or newer**. Native Windows supports the local core and Time Tracker, but this workflow's sandbox checker does not support it yet. Stock Ubuntu 24.04 with its AppArmor namespace restriction is unsupported for the optional workflow; the prerequisite check refuses execution before any provider stage. VCM does not weaken host policy to make it run. In a terminal, check `codex login status` and `python3 --version`. If login is missing, run `codex login` and complete its sign-in. Use **Integrations → Check connections** to confirm readiness. Model execution uses your provider allowance; free local software does not mean free model usage. See [workflow prerequisites and platform evidence](product-studio.md).

Choose **Browse company templates** on **Your corporations**, select **Product Studio (5 seats)** and choose **Preview structure**. Review its company and five roles, then choose **Apply changes**. Templates are also available from **Organization → Templates**. The created Product Studio opens in its company overview. The five seats are delivery manager, requirements analyst, builder, independent quality reviewer and handoff editor. The generic small-team setup is a separate starting structure and does not claim those workflow roles.

Select Product Studio before starting its job. If a required role is missing or duplicated, resolve the displayed role mapping instead of assigning an arbitrary agent. Additional 20/100-role organizations remain separate configurations.

### Start the included job

With your Product Studio selected, open **Work → Company jobs → Set up first job**. The **Start a Product Studio job** dialog identifies PS-001, the stock-alert exercise and all five assigned roles. Expand **Prerequisites and included files** and review the listed deliverables, platform requirements and resource notice. Enter the **Acceptance owner**: the person or clearly responsible role who will make the final decision, such as your company owner. Naming that responsibility does not record approval or acceptance. Choose **Start job** when ready. The action authorizes the listed local workflow and at most two corrective candidates after the initial candidate. It does not authorize external messages, purchases, deployment or changing the acceptance rules.

Before starting, fill **Acceptance owner** with the person or responsible role who will review the result. No account or legal name is required. Expand **Review the brief, criteria and sample data** to read the exact source materials. The named owner and start authority are captured with the job; final acceptance remains a separate decision.

The installed job supplies the prompts and synthetic input. You do not need private project files, a prepared implementation or copied code blocks. The delivery manager records the intake, the requirements analyst writes the scope, the builder creates the candidate files, an independent QA step checks that exact candidate, and the handoff editor prepares its delivery record. A role listed on the screen is not proof that it executed: use the job's retained stage and run evidence.

Allow the job to finish or report a specific blocker. Do not repeatedly start the same job while waiting. If the evidence is missing, a tool fails or the bounded repairs are exhausted, preserve the partial result and follow the displayed next action. A severe contradiction in test or acceptance evidence stops ordinary repair and requires manager review.

### Inspect the result and decide

Open **Work → Company jobs**, select the completed job, and inspect its artifacts and QA record. The usable result must include:

- `stock_alert.py`, exporting `reorder_items(products)`.
- `test_stock_alert.py`, runnable standard-library tests.
- `expected.json`, the expected replenishment list.
- `USAGE.md`, explaining local use and limitations.

The supplied example must produce A-100 quantity 4, then M-300 quantity 5. Equal/above-threshold inventory is omitted. Invalid values, including booleans, are rejected; the input remains unchanged. Review PS-A1–PS-A5 with the actual candidate hashes, check commands and results. An unverified report is not an observed test failure; missing evidence cannot become PASS.

The job also retains `INTAKE.md`, `SCOPE.md`, `QA.json`, `QA.md` and `HANDOFF.md` as the team's working records. The supplied expected-output reference is separate from the builder's submitted `expected.json`; reference data alone does not prove that the candidate ran successfully.

Download the artifact bundle directly from the job. You should not need to create Python files by copying text from a model response. If the download is missing, incomplete or inconsistent with the reviewed version, retain the job reference and report that blocker.

QA success leaves the result awaiting your decision. Use the job's owner-review action only after inspecting the exact result and its limitations. Accepting this synthetic result records your decision about this exercise; it does not establish customer success, external release or real savings. If you cannot assess the result, leave it awaiting review and request appropriate help.

## Keep time and outcome separate

Open **Time Tracker** to inspect delivery hours. It records booked human-equivalent delivery hours, with explicit, catalog or fallback-estimate basis. Starting or accepting this job must not silently create or change those bookings. Runtime duration is a separate technical measurement. No time, money or labor saving is inferred from this example.

## Get help

Use the included [support instructions](support.md). Preserve the release version, job reference, failing step, expected/actual behavior and a minimal synthetic reproduction. Do not upload your whole workspace, credentials, provider login files or private work. A report about possible security exposure belongs in the repository's private security-report route.
